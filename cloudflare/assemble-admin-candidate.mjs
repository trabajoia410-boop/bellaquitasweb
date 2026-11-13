/**
 * Bellaquitas Fest - ensamblaje reproducible de la consola independiente.
 * USO: node --experimental-default-type=module cloudflare/assemble-admin-candidate.mjs
 *
 * Solo genera archivos en recovered-src del runner local.
 * No toca env/cloud, DNS, GitHub main ni contrata servicios.
 * Requiere primero extract-modules.mjs.
 */
import {readFile,writeFile,access} from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import {fileURLToPath,pathToFileURL} from "node:url";
const here=path.dirname(fileURLToPath(import.meta.url));
const qa=path.join(here,"qa-candidates"),built=path.join(here,"staging-source-2026-11-11","recovered-src");
for(const filename of ["bellaquitas-api-staging.js","mirror-snapshot.js"])await access(path.join(built,filename));
const names=["admin-console.html","admin-console.css","admin-console-browser.js"];
const props=["ADMIN_HTML","ADMIN_CSS","ADMIN_JS"];
const parts=await Promise.all(names.map(name=>readFile(path.join(qa,name),"utf8")));
const bundled=props.map((name,i)=>"export const "+name+" = "+JSON.stringify(parts[i])+";").join("\n")+"\n";
const current=await readFile(path.join(qa,"admin-console-ui.js"),"utf8");
assert.strictEqual(bundled,current,"Cambios en el panel sin empaquetar: regenerar admin-console-ui.js antes de validar");
for(const [dest,src] of [
 ["auth-routes.js","auth-routes-admin-proof.js"],
 ["admin-activation-routes.js","admin-activation-routes.js"],
 ["admin-console-routes.js","admin-console-routes.js"],
 ["admin-console-ui.js","admin-console-ui.js"],
 ["free-only-cost-policy.js","free-only-cost-policy.js"],
 ["supabase-admin-bridge.js","supabase-admin-bridge.js"],
 ["bellaquitas-api-staging.js","bellaquitas-api-staging-admin.js"]
]){
 await writeFile(path.join(built,dest),await readFile(path.join(qa,src),"utf8"));
}
// Preservar el sitio exactamente; cambiar solo app.js para enlazar nuevo panel.
const {MIRROR_SNAPSHOT:previous}=await import(pathToFileURL(path.join(here,"staging-source-2026-11-11","mirror-snapshot.js")).href);
const app=await readFile(path.join(here,"..","app.js"),"utf8");
assert.ok(app.includes('href="/administracion/" target="_blank" rel="noopener noreferrer"'));
assert.ok(app.includes('href="/administracion/?seccion=web" target="_blank" rel="noopener noreferrer"'));
const updated={...previous,"app.js":app};
for(const name of Object.keys(previous)){
 if(name!=="app.js")assert.strictEqual(updated[name],previous[name],"No cambiar diseño/medios "+name);
}
await writeFile(path.join(built,"mirror-snapshot.js"),
 "// Bellaquitas: mismo diseño, app.js con enlaces a nuevo panel.\n"+
 "export const MIRROR_SNAPSHOT="+JSON.stringify(updated)+";\n");
console.log("OK: ensamblado nuevo panel/admin y enlaces en espejo original, sin desplegar.");
console.log("Conservados "+(Object.keys(previous).length-1)+" recursos visuales sin cambios.");
console.log("No se ha accedido a credenciales, datos ni servicios de pago.");
