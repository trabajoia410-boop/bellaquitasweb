#!/usr/bin/env node
/** Real HTTPS staging, browser and DOM, NO credentials or mutations. */
import assert from "node:assert/strict";
import {chromium} from "playwright";
const ROOT="https://bellaquitas-api-staging.bellaquitas-fest-410.workers.dev";
const browser=await chromium.launch({headless:true});
try{
 const ctx=await browser.newContext({viewport:{width:1366,height:860},serviceWorkers:"block",reducedMotion:"reduce"});
 const page=await ctx.newPage(),errors=[],writes=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("request",r=>{
  if(r.url().startsWith(ROOT+"/")&&!["GET","HEAD","OPTIONS"].includes(r.method()))
   writes.push({path:new URL(r.url()).pathname,method:r.method()});
 });
 const response=await page.goto(ROOT+"/laboratorio/",{waitUntil:"domcontentloaded",timeout:45000});
 assert.equal(response.status(),200);
 assert.equal(response.headers()["set-cookie"],undefined);
 const preview=page.frameLocator("#site");
 await preview.locator("main").first().waitFor({state:"visible",timeout:45000});
 const initial=page.locator("#site");
 assert.equal(new URL(await initial.getAttribute("src"),ROOT).searchParams.get("admin_embed"),"1");
 // All 6 presets affect the REAL site's iframe, not just the selector.
 const styles=["original","noir","urban","glass","violet","editorial"];
 for(const preset of styles){
  await page.locator('[data-preset="'+preset+'"]').click();
  await page.waitForFunction(id=>document.querySelector("#site")?.contentDocument?.body?.getAttribute("data-s-preset")===id,preset,{timeout:10000});
  assert.equal(await page.locator('[data-preset="'+preset+'"]').getAttribute("aria-pressed"),"true");
 }
 await page.locator("#studioHeader").selectOption("glass");
 await page.waitForFunction(()=>document.querySelector("#site")?.contentDocument?.body?.getAttribute("data-s-header")==="glass");
 await page.locator("#studioMenu").selectOption("pills");
 await page.locator("#studioCards").selectOption("glass");
 await page.locator("#studioHero").selectOption("framed");
 await page.locator("#studioAccent").fill("#ce94ff");
 await page.waitForFunction(()=>document.querySelector("#site")?.contentDocument?.body?.getAttribute("data-s-hero")==="framed");
 assert.equal(await preview.locator("body").evaluate(e=>e.style.getPropertyValue("--s-accent")),"#ce94ff");
 await page.locator("#studioPickLogo").click();
 assert.match(await page.locator("#studioSelection").innerText(),/Logo superior/);
 const tinyPng=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WpuIgAAAABJRU5ErkJggg==","base64");
 await page.locator("#studioFile").setInputFiles({name:"qa-logo.png",mimeType:"image/png",buffer:tinyPng});
 await page.waitForFunction(()=>document.querySelector("#site")?.contentDocument?.querySelector(".bf-new-navbar-logo img")?.getAttribute("src")?.startsWith("data:image/"),{timeout:10000});
 assert.match(await preview.locator(".bf-new-navbar-logo img").getAttribute("src"),/^data:image\//);
 // Visibility, section order and local persistence are separate from server state.
 await page.locator('[data-section="eventos"] input').uncheck();
 await page.waitForFunction(()=>document.querySelector("#site")?.contentDocument?.body?.getAttribute("data-s-hide-eventos")==="true");
 await page.locator('[data-section="ventajas"] [data-move="up"]').click();
 assert.equal(await page.locator("#studioSections [data-section]").nth(1).getAttribute("data-section"),"ventajas");
 await page.locator("#save").click();
 const localDesign=await page.evaluate(()=>JSON.parse(localStorage.getItem("bf_studio_design_v2")||"{}"));
 assert.equal(localDesign.preset,"custom");
 assert.equal(localDesign.images["global|header-logo"]?.startsWith("data:image/"),true);
 assert.ok(localDesign.hidden.includes("eventos"));
 await page.reload({waitUntil:"domcontentloaded",timeout:45000});
 await preview.locator(".bf-new-navbar-logo img").waitFor({state:"attached",timeout:30000});
 await page.waitForFunction(()=>document.querySelector("#site")?.contentDocument?.body?.getAttribute("data-s-header")==="glass",{timeout:20000});
 assert.match(await preview.locator(".bf-new-navbar-logo img").getAttribute("src"),/^data:image\//);
 page.once("dialog",dialog=>dialog.accept());
 await page.locator("#studioResetDesign").click();
 await page.waitForFunction(()=>document.querySelector("#site")?.contentDocument?.body?.getAttribute("data-s-preset")==="original",{timeout:20000});
 await page.locator('#pages [data-page="/eventos"]').click();
 await preview.locator("main").first().waitFor({state:"visible",timeout:30000});
 await page.waitForFunction(()=>document.querySelector("#site")?.contentWindow?.location.hash==="#/eventos",{timeout:10000});
 await page.locator('[data-theme="minimal"]').click();
 assert.equal(await preview.locator("body").evaluate(e=>e.classList.contains("theme-minimal")),true);
 await page.locator('[data-theme="classic"]').click();
 await page.locator('#pages [data-page="/"]').click();
 await preview.locator('main').first().waitFor({state:"visible",timeout:30000});
 const text=preview.locator('[data-bf-studio-key]:visible').first();
 await text.waitFor({state:"visible",timeout:20000});
 const key=await text.getAttribute("data-bf-studio-key");
 await text.click();
 const edit=page.locator("#editing");
 assert.equal(await edit.isEnabled(),true);
 await edit.fill("Ensayo visual Bellaquitas sin publicar");
 await page.locator("#save").click();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("bf_studio_local_draft_v1")||"{}"));
 assert.equal(saved[key],"Ensayo visual Bellaquitas sin publicar");
 await page.reload({waitUntil:"domcontentloaded",timeout:45000});
 await preview.locator('[data-bf-studio-key]:visible').first().waitFor({state:"visible",timeout:45000});
 assert.equal(await preview.locator('[data-bf-studio-key]:visible').first().innerText(),"Ensayo visual Bellaquitas sin publicar");
 await page.setViewportSize({width:390,height:844});
 const drawer=page.locator("#drawer");
 await drawer.waitFor({state:"visible",timeout:10000});
 await drawer.click();
 assert.match(await page.locator("body").getAttribute("class")||"",/menu-open/);
 await page.locator('#pages [data-page="/preguntas"]').click();
 assert.doesNotMatch(await page.locator("body").getAttribute("class")||"",/menu-open/);
 assert.deepEqual(writes,[],"Visual lab must never POST to staging");
 assert.deepEqual(errors,[],"Browser errors in visual lab: "+errors.join("; "));
 console.log("PASS: laboratorio real 1366px+390px, ES, plantillas, eventos, editor de texto y borrador local persistente; 0 POST.");
 await ctx.close();
}finally{await browser.close()}
