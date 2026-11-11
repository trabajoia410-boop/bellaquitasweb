/* Bellaquitas Fest: registro, verificación y recuperación Cloudflare
   sobre el diseño ORIGINAL. Solo se añade el captcha exigido por seguridad.
   No registrar contraseñas, códigos ni tokens en consola o en HTML público. */
(()=>{
"use strict";
const $=s=>document.querySelector(s);
const strings={
 es:{
  captcha:"Completa la comprobación de seguridad antes de continuar.",
  unavailable:"La verificación no está disponible. Actualiza la página.",
  mismatch:"Las contraseñas no coinciden.",
  short:"Usa una contraseña de al menos 12 caracteres.",
  sent:"Si es posible continuar, recibirás instrucciones por correo. Revisa también spam.",
  sending:"Enviando solicitud de forma segura…",
  verifying:"Comprobando correo…",
  verified:"Correo confirmado. Ya puedes iniciar sesión.",
  verify:"Confirmar mi correo",
  resetOk:"Contraseña cambiada correctamente. Ya puedes iniciar sesión.",
  processing:"Procesando…",
  expired:"Enlace caducado. Solicita otro correo de recuperación.",
  back:"Volver a iniciar sesión"
 },
 fr:{
  captcha:"Terminez la vérification de sécurité avant de continuer.",
  unavailable:"Vérification indisponible. Actualisez la page.",
  mismatch:"Les mots de passe ne correspondent pas.",
  short:"Utilisez un mot de passe d'au moins 12 caractères.",
  sent:"Si la demande peut être traitée, vous recevrez un e-mail. Vérifiez les spams.",
  sending:"Envoi sécurisé de la demande…",
  verifying:"Vérification de l'adresse e-mail…",
  verified:"Adresse confirmée. Vous pouvez vous connecter.",
  verify:"Confirmer mon e-mail",
  resetOk:"Mot de passe modifié. Vous pouvez vous connecter.",
  processing:"Traitement en cours…",
  expired:"Lien expiré. Demandez un nouveau message.",
  back:"Retour à la connexion"
 }
};
const tr=()=>strings[document.documentElement.lang==="fr"?"fr":"es"];
const params=new URLSearchParams(location.search);
let verifyToken=params.get("verify"),resetToken=params.get("reset_token");
const tokenOk=x=>typeof x==="string"&&/^[A-Za-z0-9_-]{43}$/.test(x);
if(!tokenOk(verifyToken))verifyToken=null;
if(!tokenOk(resetToken))resetToken=null;
try{
 if(verifyToken)sessionStorage.setItem("bq-mirror-verify-token",verifyToken);
 if(resetToken)sessionStorage.setItem("bq-mirror-reset-token",resetToken);
 verifyToken=verifyToken||sessionStorage.getItem("bq-mirror-verify-token");
 resetToken=resetToken||sessionStorage.getItem("bq-mirror-reset-token");
 if(!tokenOk(verifyToken))verifyToken=null;
 if(!tokenOk(resetToken))resetToken=null;
}catch{}
if(params.has("verify")||params.has("reset_token")){
 try{history.replaceState(null,"",location.pathname+location.hash);}catch{}
}
const formKind=()=>location.hash.startsWith("#/registro")?"register":
 location.hash.startsWith("#/recuperar")?"forgot":
 location.hash.startsWith("#/restablecer")?"reset":null;
const statusPromise=fetch("/v1/auth/email/status",{credentials:"same-origin",cache:"no-store"})
 .then(r=>r.ok?r.json():null).catch(()=>null);
let activeForm=null,widget=null,ready=false;
function notice(text){
 const n=$("#auth-feedback");
 if(n){n.textContent=String(text||"");n.hidden=!text;n.setAttribute("role","status");}
}
async function post(path,body){
 const r=await fetch(path,{method:"POST",credentials:"same-origin",cache:"no-store",
  headers:{"Content-Type":"application/json"},
  body:JSON.stringify(body)});
 const value=await r.json().catch(()=>({}));
 if(!r.ok)throw Error(value.error||"No se pudo completar la solicitud.");
 return value;
}
function clearWidget(){
 if(widget!==null&&window.turnstile){
  try{window.turnstile.remove(widget);}catch{}
 }
 widget=null;activeForm=null;ready=false;
}
function captchaResponse(){
 if(widget===null||!window.turnstile)return "";
 try{return window.turnstile.getResponse(widget)||"";}catch{return "";}
}
async function ensure(){
 const kind=formKind(),form=$("#auth-form");
 if(!form){
  if(activeForm&&!document.contains(activeForm))clearWidget();
  return;
 }
 if(verifyToken&&location.hash.startsWith("#/acceso"))await attachVerify();
 if(!kind){
  if(activeForm&&!document.contains(activeForm))clearWidget();
  return;
 }
 if(kind==="reset")return;
 const status=await statusPromise;
 if(!document.contains(form)||form!==$("#auth-form"))return;
 if(kind!=="register"&&kind!=="forgot"){return;}
 if(form===activeForm&&ready)return;
 if(activeForm!==form)clearWidget();
 activeForm=form;
 if(!status?.turnstileSiteKey){
  notice(tr().unavailable);return;
 }
 // La clase existente del formulario, campos y botones no se modifican.
 if(!$("#bq-mirror-turnstile")){
  const slot=document.createElement("div");
  slot.id="bq-mirror-turnstile";
  slot.style.cssText="display:flex;align-items:center;justify-content:center;min-height:70px;margin:12px 0";
  form.querySelector('button[type="submit"]')?.before(slot);
 }
 if(!window.turnstile){return;}
 try{
  widget=window.turnstile.render("#bq-mirror-turnstile",{
   sitekey:status.turnstileSiteKey,
   theme:"dark",
   "expired-callback":()=>notice(tr().captcha),
   "error-callback":()=>notice(tr().captcha)
  });
  ready=true;
 }catch{notice(tr().unavailable);}
}
async function attachVerify(){
 if(!verifyToken)return;
 const panel=$(".auth-panel");if(!panel||$("#bq-mirror-verify"))return;
 const box=document.createElement("div");
 box.id="bq-mirror-verify";
 box.style.cssText="margin:16px 0;padding:12px;border:1px solid #80632a;border-radius:10px";
 const b=document.createElement("button");
 b.type="button";b.className="btn btn-primary";b.textContent=tr().verify;
 const p=document.createElement("p");p.setAttribute("role","status");
 p.style.cssText="margin-top:10px";
 b.addEventListener("click",async()=>{
  b.disabled=true;p.textContent=tr().verifying;
  try{
   await post("/v1/auth/email/verify",{token:verifyToken});
   verifyToken=null;try{sessionStorage.removeItem("bq-mirror-verify-token");}catch{}
   p.textContent=tr().verified;
  }catch(e){p.textContent=e.message;b.disabled=false;}
 });
 box.append(b,p);
 panel.querySelector("nav.switch-row")?.after(box);
 if(!box.parentNode)panel.prepend(box);
}
async function submit(form,kind){
 const button=form.querySelector('button[type="submit"]');
 const data=new FormData(form);
 const email=String(data.get("email")||"").trim().toLowerCase();
 const password=String(data.get("password")||"");
 const confirm=String(data.get("confirmPassword")||"");
 if(kind!=="forgot"&&password.length<12){notice(tr().short);return;}
 if(kind!=="forgot"&&password!==confirm){notice(tr().mismatch);return;}
 const captcha=kind==="reset"?null:captchaResponse();
 if(kind!=="reset"&&!captcha){notice(tr().captcha);return;}
 if(kind==="reset"&&!tokenOk(resetToken)){notice(tr().expired);return;}
 const old=button?.textContent;
 if(button){button.disabled=true;button.textContent=tr().processing;}
 try{
  if(kind==="register"){
   const name=String(data.get("name")||"").trim();
   if(name.length<2||name.length>80)throw Error("Introduce un nombre válido.");
   await post("/v1/auth/email/register",{name,email,password,turnstileToken:captcha,return_to:"espejo"});
   notice(tr().sent);
  }else if(kind==="forgot"){
   await post("/v1/auth/email/forgot",{email,turnstileToken:captcha,return_to:"espejo"});
   notice(tr().sent);
  }else{
   await post("/v1/auth/email/reset",{token:resetToken,password});
   resetToken=null;
   try{sessionStorage.removeItem("bq-mirror-reset-token");}catch{}
   notice(tr().resetOk+" ");
   const link=document.createElement("a");
   link.href="#/acceso";link.textContent=tr().back;link.className="login-link";
   $("#auth-feedback")?.append(link);
   form.querySelectorAll('input').forEach(el=>el.value="");
  }
 }catch(error){notice(error.message||tr().unavailable);}
 finally{
  if(kind!=="reset"&&widget!==null&&window.turnstile){
   try{window.turnstile.reset(widget);}catch{}
  }
  if(button){button.disabled=kind==="reset"&&!resetToken;button.textContent=old;}
 }
}
document.addEventListener("submit",event=>{
 if(event.target?.id!=="auth-form")return;
 const kind=formKind();
 if(!["register","forgot","reset"].includes(kind))return;
 event.preventDefault();event.stopImmediatePropagation();
 void submit(event.target,kind);
},true);
async function init(){
 const root=$("#app");if(!root)return;
 const obs=new MutationObserver(()=>{void ensure();});
 obs.observe(root,{childList:true});
 window.addEventListener("hashchange",()=>{void ensure();});
 void ensure();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
else init();
window.addEventListener("load",()=>{void ensure();});
})();