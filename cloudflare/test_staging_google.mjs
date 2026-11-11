/**
 * Bellaquitas Fest: Google OAuth extremo a extremo con credenciales, Google
 * JWKS y base de datos completamente FICTICIOS y simulados.
 * NO realiza conexiones reales, NO modifica usuarios ni sesiones reales.
 *
 * node cloudflare/staging-source-2026-11-11/extract-modules.mjs
 * node --experimental-default-type=module --test cloudflare/test_staging_google.mjs
 */
import assert from "node:assert/strict";
import {test} from "node:test";
import {fileURLToPath,pathToFileURL} from "node:url";
import path from "node:path";

const root=path.join(path.dirname(fileURLToPath(import.meta.url)),
  "staging-source-2026-11-11","recovered-src");
const {authRoute}=await import(pathToFileURL(path.join(root,"auth-routes.js")).href);
const BASE="https://bellaquitas-api-staging.bellaquitas-fest-410.workers.dev";
const EXISTING="00000000-0000-4000-8000-000000009999";
const SUBJECT="100000000001";
const OAUTH_CLIENT="fake-client-id.apps.googleusercontent.com";
const NOW=()=>Math.floor(Date.now()/1000);
const enc=x=>Buffer.from(x).toString("base64url");
const hash=async s=>enc(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)));

const rsa=await crypto.subtle.generateKey({
  name:"RSASSA-PKCS1-v1_5",modulusLength:2048,
  publicExponent:new Uint8Array([1,0,1]),hash:"SHA-256"
},true,["sign","verify"]);
const rsaAlt=await crypto.subtle.generateKey({
  name:"RSASSA-PKCS1-v1_5",modulusLength:2048,
  publicExponent:new Uint8Array([1,0,1]),hash:"SHA-256"
},true,["sign","verify"]);
const pub=await crypto.subtle.exportKey("jwk",rsa.publicKey);
Object.assign(pub,{kid:"fake-test-key",use:"sig",alg:"RS256"});

async function jwt(claims,privateKey=rsa.privateKey){
  const header=enc(JSON.stringify({alg:"RS256",kid:pub.kid,typ:"JWT"}));
  const body=enc(JSON.stringify(claims));
  const message=header+"."+body;
  const signature=await crypto.subtle.sign("RSASSA-PKCS1-v1_5",privateKey,new TextEncoder().encode(message));
  return message+"."+enc(signature);
}

class FakeDB{
  constructor(withGoogleLink=true){
    this.oauthStates=new Map();this.sessions=new Map();
    this.profile={id:EXISTING,name:"Ficticio Google",role:"socio",member_code:"MBR-TESTGOOGLE",
      points:0,lifetime_points:0,visits:0,created_at:"2026-11-11T00:00:00Z"};
    this.link=withGoogleLink;
    this.newProfiles=0;
  }
  prepare(sql){
    const db=this;
    return {
      args:[],
      bind(...args){this.args=args;return this;},
      async first(){
        const a=this.args;
        if(sql.includes("DELETE FROM auth_oauth_states WHERE state_hash=")){
          const row=db.oauthStates.get(a[0]);if(!row||row.expires_at<=NOW())return null;
          db.oauthStates.delete(a[0]);return {...row};
        }
        if(sql.includes("SELECT profile_id FROM auth_identity_links")){
          return db.link&&a[0]===SUBJECT?{profile_id:EXISTING}:null;
        }
        if(sql.includes("SELECT id FROM profiles WHERE id="))
          return a[0]===EXISTING?{id:EXISTING}:null;
        if(sql.includes("FROM auth_sessions s JOIN profiles p")){
          const row=db.sessions.get(a[0]);
          return row&&row.expires_at>NOW()&&row.profile_id===EXISTING?db.profile:null;
        }
        throw new Error("Consulta no simulada: "+sql.slice(0,160));
      },
      async run(){
        const a=this.args;
        if(sql.includes("DELETE FROM auth_oauth_states WHERE expires_at<"))return {success:true};
        if(sql.includes("INSERT INTO auth_oauth_states(")){
          db.oauthStates.set(a[0],{pkce_verifier:a[1],nonce:a[2],expires_at:NOW()+600});
          return {success:true};
        }
        if(sql.includes("INSERT INTO auth_sessions(")){
          db.sessions.set(a[0],{profile_id:a[1],expires_at:NOW()+a[2]});return {success:true};
        }
        throw new Error("Mutación SQL no simulada: "+sql.slice(0,130));
      }
    };
  }
  async batch(){this.newProfiles++;throw new Error("No se deben crear cuentas en este test");}
}

function env(link=true){
  return {DB:new FakeDB(link),PUBLIC_ORIGIN:BASE,GOOGLE_CLIENT_ID:OAUTH_CLIENT,
    GOOGLE_CLIENT_SECRET:"FAKE-NEVER-REAL",ALLOW_NEW_ACCOUNTS:"no"};
}
const request=(path,cookie)=>new Request(BASE+path,{headers:cookie?{Cookie:cookie}:{}});
async function begin(e){
  const res=await authRoute(request("/v1/auth/google/start?return=mirror"),e);
  assert.equal(res.status,302);
  const url=new URL(res.headers.get("location"));
  assert.equal(url.hostname,"accounts.google.com");
  const state=url.searchParams.get("state");
  const saved=e.DB.oauthStates.get(await hash(state));
  assert.ok(saved);
  return {url,state,saved};
}
const defaultClaims=(nonce)=>({iss:"https://accounts.google.com",aud:OAUTH_CLIENT,
  exp:NOW()+600,iat:NOW()-30,nonce,email_verified:true,sub:SUBJECT,name:"Ficticio Google"});

async function callbackWithSimulatedGoogle(e,{transform,signer,tokenError}={}){
  const {url,state,saved}=await begin(e);
  const claims={...defaultClaims(saved.nonce),...(transform||{})};
  const signed=await jwt(claims,signer);
  const originalFetch=globalThis.fetch;
  let tokenCalls=0,jwksCalls=0;
  globalThis.fetch=async(input,opts={})=>{
    const str=String(input);
    if(str==="https://oauth2.googleapis.com/token"){
      tokenCalls++;
      const sent=new URLSearchParams(opts.body);
      assert.equal(sent.get("grant_type"),"authorization_code");
      assert.equal(sent.get("code_verifier"),saved.pkce_verifier);
      assert.equal(sent.get("redirect_uri"),BASE+"/v1/auth/google/callback");
      return tokenError?new Response("",{status:401}):
        new Response(JSON.stringify({id_token:signed}),{status:200});
    }
    if(str==="https://www.googleapis.com/oauth2/v3/certs"){
      jwksCalls++;return new Response(JSON.stringify({keys:[pub]}),{status:200});
    }
    throw Error("Solicitud externa no simulada bloqueada: "+str);
  };
  try{
    const response=await authRoute(request("/v1/auth/google/callback?code=fake-authorization-code&state="+state),e);
    return {response,state,url,saved,tokenCalls,jwksCalls};
  }finally{globalThis.fetch=originalFetch;}
}

test("state OAuth y PKCE S256 no contienen un código reutilizable",async()=>{
  const e=env();
  const {url,state,saved}=await begin(e);
  assert.equal(state.length,43);
  assert.equal(state[0],"M");
  assert.equal(url.searchParams.get("code_challenge_method"),"S256");
  assert.equal(url.searchParams.get("code_challenge"),await hash(saved.pkce_verifier));
  assert.equal(url.searchParams.get("nonce"),saved.nonce);
  assert.equal(url.searchParams.get("scope"),"openid email profile");
});
test("firma Google simulada válida: sesión de cuenta existente, sin duplicados",async()=>{
  const e=env();
  const {response}=await callbackWithSimulatedGoogle(e);
  assert.equal(response.status,303);
  assert.equal(response.headers.get("location"),BASE+"/espejo/#/mi-espacio");
  assert.match(response.headers.get("set-cookie"),/__Host-bf_session=[A-Za-z0-9_-]{43}/);
  assert.match(response.headers.get("set-cookie"),/Secure; HttpOnly; SameSite=Lax/);
  const cookie=response.headers.get("set-cookie").split(";")[0];
  const profile=await authRoute(request("/v1/auth/me",cookie),e);
  const data=await profile.json();
  assert.equal(data.authenticated,true);
  assert.equal(data.profile.id,EXISTING);
  assert.equal(e.DB.newProfiles,0);
  assert.equal(e.DB.sessions.size,1);
});
test("state se consume una sola vez tras callback válido",async()=>{
  const e=env();
  const {response,state}=await callbackWithSimulatedGoogle(e);
  assert.equal(response.status,303);
  const replay=await authRoute(request("/v1/auth/google/callback?code=fake&state="+state),e);
  assert.equal(replay.status,401);
  assert.equal(e.DB.sessions.size,1);
});
test("audiencia incorrecta queda rechazada",async()=>{
  const e=env();
  const {response}=await callbackWithSimulatedGoogle(e,{transform:{aud:"otro-cliente.apps.googleusercontent.com"}});
  assert.equal(response.status,401);assert.equal(e.DB.sessions.size,0);
});
test("nonce incorrecto queda rechazado",async()=>{
  const e=env();
  const {response}=await callbackWithSimulatedGoogle(e,{transform:{nonce:"no-coincide"}});
  assert.equal(response.status,401);assert.equal(e.DB.sessions.size,0);
});
test("firma JWT falsificada queda rechazada",async()=>{
  const e=env();
  const {response}=await callbackWithSimulatedGoogle(e,{signer:rsaAlt.privateKey});
  assert.equal(response.status,401);assert.equal(e.DB.sessions.size,0);
});
test("JWT expirado queda rechazado",async()=>{
  const e=env();
  const {response}=await callbackWithSimulatedGoogle(e,{transform:{exp:NOW()-30}});
  assert.equal(response.status,401);assert.equal(e.DB.sessions.size,0);
});
test("email Google no verificado queda rechazado",async()=>{
  const e=env();
  const {response}=await callbackWithSimulatedGoogle(e,{transform:{email_verified:false}});
  assert.equal(response.status,401);assert.equal(e.DB.sessions.size,0);
});
test("identidad Google nueva no se crea con ALLOW_NEW_ACCOUNTS=no",async()=>{
  const e=env(false);
  const {response}=await callbackWithSimulatedGoogle(e);
  assert.equal(response.status,403);
  assert.equal(e.DB.newProfiles,0);
  assert.equal(e.DB.sessions.size,0);
});
test("rechazo del servidor de Google no establece sesión",async()=>{
  const e=env();
  const {response}=await callbackWithSimulatedGoogle(e,{tokenError:true});
  assert.equal(response.status,401);
  assert.equal(e.DB.sessions.size,0);
});
