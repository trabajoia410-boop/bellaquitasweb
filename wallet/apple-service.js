/**
 * PassKit web-service endpoints, disabled until the Apple issuer/signer are
 * explicitly connected. All pass downloads require ApplePass token.
 * APNs delivery is a separate credential-gated component, not a fake push.
 */
import {hmac,validUuid} from "./core.js";
import {createPass,walletMode} from "./index.js";
const HEAD={"Cache-Control":"no-store","X-Robots-Tag":"noindex,nofollow",
 "X-Content-Type-Options":"nosniff"};
const resp=(data,status=200,extra={})=>new Response(JSON.stringify(data),{
 status,headers:{"Content-Type":"application/json; charset=utf-8",...HEAD,...extra}});
const fail=(status=404)=>resp({error:"Pass not available"},status);
const live=e=>e?.SITE_MODE==="production"&&e.WALLET_ENABLED==="yes"&&
 e.WALLET_REAL_APPROVED==="yes"&&walletMode(e)==="real"&&
 typeof e.APPLE_PASS_TYPE_ID==="string"&&/^pass\.[\w.-]+$/.test(e.APPLE_PASS_TYPE_ID)&&
 typeof e.WALLET_HMAC_KEY==="string"&&e.WALLET_HMAC_KEY.length>=32&&
 typeof e.DB?.prepare==="function";
async function validAuthorization(req,customer,env){
 const h=req.headers.get("Authorization")||"";
 if(!/^ApplePass [A-Za-z0-9_-]{43}$/.test(h))return false;
 const expected=await hmac("appleauth:"+customer.id,env.WALLET_HMAC_KEY);
 const left=new TextEncoder().encode(expected),right=new TextEncoder().encode(h.slice(10));
 return left.length===right.length&&left.every((v,i)=>v===right[i]);
}
async function customer(id,env){
 if(!validUuid(id))return null;
 return env.DB.prepare("SELECT * FROM wallet_customers WHERE id=? AND deleted_at IS NULL LIMIT 1")
  .bind(id).first();
}
async function responsePass(req,env,id){
 const person=await customer(id,env);if(!person)return fail();
 if(!await validAuthorization(req,person,env))return fail(401);
 const program=await env.DB.prepare("SELECT * FROM wallet_programs WHERE id=? AND active=1")
  .bind(person.program_id).first();
 if(!program)return fail();
 try{
  const result=await createPass({...person,scan_code:
   // Node signer receives opaque card code; no personal contact is sent.
   "bfw1."+person.id+"."+person.scan_nonce+"."+
    await hmac("scan:"+person.id+"."+person.scan_nonce,env.WALLET_HMAC_KEY)
  },program,env,"apple");
  return new Response(result.body,{status:200,headers:{...HEAD,
   "Content-Type":"application/vnd.apple.pkpass",
   "Last-Modified":new Date((person.updated_at||0)*1000).toUTCString()}});
 }catch{return fail(503);}
}
export async function walletAppleServiceRoute(req,env){
 const url=new URL(req.url),p=url.pathname;
 if(!p.startsWith("/v1/apple-wallet/"))return null;
 if(!live(env))return fail(503);
 const root="/v1/apple-wallet";
 const reg=p.match(/^\/v1\/apple-wallet\/v1\/devices\/([^/]{12,120})\/registrations\/([^/]{5,140})\/([^/]{36})$/);
 const listing=p.match(/^\/v1\/apple-wallet\/v1\/devices\/([^/]{12,120})\/registrations\/([^/]{5,140})$/);
 const pass=p.match(/^\/v1\/apple-wallet\/v1\/passes\/([^/]{5,140})\/([^/]{36})$/);
 if(reg){
  const [_,device,type,serial]=reg;
  if(type!==env.APPLE_PASS_TYPE_ID)return fail();
  const person=await customer(serial,env);if(!person)return fail();
  if(!await validAuthorization(req,person,env))return fail(401);
  const deviceHash=await hmac("device:"+device,env.WALLET_HMAC_KEY);
  if(req.method==="DELETE"){
   await env.DB.prepare("DELETE FROM wallet_apple_registrations WHERE device_id_hash=? AND customer_id=?")
    .bind(deviceHash,serial).run();return new Response(null,{status:200,headers:HEAD});
  }
  if(req.method!=="POST")return fail(405);
  if(!/^application\/json(?:;|$)/i.test(req.headers.get("Content-Type")||""))
   return fail(400);
  const raw=await req.text();if(raw.length>1200)return fail(400);
  let token;try{token=JSON.parse(raw).pushToken;}catch{return fail(400);}
  if(typeof token!=="string"||token.length<16||token.length>500||
      !/^[A-Za-z0-9:_-]+$/.test(token))return fail(400);
  const existing=await env.DB.prepare("SELECT 1 FROM wallet_apple_registrations WHERE device_id_hash=? AND customer_id=?")
   .bind(deviceHash,serial).first();
  await env.DB.prepare("INSERT INTO wallet_apple_registrations(device_id_hash,customer_id,push_token) VALUES(?,?,?) "+
    "ON CONFLICT(device_id_hash,customer_id) DO UPDATE SET push_token=excluded.push_token")
   .bind(deviceHash,serial,token).run();
  return new Response(null,{status:existing?200:201,headers:HEAD});
 }
 if(listing&&req.method==="GET"){
  const [_,device,type]=listing;if(type!==env.APPLE_PASS_TYPE_ID)return fail();
  const hash=await hmac("device:"+device,env.WALLET_HMAC_KEY);
  const since=Number(url.searchParams.get("passesUpdatedSince")||0);
  if(!Number.isSafeInteger(since)||since<0)return fail(400);
  const q=await env.DB.prepare(
   "SELECT c.id,c.updated_at FROM wallet_apple_registrations r "+
   "JOIN wallet_customers c ON c.id=r.customer_id "+
   "WHERE r.device_id_hash=? AND c.deleted_at IS NULL AND c.updated_at>? ORDER BY c.updated_at DESC LIMIT 200")
   .bind(hash,since).all();
  const results=q.results||[];
  if(!results.length)return new Response(null,{status:204,headers:HEAD});
  return resp({serialNumbers:results.map(c=>c.id),
   lastUpdated:String(Math.max(...results.map(c=>c.updated_at)))});
 }
 if(pass&&req.method==="GET"){
  const [_,type,serial]=pass;if(type!==env.APPLE_PASS_TYPE_ID)return fail();
  return responsePass(req,env,serial);
 }
 if(p===root+"/v1/log"&&req.method==="POST")
  return new Response(null,{status:200,headers:HEAD}); // Never log PII/token values.
 return fail(404);
}
