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


/**
 * Consulta las descripciones de pista STSD sin decodificar el vídeo.
 * Funciona en el runner gratuito aunque ffprobe no esté instalado.
 */
function readChildren(buffer,start,end){
 const children=[];let p=start;
 while(p+8<=end){
  const small=buffer.readUInt32BE(p),type=buffer.toString('latin1',p+4,p+8);
  let len=small,header=8;
  if(small===1){if(p+16>end)break;len=Number(buffer.readBigUInt64BE(p+8));header=16;}
  else if(small===0)len=end-p;
  if(!Number.isSafeInteger(len)||len<header||p+len>end)break;
  children.push({type,offset:p,length:len,header});
  p+=len;
 }
 return children;
}
function extractVideoTrackFormats(buffer,moov){
 const formats=[];
 const nested=(atom,type)=>readChildren(buffer,atom.offset+(atom.header||8),atom.offset+atom.length)
  .filter(x=>x.type===type);
 for(const trak of nested(moov,'trak'))
  for(const mdia of nested(trak,'mdia'))
   for(const minf of nested(mdia,'minf'))
    for(const stbl of nested(minf,'stbl'))
     for(const stsd of nested(stbl,'stsd')){
      const start=stsd.offset+(stsd.header||8);
      if(start+8>stsd.offset+stsd.length)continue;
      const count=buffer.readUInt32BE(start+4);
      let p=start+8;
      for(let i=0;i<Math.min(count,16);i++){
       if(p+16>stsd.offset+stsd.length)break;
       const len=buffer.readUInt32BE(p);
       if(len<16||p+len>stsd.offset+stsd.length)break;
       const fourcc=buffer.toString('latin1',p+4,p+8);
       if(['avc1','avc3','hvc1','hev1','av01','mp4v','vp09'].includes(fourcc)){
        const width=p+36<=buffer.length?buffer.readUInt16BE(p+32):0;
        const height=p+36<=buffer.length?buffer.readUInt16BE(p+34):0;
        formats.push({fourcc,width,height});
       }
       p+=len;
      }
     }
 return formats;
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
 const tracks=extractVideoTrackFormats(buffer,moov);
 const item={file:a.path,bytes:a.bytes,majorBrand:brand,moovBeforeMdat:fastStart,
  atomOrder:boxes.map(x=>x.type).join(','),codecs:tracks.map(t=>t.fourcc),
  resolution:tracks.map(t=>t.width+'x'+t.height),durationSeconds:null,
  warnings:[]};
 if(tracks.length===0)item.warnings.push('No se ha podido leer STSD; comprobar con ffprobe');
 for(const t of tracks){
  if(!['avc1','avc3','hvc1','hev1'].includes(t.fourcc))
    item.warnings.push('Video '+t.fourcc+': comprobar compatibilidad con Safari');
  if(!t.width||!t.height)item.warnings.push('Dimensiones del track incompletas');
 }
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
