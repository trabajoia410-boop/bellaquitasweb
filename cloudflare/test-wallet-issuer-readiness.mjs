import {buildBellaquitasGoogleLoyaltyClass} from "../wallet/google-provisional-class.js";
#!/usr/bin/env node
/** Native issuer gate QA: fake keys only; no HTTP requests or Cloudflare data. */
import assert from "node:assert/strict";
import {Script} from "node:vm";
import {walletIssuerReadiness} from "../wallet/issuer-readiness.js";
import {walletCustomerPage} from "../wallet/customer-page.js";
import {walletAdminApiRoute} from "../wallet/admin-api.js";
import {createPass,updatePass,sendNotification} from "../wallet/index.js";
import {syncQueuedWalletPasses} from "../wallet/sync.js";
import {walletAppleServiceRoute} from "../wallet/apple-service.js";
const classDraft=buildBellaquitasGoogleLoyaltyClass("3388000000023244592",{name:"Bellaquitas Fest"});
assert.equal(classDraft.id,"3388000000023244592.bellaquitas_fest");
assert.equal(classDraft.reviewStatus,"UNDER_REVIEW");
assert.equal(classDraft.issuerName,"Bellaquitas Fest");
assert.ok(classDraft.programLogo.sourceUri.uri.startsWith("https://"));
assert.equal(classDraft.accountNameLabel,"Nombre");
assert.equal(classDraft.hexBackgroundColor,"#1E1424");
assert.ok(!JSON.stringify(classDraft).includes('"loyaltyPoints"'));
assert.throws(()=>buildBellaquitasGoogleLoyaltyClass("invalid"),/Invalid Google Wallet issuer/);
const none={apple:false,google:false};
const base={SITE_MODE:"production",WALLET_ENABLED:"yes",PUBLISH_APPROVED:"yes",
 WALLET_MODE:"real",WALLET_REAL_APPROVED:"yes"};
assert.deepEqual(walletIssuerReadiness({}),none);
assert.deepEqual(walletIssuerReadiness(base),none);
const google={...base,WALLET_GOOGLE_ISSUER_ID:"1234567890",
 WALLET_GOOGLE_CLIENT_EMAIL:"test@demo.iam.gserviceaccount.com",
 WALLET_GOOGLE_PRIVATE_KEY:"-----BEGIN "+"PRIVATE KEY-----\nexample\n-----END PRIVATE"+" KEY-----"};
assert.equal(walletIssuerReadiness(google).google,false,"Must require Google publishing approval");
assert.equal(walletIssuerReadiness({...google,WALLET_GOOGLE_ISSUER_APPROVED:"yes",PUBLISH_APPROVED:"no"}).google,false);
assert.equal(walletIssuerReadiness({...google,WALLET_GOOGLE_ISSUER_APPROVED:"yes"}).google,true);
const privateServiceAccount=JSON.stringify({type:"service_account",project_id:"bellaquitas-fest",
 client_email:google.WALLET_GOOGLE_CLIENT_EMAIL,private_key:google.WALLET_GOOGLE_PRIVATE_KEY,
 private_key_id:"test-only-not-real",token_uri:"https://oauth2.googleapis.com/token",
 extra:"x".repeat(200)});
const jsonGoogle={...google,WALLET_GOOGLE_PRIVATE_KEY:undefined,
 WALLET_GOOGLE_SERVICE_ACCOUNT_JSON:privateServiceAccount,WALLET_GOOGLE_ISSUER_APPROVED:"yes"};
assert.equal(walletIssuerReadiness(jsonGoogle).google,true,"JSON completo solo como Worker Secret");
assert.equal(walletIssuerReadiness({...jsonGoogle,WALLET_GOOGLE_SERVICE_ACCOUNT_JSON:"{malformed"}).google,false);
assert.equal(walletIssuerReadiness({...jsonGoogle,WALLET_GOOGLE_SERVICE_ACCOUNT_JSON:
 JSON.stringify({...JSON.parse(privateServiceAccount),client_email:"intruso@example.com"})}).google,false);
assert.equal(walletIssuerReadiness({...jsonGoogle,WALLET_GOOGLE_ISSUER_APPROVED:"no"}).google,false);

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
// No scheduled updates or APNs endpoints may run on an unapproved issuer.
const syncDB={prepare(){throw Error("Outbox must not query an unapproved issuer")}};
assert.deepEqual(await syncQueuedWalletPasses({...base,WALLET_SYNC_ENABLED:"yes",DB:syncDB}),
 {enabled:false,processed:0,failed:0});
const passRoute=await walletAppleServiceRoute(new Request(
 "https://bellaquitas.fr/v1/apple-wallet/v1/passes/pass.fr.bellaquitas/11111111-1111-4111-8111-111111111111"),
 {...apple,DB:syncDB});
assert.equal(passRoute.status,503);
let lookup=false;
const readyDB={prepare(sql){
 assert.match(sql,/wallet_sync_jobs/);lookup=true;
 return {bind(...values){
  assert.deepEqual(values,["google",2]);
  return {all:async()=>({results:[]})};
 }};
}};
assert.deepEqual(await syncQueuedWalletPasses({...google,WALLET_GOOGLE_ISSUER_APPROVED:"yes",
 WALLET_SYNC_ENABLED:"yes",DB:readyDB}),{enabled:true,processed:0,failed:0});
assert.equal(lookup,true);
console.log("PASS: explicit independent Apple/Google approval, no fake pass issuance, demo QR web card, secrets never returned.");
