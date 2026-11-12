/**
 * Bellaquitas Fest — administración independiente, candidato sin desplegar.
 *
 * /administracion/ abre una aplicación distinta de la web pública.
 * Login SOLO correo + contraseña verificados y rol admin; se intercambia una
 * sesión normal por una cookie SEPARADA __Host-bf_admin (1 hora).
 * Nunca acepta la cookie de socio ni el login público como autorización.
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

const PREFIX="/administracion";
const COOKIE="__Host-bf_admin";
const PUBLIC_COOKIE="__Host-bf_session";
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
function translated(request,path,token){
  const target=new URL(request.url);
  target.pathname=path;
  target.search=path==="/v1/mirror/admin/media/upload"?target.search:"";
  const headers=new Headers(request.headers);
  headers.delete("Cookie");
  if(token)headers.set("Cookie",PUBLIC_COOKIE+"="+token);
  return new Request(target.toString(),{method:request.method,headers,
    ...(request.method==="GET"||request.method==="HEAD"?{}:{body:request.body,duplex:"half"})});
}
const authRequest=(request,path,token)=>{
  const url=new URL(request.url);url.pathname=path;url.search="";
  const headers=new Headers(request.headers);
  headers.delete("Cookie");
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
  const actor=await authenticatedProfile(authRequest(request,"/v1/auth/me",token),env);
  return actor?.role==="admin"?{token,actor}:null;
}
function secureStatic(text,type){
  const csp="default-src 'none'; script-src 'self'; style-src 'self'; "+
    "img-src 'self' data: https:; connect-src 'self'; font-src 'self'; "+
    "base-uri 'none'; form-action 'self'; frame-ancestors 'none'";
  return new Response(text,{headers:{
    ...HEAD,"Content-Type":type,"Content-Security-Policy":csp
  }});
}
async function signIn(request,env){
  if(request.method!=="POST")return json({error:"Método no permitido"},405);
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
  const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token)));
  const hash=btoa(String.fromCharCode(...digest)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
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
  const activation=await adminActivationRoute(request,env);
  if(activation)return activation;
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
    if(authenticated)await endSession(request,env,authenticated.token);
    return json({ok:true},200,{"Set-Cookie":cookieExpire()});
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
