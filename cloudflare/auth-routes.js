/* Bellaquitas Fest staging: verified Google OAuth with PKCE, nonce and opaque sessions.
 * Secrets GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET must be stored on Cloudflare,
 * never in the repo. Google authentication fails CLOSED until configured.
 * Sessions are HTTP-only same-origin cookies. No cross-site session token storage.
 */
const COOKIE = "__Host-bf_session";
const SESSION_SECONDS = 30 * 24 * 60 * 60;
const ADMIN_SESSION_SECONDS = 12 * 60 * 60;
const BASE = "https://bellaquitas-api-staging.bellaquitas-fest-410.workers.dev";
const HEADER = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
  "Content-Type": "application/json; charset=utf-8",
};
function api(body,status=200,headers={}) {
  return new Response(JSON.stringify(body),{status,headers:{...HEADER,...headers}});
}
const base = env => (env.PUBLIC_ORIGIN || BASE).replace(/\/+$/,"");
function fail(code="No se pudo autenticar la cuenta",status=401) {
  return api({error:code},status);
}
function enc(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
function decode(value) {
  if(!/^[A-Za-z0-9_-]+$/.test(value))throw new Error("Invalid encoding");
  const str=atob(value.replace(/-/g,"+").replace(/_/g,"/"));
  return Uint8Array.from(str, c=>c.charCodeAt(0));
}
function token() {const b=new Uint8Array(32);crypto.getRandomValues(b);return enc(b);}
async function digest(value) {
  const raw=new TextEncoder().encode(value);
  const bytes=new Uint8Array(await crypto.subtle.digest("SHA-256",raw));
  return enc(bytes);
}
async function verifyGoogleJwt(jwt,env,expectedNonce) {
  if(typeof jwt!=="string"||jwt.length>10000)throw new Error("Invalid ID token");
  const parts=jwt.split(".");
  if(parts.length!==3)throw new Error("Invalid ID token");
  const json=text=>JSON.parse(new TextDecoder().decode(decode(text)));
  const header=json(parts[0]),claims=json(parts[1]);
  if(header.alg!=="RS256"||typeof header.kid!=="string")throw new Error("Unsupported Google ID token");
  const jwksResponse=await fetch("https://www.googleapis.com/oauth2/v3/certs",{
    cf:{cacheTtl:1800,cacheEverything:true},
    headers:{"Accept":"application/json"}
  });
  if(!jwksResponse.ok)throw new Error("Cannot verify Google token");
  const jwks=await jwksResponse.json();
  const jwk=(jwks.keys||[]).find(k=>k.kid===header.kid && k.kty==="RSA" &&
    (!k.use||k.use==="sig") && (!k.alg||k.alg==="RS256"));
  if(!jwk)throw new Error("Unknown Google signing key");
  const key=await crypto.subtle.importKey("jwk",jwk,{
    name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"
  },false,["verify"]);
  const valid=await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,
    decode(parts[2]),new TextEncoder().encode(parts[0]+"."+parts[1]));
  if(!valid)throw new Error("Google signature invalid");
  const now=Math.floor(Date.now()/1000);
  if(!["https://accounts.google.com","accounts.google.com"].includes(claims.iss) ||
     claims.aud!==env.GOOGLE_CLIENT_ID ||
     !Number.isFinite(claims.exp)||claims.exp<=now ||
     !Number.isFinite(claims.iat)||claims.iat>now+60 ||
     claims.nonce!==expectedNonce ||
     claims.email_verified!==true ||
     typeof claims.sub!=="string" || !/^[0-9]{1,64}$/.test(claims.sub)) {
    throw new Error("Google claims not accepted");
  }
  return {sub:claims.sub,name:String(claims.name||"").trim().slice(0,80)};
}
function readCookie(request,name) {
  const cookies=request.headers.get("Cookie")||"";
  for(const part of cookies.split(";")) {
    const [key,...rest]=part.trim().split("=");
    if(key===name)return rest.join("=");
  }
  return "";
}
function clearCookie() {
  return COOKIE+"=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax";
}
function sessionCookie(value,maxAge=SESSION_SECONDS) {
  return COOKIE+"="+value+"; Path=/; Max-Age="+maxAge+"; Secure; HttpOnly; SameSite=Lax";
}
// Solo lo utiliza el Worker tras verificar una credencial de identidad.
export async function createAuthSession(profileId,env) {
  if(typeof profileId!=="string"||!/^[a-f0-9-]{36}$/i.test(profileId))throw Error("Invalid profile identifier");
  const profile=await env.DB.prepare("SELECT role FROM profiles WHERE id=?").bind(profileId).first();
  if(!profile)throw Error("Profile not found");
  const age=profile.role==="admin"?ADMIN_SESSION_SECONDS:SESSION_SECONDS;
  const raw=token(),hash=await digest(raw);
  await env.DB.prepare("INSERT INTO auth_sessions(token_hash,profile_id,expires_at) VALUES (?,?,unixepoch()+?)")
    .bind(hash,profileId,age).run();
  return sessionCookie(raw,age);
}
export async function authenticatedProfile(request,env) {
  const secret=readCookie(request,COOKIE);
  if(!/^[A-Za-z0-9_-]{43}$/.test(secret))return null;
  const hash=await digest(secret);
  return env.DB.prepare(
    "SELECT p.id,p.name,p.role,p.member_code,p.points,p.lifetime_points,p.visits,p.created_at "+
    "FROM auth_sessions s JOIN profiles p ON p.id=s.profile_id "+
    "WHERE s.token_hash=? AND s.expires_at>unixepoch() "+
    "AND (p.role<>\'admin\' OR s.created_at>=datetime(\'now\',\'-12 hours\')) LIMIT 1"
  ).bind(hash).first();
}
function strictOrigin(request,env) {
  const origin=request.headers.get("Origin");
  const site=request.headers.get("Sec-Fetch-Site");
  return origin===base(env) && (!site||site==="same-origin");
}
async function beginGoogle(request,env) {
  if(!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET)return fail(
    "Google OAuth no está configurado en Cloudflare",503);
  if(request.method!=="GET")return fail("Método no permitido",405);
  // Estado de 43 caracteres: ruta de retorno autenticada y ligada al state.
  // Los 42 caracteres aleatorios restantes conservan entropía suficiente.
  const returnDestination=new URL(request.url).searchParams.get("return");
  const state=(returnDestination==="admin"?"A":returnDestination==="mirror"?"M":"P")+token().slice(1),verifier=token(),nonce=token();
  const stateHash=await digest(state);
  const challenge=await digest(verifier);
  // Expired PKCE states contain no user information.
  await env.DB.prepare("DELETE FROM auth_oauth_states WHERE expires_at<unixepoch()").run();
  await env.DB.prepare(
    "INSERT INTO auth_oauth_states(state_hash,pkce_verifier,nonce,expires_at) "+
    "VALUES (?,?,?,unixepoch()+600)"
  ).bind(stateHash,verifier,nonce).run();
  const auth=new URL("https://accounts.google.com/o/oauth2/v2/auth");
  auth.searchParams.set("client_id",env.GOOGLE_CLIENT_ID);
  auth.searchParams.set("redirect_uri",base(env)+"/v1/auth/google/callback");
  auth.searchParams.set("response_type","code");
  auth.searchParams.set("scope","openid email profile");
  auth.searchParams.set("state",state);
  auth.searchParams.set("nonce",nonce);
  auth.searchParams.set("code_challenge",challenge);
  auth.searchParams.set("code_challenge_method","S256");
  auth.searchParams.set("access_type","online");
  return new Response(null,{status:302,headers:{
    Location:auth.toString(),"Cache-Control":"no-store","Referrer-Policy":"no-referrer"
  }});
}
async function callbackGoogle(request,env) {
  const url=new URL(request.url);
  const code=url.searchParams.get("code"),state=url.searchParams.get("state");
  if(url.searchParams.has("error"))return fail("Google no ha autorizado el acceso",401);
  if(!code || code.length>2500 || !state || !/^[A-Za-z0-9_-]{43}$/.test(state)){
    return fail("Respuesta de Google inválida",400);
  }
  if(!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET)return fail("Servicio no configurado",503);
  const stateHash=await digest(state);
  // Single-use state, even on invalid authorization codes.
  const saved=await env.DB.prepare(
    "DELETE FROM auth_oauth_states WHERE state_hash=? AND expires_at>unixepoch() "+
    "RETURNING pkce_verifier,nonce"
  ).bind(stateHash).first();
  if(!saved)return fail("La sesión OAuth ha caducado",401);
  const form=new URLSearchParams({
    client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,
    grant_type:"authorization_code",code,
    code_verifier:saved.pkce_verifier,
    redirect_uri:base(env)+"/v1/auth/google/callback"
  });
  const result=await fetch("https://oauth2.googleapis.com/token",{
    method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body:form.toString()
  });
  if(!result.ok)return fail("No se pudo completar el acceso con Google",401);
  const payload=await result.json();
  let google;
  try{google=await verifyGoogleJwt(payload.id_token,env,saved.nonce);}
  catch(e){console.error("Google verification:",e?.message);return fail("Identidad no verificada",401);}
  let link=await env.DB.prepare(
    "SELECT profile_id FROM auth_identity_links "+
    "WHERE provider='google' AND provider_subject=?"
  ).bind(google.sub).first();
  if(!link) {
    if(env.ALLOW_NEW_ACCOUNTS!=="yes")return fail("Registro temporalmente desactivado",403);
    const id=crypto.randomUUID();
    const name=(google.name.length>=2?google.name:"Nuevo socio").slice(0,80);
    const memberCode="MBR-"+id.replace(/-/g,"").slice(0,10).toUpperCase();
    try{
      await env.DB.batch([
        env.DB.prepare("INSERT INTO profiles(id,name,role,member_code) VALUES (?,?,?,?)")
          .bind(id,name,"socio",memberCode),
        env.DB.prepare("INSERT INTO auth_identity_links(id,provider,provider_subject,profile_id) VALUES (?,?,?,?)")
          .bind(id,"google",google.sub,id)
      ]);
      link={profile_id:id};
    }catch(e){
      // An identity could have been created concurrently; do not create duplicates.
      link=await env.DB.prepare(
        "SELECT profile_id FROM auth_identity_links WHERE provider='google' AND provider_subject=?"
      ).bind(google.sub).first();
      if(!link){console.error("Account creation:",e?.message);return fail("No se pudo crear la cuenta",503);}
    }
  }
  const actor=await env.DB.prepare("SELECT id,role FROM profiles WHERE id=?")
    .bind(link.profile_id).first();
  if(!actor)return fail("No se encontró la ficha del socio",403);
  const session=token(),hash=await digest(session);
  const ttl=actor.role==="admin"?ADMIN_SESSION_SECONDS:SESSION_SECONDS;
  await env.DB.prepare(
    "INSERT INTO auth_sessions(token_hash,profile_id,expires_at) VALUES (?,?,unixepoch()+?)"
  ).bind(hash,actor.id,ttl).run();
  return new Response(null,{status:303,headers:{
    "Location":base(env)+(state.startsWith("A")?"/administracion/":state.startsWith("M")?"/espejo/#/mi-espacio":"/preview"),
    "Set-Cookie":sessionCookie(session,ttl),
    "Cache-Control":"no-store","Referrer-Policy":"no-referrer"
  }});
}
export async function authRoute(request,env) {
  const path=new URL(request.url).pathname;
  if(path==="/v1/auth/google/start")return beginGoogle(request,env);
  if(path==="/v1/auth/google/callback"){
    if(request.method!=="GET")return fail("Método no permitido",405);
    return callbackGoogle(request,env);
  }
  if(path==="/v1/auth/me"){
    if(request.method!=="GET")return fail("Método no permitido",405);
    const profile=await authenticatedProfile(request,env);
    return api({authenticated:!!profile,profile:profile||null});
  }
  if(path==="/v1/auth/logout") {
    if(request.method!=="POST")return fail("Método no permitido",405);
    if(!strictOrigin(request,env))return fail("Origen no autorizado",403);
    const cookie=readCookie(request,COOKIE);
    if(/^[A-Za-z0-9_-]{43}$/.test(cookie)){
      const hash=await digest(cookie);
      await env.DB.prepare("DELETE FROM auth_sessions WHERE token_hash=?").bind(hash).run();
    }
    return api({ok:true},200,{"Set-Cookie":clearCookie()});
  }
  return null;
}
export const checkOrigin=strictOrigin;
