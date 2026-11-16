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
  // La autorización nunca basta sin respaldo, acceso admin y datos íntegros.
  const readyForControlledPublication =
    authorized && pendingPrepublication.length === 0;
  return {
    authorized,
    passed: REQUIRED_KEYS.length - pending.length,
    total: REQUIRED_KEYS.length,
    pending,
    pendingPrepublication,
    pendingOwnerPostpublication,
    readyForControlledPublication,
    // Esta marca solo podrá ser true después de verificaciones físicas reales.
    fullyVerified: readyForControlledPublication &&
      pendingOwnerPostpublication.length === 0
  };
}
