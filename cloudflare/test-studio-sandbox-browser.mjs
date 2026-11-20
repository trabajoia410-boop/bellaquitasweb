#!/usr/bin/env node
/** Browser E2E against STAGING, synthetic-only; no credentials, accounts or writes. */
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
   writes.push({method:r.method(),path:new URL(r.url()).pathname});
 });
 const res=await page.goto(ROOT+"/laboratorio/",{waitUntil:"domcontentloaded",timeout:45000});
 assert.equal(res.status(),200);
 assert.equal(res.headers()["set-cookie"],undefined);
 const frame=page.frameLocator("#site");
 await frame.locator("main").first().waitFor({state:"visible",timeout:45000});
 assert.equal(new URL(await page.locator("#site").getAttribute("src"),ROOT).searchParams.get("admin_embed"),"1");
 const fold=id=>page.locator('.lab-accordion[data-panel="'+id+'"]');
 const show=async id=>{
  await fold(id).evaluate(el=>el.open=true);
  assert.equal(await fold(id).evaluate(el=>el.open),true,"Accordion should open: "+id);
 };
 // Accordion must open by clicking its summary, and hide all other categories.
 assert.equal(await fold("pages").evaluate(el=>el.open),true);
 await page.locator('[data-panel="templates"] summary').click();
 assert.equal(await fold("templates").evaluate(el=>el.open),true);
 const styles=["original","noir","urban","glass","violet","editorial","cobalt","rose","emerald","ice","copper","monochrome"];
 for(const style of styles){
  await page.locator('[data-preset="'+style+'"]').click();
  await page.waitForFunction(id=>document.querySelector("#site")?.contentDocument?.body?.getAttribute("data-s-preset")===id,style,{timeout:15000});
  assert.equal(await page.locator('[data-preset="'+style+'"]').getAttribute("aria-pressed"),"true");
 }
 // Template colors must propagate to the entire site, not just to cards.
 await show("hero");
 await page.locator('[data-palette="cobalt"]').click();
 await page.waitForFunction(()=>document.querySelector("#site")?.contentDocument?.body?.style.getPropertyValue("--s-nav")==="#122743");
 const colors=await frame.locator("body").evaluate(body=>{
  const doc=body.ownerDocument;
  return {header:getComputedStyle(doc.querySelector(".site-header")).backgroundColor,
   marquee:getComputedStyle(doc.querySelector(".bf-marquee")).backgroundColor,
   root:getComputedStyle(body).backgroundColor,
   accent:body.style.getPropertyValue("--s-accent")};
 });
 assert.equal(colors.header,"rgb(18, 39, 67)","Palette must recolor navbar");
 assert.equal(colors.marquee,"rgb(18, 39, 67)","Palette must recolor marquee");
 assert.equal(colors.root,"rgb(7, 22, 40)","Palette must recolor page background");
 assert.equal(colors.accent,"#82adf6");
 await page.locator("#studioBg").fill("#111c36");
 await page.locator("#studioNav").fill("#17294b");
 await page.locator("#studioAccent").fill("#ce94ff");
 await page.waitForFunction(()=>document.querySelector("#site")?.contentDocument?.body?.style.getPropertyValue("--s-accent")==="#ce94ff");
 assert.equal(await frame.locator(".site-header").evaluate(el=>getComputedStyle(el).backgroundColor),"rgb(23, 41, 75)");
 await show("header");
 await page.locator("#studioHeader").selectOption("glass");
 await page.locator("#studioMenu").selectOption("pills");
 await show("hero");
 await page.locator("#studioCards").selectOption("glass");
 await page.locator("#studioHero").selectOption("framed");
 assert.equal(await frame.locator("body").getAttribute("data-s-hero"),"framed");
 // Pages in the sidebar are only visible after opening the category.
 await show("pages");
 await page.locator('#pages [data-page="/experiencia"]').click();
 await frame.locator(".feature-icon").first().waitFor({state:"visible",timeout:20000});
 await frame.locator(".feature-icon").first().click();
 await page.waitForFunction(()=>document.querySelector('.lab-accordion[data-panel="media"]')?.open===true);
 assert.equal(await page.locator("#studioIcon").isEnabled(),true);
 assert.equal(await page.locator(".studio-advanced").getAttribute("data-inspector"),"icon");
 assert.equal(await page.locator("#studioPickLogo").isVisible(),true,
  "Debe poderse seleccionar el logo incluso después de editar un icono");
 await page.locator("#studioIcons [data-icon='♫']").click();
 assert.equal(await frame.locator(".feature-icon").first().innerText(),"♫");
 await show("pages");
 await page.locator('#pages [data-page="/"]').click();
 await frame.locator(".bf-new-navbar-logo img").waitFor({state:"attached",timeout:20000});
 await show("media");
 await show("media");
 await page.locator("#studioPickLogo").click();
 assert.match(await page.locator("#studioSelection").innerText(),/Logo superior/);
 const tinyPng=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WpuIgAAAABJRU5ErkJggg==","base64");
 await page.locator("#studioFile").setInputFiles({name:"qa-logo.png",mimeType:"image/png",buffer:tinyPng});
 await page.waitForFunction(()=>document.querySelector("#site")?.contentDocument?.querySelector(".bf-new-navbar-logo img")?.getAttribute("src")?.startsWith("data:image/"),null,{timeout:15000});
 await show("sections");
 await page.locator('[data-section="eventos"] input').uncheck();
 await page.waitForFunction(()=>document.querySelector("#site")?.contentDocument?.body?.getAttribute("data-s-hide-eventos")==="true");
 await page.locator('[data-section="ventajas"] [data-move="up"]').click();
 assert.equal(await page.locator("#studioSections [data-section]").nth(1).getAttribute("data-section"),"ventajas");
 // Save is always visible outside the accordion: one click and two local drafts.
 assert.equal(await page.locator(".lab-quick-actions #save").isVisible(),true);
 await page.locator("#save").click();
 const design=await page.evaluate(()=>JSON.parse(localStorage.getItem("bf_studio_design_v2")||"{}"));
 assert.equal(design.preset,"custom");
 assert.equal(design.images["global|header-logo"]?.startsWith("data:image/"),true);
 assert.ok(design.hidden.includes("eventos"));
 assert.equal(design.nav,"#17294b");
 await page.reload({waitUntil:"domcontentloaded",timeout:45000});
 await frame.locator(".bf-new-navbar-logo img").waitFor({state:"attached",timeout:30000});
 await page.waitForFunction(()=>document.querySelector("#site")?.contentDocument?.body?.getAttribute("data-s-header")==="glass",null,{timeout:20000});
 assert.match(await frame.locator(".bf-new-navbar-logo img").getAttribute("src"),/^data:image\//);
 await show("sections");
 page.once("dialog",dialog=>dialog.accept());
 await page.locator("#studioResetDesign").click();
 await page.waitForFunction(()=>document.querySelector("#site")?.contentDocument?.body?.getAttribute("data-s-preset")==="original",null,{timeout:25000});
 await show("pages");
 await page.locator('#pages [data-page="/eventos"]').click();
 await page.waitForFunction(()=>document.querySelector("#site")?.contentWindow?.location.hash==="#/eventos",null,{timeout:12000});
 await show("basic");
 await page.locator('[data-theme="minimal"]').click();
 assert.equal(await frame.locator("body").evaluate(el=>el.classList.contains("theme-minimal")),true);
 await page.locator('[data-theme="classic"]').click();
 await show("pages");
 await page.locator('#pages [data-page="/"]').click();
 const text=frame.locator('main h2[data-bf-studio-key]:visible').first();
 await text.waitFor({state:"visible",timeout:25000});
 const key=await text.getAttribute("data-bf-studio-key");
 await text.click();
 assert.equal(await fold("text").evaluate(el=>el.open),true,"Clicking text should open inspector");
 const input=page.locator("#editing");
 assert.equal(await input.isEnabled(),true);
 await input.fill("Ensayo visual Bellaquitas sin publicar");
 await page.locator("#save").click();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("bf_studio_local_draft_v1")||"{}"));
 assert.equal(saved[key],"Ensayo visual Bellaquitas sin publicar","Text draft must persist");
 await page.reload({waitUntil:"domcontentloaded",timeout:45000});
 await frame.locator('main h2[data-bf-studio-key]:visible').first().waitFor({state:"visible",timeout:45000});
 assert.equal(await frame.locator('main h2[data-bf-studio-key]:visible').first().innerText(),"Ensayo visual Bellaquitas sin publicar");
 // The simulated mobile mode opens the LEFT editor drawer instead of a bottom panel.
 await page.locator('[data-device="mobile"]').click();
 assert.match(await page.locator("body").getAttribute("class")||"",/lab-sim-mobile/);
 await page.locator("#labOpenEditor").click();
 assert.match(await page.locator("body").getAttribute("class")||"",/lab-sim-mobile-open/);
 await page.locator(".lab-sidebar-close").click();
 assert.doesNotMatch(await page.locator("body").getAttribute("class")||"",/lab-sim-mobile-open/);
 await page.setViewportSize({width:390,height:844});
 const drawer=page.locator("#drawer");
 await drawer.waitFor({state:"visible",timeout:15000});
 await drawer.click();
 assert.match(await page.locator("body").getAttribute("class")||"",/menu-open/);
 await show("pages");
 await page.locator('#pages [data-page="/preguntas"]').click();
 assert.doesNotMatch(await page.locator("body").getAttribute("class")||"",/menu-open/);
 assert.deepEqual(writes,[],"Laboratory must never make POST requests");
 assert.deepEqual(errors,[],"Page JS errors: "+errors.join(" ; "));
 console.log("OK: 12 templates, full palettes, collapsible left sidebar, contextual icon/image/text editor, save/reload, mobile drawer, zero POST.");
 await ctx.close();
}finally{await browser.close()}
