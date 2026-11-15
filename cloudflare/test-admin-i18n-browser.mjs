#!/usr/bin/env node
/**
 * QA del panel independiente ES/FR sin credenciales ni acceso a D1.
 * Las respuestas HTTP se simulan dentro de Playwright, en un dominio .invalid.
 * Comprueba el HTML REAL de adminConsoleRoute (incluyendo CSP nonce).
 */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {adminConsoleRoute} from './admin-console.js';

const BASE='https://admin-qa.invalid';
const req=new Request(BASE+'/administracion/');
const response=adminConsoleRoute(req);
assert.equal(response.status,200);
assert.match(response.headers.get('content-security-policy')||'',/script-src 'nonce-[^']+'/);
const html=await response.text();
assert.match(html,/id="bq-admin-language"/.source ? /<script nonce="[^"]+">/ : /<script nonce="[^"]+">/);
assert.ok(!html.includes('supabase.co'));
assert.ok(html.includes('ADMINISTR')||html.includes('Administración'));

const browser=await chromium.launch({headless:true});
try{
 for(const viewport of [{width:390,height:844},{width:1440,height:900}]){
  const context=await browser.newContext({viewport,locale:'es-ES'});
  try{
   const page=await context.newPage();
   const postRequests=[],unknown=[];
   await page.route(BASE+'/**', async route=>{
    const req=route.request(),url=new URL(req.url()),method=req.method();
    if(method!=='GET'){postRequests.push(url.pathname);return route.fulfill({status:405,body:'Método no permitido'});}
    if(url.pathname==='/administracion/')return route.fulfill({status:200,contentType:'text/html; charset=utf-8',headers:{'content-security-policy':response.headers.get('content-security-policy')||''},body:html});
    if(url.pathname==='/v1/auth/email/status')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({login:false,registration:false,adminLink:false})});
    if(url.pathname==='/v1/admin/session')return route.fulfill({status:401,contentType:'application/json',body:'{"error":"No autorizado"}'});
    unknown.push(url.pathname);
    return route.abort();
   });
   const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(BASE+'/administracion/',{waitUntil:'domcontentloaded',timeout:30000});
   const toggle=page.locator('#bq-admin-language');
   await toggle.waitFor({timeout:10000});
   assert.equal(await page.locator('html').getAttribute('lang'),'es');
   assert.equal((await page.locator('#login h1').textContent()).trim(),'Panel de administrador');

   // No modificar valores escritos al alternar idioma.
   await page.locator('#email').fill('simulado@example.invalid');
   await toggle.locator('button[data-lang="fr"]').click();
   await page.waitForFunction(()=>document.documentElement.lang==='fr');
   await page.waitForFunction(()=>document.querySelector('#login h1')?.textContent?.trim()==='Panneau d’administration');
   assert.equal((await page.locator('aside [data-tab="site"]').textContent()).trim(),'Modifier le site');
   assert.equal((await page.locator('aside [data-tab="security"]').textContent()).trim(),'Sécurité');
   assert.equal((await page.locator('#emailHelp').textContent()).trim(),'La connexion par e-mail n’est pas encore activée ; utilisez Google.');
   assert.equal(await page.locator('#email').inputValue(),'simulado@example.invalid');

   // No traducir nombres, datos de socios ni contenido del editor.
   await page.locator('#identity').evaluate(el=>el.textContent='PERSONA FICTICIA');
   await page.locator('#memberSelect').evaluate(el=>{const o=document.createElement('option');o.textContent='SOCIO FICTICIO';el.appendChild(o);});
   await page.waitForTimeout(50);
   assert.equal(await page.locator('#identity').textContent(),'PERSONA FICTICIA');
   assert.equal(await page.locator('#memberSelect option:last-child').textContent(),'SOCIO FICTICIO');

   // Volver a español manteniendo estado y sin acceder a datos reales.
   await toggle.locator('button[data-lang="es"]').click();
   await page.waitForFunction(()=>document.documentElement.lang==='es');
   await page.waitForFunction(()=>document.querySelector('#login h1')?.textContent?.trim()==='Panel de administrador');
   assert.equal((await page.locator('aside [data-tab="site"]').textContent()).trim(),'Editar web');
   assert.equal(await page.locator('#email').inputValue(),'simulado@example.invalid');
   const over=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
   assert.ok(over<=8,'Panel admin tiene desbordamiento horizontal de '+over+'px');
   assert.deepEqual(postRequests,[],'El test de idiomas NO puede escribir');
   assert.deepEqual(unknown,[],'Endpoint inesperado');
   assert.deepEqual(errors,[],'Error de JavaScript: '+errors.join('; '));
   console.log('OK: admin ES/FR, CSP, datos ficticios intactos, sin escrituras, viewport',viewport.width);
  }finally{await context.close();}
 }
}finally{await browser.close();}
