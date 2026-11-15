#!/usr/bin/env node
/**
 * Bellaquitas Fest — bloqueo explícito de corte a producción.
 * Fuente de estado manual auditable, sin escrituras ni llamadas a servicios.
 * Las pruebas verdes NO autorizan DNS ni migración si existen bloqueos.
 */
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const mode=process.argv.slice(2);
assert.ok(mode.every(x=>['--require-release','--assert-blocked'].includes(x)),'Argumentos desconocidos');
assert.ok(!mode.includes('--require-release')||!mode.includes('--assert-blocked'),'Elige una sola comprobación');
const gates=JSON.parse(readFileSync('cloudflare/release-gates-2026-11-15.json','utf8'));
assert.equal(gates.productionDomain,'bellaquitas.fr');
const REQUIRED_KEYS=[
 'baselineDbAndRolesReviewed',
 'isolatedQrAndLoyaltyTests',
 'mediaAssetBytesVerifiedInGit',
 'originalThreeLogosRecovered',
 'originalVideosDeployedToMediaQa',
 'realHttp206AndIosAndroidPlayback',
 'bothRealAdminLoginsVerified',
 'productionDatabaseBackupConfirmed',
 'exposedBackupKeyRotatedOutOfChat',
 'cloudflareExtraProfileReviewed',
 'realDeviceQrDoorTest',
 'finalEsFrMobileVisualParity',
 'googleIdentityMappingExact',
 'stagingAdminStepupSchemaApplied',
 'stagingPostadminRestoreVerified',
 'stagingOnlyAccountCutoverPolicyApproved'
];
assert.deepEqual(Object.keys(gates.readiness).sort(),[...REQUIRED_KEYS].sort(),
 'No añadir ni eliminar condiciones de publicación sin revisión del checklist');
const items=Object.entries(gates.readiness);
assert.equal(items.length,16,'No deben borrarse bloqueos en silencio');
for(const [key,item] of items){
 assert.equal(typeof item.passed,'boolean',key);
 assert.ok(typeof item.evidence==='string'&&item.evidence.length>20,'Se requiere evidencia: '+key);
}
const pending=items.filter(([,x])=>!x.passed);
const ready=!!gates.productionChangesAuthorized&&pending.length===0;
console.log(JSON.stringify({
 production:'bellaquitas.fr',ready,authorized:gates.productionChangesAuthorized,
 passed:items.length-pending.length,pending:pending.map(([key])=>key),
 safeToDeployMediaQa:true,safeToChangeDns:ready
},null,2));
if(mode.includes('--require-release')&&!ready){
 console.error('BLOQUEADO: faltan pruebas de producción o autorización. No cambiar DNS, usuarios ni puntos.');
 process.exitCode=1;
}
if(mode.includes('--assert-blocked')){
 assert.equal(ready,false,'No se debe habilitar producción sin una revisión del gate y aprobación explícita');
 assert.ok(pending.length>=1,'No se esperaban todos los bloqueos resueltos todavía');
 console.log('OK: producción protegida; los ensayos aislados pueden continuar.');
}
