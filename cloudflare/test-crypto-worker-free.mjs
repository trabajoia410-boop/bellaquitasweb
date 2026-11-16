#!/usr/bin/env node
// Bench de WebCrypto sobre un Worker temporal independiente, sin sesiones ni PII.
const url='https://bellaquitas-crypto-bench-qa-20261116.bellaquitas-fest-410.workers.dev/test';
const results=[];
for(let i=0;i<3;i++){
  try{
    const r=await fetch(url,{headers:{'Cache-Control':'no-store'},signal:AbortSignal.timeout(25000)});
    const body=await r.text();
    results.push({status:r.status,ok:r.ok,payload:body.slice(0,150)});
  }catch(e){results.push({error:String(e).slice(0,120)})}
}
console.log(JSON.stringify({syntheticCryptoWorker:results}));
if(!results.some(x=>x.ok&&/"ok":true/.test(x.payload)))process.exitCode=1;
