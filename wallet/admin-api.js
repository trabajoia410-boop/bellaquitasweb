/**
 * New wallet management API — mounted under the *existing* administrator.
 * No separate admin account. Admin operations demand the BF step-up cookie.
 * NEVER update profiles, activity, rewards, redemptions or legacy points.
 */
import {authenticatedAdminAccess,checkOrigin} from "../cloudflare/auth-routes.js";
import {hmac,randomToken,validSlug,validColor,safeAsset,validUuid} from "./core.js";
import {walletMode} from "./index.js";
import {walletIssuerReadiness} from "./issuer-readiness.js";
const HEAD={"Content-Type":"application/json; charset=utf-8",
 "Cache-Control":"no-store","X-Content-Type-Options":"nosniff","X-Robots-Tag":"noindex,nofollow"};
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:HEAD});
const unavailable=()=>json({error:"Gestión Wallet no disponible"},503);
const forbidden=()=>json({error:"Reautenticación administrativa necesaria"},403);
const enabled=e=>e?.SITE_MODE==="production"&&e.WALLET_ENABLED==="yes"&&
 e.PUBLISH_APPROVED==="yes"&&typeof e.DB?.prepare==="function";
const mutable=e=>enabled(e)&&e.STAGING_MUTATIONS==="enabled"&&
 e.WALLET_ADMIN_WRITES==="yes"&&typeof e.WALLET_HMAC_KEY==="string"&&
 e.WALLET_HMAC_KEY.length>=32;
const parse=async req=>{
 if(!/^application\/json(?:;|$)/i.test(req.headers.get("Content-Type")||""))throw Error("Content-Type");
 if(Number(req.headers.get("Content-Length")||0)>4000)throw Error("Large");
 const s=await req.text();if(s.length>4000)throw Error("Large");
 const d=JSON.parse(s);if(!d||typeof d!=="object"||Array.isArray(d))throw Error("Invalid");
 return d;
};
const program=async env=>env.DB.prepare("SELECT * FROM wallet_programs WHERE slug='bellaquitas-fest' LIMIT 1").first();
async function saveDesign(req,env){
 let data;try{data=await parse(req);}catch{return json({error:"Diseño inválido"},400);}
 const name=String(data.name||"Bellaquitas Fest").trim();
 const reward=String(data.reward||"").trim(),message=String(data.message||"").trim();
 const goal=Number(data.goal),cooldown=Number(data.cooldown||600);
 if(name.length<2||name.length>100||reward.length<2||reward.length>160||
    message.length>200||!Number.isSafeInteger(goal)||goal<2||goal>30||
    !validColor(data.color)||!validColor(data.accent)||
    !safeAsset(data.logo)||!safeAsset(data.banner)||
    !Number.isSafeInteger(cooldown)||cooldown<60||cooldown>86400)
  return json({error:"Comprueba logo, colores, sellos y recompensa"},400);
 const old=await program(env);
 if(old&&old.stamp_goal!==goal){
  const any=await env.DB.prepare("SELECT 1 FROM wallet_customers WHERE program_id=? LIMIT 1")
   .bind(old.id).first();
  if(any)return json({error:"No se puede cambiar el objetivo con tarjetas ya emitidas"},409);
 }
 const newId=old?.id||crypto.randomUUID();
 await env.DB.prepare(
  "INSERT INTO wallet_programs(id,slug,name,logo_url,banner_url,color,accent_color,stamp_goal,reward_label,card_message,cooldown_seconds,active) "+
  "VALUES(?,'bellaquitas-fest',?,?,?,?,?,?,?,?,?,0) "+
  "ON CONFLICT(slug) DO UPDATE SET name=excluded.name,logo_url=excluded.logo_url,"+
  "banner_url=excluded.banner_url,color=excluded.color,accent_color=excluded.accent_color,"+
  "stamp_goal=excluded.stamp_goal,reward_label=excluded.reward_label,"+
  "card_message=excluded.card_message,cooldown_seconds=excluded.cooldown_seconds,updated_at=unixepoch()"
 ).bind(newId,name,data.logo,data.banner,data.color,data.accent,goal,reward,message,cooldown).run();
 const next=await program(env);
 return json({ok:true,program:next});
}
async function listCustomers(url,env){
 const p=await program(env);if(!p)return json({items:[],total:0});
 const query=String(url.searchParams.get("search")||"").trim().slice(0,80);
 const inactive=Number(url.searchParams.get("inactive")||0);
 if(!Number.isSafeInteger(inactive)||inactive<0||inactive>365)return json({error:"Filtro inválido"},400);
 const filter="%"+query.replace(/[%_\\]/g,"\\$&")+"%";
 const where="program_id=? AND deleted_at IS NULL AND "+
   "(name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\') AND "+
   "(?=0 OR COALESCE(last_stamp_at,created_at)<=unixepoch()-?*86400)";
 const results=await env.DB.prepare(
  "SELECT id,name,email,phone,stamps,unlocked_rewards,redeemed_rewards,last_stamp_at,created_at "+
  "FROM wallet_customers WHERE "+where+" ORDER BY created_at DESC LIMIT 150"
 ).bind(p.id,filter,filter,inactive,inactive).all();
 const total=await env.DB.prepare("SELECT count(*) AS n FROM wallet_customers WHERE program_id=? AND deleted_at IS NULL")
  .bind(p.id).first();
 return json({items:results.results||[],total:total?.n||0});
}
async function statistics(env){
 const p=await program(env);if(!p)return json({newCustomers:0,stamps:0,redeemed:0,days:[]});
 const [customers,stamps,rewards,days]=await Promise.all([
  env.DB.prepare("SELECT count(*) AS n FROM wallet_customers WHERE program_id=? AND created_at>unixepoch()-2592000")
   .bind(p.id).first(),
  env.DB.prepare("SELECT count(*) AS n FROM wallet_stamp_events s JOIN wallet_customers c ON c.id=s.customer_id WHERE c.program_id=? AND s.action='stamp' AND s.created_at>unixepoch()-2592000")
   .bind(p.id).first(),
  env.DB.prepare("SELECT count(*) AS n FROM wallet_reward_claims r JOIN wallet_customers c ON c.id=r.customer_id WHERE c.program_id=? AND r.created_at>unixepoch()-2592000")
   .bind(p.id).first(),
  env.DB.prepare("SELECT date(s.created_at,'unixepoch') AS day,count(*) AS n FROM wallet_stamp_events s JOIN wallet_customers c ON c.id=s.customer_id WHERE c.program_id=? AND s.action='stamp' AND s.created_at>unixepoch()-2592000 GROUP BY day ORDER BY day").bind(p.id).all()
 ]);
 return json({newCustomers:customers?.n||0,stamps:stamps?.n||0,
  redeemed:rewards?.n||0,days:days?.results||[]});
}
async function addEmployee(req,env,actor){
 let d;try{d=await parse(req);}catch{return json({error:"Formulario inválido"},400);}
 const name=String(d.name||"").trim();
 if(name.length<2||name.length>80)return json({error:"Nombre inválido"},400);
 const p=await program(env);if(!p)return json({error:"Crea el diseño de tarjeta primero"},400);
 // Secure 4-digit generation, return once. PIN hash is server-HMACed.
 for(let n=0;n<6;n++){
  const bytes=crypto.getRandomValues(new Uint16Array(1));
  if(bytes[0]>=60000)continue; // unbiased range 0..59999
  const pin=String(bytes[0]%10000).padStart(4,"0");
  const hash=await hmac("pin:"+p.id+":"+pin,env.WALLET_HMAC_KEY);
  const existing=await env.DB.prepare("SELECT 1 FROM wallet_employees WHERE program_id=? AND pin_hash=?")
   .bind(p.id,hash).first();if(existing)continue;
  await env.DB.prepare("INSERT INTO wallet_employees(id,program_id,name,pin_hash,created_by) VALUES(?,?,?,?,?)")
   .bind(crypto.randomUUID(),p.id,name,hash,actor.id).run();
  return json({ok:true,pin,showOnce:true});
 }
 return json({error:"No se pudo generar un código distinto"},503);
}
async function revokeEmployee(req,env){
 let d;try{d=await parse(req);}catch{return json({error:"ID inválido"},400);}
 if(!validUuid(d.employeeId))return json({error:"ID inválido"},400);
 const p=await program(env);
 if(!p)return json({error:"Programa no encontrado"},404);
 await env.DB.batch([
  env.DB.prepare("UPDATE wallet_employees SET enabled=0 WHERE id=? AND program_id=?")
   .bind(d.employeeId,p.id),
  env.DB.prepare("DELETE FROM wallet_employee_sessions WHERE employee_id=?")
   .bind(d.employeeId)
 ]);
 return json({ok:true});
}
async function removeStamp(req,env,actor){
 let d;try{d=await parse(req);}catch{return json({error:"Datos inválidos"},400);}
 const reason=String(d.reason||"").trim();
 if(!validUuid(d.customerId)||!validUuid(d.requestId)||reason.length<5||reason.length>200)
  return json({error:"ID y motivo obligatorios"},400);
 try{
  await env.DB.prepare(
   "INSERT INTO wallet_stamp_events(id,customer_id,actor_profile_id,employee_id,action,delta,request_id,reason) "+
   "VALUES(?,?,?,NULL,'reversal',-1,?,?)")
   .bind(crypto.randomUUID(),d.customerId,actor.id,d.requestId,reason).run();
  return json({ok:true});
 }catch{return json({error:"No se puede quitar este sello"},409);}
}
async function redeem(req,env,actor){
 let d;try{d=await parse(req);}catch{return json({error:"Datos inválidos"},400);}
 if(!validUuid(d.customerId))return json({error:"Cliente inválido"},400);
 try{
  await env.DB.prepare("INSERT INTO wallet_reward_claims(id,customer_id,verified_by) VALUES(?,?,?)")
   .bind(crypto.randomUUID(),d.customerId,actor.id).run();
  return json({ok:true});
 }catch{return json({error:"Recompensa no disponible o canje repetido"},409);}
}
async function campaigns(env){
 const p=await program(env);if(!p)return json({items:[]});
 const records=await env.DB.prepare("SELECT id,audience,inactive_days,message_es,message_fr,status,created_at,sent_at FROM wallet_campaigns WHERE program_id=? ORDER BY created_at DESC LIMIT 100")
  .bind(p.id).all();return json({items:records.results||[]});
}
async function queueMessage(req,env,actor){
 let d;try{d=await parse(req);}catch{return json({error:"Datos inválidos"},400);}
 const audience=d.audience,inactive=Number(d.days||0),
   es=String(d.message_es||"").trim(),fr=String(d.message_fr||"").trim();
 if(!["all","inactive"].includes(audience)||!Number.isSafeInteger(inactive)||inactive<0||inactive>365||
    es.length<2||es.length>160||fr.length<2||fr.length>160)
  return json({error:"Comprueba audiencia y textos ES/FR"},400);
 const p=await program(env);if(!p)return json({error:"Programa no configurado"},404);
 // No mass delivery is sent during a synchronous admin request. This only
 // creates a draft for explicit opt-in after provider approval/queue setup.
 const id=crypto.randomUUID();
 await env.DB.prepare(
  "INSERT INTO wallet_campaigns(id,program_id,created_by,audience,inactive_days,message_es,message_fr,status) VALUES(?,?,?,?,?,?,?,'draft')")
  .bind(id,p.id,actor.id,audience,inactive,es,fr).run();
 return json({ok:true,id,mode:walletMode(env),sent:0,delivery:"draft-only"});
}
async function deleteClient(req,env){
 let d;try{d=await parse(req);}catch{return json({error:"Datos inválidos"},400);}
 if(!validUuid(d.customerId)||d.confirm!==true)return json({error:"Confirmación necesaria"},400);
 // Same deletion graph as self-service, never touching original profiles.
 await env.DB.batch([
  env.DB.prepare("DELETE FROM wallet_stamp_events WHERE customer_id=?").bind(d.customerId),
  env.DB.prepare("DELETE FROM wallet_reward_claims WHERE customer_id=?").bind(d.customerId),
  env.DB.prepare("DELETE FROM wallet_message_deliveries WHERE customer_id=?").bind(d.customerId),
  env.DB.prepare("DELETE FROM wallet_apple_registrations WHERE customer_id=?").bind(d.customerId),
  env.DB.prepare("DELETE FROM wallet_customer_sessions WHERE customer_id=?").bind(d.customerId),
  env.DB.prepare("DELETE FROM wallet_customers WHERE id=?").bind(d.customerId)
 ]);
 return json({ok:true,deleted:true});
}
export async function walletAdminApiRoute(req,env){
 const url=new URL(req.url),path=url.pathname;
 if(!path.startsWith("/v1/wallet/admin/"))return null;
 if(!enabled(env))return unavailable();
 const actor=await authenticatedAdminAccess(req,env);
 if(!actor||actor.role!=="admin")return forbidden();
 if(req.method!=="GET"&&!checkOrigin(req,env))return forbidden();
 try{
  if(path==="/v1/wallet/admin/program"&&req.method==="GET")
   return json({program:await program(env),mock:walletMode(env)!=="real"});
  if(path==="/v1/wallet/admin/issuer-status"&&req.method==="GET")return json({providers:walletIssuerReadiness(env)});
  if(path==="/v1/wallet/admin/customers"&&req.method==="GET")return listCustomers(url,env);
  if(path==="/v1/wallet/admin/stats"&&req.method==="GET")return statistics(env);
  if(path==="/v1/wallet/admin/campaigns"&&req.method==="GET")return campaigns(env);
  if(path==="/v1/wallet/admin/employees"&&req.method==="GET"){
   const p=await program(env);if(!p)return json({items:[]});
   const q=await env.DB.prepare("SELECT id,name,enabled,created_at FROM wallet_employees WHERE program_id=? ORDER BY created_at DESC LIMIT 100").bind(p.id).all();
   return json({items:q.results||[]});
  }
  if(!mutable(env))return unavailable();
  if(path==="/v1/wallet/admin/program/save"&&req.method==="POST")return saveDesign(req,env);
  if(path==="/v1/wallet/admin/employee/create"&&req.method==="POST")return addEmployee(req,env,actor);
  if(path==="/v1/wallet/admin/employee/revoke"&&req.method==="POST")return revokeEmployee(req,env);
  if(path==="/v1/wallet/admin/stamp/remove"&&req.method==="POST")return removeStamp(req,env,actor);
  if(path==="/v1/wallet/admin/reward/redeem"&&req.method==="POST")return redeem(req,env,actor);
  if(path==="/v1/wallet/admin/campaign/create"&&req.method==="POST")return queueMessage(req,env,actor);
  if(path==="/v1/wallet/admin/customer/delete"&&req.method==="POST")return deleteClient(req,env);
  return json({error:"Ruta no encontrada"},404);
 }catch{return json({error:"Error interno de gestión Wallet"},503);}
}
