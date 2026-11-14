#!/usr/bin/env node
// Valida que el JavaScript incrustado del panel sea sintácticamente correcto.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const file=readFileSync('cloudflare/admin-console.js','utf8');
const start='const HTML=',end=';\nexport function adminConsoleRoute';
assert.ok(file.startsWith(start));
const pos=file.indexOf(end);
assert.ok(pos>start.length);
const html=JSON.parse(file.slice(start.length,pos));
const script=html.match(/<script nonce="__NONCE__">([\s\S]*?)<\/script>/);
assert.ok(script,'El panel necesita CSP con nonce');
new Script(script[1],{filename:'admin-console-inline.js'});
assert.ok(script[1].includes("sessionStorage.getItem(TAB_PROOF)"),'Falta exigir acceso en esta pestaña');
assert.ok(script[1].includes("/v1/admin/session"),'Falta verificación de segunda sesión en backend');
assert.ok(script[1].includes("admin_access:true"),'Falta exigir contraseña verificada para admin');
assert.ok(html.includes('href="/v1/auth/google/start?return=admin"'),'Falta retorno OAuth admin');
assert.ok(!html.includes('supabase.co'),'No debe conectar el panel con Supabase');
console.log('OK: panel independiente, JS válido, CSP nonce, reautenticación y API protegida.');
