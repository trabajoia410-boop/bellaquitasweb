#!/usr/bin/env node
/**
 * Fase 5: pruebas HTTP públicas y anónimas, exclusivamente en STAGING.
 * No recibe cookies, no autentica usuarios, no prueba QR reales ni modifica puntos.
 * Compatible con Node.js >= 20, sin dependencias de terceros.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const api = 'https://bellaquitas-api-staging.bellaquitas-fest-410.workers.dev';
const media = 'https://bellaquitas-media-qa.bellaquitas-fest-410.workers.dev';
const outcomes = [];
const get = async (base, path, headers={}) => {
  const target = new URL(path, base);
  assert.ok([new URL(api).host,new URL(media).host].includes(target.host),
    'Solicitud fuera de los hosts de QA');
  const r = await fetch(target, {
    method: 'GET', headers, redirect: 'manual',
    signal: AbortSignal.timeout(25000)
  });
  return r;
};
const check = (ok, message) => {
  assert.ok(ok, message);
  outcomes.push(message);
};
const jsonGet = async path => {
  const r = await get(api,path);
  check(r.status===200, path+' disponible (200)');
  check((r.headers.get('content-type')||'').includes('application/json'),
    path+' devuelve JSON');
  return r.json();
};

// Salud de D1 y lectura de secciones sin información privada.
const health = await jsonGet('/health');
check(health.service==='bellaquitas-staging' && health.database==='connected',
  'D1 staging accesible');
for (const [path,expected] of [
  ['/v1/events',1],
  ['/v1/rewards',0],
  ['/v1/promos',0],
  ['/v1/moments',0]
]) {
  const data = await jsonGet(path);
  check(Array.isArray(data.items) && data.items.length===expected,
    path+' conserva el inventario de origen');
}
const site = await jsonGet('/v1/site');
check(site.site && typeof site.site==='object','contenido web existente');

// Panel administrativo: CSP, noindex, nonce, sin caché y bilingüismo.
const admin=await get(api,'/administracion/');
check(admin.status===200,'panel administrativo independiente responde');
const html=await admin.text();
check(/bq-admin-language/.test(html) && /Español/.test(html) && /Français/.test(html),
  'selector ES/FR presente');
check(/no-store/i.test(admin.headers.get('cache-control')||''),
  'panel no se almacena en caché');
check(/noindex/i.test(admin.headers.get('x-robots-tag')||''),
  'panel fuera de indexación');
const csp=admin.headers.get('content-security-policy')||'';
check(/frame-ancestors 'none'/.test(csp) && /nonce-/.test(csp),
  'CSP impide incrustación y exige nonce');
check(admin.headers.get('x-frame-options')==='DENY','defensa anti-clickjacking');

// Denegación anónima de datos de socios y panel.
for (const path of [
  '/v1/admin/members',
  '/v1/door/members',
  '/v1/mirror/admin/catalog/events',
  '/v1/mirror/admin/site-drafts',
  '/v1/mirror/admin/activity'
]) {
  const r=await get(api,path);
  check([401,403].includes(r.status),'sin sesión bloqueado '+path);
  const body=await r.text();
  check(!/member_code|lifetime_points|password_hash/i.test(body),
    'sin filtración de datos privados '+path);
}

// Solicitudes de escritura SIN sesión: ninguna puede tener éxito.
// Las peticiones no contienen IDs ni datos personales, y NO deben tocar D1.
for (const path of [
  '/v1/door/checkin',
  '/v1/rewards/request',
  '/v1/admin/member',
  '/v1/mirror/admin/write',
  '/v1/auth/admin/email/link/start'
]) {
  const r=await fetch(new URL(path,api),{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:'{}',redirect:'manual',signal:AbortSignal.timeout(25000)
  });
  check([400,401,403,405,409,429,503].includes(r.status),
    'escritura anónima rechazada '+path);
}

// Vídeos originales en Cloudflare Static Assets (sin R2):
// comprobar que cada vídeo admite una petición real de 1 byte al inicio y al final.
const manifestText=readFileSync('cloudflare/site-media-manifest.js','utf8');
const match=manifestText.match(/export const SITE_MEDIA\s*=\s*(\[[\s\S]*?\]);/);
assert.ok(match,'No existe manifiesto de vídeos');
const assets=JSON.parse(match[1]).filter(a=>a.type==='video/mp4');
check(assets.length===5,'se inventariaron los cinco MP4 originales');
for(const asset of assets){
  for(const [label,position] of [['inicio',0],['final',asset.bytes-1]]){
    const r=await get(media,'/assets/'+encodeURIComponent(asset.path),{
      Range:'bytes='+position+'-'+position,
      Accept:'video/mp4'
    });
    check(r.status===206,'HTTP 206 '+asset.path+' '+label);
    const expectedRange='bytes '+position+'-'+position+'/'+asset.bytes;
    check((r.headers.get('content-range')||'')===expectedRange,
      'rango correcto '+asset.path+' '+label);
    const bytes=new Uint8Array(await r.arrayBuffer());
    check(bytes.length===1,'rango no devuelve el archivo entero '+asset.path+' '+label);
  }
}
console.log('Fase 5 HTTP staging: '+outcomes.length+' comprobaciones correctas.');
