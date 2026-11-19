/** 
 * Solo para `wrangler dev --local`. No usar en Cloudflare en vivo.
 * Importa exactamente el hash de correo real, sin D1, Resend, Google o cuentas.
 * La contraseña, sal y digest de referencia son valores públicos y sintéticos.
 */
import {passwordHash} from "./email-auth-routes.js";
const PASSWORD="synthetic-test-password-only-2026";
const EXPECTED="pbkdf2-chain6-sha256-v1$y94TeQaoXSTnaR6Qf7fImCEMuh95VYgOijRU67VS36o";
function answer(body,status=200){
 return new Response(JSON.stringify(body),{status,headers:{
  "Content-Type":"application/json; charset=utf-8",
  "Cache-Control":"no-store","X-Robots-Tag":"noindex,nofollow",
  "X-Content-Type-Options":"nosniff","Access-Control-Allow-Origin":"null"
 }});
}
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname!=="/__kdf_synthetic_only")return answer({error:"Not found"},404);
  // Protección ante un deployment accidental: no responde en dominios públicos,
  // workers.dev ni IP remotas. La cabecera NO sustituye este control.
  if(url.hostname!=="127.0.0.1"&&url.hostname!=="localhost")
   return answer({error:"Local runtime only"},403);
  if(request.method!=="POST")return answer({error:"POST only"},405);
  if(env?.KDF_QA_LOCAL_ONLY!=="yes"||
     request.headers.get("X-Bellaquitas-Local-KDF")!=="synthetic-only")
   return answer({error:"Local benchmark disabled"},403);
  try{
   const salt=Uint8Array.from({length:32},(_,i)=>i+7);
   const saltText=btoa(String.fromCharCode(...salt)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
   const started=performance.now();
   const result=await passwordHash(PASSWORD,saltText,600000);
   const wallMs=performance.now()-started;
   // No responder el hash: solo la comparación de un vector ficticio.
   return answer({ok:result===EXPECTED,algorithm:"pbkdf2-chain6-sha256-v1",
    rounds:6,iterationsPerRound:100000,elapsedWorkerdLocalMs:Number(wallMs.toFixed(3)),
    advisoryOnly:true,cloudflareCpuCertified:false});
  }catch(e){
   return answer({ok:false,reason:String(e?.name||"Error").slice(0,40),
    advisoryOnly:true,cloudflareCpuCertified:false},500);
  }
 }
};
