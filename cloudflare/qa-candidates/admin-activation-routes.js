/**
 * Bellaquitas Fest — activar email/contraseña a ADMIN EXISTENTE.
 * Candidato INACTIVO en producción hasta validar presupuesto y backups.
 *
 * Flujo:
 * 1. Administrador existente inicia sesión de nuevo con GOOGLE.
 * 2. En los siguientes cinco minutos pide el vínculo a su correo.
 * 3. Enlace de un solo uso (15min) prueba propiedad del correo.
 * 4. Establece su contraseña; se adjunta al MISMO profile_id.
 *
 * No crear perfiles ni asignar roles por email. Requiere flags explícitos.
 */
import {checkOrigin} from "./auth-routes.js";
const BASE="/administracion/api/activar";
const HEAD={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",
 "X-Robots-Tag":"noindex, nofollow","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"};
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:HEAD});
const nope=(status=403)=>response({error:"No se puede activar el acceso de administrador"},status);
const en=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const sha=async s=>en(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s))));
const fresh=()=>{const b=new Uint8Array(32);crypto.getRandomValues(b);return en(b);};
const validMail=raw=>{
 if(typeof raw!=="string")return null;
 const s=raw.trim().toLowerCase();
 return s.length>=6&&s.length<=254&&/^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,63}$/.test(s)?s:null;
};
function validPassword(s){return typeof s==="string"&&s.length>=12&&s.length<=128&&new TextEncoder().encode(s).length<=256;}
async function hashCompatible(password,salt){
 // Mismo algoritmo y formato que email-auth-routes.js. La CPU en Free sigue bloqueada.
 if(!validPassword(password))throw Error("Invalid password");
 const bytes=Uint8Array.from(atob(salt.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0));
 if(bytes.length!==32)throw Error("Invalid salt");
 let value=new TextEncoder().encode(password);
 for(let i=0;i<6;i++){
  const s=new Uint8Array(33);s.set(bytes);s[32]=i;
  const k=await crypto.subtle.importKey("raw",value,"PBKDF2",false,["deriveBits"]);
  value=new Uint8Array(await crypto.subtle.deriveBits({name:"PBKDF2",salt:s,iterations:100000,hash:"SHA-256"},k,256));
 }
 return "pbkdf2-chain6-sha256-v1$"+en(value);
}
async function jsonInput(request){
 if(!/^application\/json(?:;|$)/i.test(request.headers.get("content-type")||""))throw Error("Content-Type");
 const txt=await request.text();if(txt.length>2048)throw Error("Too big");
 const data=JSON.parse(txt);if(!data||typeof data!=="object"||Array.isArray(data))throw Error("Body");
 return data;
}
function getPublicSession(request){
 const cookie=(request.headers.get("Cookie")||"").split(";").map(x=>x.trim())
  .find(x=>x.startsWith("__Host-bf_session="));
 const t=cookie?.slice("__Host-bf_session=".length);
 return typeof t==="string"&&/^[A-Za-z0-9_-]{43}$/.test(t)?t:null;
}
async function existingAdminWithRecentGoogle(request,env){
 const token=getPublicSession(request);if(!token)return null;
 // Importante: no confiar en la cookie admin ni en un correo proporcionado.
 const actor=await env.DB.prepare(
  "SELECT p.id FROM auth_sessions s "+
  "JOIN profiles p ON p.id=s.profile_id "+
  "JOIN auth_identity_links link ON link.profile_id=p.id AND link.provider='google' "+
  "WHERE s.token_hash=? AND s.expires_at>unixepoch() "+
  "AND s.created_at>=unixepoch()-300 AND p.role='admin' LIMIT 1"
 ).bind(await sha(token)).first();
 return actor?.id||null;
}
async function begin(request,env,data){
 const email=validMail(data.email);if(!email)return response({error:"Introduce un correo válido"},400);
 const id=await existingAdminWithRecentGoogle(request,env);
 if(!id)return response({error:"Primero debes acceder de nuevo con tu cuenta Google administradora"},403);
 const taken=await env.DB.prepare(
  "SELECT 1 AS taken FROM auth_email_credentials WHERE email=? OR profile_id=? LIMIT 1"
 ).bind(email,id).first();
 if(taken)return nope(409);
 const linked=await env.DB.prepare(
  "SELECT 1 AS taken FROM auth_identity_links WHERE provider='email' AND provider_subject=? LIMIT 1"
 ).bind(email).first();
 if(linked)return nope(409);
 // No enviar más de 3 correos por hora; cadencia mínima 3 minutos.
 const quota=await env.DB.prepare(
  "INSERT INTO auth_admin_activation_rate(profile_id,window_start,attempts,last_sent_at) "+
  "VALUES (?,unixepoch(),1,0) "+
  "ON CONFLICT(profile_id) DO UPDATE SET "+
  "attempts=CASE WHEN window_start<=unixepoch()-3600 THEN 1 ELSE attempts+1 END,"+
  "window_start=CASE WHEN window_start<=unixepoch()-3600 THEN unixepoch() ELSE window_start END "+
  "RETURNING attempts,last_sent_at"
 ).bind(id).first();
 if(!quota||quota.attempts>3||quota.last_sent_at>Date.now()/1000-180)
  return response({error:"Demasiados intentos. Prueba más tarde."},429);
 const raw=fresh(),digest=await sha(raw);
 await env.DB.prepare(
  "INSERT INTO auth_admin_activation_tokens(token_hash,profile_id,email,expires_at) "+
  "VALUES (?,?,?,unixepoch()+900) ON CONFLICT(profile_id) DO UPDATE SET "+
  "token_hash=excluded.token_hash,email=excluded.email,expires_at=excluded.expires_at,"+
  "used_at=NULL,created_at=unixepoch()"
 ).bind(digest,id,email).run();
 const target=(env.PUBLIC_ORIGIN||new URL(request.url).origin).replace(/\/+$/,"")+
  "/administracion/?activar="+raw;
 let sent=false;
 try{
  const mail=await fetch("https://api.resend.com/emails",{
   method:"POST",headers:{Authorization:"Bearer "+env.RESEND_API_KEY,"Content-Type":"application/json"},
   body:JSON.stringify({from:env.RESEND_FROM,to:[email],
    subject:"Activar el panel Bellaquitas Fest",
    text:"Has solicitado activar tu acceso de administrador. "+
      "Para establecer tu contraseña abre este enlace antes de 15 minutos:\n"+
      target+"\nSi no lo solicitaste, ignora este mensaje."})
  });
  sent=mail.ok;
 }catch{}
 if(!sent){
  await env.DB.prepare("DELETE FROM auth_admin_activation_tokens WHERE token_hash=?").bind(digest).run();
  return response({error:"No se pudo enviar el correo. Prueba más tarde."},503);
 }
 await env.DB.prepare("UPDATE auth_admin_activation_rate SET last_sent_at=unixepoch() WHERE profile_id=?").bind(id).run();
 return response({ok:true,message:"Si el acceso es válido, recibirás un enlace de activación."});
}
async function complete(env,data){
 const raw=typeof data.token==="string"?data.token:"",pw=data.password;
 if(!/^[A-Za-z0-9_-]{43}$/.test(raw)||!validPassword(pw))
  return response({error:"Enlace o contraseña inválidos"},400);
 const digest=await sha(raw);
 const pending=await env.DB.prepare(
  "SELECT t.profile_id,t.email FROM auth_admin_activation_tokens t "+
  "JOIN profiles p ON p.id=t.profile_id AND p.role='admin' "+
  "JOIN auth_identity_links l ON l.profile_id=p.id AND l.provider='google' "+
  "WHERE t.token_hash=? AND t.used_at IS NULL AND t.expires_at>unixepoch() LIMIT 1"
 ).bind(digest).first();
 if(!pending)return response({error:"Enlace caducado o utilizado"},400);
 // Rechazar la carrera de una vinculación previa antes de gastar CPU.
 const exists=await env.DB.prepare("SELECT 1 AS yes FROM auth_email_credentials WHERE email=? OR profile_id=? LIMIT 1")
  .bind(pending.email,pending.profile_id).first();
 if(exists)return nope(409);
 const salt=fresh(),ph=await hashCompatible(pw,salt);
 // El token se invalida antes de crear una credencial; solo una petición podrá usarlo.
 const claim=await env.DB.prepare(
  "UPDATE auth_admin_activation_tokens SET used_at=unixepoch() "+
  "WHERE token_hash=? AND used_at IS NULL AND expires_at>unixepoch() RETURNING profile_id,email"
 ).bind(digest).first();
 if(!claim||claim.profile_id!==pending.profile_id||claim.email!==pending.email)
  return response({error:"Enlace ya utilizado"},409);
 try{
  await env.DB.batch([
   env.DB.prepare("INSERT INTO auth_email_credentials(email,profile_id,password_hash,password_salt,password_iterations,verified_at) "+
    "SELECT ?,p.id,?,?,600000,unixepoch() FROM profiles p WHERE p.id=? AND p.role='admin' "+
    "AND EXISTS (SELECT 1 FROM auth_identity_links WHERE profile_id=p.id AND provider='google')")
    .bind(pending.email,ph,salt,pending.profile_id),
   env.DB.prepare("INSERT INTO auth_identity_links(id,provider,provider_subject,profile_id) "+
    "SELECT ?,'email',?,? WHERE EXISTS (SELECT 1 FROM auth_email_credentials WHERE email=? AND profile_id=?)")
    .bind(crypto.randomUUID(),pending.email,pending.profile_id,pending.email,pending.profile_id)
  ]);
 }catch{
  return response({error:"No se pudo activar este correo"},409);
 }
 return response({ok:true,message:"Contraseña activada. Ya puedes entrar al panel."});
}
export async function adminActivationRoute(request,env){
 const path=new URL(request.url).pathname;
 if(![BASE+"/solicitar",BASE+"/confirmar"].includes(path))return null;
 if(request.method!=="POST")return response({error:"Método no permitido"},405);
 if(!checkOrigin(request,env))return nope(403);
 // BLOQUEO TRIPLE: no hay forma de habilitarlo por accidente en staging remoto.
 if(env.STAGING_MUTATIONS!=="enabled")return response({error:"Mutaciones desactivadas"},423);
 if(env.ADMIN_EMAIL_ACTIVATION_ENABLED!=="yes"||
    env.ADMIN_PASSWORD_RUNTIME_APPROVED!=="yes"||
    env.EMAIL_AUTH_ENABLED!=="yes"||
    typeof env.RESEND_API_KEY!=="string"||env.RESEND_API_KEY.length<9||
    typeof env.RESEND_FROM!=="string"||!validMail(env.RESEND_FROM))
   return response({error:"Activación no disponible"},503);
 let data;
 try{data=await jsonInput(request);}catch{return response({error:"Solicitud inválida"},400);}
 try{return path.endsWith("/solicitar")?await begin(request,env,data):await complete(env,data);}
 catch(error){
  console.error("Activation error:",String(error?.message||"unknown").slice(0,75));
  return response({error:"No se pudo completar la activación"},503);
 }
}
