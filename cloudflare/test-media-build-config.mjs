#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const v=JSON.parse(readFileSync('cloudflare/wrangler-media-qa.jsonc','utf8'));
assert.equal(v.name,'bellaquitas-media-qa');
assert.equal(v.main,'./media-qa-worker.js');
assert.equal(v.workers_dev,true);
assert.deepEqual(v.assets,{directory:'./dist-static',binding:'ASSETS',run_worker_first:true});
assert.ok(!Object.hasOwn(v,'routes')&&!Object.hasOwn(v,'route'));
assert.ok(!Object.hasOwn(v,'d1_databases')&&!Object.hasOwn(v,'r2_buckets'));
assert.ok(!Object.hasOwn(v,'kv_namespaces')&&!Object.hasOwn(v,'vars'));
assert.ok(!Object.hasOwn(v,'triggers'));
const src=readFileSync('cloudflare/media-qa-worker.js','utf8');
assert.ok(src.includes('env.ASSETS.fetch(assetRequest)'),'Worker solo lee sus assets');
assert.ok(src.includes('forwarded.delete(h)'),'Worker debe eliminar Range y validadores del fetch del asset para evitar doble recorte');
assert.ok(src.includes('streamByteRange(response.body,range.start,range.end)'),'Los rangos Safari se sirven con streaming del archivo completo');
assert.ok(!src.includes('env.DB')&&!src.includes('env.R2'),'Worker sin datos');
console.log('OK: despliegue GitHub media QA solo Static Assets, 20 archivos originales, sin DNS, R2, D1, puntos ni cuentas.');
