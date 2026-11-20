#!/usr/bin/env node
/**
 * E2E en Cloudflare staging con ADMIN SINTÉTICO interceptado solo por Playwright.
 * Sin contraseñas, sesiones reales, modificaciones D1 ni cookies de usuarios.
 * Ejercita de verdad iframe /espejo/#/editor, modelos y menú lateral móvil.
 */
import assert from "node:assert/strict";
import {chromium,devices} from "playwright";

const BASE="https://bellaquitas-api-staging.bellaquitas-fest-410.workers.dev";
const admin={
 id:"11111111-1111-4111-8111-111111111111",
 name:"Administrador de prueba",
 role:"admin",
 points:0,lifetime_points:0,visits:0,
 member_code:"QA-ONLY",created_at:"2026-01-01T12:00:00Z"
};
const userResponse=(url)=>{
 const p=new URL(url).pathname;
 if(p==="/v1/admin/session")return {authorized:true,profile:admin};
 if(p==="/v1/auth/me")return {authenticated:true,profile:admin};
 if(p==="/v1/auth/email/status")return {login:false,registration:false,adminLink:false};
 if(p==="/v1/site")return {site:{hero_text:"Bellaquitas Fest",announcement:"Vive el momento",page_settings:{},updated_at:"2026-01-01T12:00:00Z"}};
 if(p==="/v1/admin/members"||p==="/v1/door/members")return {items:[admin]};
 if(p==="/v1/mirror/admin/community")return {albums:[],photos:[],suggestions:[]};
 return {items:[]};
};
const browser=await chromium.launch({headless:true});
try{
 const ctx=await browser.newContext({viewport:{width:1440,height:900},locale:"es-ES",reducedMotion:"reduce",serviceWorkers:"block"});
 await ctx.addInitScript(()=>sessionStorage.setItem("bf_admin_tab_login","1"));
 await ctx.route(url=>url.origin===BASE&&url.pathname.startsWith("/v1/"),async route=>{
  if(!["GET","HEAD"].includes(route.request().method()))return route.fulfill({status:403,body:"Bloqueo de escritura QA"});
  const data=userResponse(route.request().url());
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(data)});
 });
 const page=await ctx.newPage();
 const writes=[],errors=[];
 page.on("request",r=>{
  if(r.url().startsWith(BASE+"/")&&!["GET","HEAD","OPTIONS"].includes(r.method()))
   writes.push({path:new URL(r.url()).pathname,method:r.method()});
 });
 page.on("pageerror",e=>errors.push(e.message));
 const response=await page.goto(BASE+"/administracion/",{waitUntil:"domcontentloaded",timeout:60000});
 assert.equal(response.status(),200);
 await page.locator("#workspace").waitFor({state:"visible",timeout:25000});
 await page.locator('[data-tab="site"]').click();
 const frame=page.frameLocator("#siteVisualEditor");
 await frame.locator('.editor-toolbar').waitFor({state:"visible",timeout:45000});
 assert.match(await frame.locator('.editor-preview-head').innerText(),/Vista previa/);
 await frame.locator('[data-action="editor-category"][data-category="design"]').click();
 await frame.locator('.editor-theme[data-theme="minimal"]').waitFor({state:"visible",timeout:15000});
 await frame.locator('.editor-theme[data-theme="minimal"]').click();
 assert.match(await frame.locator('.editor-theme[data-theme="minimal"]').getAttribute("class")||"",/chosen/);
 // Clicking the account logo must return to the public Inicio, not /panel.
 await frame.locator('.side-head a.brand').click();
 await frame.locator('.bf-hero-video').first().waitFor({state:"attached",timeout:10000});
 assert.equal(new URL(page.frames().find(f=>f.url().includes("admin_embed=1"))?.url()||BASE).hash,"#/",
  "El logo de cuenta debe llevar a Inicio");
 // El iframe anidado se nutre del renderer original (y no un mock de texto).
 await frame.locator("#editor-preview").waitFor({state:"attached",timeout:15000});
 const embedded=page.locator("#siteVisualEditor");
 assert.equal(new URL(await embedded.getAttribute("src"),BASE).pathname,"/espejo/");
 assert.equal(new URL(await embedded.getAttribute("src"),BASE).searchParams.get("admin_embed"),"1");
 // El menú móvil no debe verse en PC; al reducir anchura abre lateral real.
 await page.setViewportSize({width:390,height:844});
 const toggle=page.locator("#adminNavToggle");
 await toggle.waitFor({state:"visible",timeout:15000});
 await toggle.click();
 assert.equal(await toggle.getAttribute("aria-expanded"),"true");
 assert.match(await page.locator("body").getAttribute("class")||"",/admin-menu-open/);
 await page.locator('#adminNav [data-tab="events"]').click();
 assert.equal(await toggle.getAttribute("aria-expanded"),"false");
 assert.equal(await page.locator('[data-page="events"]').isVisible(),true);
 const eventsFrame=page.locator("#eventsVisualPreview");
 await eventsFrame.waitFor({state:"visible",timeout:10000});
 assert.equal(new URL(await eventsFrame.getAttribute("src"),BASE).hash,"#/eventos");
 assert.equal(await page.locator('#adminNav').evaluate(el=>getComputedStyle(el).display),"none");
 // Visitante anónimo no obtiene derechos: el mock de browser NO llega a D1.
 assert.deepEqual(writes,[],"Navegación del editor nunca debe modificar cuentas");
 assert.deepEqual(errors,[],"Errores JavaScript del editor: "+errors.join("; "));
 console.log("OK: editor completo original en iframe, modelos, vista previa, menú lateral móvil; 0 POST reales, 0 cuentas.");
 await ctx.close();
}finally{await browser.close()}
