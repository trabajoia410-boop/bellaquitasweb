#!/usr/bin/env node
/**
 * Bellaquitas Fest — auditoría estructural de CPU de Workers Free.
 * NO es una medición de tiempo CPU en Cloudflare y no aprueba por sí sola
 * las rutas de KDF (600k iteraciones) ni los rangos MP4 en iOS.
 * Sin claves, DNS, cuentas o peticiones a producción.
 */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {evaluateRelease} from "./release-policy.mjs";
import {emailAuthRoute} from "./email-auth-routes.js";
import {authRoute} from "./auth-routes.js";
import mediaWorker from "./media-qa-worker.js";
import {mirrorRoute} from "./web-mirror.js";

const load = path => JSON.parse(readFileSync(path,"utf8"));
const read = path => readFileSync(path,"utf8");
const files=[
 "cloudflare/wrangler-api-preproduccion.jsonc",
 "cloudflare/wrangler-api-staging.jsonc",
 "cloudflare/wrangler-media-qa.jsonc"
];
for(const file of files){
 const cfg=load(file);
 // Workers Free tiene límite propio de 10 ms. NO subir cpu_ms ni
 // declarar otro modelo de pago en la configuración del proyecto.
 assert.ok(!cfg.limits?.cpu_ms || cfg.limits.cpu_ms <= 10,
  file+": prohibido declarar límite CPU superior a Workers Free");
 assert.ok(!cfg.usage_model || cfg.usage_model!=="unbound",
  file+": prohibido forzar un modelo no auditado");
 for(const k of ["r2_buckets","durable_objects","queues","kv_namespaces",
  "vectorize","ai","images","hyperdrive","browser","workflows",
  "analytics_engine_datasets","mtls_certificates"]){
   assert.ok(!cfg[k] || (Array.isArray(cfg[k]) && cfg[k].length===0),
     file+": prohibido añadir recursos facturables adicionales sin auditoría: "+k);
  }
}
const apiCfg=load(files[0]);
// Workers Cache se limita al Worker QA de medios públicos: jamás a endpoints
// de sesión, correo, QR, puntuación o administración sin auditoría separada.
const mediaCfg=load(files[2]);
assert.equal(mediaCfg.cache?.enabled,true,
 "El cache gratuito debe poder atender Range MP4 desde el edge sin ejecutar JS");
assert.equal(mediaCfg.assets?.run_worker_first,true,
 "Si el cache falla, mantener adaptador HTTP 206 para Safari/iPhone");
assert.ok(apiCfg.cache?.enabled!==true,
 "El Worker que contiene autenticación y D1 no debe tener cache global");
assert.equal(apiCfg.vars?.PUBLISH_APPROVED,"no");
assert.equal(apiCfg.vars?.BACKUP_KEY_CUSTODIED,"no");
assert.equal(apiCfg.vars?.FREE_TIER_BILLING_VERIFIED,"no");
assert.equal(apiCfg.vars?.FREE_TIER_CPU_VERIFIED,"no");
assert.equal(apiCfg.vars?.SITE_MODE,"preproduction");
assert.equal(apiCfg.workers_dev,false);

const router=read("cloudflare/bellaquitas-api-staging.js");
assert.ok(router.indexOf("productionAccessGate(request,env)") <
  router.indexOf("productionSiteRoute(request,env)"),
  "No se permite omitir seguridad antes de usar caché de portada");
const mirror=read("cloudflare/web-mirror.js");
assert.match(mirror,/let cachedMirrorHtml = null;/);
assert.match(mirror,/let cachedMirrorJs = null;/);
assert.match(mirror,/cachedMirrorHtml\?\?/);
assert.match(mirror,/cachedMirrorJs\?\?/);
const site=read("cloudflare/production-site-route.js");
assert.match(site,/let cachedPublicHtml=null;/);
assert.match(site,/let cachedPublicHeaders=null;/);
assert.match(site,/cachedPublicHtml=html;/);
assert.match(site,/if\(page&&cachedPublicHtml!==null\)/);
const media=read("cloudflare/media-qa-worker.js");
assert.match(media,/streamByteRange\(response\.body,range\.start,range\.end\)/);
assert.ok(!media.includes("new Uint8Array(await response.arrayBuffer())"),
 "No cargar vídeos completos en memoria para procesar un Range 206");
const email=read("cloudflare/email-auth-routes.js");
assert.match(email,/const ITERATIONS=600000;/);
assert.match(email,/for\(let phase=0;phase<6;phase\+\+\)/);
assert.match(email,/iterations:100000/);

// En producción los endpoints heredados nunca pueden ejecutar PBKDF2,
 // aunque una variable antigua active por error EMAIL_AUTH_ENABLED.
 // La simulación prohíbe cualquier acceso a D1 y no envía contraseñas.
 const expensiveRoutes=[
  "/v1/auth/email/register","/v1/auth/email/login",
  "/v1/auth/email/reset","/v1/auth/email/forgot",
  "/v1/auth/admin/email/link/start","/v1/auth/admin/email/link/confirm"
 ];
 const blockedEnv={SITE_MODE:"production",EMAIL_AUTH_ENABLED:"yes",
  EMAIL_REGISTRATION_ENABLED:"yes",ADMIN_EMAIL_LINK_ENABLED:"yes",
  DB:{prepare(){throw Error("KDF/SQL heredados NO autorizados");}}};
 for(const route of expensiveRoutes){
  const request=new Request("https://bellaquitas.fr"+route,{
   method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({email:"test@example.invalid",password:"SYNTHETIC_ONLY"})});
  const result=await emailAuthRoute(request,blockedEnv);
  assert.equal(result.status,410,route+": no se permite KDF en producción");
  assert.equal(result.headers.get("Set-Cookie"),null);
 }
 assert.equal((await emailAuthRoute(new Request(
  "https://bellaquitas.fr/v1/auth/email/status"),blockedEnv)).status,200);
 for(const route of ["/v1/auth/google/start","/v1/auth/google/callback"]){
  const result=await authRoute(new Request("https://bellaquitas.fr"+route),
   blockedEnv);
  assert.equal(result.status,410,
   "No reactivar el inicio Google directo fuera de Clerk");
 }
 assert.equal(apiCfg.vars?.CLERK_ADMIN_STEPUP_ENABLED,"no",
  "Reverificación gratuita de administradores aún NO activada");

// Solo rutas publicas media son cacheables (200); 206 de respaldo conserva
// compatibilidad Safari si el Workers Cache todavia no esta en el edge.
const bytes=Uint8Array.from({length:128},(_,i)=>i);
let lastAssetRequest=null;
const mediaEnv={ASSETS:{async fetch(r){
 lastAssetRequest=r;
 return new Response(bytes,{status:200,headers:{
  "Content-Type":"video/mp4","Content-Length":String(bytes.byteLength)
 }});
}}};
const base="https://qa.invalid/assets/bellaquitas%20fiesta%20portada.mp4";
const publicMedia=await mediaWorker.fetch(new Request(base),mediaEnv);
assert.equal(publicMedia.status,200);
assert.match(publicMedia.headers.get("Cache-Control")||"",/public,max-age=/);
assert.equal(publicMedia.headers.get("Set-Cookie"),null);
assert.equal(publicMedia.headers.get("Content-Type"),"video/mp4");
const range=await mediaWorker.fetch(new Request(base,{
 headers:{Range:"bytes=7-17"}
}),mediaEnv);
assert.equal(range.status,206);
assert.equal(range.headers.get("Content-Range"),"bytes 7-17/25437525");
assert.equal(range.headers.get("Content-Length"),"11");
assert.equal(lastAssetRequest.headers.get("Range"),null,
 "No reenviar Range a ASSETS si ignora fragmentos");
assert.deepEqual(new Uint8Array(await range.arrayBuffer()),bytes.slice(7,18));
const health=await mediaWorker.fetch(new Request("https://qa.invalid/health"),mediaEnv);
assert.equal(health.headers.get("Cache-Control"),"no-store");
const hidden=await mediaWorker.fetch(new Request("https://qa.invalid/v1/auth/me"),mediaEnv);
assert.equal(hidden.status,404);
assert.equal(hidden.headers.get("Cache-Control"),"no-store");

// Los MP4 públicos de staging usan el Service Binding multimedia; no se
// vuelven a recortar desde la API con permisos sobre D1. Las cookies no viajan.
const qaHost="https://bellaquitas-api-staging.bellaquitas-fest-410.workers.dev";
const videoPath="/espejo/assets/bellaquitas%20fiesta%20portada.mp4";
let mediaServiceCalls=0,assetsDirectCalls=0,requestSeen=null;
const proxyEnv={
 SITE_MODE:"staging",STAGING_MUTATIONS:"disabled",ALLOW_NEW_ACCOUNTS:"no",
 ASSETS:{async fetch(){assetsDirectCalls++;return new Response(null,{status:503});}},
 VIDEO_QA_PROXY:{async fetch(req){
   mediaServiceCalls++;requestSeen=req;
   const selected=req.headers.get("Range");
   const eof=selected==="bytes=25437514-25437524";
   assert.ok(eof||selected==="bytes=0-10",
     "No se pueden pedir rangos de vídeo no previstos en esta prueba");
   const body=eof?Uint8Array.from({length:11},(_,i)=>255-i):bytes.slice(0,11);
   return new Response(body,{status:206,headers:{
     "Content-Range":selected.replace("bytes=","bytes ") + "/25437525",
     "Content-Length":"11",
     "Content-Type":"video/mp4",
     "Set-Cookie":"LEAK-SYNTHETIC=forbidden; Path=/",
     "Cache-Control":"no-store"
   }});
 }}
};
const videoFromApi=await mirrorRoute(new Request(qaHost+videoPath,{
 headers:{Range:"bytes=0-10",Cookie:"private=synthetic",
 Authorization:"Bearer synthetic"}
}),proxyEnv);
assert.equal(videoFromApi.status,206,
 "Safari conserva 206 por Service Binding multimedia");
assert.equal(videoFromApi.headers.get("Set-Cookie"),null,
 "No publicar ni guardar una cookie de un Worker multimedia");
assert.equal(videoFromApi.headers.get("Cache-Control"),"public,max-age=86400",
 "Solo medios públicos originales y sin cookies pueden almacenarse en navegador");
assert.deepEqual(new Uint8Array(await videoFromApi.arrayBuffer()),bytes.slice(0,11));
assert.equal(mediaServiceCalls,1);
assert.equal(assetsDirectCalls,0,
 "La API staging no debe escanear MP4 si existe un proxy cacheable");
assert.equal(requestSeen.headers.get("Range"),"bytes=0-10");
assert.equal(requestSeen.headers.get("Cookie"),null);
assert.equal(requestSeen.headers.get("Authorization"),null);

// Regresión del coste: cerca del EOF no permitir escanear >25 MB desde
// la API con las identidades y la base D1. Solo un GET interno multimedia.
const eofRange="bytes=25437514-25437524";
const eof=await mirrorRoute(new Request(qaHost+videoPath,{
 headers:{Range:eofRange,Cookie:"member=synthetic",
 Authorization:"Bearer private-synthetic"}
}),proxyEnv);
assert.equal(eof.status,206);
assert.equal(eof.headers.get("Content-Range"),"bytes 25437514-25437524/25437525");
assert.equal(eof.headers.get("Content-Length"),"11");
assert.deepEqual(new Uint8Array(await eof.arrayBuffer()),
 Uint8Array.from({length:11},(_,i)=>255-i));
assert.equal(mediaServiceCalls,2);
assert.equal(assetsDirectCalls,0,
 "La API no puede escanear el vídeo hasta el final para responder 206");
assert.equal(requestSeen.headers.get("Range"),eofRange);
assert.equal(requestSeen.headers.get("Cookie"),null);
assert.equal(requestSeen.headers.get("Authorization"),null);

const gates=load("cloudflare/release-gates-2026-11-15.json");
assert.equal(gates.phase6CpuSafety?.freeWorkersCpuLimitMs,10);
assert.equal(gates.phase6CpuSafety?.realStagingCpuP99Below10ms,false);
assert.equal(gates.phase6CpuSafety?.realStagingCpuMaxBelow10ms,false);
assert.equal(gates.phase6CpuSafety?.realStagingExceededCpuCountVerifiedZero,false);
assert.equal(gates.phase6CpuSafety?.realPasswordKdfAndVideo206Profiled,false);
assert.equal(gates.phase6CpuSafety?.realPasswordKdfFreeCompatible,false);
assert.ok(gates.phase6CpuSafety?.remoteSyntheticKdfProfile?.maxObservedCpuMs > 10,
 "La medición REAL de KDF por Cloudflare supera los 10ms de Workers Free");
assert.equal(gates.phase6CpuSafety?.remoteSyntheticKdfProfile?.cleanup?.workerDeleted,true,
 "El Worker de prueba temporal no debe quedar activo");
const status=evaluateRelease(gates);
assert.equal(status.cpu10msVerified,false);
assert.equal(status.readyForNameserverDelegation,false);
assert.equal(status.readyForControlledPublication,false);

console.log("OK: Workers Free 10ms por diseño, caché estática, streaming Range, KDF intacto y puertas CPU cerradas. Perfil KDF real demuestra CPU demasiado alta; publicación bloqueada.");
