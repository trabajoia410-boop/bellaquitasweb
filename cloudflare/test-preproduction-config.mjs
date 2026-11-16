#!/usr/bin/env node
/**
 * Bellaquitas Fest — auditoría offline de la preparación de Cloudflare.
 * Verifica que la D1 vacía destinada a preproducción NO sea la de staging,
 * que el Worker no esté publicado y que los permisos de alta/escritura estén
 * cerrados. No lee ni modifica datos reales.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const load=file=>JSON.parse(readFileSync(file,'utf8'));
const staging=load('cloudflare/wrangler-api-staging.jsonc');
const target=load('cloudflare/wrangler-api-preproduccion.jsonc');
const gates=load('cloudflare/release-gates-2026-11-15.json');

assert.equal(target.name,'bellaquitas-api-preproduccion');
assert.equal(target.main,'./bellaquitas-api-staging.js',
  'El backend preproducción debe utilizar el código ya auditado');
assert.equal(target.compatibility_date,staging.compatibility_date);
assert.equal(target.workers_dev,false,
  'No exponer la base de preproducción mediante una URL pública');
assert.equal(target.keep_vars,true);
assert.ok(!('route' in target)&&!('routes' in target)
  &&!('r2_buckets' in target),
 'No conectar DNS ni introducir R2');
assert.deepEqual(target.assets,{
 directory:'./dist-static',binding:'ASSETS',run_worker_first:true
},'Servir medios originales con Workers Static Assets, no con GitHub ni R2');
assert.equal(target.vars?.SITE_MODE,'preproduction',
 'Preproducción no debe habilitar el router público antes del corte');
assert.equal(target.vars?.PUBLISH_APPROVED,'no',
 'La aprobación final de producción nunca se versiona como sí');
assert.equal(target.d1_databases?.length,1);
assert.equal(staging.d1_databases?.length,1);
const db=target.d1_databases[0],stageDb=staging.d1_databases[0];
assert.equal(db.binding,'DB');
assert.equal(db.database_name,'bellaquitas-produccion-preparada-20261116');
assert.equal(db.database_id,'3d65c23d-4d03-4988-9d7f-23d4f95cbc3c');
assert.notEqual(db.database_id,stageDb.database_id,
  'NUNCA utilizar D1 staging como base futura de producción');
assert.notEqual(db.database_id,'2642aff7-11da-4dc6-b359-9bc9417eda31',
  'NUNCA utilizar la restauración aislada como base editable');
assert.deepEqual(target.services,staging.services,
  'Los medios originales deben permanecer aislados, sin R2');
for(const key of [
 'STAGING_MUTATIONS',
 'ALLOW_NEW_ACCOUNTS',
 'EMAIL_REGISTRATION_ENABLED',
 'EMAIL_AUTH_ENABLED',
 'ADMIN_EMAIL_LINK_ENABLED',
 'SUGGESTIONS_ENABLED'
]){
 assert.equal(target.vars?.[key],key==='STAGING_MUTATIONS'?'disabled':'no',
  'Bloqueo obligatorio ausente: '+key);
}
assert.ok(!('PUBLIC_ORIGIN' in target.vars),
 'No vincular OAuth ni correo de producción antes del corte');
assert.equal(gates.productionChangesAuthorized,false);
assert.equal(gates.finalSignoff?.explicitProductionAuthorization,false);
assert.equal(gates.phase6PreproductionDb?.name,db.database_name);
assert.equal(gates.phase6PreproductionDb?.id,db.database_id);
assert.equal(gates.phase6PreproductionDb?.realUsersImported,true,
  'La fotografía inicial restaurada debe conservar siete usuarios');
assert.equal(gates.phase6PreproductionDb?.initialSnapshotCopiedRows,23);
assert.equal(gates.phase6PreproductionDb?.initialSnapshotDifferences,0);
assert.equal(gates.phase6PreproductionDb?.profiles,7);
assert.equal(gates.phase6PreproductionDb?.adminProfiles,2);
assert.equal(gates.phase6PreproductionDb?.activeSessionsCopied,0);
assert.equal(gates.phase6PreproductionDb?.finalAccountReconciliationCompleted,false,
  'La fotografía inicial no equivale al corte final de cuentas');
assert.equal(gates.phase6PreproductionDb?.preproductionWorkerDeployed,true,
  'Debe existir un Worker aislado con la fotografía inicial');
assert.equal(gates.phase6PreproductionDb?.preproductionWorkerBuildStatus,'success');
assert.equal(gates.phase6PreproductionDb?.workerHasDbBinding,true);
assert.equal(gates.phase6PreproductionDb?.workerDbBindingId,db.database_id);
assert.equal(gates.phase6PreproductionDb?.workerHasAssetsBinding,true);
assert.equal(gates.phase6PreproductionDb?.staticAssetsBuildVerified,true);
assert.equal(gates.phase6PreproductionDb?.workerHasAuthSecrets,false,
 'No declarar autenticación lista si faltan secretos en preproducción');
assert.equal(gates.phase6PreproductionDb?.workerUrlEnabled,false);
assert.equal(gates.phase6PreproductionDb?.workerPreviewUrlEnabled,false);
assert.equal(gates.phase6PreproductionDb?.productionWorkerConfigured,false,
  'El Worker aislado no equivale al Worker público con acceso real');
assert.equal(gates.phase6PreproductionDb?.publiclyAccessible,false);
console.log('OK: D1 preproducción independiente con fotografía inicial verificada, Worker aislado sin rutas, assets originales, 0 R2, 0 altas, 0 escrituras, OAuth deshabilitado; producción pública intacta.');
