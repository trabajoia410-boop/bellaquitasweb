/**
 * Bellaquitas Fest: comprueba la decodificación del SEGUNDO vídeo móvil
 * en el motor WebKit, comparando original y Cloudflare sin mutaciones.
 *
 * No se usan cuentas, ni sesiones, ni formularios. Motor gratuito Playwright.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import {webkit} from "playwright";

const OUTPUT="webkit-second-video-evidence";
const sites={
  original:"https://bellaquitas.fr/",
  staging:"https://bellaquitas-api-staging.bellaquitas-fest-410.workers.dev/espejo/"
};
const expectedMobile="Bellaquitas%20Fest%20para%20m%C3%B3vil.mp4";
fs.mkdirSync(OUTPUT,{recursive:true});
const browser=await webkit.launch({headless:true});
const reports={},errors=[];
function deviceSource(url){
  try{return decodeURIComponent(new URL(url).pathname.split("/").pop()||"");}
  catch{return "";}
}
try{
  for(const [key,url] of Object.entries(sites)){
    const ctx=await browser.newContext({
      viewport:{width:390,height:844},deviceScaleFactor:2,
      isMobile:true,hasTouch:true,serviceWorkers:"block",
      userAgent:"Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
    });
    try{
      const page=await ctx.newPage();
      page.on("pageerror",error=>errors.push({site:key,message:error.message.slice(0,300)}));
      page.on("requestfailed",req=>{
        if(/\.mp4/i.test(req.url()))errors.push({site:key,media:req.url().split("/").pop(),reason:req.failure()?.errorText});
      });
      await page.goto(url,{waitUntil:"domcontentloaded",timeout:45000});
      await page.locator("video.bf-after-marquee-video").waitFor({state:"attached",timeout:35000});
      await page.waitForFunction(()=>{
        const v=document.querySelector("video.bf-after-marquee-video");
        return !!v&&v.readyState>=1;
      },null,{timeout:35000});
      const before=await page.evaluate(()=>{
        const v=document.querySelector("video.bf-after-marquee-video");
        return {currentSrc:v.currentSrc,readyState:v.readyState,networkState:v.networkState,
          paused:v.paused,autoplay:v.autoplay,loop:v.loop,muted:v.muted,playsInline:v.playsInline,
          videoWidth:v.videoWidth,videoHeight:v.videoHeight,error:v.error?.code||null,
          sources:[...v.querySelectorAll("source")].map(x=>({src:x.getAttribute("src"),media:x.media}))};
      });
      // play() se ejecuta con muted+playsInline, como lo hace la web original.
      const played=await page.evaluate(async()=>{
        const v=document.querySelector("video.bf-after-marquee-video");
        try{await Promise.race([v.play(),new Promise((_,reject)=>setTimeout(()=>reject(Error("timeout")),12000))]);return "resolved";}
        catch(e){return String(e?.name||e?.message||e);}
      });
      await page.waitForFunction(()=>{
        const v=document.querySelector("video.bf-after-marquee-video");
        return !!v&&(v.readyState>=2||v.error);
      },null,{timeout:25000}).catch(()=>{});
      const after=await page.evaluate(()=>{
        const v=document.querySelector("video.bf-after-marquee-video");
        const rect=v.getBoundingClientRect();
        return {currentSrc:v.currentSrc,readyState:v.readyState,networkState:v.networkState,
          paused:v.paused,videoWidth:v.videoWidth,videoHeight:v.videoHeight,
          currentTime:v.currentTime,error:v.error?.code||null,
          rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height}};
      });
      reports[key]={before,after,played};
      console.log(key,JSON.stringify({current:deviceSource(after.currentSrc),videoWidth:after.videoWidth,videoHeight:after.videoHeight,readyState:after.readyState,played,error:after.error}));
      await page.screenshot({path:OUTPUT+"/"+key+"-second-video.png",animations:"disabled"});
    }finally{await ctx.close();}
  }
  for(const [key,r] of Object.entries(reports)){
    assert.ok(r.after.currentSrc,key+": no se seleccionó ninguna fuente");
    assert.ok(r.after.readyState>=2,key+": WebKit no decodificó el segundo MP4");
    assert.ok(r.after.videoWidth>0&&r.after.videoHeight>0,key+": dimensiones MP4 no disponibles");
    assert.equal(r.after.error,null,key+": error en reproducción");
    assert.ok(deviceSource(r.after.currentSrc).includes("Bellaquitas Fest para móvil.mp4"),
      key+": segundo vídeo no seleccionó la fuente móvil original");
    console.log("OK: "+key+" decodifica el segundo vídeo móvil");
  }
  assert.equal(deviceSource(reports.original.after.currentSrc),deviceSource(reports.staging.after.currentSrc));
  assert.equal(reports.original.after.videoWidth,reports.staging.after.videoWidth);
  assert.equal(reports.original.after.videoHeight,reports.staging.after.videoHeight);
  console.log("OK: segundo vídeo móvil idéntico en original y Cloudflare");
}finally{
  fs.writeFileSync(OUTPUT+"/results.json",JSON.stringify({reports,errors},null,2));
  await browser.close();
}
