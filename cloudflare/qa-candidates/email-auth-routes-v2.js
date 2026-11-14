/* Bellaquitas staging: correo/contraseña opcional. FAIL-CLOSED por defecto.
 * No se activa sin correo verificado, Turnstile, límites y secretos.
 * Las cuentas importadas de Google no reciben contraseñas ni se vinculan por email.
 */
import {checkOrigin,createAuthSession} from "./auth-routes.js";
const HEAD={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff","X-Robots-Tag":"noindex, nofollow","Referrer-Policy":"no-referrer"};
const json=(body,status=200,extra={})=>new Response(JSON.stringify(body),{status,headers:{...HEAD,...extra}});
const unavailable=()=>json({error:"El acceso por correo no está activado todavía"},503);
const bad=(message="Solicitud no válida",status=400)=>json({error:message},status);
const ITERATIONS=600000;
const emailLoginReady=env=>env.EMAIL_AUTH_ENABLED==="yes"&&typeof env.EMAIL_RATE_KEY==="string"&&env.EMAIL_RATE_KEY.length>=32;
// La alta por email se controla independientemente de las altas nuevas de Google.
const emailDeliveryReady=env=>emailLoginReady(env)&&
  typeof env.RESEND_API_KEY==="string"&&env.RESEND_API_KEY.length>8&&
  typeof env.RESEND_FROM==="string"&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.RESEND_FROM)&&
  typeof env.TURNSTILE_SECRET==="string"&&env.TURNSTILE_SECRET.length>8&&
  typeof env.TURNSTILE_SITE_KEY==="string"&&env.TURNSTILE_SITE_KEY.length>8;
const emailRegistrationReady=env=>emailDeliveryReady(env)&&env.EMAIL_REGISTRATION_ENABLED==="yes";
const encode=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
function decode(value){if(typeof value!=="string"||!/^[A-Za-z0-9_-]{18,120}$/.test(value))throw Error("Malformed encoding");return Uint8Array.from(atob(value.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0));}
const random=()=>{const b=new Uint8Array(32);crypto.getRandomValues(b);return encode(b);};
async function sha256(str){return encode(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(str))));}
function email(value){if(typeof value!=="string")return null;const e=value.trim().toLowerCase();return e.length>=6&&e.length<=254&&/^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,63}$/.test(e)?e:null;}
function validPassword(password){return typeof password==="string"&&password.length>=12&&password.length<=128&&new TextEncoder().encode(password).length<=256;}
async function parseJson(request){
 if(!/^application\/json(?:;|$)/i.test(request.headers.get("content-type")||""))throw Error("Content-Type");
 const size=Number(request.headers.get("content-length")||0);if(size>2048)throw Error("Large");
 const raw=await request.text();if(raw.length>2048)throw Error("Large");
 const data=JSON.parse(raw);if(!data||typeof data!=="object"||Array.isArray(data))throw Error("JSON");return data;
}
// v1: six sequential PBKDF2-HMAC-SHA256 phases of 100,000 iterations.
// Cloudflare Workers WebCrypto rejects individual PBKDF2 calls above 100,000.
// The stored scheme prefix prevents treating a chained digest as standard PBKDF2.
// This stays staging-only pending independent security review.
const HASH_SCHEME="pbkdf2-chain6-sha256-v1$";
// Constante de ensayo de 32 bytes; solo iguala trabajo computacional para correos inexistentes.
// NO se guarda, ni es una contraseña, ni modifica hashes de socios existentes.
const DUMMY_SALT="AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
async function passwordHash(password,salt,iterations=ITERATIONS){
 if(!validPassword(password)||iterations!==600000)throw Error("Invalid password parameters");
 const baseSalt=decode(salt);
 if(baseSalt.length!==32)throw Error("Invalid salt");
 let material=new TextEncoder().encode(password);
 for(let phase=0;phase<6;phase++){
   const phaseSalt=new Uint8Array(baseSalt.length+1);
   phaseSalt.set(baseSalt);
   phaseSalt[baseSalt.length]=phase;
   const key=await crypto.subtle.importKey("raw",material,"PBKDF2",false,["deriveBits"]);
   material=new Uint8Array(await crypto.subtle.deriveBits(
     {name:"PBKDF2",salt:phaseSalt,iterations:100000,hash:"SHA-256"},key,256));
 }
 return HASH_SCHEME+encode(material);
}
function constantMatch(first,second){
 if(typeof first!=="string"||typeof second!=="string"||
   !first.startsWith(HASH_SCHEME)||!second.startsWith(HASH_SCHEME))return false;
 const a=decode(first.slice(HASH_SCHEME.length));
 const b=decode(second.slice(HASH_SCHEME.length));
 let diff=a.length^b.length;
 for(let i=0;i<Math.max(a.length,b.length);i++)diff|=(a[i]||0)^(b[i]||0);
 return diff===0;
}
async function limit(env,request,scope,identifier,byEmail=false){
 const ip=request.headers.get("CF-Connecting-IP")||"unknown";
 const keyText=byEmail?"email:"+identifier:"ip:"+ip;
 const hmac=await crypto.subtle.importKey("raw",new TextEncoder().encode(env.EMAIL_RATE_KEY),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const key=encode(new Uint8Array(await crypto.subtle.sign("HMAC",hmac,new TextEncoder().encode(scope+":"+keyText))));
 const duration=scope==="login"?900:3600;
 const maximum=scope==="login"?(byEmail?8:25):
   scope==="captcha-failed"?20:(byEmail?5:20);
 const row=await env.DB.prepare(
  "INSERT INTO auth_email_rate_limits(key_hash,attempts,expires_at) VALUES (?,1,unixepoch()+?) "+
  "ON CONFLICT(key_hash) DO UPDATE SET "+
  "attempts=CASE WHEN expires_at<=unixepoch() THEN 1 ELSE attempts+1 END,"+
  "expires_at=CASE WHEN expires_at<=unixepoch() THEN unixepoch()+? ELSE expires_at END "+
  "RETURNING attempts,MAX(0,expires_at-unixepoch()) AS retry_seconds"
 ).bind(key,duration,duration).first();
 return {allowed:!!row&&row.attempts<=maximum,
   retrySeconds:Math.max(1,Number(row?.retry_seconds)||duration)};
}
async function checkRate(env,request,scope,address){
 const ip=await limit(env,request,scope,"",false);
 if(!ip.allowed)return ip;
 return await limit(env,request,scope,address,true);
}
const rateRejected=result=>json({
  error:"Demasiados intentos. Vuelve a intentarlo dentro de "+Math.ceil(result.retrySeconds/60)+" minutos.",
  retry_after_seconds:result.retrySeconds
},429,{"Retry-After":String(result.retrySeconds)});
async function checkCaptchaAndRate(request,env,data,scope,address){
 const ip=request.headers.get("CF-Connecting-IP")||"unknown";
 // Bloquear abusos de la verificación sin gastar intentos de registro de socios.
 const hmac=await crypto.subtle.importKey("raw",new TextEncoder().encode(env.EMAIL_RATE_KEY),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const key=encode(new Uint8Array(await crypto.subtle.sign("HMAC",hmac,new TextEncoder().encode("captcha-failed:ip:"+ip))));
 const penalty=await env.DB.prepare(
  "SELECT attempts,MAX(0,expires_at-unixepoch()) AS retry_seconds FROM auth_email_rate_limits WHERE key_hash=?"
 ).bind(key).first();
 if(penalty&&Number(penalty.attempts)>=20&&Number(penalty.retry_seconds)>0)
   return rateRejected({retrySeconds:Number(penalty.retry_seconds)});
 if(!await turnstile(env,request,data.turnstileToken)){
   await limit(env,request,"captcha-failed","",false);
   return bad("No se pudo validar Turnstile. Actualiza la página y vuelve a completar la verificación.",403);
 }
 const quota=await checkRate(env,request,scope,address);
 return quota.allowed?null:rateRejected(quota);
}
async function turnstile(env,request,token){
 if(typeof token!=="string"||token.length<10||token.length>2048)return false;
 const params=new URLSearchParams({secret:env.TURNSTILE_SECRET,response:token});
 const ip=request.headers.get("CF-Connecting-IP");if(ip)params.set("remoteip",ip);
 const r=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",body:params});
 if(!r.ok)return false;const result=await r.json();
 const expected=(env.TURNSTILE_EXPECTED_HOSTNAME||new URL(env.PUBLIC_ORIGIN).hostname);
 return result.success===true&&result.hostname===expected;
}
async function sendMail(env,to,subject,message){
 const response=await fetch("https://api.resend.com/emails",{
   method:"POST",headers:{Authorization:"Bearer "+env.RESEND_API_KEY,"Content-Type":"application/json"},
   body:JSON.stringify({from:env.RESEND_FROM,to:[to],subject,text:message})
 });
 if(!response.ok)console.error("Resend rejected mail with HTTP",response.status);
 return response.ok;
}
const publicResponse={ok:true,message:"Si es posible continuar, recibirás instrucciones por correo."};
async function registration(request,env,data,ctx){
 if(!emailRegistrationReady(env))return unavailable();
 const address=email(data.email),name=typeof data.name==="string"?data.name.trim():"";
 if(!address||name.length<2||name.length>80||!validPassword(data.password))return bad("Comprueba los datos y usa una contraseña de al menos 12 caracteres");
 const rejected=await checkCaptchaAndRate(request,env,data,"register",address);
 if(rejected)return rejected;
 const existing=await env.DB.prepare("SELECT profile_id FROM auth_email_credentials WHERE email=?").bind(address).first();
 // Igualamos el cálculo pesado antes de decidir si la cuenta existe.
 // D1 y la entrega diferida todavía pueden introducir pequeñas diferencias.
 const salt=random(),hash=await passwordHash(data.password,salt);
 if(existing)return json(publicResponse);
 const rawToken=random(),tokenHash=await sha256(rawToken);
 await env.DB.batch([
   env.DB.prepare("DELETE FROM auth_email_tokens WHERE email=? AND purpose='register'").bind(address),
   env.DB.prepare("INSERT INTO auth_email_tokens(token_hash,email,purpose,profile_name,password_hash,password_salt,password_iterations,expires_at) VALUES (? ,?,'register',?,?,?,?,unixepoch()+1800)")
     .bind(tokenHash,address,name,hash,salt,ITERATIONS)
 ]);
 const origin=(env.PUBLIC_ORIGIN||new URL(request.url).origin).replace(/\/+$/,"");
 const target=data.return_to==="espejo"?origin+"/espejo/?verify="+rawToken+"#/acceso":origin+"/preview#verify="+rawToken;
 const subject="Confirma tu cuenta Bellaquitas Fest";
 const message="Para confirmar tu correo, abre este enlace antes de 30 minutos:\n"+
   target+"\nSi no has solicitado una cuenta, ignora este mensaje.";
 // Context.waitUntil permite responder sin depender del tiempo de Resend.
 // Se limita a pruebas hasta garantizar la entrega mediante una cola fiable.
 if(ctx&&typeof ctx.waitUntil==="function"){
   const delivery=(async()=>{
     let sent=false;
     try{sent=await sendMail(env,address,subject,message);}catch(_){}
     if(!sent){
       try{await env.DB.prepare("DELETE FROM auth_email_tokens WHERE token_hash=?").bind(tokenHash).run();}
       catch(_){console.error("No se pudo limpiar token de registro fallido");}
       console.error("Email provider failed to send verification");
     }
   })();
   ctx.waitUntil(delivery);
   return json(publicResponse);
 }
 // Compatibilidad para invocaciones sin ctx; el Worker real debe reenviar ctx.
 const sent=await sendMail(env,address,subject,message);
 if(!sent){
   await env.DB.prepare("DELETE FROM auth_email_tokens WHERE token_hash=?").bind(tokenHash).run();
   console.error("Email provider failed to send verification");
   return bad("No se ha podido enviar el correo. Inténtalo de nuevo más tarde.",503);
 }
 return json(publicResponse);
}
async function verify(request,env,data){
 if(!emailDeliveryReady(env))return unavailable();
 const token=data.token;
 if(typeof token!=="string"||!/^[A-Za-z0-9_-]{43}$/.test(token))return bad("Enlace inválido",400);
 const tokenHash=await sha256(token);
 const pending=await env.DB.prepare(
 "DELETE FROM auth_email_tokens WHERE token_hash=? AND purpose='register' AND expires_at>unixepoch() "+
 "RETURNING email,profile_name,password_hash,password_salt,password_iterations").bind(tokenHash).first();
 if(!pending)return bad("Enlace caducado o utilizado",400);
 const id=crypto.randomUUID(),memberCode="MBR-"+id.replace(/-/g,"").slice(0,10).toUpperCase();
 try{
  await env.DB.batch([
    env.DB.prepare("INSERT INTO profiles(id,name,role,member_code,points,lifetime_points,visits) VALUES (?,?,'socio',?,0,0,0)").bind(id,pending.profile_name,memberCode),
    env.DB.prepare("INSERT INTO auth_email_credentials(email,profile_id,password_hash,password_salt,password_iterations,verified_at) VALUES (?,?,?,?,?,unixepoch())").bind(pending.email,id,pending.password_hash,pending.password_salt,pending.password_iterations),
    env.DB.prepare("INSERT INTO auth_identity_links(id,provider,provider_subject,profile_id) VALUES (?,'email',?,?)").bind(crypto.randomUUID(),pending.email,id)
  ]);
  return json({ok:true,message:"Correo confirmado. Ya puedes iniciar sesión."});
 }catch(_){return bad("No se ha podido activar la cuenta",409);}
}
async function login(request,env,data){
 if(!emailLoginReady(env))return unavailable();
 const address=email(data.email);
 if(!address||!validPassword(data.password))return bad("Correo o contraseña incorrectos",401);
 const quota=await checkRate(env,request,"login",address);
 if(!quota.allowed)return rateRejected(quota);
 const record=await env.DB.prepare("SELECT email,profile_id,password_hash,password_salt,password_iterations FROM auth_email_credentials WHERE email=? AND verified_at>0").bind(address).first();
 // Mantener el mismo trabajo PBKDF2 al rechazar una cuenta inexistente.
 // Evita la salida rápida que permite enumeración de correos por tiempos de respuesta.
 let valid=false;
 try{
   const computed=await passwordHash(data.password,record?.password_salt||DUMMY_SALT,
     record?.password_iterations||ITERATIONS);
   valid=!!record&&constantMatch(computed,record.password_hash);
 }catch(_){}
 if(!valid)return bad("Correo o contraseña incorrectos",401);
 const cookie=await createAuthSession(record.profile_id,env);
 return json({authenticated:true},200,{"Set-Cookie":cookie});
}
async function forgot(request,env,data){
 if(!emailDeliveryReady(env))return unavailable();
 const address=email(data.email);if(!address)return bad("Introduce un correo válido");
 const rejected=await checkCaptchaAndRate(request,env,data,"forgot",address);
 if(rejected)return rejected;
 const existing=await env.DB.prepare("SELECT profile_id FROM auth_email_credentials WHERE email=?").bind(address).first();
 if(existing){
   const rawToken=random(),tokenHash=await sha256(rawToken);
   await env.DB.batch([
    env.DB.prepare("DELETE FROM auth_email_tokens WHERE email=? AND purpose='reset'").bind(address),
    env.DB.prepare("INSERT INTO auth_email_tokens(token_hash,email,purpose,expires_at) VALUES (?,?,'reset',unixepoch()+1200)").bind(tokenHash,address)
   ]);
   const origin=(env.PUBLIC_ORIGIN||new URL(request.url).origin).replace(/\/+$/,"");
   const target=data.return_to==="espejo"?origin+"/espejo/?reset_token="+rawToken+"#/restablecer":origin+"/preview#reset="+rawToken;
   const sent=await sendMail(env,address,"Recuperar acceso Bellaquitas Fest",
     "Para restablecer tu contraseña abre este enlace en los próximos 20 minutos:\n"+target+"\nSi no lo solicitaste, ignora el mensaje.");
   if(!sent)console.error("Email provider failed to send password reset");
 }
 return json(publicResponse);
}
async function reset(request,env,data){
 if(!emailDeliveryReady(env))return unavailable();
 if(typeof data.token!=="string"||!/^[A-Za-z0-9_-]{43}$/.test(data.token)||!validPassword(data.password))return bad("Enlace o contraseña inválidos");
 const tokenHash=await sha256(data.token);
 const pending=await env.DB.prepare(
 "DELETE FROM auth_email_tokens WHERE token_hash=? AND purpose='reset' AND expires_at>unixepoch() RETURNING email"
 ).bind(tokenHash).first();
 if(!pending)return bad("Enlace caducado o utilizado");
 const salt=random(),hash=await passwordHash(data.password,salt);
 await env.DB.batch([
   env.DB.prepare("UPDATE auth_email_credentials SET password_hash=?,password_salt=?,password_iterations=?,updated_at=unixepoch() WHERE email=?").bind(hash,salt,ITERATIONS,pending.email),
   env.DB.prepare("DELETE FROM auth_sessions WHERE profile_id=(SELECT profile_id FROM auth_email_credentials WHERE email=?)").bind(pending.email)
 ]);
 return json({ok:true,message:"Contraseña actualizada. Vuelve a iniciar sesión."});
}
export async function emailAuthRoute(request,env,ctx){
 const path=new URL(request.url).pathname;
 if(path==="/v1/auth/email/status"){
   if(request.method!=="GET")return bad("Método no permitido",405);
   return json({login:emailLoginReady(env),registration:emailRegistrationReady(env),turnstileSiteKey:emailRegistrationReady(env)?env.TURNSTILE_SITE_KEY:null});
 }
 const routes={"/v1/auth/email/register":registration,"/v1/auth/email/verify":verify,
   "/v1/auth/email/login":login,"/v1/auth/email/forgot":forgot,"/v1/auth/email/reset":reset};
 const handler=routes[path];if(!handler)return null;
 if(request.method!=="POST")return bad("Método no permitido",405);
 if(!checkOrigin(request,env))return bad("Origen no autorizado",403);
 try{
  const data=await parseJson(request);
  return await handler(request,env,data,ctx);
 }catch(error){console.error("Email auth staging error",String(error?.message||"unknown").slice(0,120));return bad("Servicio temporalmente no disponible",503);}
}
