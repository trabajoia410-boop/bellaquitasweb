#!/usr/bin/env node
// Valida que el JavaScript incrustado del panel sea sintácticamente correcto.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const file=readFileSync('cloudflare/admin-console.js','utf8');
// Extraer exclusivamente el literal JSON del HTML; otros módulos constantes
// pueden aparecer entre el HTML y la función de enrutamiento.
assert.ok(file.startsWith('const HTML='));
const encoded=file.match(/^const HTML=("(?:\\.|[^"\\])*");/);
assert.ok(encoded,'Falta cadena segura del HTML');
const html=JSON.parse(encoded[1]);
const translator=file.match(/const ADMIN_TRANSLATION_JS=("(?:\\.|[^"\\])*");/);
assert.ok(translator,'Falta módulo independiente de traducción admin');
const localizedScript=JSON.parse(translator[1]);
new Script(localizedScript,{filename:'admin-i18n-inline.js'});
assert.ok(localizedScript.includes('bellaquitas-lang'));
assert.ok(localizedScript.includes('MutationObserver'));
assert.ok(localizedScript.includes('setLang(preferred)'));
const script=html.match(/<script nonce="__NONCE__">([\s\S]*?)<\/script>/);
assert.ok(script,'El panel necesita CSP con nonce');
new Script(script[1],{filename:'admin-console-inline.js'});
assert.ok(script[1].includes("sessionStorage.getItem(TAB_PROOF)"),'Falta exigir acceso en esta pestaña');
assert.ok(script[1].includes("/v1/admin/session"),'Falta verificación de segunda sesión en backend');
assert.ok(script[1].includes("admin_access:true"),'Falta exigir contraseña verificada para admin');
assert.ok(html.includes('href="/v1/auth/google/start?return=admin"'),'Falta retorno OAuth admin');
assert.ok(!html.includes('supabase.co'),'No debe conectar el panel con Supabase');
assert.ok(script[1].includes('selectedIndex<0?null'), 'Crear evento/premio debe diferenciar nueva ficha');
assert.ok(script[1].includes("setAttribute('contenteditable','true')"), 'Falta editor visual de portada');
assert.ok(script[1].includes('preview.addEventListener'), 'Editor visual sin eventos de actualización');
console.log('OK: panel independiente, JS válido, CSP nonce, reautenticación y API protegida.');
