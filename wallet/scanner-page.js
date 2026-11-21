/**
 * Employee/admin scanner. UI can show PIN form anonymously, but every
 * seal is enforced on the server by a restricted session or existing role.
 */
import {WALLET_I18N} from "./i18n.js";
export function walletScannerPage(request,env){
 const path=new URL(request.url).pathname;
 if(path!=="/admin/escanear"&&path!=="/admin/escanear/")return null;
 if(request.method!=="GET"&&request.method!=="HEAD")return new Response(null,{status:405});
 if(env?.SITE_MODE!=="production"||env.WALLET_ENABLED!=="yes"||
    env.WALLET_STAFF_ENABLED!=="yes")
  return new Response("Escáner no disponible",{status:404,headers:{"Cache-Control":"no-store"}});
 const nonce=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(18))));
 const i18n=JSON.stringify(WALLET_I18N).replace(/</g,"\\u003c");
 const client=String.raw`
(()=>{
 "use strict";
 const i18n=JSON.parse(document.getElementById("dict").textContent);
 const el=id=>document.getElementById(id),status=s=>el("status").textContent=s;
 let lang=localStorage.getItem("bellaquitas-lang")==="fr"?"fr":"es";
 const t=k=>i18n[lang][k]||k;
 const show=field=>{for(const node of document.querySelectorAll("[data-view]"))
  node.hidden=node.dataset.view!==field;};
 for(const value of ["es","fr"])
  el("lang-"+value).addEventListener("click",()=>{
   lang=value;document.documentElement.lang=value;
   localStorage.setItem("bellaquitas-lang",value);
   for(const node of document.querySelectorAll("[data-i18n]"))
    node.textContent=t(node.dataset.i18n);
  });
 const post=async(path,data)=>{
  const r=await fetch(path,{method:"POST",credentials:"same-origin",cache:"no-store",
   headers:{"Content-Type":"application/json"},
   body:JSON.stringify(data)});
  const v=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(v.error||t("error"));return v;
 };
 el("use-existing").addEventListener("click",()=>{
  show("camera");status("Se comprobarán tus permisos al añadir un sello.");
 });
 el("pin-form").addEventListener("submit",async e=>{
  e.preventDefault();
  try{await post("/v1/wallet/employee/login",{
   slug:"bellaquitas-fest",pin:el("pin").value});
   el("pin").value="";show("camera");status("Acceso de escáner autorizado.");
  }catch(err){status(err.message);}
 });
 let stream=null,timer=null,locked=false;
 const video=el("video"),canvas=el("canvas");
 function stop(){
  if(timer){cancelAnimationFrame(timer);timer=null;}
  if(stream){for(const track of stream.getTracks())track.stop();stream=null;}
 }
 async function submitCode(code){
  if(locked)return;locked=true;stop();status(t("loading"));
  try{
   const result=await post("/v1/wallet/stamp",{
    code,requestId:crypto.randomUUID()});
   status(result.name+" · "+result.stamps+" / "+result.goal+
    (result.rewardReady?" · "+t("ready"):""));
  }catch(err){status(err.message);}
  finally{locked=false;}
 }
 function frame(){
  if(!stream||video.readyState<2){timer=requestAnimationFrame(frame);return;}
  canvas.width=video.videoWidth;canvas.height=video.videoHeight;
  const ctx=canvas.getContext("2d",{willReadFrequently:true});
  ctx.drawImage(video,0,0,canvas.width,canvas.height);
  const data=ctx.getImageData(0,0,canvas.width,canvas.height);
  const qr=window.jsQR?.(data.data,canvas.width,canvas.height,{
   inversionAttempts:"dontInvert"});
  if(qr?.data&&qr.data.startsWith("bfw1.")){submitCode(qr.data);return;}
  timer=requestAnimationFrame(frame);
 }
 el("camera").addEventListener("click",async()=>{
  stop();status("Abriendo cámara…");
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw Error("Necesitas HTTPS y cámara");
   stream=await navigator.mediaDevices.getUserMedia({audio:false,
    video:{facingMode:{ideal:"environment"}}});
   video.srcObject=stream;await video.play();frame();
  }catch(err){stop();status(err.message);}
 });
 el("stop").addEventListener("click",stop);
 el("manual-form").addEventListener("submit",async e=>{
  e.preventDefault();await submitCode(el("manual-code").value.trim());});
 window.addEventListener("pagehide",stop);
 show("pin");
})();`;
 const html=[
 '<!doctype html><html lang="es"><head><meta charset="utf-8">',
 '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">',
 '<title>Bellaquitas Fest · Escáner Wallet</title>',
 '<style>:root{color-scheme:dark}body{background:#0e0a0e;color:#f4eadc;font:16px/1.5 system-ui,sans-serif;margin:0}main{width:min(540px,calc(100% - 24px));margin:32px auto}.panel{border:1px solid #765464;border-radius:20px;background:#24171f;padding:22px}button{cursor:pointer;background:#e9c477;color:#231019;border:0;border-radius:10px;padding:12px 16px;font:700 15px system-ui}input{background:#120b12;border:1px solid #80607b;padding:12px;border-radius:9px;color:#fff;font:inherit;width:100%;box-sizing:border-box;margin-bottom:15px}video{width:100%;border-radius:14px;background:black;max-height:60vh}[hidden]{display:none!important}#status{color:#e9c477;min-height:3em}h1{color:#f1ca87}</style>',
 '</head><body><main><h1 data-i18n="scanner">Escanear tarjeta</h1>',
 '<p>Solo se permite añadir un sello. Los puntos antiguos no cambian.</p>',
 '<button id="lang-es">ES</button> <button id="lang-fr">FR</button>',
 '<div class="panel" data-view="pin"><h2 data-i18n="login">Acceso con código de empleado</h2>',
 '<form id="pin-form"><label for="pin">PIN 4 cifras</label><input id="pin" type="password" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" autocomplete="off" required>',
 '<button type="submit" data-i18n="continue">Continuar</button></form><button type="button" id="use-existing">Usar mi sesión de puerta o administrador</button><p>Los administradores y el personal de puerta con sesión válida también pueden sellar directamente desde el escáner.</p></div>',
 '<div class="panel" data-view="camera" hidden><button type="button" id="camera" data-i18n="scan">Abrir cámara</button>',
 '<button type="button" id="stop" data-i18n="cancel">Cancelar</button>',
 '<video id="video" playsinline muted></video><canvas id="canvas" hidden></canvas>',
 '<form id="manual-form"><label for="manual-code">Código QR</label><input id="manual-code" placeholder="bfw1. …">',
 '<button type="submit">Añadir sello</button></form></div>',
 '<p id="status" role="status" aria-live="polite"></p></main>',
 '<script id="dict" type="application/json">'+i18n+'</script>',
 '<script defer src="/assets/jsqr-local.js"></script>',
 '<script nonce="'+nonce+'">'+client+'</script></body></html>'
 ].join("");
 const headers={"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store",
  "X-Robots-Tag":"noindex,nofollow","X-Content-Type-Options":"nosniff",
  "Content-Security-Policy":"default-src 'none'; base-uri 'none'; form-action 'self';"+
   " script-src 'self' 'nonce-"+nonce+"'; connect-src 'self'; style-src 'unsafe-inline';"+
   " img-src 'self' data:; frame-ancestors 'none'"};
 return new Response(request.method==="HEAD"?null:html,{status:200,headers});
}
