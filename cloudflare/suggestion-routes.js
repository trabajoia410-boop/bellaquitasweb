/* Bellaquitas Fest — buzón público de sugerencias para el espejo Cloudflare.
 * Activo ÚNICAMENTE si SUGGESTIONS_ENABLED=yes; independiente de
 * STAGING_MUTATIONS para no abrir puntos, visitas, permisos o panel.
 * Antiabuso: Turnstile validado en servidor, HMAC IP / límites D1.
 */
import {checkOrigin} from "./auth-routes.js";
const HEAD={"Cache-Control":"no-store","Content-Type":"application/json; charset=utf-8",
 "X-Content-Type-Options":"nosniff","X-Robots-Tag":"noindex,nofollow",
 "Referrer-Policy":"no-referrer"};
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:HEAD});
const enabled=env=>env.SUGGESTIONS_ENABLED==="yes"&&env.DB&&
 typeof env.EMAIL_RATE_KEY==="string"&&env.EMAIL_RATE_KEY.length>=32&&
 typeof env.TURNSTILE_SECRET==="string"&&env.TURNSTILE_SECRET.length>8&&
 typeof env.TURNSTILE_SITE_KEY==="string"&&env.TURNSTILE_SITE_KEY.length>8;
async function readBody(request){
 if(!/^application\/json(?:;|$)/i.test(request.headers.get("Content-Type")||""))
  throw Error("Se requiere JSON");
 const n=Number(request.headers.get("Content-Length")||0);
 if(n>4400)throw Error("Mensaje demasiado grande");
 const raw=await request.text();
 if(raw.length>4400)throw Error("Mensaje demasiado grande");
 const data=JSON.parse(raw);
 if(!data||typeof data!=="object"||Array.isArray(data))throw Error("Mensaje inválido");
 return data;
}
async function hmacKey(env,request){
 const ip=request.headers.get("CF-Connecting-IP")||"unknown";
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(env.EMAIL_RATE_KEY),
  {name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const signed=new Uint8Array(await crypto.subtle.sign("HMAC",key,
  new TextEncoder().encode("suggestions:v1:ip:"+ip)));
 return btoa(String.fromCharCode(...signed)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
async function verifyTurnstile(env,request,token){
 if(typeof token!=="string"||token.length<10||token.length>2048)return false;
 const params=new URLSearchParams({secret:env.TURNSTILE_SECRET,response:token});
 const ip=request.headers.get("CF-Connecting-IP");if(ip)params.set("remoteip",ip);
 try{
  const r=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",
   {method:"POST",body:params});
  if(!r.ok)return false;
  const json=await r.json();
  const host=env.TURNSTILE_EXPECTED_HOSTNAME||new URL(env.PUBLIC_ORIGIN).hostname;
  return json.success===true&&json.hostname===host;
 }catch{return false;}
}
async function quota(env,key){
 const result=await env.DB.prepare(
  "INSERT INTO auth_email_rate_limits(key_hash,attempts,expires_at) "+
  "VALUES (?,1,unixepoch()+3600) "+
  "ON CONFLICT(key_hash) DO UPDATE SET "+
  "attempts=CASE WHEN expires_at<=unixepoch() THEN 1 ELSE attempts+1 END, "+
  "expires_at=CASE WHEN expires_at<=unixepoch() THEN unixepoch()+3600 ELSE expires_at END "+
  "RETURNING attempts,MAX(1,expires_at-unixepoch()) AS retry_seconds"
 ).bind(key).first();
 return {allowed:!!result&&Number(result.attempts)<=5,retry:Number(result?.retry_seconds)||3600};
}
export async function suggestionRoute(request,env){
 const path=new URL(request.url).pathname;
 if(path!=="/v1/mirror/public/suggestions/status"&&
    path!=="/v1/mirror/public/suggestions")return null;
 if(path.endsWith("/status")){
  if(request.method!=="GET")return reply({error:"Método no permitido"},405);
  return reply({enabled:!!enabled(env),turnstileSiteKey:enabled(env)?env.TURNSTILE_SITE_KEY:null});
 }
 if(request.method!=="POST")return reply({error:"Método no permitido"},405);
 if(!checkOrigin(request,env))return reply({error:"Origen no autorizado"},403);
 if(!enabled(env))return reply({error:"El buzón todavía no está activado en esta copia"},423);
 let body;
 try{body=await readBody(request);}
 catch{return reply({error:"Datos del mensaje inválidos"},400);}
 const name=typeof body.name==="string"?body.name.trim():"";
 const message=typeof body.message==="string"?body.message.trim():"";
 if(name.length>80||message.length<5||message.length>2000)
  return reply({error:"Escribe un mensaje de entre 5 y 2000 caracteres"},400);
 // Campo oculto contra bots de formulario, nunca se persiste ni se muestra.
 if(body.website)return reply({ok:true});
 const key=await hmacKey(env,request);
 const blocked=await env.DB.prepare(
  "SELECT attempts,MAX(0,expires_at-unixepoch()) AS retry FROM auth_email_rate_limits "+
  "WHERE key_hash=?"
 ).bind(key).first();
 if(blocked&&Number(blocked.attempts)>=5&&Number(blocked.retry)>0)
  return reply({error:"Demasiados mensajes. Inténtalo más tarde.",retry_seconds:blocked.retry},429);
 if(!await verifyTurnstile(env,request,body.turnstileToken))
  return reply({error:"Completa la comprobación de seguridad para enviar la sugerencia"},403);
 const rate=await quota(env,key);
 if(!rate.allowed)return reply({error:"Demasiados mensajes. Inténtalo más tarde.",retry_seconds:rate.retry},429);
 try{
  await env.DB.prepare(
   "INSERT INTO community_suggestions(id,name,message,status) VALUES (?,?,?,'nuevo')"
  ).bind(crypto.randomUUID(),name,message).run();
  return reply({ok:true,message:"Sugerencia enviada. Gracias."},201);
 }catch(error){
  console.error("Suggestion submit:",String(error?.message||"error").slice(0,105));
  return reply({error:"No se pudo guardar tu sugerencia"},503);
 }
}
