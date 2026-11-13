/**
 * Bellaquitas Fest — administración independiente, candidato sin desplegar.
 *
 * /administracion/ abre una aplicación distinta de la web pública.
 * SSO candidato: un admin YA autenticado en la web accede SIN introducir
 * otra vez su correo ni contraseña. Sesión separada __Host-bf_admin (1 hora)
 * ligada a la sesión pública Google/email verificada y al rol admin actual.
 * La cookie pública sola nunca abre el panel, ni la cookie admin sola.
 * Escrituras reutilizan todas las reglas y STAGING_MUTATIONS del Worker real.
 *
 * Esta fuente es propuesta de fase 5, no configuración activa de producción.
 */
import {emailAuthRoute} from "./email-auth-routes.js";
import {authRoute,authenticatedProfile,checkOrigin} from "./auth-routes.js";
import {mirrorDataRoute} from "./mirror-data-routes.js";
import {mirrorWriteRoute} from "./mirror-write-routes.js";
import {protectedRoute} from "./protected-routes.js";
import {ADMIN_HTML,ADMIN_CSS,ADMIN_JS} from "./admin-console-ui.js";
import {adminActivationRoute} from "./admin-activation-routes.js";
import {verifiedSupabaseAdmin,bridgeEnabled,bridgeOriginAllowed} from "./supabase-admin-bridge.js";

const PREFIX="/administracion";
const COOKIE="__Host-bf_admin";
const PUBLIC_COOKIE="__Host-bf_session";
const BRIDGE_PARENT_COOKIE="__Secure-bf_admin_parent";
const bridgeParentCookie=(token,ttl)=>BRIDGE_PARENT_COOKIE+"="+token+
  "; Path=/administracion; Max-Age="+ttl+"; Secure; HttpOnly; SameSite=Strict";
const bridgeParentExpire=()=>BRIDGE_PARENT_COOKIE+
  "=; Path=/administracion; Max-Age=0; Secure; HttpOnly; SameSite=Strict";
const TTL=60*60;
const HEAD={
  "Cache-Control":"private, no-store",
  "X-Content-Type-Options":"nosniff",
  "X-Robots-Tag":"noindex, nofollow",
  "Referrer-Policy":"no-referrer",
  "X-Frame-Options":"DENY",
  "Permissions-Policy":"camera=(), microphone=()"
};
const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{
  status,headers:{...HEAD,"Content-Type":"application/json; charset=utf-8",...headers}
});
const invalid=()=>json({error:"Email, contraseña o permiso de administrador incorrectos"},401);
const cookieExpire=()=>COOKIE+"=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Strict";
const sessionCookie=token=>COOKIE+"="+token+"; Path=/; Max-Age="+TTL+"; Secure; HttpOnly; SameSite=Strict";
const tokenFrom=(request,name)=>{
  const cookies=request.headers.get("Cookie")||"";
  const found=cookies.split(";").map(x=>x.trim()).find(x=>x.startsWith(name+"="));
  const value=found?found.slice(name.length+1):"";
  return /^[A-Za-z0-9_-]{43}$/.test(value)?value:"";
};
const shaToken=async raw=>{
  const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(raw)));
  return btoa(String.fromCharCode(...digest)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
};
const randomToken=()=>{
  const b=new Uint8Array(32);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
};
const profile=actor=>({id:actor.id,name:actor.name,role:"admin"});
function translated(request,path,token){
  const target=new URL(request.url);
  target.pathname=path;
  target.search=path==="/v1/mirror/admin/media/upload"?target.search:"";
  const headers=new Headers(request.headers);
  headers.delete("Cookie");
  // El JWT privado de Supabase SOLO se utiliza para verificar identidad
  // en el puente y no se pasa a handlers D1 heredados ni a sus logs.
  headers.delete("Authorization");
  if(token)headers.set("Cookie",PUBLIC_COOKIE+"="+token);
  return new Request(target.toString(),{method:request.method,headers,
    ...(request.method==="GET"||request.method==="HEAD"?{}:{body:request.body,duplex:"half"})});
}
const authRequest=(request,path,token)=>{
  const url=new URL(request.url);url.pathname=path;url.search="";
  const headers=new Headers(request.headers);
  headers.delete("Cookie");
  // El JWT privado de Supabase SOLO se utiliza para verificar identidad
  // en el puente y no se pasa a handlers D1 heredados ni a sus logs.
  headers.delete("Authorization");
  if(token)headers.set("Cookie",PUBLIC_COOKIE+"="+token);
  return new Request(url.toString(),{headers,method:"GET"});
};
async function endSession(request,env,token){
  if(!token)return;
  const url=new URL(request.url);url.pathname="/v1/auth/logout";url.search="";
  const headers=new Headers(request.headers);
  headers.set("Cookie",PUBLIC_COOKIE+"="+token);
  await authRoute(new Request(url,{method:"POST",headers}),env);
}
async function identify(request,env){
  const token=tokenFrom(request,COOKIE);
  if(!token)return null;
  if(env.ADMIN_SSO_ENABLED==="yes"){
    // Ambas cookies son necesarias. El padre puede ser revocado por logout
    // en la web pública; las sesiones antiguas auth_method='unknown' fallan.
    // El puente Supabase no emite __Host-bf_session a la web pública.
    // Una cookie de padre restringida a /administracion impide usarla
    // directamente en /v1/admin/* fuera del panel.
    const parent=tokenFrom(request,env.ADMIN_SUPABASE_BRIDGE==="yes"?
      BRIDGE_PARENT_COOKIE:PUBLIC_COOKIE);
    if(!parent)return null;
    const [tokenHash,parentHash]=await Promise.all([shaToken(token),shaToken(parent)]);
    const actor=await env.DB.prepare(
      "SELECT p.id,p.name,p.role FROM admin_sso_sessions a "+
      "JOIN auth_sessions s ON s.token_hash=a.parent_token_hash "+
      "JOIN profiles p ON p.id=a.profile_id AND p.id=s.profile_id "+
      "WHERE a.token_hash=? AND a.parent_token_hash=? "+
      "AND a.expires_at>unixepoch() AND s.expires_at>unixepoch() "+
      "AND s.auth_method IN ('google','email') AND p.role='admin' LIMIT 1"
    ).bind(tokenHash,parentHash).first();
    if(!actor)return null;
    // Cookies D1 por sí solas NO autorizan con el puente encendido.
    // El bearer actual y el rol en Supabase se validan para cada llamada.
    if(env.ADMIN_SUPABASE_BRIDGE==="yes"&&
       !(await verifiedSupabaseAdmin(request,env,actor.id)))return null;
    return {token:parent,adminToken:token,actor};
  }
  // Antigua vía email/contraseña: solo se conserva para pruebas aisladas;
  // queda bloqueada cuando se activa la nueva opción SSO.
  const actor=await authenticatedProfile(authRequest(request,"/v1/auth/me",token),env);
  return actor?.role==="admin"?{token,actor}:null;
}
async function ssoSignIn(request,env){
  if(request.method!=="POST")return json({error:"Método no permitido"},405);
  if(env.ADMIN_SSO_ENABLED!=="yes")return json({error:"Acceso SSO todavía no habilitado"},503);
  if(env.ADMIN_SUPABASE_BRIDGE==="yes")
    return json({error:"Usa la sesión oficial de Bellaquitas Fest"},410);
  if(!checkOrigin(request,env))return json({error:"Origen no autorizado"},403);
  const parent=tokenFrom(request,PUBLIC_COOKIE);
  if(!parent)return json({error:"Inicia sesión primero en la web de Bellaquitas Fest"},401);
  const parentHash=await shaToken(parent);
  const actor=await env.DB.prepare(
    "SELECT p.id,p.name,p.role FROM auth_sessions s "+
    "JOIN profiles p ON p.id=s.profile_id "+
    "WHERE s.token_hash=? AND s.expires_at>unixepoch() "+
    "AND s.auth_method IN ('google','email') AND p.role='admin' LIMIT 1"
  ).bind(parentHash).first();
  if(!actor)return json({error:"Solo pueden entrar administradores con sesión verificada"},403);
  if(env.ADMIN_SUPABASE_BRIDGE==="yes"&&
     !(await verifiedSupabaseAdmin(request,env,actor.id)))
    return json({error:"La sesión oficial de Bellaquitas no está verificada"},401);
  const raw=randomToken();
  // Limpiar sesiones expiradas; nunca modificar saldos ni perfiles.
  await env.DB.prepare("DELETE FROM admin_sso_sessions WHERE expires_at<=unixepoch()").run();
  await env.DB.prepare(
    "INSERT INTO admin_sso_sessions(token_hash,parent_token_hash,profile_id,expires_at) "+
    "VALUES (?,?,?,unixepoch()+?)"
  ).bind(await shaToken(raw),parentHash,actor.id,TTL).run();
  return json({ok:true,profile:profile(actor)},200,{"Set-Cookie":sessionCookie(raw)});
}
/**
 * Intercambio real, sin contraseña duplicada: Auth de Supabase valida
 * el token; RLS confirma admin ACTUAL y D1 el MISMO id y rol.
 * No escribe ninguna tabla de socios, puntos, visitas o identidades.
 */
async function supabaseBridgeSignIn(request,env){
  if(request.method!=="POST")return json({error:"Método no permitido"},405);
  if(!bridgeEnabled(env))return json({error:"Puente Supabase desactivado"},503);
  if(!bridgeOriginAllowed(request,env))return json({
    error:"La administración solo funciona en bellaquitas.fr/administracion"
  },403);
  if(!checkOrigin(request,env))return json({error:"Origen no autorizado"},403);
  const verified=await verifiedSupabaseAdmin(request,env);
  if(!verified)return json({error:"Inicia sesión en Bellaquitas Fest como administrador"},401);
  const actor=await env.DB.prepare(
    "SELECT id,name,role FROM profiles WHERE id=? AND role='admin' LIMIT 1"
  ).bind(verified.id).first();
  if(!actor)return json({error:"No existe administrador vinculado en la migración"},403);
  const now=Math.floor(Date.now()/1000);
  const ttl=Math.min(TTL,verified.expiresAt-now);
  if(ttl<16)return json({error:"Actualiza la sesión en Bellaquitas Fest"},401);
  const parent=randomToken(),admin=randomToken();
  const parentHash=await shaToken(parent),adminHash=await shaToken(admin);
  // La transacción evita una sesión admin huérfana si falla un FK.
  await env.DB.batch([
    env.DB.prepare("INSERT INTO auth_sessions(token_hash,profile_id,expires_at,auth_method) VALUES (?,?,unixepoch()+?,?)")
      .bind(parentHash,verified.id,ttl,verified.method),
    env.DB.prepare("INSERT INTO admin_sso_sessions(token_hash,parent_token_hash,profile_id,expires_at) VALUES (?,?,?,unixepoch()+?)")
      .bind(adminHash,parentHash,verified.id,ttl)
  ]);
  const headers=new Headers(HEAD);
  headers.set("Content-Type","application/json; charset=utf-8");
  // CRÍTICO: no emitir el token D1 de administrador como cookie pública
  // de Path=/. Un cierre de sesión en Supabase debe quitar acceso a
  // /v1/admin/* aunque todavía existan cookies limitadas al panel.
  headers.append("Set-Cookie",bridgeParentCookie(parent,ttl));
  headers.append("Set-Cookie",COOKIE+"="+admin+
    "; Path=/; Max-Age="+ttl+"; Secure; HttpOnly; SameSite=Strict");
  return new Response(JSON.stringify({ok:true,profile:profile(actor)}),{
    status:200,headers
  });
}
function secureStatic(text,type){
  const csp="default-src 'none'; script-src 'self' https://esm.sh; style-src 'self'; "+
    "img-src 'self' data: https:; connect-src 'self' https://esm.sh https://vlsipvngvxcgnwrhpjgg.supabase.co; font-src 'self'; "+
    "base-uri 'none'; form-action 'self'; frame-ancestors 'none'";
  return new Response(text,{headers:{
    ...HEAD,"Content-Type":type,"Content-Security-Policy":csp
  }});
}
async function signIn(request,env){
  if(request.method!=="POST")return json({error:"Método no permitido"},405);
  if(env.ADMIN_SSO_ENABLED==="yes")return json({error:"Este panel utiliza la sesión de la web; no admite otra contraseña"},410);
  // No consumir CPU del plan Free hasta verificar el algoritmo en Workers real.
  if(env.ADMIN_PASSWORD_RUNTIME_APPROVED!=="yes")return json({error:"Contraseña administrativa pendiente de validación de seguridad"},503);
  if(!checkOrigin(request,env))return json({error:"Origen no autorizado"},403);
  const res=await emailAuthRoute(translated(request,"/v1/auth/email/login"),env);
  if(!res||!res.ok)return invalid();
  const match=(res.headers.get("Set-Cookie")||"").match(/__Host-bf_session=([A-Za-z0-9_-]{43})/);
  if(!match)return invalid();
  const token=match[1];
  const actor=await authenticatedProfile(authRequest(request,"/v1/auth/me",token),env);
  if(actor?.role!=="admin"){
    await endSession(request,env,token);
    return invalid();
  }
  // Reduce la caducidad en la base, no solo en la cookie del navegador.
  const hash=await shaToken(token);
  await env.DB.prepare("UPDATE auth_sessions SET expires_at=unixepoch()+? WHERE token_hash=?")
    .bind(TTL,hash).run();
  return json({ok:true,profile:{id:actor.id,name:actor.name,role:"admin"}},200,{"Set-Cookie":sessionCookie(token)});
}
const READS={
  "/events":"/v1/mirror/admin/catalog/events",
  "/rewards":"/v1/mirror/admin/catalog/rewards",
  "/promos":"/v1/mirror/admin/catalog/promos",
  "/site-drafts":"/v1/mirror/admin/site-drafts",
  "/community":"/v1/mirror/admin/community",
  "/members":"/v1/admin/members",
  "/activity":"/v1/mirror/admin/activity",
  "/changes":"/v1/mirror/admin/changes"
};
const WRITES={
  "/write":"/v1/mirror/admin/write",
  "/member":"/v1/admin/member",
  "/moments/create":"/v1/admin/moments/create",
  "/moments/publish":"/v1/admin/moments/publish"
};
function wrap(res){
  if(!res)return json({error:"Ruta administrativa no disponible"},404);
  const headers=new Headers(HEAD);
  headers.set("Content-Type",res.headers.get("Content-Type")||"application/json; charset=utf-8");
  return new Response(res.body,{status:res.status,headers});
}
export async function adminConsoleRoute(request,env){
  const url=new URL(request.url),path=url.pathname;
  if(path===PREFIX&&request.method==="GET"){
    return new Response(null,{status:308,headers:{Location:PREFIX+"/",...HEAD}});
  }
  if(path===PREFIX+"/"&&request.method==="GET"){
    return secureStatic(ADMIN_HTML,"text/html; charset=utf-8");
  }
  if(path===PREFIX+"/styles.css"&&request.method==="GET"){
    return secureStatic(ADMIN_CSS,"text/css; charset=utf-8");
  }
  if(path===PREFIX+"/app.js"&&request.method==="GET"){
    return secureStatic(ADMIN_JS,"text/javascript; charset=utf-8");
  }
  if(!path.startsWith(PREFIX+"/api/"))return null;
  // Sin formulario de contraseña ni enlaces de activación en el modo SSO.
  if(env.ADMIN_SSO_ENABLED==="yes"&&path.startsWith(PREFIX+"/api/activar/"))
    return json({error:"Activación de contraseña no disponible en el panel"},404);
  const activation=env.ADMIN_SSO_ENABLED==="yes"?null:await adminActivationRoute(request,env);
  if(activation)return activation;
  if(path===PREFIX+"/api/supabase-bridge")return supabaseBridgeSignIn(request,env);
  if(path===PREFIX+"/api/sso")return ssoSignIn(request,env);
  if(path===PREFIX+"/api/login")return signIn(request,env);
  const authenticated=await identify(request,env);
  if(path===PREFIX+"/api/me"&&request.method==="GET"){
    return authenticated?
      json({authenticated:true,profile:{id:authenticated.actor.id,name:authenticated.actor.name,role:"admin"}}):
      json({authenticated:false},401);
  }
  if(path===PREFIX+"/api/logout"){
    if(request.method!=="POST")return json({error:"Método no permitido"},405);
    if(!checkOrigin(request,env))return json({error:"Origen no autorizado"},403);
    if(env.ADMIN_SUPABASE_BRIDGE==="yes"){
      // Logout funciona incluso si el navegador ya eliminó el bearer de
      // Supabase (se cierra sesión primero en la web principal).
      // El par de cookies solo puede revocar SU PROPIA sesión D1.
      const admin=tokenFrom(request,COOKIE);
      const parent=tokenFrom(request,BRIDGE_PARENT_COOKIE);
      if(admin&&parent){
        const adminHash=await shaToken(admin),parentHash=await shaToken(parent);
        await env.DB.prepare(
          "DELETE FROM auth_sessions WHERE token_hash=? "+
          "AND EXISTS (SELECT 1 FROM admin_sso_sessions "+
          "WHERE token_hash=? AND parent_token_hash=?)"
        ).bind(parentHash,adminHash,parentHash).run();
      }
    }else if(authenticated){
      if(env.ADMIN_SSO_ENABLED==="yes"){
        await env.DB.prepare("DELETE FROM admin_sso_sessions WHERE token_hash=?")
          .bind(await shaToken(authenticated.adminToken)).run();
      }else{
        await endSession(request,env,authenticated.token);
      }
    }
    // Al salir del panel el usuario SIGUE conectado a Supabase.
    const headers=new Headers(HEAD);
    headers.set("Content-Type","application/json; charset=utf-8");
    headers.append("Set-Cookie",cookieExpire());
    if(env.ADMIN_SUPABASE_BRIDGE==="yes")
      headers.append("Set-Cookie",bridgeParentExpire());
    return new Response(JSON.stringify({ok:true}),{status:200,headers});
  }
  if(!authenticated)return json({error:"Inicia sesión de administrador"},401);
  const suffix=path.slice((PREFIX+"/api").length);
  if(request.method==="GET"&&suffix==="/site"){
    const row=await env.DB.prepare(
      "SELECT hero_text,announcement,page_settings,updated_at FROM site_content WHERE key='homepage'"
    ).first();
    let settings={};
    if(row){try{settings=JSON.parse(row.page_settings||"{}");}catch{}}
    return json({site:row?{...row,settings}:null});
  }
  if(request.method==="GET"&&READS[suffix]){
    const req=authRequest(request,READS[suffix],authenticated.token);
    return wrap(READS[suffix].startsWith("/v1/admin/")?
      await protectedRoute(req,env):await mirrorDataRoute(req,env));
  }
  const photoRead=suffix.match(/^\/photos\/([0-9a-f-]{36})$/i);
  if(request.method==="GET"&&photoRead){
    const req=authRequest(request,"/v1/mirror/admin/media/"+photoRead[1],authenticated.token);
    return wrap(await mirrorDataRoute(req,env));
  }
  if(request.method==="POST"&&WRITES[suffix]){
    if(!checkOrigin(request,env))return json({error:"Origen no autorizado"},403);
    const req=translated(request,WRITES[suffix],authenticated.token);
    return wrap(suffix==="/write"?await mirrorWriteRoute(req,env):await protectedRoute(req,env));
  }
  if(request.method==="PUT"&&suffix==="/upload"){
    if(!checkOrigin(request,env))return json({error:"Origen no autorizado"},403);
    const req=translated(request,"/v1/mirror/admin/media/upload",authenticated.token);
    return wrap(await mirrorWriteRoute(req,env));
  }
  const photo=suffix.match(/^\/moments\/([0-9a-f-]{36})\/photo$/i);
  if(request.method==="POST"&&photo){
    if(!checkOrigin(request,env))return json({error:"Origen no autorizado"},403);
    const req=translated(request,"/v1/admin/moments/"+photo[1]+"/photo",authenticated.token);
    return wrap(await protectedRoute(req,env));
  }
  return json({error:"Ruta no encontrada"},404);
}
