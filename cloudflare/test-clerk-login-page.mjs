#!/usr/bin/env node
/** Offline Clerk UI contract and browser JS behavior — no real users or network. */
import assert from "node:assert/strict";
import vm from "node:vm";
import {clerkLoginPage,productionClerkUiConfig} from "./clerk-login-page.js";
import {adminConsoleRoute} from "./admin-console.js";
import worker from "./bellaquitas-api-staging.js";
const origin="https://bellaquitas.fr";
const key="pk_live_"+Buffer.from("clerk.bellaquitas.fr$").toString("base64");
const good={SITE_MODE:"production",CLERK_UI_ENABLED:"yes",CLERK_JWT_ENABLED:"yes",
 CLERK_EXCHANGE_ENABLED:"yes",CLERK_ISSUER:"https://clerk.bellaquitas.fr",
 CLERK_ALLOWED_ORIGIN:origin,CLERK_PUBLISHABLE_KEY:key};
const req=(path="/acceso/",method="GET")=>new Request(origin+path,{method});
assert.equal(productionClerkUiConfig(good)?.clerkHost,"clerk.bellaquitas.fr");
for(const env of [
 {...good,SITE_MODE:"preproduction"},{...good,SITE_MODE:"staging"},
 {...good,CLERK_UI_ENABLED:"no"},{...good,CLERK_JWT_ENABLED:"no"},
 {...good,CLERK_EXCHANGE_ENABLED:"no"},
 {...good,CLERK_PUBLISHABLE_KEY:"pk_test_"+key.slice(8)},
 {...good,CLERK_PUBLISHABLE_KEY:"pk_live_"+Buffer.from("evil.test$").toString("base64")},
 {...good,CLERK_ISSUER:"https://evil.test"},
 {...good,CLERK_ALLOWED_ORIGIN:"https://evil.test"}
]){
 assert.equal(productionClerkUiConfig(env),null);
 assert.equal(clerkLoginPage(req(),env).status,404);
}
assert.equal(clerkLoginPage(req("/v1/auth/me"),good),null);
assert.equal(clerkLoginPage(req("/acceso/","POST"),good).status,405);
assert.equal(clerkLoginPage(new Request("https://evil.test/acceso/"),good).status,404);
assert.equal(clerkLoginPage(req("/acceso?return=administracion"),good).status,308);
assert.equal(clerkLoginPage(req("/acceso/","HEAD"),good).status,200);
const getHtml=async path=>{
 const res=clerkLoginPage(req(path),good);
 assert.equal(res.status,200);
 assert.equal(res.headers.get("Cache-Control"),"no-store, private");
 assert.equal(res.headers.get("Set-Cookie"),null);
 assert.equal(res.headers.get("X-Robots-Tag"),"noindex, nofollow");
 const csp=res.headers.get("Content-Security-Policy")||"";
 assert.match(csp,/script-src 'nonce-/);
 assert.match(csp,/frame-ancestors 'none'/);
 assert.doesNotMatch(csp,/unsafe-eval/);
 const html=await res.text();
 assert.match(html,/clerk\.bellaquitas\.fr\/npm\/@clerk\/clerk-js@6/);
 assert.match(html,/clerk\.bellaquitas\.fr\/npm\/@clerk\/ui@1/);
 assert.match(html,/\/v1\/auth\/clerk\/exchange/);
 assert.match(html,/\/v1\/auth\/clerk\/admin\/step-up/);
 assert.match(html,/id="lang-es"/);
 assert.match(html,/id="lang-fr"/);
 assert.match(html,/data-fr="(?:Connexion à Bellaquitas Fest|Accès à l’administration)"/);
 assert.doesNotMatch(html,/sk_live_|password_hash|supabase|R2_BUCKET|GITHUB_TOKEN/);
 return html;
};
const adminHtml=await getHtml("/acceso/?return=administracion");
const memberHtml=await getHtml("/acceso/");
const externalHtml=await getHtml("/acceso/?return=https://evil.invalid/path");
assert.match(adminHtml,/<body data-admin="yes">/);
assert.match(memberHtml,/<body data-admin="no">/);
assert.match(externalHtml,/<body data-admin="no">/);
assert.doesNotMatch(externalHtml,/evil\.invalid/);
const adminPage=await adminConsoleRoute(req("/administracion/"),good);
const adminMarkup=await adminPage.text();
assert.match(adminMarkup,/href="\/acceso\/\?return=administracion"/);
assert.match(adminMarkup,/id="clerkAdminLogin"/);
assert.match(adminMarkup,/id="loginForm" hidden/);
assert.match(adminMarkup,/href="\/v1\/auth\/google\/start\?return=admin" class="action" hidden/);
const stagingAdmin=await adminConsoleRoute(req("/administracion/"),{
 SITE_MODE:"staging",STAGING_MUTATIONS:"disabled",ALLOW_NEW_ACCOUNTS:"no"});
const stagingMarkup=await stagingAdmin.text();
assert.doesNotMatch(stagingMarkup,/id="clerkAdminLogin"/);
assert.match(stagingMarkup,/href="\/v1\/auth\/google\/start\?return=admin"/);
// Real router keeps the proposed page locked until future release gates.
const blocked=await worker.fetch(req(),{
 SITE_MODE:"preproduction",PUBLISH_APPROVED:"no",CLERK_UI_ENABLED:"no"});
assert.equal(blocked.status,503);
assert.equal(blocked.headers.get("Set-Cookie"),null);

const inline=adminHtml.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)?.[1];
assert.ok(inline);
const script=new vm.Script(inline,{filename:"synthetic-clerk-login.js"});
async function browser({html=adminHtml,exchange=200,step=200,signed=true,reverify=false,lang="es"}={}){
 const actionHandlers=new Map(),events=new Map();
 const els={status:{textContent:""},
  continue:{disabled:true,addEventListener(name,fn){actionHandlers.set("continue:"+name,fn);}},
  reverify:{hidden:true,disabled:false,addEventListener(name,fn){actionHandlers.set("reverify:"+name,fn);}},
  "sign-in":{},account:{hidden:true},
  "lang-es":{addEventListener(n,fn){actionHandlers.set("lang-es:"+n,fn);},setAttribute(){}},
  "lang-fr":{addEventListener(n,fn){actionHandlers.set("lang-fr:"+n,fn);},setAttribute(){}}};
 const paths=[],tabProof=[],redirects=[];
 let signOutCalls=0;
 const mockClerk={
  session:signed?{getToken:async()=>"fake.synthetic.token"}:null,
  load:async()=>{},addListener(){},mountUserButton(){},mountSignIn(){},
  signOut:async()=>{signOutCalls++;}
 };
 const documentLang={lang:"es"};
 const ctx=vm.createContext({
  localStorage:{getItem:k=>k==="bellaquitas-lang"?lang:null,setItem(){}},
  window:{Clerk:mockClerk,__internal_ClerkUICtor:function(){},
   addEventListener:(name,fn)=>events.set(name,fn)},
  document:{body:{dataset:{admin:html.includes('data-admin="yes"')?"yes":"no"}},
   documentElement:documentLang,querySelectorAll:()=>[],
   getElementById:id=>els[id]},
  fetch:async(path,opts)=>{
   paths.push({path,opts});
   return new Response(JSON.stringify({}),{status:path.includes("/admin/step-up")?step:exchange});
  },
  Response,sessionStorage:{setItem:(k,v)=>tabProof.push([k,v])},
  location:{assign:t=>redirects.push(t)}
 });
 script.runInContext(ctx);
 assert.ok(events.has("load"));
 await events.get("load")();
 assert.equal(els.continue.disabled,!signed);
 await actionHandlers.get("continue:click")();
 if(reverify){
  assert.equal(els.reverify.hidden,false,"La opción aparece tras rechazar step-up");
  await actionHandlers.get("reverify:click")();
 }
 return {paths,tabProof,redirects,status:els.status.textContent,signOutCalls,
  lang:documentLang.lang};
}
const adminSuccess=await browser();
assert.deepEqual(adminSuccess.paths.map(x=>x.path),[
 "/v1/auth/clerk/exchange","/v1/auth/clerk/admin/step-up"]);
assert.deepEqual(adminSuccess.tabProof,[["bf_admin_tab_login","1"]]);
assert.deepEqual(adminSuccess.redirects,["/administracion/"]);
assert.ok(adminSuccess.paths.every(x=>x.opts.credentials==="same-origin"));
assert.ok(adminSuccess.paths.every(x=>x.opts.method==="POST"));
const noLink=await browser({exchange:403});
assert.deepEqual(noLink.redirects,[]);
assert.deepEqual(noLink.tabProof,[]);
assert.equal(noLink.paths.length,1);
const withoutStep=await browser({step:403});
assert.equal(withoutStep.paths.length,2);
assert.deepEqual(withoutStep.tabProof,[]);
assert.deepEqual(withoutStep.redirects,[]);
const stepReverify=await browser({step:403,reverify:true});
assert.equal(stepReverify.signOutCalls,1);
assert.equal(stepReverify.paths.at(-1)?.path,"/v1/auth/logout");
assert.deepEqual(stepReverify.redirects,["/acceso/?return=administracion"]);
assert.deepEqual(stepReverify.tabProof,[]);
const ordinary=await browser({html:memberHtml});
assert.deepEqual(ordinary.paths.map(x=>x.path),["/v1/auth/clerk/exchange"]);
assert.deepEqual(ordinary.redirects,["/#/mi-espacio"]);
assert.deepEqual(ordinary.tabProof,[]);
const french=await browser({html:memberHtml,exchange:403,lang:"fr"});
assert.equal(french.lang,"fr");
assert.match(french.status,/n’est pas encore associé/);
const signedOut=await browser({signed:false});
assert.deepEqual(signedOut.redirects,[]);
assert.equal(signedOut.paths.length,0);
console.log("PASS: Clerk browser, no URLs externos, link confirmado, admin step-up, cero usuarios y producción cerrada.");
