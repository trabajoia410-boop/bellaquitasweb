/**
 * Bellaquitas Fest: PRECORTE de bloques 2 (D1/Wallet) y 3 (identidad Clerk).
 * Recibe SOLO cifras verificadas y nombres de esquema; jamás requiere email,
 * IDs personales, JWT, passwords, claves, SQL de restauración ni peticiones HTTP.
 * Fail-closed: la QA aislada NO habilita la base preparada ni el login.
 */
const REQUIRED_TABLES = Object.freeze([
  "wallet_apple_registrations", "wallet_campaigns",
  "wallet_customer_sessions", "wallet_customers",
  "wallet_email_challenges", "wallet_employee_sessions",
  "wallet_employees", "wallet_message_deliveries",
  "wallet_pin_limits", "wallet_programs", "wallet_reward_claims",
  "wallet_stamp_events", "wallet_sync_jobs"
]);
const REQUIRED_TRIGGERS = Object.freeze([
  "wallet_reward_apply", "wallet_reward_guard",
  "wallet_stamp_apply", "wallet_stamp_guard"
]);
export {REQUIRED_TABLES, REQUIRED_TRIGGERS};

const count = value => Number.isSafeInteger(value) && value >= 0;
const sameNames = (observed, required) =>
  Array.isArray(observed) &&
  observed.length === required.length &&
  observed.every(x => typeof x === "string") &&
  new Set(observed).size === observed.length &&
  [...observed].sort().every((name, i) => name === [...required].sort()[i]);

function validLegacy(snapshot) {
  return !!snapshot && ["profiles","admins","points","lifetimePoints","visits",
    "identityGoogle","identityEmail","identityDistinctProfiles"].every(
      key => count(snapshot[key])
    ) &&
    snapshot.profiles >= 1 && snapshot.admins >= 1 &&
    snapshot.admins <= snapshot.profiles &&
    snapshot.points <= snapshot.lifetimePoints &&
    snapshot.identityGoogle + snapshot.identityEmail === snapshot.profiles &&
    snapshot.identityDistinctProfiles === snapshot.profiles;
}
const sameLegacy = (left,right) =>
  validLegacy(left) && validLegacy(right) &&
  ["profiles","admins","points","lifetimePoints","visits",
    "identityGoogle","identityEmail","identityDistinctProfiles"].every(
      key => left[key] === right[key]
    );
const hasWalletSchema = db =>
  !!db && sameNames(db.walletTables, REQUIRED_TABLES) &&
  sameNames(db.walletTriggers, REQUIRED_TRIGGERS) &&
  count(db.walletCustomers) && count(db.walletStamps);

/**
 * @param {object} input - Datos de solo lectura y pruebas externas.
 * baseline: snapshot restaurado de D1; NO sustituye el delta del origen.
 * target: D1 preparada, no D1 QA. Distintos entornos por diseño.
 * clerk: recuentos de la API de producción, sin lista de identidades.
 * evidence: booleanos externos; NUNCA se deducen de un contador coincidente.
 */
export function auditBlocks23(input) {
  const {baseline,qa,target,clerk,evidence} = input || {};
  const qaReady = hasWalletSchema(qa) &&
    qa.walletCustomers === 0 && qa.walletStamps === 0 &&
    qa.profiles === 0 && qa.clerkLinks === 0;
  const baselineReady = validLegacy(baseline) &&
    baseline.profiles === 7 && baseline.admins === 2 &&
    baseline.identityGoogle === 6 && baseline.identityEmail === 1 &&
    evidence?.baselineBackupRestored === true;
  const legacyPreserved = baselineReady && sameLegacy(baseline,target);
  const walletReady = legacyPreserved && hasWalletSchema(target);
  const clerkReady = legacyPreserved &&
    clerk?.domainComplete === true &&
    clerk?.googleOauthConfigured === true &&
    count(clerk.productionUsers) && clerk.productionUsers >= 7 &&
    target.clerkLinks === 7 && target.clerkConfirmedLinks === 7 &&
    target.clerkConfirmedAdmins === 2 &&
    target.clerkVerifiedGoogle === 6 &&
    target.clerkVerifiedEmail === 1 &&
    evidence?.clerkIndependentSubjectProofVerified === true &&
    evidence?.adminStepupRealQaPassed === true;
  const backupReady = evidence?.targetPostMigrationBackupRestored === true &&
    evidence?.backupKeyCustodyConfirmed === true;
  const originReady = evidence?.externalSourceDeltaReconciled === true;
  const readyForPublication = qaReady && walletReady && clerkReady &&
    backupReady && originReady;
  const pending = [];
  if (!qaReady) pending.push("qa-wallet-schema");
  if (!baselineReady) pending.push("backup-baseline-verified");
  if (!legacyPreserved) pending.push("old-profiles-and-balances-parity");
  if (!walletReady) pending.push("prepared-d1-wallet-schema");
  if (!clerkReady) pending.push("seven-verified-clerk-identities-two-admins");
  if (!backupReady) pending.push("post-migration-restored-backup-and-custody");
  if (!originReady) pending.push("external-origin-delta");
  return Object.freeze({
    qaReady, baselineReady, legacyPreserved, walletReady, clerkReady,
    backupReady, originReady, readyForPublication,
    pending:Object.freeze(pending),
    note:"No autoriza publicación por sí solo: requiere release-policy y aprobación expresa."
  });
}
