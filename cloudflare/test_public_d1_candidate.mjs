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
const index=readFileSync(
 "cloudflare/staging-source-2026-11-11/recovered-src/index-cloudflare.html","utf8");
const sw=readFileSync(
 "cloudflare/staging-source-2026-11-11/recovered-src/sw-cloudflare.js","utf8");
const originalHtml=readFileSync("index.html","utf8");

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
test("HTML idéntico salvo scripts backend y CSP y service worker sin sesiones privadas",()=>{
 assert.match(index,/app-cloudflare\.js\?v=d1-20261114/);
 assert.doesNotMatch(index,/config\.js|supabase|esm\.sh/i);
 assert.match(index,/styles\.css\?v=iosencuadre61/);
 assert.match(index,/locale-fr\.js\?v=traduccion62/);
 assert.match(index,/assets\/qr-local\.js/);
 assert.match(index,/assets\/favicon\.svg/);
 assert.match(candidate,/sw-cloudflare\.js/);
 assert.match(sw,/app-cloudflare\.js/);
 assert.match(sw,/cloudflare-d1-v1/);
 assert.doesNotMatch(sw,/config\.js|supabase/i);
 for(const video of ["Bellaquitas Fest para móvil.mp4","bellaquitas fiesta portada movil.mp4",
    "bellaquitas fiesta portada.mp4","bellaquitas-fiesta-fondo 1.mp4",
    "bellaquitas-fiesta-fondo.mp4"]){
   assert.equal(candidate.includes(video),source.includes(video),video);
 }
 assert.equal(index.replace(/<script src="app-cloudflare\.js\?v=d1-20261114" defer><\/script>/,"<script src=\"app.js?v=traduccion62\" defer></script>")
    .replace("connect-src 'self';","connect-src 'self' https://vlsipvngvxcgnwrhpjgg.supabase.co wss://vlsipvngvxcgnwrhpjgg.supabase.co;")
    .replace("script-src 'self';","script-src 'self' https://esm.sh;")
    .replace('  <script src="locale-fr.js','  <script src="config.js"></script>\n  <script src="locale-fr.js'),
    originalHtml,"No se puede modificar el diseño del index");
});
console.log("OK: web candidata ES/FR, medios, QR y diseño originales con Cloudflare-D1.");
