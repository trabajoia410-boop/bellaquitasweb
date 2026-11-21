#!/usr/bin/env node
/** Cutover contract: zero new point accrual, historical balances untouched. */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {stampsReplacePoints,visitPointsAwarded,immutableLegacyBalances} from "../wallet/cutover-policy.js";
import {adminConsoleRoute} from "./admin-console.js";
import {stampsOnlyMarketingCopy} from "../wallet/retire-legacy-copy.js";

const staging={SITE_MODE:"staging",WALLET_ENABLED:"yes",
  WALLET_REPLACE_LEGACY:"yes",PUBLISH_APPROVED:"yes"};
const preprod={...staging,SITE_MODE:"preproduction"};
const production={...staging,SITE_MODE:"production"};
assert.equal(stampsReplacePoints(staging),false);
assert.equal(stampsReplacePoints(preprod),false);
assert.equal(stampsReplacePoints({...production,PUBLISH_APPROVED:"no"}),false);
assert.equal(stampsReplacePoints({...production,WALLET_REPLACE_LEGACY:"no"}),false);
assert.equal(stampsReplacePoints(production),true);
assert.equal(visitPointsAwarded(staging),10);
assert.equal(visitPointsAwarded(production),0);

const old={points:184,lifetime_points:250};
assert.deepEqual(immutableLegacyBalances(old,{points:0,lifetime_points:0},production),old,
  "No destructive change, no conversion, no reset to zero");
assert.deepEqual(immutableLegacyBalances(old,{points:2,lifetime_points:4},staging),
  {points:2,lifetime_points:4});

const url="https://bellaquitas.fr/administracion/";
const html=await (await adminConsoleRoute(new Request(url),production)).text();
assert.match(html,/Los sellos son la única fidelidad activa/);
assert.doesNotMatch(html,/<label for="memberPoints">Puntos disponibles<\/label>/);
assert.doesNotMatch(html,/<label for="memberLifetime">Puntos históricos<\/label>/);
assert.match(html,/<input id="memberPoints" type="number" disabled value="0">/);
assert.match(html,/data-tab="rewards" hidden style="display:none"/);
assert.match(html,/Les tampons sont le seul programme de fidélité actif/);
assert.match(html,/data-tab="wallet">Tarjetas digitales/);
const original=await (await adminConsoleRoute(new Request(url),{
  ...production,WALLET_REPLACE_LEGACY:"no"})).text();
assert.match(original,/<label for="memberPoints">Puntos disponibles<\/label>/);
assert.match(original,/data-tab="rewards">Recompensas/);

const route=readFileSync("cloudflare/protected-routes.js","utf8");
assert.match(route,/if\(stampsReplacePoints\(env\)\)\{[\s\S]*?UPDATE profiles SET visits=visits\+1 WHERE id=\?/);
assert.match(route,/VALUES \(\?,\?,'visita',0,'Visita validada \(sellos independientes\)'/);
assert.match(route,/points_awarded:0,loyalty:"stamps"/);
assert.match(route,/const balances=immutableLegacyBalances\(target,/);
assert.match(route,/if\(stampsReplacePoints\(env\)\)\s*return error\("Los canjes antiguos por puntos/);
const worker=readFileSync("cloudflare/bellaquitas-api-staging.js","utf8");
assert.match(worker,/Historical point-based offers remain stored/);
const writes=readFileSync("cloudflare/mirror-write-routes.js","utf8");
assert.match(writes,/stampsReplacePoints\(env\)&&body.kind==="catalog"/);
// The original videos, asset references and layout markup remain unmodified.
const marketing='<p>Tu tarjeta, tus puntos, tus experiencias.</p><h2>Puntos y ventajas</h2>'+
 '<span>¿Cómo se suman los puntos?</span><video src="assets/portada.mp4"></video>';
const patched=stampsOnlyMarketingCopy(marketing);
assert.match(patched,/Tu tarjeta, tus sellos, tus experiencias/);
assert.match(patched,/Sellos y ventajas/);
assert.match(patched,/¿Cómo consigo mis sellos\?/);
assert.ok(!patched.includes("tus puntos"));
assert.match(patched,/<video src="assets\/portada.mp4"><\/video>/);
assert.equal(stampsOnlyMarketingCopy(patched),patched,"Copy replacement must be idempotent");
const prodSource=readFileSync("cloudflare/production-site-route.js","utf8");
assert.match(prodSource,/if\(path==="\/app.js"&&stampsReplacePoints\(env\)/);
assert.match(prodSource,/stampsOnlyMarketingCopy\(html\)/);
console.log("PASS: stamp-only cutover, no point accrual, archived balances, admin and marketing copy, staging unchanged.");
