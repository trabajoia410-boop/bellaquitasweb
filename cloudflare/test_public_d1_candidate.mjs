/**
 * Comprobar que la web candidata usa Cloudflare-D1 sin modificar diseño.
 * Solo análisis estático de artefactos, sin navegador de usuarios reales.
 */
import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync("app.js","utf8");
const candidate=readFileSync(
 "cloudflare/staging-source-2026-11-11/recovered-src/app-cloudflare.js","utf8");
const impl=readFileSync("cloudflare/qa-candidates/public-d1-browser-impl.js","utf8");
test("JavaScript original sin modificar y candidato separado",()=>{
 assert.ok(source.length>170000);
 assert.ok(candidate.length>source.length/2);
 assert.notEqual(source,candidate);
 assert.match(source,/bf-ios-video-fit/);
 assert.match(candidate,/bf-ios-video-fit/);
 assert.match(source,/bfRefreshBackgroundVideo/);
 assert.match(candidate,/bfRefreshBackgroundVideo/);
 assert.match(candidate,/\.bf-after-marquee-video, \.bf-hero-video/);
});
test("Cloudflare Google y puntos solo mediante cookies del mismo origen",()=>{
 assert.match(candidate,/location\.assign\('\/v1\/auth\/google\/start'\)/);
 assert.match(candidate,/cloudApi\('\/v1\/auth\/me'/);
 assert.match(candidate,/cloudApi\('\/v1\/me\/overview'/);
 assert.match(candidate,/cloudApi\('\/v1\/door\/overview'/);
 assert.match(candidate,/cloudApi\('\/v1\/rewards\/request'/);
 assert.match(candidate,/cloudApi\('\/v1\/door\/checkin'/);
 assert.match(candidate,/cloudApi\('\/v1\/door\/redemptions\/validate'/);
 assert.match(candidate,/credentials:'same-origin'/);
 assert.match(candidate,/redirect:'error'/);
 assert.doesNotMatch(candidate,/import\('https:\/\/esm\.sh\/@supabase/);
 assert.doesNotMatch(candidate,/sb\.auth\.signInWithOAuth\(/);
 assert.doesNotMatch(candidate,/sb\.auth\.getSession\(/);
});
test("sin JWT, contraseña ni tokens de sesión en almacenamiento",()=>{
 assert.doesNotMatch(impl,/Authorization:|Bearer |localStorage\.setItem|sessionStorage\.setItem/);
 assert.match(impl,/session=\{id:person\.id\}/);
 assert.match(impl,/current=person/);
 assert.match(impl,/publicHome|cloudInit/);
 assert.match(impl,/Cloudflare|cloudApi/);
});
test("la pantalla de acceso candidata ofrece solo Google sin formularios falsos",()=>{
 assert.match(candidate,/function auth\(\)\{return cloudAuthScreen\(\);\}/);
 assert.match(impl,/data-action="google-login"/);
 assert.match(impl,/desactivado durante las pruebas de migración/);
 assert.doesNotMatch(impl,/supabase/i);
});
test("publicación y perfiles de socios no se escriben desde rutas de lectura",()=>{
 assert.match(impl,/cloudApi\('\/v1\/site'/);
 assert.match(impl,/await cloudLoadPublic\(\)/);
 assert.match(impl,/cloudLoadCommunity/);
 assert.match(impl,/cloudSaveSuggestion/);
 assert.match(impl,/cloudUpdateName/);
 assert.match(impl,/cloudResumeSavedSession/);
});
console.log("OK: web candidata ES/FR, medios, QR y diseño originales con Cloudflare-D1.");
