#!/usr/bin/env node
/*
 * No Cloudflare API, no tokens, no usuarios: esta prueba solo consulta
 * un Workerd local (127.0.0.1), con password y salt sintéticos.
 * No certificar 10ms de CPU a partir del wall time medido aquí.
 */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const origin="http://127.0.0.1:8797";
const config=JSON.parse(readFileSync("cloudflare/wrangler-kdf-local-only.jsonc","utf8"));
assert.equal(config.name,"bellaquitas-kdf-local-only");
assert.equal(config.workers_dev,false);
assert.deepEqual(config.vars,{KDF_QA_LOCAL_ONLY:"yes"});
assert.ok(!("d1_databases" in config)&&!("services" in config)
 &&!("r2_buckets" in config)&&!("kv_namespaces" in config)
 &&!("routes" in config)&&!("route" in config)
 &&!("assets" in config),"El benchmark jamás usa secretos, D1, dominios ni medios");
const source=readFileSync("cloudflare/email-auth-routes.js","utf8");
assert.match(source,/export async function passwordHash\(/);
assert.match(source,/const ITERATIONS=600000;/);
assert.match(source,/for\(let phase=0;phase<6;phase\+\+\)/);
assert.match(source,/iterations:100000/);
const endpoint=origin+"/__kdf_synthetic_only";
async function send(method,headers={}){
 return fetch(endpoint,{method,headers,redirect:"manual",signal:AbortSignal.timeout(45000)});
}
assert.equal((await send("GET")).status,405,"No permitir GET caro");
assert.equal((await send("POST")).status,403,"Rechazar uso sin autorización local");
assert.equal((await fetch(origin+"/v1/auth/email/login")).status,404,
 "Un benchmark no debe alojar API ni autenticación");
const started=process.hrtime.bigint();
const response=await send("POST",{"X-Bellaquitas-Local-KDF":"synthetic-only"});
const elapsed=Math.round(Number(process.hrtime.bigint()-started)/1e6);
const raw=await response.text();
let result;try{result=JSON.parse(raw)}catch{result=null}
if(response.status===200){
 assert.equal(result?.ok,true,"El algoritmo real debe conservar el vector sintético");
 assert.equal(result?.rounds,6);
 assert.equal(result?.iterationsPerRound,100000);
 assert.equal(result?.cloudflareCpuCertified,false);
 assert.equal(result?.advisoryOnly,true);
 console.log(JSON.stringify({test:"WORKERD_LOCAL_ONLY",status:"VECTOR_CORRECT",
   totalWallMs:elapsed,insideLocalRuntimeMs:result.elapsedWorkerdLocalMs,
   credentialSource:"synthetic",cloudflareCpuCertified:false,
   phase6CpuGate:"BLOCKED_PENDING_REAL_CLOUD_CPU_PROFILING"}));
}else{
 // Un 1102/exceso de CPU indica INCOMPATIBILIDAD con Workers Free,
 // no justifica relajar la contraseña. Otros errores sí rompen CI.
 const limited=/exceeded resource limits|cpu time limit|error 1102/i.test(raw);
 assert.equal(limited,true,
  "El Workerd local falló sin evidencia de límite CPU. HTTP "+response.status+
  ": "+raw.slice(0,160));
 console.log(JSON.stringify({test:"WORKERD_LOCAL_ONLY",status:"CPU_LIMIT_EXCEEDED",
  httpStatus:response.status,totalWallMs:elapsed,cloudflareCpuCertified:false,
  phase6CpuGate:"BLOCKED"}));
}
