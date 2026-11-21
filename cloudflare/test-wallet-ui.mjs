#!/usr/bin/env node
/** 100% local mock QA; no real Clerk users, D1, SMS, Wallet or production. */
import assert from "node:assert/strict";
import {Script} from "node:vm";
import {walletCustomerPage} from "../wallet/customer-page.js";
import {walletScannerPage} from "../wallet/scanner-page.js";
import {walletAdminPage} from "../wallet/admin-page.js";
import {walletApiRoute} from "../wallet/api.js";
import {walletAdminApiRoute} from "../wallet/admin-api.js";
import {walletStaffRoute} from "../wallet/staff.js";
import {walletLegacyRedirectRoute} from "../wallet/legacy-redirect.js";
import {createPass,updatePass,sendNotification} from "../wallet/index.js";
import {normalizeEmail,normalizePhone,validSlug,scanCode,verifyScan} from "../wallet/core.js";
import {WALLET_I18N} from "../wallet/i18n.js";
import worker from "./bellaquitas-api-staging.js";
const base="https://bellaquitas.fr";
const dummy="k".repeat(48);
assert.equal(normalizeEmail("  Test@Example.FR "),"test@example.fr");
assert.equal(normalizePhone("+33 6 12 34 56 78"),"+33612345678");
assert.throws(()=>normalizePhone("0612345678"));
assert.equal(validSlug("bellaquitas-fest"),true);
assert.equal(validSlug("../admin"),false);
const fake={id:"11111111-1111-4111-8111-111111111111",
 scan_nonce:"22222222-2222-4222-8222-222222222222"};
const signed=await scanCode(fake,dummy);
assert.equal(signed.startsWith("bfw1."),true);
assert.deepEqual(await verifyScan(signed,dummy),{id:fake.id,nonce:fake.scan_nonce});
assert.equal(await verifyScan(signed.slice(0,-2)+"xx",dummy),null);
assert.ok(WALLET_I18N.es.consent&&WALLET_I18N.fr.consent);
const customer={id:fake.id,name:"Anon",stamps:4};
const program={slug:"bellaquitas-fest"};
const mock=await createPass(customer,program,{});
assert.deepEqual([mock.mode,mock.signed,mock.walletUrl],["mock",false,null]);
assert.equal((await updatePass(customer,program,{})).mode,"mock");
const notification=await sendNotification([customer],"Aviso de prueba",{});
assert.equal(notification.sent,0);
assert.equal(notification.previewOnly,true);
for(const mode of ["preproduction","staging",undefined]){
 const env={SITE_MODE:mode,WALLET_ENABLED:"yes",WALLET_ADMIN_WRITES:"no",PUBLISH_APPROVED:"no"};
 const r=await worker.fetch(new Request(base+"/v1/wallet/me?slug=bellaquitas-fest"),env);
 assert.ok(r.status===503||r.status===404,"No public API before release gate");
 assert.equal(r.headers.get("Set-Cookie"),null);
 assert.equal((await walletApiRoute(new Request(base+"/v1/wallet/me"),env)).status,503);
 assert.equal((await walletAdminApiRoute(new Request(base+"/v1/wallet/admin/customers"),env)).status,503);
 assert.equal((await walletStaffRoute(new Request(base+"/v1/wallet/stamp",{method:"POST"}),env)).status,403===r.status?403:503);
}
const qaEnv={SITE_MODE:"staging",STAGING_MUTATIONS:"disabled",WALLET_MOCK_PREVIEW:"yes"};
const preview=await walletCustomerPage(new Request(base+"/wallet/demo"),qaEnv);
assert.equal(preview.status,200);
const html=await preview.text();
assert.match(html,/Cliente de prueba/);
assert.match(html,/wallet\/qr.js/);
assert.match(html,/v1\/wallet\/enroll\/start/);
assert.match(html,/Añadir a Apple Wallet/);
assert.match(html,/Ajouter à Google Wallet/);
assert.match(html,/consent/);
assert.match(html,/deleteConfirm/);
assert.equal(preview.headers.get("Set-Cookie"),null);
const js=html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)?.[1];
assert.ok(js,"Customer script missing");
new Script(js,{filename:"wallet-customer-inline.js"});
const qr=await walletCustomerPage(new Request(base+"/wallet/qr.js"),qaEnv);
assert.equal(qr.status,200);
const script=await qr.text();
assert.match(script,/BellaWalletQR/);
new Script(script,{filename:"wallet-qr-signed.js"});
for(const path of ["/wallet/demo","/wallet/demo/"]){
 const response=await walletCustomerPage(new Request(base+path),{
  ...qaEnv,WALLET_MOCK_PREVIEW:"no"});
 assert.equal(response.status,404);
}
assert.equal((await walletCustomerPage(new Request(base+"/tarjeta/bellaquitas-fest"),qaEnv)).status,404);
assert.equal(walletScannerPage(new Request(base+"/admin/escanear"),qaEnv).status,404);
assert.equal((await walletAdminPage(new Request(base+"/administracion/fidelidad/"),qaEnv)).status,404);
const scanner=walletScannerPage(new Request(base+"/admin/escanear"),{
 SITE_MODE:"production",WALLET_ENABLED:"yes",WALLET_STAFF_ENABLED:"yes"});
assert.equal(scanner.status,200);
const scannerHtml=await scanner.text();
new Script(scannerHtml.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)?.[1],
 {filename:"wallet-scanner-inline.js"});
assert.match(scannerHtml,/mediaDevices\.getUserMedia/);
assert.match(scannerHtml,/jsqr-local\.js/);
assert.match(scannerHtml,/v1\/wallet\/stamp/);
assert.match(scannerHtml,/inputmode="numeric"/);
// Reutilizar exactamente la sesión de administrador (sesión + step-up),
// sin un panel con login distinto y sin acceso de empleado al diseño.
const adminId="11111111-1111-4111-8111-111111111111";
const adminEnv={SITE_MODE:"production",WALLET_ENABLED:"yes",
 DB:{prepare(sql){
   if(sql.includes("FROM auth_sessions s JOIN profiles p"))return {
    bind:()=>({first:async()=>({id:adminId,role:"admin",name:"Admin simulado"})})};
   if(sql.includes("FROM auth_admin_sessions WHERE"))return {
    bind:()=>({first:async()=>({ok:1})})};
   throw Error("No se permiten consultas fuera de sesión");
 }}};
const adminUrl=base+"/administracion/fidelidad/";
const nonAdmin=await walletAdminPage(new Request(adminUrl),adminEnv);
assert.equal(nonAdmin.status,403);
const cookieRequest=new Request(adminUrl,{headers:{
 Cookie:"__Host-bf_session="+"A".repeat(43)+"; __Host-bf_admin="+"B".repeat(43)}});
const adminResponse=await walletAdminPage(cookieRequest,adminEnv);
assert.equal(adminResponse.status,200);
const adminMarkup=await adminResponse.text();
assert.match(adminMarkup,/live-progress/);
assert.match(adminMarkup,/live-logo/);
assert.match(adminMarkup,/live-banner/);
assert.match(adminMarkup,/\/admin\/escanear/);
assert.match(adminMarkup,/Descargar PNG/);
assert.match(adminMarkup,/Guardar como PDF/);
assert.match(adminMarkup,/v1\/wallet\/admin\/customers/);
const adminScript=adminMarkup.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)?.[1];
assert.ok(adminScript);
new Script(adminScript,{filename:"wallet-admin-inline.js"});
assert.equal(adminResponse.headers.get("Set-Cookie"),null);
assert.equal(adminResponse.headers.get("X-Robots-Tag"),"noindex,nofollow");
// La sustitución del sistema viejo no está activa en preproducción.
const legacyURL=new Request(base+"/wallet/legacy-redirect.js");
assert.equal(walletLegacyRedirectRoute(legacyURL,{SITE_MODE:"preproduction",
 WALLET_ENABLED:"yes",WALLET_REPLACE_LEGACY:"yes"}).status,404);
assert.equal(walletLegacyRedirectRoute(legacyURL,{SITE_MODE:"production",
 WALLET_ENABLED:"yes",WALLET_REPLACE_LEGACY:"no"}).status,404);
const futureCutover=walletLegacyRedirectRoute(legacyURL,{SITE_MODE:"production",
 WALLET_ENABLED:"yes",WALLET_REPLACE_LEGACY:"yes"});
assert.equal(futureCutover.status,200);
const redirectJS=await futureCutover.text();
new Script(redirectJS,{filename:"wallet-legacy-redirect.js"});
assert.match(redirectJS,/#\/tarjeta/);
assert.match(redirectJS,/\/tarjeta\/bellaquitas-fest/);
console.log("PASS: Wallet mock, admin protegido, QR y sustitución antigua por bandera explícita.");

