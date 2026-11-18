#!/usr/bin/env node
// Valida que el JavaScript incrustado del panel sea sintácticamente correcto.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {adminConsoleRoute} from './admin-console.js';
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
// Comprobar que no falte ninguna etiqueta estática visible ni aviso administrativo.
const dictSource=localizedScript.match(/const dict=(\{[^\n]+\});\nconst reverse=/);
assert.ok(dictSource,'Diccionario bilingüe ausente');
const dictionary=JSON.parse(dictSource[1]);
const plain=html.replace(/<script[\s\S]*?<\/script>/g,'').replace(/<style[\s\S]*?<\/style>/g,'');
const visible=[...new Set([...plain.matchAll(/>([^<>]+)</g)].map(m=>m[1].trim())
 .filter(x=>x&&/[A-Za-zÀ-ÿ]/.test(x)))];
const names=new Set(['👑 BELLAQUITAS','FEST','Bellaquitas Fest']);
assert.deepEqual(visible.filter(x=>!names.has(x)&&!Object.hasOwn(dictionary,x)),[],
 'Todas las etiquetas estáticas del panel deben traducirse al francés');
assert.equal(new Set(Object.values(dictionary)).size,Object.keys(dictionary).length,
 'Dos textos franceses iguales impedirían restaurar el español correctamente');
const dynamic=[...new Set([...script[1].matchAll(/(?:status\(|textContent\s*=|throw Error\()\s*'([^']+)'/g)]
 .map(m=>m[1]))];
assert.deepEqual(dynamic.filter(x=>!Object.hasOwn(dictionary,x)),[],
 'Todos los estados admin literales deben tener traducción');
console.log('OK: cobertura completa de '+visible.length+' etiquetas visibles y '+dynamic.length+' avisos ES/FR.');
// Los enlaces del panel recuperan contraseña desde la página que
// realmente existe en cada alojamiento, sin redirigir a un espejo cerrado.
const stagingPage=adminConsoleRoute(new Request('https://bellaquitas-api-staging.example/administracion/'),{SITE_MODE:'staging'});
assert.equal(stagingPage.status,200);
assert.match(await stagingPage.text(),/id="adminPasswordRecovery"/);
const finalPage=adminConsoleRoute(new Request('https://bellaquitas.fr/administracion/'),{SITE_MODE:'production'});
assert.equal(finalPage.status,200);
const finalHTML=await finalPage.text();
assert.match(finalHTML,/href="\/#\/recuperar"[^>]*id="adminPasswordRecovery"/);
assert.ok(!finalHTML.includes('href="/espejo/#/recuperar"'),
 'El dominio final no debe abrir el espejo retirado');
assert.equal(finalPage.headers.get('X-Robots-Tag'),'noindex, nofollow');
assert.match(finalPage.headers.get('Content-Security-Policy'),/script-src 'nonce-/);
const preprodPage=adminConsoleRoute(new Request('https://bellaquitas.fr/administracion/'),{SITE_MODE:'preproduction'});
assert.ok((await preprodPage.text()).includes('href="/espejo/#/recuperar"'),
 'Un modo no-productivo no puede adelantar rutas canónicas');
console.log('OK: panel independiente, JS válido, CSP nonce, reautenticación y API protegida.');
