#!/usr/bin/env node
/** Bellaquitas Fest — ensayos sintéticos del gate de publicación, sin red. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluateRelease, REQUIRED_KEYS, DEFERRED_OWNER_CHECKS } from './release-policy.mjs';

const data = JSON.parse(readFileSync('cloudflare/release-gates-2026-11-15.json','utf8'));
const actual = evaluateRelease(data);
assert.equal(actual.total, 16);
assert.equal(REQUIRED_KEYS.length, 16);
assert.equal(DEFERRED_OWNER_CHECKS.length, 3);
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
  'bothRealAdminLoginsVerified',
  'originalVideosDeployedToMediaQa',
  'stagingOnlyAccountCutoverPolicyApproved'
]) {
  const blocked = structuredClone(fake);
  blocked.readiness[critical].passed = false;
  assert.equal(evaluateRelease(blocked).readyForControlledPublication, false,
    'Nunca publicar faltando la protección previa: ' + critical);
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
