/**
 * QR stamping and restricted 4-digit employee code.
 * An employee never gains the Bellaquitas admin cookie/role, only a 15-minute
 * scanning token. Existing door/admin roles remain enforced by auth-routes.
 */
import {authenticatedProfile,checkOrigin} from "../cloudflare/auth-routes.js";
import {hmac,sha256,randomToken,verifyScan,validUuid,validSlug} from "./core.js";
const HEAD={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",
 "X-Content-Type-Options":"nosniff","X-Robots-Tag":"noindex,nofollow"};
const json=(data,status=200,h={})=>new Response(JSON.stringify(data),{status,headers:{...HEAD,...h}});
const COOKIE="__Host-bf_wallet_staff";
const answerFail=(status=403)=>json({error:"Acceso de escáner no autorizado"},status);
const readCookie=(req)=>((req.headers.get("Cookie")||"").split(";")
 .map(v=>v.trim()).find(v=>v.startsWith(COOKIE+"="))||"").slice(COOKIE.length+1);
const enabled=env=>env?.SITE_MODE==="production"&&env.WALLET_ENABLED==="yes"&&
 env.WALLET_STAFF_ENABLED==="yes"&&env.STAGING_MUTATIONS==="enabled"&&
 env.PUBLISH_APPROVED==="yes"&&typeof env.DB?.prepare==="function"&&
 typeof env.WALLET_HMAC_KEY==="string"&&env.WALLET_HMAC_KEY.length>=32;
const jsonInput=async req=>{
 if(!/^application\/json(?:;|$)/i.test(req.headers.get("Content-Type")||""))throw Error("Invalid type");
 if(Number(req.headers.get("Content-Length")||0)>1500)throw Error("Too large");
 const s=await req.text();if(s.length>1500)throw Error("Too large");
 const r=JSON.parse(s);if(!r||Array.isArray(r)||typeof r!=="object")throw Error("Invalid body");
 return r;
};
const ip=req=>req.headers.get("CF-Connecting-IP")||"unidentified";
async function rate(env,key,limit,seconds){
 const hashed=await hmac("rate:"+key,env.WALLET_HMAC_KEY);
 // Transactional upsert; atomically count every attempt before validating PIN.
 const count=await env.DB.prepare(
 "INSERT INTO wallet_pin_limits(key_hash,failures,blocked_until,expires_at) "+
 "VALUES (?,1,0,unixepoch()+?) "+
 "ON CONFLICT(key_hash) DO UPDATE SET "+
 "failures=CASE WHEN wallet_pin_limits.expires_at<unixepoch() THEN 1 ELSE MIN(10,wallet_pin_limits.failures+1) END,"+
 "blocked_until=CASE WHEN wallet_pin_limits.expires_at<unixepoch() THEN 0 "+
 "WHEN wallet_pin_limits.failures+1>=? THEN unixepoch()+? ELSE wallet_pin_limits.blocked_until END,"+
 "expires_at=CASE WHEN wallet_pin_limits.expires_at<unixepoch() THEN unixepoch()+? ELSE wallet_pin_limits.expires_at END "+
 "RETURNING failures,blocked_until"
 ).bind(hashed,seconds,limit,seconds,seconds).first();
 return !!count&&count.blocked_until<=Math.floor(Date.now()/1000);
}
async function login(req,env){
 let data;try{data=await jsonInput(req);}catch{return answerFail(400);}
 if(!validSlug(data.slug)||!/^\d{4}$/.test(data.pin||""))return answerFail(400);
 const program=await env.DB.prepare("SELECT id FROM wallet_programs WHERE slug=? AND active=1")
  .bind(data.slug).first();
 if(!program)return answerFail();
 const addr=ip(req);
 // Limit per IP and globally by program to prevent a 10k PIN brute force.
 if(!await rate(env,"pinip:"+program.id+":"+addr,5,900))return answerFail(429);
 if(!await rate(env,"pinprogram:"+program.id,10,3600))return answerFail(429);
 const hash=await hmac("pin:"+program.id+":"+data.pin,env.WALLET_HMAC_KEY);
 const employee=await env.DB.prepare("SELECT id FROM wallet_employees WHERE program_id=? AND pin_hash=? AND enabled=1")
  .bind(program.id,hash).first();
 if(!employee)return answerFail();
 const raw=randomToken(),digest=await sha256(raw);
 await env.DB.prepare("INSERT INTO wallet_employee_sessions(token_hash,employee_id,expires_at) VALUES(?,?,unixepoch()+900)")
  .bind(digest,employee.id).run();
 return json({authorized:true,scope:"stamp-only",expiresIn:900},200,{"Set-Cookie":COOKIE+"="+raw+"; Path=/; Max-Age=900; Secure; HttpOnly; SameSite=Lax"});
}
async function employeeSession(req,env){
 const raw=readCookie(req);
 if(!/^[A-Za-z0-9_-]{43}$/.test(raw))return null;
 return env.DB.prepare(
  "SELECT e.id,e.program_id FROM wallet_employee_sessions s JOIN wallet_employees e ON e.id=s.employee_id "+
  "WHERE s.token_hash=? AND s.expires_at>unixepoch() AND e.enabled=1 LIMIT 1")
  .bind(await sha256(raw)).first();
}
async function stamp(req,env){
 let data;try{data=await jsonInput(req);}catch{return answerFail(400);}
 if(!validUuid(data.requestId))return json({error:"Solicitud inválida"},400);
 const parsed=await verifyScan(data.code,env.WALLET_HMAC_KEY);
 if(!parsed)return json({error:"QR inválido"},400);
 const customer=await env.DB.prepare(
  "SELECT c.id,c.name,c.program_id,c.profile_id,c.scan_nonce,p.stamp_goal FROM wallet_customers c "+
  "JOIN wallet_programs p ON p.id=c.program_id "+
  "WHERE c.id=? AND c.deleted_at IS NULL AND p.active=1")
  .bind(parsed.id).first();
 if(!customer||customer.scan_nonce!==parsed.nonce)return json({error:"QR caducado"},404);
 let actor=null,worker=null;
 try{actor=await authenticatedProfile(req,env);}catch{}
 if(!actor||!["admin","puerta"].includes(actor.role))worker=await employeeSession(req,env);
 if(!worker&&(!actor||!["admin","puerta"].includes(actor.role)))
  return answerFail();
 if(worker&&worker.program_id!==customer.program_id)return answerFail();
 if(actor&&actor.id===customer.profile_id)return answerFail();
 try{
  await env.DB.prepare(
   "INSERT INTO wallet_stamp_events(id,customer_id,actor_profile_id,employee_id,action,delta,request_id) "+
   "VALUES(?,?,?,?,'stamp',1,?)")
   .bind(crypto.randomUUID(),customer.id,worker?null:actor.id,worker?.id||null,data.requestId).run();
 }catch(e){
  const msg=String(e?.message||"");
  if(msg.includes("Espera antes de sellar")||msg.includes("UNIQUE"))
   return json({error:"Debes esperar antes de volver a sellar"},409);
  return json({error:"No se pudo añadir un sello"},409);
 }
 const updated=await env.DB.prepare(
  "SELECT stamps,unlocked_rewards,redeemed_rewards FROM wallet_customers WHERE id=?")
  .bind(customer.id).first();
 return json({ok:true,name:customer.name,stamps:updated.stamps,goal:customer.stamp_goal,
  rewardReady:updated.unlocked_rewards>updated.redeemed_rewards});
}
export async function walletStaffRoute(req,env){
 const path=new URL(req.url).pathname;
 if(path!=="/v1/wallet/stamp"&&path!=="/v1/wallet/employee/login"&&path!=="/v1/wallet/employee/logout"&&path!=="/v1/wallet/employee/me")return null;
 if(!enabled(env))return answerFail(503);
 if(req.method!=="GET"&&!checkOrigin(req,env))return answerFail();
 if(path==="/v1/wallet/employee/login"&&req.method==="POST")return login(req,env);
 if(path==="/v1/wallet/employee/me"&&req.method==="GET"){
  const worker=await employeeSession(req,env);
  return json({authorized:!!worker,scope:worker?"stamp-only":null},worker?200:401);
 }
 if(path==="/v1/wallet/stamp"&&req.method==="POST")return stamp(req,env);
 if(path==="/v1/wallet/employee/logout"&&req.method==="POST"){
  const worker=await employeeSession(req,env);
  if(worker)await env.DB.prepare("DELETE FROM wallet_employee_sessions WHERE token_hash=?")
   .bind(await sha256(readCookie(req))).run();
  return json({ok:true},200,{"Set-Cookie":COOKIE+"=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax"});
 }
 return answerFail(405);
}
