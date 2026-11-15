#!/usr/bin/env node
/**
 * QA visual Bellaquitas — WebKit (simulación iPhone) y Chromium (Android).
 * Solo navegador anónimo en staging; nunca usa perfiles, email ni contraseñas.
 * Las capturas son de la página pública sin datos personales.
 */
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium,webkit,devices} from 'playwright';

const URL='https://bellaquitas-api-staging.bellaquitas-fest-410.workers.dev/espejo/';
const cases=[
 {label:'iPhone13-WebKit',engine:webkit,device:'iPhone 13',mobile:true},
 {label:'Pixel7-Chromium',engine:chromium,device:'Pixel 7',mobile:true},
 {label:'Desktop-Chromium',engine:chromium,device:null,mobile:false}
];
const sleep=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
mkdirSync('qa-browser',{recursive:true});
for(const item of cases){
 const browser=await item.engine.launch({headless:true});
 try{
  const config=item.device?devices[item.device]:{viewport:{width:1440,height:900},deviceScaleFactor:1};
  assert.ok(config,'Preset de dispositivo no disponible: '+item.device);
  const context=await browser.newContext({...config,locale:'es-ES',reducedMotion:'reduce'});
  try{
   const page=await context.newPage();
   const visited=[];
   page.on('request',r=>{
    if(r.method()==='POST')visited.push({method:r.method(),domain:new URL(r.url()).hostname});
   });
   const response=await page.goto(URL,{waitUntil:'domcontentloaded',timeout:60000});
   assert.equal(response.status(),200,'El espejo no carga: '+item.label);
   await page.locator('#app .site-header').first().waitFor({timeout:30000});
   await page.locator('.lang-choice[data-lang="fr"]').first().waitFor({timeout:30000});
   await sleep(600);
   const metrics=await page.evaluate(()=>{
    const w=document.documentElement.clientWidth,sw=document.documentElement.scrollWidth;
    const menu=document.querySelector('#app .site-header button.menu-toggle');
    const nav=document.querySelector('#app .site-header .main-nav');
    const hero=document.querySelector('video.bf-hero-video');
    const lower=document.querySelector('video.bf-after-marquee-video');
    const isVisible=el=>el&&getComputedStyle(el).display!=='none'&&getComputedStyle(el).visibility!=='hidden'&&el.getBoundingClientRect().width>0;
    return {
     title:document.title,lang:document.documentElement.lang,
     width:w,scrollWidth:sw,overflow:sw-w,
     hamburgerVisible:!!isVisible(menu),
     navOpen:!!nav?.classList.contains('open'),
     heroVideo:hero?{muted:hero.muted,autoplay:hero.autoplay,loop:hero.loop,inline:hero.playsInline,
      source:hero.currentSrc||hero.getAttribute('src')||''}:null,
     lowerVideo:lower?{muted:lower.muted,autoplay:lower.autoplay,loop:lower.loop,inline:lower.playsInline,
      src:lower.getAttribute('src')||'',mobileSource:lower.querySelector('source[media]')?.getAttribute('src')||'',
      desktopSource:lower.querySelector('source:not([media])')?.getAttribute('src')||''}:null
    };
   });
   assert.match(metrics.title,/Bellaquitas/i);
   assert.ok(metrics.overflow<=8,'Desbordamiento horizontal en '+item.label+': '+metrics.overflow+'px');
   if(item.mobile){
    assert.equal(metrics.hamburgerVisible,true,'Faltan las tres barras en '+item.label);
    assert.equal(metrics.navOpen,false,'El menú móvil debe empezar cerrado');
   }
   assert.equal(metrics.heroVideo?.muted,true,'Vídeo de portada no silenciado');
   assert.equal(metrics.heroVideo?.inline,true,'Falta playsinline en portada');
   assert.equal(metrics.lowerVideo?.muted,true,'Vídeo bajo banda no silenciado');
   assert.equal(metrics.lowerVideo?.inline,true,'Falta playsinline en vídeo bajo banda');
   if(metrics.lowerVideo?.src){
    const expected=item.mobile?metrics.lowerVideo.mobileSource:metrics.lowerVideo.desktopSource;
    assert.equal(metrics.lowerVideo.src,expected,
      'Safari/Chrome ha elegido vídeo incorrecto bajo la banda amarilla');
   }
   await page.screenshot({path:'qa-browser/'+item.label+'-ES.png',fullPage:false,animations:'disabled',timeout:30000});
   await page.locator('.lang-choice[data-lang="fr"]').first().click({timeout:15000});
   await page.waitForFunction(()=>document.documentElement.lang==='fr',null,{timeout:15000});
   await sleep(300);
   await page.screenshot({path:'qa-browser/'+item.label+'-FR.png',fullPage:false,animations:'disabled',timeout:30000});
   // Solo lectura: no iniciar sesión, no cambiar datos, no pulsar "Registrar".
   assert.equal(visited.length,0,'La página anónima no debe enviar POST durante la inspección: '+item.label);
   console.log('OK:',item.label,JSON.stringify({...metrics,langAfter:'fr',postRequests:0,
    captures:2}));
  }finally{await context.close()}
 }finally{await browser.close()}
}
console.log('OK: QA visual en 3 entornos / 6 capturas ES-FR, sin sesiones ni escritura. No sustituye pruebas físicas reales.');
