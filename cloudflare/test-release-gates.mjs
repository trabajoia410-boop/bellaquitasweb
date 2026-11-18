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
fake.phase6ReconciliationAudit.originalProviderDeltaCertified = true;
fake.phase6PreproductionDb.authRoutePreflightPassed = true;
fake.phase6PreproductionDb.visualAssetParityComplete = true;
fake.phase6VisualAssetAudit.repoMissing = false;
fake.phase6VisualAssetAudit.originalBinaryImportedToRepo = true;
fake.phase6VisualAssetAudit.missing = [];
fake.phase6AuthCutoverPreparation.realGoogleClientConfiguredOnTarget=true;
fake.phase6AuthCutoverPreparation.realResendKeyConfiguredOnTarget=true;
fake.phase6AuthCutoverPreparation.realGoogleLoginTestedOnCanonicalDomain=true;
fake.phase6AuthCutoverPreparation.realResendDeliveryTestedOnCanonicalDomain=true;
fake.phase6AuthCutoverPreparation.realTurnstileConfiguredOnTarget=true;
fake.phase6DnsVerification.zoneStatus='active';
fake.phase6DnsVerification.registrarNameserversChanged=true;
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
assert.equal(actual.dnsRecordsPrepared,true);
assert.equal(actual.finalOriginDeltaVerified,false);
assert.equal(actual.readyForNameserverDelegation,false,'No alterar DNS sin backup/delta/credenciales/consentimiento');
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
assert.equal(actual.providerBindingsReady,true,
 'Google y Resend existentes deben reconocerse por la Service Binding privada');
assert.equal(actual.liveProvidersReady,false,
 'La existencia del puente NO equivale a login/entrega probados en dominio final');
assert.equal(actual.authProvidersReady,false);
assert.equal(actual.dnsReady,false);
// Variante: reutilizar las claves existentes en staging en vez de pedirlas
// de nuevo. No hay secretos directos en el Worker final.
const bridged=structuredClone(fake);
bridged.phase6AuthCutoverPreparation.realGoogleClientConfiguredOnTarget=false;
bridged.phase6AuthCutoverPreparation.realResendKeyConfiguredOnTarget=false;
bridged.phase6ExistingProviderBridge.realGoogleCallbackTestedOnCanonicalDomain=true;
bridged.phase6ExistingProviderBridge.realResendDeliveryTestedOnCanonicalDomain=true;
assert.equal(evaluateRelease(bridged).providerBindingsReady,true);
assert.equal(evaluateRelease(bridged).readyForControlledPublication,true,
 'La Service Binding con pruebas reales sustituye las claves duplicadas');
const noBridgeLogin=structuredClone(bridged);
noBridgeLogin.phase6ExistingProviderBridge.realGoogleCallbackTestedOnCanonicalDomain=false;
assert.equal(evaluateRelease(noBridgeLogin).readyForControlledPublication,false,
 'Una Service Binding sin OAuth real en dominio final no autoriza publicación');
const noBridgeKey=structuredClone(bridged);
noBridgeKey.phase6ExistingProviderBridge.sharedAuthenticationSecretBoundBothWorkers=false;
assert.equal(evaluateRelease(noBridgeKey).readyForNameserverDelegation,false,
 'No delegar DNS cuando la conexión privada carece de HMAC compartida');
for(const prop of ['realGoogleClientConfiguredOnTarget','realResendKeyConfiguredOnTarget','realTurnstileConfiguredOnTarget']){
 const lacking=structuredClone(fake);
 lacking.phase6AuthCutoverPreparation[prop]=false;
 assert.equal(evaluateRelease(lacking).readyForControlledPublication,false,
  'No publicar sin '+prop+' en Cloudflare de producción');
}
// Una zona PENDIENTE no puede lanzar el Worker, pero después de que estén
// completos respaldo, proveedores, reconciliación y autorización expresa,
// puede delegarse conservando exactamente GitHub Pages y DNS de correo.
const controlledDelegation=structuredClone(fake);
controlledDelegation.phase6DnsVerification.zoneStatus='pending';
controlledDelegation.phase6DnsVerification.registrarNameserversChanged=false;
assert.equal(evaluateRelease(controlledDelegation).readyForNameserverDelegation,true,
 'Permitir delegación segura previa solo con todos los requisitos y firma');
assert.equal(evaluateRelease(controlledDelegation).readyForControlledPublication,false,
 'Una zona pendiente NUNCA permite activar Worker en el dominio');
const missingMX=structuredClone(controlledDelegation);
missingMX.phase6EmailDnsVerification.requiredRecordsInPendingCloudflareZone.MX=false;
assert.equal(evaluateRelease(missingMX).readyForNameserverDelegation,false,
 'No delegar si falta correo de recuperación');
const lostGitHubA=structuredClone(controlledDelegation);
lostGitHubA.phase6DnsVerification.legacyARecordsDnsOnly=3;
assert.equal(evaluateRelease(lostGitHubA).readyForNameserverDelegation,false,
 'No delegar si una IP original de GitHub Pages falta');
const noExternalDelta=structuredClone(fake);
noExternalDelta.phase6ReconciliationAudit.originalProviderDeltaCertified=false;
assert.equal(evaluateRelease(noExternalDelta).readyForControlledPublication,false,
 'Una foto D1 exacta NO sustituye el delta del proveedor original');
assert.equal(evaluateRelease(noExternalDelta).readyForNameserverDelegation,false);
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
