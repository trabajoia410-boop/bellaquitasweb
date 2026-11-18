#!/usr/bin/env node
/** Tests SOLO sintéticos: sin Google, Resend, usuarios reales ni D1. */
import assert from "node:assert/strict";
import {providerBrokerAvailable,providerBrokerCall,providerBrokerRoute} from "./provider-broker.js";
const oldFetch=globalThis.fetch;
const secret="a".repeat(64);
const staging={
 PROVIDER_BROKER_KEY:secret,GOOGLE_CLIENT_ID:"google-public-client-id.apps.googleusercontent.com",
 GOOGLE_CLIENT_SECRET:"mock-google-secret-NEVER-RETURN",RESEND_API_KEY:"mock-resend-secret-NEVER-RETURN"
};
const env={PROVIDER_BROKER_ENABLED:"yes",PROVIDER_BROKER_KEY:secret,
 PROVIDER_BROKER:{fetch:r=>providerBrokerRoute(r,staging)}};
assert.equal(providerBrokerAvailable(env),true);
assert.equal(providerBrokerAvailable({...env,PROVIDER_BROKER_KEY:""}),false);
assert.rejects(()=>providerBrokerCall({...env,PROVIDER_BROKER_KEY:""},"google_client_id"));
// La ruta pública no permite leer el ID ni consumir recursos sin HMAC.
const publicReq=new Request("https://bellaquitas-api-staging.example/__internal/providers",{
 method:"POST",headers:{"Content-Type":"application/json"},
 body:JSON.stringify({operation:"google_client_id"})
});
assert.equal((await providerBrokerRoute(publicReq,staging)).status,401);
assert.equal((await providerBrokerRoute(publicReq,{...staging,SITE_MODE:"production"})).status,404);
assert.equal((await providerBrokerRoute(publicReq,{...staging,SITE_MODE:"preproduction"})).status,404);
assert.equal((await providerBrokerRoute(new Request("https://bellaquitas-api-staging.example/__internal/providers"),staging)).status,404);
assert.equal(await providerBrokerRoute(new Request("https://bellaquitas-api-staging.example/v1/events"),staging),null);
const id=await providerBrokerCall(env,"google_client_id");
assert.equal(id.clientId,staging.GOOGLE_CLIENT_ID);
assert.equal(JSON.stringify(id).includes("NEVER-RETURN"),false);
await assert.rejects(()=>providerBrokerCall({...env,PROVIDER_BROKER_KEY:"b".repeat(64)},"google_client_id"));
const seen={google:0,email:0};
globalThis.fetch=async(request,options)=>{
 const url=String(request);
 if(url==="https://oauth2.googleapis.com/token"){
  seen.google++;
  const params=new URLSearchParams(options.body);
  assert.equal(params.get("client_id"),staging.GOOGLE_CLIENT_ID);
  assert.equal(params.get("client_secret"),staging.GOOGLE_CLIENT_SECRET);
  assert.equal(params.get("code_verifier"),"v".repeat(43));
  assert.equal(params.get("redirect_uri"),"https://bellaquitas.fr/v1/auth/google/callback");
  return new Response(JSON.stringify({id_token:"test.verified.jwt",access_token:"DO-NOT-RELAY"}),{
   status:200,headers:{"Content-Type":"application/json"}
  });
 }
 if(url==="https://api.resend.com/emails"){
  seen.email++;
  assert.equal(options.headers.Authorization,"Bearer "+staging.RESEND_API_KEY);
  const body=JSON.parse(options.body);
  assert.equal(body.from,"no-reply@bellaquitas.fr");
  assert.deepEqual(body.to,["qa@example.test"]);
  assert.equal(body.subject,"Recuperar acceso Bellaquitas Fest");
  return new Response(JSON.stringify({id:"fake-email"}),{status:200});
 }
 throw Error("Unexpected network request");
};
try{
 const exchange=await providerBrokerCall(env,"google_exchange",{
  code:"synthetic-code",verifier:"v".repeat(43),
  redirectUri:"https://bellaquitas.fr/v1/auth/google/callback"
 });
 assert.equal(exchange.idToken,"test.verified.jwt");
 assert.equal(JSON.stringify(exchange).includes("DO-NOT-RELAY"),false);
 await assert.rejects(()=>providerBrokerCall(env,"google_exchange",{
  code:"synthetic-code",verifier:"v".repeat(43),
  redirectUri:"https://bellaquitas-api-staging.example/v1/auth/google/callback"
 }));
 const sent=await providerBrokerCall(env,"resend_send",{
  to:"qa@example.test",subject:"Recuperar acceso Bellaquitas Fest",
  message:"Enlace sintético de recuperación https://bellaquitas.fr/?reset_token=EXAMPLE"
 });
 assert.equal(sent.sent,true);
 await assert.rejects(()=>providerBrokerCall(env,"resend_send",{
  to:"qa@example.test",subject:"Correo arbitrario fuera de Bellaquitas",
  message:"Enlace sintético https://bellaquitas.fr/"
 }));
 await assert.rejects(()=>providerBrokerCall(env,"resend_send",{
  to:"qa@example.test",subject:"Recuperar acceso Bellaquitas Fest",
  message:"Enlace malicioso https://phishing.example/"
 }));
 assert.deepEqual(seen,{google:1,email:1});
}finally{globalThis.fetch=oldFetch}
console.log("PASS: RPC HMAC entre Workers, cliente Google público, intercambio restringido, Resend con remitente fijo y cero claves devueltas.");
