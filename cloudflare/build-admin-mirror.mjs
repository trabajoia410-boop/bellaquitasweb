/**
 * Fase 5: aplicar SOLO la navegación del nuevo panel a la copia visual
 * que se probará en el Worker. No tocar HTML/CSS/logo/vídeo ni main.
 * Uso tras extract-modules.mjs: node --experimental-default-type=module cloudflare/build-admin-mirror.mjs
 */
import {readFile,writeFile} from "node:fs/promises";
import {fileURLToPath,pathToFileURL} from "node:url";
import path from "node:path";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";

const here=path.dirname(fileURLToPath(import.meta.url));
const original=path.join(here,"staging-source-2026-11-11","mirror-snapshot.js");
const output=path.join(here,"staging-source-2026-11-11","recovered-src","mirror-snapshot.js");
const {MIRROR_SNAPSHOT:previous}=await import(pathToFileURL(original).href);
const updated=await readFile(path.join(here,"..","app.js"),"utf8");
assert.ok(previous["app.js"]?.includes("Bellaquitas"),"La copia original no incluye app.js");
for(const expected of [
  'href="/administracion/" target="_blank" rel="noopener noreferrer"',
  'href="/administracion/?seccion=web" target="_blank" rel="noopener noreferrer"'
]) assert.ok(updated.includes(expected),"Falta el acceso nuevo: "+expected);
assert.ok(!updated.includes('href="#/panel"'),"Queda un enlace al panel antiguo");
assert.ok(!updated.includes('href="#/editor"'),"Queda un enlace al editor antiguo");
const changed={...previous,"app.js":updated};
for(const [file,bytes] of Object.entries(previous)){
  if(file==="app.js")continue;
  assert.strictEqual(changed[file],bytes,"El rediseño o cambio audiovisual no está permitido: "+file);
}
await writeFile(output,
  "// Snapshot de ensayo: SOLO app.js administrativo cambia; diseño y medios idénticos.\n"+
  "export const MIRROR_SNAPSHOT="+JSON.stringify(changed)+";\n","utf8");
const hash=str=>createHash("sha256").update(str).digest("hex").slice(0,16);
console.log("OK: copia del espejo actualizada SOLO con navegación del panel privado.");
console.log("HTML/CSS/idiomas/librerías QR originales: "+Object.keys(previous).length+" recursos conservados.");
console.log("SHA256 abreviado HTML: "+hash(changed["index.html"])+", CSS: "+hash(changed["styles.css"]));
console.log("Enlaces: /administracion/ y /administracion/?seccion=web.");
console.log("No se ha desplegado ni modificado ningún archivo público.");
