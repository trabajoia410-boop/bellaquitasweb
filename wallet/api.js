/**
 * Wallet enrollment and self-service. Email OTP is mandatory: no unverified
 * phone-only lookup and no password creation. Old BF profiles are untouched.
 * All writes fail closed until final activation flags and issuer owner approval.
 */
import {checkOrigin} from "../cloudflare/auth-routes.js";
import {providerBrokerAvailable,providerBrokerCall} from "../cloudflare/provider-broker.js";
import {createPass,walletMode} from "./index.js";
import {hmac,sha256,otp6,randomToken,scanCode,normalizeEmail,normalizePhone,
 validSlug,validUuid,publicCard} from "./core.js";
const HEAD={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",
 "X-Robots-Tag":"noindex,nofollow","X-Content-Type-Options":"nosniff"};
const COOKIE="__Host-bf_wallet";
const answer=(value,status=200,headers={})=>new Response(JSON.stringify(value),{
 status,headers:{...HEAD,...headers}});
const fail=(message="Tarjeta no disponible",status=503)=>answer({error:message},status);
const allowed=env=>env?.SITE_MODE==="production"&&env.WALLET_ENABLED==="yes"&&
 env.PUBLISH_APPROVED==="yes"&&typeof env.DB?.prepare==="function"&&
 typeof env.WALLET_HMAC_KEY==="string"&&env.WALLET_HMAC_KEY.length>=32;
const writable=env=>allowed(env)&&env.WALLET_SIGNUP_ENABLED==="yes"&&
 env.STAGING_MUTATIONS==="enabled";
const cookie=(value,age)=>COOKIE+"="+value+"; Path=/; Max-Age="+age+"; Secure; HttpOnly; SameSite=Lax";
const readCookie=req=>(req.headers.get("Cookie")||"").split(";")
 .map(v=>v.trim()).find(v=>v.startsWith(COOKIE+"="))?.slice(COOKIE.length+1)||"";
const body=async req=>{
 if(!/^application\/json(?:;|$)/i.test(req.headers.get("Content-Type")||""))throw Error("Content-Type");
 const size=req.headers.get("Content-Length");
 if(size&&Number(size)>3000)throw Error("Large body");
 const value=await req.text();if(value.length>3000)throw Error("Large body");
 const data=JSON.parse(value);
 if(!data||typeof data!=="object"||Array.isArray(data))throw Error("Object expected");
 return data;
};
async function customerSession(req,env){
 const raw=readCookie(req);
 if(!/^[A-Za-z0-9_-]{43}$/.test(raw))return null;
 const tokenHash=await sha256(raw);
 return env.DB.prepare("SELECT c.* FROM wallet_customer_sessions s JOIN wallet_customers c ON c.id=s.customer_id WHERE s.token_hash=? AND s.expires_at>unixepoch() AND c.deleted_at IS NULL LIMIT 1")
  .bind(tokenHash).first();
}
// Rate-limit SMTP volume both per network and per business. Reuses the
// existing WALLET pin-limit table, but separate HMAC namespaces. Mail is not
// sent when either limit is exhausted; protects Resend and Free-tier quota.
async function enrollRateLimit(req,env,programId){
 const address=req.headers.get("CF-Connecting-IP")||"unknown";
 const rateKeys=[
  {key:"signup-ip:"+programId+":"+address,maximum:5,seconds:3600},
  {key:"signup-program:"+programId,maximum:50,seconds:3600}
 ];
 for(const item of rateKeys){
  const key=await hmac(item.key,env.WALLET_HMAC_KEY);
  const result=await env.DB.prepare(
   "INSERT INTO wallet_pin_limits(key_hash,failures,expires_at,blocked_until) "+
   "VALUES (?,1,unixepoch()+?,0) "+
   "ON CONFLICT(key_hash) DO UPDATE SET "+
   "failures=CASE WHEN expires_at<unixepoch() THEN 1 ELSE MIN(100,failures+1) END,"+
   "expires_at=CASE WHEN expires_at<unixepoch() THEN unixepoch()+? ELSE expires_at END "+
   "RETURNING failures"
  ).bind(key,item.seconds,item.seconds).first();
  if(!result||result.failures>item.maximum)return false;
 }
 return true;
}
async function sendCode(env,email,slug,code){
 const message="Verifica tu tarjeta Bellaquitas Fest. Tu código temporal de 6 cifras es "+code+
  ". Caduca en 10 minutos. Si no lo solicitaste, ignora este mensaje. Tarjeta: https://bellaquitas.fr/tarjeta/"+slug;
 if(providerBrokerAvailable(env)){
  await providerBrokerCall(env,"resend_send",{to:email,
   subject:"Confirma tu cuenta Bellaquitas Fest",message});return;
 }
 if(typeof env.RESEND_API_KEY!=="string"||env.RESEND_API_KEY.length<9)
  throw Error("Resend provider unavailable");
 const response=await fetch("https://api.resend.com/emails",{
  method:"POST",headers:{"Authorization":"Bearer "+env.RESEND_API_KEY,
    "Content-Type":"application/json"},
  body:JSON.stringify({from:"no-reply@bellaquitas.fr",to:[email],
    subject:"Confirma tu cuenta Bellaquitas Fest",text:message}),
  signal:AbortSignal.timeout(7000)});
 if(!response.ok)throw Error("Email provider rejected");
}
async function start(req,env){
 if(!writable(env))return fail();
 let data;try{data=await body(req);}catch{return fail("Formulario inválido",400);}
 if(!validSlug(data.slug)||data.consent!==true)return fail("Consentimiento y negocio necesarios",400);
 const name=String(data.name||"").trim().slice(0,81);
 if(name.length<2||name.length>80)return fail("Nombre inválido",400);
 let email,phone;try{email=normalizeEmail(data.email);phone=normalizePhone(data.phone);}catch{
  return fail("Introduce un correo válido. El teléfono es opcional.",400);}
 const program=await env.DB.prepare("SELECT id,slug FROM wallet_programs WHERE slug=? AND active=1 LIMIT 1")
  .bind(data.slug).first();
 if(!program)return fail("Programa no disponible",404);
 if(!await enrollRateLimit(req,env,program.id))return fail("Demasiadas solicitudes de verificación",429);
 const secret=env.WALLET_HMAC_KEY;
 const contactHash=await hmac("email:"+program.id+":"+email,secret);
 const id=crypto.randomUUID(),code=otp6();
 const hash=await hmac("otp:"+id+":"+code,secret);
 // Single challenge per program+email, with a 60s minimum interval across
 // devices. No contact is looked up via unverified input.
 const inserted=await env.DB.prepare(
  "INSERT INTO wallet_email_challenges(id,program_id,contact_hash,email,customer_name,phone,consent,marketing_opt_in,code_hash,expires_at) "+
  "VALUES(?,?,?,?,?,?,1,?,?,unixepoch()+600) "+
  "ON CONFLICT(program_id,contact_hash) DO UPDATE SET id=excluded.id,customer_name=excluded.customer_name,phone=excluded.phone,code_hash=excluded.code_hash,expires_at=excluded.expires_at,created_at=unixepoch(),attempts=0,marketing_opt_in=excluded.marketing_opt_in "+
  "WHERE wallet_email_challenges.created_at<unixepoch()-60 RETURNING id"
 ).bind(id,program.id,contactHash,email,name,phone,data.marketing===true?1:0,hash).first();
 if(!inserted)return fail("Espera un minuto antes de solicitar otro código.",429);
 try{await sendCode(env,email,program.slug,code);}
 catch{
  await env.DB.prepare("DELETE FROM wallet_email_challenges WHERE id=?").bind(id).run();
  return fail("El correo no está disponible",503);
 }
 return answer({ok:true,challengeId:id,message:"Revisa tu correo"},200);
}
async function verify(req,env){
 if(!writable(env))return fail();
 let data;try{data=await body(req);}catch{return fail("Formulario inválido",400);}
 if(!validUuid(data.challengeId)||!/^[0-9]{6}$/.test(data.code||""))
  return fail("Código inválido o caducado",400);
 const record=await env.DB.prepare("SELECT * FROM wallet_email_challenges WHERE id=? AND expires_at>unixepoch() AND attempts<5")
  .bind(data.challengeId).first();
 if(!record)return fail("Código inválido o caducado",403);
 // Count attempts even for invalid codes. Do not leak whether an email exists.
 await env.DB.prepare("UPDATE wallet_email_challenges SET attempts=attempts+1 WHERE id=? AND attempts<5")
  .bind(record.id).run();
 const expected=await hmac("otp:"+record.id+":"+data.code,env.WALLET_HMAC_KEY);
 const expectedBytes=new TextEncoder().encode(expected);
 const originalBytes=new TextEncoder().encode(record.code_hash);
 if(expectedBytes.length!==originalBytes.length||
    !expectedBytes.every((v,i)=>v===originalBytes[i]))
  return fail("Código inválido o caducado",403);
 let existing=await env.DB.prepare("SELECT id FROM wallet_customers WHERE program_id=? AND contact_hash=? AND deleted_at IS NULL")
  .bind(record.program_id,record.contact_hash).first();
 let customerId=existing?.id;
 if(!customerId){
  const id=crypto.randomUUID(),nonce=crypto.randomUUID();
  const scanHash=await hmac("scanref:"+id+":"+nonce,env.WALLET_HMAC_KEY);
  await env.DB.prepare(
   "INSERT INTO wallet_customers(id,program_id,name,email,phone,contact_hash,scan_token_hash,scan_nonce,consent_at,marketing_opt_in) "+
   "VALUES(?,?,?,?,?,?,?,?,unixepoch(),?) ON CONFLICT(program_id,contact_hash) DO NOTHING"
  ).bind(id,record.program_id,record.customer_name,record.email,record.phone,
   record.contact_hash,scanHash,nonce,record.marketing_opt_in).run();
  existing=await env.DB.prepare("SELECT id FROM wallet_customers WHERE program_id=? AND contact_hash=? AND deleted_at IS NULL")
    .bind(record.program_id,record.contact_hash).first();
  customerId=existing?.id;
 }
 if(!customerId)return fail("No se pudo crear tarjeta",503);
 const token=randomToken(),hash=await sha256(token);
 await env.DB.batch([
  env.DB.prepare("DELETE FROM wallet_email_challenges WHERE id=?").bind(record.id),
  env.DB.prepare("INSERT INTO wallet_customer_sessions(token_hash,customer_id,expires_at) VALUES(?,?,unixepoch()+2592000)")
   .bind(hash,customerId)
 ]);
 return answer({authenticated:true},200,{"Set-Cookie":cookie(token,2592000)});
}
async function me(req,env){
 const slug=new URL(req.url).searchParams.get("slug");
 if(!validSlug(slug))return fail("Programa inválido",400);
 const customer=await customerSession(req,env);
 if(!customer)return fail("Tarjeta no recuperada",401);
 const program=await env.DB.prepare("SELECT * FROM wallet_programs WHERE id=? AND slug=? AND active=1")
  .bind(customer.program_id,slug).first();
 if(!program)return fail("Programa no disponible",404);
 const code=await scanCode(customer,env.WALLET_HMAC_KEY);
 return answer({card:{...publicCard(customer,program),scanCode:code},
  mock:walletMode(env)!=="real"});
}
async function erase(req,env){
 if(!writable(env))return fail();
 let data;try{data=await body(req);}catch{return fail("Formulario inválido",400);}
 if(data.confirm!==true)return fail("Confirmación necesaria",400);
 const customer=await customerSession(req,env);if(!customer)return fail("Sesión inválida",401);
 // GDPR: delete all loyalty PII, audit rows and per-device registration, but
 // NEVER delete Bellaquitas profiles or original loyalty points.
 await env.DB.batch([
  env.DB.prepare("DELETE FROM wallet_stamp_events WHERE customer_id=?").bind(customer.id),
  env.DB.prepare("DELETE FROM wallet_reward_claims WHERE customer_id=?").bind(customer.id),
  env.DB.prepare("DELETE FROM wallet_message_deliveries WHERE customer_id=?").bind(customer.id),
  env.DB.prepare("DELETE FROM wallet_apple_registrations WHERE customer_id=?").bind(customer.id),
  env.DB.prepare("DELETE FROM wallet_customer_sessions WHERE customer_id=?").bind(customer.id),
  env.DB.prepare("DELETE FROM wallet_email_challenges WHERE program_id=? AND contact_hash=?")
   .bind(customer.program_id,customer.contact_hash),
  env.DB.prepare("DELETE FROM wallet_customers WHERE id=?").bind(customer.id)
 ]);
 return answer({deleted:true},200,{"Set-Cookie":cookie("",0)});
}
async function pass(req,env,type){
 const customer=await customerSession(req,env);
 if(!customer)return fail("Tarjeta no recuperada",401);
 const program=await env.DB.prepare("SELECT * FROM wallet_programs WHERE id=? AND active=1")
  .bind(customer.program_id).first();
 if(!program)return fail();
 if(walletMode(env)!=="real")return answer({mock:true,preview:true,signed:false});
 if(type==="apple")return answer({url:"/v1/wallet/pass/apple/download"});
 const c={...customer,scan_code:await scanCode(customer,env.WALLET_HMAC_KEY)};
 try{
  const result=await createPass(c,program,env,type);
  return answer({url:result.url});
 }catch{return fail("Wallet no está disponible",503);}
}
async function downloadApple(req,env){
 const customer=await customerSession(req,env);if(!customer)return fail("Tarjeta no recuperada",401);
 if(walletMode(env)!=="real")return fail("Apple Wallet no activado",503);
 const program=await env.DB.prepare("SELECT * FROM wallet_programs WHERE id=? AND active=1")
  .bind(customer.program_id).first();
 try{
  const result=await createPass({...customer,
   scan_code:await scanCode(customer,env.WALLET_HMAC_KEY)},program,env,"apple");
  return new Response(result.body,{status:200,headers:{"Content-Type":"application/vnd.apple.pkpass",
   "Content-Disposition":"attachment; filename=\"bellaquitas-fest.pkpass\"",
   "Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
 }catch{return fail("No hay un firmante Apple configurado",503);}
}
export async function walletApiRoute(req,env){
 const path=new URL(req.url).pathname;
 if(!path.startsWith("/v1/wallet/"))return null;
 if(!allowed(env))return fail();
 if(req.method!=="GET"&&!checkOrigin(req,env))return fail("Origen no autorizado",403);
 try{
  if(path==="/v1/wallet/me"&&req.method==="GET")return me(req,env);
  if(path==="/v1/wallet/enroll/start"&&req.method==="POST")return start(req,env);
  if(path==="/v1/wallet/enroll/verify"&&req.method==="POST")return verify(req,env);
  if(path==="/v1/wallet/me/delete"&&req.method==="POST")return erase(req,env);
  if(path==="/v1/wallet/pass/apple/download"&&req.method==="GET")return downloadApple(req,env);
  if(path==="/v1/wallet/pass/apple"&&req.method==="POST")return pass(req,env,"apple");
  if(path==="/v1/wallet/pass/google"&&req.method==="POST")return pass(req,env,"google");
  return fail("Ruta no encontrada",404);
 }catch{return fail("Servicio de tarjeta temporalmente no disponible",503);}
}
