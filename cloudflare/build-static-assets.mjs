#!/usr/bin/env node
// Bellaquitas Fest: construir únicamente los medios originales permitidos.
// NO copiamos código de repositorio, .env, SQL, secrets ni credenciales.
import {readFileSync,statSync,mkdirSync,copyFileSync,rmSync,existsSync,lstatSync} from 'node:fs';
import {join,resolve,basename} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const src=resolve('assets');
const target=resolve('cloudflare/dist-static');
const manifest=readFileSync('cloudflare/site-media-manifest.js','utf8').match(/export const SITE_MEDIA\s*=\s*(\[[\s\S]*?\]);/);
assert.ok(manifest,'Inventario original ausente');
const assets=JSON.parse(manifest[1]),maxBytes=25*1024*1024;
assert.ok(assets.length>0,'Sin archivos');
const planned=new Set();
for(const asset of assets){
 assert.equal(asset.path,basename(asset.path),'Nombre sospechoso');
 assert.ok(!asset.path.includes('..')&&!asset.path.startsWith('.'),'Ruta inválida');
 assert.ok(!planned.has(asset.path),'Archivo duplicado: '+asset.path);
 planned.add(asset.path);
 const original=join(src,asset.path);
 assert.equal(statSync(original).size,asset.bytes,'Tamaño diferente: '+asset.path);
 assert.ok(asset.bytes<=maxBytes,'Archivo excede 25 MiB: '+asset.path);
 const content=readFileSync(original);
 const sha=createHash('sha1').update('blob '+content.byteLength+'\0').update(content).digest('hex');
 assert.equal(sha,asset.gitSha1,'Huella Git distinta: '+asset.path);
}
rmSync(target,{recursive:true,force:true});
mkdirSync(join(target,'assets'),{recursive:true});
let total=0;
for(const item of assets){
 const original=join(src,item.path),destination=join(target,'assets',item.path);
 copyFileSync(original,destination);
 assert.equal(statSync(destination).size,item.bytes,'Copia incompleta: '+item.path);
 total+=item.bytes;
}
console.log('Static Assets seguros:',assets.length,'archivos;',total,'bytes idénticos al inventario Git.');
console.log('Ruta local:',target,' (no se ha desplegado ningún archivo).');

// Los logos se obtienen del almacenamiento ORIGINAL, nunca se inventan.
// El ETag almacenado por Supabase tiene 32 hex; comprobamos también MD5+bytes.
// El paso --require-logos es obligatorio antes de cualquier corte a producción.
const logos=JSON.parse(readFileSync('cloudflare/legacy-logos-manifest.json','utf8')).files;
const requiresLogos=process.argv.includes('--require-logos');
assert.equal(logos.length,3,'Debe haber exactamente tres logos pendientes');
const originalDir=join(src,'migrated-logos');
const missing=logos.filter(item=>!existsSync(join(originalDir,item.path)));
if(missing.length){
 const names=missing.map(item=>item.path).join(', ');
 console.warn('PENDIENTE: faltan '+missing.length+' logos originales: '+names);
 if(requiresLogos)throw new Error('Publicación bloqueada: recuperar primero los tres logos originales');
}else{
 const stored=new Set();
 for(const file of logos){
  assert.match(file.path,/^[0-9a-f-]{36}\.(?:png|jpg)$/i,'Nombre de logo inválido');
  assert.ok(!stored.has(file.path),'Logo duplicado');stored.add(file.path);
  const from=join(originalDir,file.path);
  assert.ok(lstatSync(from).isFile()&&!lstatSync(from).isSymbolicLink(),'No usar enlaces simbólicos');
  const bytes=readFileSync(from);
  assert.equal(bytes.length,file.bytes,'Logo cambiado: '+file.path);
  assert.equal(createHash('md5').update(bytes).digest('hex'),file.etagMd5,
   'ETag de logo no coincide con el objeto original: '+file.path);
  const isPng=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const isJpg=bytes[0]===255&&bytes[1]===216&&bytes.at(-2)===255&&bytes.at(-1)===217;
  assert.ok(file.type==='image/png'?isPng:file.type==='image/jpeg'&&isJpg,'Formato real incorrecto');
 }
 mkdirSync(join(target,'assets','migrated-logos'),{recursive:true});
 for(const file of logos){
  const from=join(originalDir,file.path),to=join(target,'assets','migrated-logos',file.path);
  copyFileSync(from,to);
  assert.equal(createHash('md5').update(readFileSync(to)).digest('hex'),file.etagMd5,
   'Copia de logo incompleta: '+file.path);
  total+=file.bytes;
 }
 console.log('Logos originales certificados por tamaño y ETag: '+logos.length+'; total estáticos '+total+' bytes.');
}



// La web pública conserva su PWA/manifest original junto a los MP4 e iconos.
// Validar el formato antes de copiar: nunca empaquetar endpoints o secretos.
const manifestPath=resolve('manifest.webmanifest');
const manifestText=readFileSync(manifestPath,'utf8');
const webmanifest=JSON.parse(manifestText);
assert.equal(webmanifest.name,'Bellaquitas Fest','Nombre original de la aplicación');
assert.equal(webmanifest.start_url,'./','No abrir URLs externas o staging');
assert.equal(webmanifest.scope,'./','Mantener ámbito del mismo dominio');
assert.ok(Array.isArray(webmanifest.icons) && webmanifest.icons.length>0);
for(const icon of webmanifest.icons){
 assert.match(icon.src,/^assets\/[a-zA-Z0-9-]+\.(?:png|svg)$/,
   'Los iconos PWA no deben apuntar a servidores externos');
 assert.ok(planned.has(icon.src.slice('assets/'.length)),
   'Icono PWA no incluido en inventario de bytes originales');
}
assert.ok(!/supabase|r2\.dev|workers\.dev|api[_-]?key|password/i.test(manifestText),
 'El manifiesto no debe filtrar servicios antiguos o secretos');
copyFileSync(manifestPath,join(target,'manifest.webmanifest'));
assert.equal(readFileSync(join(target,'manifest.webmanifest'),'utf8'),manifestText);
console.log('Manifest PWA original conservado junto a los recursos multimedia.');
