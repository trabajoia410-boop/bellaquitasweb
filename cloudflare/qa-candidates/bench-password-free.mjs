/**
 * Laboratorio local para evaluar si las contraseñas actuales del Worker
 * pueden respetar Workers Free: 10ms CPU / petición.
 * Node WebCrypto NO mide Cloudflare, solo proporciona una alerta temprana.
 * Usa datos ficticios. No accede a ninguna cuenta o red.
 */
import {webcrypto} from "node:crypto";
import {performance} from "node:perf_hooks";
const password="Contraseña-FICTICIA-para-QA-2026",salt=new Uint8Array(32).fill(7);
async function derive(phases,iterations){
 let material=new TextEncoder().encode(password);
 for(let i=0;i<phases;i++){
  const s=new Uint8Array(33);s.set(salt);s[32]=i;
  const key=await webcrypto.subtle.importKey("raw",material,"PBKDF2",false,["deriveBits"]);
  material=new Uint8Array(await webcrypto.subtle.deriveBits({name:"PBKDF2",salt:s,iterations,hash:"SHA-256"},key,256));
 }
 return material;
}
const results=[];
for(const [name,phases,iterations] of [
 ["pbkdf2-simple-100k",1,100000],["pbkdf2-chain6-600k",6,100000],["pbkdf2-chain6-repeated",6,100000]
]){
 const begin=performance.now(),cpu=process.cpuUsage();
 await derive(phases,iterations);
 const cpuDiff=process.cpuUsage(cpu);
 const row={name,wallMs:Math.round((performance.now()-begin)*10)/10,
  processCpuMs:Math.round((cpuDiff.user+cpuDiff.system)/100)/10,
  estimatedFreeCpuBudgetMs:10};
 results.push(row);console.log("MUESTRA "+JSON.stringify(row));
}
console.log("NOTA: Node/OpenSSL y el runtime Cloudflare difieren. No equivale a medición de CPU en Worker real.");
if(results.some(r=>r.processCpuMs>10))console.log("ATENCIÓN: al menos un hash excedió el límite libre de 10 ms en este laboratorio.");
