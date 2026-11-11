/**
 * Solo HEAD y un GET de 64 bytes de un vídeo: prueba HTTP Range para Safari.
 * No altera usuarios, visitas, puntos ni archivos R2.
 */
import assert from 'node:assert/strict';

const host = 'bellaquitas-api-staging.bellaquitas-fest-410.workers.dev';
const base = new URL(process.env.BELLAQUITAS_STAGING_URL || 'https://' + host);
assert.equal(base.hostname, host, 'Prohibido ejecutar fuera de staging');
const media = [
  ['Bellaquitas Fest para móvil.mp4', 9072277],
  ['bellaquitas fiesta portada movil.mp4', 2028873],
  ['bellaquitas fiesta portada.mp4', 25437525],
  ['bellaquitas-fiesta-fondo 1.mp4', 2071218],
  ['bellaquitas-fiesta-fondo.mp4', 15545064]
];

for (const [name, bytes] of media) {
  const url = new URL('/espejo/assets/' + encodeURIComponent(name), base);
  const response = await fetch(url, {
    method: 'HEAD',
    redirect: 'manual',
    signal: AbortSignal.timeout(15000)
  });
  assert.equal(response.status, 200, name + ': HEAD debería devolver 200');
  assert.match(response.headers.get('content-type') || '', /^video\/mp4/i);
  assert.equal(Number(response.headers.get('content-length')), bytes,
    name + ': bytes distintos al original de GitHub');
  assert.equal(response.headers.get('accept-ranges'), 'bytes',
    name + ': Safari necesita soporte Range');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  console.log('OK HEAD ' + name + ' — ' + bytes + ' bytes');
}

// Solo 64 bytes del inicio del archivo para asegurar streaming parcial.
const [first, total] = media[0];
const range = await fetch(new URL('/espejo/assets/' + encodeURIComponent(first), base), {
  headers: {Range: 'bytes=0-63'},
  redirect: 'manual',
  signal: AbortSignal.timeout(15000)
});
assert.equal(range.status, 206, 'Las peticiones Range deben devolver 206 Partial Content');
assert.equal(range.headers.get('content-range'), 'bytes 0-63/' + total);
assert.equal(Number(range.headers.get('content-length')), 64);
const data = new Uint8Array(await range.arrayBuffer());
assert.equal(data.byteLength, 64);
console.log('OK GET Range bytes=0-63 — 206 Partial Content');
console.log('OK 6 verificaciones de vídeo sin descargar archivos completos.');
