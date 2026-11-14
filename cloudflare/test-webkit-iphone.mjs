/**
 * Bellaquitas Fest — auditoría con WebKit real (motor Safari), iPhone EMULADO.
 * Compara únicamente lectura pública. Ninguna contraseña, correo, formulario,
 * registro, visita o modificación de Cloudflare, Supabase y R2.
 */
import assert from "node:assert/strict";
import {webkit} from "playwright";
import fs from "node:fs";

const sites={
  original:"https://bellaquitas.fr/",
  staging:"https://bellaquitas-api-staging.bellaquitas-fest-410.workers.dev/espejo/"
};
const width=390,height=844,dir="webkit-evidence";
fs.mkdirSync(dir,{recursive:true});
const errors=[],results={},passed=[];
const browser=await webkit.launch({headless:true});
const iphoneUA="Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const close=[];

async function check(name,condition){assert.ok(condition,name);passed.push(name);console.log("OK: "+name);}
try{
  for(const [key,url] of Object.entries(sites)){
    const ctx=await browser.newContext({
      viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:2,
      userAgent:iphoneUA,serviceWorkers:"block"
    });
    close.push(ctx);
    const page=await ctx.newPage();
    page.on("pageerror",e=>errors.push({site:key,message:e.message.slice(0,200)}));
    await page.goto(url,{waitUntil:"domcontentloaded",timeout:60000});
    await page.locator(".hero.bf-video-hero > video.bf-hero-video")
      .waitFor({state:"attached",timeout:40000});
    await page.evaluate(()=>document.fonts?.ready||Promise.resolve());
    // Comprobar decodificación REAL del MP4 en WebKit, no solo presencia de <video>.
    await page.waitForFunction(()=>{
      const v=document.querySelector(".hero.bf-video-hero > video.bf-hero-video");
      return !!v&&v.readyState>=2&&v.videoWidth>0&&v.videoHeight>0;
    },null,{timeout:30000});
    await page.waitForTimeout(300);
    const metrics=await page.evaluate(()=>{
      const video=document.querySelector(".hero.bf-video-hero > video.bf-hero-video");
      const second=document.querySelector(".bf-after-marquee-video");
      const header=document.querySelector(".site-header");
      const hero=video?.parentElement;
      const rect=(element)=>{if(!element)return null;
        const r=element.getBoundingClientRect();
        return {x:r.x,y:r.y,w:r.width,h:r.height};
      };
      return {
        lang:document.documentElement.lang,
        iosClass:document.documentElement.classList.contains("bf-ios-video-fit"),
        header:rect(header),hero:rect(hero),videoRect:rect(video),
        video:{src:video?.getAttribute("src"),autoplay:video?.autoplay,
          muted:video?.muted,loop:video?.loop,playsInline:video?.playsInline,
          readyState:video?.readyState||0,videoWidth:video?.videoWidth||0,videoHeight:video?.videoHeight||0},
        second:{present:!!second,srcs:[...(second?.querySelectorAll("source")||[])].map(s=>s.getAttribute("src"))},
        viewport:{width:innerWidth,scrollWidth:document.documentElement.scrollWidth},
        logoWidth:document.querySelector(".site-header .brand img")?.naturalWidth||0,
        menuCount:document.querySelectorAll(".menu-toggle").length
      };
    });
    results[key]=metrics;
    await check(key+": clase iPhone aplicada",metrics.iosClass);
    await check(key+": archivo de vídeo específico para móvil",
      /bellaquitas%20fiesta%20portada%20movil\.mp4/.test(metrics.video.src||""));
    await check(key+": atributos Safari de vídeo inline y autoplay",
      metrics.video.autoplay&&metrics.video.muted&&metrics.video.loop&&metrics.video.playsInline);
    await check(key+": WebKit decodifica el MP4 y obtiene dimensiones reales",
      metrics.video.readyState>=2&&metrics.video.videoWidth>0&&metrics.video.videoHeight>0);
    await check(key+": fuente del segundo vídeo móvil original",
      metrics.second.present&&metrics.second.srcs.some(s=>s?.includes("Bellaquitas%20Fest%20para%20m%C3%B3vil.mp4")));
    await check(key+": cabecera y logo visibles",metrics.header.w>200&&metrics.logoWidth>100);
    await check(key+": hamburguesa única",metrics.menuCount===1);
    await check(key+": sin desbordamiento horizontal",
      metrics.viewport.scrollWidth<=metrics.viewport.width+1);
    await page.screenshot({path:dir+"/"+key+"-webkit-iphone.png",animations:"disabled"});
  }
  const a=results.original,b=results.staging;
  await check("WebKit: mismos atributos y origen de vídeos",
    JSON.stringify(a.video.src)===JSON.stringify(b.video.src)&&
    JSON.stringify(a.second.srcs)===JSON.stringify(b.second.srcs));
  for(const name of ["header","hero","videoRect"]){
    const x=a[name],y=b[name];
    assert.ok(x&&y,name+" absent");
    for(const prop of ["x","y","w","h"])assert.ok(Math.abs(x[prop]-y[prop])<=3,
      "WebKit paridad "+name+"."+prop+" => original "+x[prop]+" staging "+y[prop]);
  }
  await check("WebKit: geometría de cabecera y vídeo original vs espejo <=3px",true);
  await check("WebKit: logo y menú tienen las mismas dimensiones",a.logoWidth===b.logoWidth&&a.menuCount===b.menuCount);
  console.log("RESULTADO WEBKIT: "+passed.length+" pruebas conformes.");
}finally{
  fs.writeFileSync(dir+"/webkit-report.json",JSON.stringify({results,passed,errors},null,2));
  for(const c of close)try{await c.close();}catch{}
  await browser.close();
}
