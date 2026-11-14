/* Bellaquitas: comprobaciones SIN DB real de enlaces multimedia públicos. */
import assert from "node:assert/strict";
import {test} from "node:test";
import {readFileSync} from "node:fs";
import {stripRetiredStorage} from "./qa-candidates/public-no-legacy-media.js";
const original="https://vlsipvngvxcgnwrhpjgg.supabase.co/storage/v1/object/public/bellaquitas-media/logos/old.png";
const bad="https://vlsipvngvxcgnwrhpjgg.supabase.co/storage/v1/object/public/bellaquitas-media/logos/photo.webp";
test("logo de la portada se sustituye SOLO en respuesta, no se borra",()=>{
 const site={
  key:"homepage",page_settings: {
   logo_url:original,header_logo_url:original,hero_video_url:"assets/bellaquitas fiesta portada.mp4",
   experience_video_url:"assets/bellaquitas-fiesta-fondo.mp4",
   translations:{es:{caption:"Original"},fr:{caption:"Original"}},
   blocks:[{photo_url:bad},{logo_url:original}]
  }
 };
 const snap=JSON.stringify(site);
 const clean=stripRetiredStorage(site);
 assert.equal(clean.page_settings.logo_url,"/assets/logo-bellaquitas.webp");
 assert.equal(clean.page_settings.header_logo_url,"/assets/logo-navbar.png");
 assert.equal(clean.page_settings.hero_video_url,site.page_settings.hero_video_url);
 assert.equal(clean.page_settings.experience_video_url,site.page_settings.experience_video_url);
 assert.equal(clean.page_settings.translations.fr.caption,"Original");
 assert.equal(clean.page_settings.blocks[0].photo_url,"");
 assert.equal(clean.page_settings.blocks[1].logo_url,"/assets/logo-bellaquitas.webp");
 assert.equal(JSON.stringify(site),snap,"La respuesta no debe mutar origen D1");
 assert.doesNotMatch(JSON.stringify(clean),/supabase\.co/i);
});
test("evento viejo sin imagen; evento nuevo conserva imagen original",()=>{
 const [old,newer]=stripRetiredStorage([
  {id:"a",image_url:bad,localized_content:{fr:{name:"Concert"}}},
  {id:"b",image_url:"/assets/logo-bellaquitas.webp",localized_content:{fr:{name:"Soirée"}}}
 ]);
 assert.equal(old.image_url,"");
 assert.equal(old.localized_content.fr.name,"Concert");
 assert.equal(newer.image_url,"/assets/logo-bellaquitas.webp");
 assert.equal(newer.localized_content.fr.name,"Soirée");
});
test("no interceptar dominios ajenos parecidos ni texto plano",()=>{
 const sample={message:"Hola Supabase no es una URL",
  image_url:"https://supabase.co.evil.test/asset.png",
  photo_url:"https://images.example.org/test.jpg"};
 assert.deepEqual(stripRetiredStorage(sample),sample);
});
test("las rutas públicas incluyen el sanitizador en el worker ensamblado",()=>{
 const worker=readFileSync("cloudflare/qa-candidates/bellaquitas-api-staging-admin.js","utf8");
 const assembler=readFileSync("cloudflare/assemble-admin-candidate.mjs","utf8");
 assert.match(worker,/import \{stripRetiredStorage\} from "\.\/public-no-legacy-media\.js"/);
 assert.match(worker,/return stripRetiredStorage\(item\)/);
 assert.match(assembler,/\["public-no-legacy-media\.js","public-no-legacy-media\.js"\]/);
});
console.log("OK: portada, eventos, vídeos y francés sin URLs de servicio retirado ni mutaciones.");
