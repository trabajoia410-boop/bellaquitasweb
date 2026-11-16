#!/usr/bin/env node
/**
 * Bellaquitas Fest — inventario visual completo del sitio original.
 * Recorre HTML/CSS/JS ES/FR congelados, no solo los 17 recursos multimedia.
 * Si falta un asset conocido, CI conserva el bloqueo del lanzamiento y
 * exige que la deuda figure explícita en release-gates. Sin red/PII.
 */
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

const mirror=readFileSync('cloudflare/mirror-snapshot.js','utf8');
const prefix='export const MIRROR_SNAPSHOT=';
const start=mirror.indexOf(prefix);
assert.ok(start>=0,'Fotografía del sitio original ausente');
const snapshot=JSON.parse(mirror.slice(start+prefix.length).trim().replace(/;\s*$/,''));
const siteMedia=readFileSync('cloudflare/site-media-manifest.js','utf8');
const match=siteMedia.match(/export const SITE_MEDIA\s*=\s*(\[[\s\S]*?\]);/);
assert.ok(match,'Inventario binario ausente');
const allowed=JSON.parse(match[1]);
const inventory=new Set(allowed.map(x=>x.path));
assert.equal(inventory.size,allowed.length,'Inventario duplicado');
const dynamicFiles=new Set(['qr-local.js','jsqr-local.js']);
for(const name of dynamicFiles)
 assert.ok(Object.hasOwn(snapshot,'assets/'+name),'QR original perdido: '+name);
const assetsSeen=new Set();
const missing=new Set();
for(const [name,source] of Object.entries(snapshot)){
 assert.equal(typeof source,'string','Snapshot no textual: '+name);
 const expressions=source.matchAll(/assets\/([a-zA-Z0-9%+_.() \u00C0-\u017F-]+\.(?:png|jpe?g|webp|svg|mp4|gif|ico|js|woff2?))(?=["'\\) \t<>]|$)/gi);
 for(const m of expressions){
  let path=m[1];
  try{path=decodeURIComponent(path)}catch{}
  assetsSeen.add(path);
  if(!inventory.has(path) && !dynamicFiles.has(path))missing.add(path);
 }
}
for(const asset of inventory)
 assert.ok(existsSync('assets/'+asset),'Media original del manifest no existe: '+asset);
const gates=JSON.parse(readFileSync('cloudflare/release-gates-2026-11-15.json','utf8'));
const found=[...missing].sort(),documented=[...(gates.phase6VisualAssetAudit?.missing||[])].sort();
assert.deepEqual(found,documented,
 'Cambio en recursos visuales sin actualizar gate de publicación');
assert.equal(gates.phase6VisualAssetAudit?.allReferencedAssetNamesAudited,assetsSeen.size);
if(found.length){
 assert.equal(gates.phase6VisualAssetAudit?.repoMissing,true);
 assert.equal(gates.phase6VisualAssetAudit?.originalBinaryImportedToRepo,false);
 assert.equal(gates.phase6PreproductionDb?.visualAssetParityComplete,false);
 assert.equal(gates.productionChangesAuthorized,false);
 console.log('PENDIENTE VISUAL CONOCIDO (publicación bloqueada): '+found.join(', '));
}else{
 assert.equal(gates.phase6VisualAssetAudit?.repoMissing,false);
 assert.equal(gates.phase6VisualAssetAudit?.originalBinaryImportedToRepo,true);
 assert.equal(gates.phase6PreproductionDb?.visualAssetParityComplete,true);
 console.log('PASS: todos los recursos originales usados en la interfaz están disponibles.');
}
console.log('Auditoría visual: '+assetsSeen.size+' referencias únicas, '+inventory.size+
 ' recursos binarios, '+dynamicFiles.size+' bibliotecas locales de QR, '+found.length+' faltantes.');
