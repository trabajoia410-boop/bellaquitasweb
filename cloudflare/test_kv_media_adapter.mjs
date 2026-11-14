/**
 * Prueba KV Bellaquitas: 100% en memoria, SIN cuenta Cloudflare, sin pagar,
 * sin datos reales y sin tocar la web pública.
 */
import assert from "node:assert/strict";
import {test} from "node:test";
import {createKvMediaAdapter,MAX_IMAGE_BYTES} from "./qa-candidates/kv-media-adapter.js";

const A="00000000-0000-4000-8000-000000000801";
const B="00000000-0000-4000-8000-000000000802";
const PHOTO="moments/"+A+"/"+B+".png";
const EVENT="media/events/"+B+".jpg";
const LOGO="logos/"+A+".webp"; // extensión no permitida para logo original

class FakeKV{
  constructor(maxBytes=MAX_IMAGE_BYTES+100){this.objects=new Map();this.maxBytes=maxBytes;this.reads=0;this.writes=0;this.deletes=0;}
  async getWithMetadata(key,options){
    assert.equal(options.type,"arrayBuffer");
    assert.equal(options.cacheTtl,30);
    this.reads++;
    const entry=this.objects.get(key);
    return entry?{value:entry.bytes.slice().buffer,metadata:{...entry.metadata}}:{value:null,metadata:null};
  }
  async put(key,bytes,options){
    const value=new Uint8Array(bytes).slice();
    const previous=this.objects.get(key)?.bytes.byteLength||0;
    const total=[...this.objects.values()].reduce((n,item)=>n+item.bytes.byteLength,0)-previous+value.length;
    if(total>this.maxBytes)throw new Error("Free quota exceeded");
    this.objects.set(key,{bytes:value,metadata:{...options.metadata}});
    this.writes++;
  }
  async delete(key){this.deletes++;this.objects.delete(key);}
}
const bytes=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,1]);
test("adaptador sin binding KV real rechaza inicialización",()=>{
 assert.throws(()=>createKvMediaAdapter(null),/KV válido/);
});
test("modo lectura impide PUT y DELETE sin consumir cuota",async()=>{
 const kv=new FakeKV(),store=createKvMediaAdapter(kv);
 assert.equal(await store.get(PHOTO),null);
 await assert.rejects(store.put(PHOTO,bytes,{httpMetadata:{contentType:"image/png"}}),/solo lectura/);
 await assert.rejects(store.delete(PHOTO),/solo lectura/);
 assert.equal(kv.writes,0);assert.equal(kv.deletes,0);
});
test("subir/leer/borrar PNG conserva todos los bytes y metadatos",async()=>{
 const kv=new FakeKV(),store=createKvMediaAdapter(kv,{allowWrites:true});
 await store.put(PHOTO,bytes.buffer,{httpMetadata:{contentType:"image/png"}});
 const found=await store.get(PHOTO);
 assert.equal(found.httpMetadata.contentType,"image/png");
 assert.equal(found.size,bytes.byteLength);
 assert.deepEqual(new Uint8Array(found.body),bytes);
 assert.equal(kv.writes,1);
 await store.delete(PHOTO);
 assert.equal(await store.get(PHOTO),null);
 assert.equal(kv.deletes,1);
});
test("rechaza rutas maliciosas, categorías desconocidas y MIME incorrecto",async()=>{
 const kv=new FakeKV(),store=createKvMediaAdapter(kv,{allowWrites:true});
 await assert.rejects(store.put("../../private.png",bytes,{httpMetadata:{contentType:"image/png"}}),/Ruta/);
 await assert.rejects(store.put("media/users/"+A+".png",bytes,{httpMetadata:{contentType:"image/png"}}),/Ruta/);
 await assert.rejects(store.put(EVENT,bytes,{httpMetadata:{contentType:"image/png"}}),/MIME/);
 await assert.rejects(store.put(LOGO,bytes,{httpMetadata:{contentType:"image/webp"}}),/Ruta/);
 await assert.rejects(store.delete("moments/../../private.png"),/Ruta/);
 assert.equal(await store.get("../../private.png"),null);
 assert.equal(kv.writes+kv.deletes,0);
});
test("rechaza imágenes vacías, excesivas y datos que no sean binarios",async()=>{
 const kv=new FakeKV(),store=createKvMediaAdapter(kv,{allowWrites:true});
 const mime={httpMetadata:{contentType:"image/png"}};
 await assert.rejects(store.put(PHOTO,new Uint8Array(),mime),/límite/);
 await assert.rejects(store.put(PHOTO,new Uint8Array(MAX_IMAGE_BYTES+1),mime),/límite/);
 await assert.rejects(store.put(PHOTO,"not-a-file",mime),/binaria/);
 assert.equal(kv.writes,0);
});
test("no acepta cabeceras falsificadas ni archivos truncados en PUT",async()=>{
 const kv=new FakeKV(),store=createKvMediaAdapter(kv,{allowWrites:true});
 const mime={httpMetadata:{contentType:"image/png"}};
 await assert.rejects(store.put(PHOTO,new Uint8Array([1,2,3,4,5,6,7,8]),mime),/Firma/);
 await assert.rejects(store.put(PHOTO,new Uint8Array([137,80,78,71]),mime),/Firma/);
 await assert.rejects(store.put(EVENT,new Uint8Array([255,216,0,1]),{
   httpMetadata:{contentType:"image/jpeg"}}),/Firma/);
 assert.equal(kv.writes,0);
});
test("JPEG y WebP válidos mantienen bytes y MIME correctos",async()=>{
 const kv=new FakeKV(),store=createKvMediaAdapter(kv,{allowWrites:true});
 const jpeg=new Uint8Array([255,216,255,217]);
 const webp=new Uint8Array([82,73,70,70,4,0,0,0,87,69,66,80,0,0]);
 const other="media/rewards/"+A+".webp";
 await store.put(EVENT,jpeg,{httpMetadata:{contentType:"image/jpeg"}});
 await store.put(other,webp,{httpMetadata:{contentType:"image/webp"}});
 assert.deepEqual(new Uint8Array((await store.get(EVENT)).body),jpeg);
 assert.deepEqual(new Uint8Array((await store.get(other)).body),webp);
 assert.equal((await store.get(EVENT)).httpMetadata.contentType,"image/jpeg");
 assert.equal((await store.get(other)).httpMetadata.contentType,"image/webp");
});
test("GET rechaza valores KV corruptos aunque declaren MIME correcto",async()=>{
 const kv=new FakeKV(),store=createKvMediaAdapter(kv,{allowWrites:true});
 kv.objects.set(PHOTO,{bytes:new Uint8Array([60,104,116,109,108,62]),metadata:{contentType:"image/png"}});
 assert.equal(await store.get(PHOTO),null);
 kv.objects.set(PHOTO,{bytes:new Uint8Array(MAX_IMAGE_BYTES+1),metadata:{contentType:"image/png"}});
 assert.equal(await store.get(PHOTO),null);
 kv.objects.set(PHOTO,{bytes,metadata:{contentType:"image/jpeg"}});
 assert.equal(await store.get(PHOTO),null);
});
test("cuota agotada rechaza operación sin almacenar un archivo parcial",async()=>{
 const kv=new FakeKV(8),store=createKvMediaAdapter(kv,{allowWrites:true});
 await assert.rejects(store.put(PHOTO,bytes,{httpMetadata:{contentType:"image/png"}}),/quota exceeded/);
 assert.equal(kv.objects.size,0);
});
test("MIME alterado en KV no se entrega como imagen",async()=>{
 const kv=new FakeKV(),store=createKvMediaAdapter(kv,{allowWrites:true});
 kv.objects.set(PHOTO,{bytes,metadata:{contentType:"text/html"}});
 assert.equal(await store.get(PHOTO),null);
});
console.log("KV: ensayos locales ficticios, sin conexiones ni mutaciones remotas");
