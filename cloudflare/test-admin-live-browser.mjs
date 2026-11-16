#!/usr/bin/env node
/**
 * Contrato de administración ES/FR PUBLICADO en Cloudflare staging.
 * Solo GET sin cookie ni credenciales: nunca ejecuta login, OAuth, POST,
 * registro, mutaciones, envío de emails, cambios de puntos ni perfiles.
 */
import assert from 'node:assert/strict';
import {chromium,webkit,devices} from 'playwright';
const BASE='https://bellaquitas-api-staging.bellaquitas-fest-410.workers.dev';
for(const [name,engine,device] of [
 ['iPhone-WebKit',webkit,devices['iPhone 13']],
 ['Android-Chromium',chromium,devices['Pixel 7']],
 ['Desktop-Chromium',chromium,{viewport:{width:1440,height:900},deviceScaleFactor:1}]
]){
 const browser=await engine.launch({headless:true});
 try{
  const ctx=await browser.newContext({...device,locale:'es-ES',serviceWorkers:'block'});
  const page=await ctx.newPage(),writes=[],outgoing=[],jsErrors=[];
  page.on('request',r=>{
   if(!['GET','HEAD'].includes(r.method()))writes.push({method:r.method(),path:r.url()});
   if(r.url().startsWith('https://')&&!r.url().startsWith(BASE+'/'))outgoing.push(r.url().split('?')[0]);
  });
  page.on('pageerror',e=>jsErrors.push(e.message));
  const response=await page.goto(BASE+'/administracion/',{waitUntil:'domcontentloaded',timeout:30000});
  assert.equal(response.status(),200,'Staging admin no está online');
  const h=response.headers();
  assert.match(h['content-security-policy']||'',/script-src 'nonce-/);
  assert.match(h['content-security-policy']||'',/frame-ancestors 'none'/);
  assert.match(h['x-robots-tag']||'',/noindex/i);
  assert.equal(h['set-cookie'],undefined,'GET anónimo nunca crea sesión');
  await page.locator('#login h1').waitFor({timeout:15000});
  await page.locator('#bq-admin-language').waitFor({timeout:10000});
  const fr=page.locator('#bq-admin-language button[data-lang="fr"]');
  await page.locator('#email').fill('ficticio@example.invalid'); // Nunca se envía.
  await fr.click();
  await page.waitForFunction(()=>document.documentElement.lang==='fr');
  await page.waitForFunction(()=>document.querySelector('#login h1')?.textContent?.trim()==='Panneau d’administration');
  assert.equal((await page.locator('aside [data-tab="site"]').textContent()).trim(),'Modifier le site');
  assert.equal((await page.locator('aside [data-tab="security"]').textContent()).trim(),'Sécurité');
  assert.equal(await page.locator('#email').inputValue(),'ficticio@example.invalid');
  await page.locator('#bq-admin-language button[data-lang="es"]').click();
  await page.waitForFunction(()=>document.documentElement.lang==='es');
  await page.waitForFunction(()=>document.querySelector('#login h1')?.textContent?.trim()==='Panel de administrador');
  assert.equal(await page.locator('#email').inputValue(),'ficticio@example.invalid');
  const over=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  assert.ok(over<=8,'Administración tiene overflow horizontal '+over+'px');
  assert.deepEqual(writes,[],'Prueba de interfaz no debe escribir ni llamar POST');
  assert.deepEqual(outgoing,[],'Ninguna conexión a servicios externos en interfaz anónima');
  assert.deepEqual(jsErrors,[],'Javascript con errores: '+jsErrors.join('; '));
  await ctx.close();
  console.log('OK: admin REAL staging ES/FR, viewport '+name+', CSP/nonce, sin cookies, sin POST ni salida de datos');
 }finally{await browser.close();}
}
console.log('OK: tres dispositivos emulados validan panel admin publicado sin acceder a ninguna cuenta.');
