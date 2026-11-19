/**
 * Bellaquitas Fest — política de publicación controlada.
 *
 * Las comprobaciones que necesitan un dispositivo o la participación de
 * los propietarios se harán DESPUÉS de publicar. Esto nunca elimina los
 * bloqueos de seguridad previos (respaldo, credenciales, conciliación).
 *
 * No edita Cloudflare, DNS, GitHub main, usuarios, puntos ni visitas.
 */
export const REQUIRED_KEYS = Object.freeze([
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
]);

// Verificación personal del usuario: ÚNICAMENTE después del lanzamiento.
// A pesar de aplazarse, deben figurar como pendientes y nunca como aprobadas.
export const DEFERRED_OWNER_CHECKS = Object.freeze([
  'realHttp206AndIosAndroidPlayback',
  'bothRealAdminLoginsVerified',
  'realDeviceQrDoorTest',
  'finalEsFrMobileVisualParity'
]);

export function evaluateRelease(gates) {
  if (!gates || gates.project !== 'Bellaquitas Fest' ||
      gates.productionDomain !== 'bellaquitas.fr' ||
      gates.migrationBranch !== 'migracion/fase5-segura-20261114') {
    throw new Error('Identidad inesperada del proyecto de migración');
  }
  const readiness = gates.readiness;
  if (!readiness || typeof readiness !== 'object' || Array.isArray(readiness)) {
    throw new Error('No existe el registro de 16 controles');
  }
  const actualKeys = Object.keys(readiness).sort();
  const required = [...REQUIRED_KEYS].sort();
  if (JSON.stringify(actualKeys) !== JSON.stringify(required)) {
    throw new Error('Cambio de condiciones de publicación sin revisión');
  }
  for (const [name, entry] of Object.entries(readiness)) {
    if (typeof entry?.passed !== 'boolean' ||
        typeof entry?.evidence !== 'string' || entry.evidence.trim().length <= 20) {
      throw new Error('Falta evidencia válida para ' + name);
    }
  }
  const pending = REQUIRED_KEYS.filter(key => !readiness[key].passed);
  const pendingPrepublication = pending.filter(
    key => !DEFERRED_OWNER_CHECKS.includes(key)
  );
  const pendingOwnerPostpublication = pending.filter(
    key => DEFERRED_OWNER_CHECKS.includes(key)
  );
  const authorized = gates.productionChangesAuthorized === true &&
    gates.finalSignoff?.explicitProductionAuthorization === true;
  // Presupuesto obligatorio de 0 EUR: la zona Free NO certifica que la
  // suscripción Workers ni otros productos de la cuenta sean gratuitos.
  // Nunca permitir delegar/publicar hasta obtener evidencia de facturación.
  const cpu = gates.phase6CpuSafety;
  const cpu10msVerified =
    cpu?.freeWorkersCpuLimitMs === 10 &&
    cpu?.nativeHardLimitDocumented === true &&
    cpu?.realStagingCpuP99Below10ms === true &&
    cpu?.realStagingCpuMaxBelow10ms === true &&
    cpu?.realStagingExceededCpuCountVerifiedZero === true &&
    cpu?.realPasswordKdfAndVideo206Profiled === true &&
    // La medición de KDF debe demostrar compatibilidad real con 10 ms,
    // no solo indicar que se ejecutó. Prueba 19/11: 136,424 ms -> false.
    cpu?.realPasswordKdfFreeCompatible === true;
  const budget = gates.phase6ZeroSpend;
  const freeOnlyVerified =
    budget?.zoneFreeVerified === true &&
    budget?.workersFreePlanVerified === true &&
    budget?.otherPaidProductsAbsentVerified === true &&
    budget?.billingAuditComplete === true;

  // El propietario probará físicamente ambos accesos admin DESPUÉS de
  // publicar. Pero hay que demostrar ANTES que OAuth, reautenticación,
  // recuperación y el editor funcionan en QA con usuarios ficticios.
  const adminTechnologyReady =
    gates.phase5EditorSyntheticQA?.status === 'success' &&
    gates.phase5AdminRecovery?.status === 'deployed-to-staging-and-synthetically-tested' &&
    gates.phase5OAuthCsrfHardening?.status === 'deployed-to-staging-and-verified' &&
    readiness.googleIdentityMappingExact.passed &&
    readiness.stagingAdminStepupSchemaApplied.passed;

  // Nunca cambiar el dominio a una D1 vacía o a un Worker sin conexión.
  // Las tres condiciones deben certificarse con hechos en la ventana
  // de corte; ninguna se satisface por una prueba móvil posterior.
  const target = gates.phase6PreproductionDb;
  // Paridad visual: el JPG original usado como fondo junto al vídeo debe
  // estar realmente presente y verificado; no basta una cifra de medios 17/17.
  const visualAudit = gates.phase6VisualAssetAudit;
  const visualReady =
    target?.visualAssetParityComplete === true &&
    visualAudit?.repoMissing === false &&
    visualAudit?.originalBinaryImportedToRepo === true &&
    Array.isArray(visualAudit?.missing) &&
    visualAudit.missing.length === 0;

  // Google y Resend YA EXISTEN en el Worker staging. Pueden utilizarse
  // mediante un Service Binding privada, firmada con HMAC y sin exportar
  // ningún secreto. Dos vías: credenciales directas O conexión interna
  // verificable. No confundir configuración del puente con login real.
  const auth = gates.phase6AuthCutoverPreparation;
  const bridge = gates.phase6ExistingProviderBridge;
  const directProviderBindings =
    auth?.realGoogleClientConfiguredOnTarget === true &&
    auth?.realResendKeyConfiguredOnTarget === true;
  const brokerProviderBindings =
    bridge?.status === 'deployed-private-bindings-verified' &&
    bridge?.stagingGoogleAndResendSecretsPreserved === true &&
    bridge?.targetServiceBindingVerified === true &&
    bridge?.sharedAuthenticationSecretBoundBothWorkers === true &&
    bridge?.offlineSignedRoundTripPassed === true &&
    bridge?.noProviderSecretsExported === true;
  const providerBindingsReady =
    (directProviderBindings || brokerProviderBindings) &&
    auth?.realTurnstileConfiguredOnTarget === true &&
    gates.phase6TurnstileProduction?.secretsBoundToPrivateWorker?.includes('TURNSTILE_SECRET') === true;

  // Antes del cambio de nameservers basta con verificar la integración de
  // secretos; el test REAL final de Google/correo requiere el dominio
  // autorizado, por lo que es una puerta separada DESPUÉS de activar DNS.
  const liveProvidersReady = directProviderBindings
    ? auth?.realGoogleLoginTestedOnCanonicalDomain === true &&
      auth?.realResendDeliveryTestedOnCanonicalDomain === true
    : brokerProviderBindings &&
      bridge?.realGoogleCallbackTestedOnCanonicalDomain === true &&
      bridge?.realResendDeliveryTestedOnCanonicalDomain === true;
  const authProvidersReady = providerBindingsReady && liveProvidersReady;

  // Dos operaciones DIFERENTES: (A) delegar nameservers a una zona que
  // sigue sirviendo GitHub Pages, y (B) publicar rutas Worker en la zona ya
  // activa. Exigir zona activa ANTES de permitir el propio cambio de NS creaba
  // un bloqueo circular. No ejecutar ninguna de las dos automáticamente.
  const d = gates.phase6DnsVerification;
  const email = gates.phase6EmailDnsVerification;
  const dnsRequirements = email?.requiredRecordsInPendingCloudflareZone;
  const dnsRecordsPrepared =
    d?.legacyARecordsDnsOnly === 4 &&
    d?.legacyWwwDnsOnly === true &&
    d?.emailRecordsPreserved === true &&
    d?.searchConsoleRecordPreserved === true &&
    dnsRequirements?.MX === true &&
    dnsRequirements?.SPF_TXT === true &&
    dnsRequirements?.DKIM_TXT === true &&
    dnsRequirements?.SPF_CNAME === true &&
    dnsRequirements?.GoogleSearchConsoleTXT === true;

  // Antes de pasar a fase 6 se exige la conciliación real con el proveedor
  // anterior, NO solo que dos D1 bajo Cloudflare sean idénticas.
  const finalOriginDeltaVerified =
    gates.phase6ReconciliationAudit?.originalProviderDeltaCertified === true &&
    target?.finalAccountReconciliationCompleted === true;

  const targetPreDnsReady =
    visualReady && providerBindingsReady && finalOriginDeltaVerified &&
    target?.realUsersImported === true &&
    target?.productionWorkerConfigured === true &&
    target?.authRoutePreflightPassed === true &&
    target?.schemaObjects === 44 &&
    target?.verifiedSchemaDifferences === 0;

  // Esta fase solo habilitaría (tras firma expresa) copiar la delegación
  // exacta de Hostinger a Cloudflare SIN añadir rutas ni cambiar el A/www.
  const readyForNameserverDelegation =
    authorized && freeOnlyVerified && cpu10msVerified && pendingPrepublication.length === 0 &&
    adminTechnologyReady && targetPreDnsReady && dnsRecordsPrepared &&
    d?.zoneStatus === 'pending' &&
    d?.registrarNameserversChanged === false;

  // La siguiente fase requiere una zona Cloudflare YA activa y una
  // delegación confirmada; no basta con registros preparados en pendiente.
  const dnsReady =
    dnsRecordsPrepared && d?.zoneStatus === 'active' &&
    d?.registrarNameserversChanged === true;
  const targetReady = targetPreDnsReady && dnsReady && authProvidersReady;

  // La autorización nunca basta sin respaldo, credenciales recuperables,
  // integridad de datos y entorno final realmente preparado.
  const readyForControlledPublication =
    authorized && freeOnlyVerified && cpu10msVerified && pendingPrepublication.length === 0 &&
    adminTechnologyReady && targetReady;
  return {
    authorized,
    freeOnlyVerified,
    cpu10msVerified,
    passed: REQUIRED_KEYS.length - pending.length,
    total: REQUIRED_KEYS.length,
    pending,
    pendingPrepublication,
    pendingOwnerPostpublication,
    adminTechnologyReady,
    visualReady,
    providerBindingsReady,
    liveProvidersReady,
    authProvidersReady,
    dnsRecordsPrepared,
    finalOriginDeltaVerified,
    targetPreDnsReady,
    readyForNameserverDelegation,
    dnsReady,
    targetReady,
    readyForControlledPublication,
    // Esta marca solo podrá ser true después de verificaciones físicas reales.
    fullyVerified: readyForControlledPublication &&
      pendingOwnerPostpublication.length === 0
  };
}
