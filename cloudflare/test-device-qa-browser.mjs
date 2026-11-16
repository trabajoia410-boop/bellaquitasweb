#!/usr/bin/env node
/** Bellaquitas Fest: inspección REAL HTTPS del diagnóstico QA en Safari y Chrome simulados.
 * Sin cámara física, cuentas ni escrituras. Esta prueba nunca acredita el control
 * de puerta real; comprueba ES/FR, QR sintético, vídeo alojado y aislamiento.
 */
import assert from 'node:assert/strict';
import {chromium,webkit,devices} from 'playwright';
const BASE='https://bellaquitas-device-qa.bellaquitas-fest-410.workers.dev';
const MEDIA='https://bellaquitas-media-qa.bellaquitas-fest-410.workers.dev';
const environments=[
 ['iPhone13-WebKit',webkit,devices['iPhone 13']],
 ['Pixel7-Chromium',chromium,devices['Pixel 7']],
 ['Desktop-Chromium',chromium,{viewport:{width:1440,height:900},deviceScaleFactor:1}]
];
for(const [label,engine,settings] of environments){
 const browser=await engine.launch({headless:true});
 try{
  const ctx=await browser.newContext({...settings,locale:'es-ES'});
  const page=await ctx.newPage();
  const writes=[],forbidden=[],mediaRequests=[],failedMedia=[],errors=[];
  page.on('request',request=>{
   const url=request.url();
   if(!['GET','HEAD'].includes(request.method()))writes.push({method:request.method(),url});
   if(/bellaquitas\.fr|supabase\.co|r2\.cloudflarestorage|api\.github\.com/.test(url))forbidden.push(url);
   if(url.startsWith(MEDIA+'/assets/'))mediaRequests.push(url);
  });
  page.on('requestfailed',request=>{
   if(request.url().startsWith(MEDIA+'/assets/'))failedMedia.push({url:request.url().split('/').pop(),reason:request.failure()});
  });
  page.on('pageerror',error=>errors.push(String(error.message)));
  const nav=await page.goto(BASE+'/',{waitUntil:'domcontentloaded',timeout:30000});
  assert.equal(nav.status(),200,'HTTPS QA no disponible');
  await page.waitForFunction(()=>typeof window.jsQR==='function',{timeout:15000});
  assert.equal(await page.locator('html').getAttribute('lang'),'es');
  assert.equal(await page.locator('#qaSampleQr').getAttribute('width'),'198');
  await page.locator('#testDecoder').click();
  await page.waitForFunction(()=>document.querySelector('#decoderStatus')?.textContent?.includes('lector QR funciona'),
   null,{timeout:15000});
  assert.ok((await page.locator('#decoderStatus').textContent()).includes('lector QR funciona'));
  assert.equal(await page.locator('#start').isEnabled(),true,'La cámara no se inicia automáticamente');
  const source=await page.locator('#original').getAttribute('src');
  assert.ok(source.startsWith(MEDIA+'/assets/'),'Vídeo sólo desde Static Assets');
  assert.equal(await page.locator('#original').getAttribute('playsinline'),'');
  assert.equal(await page.locator('#original').getAttribute('autoplay'),'');
  await page.locator('[data-lang="fr"]').click();
  assert.equal(await page.locator('html').getAttribute('lang'),'fr');
  assert.equal((await page.locator('[data-i="reportTitle"]').textContent()).trim(),'3. Résultat des vérifications');
  assert.equal((await page.locator('option[data-i="video1"]').textContent()).trim(),'Mobile 1080 × 1920');
  await page.locator('#copyReport').click();
  await page.waitForFunction(()=>document.querySelector('#report')?.textContent?.includes('Lecteur QR fictif'),null,{timeout:8000});
  assert.ok(!(await page.locator('#report').textContent()).includes('BELLAQUITAS-QA-QR-2026'),
   'No incluir el contenido QR incluso sintético en el informe');
  await page.locator('#media').selectOption('bellaquitas fiesta portada movil.mp4');
  assert.ok((await page.locator('#original').getAttribute('src')).includes('/assets/bellaquitas%20fiesta%20portada%20movil.mp4'));
  await page.waitForTimeout(1400); // Observación de red y vídeo; codecs WebKit Linux no son prueba física.
  const mediaState=await page.locator('#original').evaluate(v=>({
   readyState:v.readyState,currentTime:Number(v.currentTime.toFixed(2)),
   errorCode:v.error?.code||null
  }));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false,
   'El diagnóstico no debe tener scroll horizontal');
  assert.deepEqual(writes,[],'No hay POST ni operaciones que puedan modificar usuarios/puntos');
  assert.deepEqual(forbidden,[],'No contactar dominio público ni proveedor retirado');
  assert.ok(mediaRequests.length>0,'Debe intentar reproducir los vídeos desde media QA');
  assert.ok(!failedMedia.some(x=>/Cross-Origin-Resource-Policy|NotSameOrigin/i.test(JSON.stringify(x))),
   'Los MP4 públicos no deben bloquearse por políticas entre Workers');
  assert.deepEqual(errors,[],'El navegador debe poder ejecutar el diagnóstico');
  await ctx.close();
  console.log(JSON.stringify({device:label,qa:'OK',qrSynthetic:'OK',esFr:'OK',noWrites:true,
   mediaRequests:mediaRequests.length,failedMedia:failedMedia.slice(0,2),video:mediaState}));
 }finally{await browser.close();}
}
console.log('OK: QR sintético y reportes ES/FR en Safari/Chrome simulados, sin HTTP POST, sin usuarios. NO es prueba de cámara física.');
