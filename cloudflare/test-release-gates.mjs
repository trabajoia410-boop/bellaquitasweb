#!/usr/bin/env node
/** Bellaquitas Fest — ensayos sintéticos del gate de publicación, sin red. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluateRelease, REQUIRED_KEYS, DEFERRED_OWNER_CHECKS } from './release-policy.mjs';

const data = JSON.parse(readFileSync('cloudflare/release-gates-2026-11-15.json','utf8'));
const actual = evaluateRelease(data);
assert.equal(actual.total, 16);
assert.equal(REQUIRED_KEYS.length, 16);
assert.equal(DEFERRED_OWNER_CHECKS.length, 4);
assert.deepEqual([...new Set(DEFERRED_OWNER_CHECKS)].sort(), [...DEFERRED_OWNER_CHECKS].sort());
assert.equal(data.phase5CoreOriginRestore?.status, 'verified-isolated',
  'La restauración core original no es un respaldo integral de auth');
assert.equal(data.phase5CoreOriginRestore?.changesToProduction, false);
assert.equal(data.productionChangesAuthorized, false,
  'NO cambiar producción automáticamente desde una prueba CI');
assert.equal(actual.readyForControlledPublication, false);
assert.ok(actual.pendingPrepublication.length >= 1,
  'Los bloqueos de respaldo o admins no deben aprobarse sin evidencia');

// En el futuro se permite publicar con verificación física pospuesta,
// siempre que TODOS los controles de integridad y autorización sean reales.
const fake = structuredClone(data);
for (const key of REQUIRED_KEYS) fake.readiness[key].passed = true;
for (const key of DEFERRED_OWNER_CHECKS) fake.readiness[key].passed = false;
fake.productionChangesAuthorized = true;
fake.finalSignoff.explicitProductionAuthorization = true;
// Simulación: solo en un corte real se podrán marcar estas cuatro evidencias.
fake.phase6PreproductionDb.realUsersImported = true;
fake.phase6PreproductionDb.productionWorkerConfigured = true;
fake.phase6PreproductionDb.finalAccountReconciliationCompleted = true;
fake.phase6PreproductionDb.authRoutePreflightPassed = true;
fake.phase6PreproductionDb.visualAssetParityComplete = true;
fake.phase6VisualAssetAudit.repoMissing = false;
fake.phase6VisualAssetAudit.originalBinaryImportedToRepo = true;
fake.phase6VisualAssetAudit.missing = [];
fake.phase6AuthCutoverPreparation.realGoogleClientConfiguredOnTarget=true;
fake.phase6AuthCutoverPreparation.realResendKeyConfiguredOnTarget=true;
fake.phase6AuthCutoverPreparation.realTurnstileConfiguredOnTarget=true;
fake.phase6DnsVerification.zoneStatus='active';
const releaseWithPhysicalQaPending = evaluateRelease(fake);
assert.equal(releaseWithPhysicalQaPending.readyForControlledPublication, true,
  'La QA física no debe impedir una publicación con seguridad previa completa');
assert.equal(releaseWithPhysicalQaPending.fullyVerified, false);
assert.deepEqual(releaseWithPhysicalQaPending.pendingOwnerPostpublication,
  DEFERRED_OWNER_CHECKS);
assert.deepEqual(releaseWithPhysicalQaPending.pendingPrepublication, []);

for (const critical of [
  'productionDatabaseBackupConfirmed',
  'exposedBackupKeyRotatedOutOfChat',
  'originalVideosDeployedToMediaQa',
  'stagingOnlyAccountCutoverPolicyApproved'
]) {
  const blocked = structuredClone(fake);
  blocked.readiness[critical].passed = false;
  assert.equal(evaluateRelease(blocked).readyForControlledPublication, false,
    'Nunca publicar faltando la protección previa: ' + critical);
}
// El JPG original 62609.jpg ya está en GitHub (SHA verificada). La prueba
// de paridad visual se cumple, pero producción sigue bloqueada por otros gates.
assert.equal(actual.visualReady,true);
const noRecoveredBackground=structuredClone(fake);
noRecoveredBackground.phase6VisualAssetAudit.missing=['62609.jpg'];
assert.equal(evaluateRelease(noRecoveredBackground).readyForControlledPublication,false,
 'Prohibido publicar un diseño con el fondo lateral original ausente');
const noVisualState=structuredClone(fake);
noVisualState.phase6PreproductionDb.visualAssetParityComplete=false;
assert.equal(evaluateRelease(noVisualState).readyForControlledPublication,false);
const noBinary=structuredClone(fake);
noBinary.phase6VisualAssetAudit.originalBinaryImportedToRepo=false;
assert.equal(evaluateRelease(noBinary).readyForControlledPublication,false);
// Un proveedor configurado en staging NO basta para publicar el Worker final.
assert.equal(actual.authProvidersReady,false);
assert.equal(actual.dnsReady,false);
for(const prop of ['realGoogleClientConfiguredOnTarget','realResendKeyConfiguredOnTarget','realTurnstileConfiguredOnTarget']){
 const lacking=structuredClone(fake);
 lacking.phase6AuthCutoverPreparation[prop]=false;
 assert.equal(evaluateRelease(lacking).readyForControlledPublication,false,
  'No publicar sin '+prop+' en Cloudflare de producción');
}
const inactiveDns=structuredClone(fake);
inactiveDns.phase6DnsVerification.zoneStatus='pending';
assert.equal(evaluateRelease(inactiveDns).readyForControlledPublication,false,
 'No publicar ni redirigir DNS desde una zona Cloudflare aún pendiente');
// Los logins personales quedan para DESPUÉS, pero la técnica no.
assert.ok(fake.readiness.bothRealAdminLoginsVerified.passed===false);
assert.equal(releaseWithPhysicalQaPending.adminTechnologyReady,true);
const noOAuthProtection=structuredClone(fake);
noOAuthProtection.phase5OAuthCsrfHardening.status='not-verified';
assert.equal(evaluateRelease(noOAuthProtection).readyForControlledPublication,false,
  'Nunca permitir lanzamiento con CSRF OAuth sin verificar');
const noAdminQA=structuredClone(fake);
noAdminQA.phase5AdminRecovery.status='not-tested';
assert.equal(evaluateRelease(noAdminQA).readyForControlledPublication,false,
  'Debe estar listo el flujo de recuperación antes de publicar');

for(const requirement of [
 'realUsersImported','productionWorkerConfigured',
 'finalAccountReconciliationCompleted','authRoutePreflightPassed'
]){
 const notReady=structuredClone(fake);
 notReady.phase6PreproductionDb[requirement]=false;
 assert.equal(evaluateRelease(notReady).readyForControlledPublication,false,
  'No publicar a producción si falta '+requirement);
}
const noConsent = structuredClone(fake);
noConsent.productionChangesAuthorized = false;
assert.equal(evaluateRelease(noConsent).readyForControlledPublication, false);
noConsent.productionChangesAuthorized = true;
noConsent.finalSignoff.explicitProductionAuthorization = false;
assert.equal(evaluateRelease(noConsent).readyForControlledPublication, false);

// No se permite perder una comprobación al ajustar el conjunto de gates.
const removed = structuredClone(fake);
delete removed.readiness.realDeviceQrDoorTest;
assert.throws(() => evaluateRelease(removed));
const forged = structuredClone(fake);
forged.readiness.realDeviceQrDoorTest.evidence = '';
assert.throws(() => evaluateRelease(forged));

console.log('Gates reales:', actual.passed, '/', actual.total,
  'aprobados; seguridad prepublicación pendiente:', actual.pendingPrepublication.length);
console.log('Verificaciones personales diferidas:', actual.pendingOwnerPostpublication.length);
console.log('Pruebas sintéticas del candado: PASS. Producción real: BLOQUEADA.');
