/**
 * Bellaquitas Fest — prueba E2E del espejo Cloudflare en Chromium.
 * 
 * Solo abre páginas PÚBLICAS, navega y cambia idioma en localStorage del
 * navegador efímero. NUNCA inicia sesión, envía formularios ni modifica datos.
 * 
 * npm install --no-save --no-package-lock --ignore-scripts playwright-core@1.56.1
 * node cloudflare/test-browser-staging.mjs
 */
import assert from "node:assert/strict";
import {chromium} from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const BASE="https://bellaquitas-api-staging.bellaquitas-fest-410.workers.dev";
const SITE=BASE+"/espejo/";
const OUT="browser-evidence";
fs.mkdirSync(OUT,{recursive:true});
const chrome=process.env.CHROME_BIN ||
  ["/usr/bin/google-chrome","/usr/bin/chromium","/usr/bin/chromium-browser"].find(p=>fs.existsSync(p));
assert.ok(chrome,"Se necesita Chrome instalado en el runner");
const browser=await chromium.launch({executablePath:chrome,headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
let pass=0;
const test=(name)=>{console.log("OK: "+name);pass++;};
async function check(route,page){ 
  await page.goto(SITE+route,{waitUntil:"domcontentloaded",timeout:35000});
  await page.locator(".site-header .brand").first().waitFor({state:"visible",timeout:25000});
}
async function urlPath(page){return page.evaluate(()=>location.hash);}
async function evidence(page,label){await page.screenshot({path:path.join(OUT,label+".png"),fullPage:false,animations:"disabled"});}
const diagnostics={desktop:{},mobile:{},iPhone:{},errors:[]};
const contexts=[];
try{
  // No se utiliza contexto compartido: nunca hay cookies reales.
  const desktop=await browser.newContext({viewport:{width:1440,height:900},locale:"es-ES",serviceWorkers:"block"});
  contexts.push(desktop);
  const page=await desktop.newPage();
  page.on("pageerror",err=>diagnostics.errors.push({device:"desktop",message:err.message.slice(0,200)}));
  await check("",page);
  assert.equal(await page.locator("header.site-header").count(),1);
  assert.equal(await page.locator("nav.bf-desktop-nav").isVisible(),true);
  assert.equal(await page.locator(".bf-desktop-nav a.nav-link").count(),5);
  assert.equal(await page.locator(".lang-switch button[data-action='set-lang']").count(),2);
  test("desktop: cabecera única, 5 enlaces y selector ES/FR");

  const video=page.locator(".hero.bf-video-hero > video.bf-hero-video");
  await video.waitFor({state:"attached",timeout:10000});
  assert.match(await video.getAttribute("src"),/bellaquitas%20fiesta%20portada\.mp4/);
  diagnostics.desktop.hero=await video.getAttribute("src");
  test("desktop: fuente del vídeo de portada ORIGINAL");

  const fr=page.locator(".lang-switch button[data-action='set-lang'][data-lang='fr']");
  await fr.click();
  await page.waitForFunction(()=>document.documentElement.lang==="fr",{timeout:15000});
  assert.equal(await page.locator(".bf-desktop-nav a[href='#/']").textContent(),"Accueil");
  assert.equal(await page.locator(".lang-switch button[data-lang='fr']").getAttribute("aria-pressed"),"true");
  assert.equal(await page.evaluate(()=>localStorage.getItem("bellaquitas-lang")),"fr");
  test("desktop: selector francés traduce navegación y guarda preferencia");

  await page.reload({waitUntil:"domcontentloaded"});
  await page.locator(".bf-desktop-nav a[href='#/']").waitFor({state:"visible"});
  await page.waitForFunction(()=>document.documentElement.lang==="fr");
  assert.equal(await page.locator(".bf-desktop-nav a[href='#/']").textContent(),"Accueil");
  test("desktop: francés persiste tras recargar");

  await page.locator(".lang-switch button[data-lang='es']").click();
  await page.waitForFunction(()=>document.documentElement.lang==="es");
  assert.equal(await page.locator(".bf-desktop-nav a[href='#/']").textContent(),"Inicio");
  test("desktop: vuelve correctamente al español");
  await evidence(page,"staging-desktop-menu");

  // Mobile Chromium en viewport 390px (no equivale a Safari iOS real).
  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,
    userAgent:"Mozilla/5.0 (Linux; Android 15; SM-S731B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Mobile Safari/537.36",
    serviceWorkers:"block"});
  contexts.push(mobile);
  const m=await mobile.newPage();
  m.on("pageerror",err=>diagnostics.errors.push({device:"mobile",message:err.message.slice(0,200)}));
  await check("",m);
  assert.equal(await m.locator(".bf-desktop-nav").isVisible(),false);
  assert.equal(await m.locator("header.site-header").count(),1);
  assert.equal(await m.locator(".menu-toggle").count(),1);
  assert.equal(await m.locator(".menu-toggle").isVisible(),true);
  assert.equal(await m.locator(".menu-toggle").getAttribute("aria-expanded"),"false");
  test("móvil: sin segundo menú visible ni hamburguesa duplicada");

  const mobileVideo=m.locator(".hero.bf-video-hero > video.bf-hero-video");
  await mobileVideo.waitFor({state:"attached"});
  assert.match(await mobileVideo.getAttribute("src"),/bellaquitas%20fiesta%20portada%20movil\.mp4/);
  diagnostics.mobile.hero=await mobileVideo.getAttribute("src");
  test("móvil: vídeo de portada específico para teléfonos");

  await m.locator(".menu-toggle").click();
  assert.equal(await m.locator(".menu-toggle").getAttribute("aria-expanded"),"true");
  assert.equal(await m.locator("#site-menu").isVisible(),true);
  for(const text of ["Inicio","Experiencia","Eventos","Ventajas","Preguntas"]){
    assert.ok((await m.locator("#site-menu .bf-menu-mobile-primary").textContent()).includes(text),
      "Falta sección del menú "+text);
  }
  for(const text of ["Sugerencias","Bellaquitas Moments","Club de las Bellaquitas"]){
    assert.ok((await m.locator("#site-menu").textContent()).includes(text),"Falta "+text);
  }
  test("móvil: hamburguesa abre 5 secciones y 3 opciones de comunidad");
  await evidence(m,"staging-mobile-menu-open");

  await m.locator("#site-menu .bf-menu-mobile-primary a[href='#/eventos']").click();
  await m.waitForFunction(()=>location.hash==="#/eventos",{timeout:15000});
  assert.equal(await m.locator(".menu-toggle").getAttribute("aria-expanded"),"false");
  assert.equal(await m.locator("#site-menu").isVisible(),false);
  test("móvil: Eventos navega y cierra hamburguesa");

  await m.locator(".menu-toggle").click();
  await m.locator("#site-menu a[href='#/sugerencias']").click();
  await m.waitForFunction(()=>location.hash==="#/sugerencias");
  assert.equal(await m.locator("#community-suggestion-form").count(),1);
  test("móvil: sugerencias accesibles sin enviar mensajes");

  await m.locator(".lang-switch button[data-lang='fr']").click();
  await m.waitForFunction(()=>document.documentElement.lang==="fr");
  await m.locator(".menu-toggle").click();
  assert.ok((await m.locator("#site-menu").textContent()).includes("Suggestions"));
  assert.ok((await m.locator("#site-menu").textContent()).includes("Événements"));
  assert.ok((await m.locator("#site-menu").textContent()).includes("Expériences"));
  assert.equal(await m.evaluate(()=>localStorage.getItem("bellaquitas-lang")),"fr");
  test("móvil: francés traduce hamburguesa y persiste preferencia");
  await evidence(m,"staging-mobile-fr");

  // Comprobación visual de reglas específicas de encuadre iPhone,
  // emulando user agent pero SIN afirmar que es Safari.
  const iphone=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,
    userAgent:"Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    serviceWorkers:"block"});
  contexts.push(iphone);
  const p=await iphone.newPage();
  p.on("pageerror",err=>diagnostics.errors.push({device:"iPhone-emulado",message:err.message.slice(0,200)}));
  await check("",p);
  assert.equal(await p.locator("html").evaluate(n=>n.classList.contains("bf-ios-video-fit")),true);
  const v=p.locator(".hero.bf-video-hero > video.bf-hero-video");
  assert.match(await v.getAttribute("src"),/bellaquitas%20fiesta%20portada%20movil\.mp4/);
  diagnostics.iPhone.hero=await v.getAttribute("src");
  test("iPhone emulado: clase de encuadre iOS y vídeo móvil aplicados");

  // Las rutas de cuentas protegidas no deben mostrar datos sin autenticación.
  await p.goto(SITE+"#/panel",{waitUntil:"domcontentloaded"});
  await p.locator(".site-header").waitFor();
  const q=await urlPath(p);
  assert.ok(q==="#/panel"||q==="#/acceso","Navegación inesperada");
  assert.equal(await p.locator(".admin-member-editor").count(),0);
  test("sin sesión: no se exponen formularios de socios en vista admin");

  console.log("RESUMEN: "+pass+" comprobaciones navegador completadas.");
  diagnostics.pass=pass;
}finally{
  fs.writeFileSync(path.join(OUT,"diagnostics.json"),JSON.stringify(diagnostics,null,2));
  for(const ctx of contexts){try{await ctx.close();}catch{}}
  await browser.close();
}
