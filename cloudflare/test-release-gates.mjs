#!/usr/bin/env node
/** Bellaquitas Fest: CI de seguridad para no habilitar producción por accidente. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const data=JSON.parse(readFileSync('cloudflare/release-gates-2026-11-15.json','utf8'));
assert.equal(data.project,'Bellaquitas Fest');
assert.equal(data.productionDomain,'bellaquitas.fr');
assert.equal(data.migrationBranch,'migracion/fase5-segura-20261114');
const names=Object.keys(data.readiness||{});
assert.equal(names.length,16,'No omitir ninguno de los 16 controles');
for(const name of names){
  const gate=data.readiness[name];
  assert.equal(typeof gate.passed,'boolean','Estado ambiguo en '+name);
  assert.ok(typeof gate.evidence==='string'&&gate.evidence.trim().length>20,
    'Falta prueba documentada para '+name);
}
const remaining=names.filter(name=>!data.readiness[name].passed);
if(data.productionChangesAuthorized){
  assert.deepEqual(remaining,[],
    'PROHIBIDO publicar bellaquitas.fr mientras falten controles');
  assert.equal(data.finalSignoff?.explicitProductionAuthorization,true,
    'Una publicación requiere autorización expresa y final');
}else{
  assert.ok(remaining.length>=1||data.finalSignoff?.explicitProductionAuthorization!==true,
    'Se requiere decisión de cambio deliberada');
}
assert.ok(data.phase5CoreOriginRestore?.status==='verified-isolated',
  'No confundir respaldo de staging con restauración de datos originales');
assert.equal(data.phase5CoreOriginRestore?.changesToProduction,false);
console.log('Gates:',names.length-remaining.length,'/',names.length,
  'aprobados; pendientes:',remaining.length);
console.log('Publicación autorizada:',data.productionChangesAuthorized);
