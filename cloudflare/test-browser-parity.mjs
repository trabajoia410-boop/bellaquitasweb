/**
 * Bellaquitas Fest — compara estructura y estilos públicos de GitHub Pages
 * con el espejo Cloudflare, sin autenticar ni ejecutar solicitudes mutadoras.
 *
 * No compara fotogramas de MP4 porque los navegadores no sincronizan el vídeo.
 */
import assert from "node:assert/strict";
import {chromium} from "playwright-core";
import fs from "node:fs";
const URLs={
  original:"https://bellaquitas.fr/",
  staging:"https://bellaquitas-api-staging.bellaquitas-fest-410.workers.dev/espejo/"
};
const OUT="parity-evidence";fs.mkdirSync(OUT,{recursive:true});
const CHROME=process.env.CHROME_BIN||["/usr/bin/google-chrome","/usr/bin/chromium"].find(p=>fs.existsSync(p));
assert.ok(CHROME,"Google Chrome requerido");
const browser=await chromium.launch({executablePath:CHROME,headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
const errors=[],checks=[];
function ok(name){checks.push(name);console.log("OK: "+name);}
async function inspect(url,mode){
  const width=mode==="desktop"?1440:390,height=mode==="desktop"?900:844;
  const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,
    isMobile:mode==="mobile",hasTouch:mode==="mobile",serviceWorkers:"block"});
  const page=await ctx.newPage();
  page.on("pageerror",e=>errors.push({url,mode,message:e.message.slice(0,250)}));
  await page.goto(url,{waitUntil:"domcontentloaded",timeout:35000});
  await page.locator("header.site-header").waitFor({state:"visible",timeout:30000});
  await page.locator(".bf-hero-video").waitFor({state:"attached",timeout:15000});
  await page.evaluate(()=>document.fonts?.ready||Promise.resolve());
  const metrics=await page.evaluate(()=>{
    const selectors=[
      "header.site-header",".site-header .brand",".site-header .nav-wrap",
      ".site-header .lang-switch",".site-header .menu-toggle",
      ".site-header .bf-desktop-nav",".site-header .nav-actions",
      ".hero.bf-video-hero",".bf-hero-video",".bf-ticker-set"
    ];
    const clean=(node)=>{
      if(!node)return null;
      const rect=node.getBoundingClientRect(),s=getComputedStyle(node);
      return {
        rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},
        css:{display:s.display,position:s.position,flexDirection:s.flexDirection,
          fontSize:s.fontSize,fontFamily:s.fontFamily,fontWeight:s.fontWeight,
          borderRadius:s.borderRadius,borderTopWidth:s.borderTopWidth,
          boxSizing:s.boxSizing,alignItems:s.alignItems}
      };
    };
    return {
      htmlLang:document.documentElement.lang,
      headerCount:document.querySelectorAll("header.site-header").length,
      menuButtonCount:document.querySelectorAll(".menu-toggle").length,
      desktopNavCount:document.querySelectorAll(".bf-desktop-nav a.nav-link").length,
      headerLogo:{
        src:document.querySelector(".site-header .brand img")?.getAttribute("src")||"",
        naturalWidth:document.querySelector(".site-header .brand img")?.naturalWidth||0,
        naturalHeight:document.querySelector(".site-header .brand img")?.naturalHeight||0
      },
      hero:{
        desktop:document.querySelector(".bf-hero-video")?.dataset.desktopSrc||"",
        mobile:document.querySelector(".bf-hero-video")?.dataset.mobileSrc||"",
        current:document.querySelector(".bf-hero-video")?.getAttribute("src")||""
      },
      navText:[...document.querySelectorAll(".bf-desktop-nav a.nav-link")].map(n=>n.textContent.trim()),
      selectors:Object.fromEntries(selectors.map(s=>[s,clean(document.querySelector(s))]))
    };
  });
  if(mode==="mobile"){
    await page.locator(".menu-toggle").click();
    metrics.menuOpen=await page.locator(".menu-toggle").getAttribute("aria-expanded");
    metrics.mobileLinks=await page.locator("#site-menu .bf-menu-mobile-primary a.nav-link")
      .allTextContents();
    await page.locator(".menu-toggle").click();
  }
  await page.locator(".lang-switch button[data-lang='fr']").click();
  await page.waitForFunction(()=>document.documentElement.lang==="fr",{timeout:12000});
  metrics.frenchNav=await page.locator(".bf-desktop-nav a.nav-link").allTextContents();
  await page.goto(url+"#/sugerencias",{waitUntil:"domcontentloaded",timeout:35000});
  await page.locator("#community-suggestion-form").waitFor({state:"attached",timeout:30000});
  metrics.frenchSuggestion={
    label:(await page.locator("label[for='suggestion-message']").textContent()).trim(),
    placeholder:await page.locator("#suggestion-message").getAttribute("placeholder"),
    submit:(await page.locator("#community-suggestion-form [type='submit']").textContent()).trim()
  };
  await ctx.close();
  return metrics;
}
const all={results:{},checks,errors};
try{
  for(const mode of ["desktop","mobile"]){
    all.results[mode]={};
    for(const [name,url] of Object.entries(URLs))all.results[mode][name]=await inspect(url,mode);
    const a=all.results[mode].original,b=all.results[mode].staging;
    assert.equal(b.headerCount,a.headerCount);
    assert.equal(b.menuButtonCount,a.menuButtonCount);
    assert.equal(b.desktopNavCount,a.desktopNavCount);
    ok(mode+": número y jerarquía de controles idénticos");
    assert.deepEqual(b.navText,a.navText);
    assert.deepEqual(b.frenchNav,a.frenchNav);
    ok(mode+": navegación ES/FR idéntica");
    assert.deepEqual(b.frenchSuggestion,a.frenchSuggestion);
    ok(mode+": formulario de sugerencias FR idéntico");
    assert.equal(b.headerLogo.naturalWidth,a.headerLogo.naturalWidth);
    assert.equal(b.headerLogo.naturalHeight,a.headerLogo.naturalHeight);
    assert.ok(b.headerLogo.naturalWidth>0,"El logo del espejo no carga");
    ok(mode+": dimensiones del logo idénticas");
    assert.deepEqual(b.hero,a.hero);
    ok(mode+": fuentes originales de vídeo idénticas");
    for(const [selector,first] of Object.entries(a.selectors)){
      const second=b.selectors[selector];
      assert.deepEqual(second?.css,first?.css,mode+" estilo CSS distinto: "+selector);
      if(!first||!second)continue;
      for(const prop of ["x","y","width","height"]){
        assert.ok(Math.abs(first.rect[prop]-second.rect[prop])<2,
          mode+" diferencias en "+selector+"."+prop+": original="+first.rect[prop]+" staging="+second.rect[prop]);
      }
    }
    ok(mode+": geometría y estilos principales de la cabecera/video coinciden");
    if(mode==="mobile"){
      assert.equal(a.menuOpen,"true");assert.equal(b.menuOpen,"true");
      assert.deepEqual(a.mobileLinks,b.mobileLinks);
      ok("móvil: menú hamburguesa idéntico");
    }
  }
  console.log("PARIDAD: "+checks.length+" comprobaciones originales vs Cloudflare, sin diferencias.");
  all.passed=checks.length;
}finally{
  fs.writeFileSync(OUT+"/parity.json",JSON.stringify(all,null,2));
  await browser.close();
}
