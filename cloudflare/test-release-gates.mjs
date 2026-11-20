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
assert.equal(actual.freeOnlyVerified,false,
  'No afirmar facturación gratuita sin permiso de consultar suscripciones');
assert.equal(actual.cpu10msVerified,false,
  'No fingir que rutas KDF y vídeo ya están por debajo de 10ms sin perfil real');
assert.equal(actual.clerkProductionReady,false,
  'Clerk con DNS/Google correcto pero 0 de 7 identidades vinculadas NO autoriza producción');
assert.equal(actual.clerkDnsSafe,true,
  'DMARC Hostinger validado y replicado en zona pending sin alterar los registros originales');
assert.equal(data.phase6ClerkProduction.productionDomainVerified,true);
assert.equal(data.phase6ClerkProduction.googleOauthProductionConfigured,true);
assert.equal(data.phase6ClerkProduction.currentProductionUsers,0);
assert.equal(data.phase6DnsVerification.pendingZoneDnsRecordCount,16);
assert.equal(data.phase6CpuSafety.realClerkJwtAndColdVideo206Profiled,false);

// Cierre del TRABAJO TÉCNICO fase 5 distinto del permiso para publicar.
assert.equal(data.phase5TechnicalHandoff?.status,
 'technical-delivery-complete-production-gates-blocked');
assert.equal(data.phase5TechnicalHandoff?.implementationDelivered,true);
assert.equal(data.phase5TechnicalHandoff?.replicatedTablesExactlyMatched,16);
assert.equal(data.phase5TechnicalHandoff?.backupTables,22);
assert.equal(data.phase5TechnicalHandoff?.backupSqliteIntegrity,'ok');
assert.equal(data.phase5TechnicalHandoff?.recoveryPackageHasPrivateKey,false);
assert.equal(data.phase5TechnicalHandoff?.legacyBackupRekeyed,false);
assert.equal(data.phase5TechnicalHandoff?.newPrivateKeyCustodiedOfflineVerified,false);
assert.equal(data.phase5TechnicalHandoff?.originProviderDeltaCertified,false);
assert.equal(data.phase5TechnicalHandoff?.prepublicationReleaseGatePassed,false,
 'No confundir entrega técnica con habilitación de rutas públicas');
assert.ok(actual.pendingPrepublication.length >= 1,
  'Los bloqueos de respaldo o admins no deben aprobarse sin evidencia');

// En el futuro se permite publicar con verificación física pospuesta,
// siempre que TODOS los controles de integridad y autorización sean reales.
const fake = structuredClone(data);
for (const key of REQUIRED_KEYS) fake.readiness[key].passed = true;
for (const key of DEFERRED_OWNER_CHECKS) fake.readiness[key].passed = false;
fake.productionChangesAuthorized = true;
fake.finalSignoff.explicitProductionAuthorization = true;
// Simular comprobación positiva de factura SOLO en memoria: nunca autorizar el sistema real.
fake.phase6ZeroSpend.zoneFreeVerified = true;
fake.phase6ZeroSpend.workersFreePlanVerified = true;
fake.phase6ZeroSpend.otherPaidProductsAbsentVerified = true;
fake.phase6ZeroSpend.billingAuditComplete = true;
// Datos sintéticos: el test simula la medición; no acredita CPU real de producción.
fake.phase6CpuSafety.realStagingCpuP99Below10ms = true;
fake.phase6CpuSafety.realStagingCpuMaxBelow10ms = true;
fake.phase6CpuSafety.realStagingExceededCpuCountVerifiedZero = true;
// Solo simulación: el release final utiliza JWT de Clerk, NO PBKDF2.
fake.phase6CpuSafety.realClerkJwtAndColdVideo206Profiled = true;
fake.phase6CpuSafety.clerkJwtFreeCpuCompatible = true;
fake.phase6CpuSafety.legacyKdfDisabledInProductionRoutes = true;
// Solo una simulación de cierre Clerk: no modifica credenciales ni cuentas.
fake.phase6DnsVerification.clerkDmarcAddedToPendingZone=true;
fake.phase6DnsVerification.clerkDmarcOriginalPolicyReviewed=true;
fake.phase6DnsVerification.pendingZoneDnsRecordCount=16;
fake.phase6ClerkProduction.productionDomainVerified=true;
fake.phase6ClerkProduction.googleOauthProductionConfigured=true;
fake.phase6ClerkProduction.verifiedGoogleLinks=6;
fake.phase6ClerkProduction.verifiedEmailLinks=1;
fake.phase6ClerkProduction.verifiedD1Links=7;
fake.phase6ClerkProduction.emailRecoveryProvenOnFinalDomain=true;
fake.phase6ClerkProduction.authenticatedAccountsQaPassed=true;
fake.phase6ClerkProduction.adminStepUpQaPassed=true;
fake.phase6ClerkProduction.legacyPasswordKdfRemovedFromAllProductionRoutes=true;
fake.phase6ClerkProduction.jwtVerificationFreeCpuTested=true;

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
// No confundir GitHub QA sintética con migración real de siete cuentas.
for (const [field,value] of [
 ['productionDomainVerified',false],
 ['googleOauthProductionConfigured',false],
 ['verifiedGoogleLinks',5],
 ['verifiedEmailLinks',0],
 ['verifiedD1Links',6],
 ['emailRecoveryProvenOnFinalDomain',false],
 ['authenticatedAccountsQaPassed',false],
 ['adminStepUpQaPassed',false],
 ['legacyPasswordKdfRemovedFromAllProductionRoutes',false],
 ['jwtVerificationFreeCpuTested',false]
]) {
 const blocked=structuredClone(fake);
 blocked.phase6ClerkProduction[field]=value;
 assert.equal(evaluateRelease(blocked).readyForControlledPublication,false,
  'Clerk no puede abrir publicación si falta '+field);
}
for(const field of ['clerkDmarcAddedToPendingZone','clerkDmarcOriginalPolicyReviewed']){
 const blocked=structuredClone(controlledDelegation);
 blocked.phase6DnsVerification[field]=false;
 assert.equal(evaluateRelease(blocked).readyForNameserverDelegation,false,
  'No delegar DNS sin DMARC comprobado: '+field);
}

const noCpu = structuredClone(fake);
noCpu.phase6CpuSafety.realStagingCpuMaxBelow10ms = false;
assert.equal(evaluateRelease(noCpu).readyForControlledPublication,false,
 'Sin medición CPU no publicar, aunque DNS y presupuesto estén aprobados');
const withoutClerkColdTest=structuredClone(fake);
withoutClerkColdTest.phase6CpuSafety.realClerkJwtAndColdVideo206Profiled=false;
assert.equal(evaluateRelease(withoutClerkColdTest).readyForControlledPublication,false,
 "Sin mediciones JWT Clerk y vídeo 206 en frío no publicar en Workers Free");
for(const name of ["clerkJwtFreeCpuCompatible","legacyKdfDisabledInProductionRoutes"]){
 const noProof=structuredClone(fake);
 noProof.phase6CpuSafety[name]=false;
 assert.equal(evaluateRelease(noProof).readyForControlledPublication,false,
  "No abrir sin prueba Clerk Free y KDF cerrado: "+name);
}
const legacyAlreadyDisabled=structuredClone(fake);
legacyAlreadyDisabled.phase6CpuSafety.realPasswordKdfFreeCompatible=false;
legacyAlreadyDisabled.phase6CpuSafety.realPasswordKdfAndVideo206Profiled=false;
assert.equal(evaluateRelease(legacyAlreadyDisabled).readyForControlledPublication,true,
 "El KDF 136 ms desactivado no bloquea Clerk si la nueva CPU está certificada y auth legacy cerrada");
const noCpuForDns=structuredClone(controlledDelegation);
noCpuForDns.phase6CpuSafety.realClerkJwtAndColdVideo206Profiled=false;
assert.equal(evaluateRelease(noCpuForDns).readyForNameserverDelegation,false,
 'Sin CPU de JWT Clerk + vídeo frío no delegar DNS');
const noBudget = structuredClone(fake);
noBudget.phase6ZeroSpend.workersFreePlanVerified = false;
assert.equal(evaluateRelease(noBudget).readyForControlledPublication, false,
  'Jamás publicar con plan Workers no verificado como gratuito');
const noBudgetForDns = structuredClone(controlledDelegation);
noBudgetForDns.phase6ZeroSpend.billingAuditComplete = false;
assert.equal(evaluateRelease(noBudgetForDns).readyForNameserverDelegation, false,
  'No delegar DNS con presupuesto cero sin verificación');
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
