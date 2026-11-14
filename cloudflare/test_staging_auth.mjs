/**
 * Bellaquitas Fest: pruebas de correo, OAuth y sesiones con Worker real
 * y servicios D1/Resend/Turnstile completamente simulados.
 *
 * NO HACE NINGUNA CONEXIÓN REAL NI REGISTRA USUARIOS.
 * node cloudflare/staging-source-2026-11-11/extract-modules.mjs
 * node --experimental-default-type=module --test cloudflare/test_staging_auth.mjs
 */
import assert from "node:assert/strict";
import {test} from "node:test";
import {fileURLToPath,pathToFileURL} from "node:url";
import path from "node:path";
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.join(here,"staging-source-2026-11-11","recovered-src");
const {authRoute,authenticatedProfile}=await import(pathToFileURL(path.join(root,"auth-routes.js")).href);
const {emailAuthRoute}=await import(pathToFileURL(path.join(root,"email-auth-routes.js")).href);
const BASE="https://bellaquitas-api-staging.bellaquitas-fest-410.workers.dev";
const EMAIL="ficticio@example.test";
const PASSWORD="ClaveTemporal#2026";
const NEW_PASSWORD="NuevaClave#2027";
const NOW=()=>Math.floor(Date.now()/1000);

class FakeStatement{
  constructor(db,sql){this.db=db;this.sql=sql;this.args=[];}
  bind(...v){this.args=v;return this;}
  async first(){
    const s=this.sql,d=this.db,a=this.args;
    if(s.includes("INSERT INTO auth_email_rate_limits")){
      const rec=d.limits.get(a[0])||{attempts:0,expires_at:NOW()+a[1]};
      rec.attempts=rec.expires_at<=NOW()?1:rec.attempts+1;
      rec.expires_at=Math.max(rec.expires_at,NOW()+a[1]);
      d.limits.set(a[0],rec);
      return {attempts:rec.attempts,retry_seconds:Math.max(1,rec.expires_at-NOW())};
    }
    if(s.includes("FROM auth_email_rate_limits WHERE")){const v=d.limits.get(a[0]);return v?{attempts:v.attempts,retry_seconds:Math.max(0,v.expires_at-NOW())}:null;}
    if(s.includes("SELECT profile_id FROM auth_email_credentials")){const x=d.creds.get(a[0]);return x?{profile_id:x.profile_id}:null;}
    if(s.includes("SELECT email,profile_id,password_hash,password_salt,password_iterations FROM auth_email_credentials")){
      const c=d.creds.get(a[0]);return c&&c.verified_at?{...c}:null;
    }
    if(s.includes("DELETE FROM auth_email_tokens WHERE token_hash=")){
      const rec=d.tokens.get(a[0]);
      if(!rec||rec.purpose!==(s.includes("purpose='register'")?"register":"reset")||rec.expires_at<=NOW())return null;
      d.tokens.delete(a[0]);return {...rec};
    }
    if(s.includes("FROM auth_sessions s JOIN profiles p")){
      const v=d.sessions.get(a[0]);return v&&v.expires_at>NOW()?d.profiles.get(v.profile_id)||null:null;
    }
    if(s.includes("DELETE FROM auth_oauth_states WHERE state_hash")){
      const rec=d.oauthStates.get(a[0]);if(!rec||rec.expires_at<=NOW())return null;
      d.oauthStates.delete(a[0]);return {...rec};
    }
    if(s.includes("SELECT id FROM profiles WHERE"))return d.profiles.get(a[0])||null;
    throw new Error("Consulta SELECT desconocida en test: "+s.slice(0,130));
  }
  async run(){
    const s=this.sql,d=this.db,a=this.args;
    if(s.includes("DELETE FROM auth_email_tokens WHERE email=")){
      for(const [id,rec] of d.tokens)if(rec.email===a[0]&&rec.purpose===(s.includes("'register'")?"register":"reset"))d.tokens.delete(id);
      return {success:true};
    }
    if(s.includes("INSERT INTO auth_email_tokens(")){
      const isReg=s.includes("'register'");
      d.tokens.set(a[0],{token_hash:a[0],email:a[1],purpose:isReg?"register":"reset",
        profile_name:isReg?a[2]:null,password_hash:isReg?a[3]:null,
        password_salt:isReg?a[4]:null,password_iterations:isReg?a[5]:null,
        expires_at:NOW()+(isReg?1800:1200)});
      return {success:true};
    }
    if(s.includes("DELETE FROM auth_email_tokens WHERE token_hash=")){d.tokens.delete(a[0]);return {success:true};}
    if(s.includes("INSERT INTO profiles(")){
      d.profiles.set(a[0],{id:a[0],name:a[1],role:"socio",member_code:a[2],
        points:0,lifetime_points:0,visits:0,created_at:new Date().toISOString()});
      return {success:true};
    }
    if(s.includes("INSERT INTO auth_email_credentials(")){
      d.creds.set(a[0],{email:a[0],profile_id:a[1],password_hash:a[2],
        password_salt:a[3],password_iterations:a[4],verified_at:NOW()});return {success:true};
    }
    if(s.includes("INSERT INTO auth_identity_links(")){d.identityLinks.set(a[1],a[2]);return {success:true};}
    if(s.includes("INSERT INTO auth_sessions(")){
      d.sessions.set(a[0],{profile_id:a[1],expires_at:NOW()+a[2]});return {success:true};
    }
    if(s.includes("DELETE FROM auth_sessions WHERE token_hash=")){d.sessions.delete(a[0]);return {success:true};}
    if(s.includes("UPDATE auth_email_credentials SET password_hash=")){
      const c=d.creds.get(a[3]);if(!c)throw Error("Missing simulated email record");
      Object.assign(c,{password_hash:a[0],password_salt:a[1],password_iterations:a[2]});return {success:true};
    }
    if(s.includes("DELETE FROM auth_sessions WHERE profile_id=")){
      const c=d.creds.get(a[0]);for(const [key,rec] of d.sessions)if(rec.profile_id===c?.profile_id)d.sessions.delete(key);
      return {success:true};
    }
    if(s.includes("DELETE FROM auth_oauth_states WHERE expires_at"))return {success:true};
    if(s.includes("INSERT INTO auth_oauth_states(")){
      d.oauthStates.set(a[0],{state_hash:a[0],pkce_verifier:a[1],nonce:a[2],expires_at:NOW()+600});
      return {success:true};
    }
    throw new Error("Mutación DB no simulada: "+s.slice(0,130));
  }
}
class FakeDB{
  constructor(){this.creds=new Map();this.tokens=new Map();this.profiles=new Map();
    this.sessions=new Map();this.identityLinks=new Map();this.limits=new Map();this.oauthStates=new Map();}
  prepare(sql){return new FakeStatement(this,sql);}
  async batch(statements){for(const stmt of statements)await stmt.run();return [];}
}
function fakeEnv(db=new FakeDB(),flags={}){
  return {DB:db,PUBLIC_ORIGIN:BASE,ALLOW_NEW_ACCOUNTS:"no",
    EMAIL_AUTH_ENABLED:"yes",EMAIL_REGISTRATION_ENABLED:"yes",
    EMAIL_RATE_KEY:"FAKE-RATE-LIMIT-KEY-IS-NOT-A-SECRET-00001",
    RESEND_API_KEY:"FAKE-RESEND-KEY-NOT-A-REAL-KEY",
    RESEND_FROM:"noreply@example.test",
    TURNSTILE_SECRET:"FAKE-TURNSTILE-SECRET",
    TURNSTILE_SITE_KEY:"FAKE-TURNSTILE-SITEKEY",
    TURNSTILE_EXPECTED_HOSTNAME:new URL(BASE).hostname,
    GOOGLE_CLIENT_ID:"fake-oauth-client-id.apps.googleusercontent.com",
    GOOGLE_CLIENT_SECRET:"FAKE-NOT-REAL",
    ...flags};
}
function request(route,{method="POST",body,origin=BASE,cookie}={}){
  const headers={"Origin":origin,"Sec-Fetch-Site":origin===BASE?"same-origin":"cross-site"};
  if(body!==undefined)headers["Content-Type"]="application/json";
  if(cookie)headers.Cookie=cookie;
  return new Request(BASE+route,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
}
async function response(route,env,body,options={}){
  const res=await emailAuthRoute(request(route,{body,...options}),env);
  assert.ok(res);return res;
}
async function status(res,code){assert.equal(res.status,code);return res.json();}
function withNetworkMock(){
  const original=globalThis.fetch,mail=[],hits=[];
  globalThis.fetch=async(input,init={})=>{
    const url=String(input);hits.push(url);
    if(url==="https://challenges.cloudflare.com/turnstile/v0/siteverify")
      return new Response(JSON.stringify({success:true,hostname:new URL(BASE).hostname}),{status:200});
    if(url==="https://api.resend.com/emails"){
      const req=JSON.parse(init.body);mail.push(req);
      return new Response(JSON.stringify({id:"fake-not-sent"}),{status:200});
    }
    throw new Error("Bloqueada toda conexión no simulada: "+new URL(url).hostname);
  };
  return {mail,hits,restore:()=>{globalThis.fetch=original;}};
}
function tokenFromMail(mail,prefix){
  assert.ok(mail?.text,"El servicio simulado debe generar mensaje");
  const m=mail.text.match(new RegExp(prefix+"=([A-Za-z0-9_-]{43})"));
  assert.ok(m,"No se encontró token de "+prefix+" en el correo simulado");
  return m[1];
}
async function registerVerify(env,mails){
  const reg=await response("/v1/auth/email/register",env,{
    email:EMAIL,name:"Socio Ficticio",password:PASSWORD,
    turnstileToken:"fake-turnstile-token-long",return_to:"espejo"
  });
  await status(reg,200);
  assert.equal(mails.length,1);
  const t=tokenFromMail(mails[0],"verify");
  await status(await response("/v1/auth/email/verify",env,{token:t}),200);
  return t;
}

test("el modo desactivado falla de forma segura",async()=>{
  const env=fakeEnv(new FakeDB(),{EMAIL_AUTH_ENABLED:"no"});
  const s=await response("/v1/auth/email/status",env,undefined,{method:"GET"});
  const data=await status(s,200);assert.equal(data.login,false);assert.equal(data.registration,false);
  await status(await response("/v1/auth/email/login",env,{email:EMAIL,password:PASSWORD}),503);
});
test("se exige POST y origen propio para registro/recuperación",async()=>{
  const env=fakeEnv();
  await status(await response("/v1/auth/email/register",env,undefined,{method:"GET"}),405);
  await status(await response("/v1/auth/email/forgot",env,{email:EMAIL},{
    origin:"https://untrusted.invalid"
  }),403);
});
test("un registro con contraseña débil o correo inválido no se envía",async()=>{
  const env=fakeEnv();
  await status(await response("/v1/auth/email/register",env,{
    email:EMAIL,name:"Socio Ficticio",password:"123"
  }),400);
  await status(await response("/v1/auth/email/register",env,{
    email:"mal",name:"Socio Ficticio",password:PASSWORD
  }),400);
  assert.equal(env.DB.tokens.size,0);
});
test("Google OAuth inicia con PKCE S256 y sin contactar Google",async()=>{
  const env=fakeEnv();
  const res=await authRoute(request("/v1/auth/google/start?return=mirror",{method:"GET"}),env);
  assert.equal(res.status,302);
  const url=new URL(res.headers.get("Location"));
  assert.equal(url.origin,"https://accounts.google.com");
  assert.equal(url.searchParams.get("code_challenge_method"),"S256");
  assert.equal(url.searchParams.get("scope"),"openid email profile");
  assert.equal(url.searchParams.get("redirect_uri"),BASE+"/v1/auth/google/callback");
  assert.equal(url.searchParams.get("state")?.length,43);
  assert.equal(env.DB.oauthStates.size,1);
});
test("Google OAuth rechaza callback sin state y sin código",async()=>{
  const env=fakeEnv();
  let res=await authRoute(request("/v1/auth/google/callback?code=fake",{method:"GET"}),env);
  assert.equal(res.status,400);
  res=await authRoute(request("/v1/auth/google/callback?state=notvalid",{method:"GET"}),env);
  assert.equal(res.status,400);
});
test("registro verificado, login seguro, sesión persistente y logout",async()=>{
  const mock=withNetworkMock();
  try{
    const env=fakeEnv();
    const used=await registerVerify(env,mock.mail);
    assert.equal(env.DB.profiles.size,1);
    assert.equal([...env.DB.profiles.values()][0].role,"socio");
    await status(await response("/v1/auth/email/verify",env,{token:used}),400);
    const login=await response("/v1/auth/email/login",env,{email:EMAIL,password:PASSWORD});
    assert.equal(login.status,200);
    const cookie=login.headers.get("set-cookie");
    assert.match(cookie,/^__Host-bf_session=[A-Za-z0-9_-]{43};/);
    assert.match(cookie,/Secure; HttpOnly; SameSite=Lax/);
    assert.match(cookie,/Max-Age=2592000/);
    const storedCookie=cookie.split(";")[0];
    const me=await authRoute(request("/v1/auth/me",{method:"GET",cookie:storedCookie}),env);
    const data=await status(me,200);
    assert.equal(data.authenticated,true);
    assert.equal(data.profile.role,"socio");
    // Nueva petición con misma cookie: sesión preservada entre peticiones.
    const again=await authenticatedProfile(request("/v1/auth/me",{method:"GET",cookie:storedCookie}),env);
    assert.equal(again.id,data.profile.id);
    const logout=await authRoute(request("/v1/auth/logout",{
      method:"POST",cookie:storedCookie
    }),env);
    assert.equal(logout.status,200);
    assert.match(logout.headers.get("set-cookie"),/Max-Age=0/);
    const after=await authRoute(request("/v1/auth/me",{method:"GET",cookie:storedCookie}),env);
    assert.equal((await after.json()).authenticated,false);
    assert.equal(mock.mail.length,1);
  }finally{mock.restore();}
});
test("recuperación de contraseña invalida sesiones y no permite reusar el token",async()=>{
  const mock=withNetworkMock();
  try{
    const env=fakeEnv();
    await registerVerify(env,mock.mail);
    const l=await response("/v1/auth/email/login",env,{email:EMAIL,password:PASSWORD});
    const session=l.headers.get("set-cookie").split(";")[0];
    assert.equal((await status(await authRoute(request("/v1/auth/me",{method:"GET",cookie:session}),env),200)).authenticated,true);
    const forgot=await response("/v1/auth/email/forgot",env,{
      email:EMAIL,return_to:"espejo",turnstileToken:"fake-turnstile-token-long"
    });
    await status(forgot,200);
    assert.equal(mock.mail.length,2);
    const token=tokenFromMail(mock.mail[1],"reset_token");
    await status(await response("/v1/auth/email/reset",env,{token,password:NEW_PASSWORD}),200);
    await status(await response("/v1/auth/email/reset",env,{token,password:NEW_PASSWORD}),400);
    assert.equal(env.DB.sessions.size,0);
    const me=await authRoute(request("/v1/auth/me",{method:"GET",cookie:session}),env);
    assert.equal((await me.json()).authenticated,false);
    await status(await response("/v1/auth/email/login",env,{email:EMAIL,password:PASSWORD}),401);
    await status(await response("/v1/auth/email/login",env,{email:EMAIL,password:NEW_PASSWORD}),200);
    assert.equal(mock.mail.length,2);
  }finally{mock.restore();}
});
test("recuperación de correo desconocido responde de forma genérica",async()=>{
  const mock=withNetworkMock();
  try{
    const env=fakeEnv();
    const r=await response("/v1/auth/email/forgot",env,{
      email:EMAIL,turnstileToken:"fake-turnstile-token-long"
    });
    const data=await status(r,200);
    assert.equal(data.ok,true);
    assert.equal(mock.mail.length,0);
  }finally{mock.restore();}
});
test("Turnstile con hostname ajeno no puede crear cuenta",async()=>{
  const old=globalThis.fetch;
  let requests=0;
  globalThis.fetch=async(url)=>{
    assert.equal(url,"https://challenges.cloudflare.com/turnstile/v0/siteverify");
    requests++;return new Response(JSON.stringify({success:true,hostname:"sitio-invalido.example"}),{status:200});
  };
  try{
    const env=fakeEnv();
    const res=await response("/v1/auth/email/register",env,{
      email:EMAIL,name:"Socio Ficticio",password:PASSWORD,
      turnstileToken:"fake-turnstile-token-long"
    });
    await status(res,403);
    assert.equal(env.DB.tokens.size,0);
    assert.equal(requests,1);
  }finally{globalThis.fetch=old;}
});
test("no se exponen secretos en estado público de correo",async()=>{
  const env=fakeEnv();
  const r=await response("/v1/auth/email/status",env,undefined,{method:"GET"});
  const data=await status(r,200);
  assert.equal(data.login,true);assert.equal(data.registration,true);
  assert.equal(data.turnstileSiteKey,env.TURNSTILE_SITE_KEY);
  assert.ok(!JSON.stringify(data).includes(env.RESEND_API_KEY));
  assert.ok(!JSON.stringify(data).includes(env.EMAIL_RATE_KEY));
});
