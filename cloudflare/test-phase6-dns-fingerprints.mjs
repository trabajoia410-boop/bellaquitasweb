#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {evaluateRelease} from './release-policy.mjs';
const dns=JSON.parse(readFileSync('cloudflare/phase6-dns-fingerprints-20261119.json','utf8'));
const gates=JSON.parse(readFileSync('cloudflare/release-gates-2026-11-15.json','utf8'));
assert.equal(dns.schema,'bellaquitas-phase6-dns-fingerprint-v1');
assert.equal(dns.domain,'bellaquitas.fr');
assert.equal(dns.zoneStatusAtCapture,'pending');
assert.deepEqual(dns.oldNameservers,['cosmos.dns-parking.com','nova.dns-parking.com']);
assert.deepEqual(dns.futureCloudflareNameservers,['donald.ns.cloudflare.com','tricia.ns.cloudflare.com']);
assert.equal(dns.records.length,10);
const counts=Object.fromEntries(['A','CNAME','MX','TXT'].map(type=>[
 type,dns.records.filter(x=>x.type===type).length]));
assert.deepEqual(counts,{A:4,CNAME:2,MX:1,TXT:3});
assert.deepEqual(dns.counts,counts);
const publicCount=(t,n)=>dns.records.filter(x=>x.type===t&&x.name===n).length;
assert.equal(publicCount('A','bellaquitas.fr'),4);
assert.equal(publicCount('CNAME','www.bellaquitas.fr'),1);
assert.equal(publicCount('CNAME','rsend.bellaquitas.fr'),1);
assert.equal(publicCount('MX','send.bellaquitas.fr'),1);
assert.equal(publicCount('TXT','bellaquitas.fr'),1);
assert.equal(publicCount('TXT','resend._domainkey.bellaquitas.fr'),1);
assert.equal(publicCount('TXT','send.bellaquitas.fr'),1);
assert.ok(dns.records.every(x=>x.proxied===false),
 'Los registros de correo no deben pasar por proxy DNS');
assert.ok(dns.records.every(x=>/^[0-9a-f]{64}$/.test(x.sha256)),
 'No publicar datos TXT ni sus valores; solo SHA-256');
assert.equal(new Set(dns.records.map(x=>x.sha256)).size,dns.records.length);
assert.ok(!dns.records.some(x=>Object.hasOwn(x,'content')),'Prohibido subir valores DNS TXT');
const status=evaluateRelease(gates);
assert.equal(status.readyForNameserverDelegation,false);
assert.equal(status.readyForControlledPublication,false);
console.log('OK: inventario DNS 4 A, 2 CNAME, 1 MX, 3 TXT protegido por SHA256; sin cambiar delegación ni publicar.');
