#!/usr/bin/env node
/**
 * Bellaquitas Fest — diagnostico no destructivo de los MP4 originales para Safari/iPhone.
 * 1) Comprueba estructura ISO-BMFF/MP4 y situacion del indice moov.
 * 2) Inspecciona codecs y dimensiones con ffprobe solo si esta instalado.
 * 3) NUNCA recodifica, reubica, optimiza, remuestrea ni cambia originales.
 */
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';

const text=readFileSync('cloudflare/site-media-manifest.js','utf8');
const match=text.match(/export const SITE_MEDIA\s*=\s*(\[[\s\S]*?\]);/);
assert.ok(match,'Manifest de recursos original no encontrado');
const media=JSON.parse(match[1]).filter(a=>a.type==='video/mp4');
assert.ok(media.length>=5,'Debe contener los cinco videos de la web');

function readBoxes(file) {
 const b=readFileSync(file),boxes=[];
 let at=0;
 while(at<b.length){
  assert.ok(at+8<=b.length,'Cabecera MP4 truncada '+file+' @ '+at);
  const length32=b.readUInt32BE(at),type=b.toString('latin1',at+4,at+8);
  let length=length32,header=8;
  if(length32===1){
   assert.ok(at+16<=b.length,'Cabecera MP4 extendida truncada');
   length=Number(b.readBigUInt64BE(at+8));header=16;
  }else if(length32===0)length=b.length-at;
  assert.ok(Number.isSafeInteger(length)&&length>=header&&at+length<=b.length,
   'Atom MP4 invalido '+type+' @ '+at+' en '+file);
  assert.match(type,/^[\x20-\x7e]{4}$/,'Tipo de atom MP4 ilegible');
  boxes.push({type,offset:at,length});
  at+=length;
 }
 assert.equal(at,b.length,'Longitud MP4 no coincide');
 return {boxes,buffer:b};
}

let ffprobePresent=false;
try{execFileSync('ffprobe',['-version'],{stdio:'ignore',timeout:5000});ffprobePresent=true;}catch{}
const report=[];
for(const a of media){
 assert.ok(!a.path.includes('/')&&!a.path.includes('..'));
 const file=join('assets',a.path);
 assert.equal(statSync(file).size,a.bytes,'No se acepta un MP4 modificado');
 const {boxes,buffer}=readBoxes(file);
 const ftyp=boxes.find(x=>x.type==='ftyp'),moov=boxes.find(x=>x.type==='moov'),mdat=boxes.find(x=>x.type==='mdat');
 assert.ok(ftyp&&moov&&mdat,'Faltan atoms ftyp/moov/mdat: '+a.path);
 assert.equal(boxes[0].type,'ftyp','El archivo debe comenzar como MP4');
 const brand=buffer.toString('latin1',ftyp.offset+8,ftyp.offset+12);
 const fastStart=moov.offset<mdat.offset;
 const item={file:a.path,bytes:a.bytes,majorBrand:brand,moovBeforeMdat:fastStart,
  atomOrder:boxes.map(x=>x.type).join(','),codecs:[],resolution:[],durationSeconds:null,
  warnings:[]};
 if(!fastStart)item.warnings.push('moov al final: comprobar Range 206 y arranque en Safari');
 if(ffprobePresent){
  const output=execFileSync('ffprobe',[
   '-v','error','-show_entries',
   'stream=codec_type,codec_name,codec_tag_string,width,height,pix_fmt,profile,level:format=duration',
   '-of','json',file
  ],{encoding:'utf8',maxBuffer:8*1024*1024,timeout:20000});
  const meta=JSON.parse(output);
  const video=(meta.streams||[]).filter(x=>x.codec_type==='video');
  assert.ok(video.length>0,'El MP4 no tiene pista de video '+a.path);
  for(const stream of video){
   assert.ok(stream.width>0&&stream.height>0,'Dimensiones invalidas '+a.path);
   const codec=stream.codec_name||'unknown';
   item.codecs.push(codec+'/'+(stream.profile||'unknown')+'/'+(stream.pix_fmt||'unknown'));
   item.resolution.push(stream.width+'x'+stream.height);
   if(codec!=='h264')item.warnings.push('Codec '+codec+': verificar compatibilidad con Safari/iPhone');
   if(stream.pix_fmt&&stream.pix_fmt!=='yuv420p')
     item.warnings.push('Pix fmt '+stream.pix_fmt+': verificar compatibilidad iPhone');
  }
  item.durationSeconds=Number(Number(meta.format?.duration||0).toFixed(2));
 }
 report.push(item);
 const status=item.warnings.length?'REVISAR':'OK';
 console.log('[VIDEO '+status+'] '+JSON.stringify(item));
}
console.log('AUDITORIA: '+report.length+' videos originales; ffprobe='+ (ffprobePresent?'disponible':'no disponible')+
 '; '+report.filter(x=>x.moovBeforeMdat).length+' con indice moov antes de mdat.');
console.log('Nota: esto NO prueba reproduccion real ni recortes visuales en Safari. No se han alterado archivos.');
