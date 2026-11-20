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
assert.equal(target.vars?.FINAL_ORIGIN_RECONCILED,'no',
 'No certificar datos nuevos del origen sin comparar el proveedor anterior');
assert.equal(target.vars?.BACKUP_KEY_CUSTODIED,'no',
 'No declarar custodia offline sin prueba del propietario');
assert.equal(target.vars?.FREE_TIER_BILLING_VERIFIED,'no',
 'No publicar sin acreditar que Workers y servicios vinculados siguen en plan gratuito');
assert.equal(target.vars?.FREE_TIER_CPU_VERIFIED,'no',
 'No publicar sin perfil CPU real de contraseña y streaming dentro de Workers Free');
assert.equal(target.vars?.CLERK_JWT_ENABLED,'no',
 'Clerk no puede utilizar cuentas ni puntos hasta verificar vínculos y migración');
assert.equal(target.vars?.CLERK_EXCHANGE_ENABLED,'no');

const clerkProdPlan=load('cloudflare/clerk-production-dns-plan.json');
assert.equal(clerkProdPlan.canonical_origin,'https://bellaquitas.fr');
assert.equal(clerkProdPlan.clerk_issuer,'https://clerk.bellaquitas.fr');
assert.equal(target.vars?.CLERK_ISSUER,clerkProdPlan.clerk_issuer,
  'No aceptar un issuer Clerk arbitrario o de desarrollo en preproducción');
assert.equal(target.vars?.CLERK_ALLOWED_ORIGIN,clerkProdPlan.canonical_origin,
  'La audiencia/origen Clerk debe ser el dominio canónico');
assert.equal(clerkProdPlan.clerk_signup_mode,'restricted',
  'No abrir nuevas inscripciones antes de conciliar perfiles');
assert.equal(clerkProdPlan.production_users_created,0,
  'Los perfiles anteriores no se deben replicar por email');
assert.equal(clerkProdPlan.dns_not_modified,true,
  'No marcar como aplicados los cambios DNS todavía');
assert.equal(clerkProdPlan.records.length,6);
assert.ok(clerkProdPlan.records.some(r=>r.type==='CNAME' &&
  r.name==='clerk.bellaquitas.fr' && r.target==='frontend-api.clerk.services' &&
  r.proxied===false), 'No activar proxy para CNAME FAPI Clerk');
assert.ok(clerkProdPlan.records.some(r=>r.type==='TXT' &&
  r.name==='_dmarc.bellaquitas.fr' &&
  /Do not overwrite existing DMARC/.test(r.note||'')),
  'No sobrescribir una política DMARC existente sin comprobarla');
assert.ok(Object.values(clerkProdPlan.deployment_guards).every(v=>v===false),
  'Los gates de Clerk, cuentas, CPU, billing y DNS siguen cerrados');

assert.equal(target.vars?.CLERK_QA_PREVIEW,'no');
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
assert.deepEqual(target.services,[{
 binding:'PROVIDER_BROKER',
 service:'bellaquitas-api-staging',
 environment:'production'
}], 'La única conexión interna autorizada es al Worker que ya conserva Google y Resend');
assert.equal(target.vars?.PROVIDER_BROKER_ENABLED,'yes',
 'La conexión de proveedores debe activarse solo por Service Binding firmada');
assert.equal(target.vars?.SITE_MODE,'preproduction',
 'Reutilizar Google/Resend no puede habilitar publicación');
assert.ok(!JSON.stringify(target).includes('GOOGLE_CLIENT_SECRET'),
 'Nunca subir los secretos Google al repositorio');
assert.ok(!JSON.stringify(target).includes('RESEND_API_KEY'),
 'Nunca subir el token Resend al repositorio');
assert.ok(Array.isArray(staging.services) && staging.services.length===1,
  'No se cambia el servidor multimedia de staging existente');
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
assert.equal(target.vars?.PUBLIC_ORIGIN,'https://bellaquitas.fr',
 'El origen OAuth final debe coincidir con la URL canónica');
assert.equal(target.vars?.RESEND_FROM,'no-reply@bellaquitas.fr',
 'Conservar el remitente ya verificado en el sistema anterior');
assert.equal(target.vars?.PUBLISH_APPROVED,'no',
 'El origen canónico no debe habilitar la web ni la autenticación');
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
assert.equal(gates.phase6TurnstileProduction?.status,'provisioned-but-disabled');
assert.equal(gates.phase6TurnstileProduction?.setupOnCloudflareFree,true);
assert.equal(gates.phase6TurnstileProduction?.stagingWidgetPreserved,true);
assert.equal(gates.phase6TurnstileProduction?.realChallengeCompleted,false);
assert.deepEqual(gates.phase6TurnstileProduction?.domains,[
 'bellaquitas.fr','www.bellaquitas.fr']);
assert.ok(gates.phase6TurnstileProduction?.secretsBoundToPrivateWorker?.includes('TURNSTILE_SECRET'));
assert.equal(gates.phase6AuthCutoverPreparation?.realTurnstileConfiguredOnTarget,true);
assert.equal(gates.phase6AuthCutoverPreparation?.realGoogleClientConfiguredOnTarget,false);
assert.equal(gates.phase6AuthCutoverPreparation?.realResendKeyConfiguredOnTarget,false);
// Google y Resend no se copian: se utilizan por Service Binding HMAC
// al Worker original que conserva los tres secretos configurados por el dueño.
assert.equal(gates.phase6AuthCutoverPreparation?.providerBridgeConfiguredOnTarget,true);
assert.equal(gates.phase6AuthCutoverPreparation?.stagingProviderSecretsReusedWithoutCopy,true);
assert.equal(gates.phase6ExistingProviderBridge?.status,'deployed-private-bindings-verified');
assert.equal(gates.phase6ExistingProviderBridge?.stagingGoogleAndResendSecretsPreserved,true);
assert.equal(gates.phase6ExistingProviderBridge?.targetServiceBindingVerified,true);
assert.equal(gates.phase6ExistingProviderBridge?.sharedAuthenticationSecretBoundBothWorkers,true);
assert.equal(gates.phase6ExistingProviderBridge?.noProviderSecretsExported,true);
assert.equal(gates.phase6ExistingProviderBridge?.offlineSignedRoundTripPassed,true);
assert.equal(gates.phase6ExistingProviderBridge?.realGoogleCallbackTestedOnCanonicalDomain,false,
 'Los tests sintéticos no son un login Google real');
assert.equal(gates.phase6ExistingProviderBridge?.realResendDeliveryTestedOnCanonicalDomain,false,
 'El usuario no debe recibir un correo de prueba no solicitado');
assert.equal(gates.phase6ExistingProviderBridge?.productionReleaseEnabled,false);

assert.equal(gates.phase6PreproductionDb?.lastDatabaseParityVerification?.tablesCompared,19);
assert.equal(gates.phase6PreproductionDb?.lastDatabaseParityVerification?.tablesIdentical,16);
assert.equal(gates.phase6PreproductionDb?.lastDatabaseParityVerification?.expectedOperationalDifferences,3);
assert.equal(gates.phase6ReconciliationAudit?.originalProfiles,6);
assert.equal(gates.phase6ReconciliationAudit?.destinationProfiles,7);
assert.equal(gates.phase6ReconciliationAudit?.emailCredentialsExact,true);
assert.equal(gates.phase6ReconciliationAudit?.originalProviderDeltaCertified,false,
 'La paridad D1 no demuestra cambios posteriores de la plataforma anterior');
assert.equal(gates.phase6BackupSecretCustody?.originalEightCsvEncryptedBackupCreated,true,
 'No borrar de la historia el respaldo original ya completado');
assert.equal(gates.phase6BackupSecretCustody?.originalSourceRestoreVerified,true,
 'El origen se restauró en D1 y SQLite aislados');
assert.equal(gates.phase6BackupSecretCustody?.privateRotationOutsideChatConfirmed,false,
 'No declarar rotación secreta sin nuevo archivo restaurado y clave custodiada');
assert.equal(gates.phase6IndependentEncryptedD1Backup?.status,'encrypted-and-verified-local-restore');
assert.equal(gates.phase6IndependentEncryptedD1Backup?.tablesRestoredInMemory,22);
assert.equal(gates.phase6IndependentEncryptedD1Backup?.schemaObjectsRestoredInMemory,44);
assert.equal(gates.phase6IndependentEncryptedD1Backup?.profilesRestored,7);
assert.equal(gates.phase6IndependentEncryptedD1Backup?.pointsRestored,1999998);
assert.equal(gates.phase6IndependentEncryptedD1Backup?.foreignKeyCheckErrors,0);
assert.equal(gates.phase6IndependentEncryptedD1Backup?.privateRecoveryKeyNotCommittedToGitHub,true);
assert.equal(gates.phase6IndependentEncryptedD1Backup?.archiveNotCommittedToGitHub,true);
assert.equal(gates.phase6IndependentEncryptedD1Backup?.originalLegacyBackupRekeyed,false,
 'La copia D1 independiente no es rotación del respaldo heredado');
assert.equal(gates.phase6IndependentEncryptedD1Backup?.sourceNativeAuthComplete,false,
 'La nueva D1 no prueba hashes/sesiones del proveedor anterior');
assert.equal(gates.phase6IndependentEncryptedD1Backup?.privateKeyStoredOfflineByOwnerVerified,false);
assert.equal(gates.phase6BackupSecretCustody?.newD1ExportFileDurablyStored,false,
 'Una URL firmada de exportación NO es un backup independiente');
assert.equal(gates.phase6DnsVerification?.zoneStatus,'pending',
 'La zona no puede presentarse como activa antes del registrador');
assert.equal(gates.phase6DnsVerification?.registrarNameserversChanged,false);
assert.equal(gates.phase6DnsVerification?.pendingZoneDnsRecordCount,10);
assert.equal(gates.phase6DnsVerification?.legacyARecordsDnsOnly,4);
assert.equal(gates.phase6DnsVerification?.legacyWwwDnsOnly,true);
assert.equal(gates.phase6PreproductionDb?.productionWorkerConfigured,false);
assert.equal(gates.phase6PreproductionDb?.finalAccountReconciliationCompleted,false);
assert.equal(gates.phase6PreproductionDb?.lastDatabaseParityVerification?.foreignKeyErrors,0);
assert.equal(gates.phase6PreproductionDb?.staticAssetsBuildVerified,true);
assert.equal(gates.phase6PreproductionDb?.workerHasAuthSecrets,false,
 'No declarar autenticación lista si faltan secretos en preproducción');
assert.equal(gates.phase6PreproductionDb?.workerUrlEnabled,false);
assert.equal(gates.phase6PreproductionDb?.workerPreviewUrlEnabled,false);
assert.equal(gates.phase6PreproductionDb?.productionWorkerConfigured,false,
  'El Worker aislado no equivale al Worker público con acceso real');
assert.equal(gates.phase6PreproductionDb?.publiclyAccessible,false);
console.log('OK: D1 preproducción independiente con fotografía inicial verificada, Worker aislado sin rutas, assets originales, 0 R2, 0 altas, 0 escrituras, OAuth deshabilitado; producción pública intacta.');
