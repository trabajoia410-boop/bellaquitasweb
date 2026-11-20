/**
 * Bellaquitas Fest - Clerk JWT read-only identity adapter (phase 6).
 * Does NOT create identities, change points, create BF sessions or grant admin.
 * A Clerk user is NOT a Bellaquitas member until a separately reconciled
 * signed subject->profile_id mapping exists in auth_clerk_links.
 * No Clerk secret key is required: verify RS256 with pinned issuer's JWKS.
 */
const HEAD={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff","X-Robots-Tag":"noindex, nofollow","Referrer-Policy":"no-referrer"};
const reply=(body,status)=>new Response(JSON.stringify(body),{status,headers:HEAD});
// Avoid re-fetching JWKS and importing RSA keys on every 60-second Clerk JWT.
// Short-lived, issuer-pinned, bounded isolate cache: never trust a JWT header
// URL, and throttle unknown KIDs to avoid repeated paid-resource subrequests.
const JWKS_MAX_AGE_MS=5*60*1000, JWKS_UNKNOWN_KID_RETRY_MS=30*1000;
const jwksCache=new Map();
async function verifiedClerkKey(cfg,kid,network) {
 const clock=Date.now(),item=jwksCache.get(cfg.issuer);
 if(item&&clock-item.fetchedAt<JWKS_MAX_AGE_MS){
  const known=item.keys.get(kid);
  if(known)return known;
  if(clock-item.fetchedAt<JWKS_UNKNOWN_KID_RETRY_MS)return null;
 }
 const reply=await network(cfg.jwks,{headers:{Accept:"application/json"},cf:{cacheEverything:true,cacheTtl:300}});
 if(!reply.ok||Number(reply.headers.get("content-length")||0)>65536)return null;
 const body=await reply.json();
 if(!Array.isArray(body?.keys)||body.keys.length>25)return null;
 // Resolve only the requested key; caching one CryptoKey bounds memory and
 // prevents importing 25 keys in a single invocation.
 const match=body.keys.find(k=>k.kid===kid&&k.kty==="RSA"&&
  (!k.alg||k.alg==="RS256")&&(!k.use||k.use==="sig")&&
  typeof k.n==="string"&&typeof k.e==="string");
 const keys=new Map();
 if(match){
  const imported=await crypto.subtle.importKey("jwk",
   {kty:"RSA",n:match.n,e:match.e,alg:"RS256",ext:true},
   {name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
  keys.set(kid,imported);
 }
 // Keep at most two issuers; production allows only the fixed custom domain.
 if(!jwksCache.has(cfg.issuer)&&jwksCache.size>=2)
  jwksCache.delete(jwksCache.keys().next().value);
 jwksCache.set(cfg.issuer,{fetchedAt:clock,keys});
 return keys.get(kid)||null;
}
function decode64(data){
 if(typeof data!=="string"||data.length>12000||!/^[A-Za-z0-9_-]+$/.test(data))throw Error("JWT encoding");
 const b=atob(data.replace(/-/g,"+").replace(/_/g,"/"));
 return Uint8Array.from(b,c=>c.charCodeAt(0));
}
function parsed(data){return JSON.parse(new TextDecoder().decode(decode64(data)));}
function issuerConfig(env){
 if(env?.CLERK_JWT_ENABLED!=="yes"||typeof env.CLERK_ISSUER!=="string"||
    typeof env.CLERK_ALLOWED_ORIGIN!=="string")return null;
 let url,origin;
 try{url=new URL(env.CLERK_ISSUER);origin=new URL(env.CLERK_ALLOWED_ORIGIN);}
 catch{return null;}
 if(url.protocol!=="https:"||url.username||url.password||url.search||url.hash||
    url.pathname!=="/"||url.port||
    !(/^[a-z0-9-]+\.clerk\.accounts\.dev$/i.test(url.hostname)||
      url.hostname==="clerk.bellaquitas.fr"))return null;
 if(origin.protocol!=="https:"||origin.username||origin.password||origin.pathname!=="/"||
    origin.search||origin.hash)return null;
 // Production tokens MUST be issued for the final canonical origin, not GitHub.
 if(env.SITE_MODE==="production" &&
    (url.hostname!=="clerk.bellaquitas.fr"||
     origin.origin!=="https://bellaquitas.fr"))return null;
 return {issuer:url.origin,origin:origin.origin,jwks:url.origin+"/.well-known/jwks.json"};
}
export async function verifyClerkJwt(request,env,network=fetch){
 const cfg=issuerConfig(env);if(!cfg)return null;
 const auth=request.headers.get("Authorization")||"";
 if(!/^Bearer [A-Za-z0-9._-]{60,10000}$/.test(auth))return null;
 const value=auth.slice(7);
 const parts=value.split(".");if(parts.length!==3)return null;
 let header,claims;
 try{header=parsed(parts[0]);claims=parsed(parts[1]);}
 catch{return null;}
 if(header?.alg!=="RS256"||header.typ&&header.typ!=="JWT"||
    !/^[A-Za-z0-9_-]{5,128}$/.test(header.kid||"")||header.jku||header.jwk||header.x5u)return null;
 const now=Math.floor(Date.now()/1000);
 if(claims?.iss!==cfg.issuer||claims.azp!==cfg.origin||
    !/^user_[A-Za-z0-9]{10,128}$/.test(claims.sub||"")||
    !/^sess_[A-Za-z0-9]{10,128}$/.test(claims.sid||"")||
    !Number.isSafeInteger(claims.iat)||!Number.isSafeInteger(claims.nbf)||
    !Number.isSafeInteger(claims.exp)||claims.nbf>now+5||
    claims.iat>now+60||claims.exp<=now||
    claims.exp-claims.iat>3600||claims.exp-claims.iat<=0)return null;
 try{
  const key=await verifiedClerkKey(cfg,header.kid,network);
  if(!key)return null;
  const ok=await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,decode64(parts[2]),
     new TextEncoder().encode(parts[0]+"."+parts[1]));
  if(!ok)return null;
 }catch{return null;}
 return {subject:claims.sub,sessionId:claims.sid};
}
export async function clerkIdentityRoute(request,env){
 if(new URL(request.url).pathname!=="/v1/auth/clerk/me")return null;
 if(request.method!=="GET")return reply({error:"Método no permitido"},405);
 // Must be explicitly enabled only in an isolated, pre-approved environment.
 if(env?.CLERK_JWT_ENABLED!=="yes")return reply({error:"Acceso Clerk no habilitado"},503);
 const identity=await verifyClerkJwt(request,env);
 if(!identity)return reply({authenticated:false,error:"Token Clerk inválido"},401);
 if(typeof env.DB?.prepare!=="function")return reply({error:"Base de datos no disponible"},503);
 let row;
 try{
  row=await env.DB.prepare(
    "SELECT p.id,p.name,p.role,p.member_code,p.points,p.lifetime_points,p.visits "+
    "FROM auth_clerk_links l JOIN profiles p ON p.id=l.profile_id "+
    "WHERE l.clerk_user_id=? AND l.link_method='migration_confirmed' LIMIT 1"
  ).bind(identity.subject).first();
 }catch{
  // Missing schema is not a reason to create accounts or bypass mapping.
  return reply({error:"Vinculación todavía no preparada"},503);
 }
 if(!row)return reply({authenticated:false,error:"Identidad sin vinculación verificada"},403);
 // Admin role is only informational; this read-only endpoint cannot open the
 // administration console. The existing BF admin step-up remains mandatory.
 return reply({authenticated:true,profile:row,adminSessionAuthorized:false},200);
}
