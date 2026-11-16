#!/usr/bin/env node
/**
 * Bellaquitas Fest — bloqueo de corte a producción.
 * Los controles personales (teléfonos, QR físico, revisión visual final)
 * se mantienen pendientes para DESPUÉS de publicar, según el propietario.
 * Los controles de protección de datos y acceso siguen siendo obligatorios
 * ANTES de publicar. No realiza operaciones de escritura.
 */
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { evaluateRelease } from './release-policy.mjs';

const mode = process.argv.slice(2);
assert.ok(mode.every(x => ['--require-release','--assert-blocked'].includes(x)),
  'Argumentos desconocidos');
assert.ok(!mode.includes('--require-release') || !mode.includes('--assert-blocked'),
  'Elige una sola comprobación');

const gates = JSON.parse(readFileSync('cloudflare/release-gates-2026-11-15.json', 'utf8'));
const status = evaluateRelease(gates);
console.log(JSON.stringify({
  production: 'bellaquitas.fr',
  ready: status.readyForControlledPublication,
  authorized: status.authorized,
  passed: status.passed,
  total: status.total,
  pendingBeforePublication: status.pendingPrepublication,
  deferredOwnerChecksAfterPublication: status.pendingOwnerPostpublication,
  fullyVerified: status.fullyVerified,
  safeToDeployMediaQa: true,
  safeToChangeDns: status.readyForControlledPublication
}, null, 2));

if (mode.includes('--require-release') && !status.readyForControlledPublication) {
  console.error('BLOQUEADO: faltan respaldos, acceso real, integridad u otra condición de seguridad previa, o autorización expresa. No cambiar DNS ni puntos.');
  process.exitCode = 1;
}
if (mode.includes('--assert-blocked')) {
  assert.equal(status.readyForControlledPublication, false,
    'Producción no debe habilitarse antes de los controles previos y autorización');
  assert.ok(status.pendingPrepublication.length >= 1 || !status.authorized,
    'Bloqueo inesperado: revisar el gate de publicación');
  console.log('OK: publicación protegida; las pruebas físicas quedan tras publicar.');
}
