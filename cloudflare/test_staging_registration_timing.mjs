/**
 * Test registration timing, deferred delivery and failed-email cleanup using
 * the ORIGINAL Worker code with the isolated v2 candidate copied into runner.
 *
 * NEVER sends real email or modifies Cloudflare D1 / Supabase.
 */
import assert from "node:assert/strict";
import {test} from "node:test";
import {fileURLToPath,pathToFileURL} from "node:url";
import path from "node:path";
const here=path.dirname(fileURLToPath(import.meta.url));
const folder=path.join(here,"staging-source-2026-11-11","recovered-src");
const {emailAuthRoute}=await import(pathToFileURL(path.join(folder,"email-auth-routes.js")).href);
const BASE="https://bellaquitas-api-staging.bellaquitas-fest-410.workers.dev";
const EMAIL="nueva@example.test",EXISTING="existente@example.test",PASSWORD="ClaveFicticia#2026";
const now=()=>Math.floor(Date.now()/1000);
const pending=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};

class FakeDB{
  constructor(existing=false){
    this.existing=existing;
    this.tokens=new Map();
    this.limits=new Map();
    this.inserts=0;
    this.credentialWrites=0;
  }
  prepare(sql){
    const db=this;
    return {
      args:[],
      bind(...args){this.args=args;return this;},
      async first(){
        const a=this.args;
        if(sql.includes("INSERT INTO auth_email_rate_limits")){
          const rec=db.limits.get(a[0])||{count:0,expiration:now()+a[1]};
          rec.count++;db.limits.set(a[0],rec);
          return {attempts:rec.count,retry_seconds:300};
        }
        if(sql.includes("SELECT attempts")&&sql.includes("auth_email_rate_limits"))return null;
        if(sql.includes("SELECT profile_id FROM auth_email_credentials WHERE email=?"))
          return db.existing?{profile_id:"00000000-0000-4000-8000-000000000009"}:null;
        throw Error("SQL de lectura inesperada: "+sql.slice(0,110));
      },
      async run(){
        const a=this.args;
        if(sql.includes("DELETE FROM auth_email_tokens WHERE email=")){
          for(const [key,v] of db.tokens)if(v.email===a[0]&&v.purpose==="register")db.tokens.delete(key);
          return {success:true};
        }
        if(sql.includes("INSERT INTO auth_email_tokens(")){
          db.inserts++;
          db.tokens.set(a[0],{hash:a[0],email:a[1],purpose:"register",name:a[2],
            passwordHash:a[3],salt:a[4],iterations:a[5]});
          return {success:true};
        }
        if(sql.includes("DELETE FROM auth_email_tokens WHERE token_hash=?")){
          db.tokens.delete(a[0]);return {success:true};
        }
        throw Error("SQL de escritura inesperada: "+sql.slice(0,110));
      }
    };
  }
  async batch(steps){
    for(const item of steps)await item.run();
    return [];
  }
}
function env(DB){
  return {DB,PUBLIC_ORIGIN:BASE,EMAIL_AUTH_ENABLED:"yes",EMAIL_REGISTRATION_ENABLED:"yes",
    EMAIL_RATE_KEY:"FAKE-RATE-KEY-WITH-AT-LEAST-32-CHARACTERS",
    RESEND_API_KEY:"FAKE-EMAIL-SERVICE-KEY",
    RESEND_FROM:"no-reply@example.test",
    TURNSTILE_SECRET:"FAKE-TURNSTILE-SECRET-000001",
    TURNSTILE_SITE_KEY:"FAKE-TURNSTILE-SITE-KEY",
    TURNSTILE_EXPECTED_HOSTNAME:new URL(BASE).hostname};
}
function request(email=EMAIL){
  return new Request(BASE+"/v1/auth/email/register",{
    method:"POST",
    headers:{"Origin":BASE,"Sec-Fetch-Site":"same-origin","Content-Type":"application/json"},
    body:JSON.stringify({email,name:"Socio imaginario",password:PASSWORD,
      turnstileToken:"fake-captcha-token-long",return_to:"espejo"})
  });
}
function context(){
  return {tasks:[],waitUntil(p){this.tasks.push(p);}};
}
function mockNetwork(mailMode="success"){
  const prev=globalThis.fetch;
  const messages=[],delivery=pending();
  globalThis.fetch=async(url,options)=>{
    const str=String(url);
    if(str==="https://challenges.cloudflare.com/turnstile/v0/siteverify")
      return new Response(JSON.stringify({success:true,hostname:new URL(BASE).hostname}),{status:200});
    if(str==="https://api.resend.com/emails"){
      messages.push(JSON.parse(options.body));
      if(mailMode==="deferred")return delivery.promise;
      return new Response(JSON.stringify({id:"fake"}),{status:mailMode==="failure"?503:200});
    }
    throw Error("Red real prohibida: "+str);
  };
  return {messages,delivery,restore(){globalThis.fetch=prev;}};
}
async function withHashCounter(run){
  const subtle=crypto.subtle,original=subtle.deriveBits.bind(subtle);
  let calls=0;
  Object.defineProperty(subtle,"deriveBits",{configurable:true,value:async (...args)=>{
    assert.equal(args[0].iterations,100000);
    calls++;
    return original(...args);
  }});
  try{const result=await run();return {result,calls};}
  finally{delete subtle.deriveBits;}
}
test("registro nuevo y correo existente ejecutan seis rondas PBKDF2 y respuesta genérica",async()=>{
  const network=mockNetwork();
  try{
    const freshDb=new FakeDB(),freshCtx=context();
    const fresh=await withHashCounter(async()=>emailAuthRoute(request(EMAIL),env(freshDb),freshCtx));
    assert.equal(fresh.result.status,200);
    assert.equal(fresh.calls,6);
    const oldDb=new FakeDB(true),oldCtx=context();
    const old=await withHashCounter(async()=>emailAuthRoute(request(EXISTING),env(oldDb),oldCtx));
    assert.equal(old.calls,6);
    assert.equal(old.result.status,200);
    assert.deepEqual(await fresh.result.json(),await old.result.json());
    assert.equal(freshCtx.tasks.length,1);
    assert.equal(oldCtx.tasks.length,0);
    assert.equal(network.messages.length,1);
    assert.equal(freshDb.tokens.size,1);
    assert.equal(oldDb.tokens.size,0);
    await Promise.all(freshCtx.tasks);
  }finally{network.restore();}
});
test("respuesta genérica sale antes de que Resend termine; no se envía email real",async()=>{
  const network=mockNetwork("deferred");
  try{
    const db=new FakeDB(),ctx=context();
    const response=await emailAuthRoute(request(),env(db),ctx);
    assert.equal(response.status,200);
    assert.equal(ctx.tasks.length,1);
    assert.equal(db.tokens.size,1);
    assert.equal(network.messages.length,1);
    // La promesa Resend sigue pendiente al recibir la respuesta.
    let finished=false;
    ctx.tasks[0].then(()=>{finished=true;});
    await Promise.resolve();
    assert.equal(finished,false);
    network.delivery.resolve(new Response(JSON.stringify({id:"fake"}),{status:200}));
    await Promise.all(ctx.tasks);
    assert.equal(finished,true);
    assert.equal(db.tokens.size,1);
  }finally{network.restore();}
});
test("si falla el proveedor, se elimina el token de registro de ensayo",async()=>{
  const network=mockNetwork("failure");
  try{
    const db=new FakeDB(),ctx=context();
    const response=await emailAuthRoute(request(),env(db),ctx);
    assert.equal(response.status,200);
    await Promise.all(ctx.tasks);
    assert.equal(db.inserts,1);
    assert.equal(db.tokens.size,0,"No debe quedar enlace verificable si email falla");
  }finally{network.restore();}
});
test("el origen ajeno es rechazado sin hash ni correo ni escritura",async()=>{
  const network=mockNetwork();
  try{
    const db=new FakeDB(),ctx=context();
    const req=request();
    req.headers.set("Origin","https://externo.invalid");
    req.headers.set("Sec-Fetch-Site","cross-site");
    const response=await emailAuthRoute(req,env(db),ctx);
    assert.equal(response.status,403);
    assert.equal(db.tokens.size,0);
    assert.equal(network.messages.length,0);
    assert.equal(ctx.tasks.length,0);
  }finally{network.restore();}
});
