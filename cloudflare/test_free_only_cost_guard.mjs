/**
 * Protección de costes Bellaquitas — pruebas 100 % offline, sin cuenta real.
 * Solo prueba el adaptador y simulaciones de R2 y Resend.
 */
import assert from "node:assert/strict";
import {test} from "node:test";
import {
  freeOnlyRequestBoundary,allowSyntheticCostServicesForTests
} from "./qa-candidates/free-only-cost-policy.js";
const ROOT="https://bellaquitas-api-staging.example.test";
const UUID="00000000-0000-4000-8000-000000000071";
const fake=()=>({
  COST_POLICY:"free-only",
  DB:{prepare(){throw Error("D1 no se consulta por un guard de medios");}},
  MEDIA:{
    async get(){throw Error("R2 READ NEVER");},
    async put(){throw Error("R2 WRITE NEVER");},
    async delete(){throw Error("R2 DELETE NEVER");}
  },
  RESEND_API_KEY:"EXTERNAL_FAKE_SECRET",
  RESEND_FROM:"test@example.test",
  R2_MUTATIONS_APPROVED:"yes",
  R2_READS_APPROVED:"yes",
  EMAIL_DELIVERY_APPROVED:"yes",
  EMAIL_REGISTRATION_ENABLED:"yes",
  ADMIN_EMAIL_ACTIVATION_ENABLED:"yes"
});
const check=(env,path,method="GET")=>freeOnlyRequestBoundary(
 new Request(ROOT+path,{method}),env);
test("sin COST_POLICY='free-only' falla antes de consumir cualquier servicio",async()=>{
 const env=fake();delete env.COST_POLICY;
 const result=check(env,"/v1/events");
 assert.equal(result.blocked.status,503);
 assert.equal(result.env,null);
});
test("free-only deja D1 disponible y R2 inaccesible incluso con flags de permiso",()=>{
 const env=fake(),result=check(env,"/v1/events");
 assert.equal(result.blocked,null);
 assert.equal(result.env.DB,env.DB);
 assert.equal(result.env.MEDIA,undefined);
 for(const key of ["RESEND_API_KEY","RESEND_FROM","R2_MUTATIONS_APPROVED",
  "R2_READS_APPROVED","EMAIL_DELIVERY_APPROVED","MAIL_PROVIDER_API_KEY"])
  assert.equal(result.env[key],undefined,key);
 assert.equal(result.env.EMAIL_REGISTRATION_ENABLED,"no");
 assert.equal(result.env.ADMIN_EMAIL_ACTIVATION_ENABLED,"no");
 assert.equal(env.MEDIA.get!==undefined,true,"el test no modifica el objeto de origen");
 assert.throws(()=>{result.env.MEDIA=env.MEDIA;},/política/);
});
test("bloquea todas las lecturas R2 directas y mediadas por el panel",()=>{
 const env=fake();
 const routes=[
  "/v1/assets/logos/"+UUID+".png",
  "/v1/moments/photos/"+UUID,
  "/v1/mirror/admin/media/"+UUID,
  "/administracion/api/photos/"+UUID
 ];
 for(const route of routes){
  const r=check(env,route);
  assert.equal(r.blocked?.status,423,route);
  assert.equal(r.env.MEDIA,undefined,route);
 }
});
test("bloquea todas las subidas R2 sin usar bytes ni la cuenta",()=>{
 const env=fake(),paths=[
   ["PUT","/v1/mirror/admin/media/upload"],
   ["PUT","/administracion/api/upload"],
   ["POST","/v1/admin/moments/"+UUID+"/photo"],
   ["POST","/administracion/api/moments/"+UUID+"/photo"]
 ];
 for(const [method,path] of paths){
  const r=check(env,path,method);
  assert.equal(r.blocked?.status,423,path);
 }
});
test("endpoints gratuitos GET/POST y HTML continúan al siguiente handler",()=>{
 const env=fake();
 for(const [method,path] of [
  ["GET","/espejo/"],["GET","/health"],
  ["GET","/v1/events"],["GET","/administracion/"],
  ["POST","/v1/door/checkin"],["POST","/administracion/api/sso"]
 ]){
  const r=check(env,path,method);
  assert.equal(r.blocked,null,method+" "+path);
  assert.equal(r.env.MEDIA,undefined);
 }
});
test("permiso de ensayo NO puede activarse con una variable de entorno textual",()=>{
 const env=fake();
 assert.throws(()=>allowSyntheticCostServicesForTests(env),/fixtures sintéticos/);
 env.__syntheticMemoryOnly="true";
 assert.throws(()=>allowSyntheticCostServicesForTests(env),/fixtures sintéticos/);
 delete env.COST_POLICY;
 assert.equal(check(env,"/health").blocked?.status,503);
});
test("R2 ficticio en memoria solo se habilita al entregarle una referencia de pruebas",()=>{
 const env=fake();delete env.COST_POLICY;
 env.__syntheticMemoryOnly=true;
 assert.equal(check(env,"/health").blocked?.status,503);
 allowSyntheticCostServicesForTests(env);
 const r=check(env,"/health");
 assert.equal(r.blocked,null);
 assert.equal(r.env.MEDIA,env.MEDIA);
 assert.equal(r.synthetic,true);
});
console.log("Barrera Free-only: no se ha enviado ningún request externo ni consumido R2.");

test("la antigua opción de autenticación queda desactivada en modo gratuito",()=>{
 const env={...fake(),ADMIN_SUPABASE_BRIDGE:"yes"};
 for(const path of ["/health","/v1/events","/v1/auth/google/start",
                     "/administracion/api/sso"]){
  const r=check(env,path);
  assert.equal(r.blocked?.status,503,path);
 }
});
test("Google-D1 y panel admin funcionan sin proveedor antiguo ni R2",()=>{
 const env={...fake(),ADMIN_SSO_ENABLED:"yes"};
 for(const [method,path] of [
  ["GET","/v1/auth/google/start"],["GET","/v1/auth/me"],
  ["POST","/v1/auth/logout"],["POST","/administracion/api/sso"],
  ["GET","/administracion/api/me"]
 ]){
  const r=check(env,path,method);
  assert.equal(r.blocked,null,path);
  assert.equal(r.env.MEDIA,undefined);
  assert.equal(r.env.RESEND_API_KEY,undefined);
 }
});
