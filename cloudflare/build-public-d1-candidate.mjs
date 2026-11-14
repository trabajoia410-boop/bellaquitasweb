/**
 * Bellaquitas Fest: generar app.js alternativa para la migración D1.
 * No modifica app.js, assets/, index.html, estilos ni el sitio oficial.
 * La UI se reutiliza intacta salvo la pantalla de acceso Google.
 * El resultado se guarda SOLO dentro de recovered-src en el runner local.
 */
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {join,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import assert from "node:assert/strict";

const here=dirname(fileURLToPath(import.meta.url));
const origin=await readFile(join(here,"..","app.js"),"utf8");
const implementation=await readFile(
 join(here,"qa-candidates","public-d1-browser-impl.js"),"utf8");
let src=origin;
function once(before,after){
 const parts=src.split(before);
 assert.equal(parts.length,2,"Ancla del frontend ambigua: "+before.slice(0,70));
 src=parts.join(after);
}
function between(first,last,replacement){
 const a=src.indexOf(first),b=src.indexOf(last,a+first.length);
 assert.ok(a>=0&&b>a,"Ancla del frontend no encontrada: "+first.slice(0,80));
 src=src.slice(0,a)+replacement+"\n"+src.slice(b);
}
once(
 "/* Bellaquitas Fest — interfaz pública y cuentas reales con Supabase.\n   La autorización y los permisos se verifican en el servidor mediante RLS. */",
 "/* Bellaquitas Fest — misma interfaz visual; candidato Cloudflare Workers + D1.\n   Sesiones HttpOnly y permisos por rol verificados exclusivamente por D1. */");
once("const live = !!(cfg.supabaseUrl && cfg.supabaseAnonKey);","const live = true;");
once("let sb = null, session = null, data = emptyData(), current = null;",
     "let sb = Object.freeze({}), session = null, data = emptyData(), current = null;");
between("async function loadCommunity(){","function communityShell(content){",
 "async function loadCommunity(){return cloudLoadCommunity();}\n"+
 "async function loadCommunityAdmin(){communitySuggestions=[];}");
between("async function saveCommunitySuggestion(form){","async function communityAdminAction(el,act){",
 "async function saveCommunitySuggestion(form){return cloudSaveSuggestion(form);}");
const originalPhotoUrl="const url=sb.storage.from(MEDIA_BUCKET).getPublicUrl(p.storage_path).data.publicUrl;";
assert.equal(src.split(originalPhotoUrl).length,3,
 "Se esperaban dos referencias de fotos antiguas");
src=src.split(originalPhotoUrl).join("const url=p.image_url||'';");
between("function auth(){","function roleLabel(role){",
 "function auth(){return cloudAuthScreen();}");
between("async function loadLive(){","function createQR(code){",
 "async function loadLive(){return cloudLoadLive();}\n"+
 "async function resumeSavedSession(){return cloudResumeSavedSession();}\n"+
 "window.addEventListener('pageshow',ev=>{if(ev.persisted)void resumeSavedSession();});\n"+
 "document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void resumeSavedSession();});\n"+
 "window.addEventListener('online',()=>{void resumeSavedSession();});\n"+
 "async function loadPublic(){return cloudLoadPublic();}\n"+
 "async function refresh(){return cloudRefresh();}\n"+
 "function subscribeToSessionChanges(){}\n"+
 "async function init(){return cloudInit();}");
between("async function visit(code){","async function toggle(table,id){",
 "async function visit(code){return cloudVisit(code);}\n"+
 "async function redeem(reward_id){return cloudRedeem(reward_id);}\n"+
 "async function validate(code){return cloudValidate(code);}");
between("async function signInWithGoogle(button){",
        "document.addEventListener('click',ev=>{const link=ev.target.closest('a[href^=\"#/\"]')",
 "async function signInWithGoogle(button){return cloudGoogleLogin(button);}");
between("async function handleAuthSubmit(fd){","document.addEventListener('submit',ev=>{",
 "async function handleAuthSubmit(fd){"+
 "throw new Error('El acceso por contraseña está desactivado hasta completar la migración segura. Utiliza Google.');}");
between("if(act==='logout'){editorDraft=null;","if(act==='loyalty-face'){",
 "if(act==='logout'){await cloudLogout();return;}");
once(
 "const r=await sb.rpc('update_display_name',{p_name:name});if(r.error)throw new Error(r.error.message);\n      await refresh();toast('Perfil actualizado.');return;",
 "await cloudUpdateName(name);return;");
once("init();\n})();",implementation+"\ninit();\n})();");
assert.ok(src.includes("location.assign('/v1/auth/google/start')"));
assert.ok(src.includes("cloudApi('/v1/me/overview')"));
assert.ok(!src.includes("await import('https://esm.sh/@supabase/"));
assert.ok(!src.includes("sb.auth.signInWithOAuth("));
assert.ok(!src.includes("sb.auth.getSession("));
assert.ok(!src.includes("sb.auth.signOut("));
assert.ok(!src.includes("await sb.rpc('register_visit'"));
assert.ok(!src.includes("await sb.rpc('request_redemption'"));
assert.ok(!src.includes("await sb.rpc('validate_redemption'"));
const output=join(here,"staging-source-2026-11-11",
 "recovered-src","app-cloudflare.js");
await mkdir(dirname(output),{recursive:true});
await writeFile(output,src,"utf8");
console.log("OK: app pública Cloudflare-D1 generada en runner de prueba.");
console.log("Diseño original intacto: no modificados app.js, HTML, CSS ni vídeos.");
console.log("Sin despliegue, cuentas ni puntos reales; contraseña pendiente hasta verificación.");
