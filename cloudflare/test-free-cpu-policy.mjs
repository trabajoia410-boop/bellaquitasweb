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
 assert.ok(!cfg.r2_buckets && !cfg.durable_objects && !cfg.queues,
  file+": no introducir recursos adicionales de pago");
}
const apiCfg=load(files[0]);
assert.equal(apiCfg.vars?.PUBLISH_APPROVED,"no");
assert.equal(apiCfg.vars?.BACKUP_KEY_CUSTODIED,"no");
assert.equal(apiCfg.vars?.FREE_TIER_BILLING_VERIFIED,"no");
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

const gates=load("cloudflare/release-gates-2026-11-15.json");
assert.equal(gates.phase6CpuSafety?.freeWorkersCpuLimitMs,10);
assert.equal(gates.phase6CpuSafety?.realStagingCpuP99Below10ms,false);
assert.equal(gates.phase6CpuSafety?.realStagingCpuMaxBelow10ms,false);
assert.equal(gates.phase6CpuSafety?.realStagingExceededCpuCountVerifiedZero,false);
assert.equal(gates.phase6CpuSafety?.realPasswordKdfAndVideo206Profiled,false);
const status=evaluateRelease(gates);
assert.equal(status.cpu10msVerified,false);
assert.equal(status.readyForNameserverDelegation,false);
assert.equal(status.readyForControlledPublication,false);

console.log("OK: Workers Free 10ms por diseño, caché estática, streaming Range, KDF intacto y puertas CPU cerradas. Profiling real pendiente.");
