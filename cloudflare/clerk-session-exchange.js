/**
 * Clerk -> Bellaquitas BF HttpOnly session cutover. Explicitly disabled in
 * staging and preproduction by default. Never create a profile or modify
 * points, visits or roles. The old Google subject->profile mapping remains.
 */
import {verifyClerkJwt} from "./clerk-auth-bridge.js";
import {createAuthSession,createVerifiedAdminSession,authenticatedProfile} from "./auth-routes.js";
const HEAD={"Cache-Control":"no-store","Content-Type":"application/json; charset=utf-8","X-Robots-Tag":"noindex,nofollow","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff"};
const json=(payload,status=200,extra={})=>new Response(JSON.stringify(payload),{status,headers:{...HEAD,...extra}});
// The Clerk session lifetime configured for this application is 7 days.
// This short BF bridge cookie expires within 12h even for a normal member.
// A fresh Clerk JWT is needed to exchange again; admin step-up is independent.
const CLERK_BF_SESSION_SECONDS=12*60*60;
export async function clerkSessionExchange(request,env){
 const url=new URL(request.url),path=url.pathname;
 const isAdminStepUp=path==="/v1/auth/clerk/admin/step-up";
 if(path!=="/v1/auth/clerk/exchange"&&!isAdminStepUp)return null;
 if(request.method!=="POST")return json({error:"Método no permitido"},405);
 if(env?.CLERK_JWT_ENABLED!=="yes"||env.CLERK_EXCHANGE_ENABLED!=="yes"||
    (isAdminStepUp&&env.CLERK_ADMIN_STEPUP_ENABLED!=="yes"))
   return json({error:"Vinculación Clerk desactivada"},503);
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
 if(isAdminStepUp){
  // MFA real y reciente, NO simple token iat fresco: Clerk renueva JWT cada
  // minuto aunque el usuario no vuelva a verificar ninguna credencial.
  const fva=jwt.factorVerificationAge;
  if(!Array.isArray(fva)||fva.length!==2||
     !fva.every(age=>Number.isSafeInteger(age)&&age>=0&&age<=5))
   return json({error:"Reautenticación MFA necesaria"},403);
  if(record.role!=="admin")
   return json({error:"Acceso reservado a administradores"},403);
  let current;
  try{current=await authenticatedProfile(request,env);}
  catch{return json({error:"Sesión Bellaquitas no disponible"},503);}
  if(!current||current.id!==record.id||current.role!=="admin")
   return json({error:"La sesión no coincide con el administrador"},403);
  // La creación de una nueva sesión admin revoca la anterior en el
  // navegador al reemplazar ambas cookies; NO modifica roles ni puntos.
  try{
   const cookies=await createVerifiedAdminSession(record.id,env);
   const headers=new Headers(HEAD);
   for(const cookie of cookies)headers.append("Set-Cookie",cookie);
   return new Response(JSON.stringify({authorized:true,stepUp:true}),
    {status:200,headers});
  }catch{return json({error:"Reautenticación no disponible"},503);}
 }
 // App session uses existing BF server-side cookie; this does NOT create an
 // admin step-up cookie. /v1/admin/session and privileged mutations still
 // require a separate verified admin reauthentication.
 try{
  const cookie=await createAuthSession(record.id,env,{maxAgeSeconds:CLERK_BF_SESSION_SECONDS});
  const headers=new Headers(HEAD);headers.append("Set-Cookie",cookie);
  return new Response(JSON.stringify({authenticated:true,adminStepUpRequired:record.role==="admin"}),{status:200,headers});
 }catch{return json({error:"No fue posible crear sesión"},503);}
}
