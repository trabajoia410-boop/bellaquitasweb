/**
 * Bellaquitas Fest — transportador privado de proveedores entre dos Workers.
 *
 * Conserva Google Client Secret y RESEND_API_KEY donde ya existen (staging).
 * El Worker nuevo llama por Service Binding; ningún secreto de Google/Resend
 * se devuelve ni se escribe en logs, HTML o repositorio.
 * El endpoint NO confía en el origen de la red: exige HMAC con secreto propio.
 * No usar este módulo para sesiones, puntos, identidades, DB o correo arbitrario.
 */
const ROUTE="/__internal/providers";
const CANONICAL="https://bellaquitas.fr";
const VALID_SUBJECTS=new Set([
 "Confirma tu cuenta Bellaquitas Fest",
 "Recuperar acceso Bellaquitas Fest",
 "Verifica tu correo de administración Bellaquitas Fest"
]);
const HEAD={
 "Content-Type":"application/json; charset=utf-8",
 "Cache-Control":"no-store",
 "X-Robots-Tag":"noindex,nofollow",
 "X-Content-Type-Options":"nosniff",
 "Referrer-Policy":"no-referrer"
};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:HEAD});
const encoder=new TextEncoder();
const base64url=bytes=>btoa(String.fromCharCode(...bytes))
  .replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const decode=value=>{
 if(!/^[A-Za-z0-9_-]{43}$/.test(value||""))return null;
 return Uint8Array.from(atob(value.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0));
};
const secretAvailable=env=>typeof env?.PROVIDER_BROKER_KEY==="string"&&
 env.PROVIDER_BROKER_KEY.length>=43;
const serviceAvailable=env=>secretAvailable(env)&&typeof env.PROVIDER_BROKER?.fetch==="function";
export const providerBrokerAvailable=serviceAvailable;
async function hmacKey(secret){
 return crypto.subtle.importKey("raw",encoder.encode(secret),
  {name:"HMAC",hash:"SHA-256"},false,["sign","verify"]);
}
async function signed(secret,timestamp,body){
 const key=await hmacKey(secret);
 return base64url(new Uint8Array(await crypto.subtle.sign(
  "HMAC",key,encoder.encode(timestamp+"\n"+body))));
}
/** Solo ejecutable sobre la Service Binding, sin URL externa en su camino. */
export async function providerBrokerCall(env,operation,fields={}){
 if(!serviceAvailable(env))throw Error("Private provider service unavailable");
 const payload=JSON.stringify({operation,...fields});
 if(payload.length>6000)throw Error("Provider request too large");
 const timestamp=String(Date.now());
 const signature=await signed(env.PROVIDER_BROKER_KEY,timestamp,payload);
 const response=await env.PROVIDER_BROKER.fetch(new Request(
  "https://bellaquitas-api-staging.bellaquitas-fest-410.workers.dev"+ROUTE,{
   method:"POST",headers:{
    "Content-Type":"application/json",
    "X-BF-Provider-Time":timestamp,
    "X-BF-Provider-Signature":signature
   },body:payload
  }
 ));
 if(!response.ok)throw Error("Private provider operation rejected");
 const data=await response.json();
 if(!data?.ok)throw Error("Private provider operation failed");
 return data;
}
/** Endpoint firmado; solo Worker staging tiene las credenciales de terceros. */
export async function providerBrokerRoute(request,env){
 if(new URL(request.url).pathname!==ROUTE)return null;
 if(request.method!=="POST"||env?.SITE_MODE==="production"||
    env?.SITE_MODE==="preproduction")return json({error:"Not found"},404);
 if(!secretAvailable(env))return json({error:"Unavailable"},503);
 const timestamp=request.headers.get("X-BF-Provider-Time")||"";
 const time=Number(timestamp);
 if(!/^\d{13}$/.test(timestamp)||!Number.isSafeInteger(time)||
    Math.abs(Date.now()-time)>30000)return json({error:"Unauthorized"},401);
 const signature=decode(request.headers.get("X-BF-Provider-Signature"));
 if(!signature)return json({error:"Unauthorized"},401);
 if(!/^application\/json(?:;|$)/i.test(request.headers.get("Content-Type")||""))
  return json({error:"Unauthorized"},401);
 const body=await request.text();
 if(body.length>6000)return json({error:"Unauthorized"},401);
 const key=await hmacKey(env.PROVIDER_BROKER_KEY);
 const accepted=await crypto.subtle.verify("HMAC",key,signature,
  encoder.encode(timestamp+"\n"+body));
 if(!accepted)return json({error:"Unauthorized"},401);
 let args;
 try{args=JSON.parse(body);}catch{return json({error:"Invalid request"},400);}
 if(!args||typeof args!=="object"||Array.isArray(args))
  return json({error:"Invalid request"},400);
 if(args.operation==="google_client_id"){
  if(typeof env.GOOGLE_CLIENT_ID!=="string"||!env.GOOGLE_CLIENT_ID)
   return json({error:"Provider unavailable"},503);
  // El client ID de OAuth es público por definición; NO el Client Secret.
  return json({ok:true,clientId:env.GOOGLE_CLIENT_ID});
 }
 if(args.operation==="google_exchange"){
  if(typeof env.GOOGLE_CLIENT_ID!=="string"||
     typeof env.GOOGLE_CLIENT_SECRET!=="string")
   return json({error:"Provider unavailable"},503);
  if(typeof args.code!=="string"||args.code.length<1||args.code.length>2500||
     typeof args.verifier!=="string"||
     !/^[A-Za-z0-9_-]{43}$/.test(args.verifier)||
     args.redirectUri!==CANONICAL+"/v1/auth/google/callback")
   return json({error:"Invalid exchange"},400);
  const form=new URLSearchParams({
   client_id:env.GOOGLE_CLIENT_ID,
   client_secret:env.GOOGLE_CLIENT_SECRET,
   grant_type:"authorization_code",
   code:args.code,
   code_verifier:args.verifier,
   redirect_uri:args.redirectUri
  });
  const response=await fetch("https://oauth2.googleapis.com/token",{
   method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
   body:form.toString()
  });
  if(!response.ok)return json({error:"Google exchange rejected"},502);
  const data=await response.json();
  if(typeof data.id_token!=="string"||data.id_token.length>10000)
   return json({error:"Google ID token absent"},502);
  return json({ok:true,idToken:data.id_token});
 }
 if(args.operation==="resend_send"){
  if(typeof env.RESEND_API_KEY!=="string"||env.RESEND_API_KEY.length<9)
   return json({error:"Provider unavailable"},503);
  if(typeof args.to!=="string"||args.to.length>254||
     !/^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,63}$/.test(args.to)||
     !VALID_SUBJECTS.has(args.subject)||
     typeof args.message!=="string"||args.message.length<15||
     args.message.length>3000||
     !args.message.includes(CANONICAL+"/"))
   return json({error:"Invalid mail request"},400);
  // Usar exclusivamente el remitente verificado, nunca uno controlado
  // por el usuario; el token de Resend no abandona este Worker.
  const response=await fetch("https://api.resend.com/emails",{
   method:"POST",headers:{
    "Authorization":"Bearer "+env.RESEND_API_KEY,
    "Content-Type":"application/json"
   },body:JSON.stringify({
    from:"no-reply@bellaquitas.fr",to:[args.to],
    subject:args.subject,text:args.message
   })
  });
  if(!response.ok)return json({error:"Resend rejected mail"},502);
  return json({ok:true,sent:true});
 }
 return json({error:"Unsupported provider operation"},400);
}
