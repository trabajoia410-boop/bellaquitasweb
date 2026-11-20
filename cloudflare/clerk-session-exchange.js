/**
 * Clerk -> Bellaquitas BF HttpOnly session cutover. Explicitly disabled in
 * staging and preproduction by default. Never create a profile or modify
 * points, visits or roles. The old Google subject->profile mapping remains.
 */
import {verifyClerkJwt} from "./clerk-auth-bridge.js";
import {createAuthSession} from "./auth-routes.js";
const HEAD={"Cache-Control":"no-store","Content-Type":"application/json; charset=utf-8","X-Robots-Tag":"noindex,nofollow","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff"};
const json=(payload,status=200,extra={})=>new Response(JSON.stringify(payload),{status,headers:{...HEAD,...extra}});
export async function clerkSessionExchange(request,env){
 if(new URL(request.url).pathname!=="/v1/auth/clerk/exchange")return null;
 if(request.method!=="POST")return json({error:"Método no permitido"},405);
 if(env?.CLERK_JWT_ENABLED!=="yes"||env.CLERK_EXCHANGE_ENABLED!=="yes")
   return json({error:"Vinculación Clerk desactivada"},503);
 const url=new URL(request.url);
 if(url.origin!==env.CLERK_ALLOWED_ORIGIN||
    request.headers.get("Origin")!==env.CLERK_ALLOWED_ORIGIN||
    (request.headers.get("Sec-Fetch-Site")&&request.headers.get("Sec-Fetch-Site")!=="same-origin"))
   return json({error:"Origen no autorizado"},403);
 const jwt=await verifyClerkJwt(request,env);
 if(!jwt)return json({error:"Identidad Clerk inválida"},401);
 if(typeof env.DB?.prepare!=="function")return json({error:"Base de datos no disponible"},503);
 let record;
 try{
  record=await env.DB.prepare(
    "SELECT p.id,p.role FROM auth_clerk_links l "+
    "JOIN profiles p ON p.id=l.profile_id "+
    "WHERE l.clerk_user_id=? AND l.link_method='migration_confirmed' LIMIT 1"
  ).bind(jwt.subject).first();
 }catch{return json({error:"Migración todavía no disponible"},503);}
 if(!record)return json({error:"Vinculación no verificada"},403);
 // App session uses existing BF server-side cookie; this does NOT create an
 // admin step-up cookie. /v1/admin/session and privileged mutations still
 // require a separate verified admin reauthentication.
 try{
  const cookie=await createAuthSession(record.id,env);
  const headers=new Headers(HEAD);headers.append("Set-Cookie",cookie);
  return new Response(JSON.stringify({authenticated:true,adminStepUpRequired:record.role==="admin"}),{status:200,headers});
 }catch{return json({error:"No fue posible crear sesión"},503);}
}
