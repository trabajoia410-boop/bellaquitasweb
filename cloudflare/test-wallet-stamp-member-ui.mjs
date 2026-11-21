#!/usr/bin/env node
/** Offline visual and JS compile QA. No D1 queries, accounts or network. */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";
import {stampsOnlyMemberUI} from "../wallet/retire-legacy-member-ui.js";
import {stampsOnlyMarketingCopy} from "../wallet/retire-legacy-copy.js";
import {walletLegacyRedirectRoute} from "../wallet/legacy-redirect.js";

const original=readFileSync("app.js","utf8");
const translated=readFileSync("locale-fr.js","utf8");
const newApp=stampsOnlyMemberUI(stampsOnlyMarketingCopy(original));
const newFrench=stampsOnlyMarketingCopy(translated);
new Script(newApp,{filename:"bellaquitas-stamps-only.js"});
new Script(newFrench,{filename:"bellaquitas-wallet-fr.js"});
const between=(start,end)=>{
 const i=newApp.indexOf(start),j=newApp.indexOf(end,i+start.length);
 assert.ok(i>=0&&j>i, "Missing guarded member renderer: "+start);
 return newApp.slice(i,j);
};
const member=between("function summary(){","function loyaltyCardView(){");
const card=between("function loyaltyCardView(){","function card(){");
const reward=between("function rewards(){","function agenda(){");
for(const view of [member,card,reward]){
 assert.doesNotMatch(view,/current\.points|lifetime_points|points-banner|Puntos disponibles|data-action="redeem"/i,
  "Old points UI must not leak through stamp-only account routes");
 assert.match(view,/tarjeta\/bellaquitas-fest|loyaltyCardView\(\)/);
}
assert.match(member,/\/tarjeta\/bellaquitas-fest/);
assert.match(member,/href="#\/perfil"/);
assert.match(member,/href="#\/agenda"/);
assert.match(card,/0 sellos/);
assert.match(card,/0 tampon/);
assert.match(reward,/Mis recompensas/);
assert.match(reward,/Mes récompenses/);
assert.ok(newApp.includes('href="/tarjeta/bellaquitas-fest" class="btn btn-primary">'),
 "Public club CTAs lead to the new card, not account creation");
assert.ok(newApp.includes('href="/tarjeta/bellaquitas-fest" aria-label="Ver tarjeta de fidelidad"'));
assert.match(newApp,/Tus sellos se gestionan desde la tarjeta digital/);
assert.doesNotMatch(newApp,/Visita validada: \+10 puntos\./);
assert.match(newFrench,/Cumulez des tampons/);
assert.match(newFrench,/Comment obtenir mes tampons/);
assert.throws(()=>stampsOnlyMemberUI("function summary(){}"),/missing or ambiguous|end marker missing/);
const root="https://bellaquitas.fr/wallet/legacy-redirect.js";
const approved={SITE_MODE:"production",WALLET_ENABLED:"yes",
 WALLET_REPLACE_LEGACY:"yes",PUBLISH_APPROVED:"yes"};
assert.equal(walletLegacyRedirectRoute(new Request(root),{
 ...approved,PUBLISH_APPROVED:"no"}).status,404);
const response=walletLegacyRedirectRoute(new Request(root),approved);
assert.equal(response.status,200);
const browser=await response.text();
new Script(browser,{filename:"legacy-route-guard.js"});
assert.match(browser,/#\/panel/);
assert.match(browser,/\/administracion\//);
assert.match(browser,/#\/tarjeta/);
console.log("PASS: original SPA compiles with ES/FR stamp-only views; accounts, events, profile and release gates preserved.");
