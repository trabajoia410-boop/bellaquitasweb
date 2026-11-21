#!/usr/bin/env node
/**
 * Bellaquitas Fase 6: benchmark ADVISORY en Node sobre valores sintéticos.
 * No emplea contraseña, cuenta, token ni secreto real.
 * IMPORTANTE: rendimiento Node ≠ CPU de Cloudflare Workers. No acredita 10 ms.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
const source=readFileSync('cloudflare/email-auth-routes.js','utf8');
assert.match(source,/const ITERATIONS=600000;/);
assert.match(source,/for\(let phase=0;phase<6;phase\+\+\)/);
assert.match(source,/iterations:100000/);
const salt=Uint8Array.from({length:32},(_,i)=>i+7);
let material=new TextEncoder().encode('synthetic-test-password-only-2026');
const stages=[];
for(let phase=0;phase<6;phase++){
 const phaseSalt=new Uint8Array(33);
 phaseSalt.set(salt);phaseSalt[32]=phase;
 const start=process.hrtime.bigint();
 const key=await webcrypto.subtle.importKey('raw',material,'PBKDF2',false,['deriveBits']);
 material=new Uint8Array(await webcrypto.subtle.deriveBits({
  name:'PBKDF2',salt:phaseSalt,iterations:100000,hash:'SHA-256'
 },key,256));
 stages.push(Number(process.hrtime.bigint()-start)/1e6);
}
assert.equal(material.byteLength,32);
const wallTimeMs=stages.reduce((a,b)=>a+b,0);
console.log(JSON.stringify({
 benchmark:'LOCAL_NODE_WEBCRYPTO_ONLY_NOT_CLOUDFLARE_CPU',
 scheme:'pbkdf2-chain6-sha256-v1',
 rounds:6,iterationsPerRound:100000,
 estimatedWallMs:Math.round(wallTimeMs*1000)/1000,
 runtime:process.version,
 result:'ADVISORY_UNSUITABLE_FOR_10MS_CERTIFICATION',
 releaseGateMustRemainClosed:true
}));
