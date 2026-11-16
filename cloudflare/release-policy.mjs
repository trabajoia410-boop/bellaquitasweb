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

  const targetReady =
    visualReady &&
    target?.realUsersImported === true &&
    target?.productionWorkerConfigured === true &&
    target?.finalAccountReconciliationCompleted === true &&
    target?.authRoutePreflightPassed === true &&
    target?.schemaObjects === 44 &&
    target?.verifiedSchemaDifferences === 0;

  // La autorización nunca basta sin respaldo, credenciales recuperables,
  // integridad de datos y entorno final realmente preparado.
  const readyForControlledPublication =
    authorized && pendingPrepublication.length === 0 &&
    adminTechnologyReady && targetReady;
  return {
    authorized,
    passed: REQUIRED_KEYS.length - pending.length,
    total: REQUIRED_KEYS.length,
    pending,
    pendingPrepublication,
    pendingOwnerPostpublication,
    adminTechnologyReady,
    visualReady,
    targetReady,
    readyForControlledPublication,
    // Esta marca solo podrá ser true después de verificaciones físicas reales.
    fullyVerified: readyForControlledPublication &&
      pendingOwnerPostpublication.length === 0
  };
}
