#!/usr/bin/env node
/** Bellaquitas — CI sin red ni usuarios para la portada final Cloudflare.
 * Asegura rutas raíz, CSS/JS, ES/FR, vídeo original, QR y admin separado.
 */
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {ADDITIONAL_MEDIA} from './visual-extra-media.js';
import {productionSiteRoute} from './production-site-route.js';
import {SITE_MEDIA} from './site-media-manifest.js';

const BASE='https://bellaquitas.fr', calls=[];
const manifest={name:'Bellaquitas Fest',start_url:'./',icons:[{src:'assets/icon-192.png'}]};
const env={
 SITE_MODE:'production',
 ASSETS:{async fetch(req){
   const url=new URL(req.url);calls.push(url.pathname);
   if(['/robots.txt','/sitemap.xml'].includes(url.pathname))
     return new Response(readFileSync(url.pathname.slice(1),'utf8'),{
       status:200,headers:{'Content-Type':url.pathname.endsWith('.xml')?'application/xml':'text/plain'}
     });
   if(url.pathname==='/manifest.webmanifest')
     return new Response(JSON.stringify(manifest),{status:200,headers:{'Content-Type':'application/manifest+json'}});
   if(url.pathname.startsWith('/assets/')){
     const key=decodeURIComponent(url.pathname.slice('/assets/'.length));
     const expected=SITE_MEDIA.find(x=>x.path===key) ||
       (key===ADDITIONAL_MEDIA.path&&existsSync('assets/'+key)?ADDITIONAL_MEDIA:null);
     if(!expected)return new Response(null,{status:404});
     const range=req.headers.get('Range');
     if(range){
       const m=/^bytes=(\d+)-(\d+)$/.exec(range);
       if(!m)return new Response(null,{status:416});
       const start=Number(m[1]),end=Number(m[2]);
       return new Response(new Uint8Array(end-start+1),{status:206,
         headers:{'Content-Range':'bytes '+start+'-'+end+'/'+expected.bytes,
           'Content-Length':String(end-start+1),'Content-Type':expected.type}});
     }
     return new Response(new Uint8Array(7),{status:200,headers:{'Content-Type':expected.type}});
   }
   return new Response(null,{status:404});
 }}
};
const req=(path,options)=>new Request(BASE+path,options||{});
const get=(path,opts)=>productionSiteRoute(req(path,opts),env);

assert.equal(await productionSiteRoute(req('/'),{...env,SITE_MODE:'preproduction'}),null,
 'La preproducción queda cerrada sin dominio ni portada pública');
assert.equal(await productionSiteRoute(req('/'),{...env,SITE_MODE:undefined}),null,
 'El staging antiguo no debe exponer portada al cambiar el código');

const root=await get('/');
assert.equal(root.status,200);
assert.match(root.headers.get('Content-Type')||'',/text\/html/);
assert.equal(root.headers.get('X-Robots-Tag'),'index, follow');
const html=await root.text();
assert.match(html,/<html lang="es"/);
assert.match(html,/id="app"/);
assert.match(html,/styles\.css/);
assert.match(html,/app\.js/);
assert.match(html,/\/espejo\/auth-ui\.js/);
// La portada final debe poder atender los enlaces enviados por correo,
// no solo emitir una URL aparentemente correcta.
const verifyPage=await get('/?verify='+('A'.repeat(43))+'#/acceso');
assert.equal(verifyPage.status,200);
const resetPage=await get('/?reset_token='+('B'.repeat(43))+'#/restablecer');
assert.equal(resetPage.status,200);
const authUi=await import('./web-mirror.js').then(m=>
 m.mirrorRoute(new Request(BASE+'/espejo/auth-ui.js'),env)
);
assert.equal(authUi.status,200,'El script de recuperación existe en producción');
const authUiSource=await authUi.text();
for(const fragment of ['reset_token','verify','/v1/auth/email/reset','/v1/auth/email/verify','location.pathname+location.hash']){
 assert.ok(authUiSource.includes(fragment),'El UI de correo debe conservar '+fragment);
}
// La navegación de recuperación se sirve en el mismo origen final.
assert.match(html,/\/espejo\/admin-newtab\.js/);
assert.ok(!html.includes('PRUEBAS · SOLO LECTURA'),'Sin badge de staging');
assert.ok(!html.includes('vlsipvngvxcgnwrhpjgg.supabase.co'),'Sin backend anterior');
assert.ok(!html.includes('content="noindex,nofollow"'),'SEO de portada habilitado');
assert.ok(!html.includes('r2.dev'),'Sin R2');

for(const [path,mime] of [
 ['/styles.css','text/css'],
 ['/app.js','application/javascript'],
 ['/config.js','application/javascript'],
 ['/locale-fr.js','application/javascript'],
 ['/assets/qr-local.js','application/javascript'],
 ['/assets/jsqr-local.js','application/javascript']
]){
 const r=await get(path+'?v=1');
 assert.equal(r.status,200,'Ruta original disponible: '+path);
 assert.match(r.headers.get('Content-Type')||'',new RegExp(mime));
 assert.ok((await r.text()).length>10,'Contenido no vacío en '+path);
}
const js=await get('/app.js');
const source=await js.text();
assert.ok(source.includes('/espejo/bridge.js'),'Puente Cloudflare preservado');
assert.ok(!source.includes("await import('https://esm.sh/@supabase/supabase-js@2.118.0')"),
 'No cargar el viejo SDK de Supabase');

const media=SITE_MEDIA.find(x=>x.type==='video/mp4');
assert.ok(media);
const video=await get('/assets/'+encodeURIComponent(media.path),{headers:{Range:'bytes=0-255'}});
assert.equal(video.status,206);
assert.equal(video.headers.get('Content-Type'),'video/mp4');
assert.equal(video.headers.get('Content-Range'),'bytes 0-255/'+media.bytes);
assert.equal((await video.arrayBuffer()).byteLength,256);

// No confundir haber recuperado el JPG en Library con haberlo desplegado.
const extraJpg=await get('/assets/62609.jpg');
assert.equal(extraJpg.status,existsSync('assets/62609.jpg')?200:503,
 'El fondo lateral solo existe cuando el binario original está empaquetado');
const favicon=await get('/assets/favicon.svg');
assert.equal(favicon.status,200);
assert.equal(favicon.headers.get('Content-Type'),'image/svg+xml');
const appManifest=await get('/manifest.webmanifest');
assert.equal(appManifest.status,200);
assert.deepEqual((await appManifest.json()).name,'Bellaquitas Fest');

for(const [path,mime] of [
 ['/robots.txt','text/plain'],
 ['/sitemap.xml','application/xml']
]){
 const r=await get(path);
 assert.equal(r.status,200,'SEO original: '+path);
 assert.match(r.headers.get('Content-Type'),new RegExp(mime));
 assert.equal(await r.text(),readFileSync(path.slice(1),'utf8'),
   'El SEO tiene que ser idéntico byte a byte al original');
 const head=await get(path,{method:'HEAD'});
 assert.equal(head.status,200);
 assert.equal((await head.arrayBuffer()).byteLength,0);
}
const sw=await get('/sw.js');
assert.equal(sw.status,200);
assert.match(await sw.text(),/registration\.unregister/);

const head=await get('/',{method:'HEAD'});
assert.equal(head.status,200);
assert.equal((await head.arrayBuffer()).byteLength,0);
assert.equal((await get('/',{method:'POST'})).status,405);
assert.equal((await get('/preview')).status,404);
const oldPage=await get('/espejo/');
assert.equal(oldPage.status,308);
assert.equal(oldPage.headers.get('Location'),BASE+'/');
assert.equal(await get('/v1/auth/google/start'),null,'Auth atendida por API, no por site router');
assert.equal(await get('/v1/events'),null,'Catálogo atendido por backend');
assert.equal(await get('/administracion/'),null,'El panel es independiente');
assert.ok(calls.some(x=>x.startsWith('/assets/')),'Los bytes proceden de Static Assets');

console.log('OK: portada Cloudflare original sin badge, CSS/JS/FR/QR, vídeo Range 206, PWA, admin y APIs separados. Preproducción sigue cerrada.');
