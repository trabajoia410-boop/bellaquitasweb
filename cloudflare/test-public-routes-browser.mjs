#!/usr/bin/env node
/** Bellaquitas Fest: QA de todas las rutas públicas ES/FR en staging.
 * Sin cookies de usuario, credenciales, canjes ni escritura en D1.
 * Solo emulación Playwright (no sustituye teléfonos físicos).
 */
import assert from 'node:assert/strict';
import {chromium,webkit,devices} from 'playwright';
const ORIGIN='https://bellaquitas-api-staging.bellaquitas-fest-410.workers.dev';
const ROUTES=['/','/experiencia','/eventos','/ventajas','/preguntas',
 '/sugerencias','/moments','/club','/acceso','/registro','/recuperar'];
const CASES=[
 {name:'iPhone13',engine:webkit,context:devices['iPhone 13']},
 {name:'Pixel7',engine:chromium,context:devices['Pixel 7']},
 {name:'Desktop',engine:chromium,context:{viewport:{width:1440,height:900},deviceScaleFactor:1}}
];
let checks=0;
for(const c of CASES){
 const browser=await c.engine.launch({headless:true});
 try{
  const context=await browser.newContext({...c.context,locale:'es-ES',reducedMotion:'reduce'});
  try{
   const page=await context.newPage(),writeRequests=[],forbiddenProviders=[];
   page.on('request',r=>{
    const url=new URL(r.url());
    if(url.origin===ORIGIN&&!['GET','HEAD','OPTIONS'].includes(r.method()))
     writeRequests.push({path:url.pathname,method:r.method()});
    if(/(^|\\.)(supabase\\.co|supabase\\.com|r2\\.dev|cloudflarestorage\\.com|esm\\.sh)$/i.test(url.hostname))
     forbiddenProviders.push(url.hostname);
   });
   const nav=await page.goto(ORIGIN+'/espejo/',{waitUntil:'domcontentloaded',timeout:60000});
   assert.equal(nav.status(),200,'El espejo debe abrir antes de recorrer rutas');
   await page.locator('.lang-choice[data-lang="fr"]').first().waitFor({timeout:30000});
   for(const lang of ['es','fr']){
    await page.locator('.lang-choice[data-lang="'+lang+'"]').first().click();
    await page.waitForFunction(l=>document.documentElement.lang===l,lang,{timeout:15000});
    for(const route of ROUTES){
     await page.evaluate(route=>{location.hash='#'+route;},route);
     await page.waitForTimeout(450);
     const info=await page.evaluate(()=>{
      const doc=document.documentElement,app=document.querySelector('#app');
      return {lang:doc.lang,over:doc.scrollWidth-doc.clientWidth,
       header:!!app?.querySelector('.site-header'),textLen:(app?.textContent||'').trim().length,
       authForm:!!app?.querySelector('#auth-form'),
       suggestionsForm:!!app?.querySelector('#community-suggestion-form'),
       labels:[...(app?.querySelectorAll('#auth-form label')||[])].map(x=>x.textContent.trim()),
       nav:[...(app?.querySelectorAll('.bf-desktop-nav a.nav-link')||[])].map(x=>({href:x.getAttribute('href'),text:x.textContent.trim()})),
       menuText:(app?.querySelector('#site-menu')?.textContent||'').replace(/\\s+/g,' ').trim()};
     });
     assert.equal(info.lang,lang,'Idioma incorrecto: '+route+' '+c.name);
     assert.equal(info.header,true,'Falta cabecera: '+route+' '+c.name);
     assert.ok(info.textLen>100,'Página vacía: '+route+' '+c.name);
     assert.ok(info.over<=8,'Desbordamiento '+info.over+'px: '+c.name+' '+route+' '+lang);
     const home=info.nav.find(item=>item.href==='#/');
     assert.equal(home?.text,lang==='fr'?'Accueil':'Inicio','Traducción inicio: '+c.name+' '+route+' '+lang);
     if(lang==='fr'){
      for(const [href,expected] of [['#/experiencia','Expériences'],['#/eventos','Événements'],['#/ventajas','Avantages'],['#/preguntas','Questions']]){
       const link=info.nav.find(item=>item.href===href);
       if(link)assert.equal(link.text,expected,'Traducción navegación '+href+' '+c.name+' '+route);
      }
      for(const untranslated of ['Comparte tus ideas','Fotografías de nuestros eventos','Nuestras redes oficiales'])
       assert.ok(!info.menuText.includes(untranslated),'Menú sin traducir: '+untranslated+' '+c.name+' '+route);
     }
     if(['/acceso','/registro','/recuperar'].includes(route)){
      assert.equal(info.authForm,true,'Falta formulario de acceso en '+route+' '+c.name);
      if(lang==='fr'){
       const joined=info.labels.join(' | ');
       assert.ok(!joined.includes('Correo electrónico')&&!joined.includes('Contraseña')&&!joined.includes('Repetir contraseña'),
        'El formulario no está traducido al francés: '+route+' '+joined);
      }
     }
     if(route==='/sugerencias')
      assert.equal(info.suggestionsForm,true,'Falta formulario de sugerencias: '+c.name+' '+lang);
     checks++;
    }
   }
   assert.deepEqual(writeRequests,[],'Una navegación anónima no debe enviar escrituras al Worker');
   assert.deepEqual(forbiddenProviders,[],'La web Cloudflare no debe pedir recursos al antiguo backend, R2 o esm.sh');
   console.log('OK:',c.name,'rutas ES/FR',ROUTES.length*2,'sin escrituras y sin desbordamiento');
  }finally{await context.close();}
 }finally{await browser.close();}
}
assert.equal(checks,ROUTES.length*2*CASES.length);
console.log('OK: '+checks+' combinaciones ruta/idioma/navegador en staging (sin datos personales).');
