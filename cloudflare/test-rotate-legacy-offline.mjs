#!/usr/bin/env node
/** Sin cuentas, red, Cloudflare, secretos ni SQL real; ensaya recifrado AES completo. */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {webcrypto,randomBytes,createCipheriv,createDecipheriv,createHash} from "node:crypto";
import {gzipSync,gunzipSync} from "node:zlib";
const html=readFileSync("cloudflare/ROTACION_AUTENTICA_RESPALDO_ANTIGUO_OFFLINE.html","utf8");
assert.match(html,/connect-src 'none'/);
assert.match(html,/form-action 'none'/);
assert.match(html,/Rotación REAL/);
assert.doesNotMatch(html,/<script[^>]*src=/);
const source=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(source&&source.length>3000);
const ctx={
 crypto:webcrypto,TextDecoder,TextEncoder,Uint8Array,ArrayBuffer,DataView,Blob,Response,
 DecompressionStream,Date,Object,String,Number,URL,atob,btoa,console,document:undefined
};
const exported=runInNewContext(source+"\n;({rotateLegacyBackup,parseOldKey})",ctx);
const sha=x=>createHash("sha256").update(x).digest("hex");
const plaintext=Buffer.from("-- Bellaquitas Fest SQL backup local\n-- TEST SINTETICO\nCREATE TABLE q(x);\nINSERT INTO q VALUES(1);\n","utf8");
const originalKey=randomBytes(32),iv=randomBytes(12);
const cipher=createCipheriv("aes-256-gcm",originalKey,iv);
const compressed=gzipSync(plaintext);
const ciphertext=Buffer.concat([cipher.update(compressed),cipher.final(),cipher.getAuthTag()]);
const archive={
 version:1,source:"local-sql-unverified",compression:"gzip",algorithm:"AES-256-GCM",
 created_at:"2026-11-19T00:00:00Z",plaintext_bytes:plaintext.length,
 plaintext_sha256:sha(plaintext),iv_base64:iv.toString("base64"),
 ciphertext_base64:ciphertext.toString("base64")
};
const oldBytes=Uint8Array.from(Buffer.from(JSON.stringify(archive)));
const keyNote="CLAVE PRIVADA DE RECUPERACION BELLAQUITAS FEST\n\n"+originalKey.toString("hex")+"\n\nNo compartas esta clave.";
assert.deepEqual(Buffer.from(exported.parseOldKey(keyNote)),originalKey);
const rotated=await exported.rotateLegacyBackup(oldBytes,keyNote,false);
assert.equal(rotated.archive.version,1);
assert.equal(rotated.archive.plaintext_sha256,sha(plaintext));
assert.equal(rotated.archive.plaintext_bytes,plaintext.length);
assert.equal(rotated.originalSha256,sha(oldBytes));
assert.notEqual(rotated.archive.iv_base64,archive.iv_base64);
assert.notEqual(rotated.archive.ciphertext_base64,archive.ciphertext_base64);
const newKey=Buffer.from(rotated.newKeyBase64,"base64");
assert.equal(newKey.length,32);
assert.notDeepEqual(newKey,originalKey);
const round=Buffer.from(rotated.archive.ciphertext_base64,"base64");
const decipher=createDecipheriv("aes-256-gcm",newKey,Buffer.from(rotated.archive.iv_base64,"base64"));
decipher.setAuthTag(round.subarray(-16));
const restored=gunzipSync(Buffer.concat([decipher.update(round.subarray(0,-16)),decipher.final()]));
assert.deepEqual(restored,plaintext,"La nueva clave restaura SQL exactamente, no el archivo+clave antigua");
assert.ok(!JSON.stringify(rotated.archive).includes(originalKey.toString("hex")));
assert.ok(!JSON.stringify(rotated.archive).includes(originalKey.toString("base64")));
await assert.rejects(()=>exported.rotateLegacyBackup(oldBytes,keyNote,true),/SHA-256 original/);
await assert.rejects(()=>exported.rotateLegacyBackup(oldBytes,"CLAVE PRIVADA\n"+randomBytes(32).toString("hex"),false),/no descifra/);
const tampered={...archive,ciphertext_base64:Buffer.from(randomBytes(ciphertext.length)).toString("base64")};
await assert.rejects(()=>exported.rotateLegacyBackup(Uint8Array.from(Buffer.from(JSON.stringify(tampered))),keyNote,false),/no descifra/);
const unsupported={...archive,version:2};
await assert.rejects(()=>exported.rotateLegacyBackup(Uint8Array.from(Buffer.from(JSON.stringify(unsupported))),keyNote,false),/Formato original desconocido/);
console.log("OK: HTML offline rota AES real, rehace la clave, restaura SQL idéntico, y rechaza clave falsa/alteración/formato no permitido/SHA no reconocido. Datos 100% sintéticos.");
