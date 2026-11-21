#!/usr/bin/env node
/** Native issuer gate QA: fake keys only; no HTTP requests or Cloudflare data. */
import assert from "node:assert/strict";
import {Script} from "node:vm";
import {walletIssuerReadiness} from "../wallet/issuer-readiness.js";
import {walletCustomerPage} from "../wallet/customer-page.js";
import {walletAdminApiRoute} from "../wallet/admin-api.js";
import {createPass,updatePass,sendNotification} from "../wallet/index.js";
const none={apple:false,google:false};
const base={SITE_MODE:"production",WALLET_ENABLED:"yes",PUBLISH_APPROVED:"yes",
 WALLET_MODE:"real",WALLET_REAL_APPROVED:"yes"};
assert.deepEqual(walletIssuerReadiness({}),none);
assert.deepEqual(walletIssuerReadiness(base),none);
const google={...base,WALLET_GOOGLE_ISSUER_ID:"1234567890",
 WALLET_GOOGLE_CLIENT_EMAIL:"test@demo.iam.gserviceaccount.com",
 WALLET_GOOGLE_PRIVATE_KEY:"-----BEGIN PRIVATE KEY-----\nexample\n-----END PRIVATE KEY-----"};
assert.equal(walletIssuerReadiness(google).google,false,"Must require Google publishing approval");
assert.equal(walletIssuerReadiness({...google,WALLET_GOOGLE_ISSUER_APPROVED:"yes",PUBLISH_APPROVED:"no"}).google,false);
assert.equal(walletIssuerReadiness({...google,WALLET_GOOGLE_ISSUER_APPROVED:"yes"}).google,true);
const apple={...base,APPLE_PASS_TYPE_ID:"pass.fr.bellaquitas",
 APPLE_PASS_SIGNER:{fetch:()=>Promise.resolve(new Response())},
 APPLE_PUSH_BRIDGE:{fetch:()=>Promise.resolve(new Response())},
 WALLET_HMAC_KEY:"x".repeat(48)};
assert.equal(walletIssuerReadiness(apple).apple,false,"Apple authorization is independent of signer");
assert.equal(walletIssuerReadiness({...apple,WALLET_APPLE_ISSUER_APPROVED:"yes"}).apple,true);
assert.equal(walletIssuerReadiness({...apple,WALLET_APPLE_ISSUER_APPROVED:"yes",APPLE_PUSH_BRIDGE:null}).apple,false);
assert.equal(walletIssuerReadiness({...apple,WALLET_APPLE_ISSUER_APPROVED:"yes",SITE_MODE:"preproduction"}).apple,false);
const person={id:"11111111-1111-4111-8111-111111111111",stamps:0};
const business={slug:"bellaquitas-fest"};
await assert.rejects(()=>createPass(person,business,google,"google"),/not approved/);
await assert.rejects(()=>createPass(person,business,apple,"apple"),/not approved/);
await assert.rejects(()=>updatePass(person,business,google,"google"),/not approved/);
await assert.rejects(()=>sendNotification([person],"Prueba",google,"google"),/not approved/);
assert.equal((await createPass(person,business,{},"google")).signed,false);
const demo=await walletCustomerPage(new Request("https://bellaquitas.fr/wallet/demo"),{
 SITE_MODE:"staging",WALLET_MOCK_PREVIEW:"yes",STAGING_MUTATIONS:"disabled"});
assert.equal(demo.status,200);
const demoHtml=await demo.text();
assert.match(demoHtml,/"providers":\{"apple":false,"google":false\}/);
assert.match(demoHtml,/wallet-provider-note/);
new Script(demoHtml.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)?.[1]||"throw Error('script missing')");
assert.equal((await walletCustomerPage(new Request("https://bellaquitas.fr/tarjeta/bellaquitas-fest"),{
 SITE_MODE:"production",WALLET_ENABLED:"yes",PUBLISH_APPROVED:"no"})).status,404);
const userRequest=new Request("https://bellaquitas.fr/v1/wallet/admin/issuer-status");
assert.equal((await walletAdminApiRoute(userRequest,base)).status,503,"Unauthorized startup not exposed");
console.log("PASS: explicit independent Apple/Google approval, no fake pass issuance, demo QR web card, secrets never returned.");
