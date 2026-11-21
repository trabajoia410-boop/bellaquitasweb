/**
 * Isolated loyalty signup and customer card, same visual language as Bellaquitas.
 * Does not replace the current live card until the final explicit cutover.
 */
import {WALLET_I18N} from "./i18n.js";
import {WALLET_QR_LIB} from "./qr-bundle.js";
import {walletIssuerReadiness} from "./issuer-readiness.js";
import {escapeHtml,validSlug} from "./core.js";
const HEAD={"Cache-Control":"no-store, private","X-Robots-Tag":"noindex,nofollow",
 "X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer",
 "X-Frame-Options":"DENY","Cross-Origin-Resource-Policy":"same-origin"};
const MOCK_PROGRAM={slug:"bellaquitas-fest",name:"Bellaquitas Fest",
 logo_url:"/assets/logo-bellaquitas.webp",banner_url:"",
 color:"#21121b",accent_color:"#e9c477",stamp_goal:7,
 reward_label:"Consumición gratis"};
const MOCK_CARD={name:"Cliente de prueba",stamps:4,goal:7,available:0,
 reward:MOCK_PROGRAM.reward_label,business:MOCK_PROGRAM.name,
 color:MOCK_PROGRAM.color,accent:MOCK_PROGRAM.accent_color,logo:MOCK_PROGRAM.logo_url,
 scanCode:"bfw1.11111111-1111-4111-8111-111111111111.22222222-2222-4222-8222-222222222222."+"A".repeat(43)};
export async function walletCustomerPage(request,env){
 const url=new URL(request.url),path=url.pathname;
 const demo=path==="/wallet/demo"||path==="/wallet/demo/";
 const found=path.match(/^\/tarjeta\/([a-z0-9][a-z0-9-]{2,69})\/?$/);
 if(path==="/wallet/qr.js"){
  if(request.method!=="GET")return new Response(null,{status:405,headers:HEAD});
  return new Response(WALLET_QR_LIB,{headers:{...HEAD,
   "Content-Type":"application/javascript; charset=utf-8"}});
 }
 if(!demo&&!found)return null;
 if(request.method!=="GET"&&request.method!=="HEAD")
  return new Response("Método no permitido",{status:405,headers:HEAD});
 if(demo){
  if(env?.SITE_MODE!=="staging"||env?.WALLET_MOCK_PREVIEW!=="yes"||
     env?.STAGING_MUTATIONS!=="disabled")return new Response("No disponible",{status:404,headers:HEAD});
 }else if(env?.SITE_MODE!=="production"||env?.WALLET_ENABLED!=="yes"||env?.PUBLISH_APPROVED!=="yes")
  return new Response("No disponible",{status:404,headers:HEAD});
 const slug=demo?"bellaquitas-fest":found[1];
 if(!validSlug(slug))return new Response("No disponible",{status:404,headers:HEAD});
 if(!demo){
  if(typeof env.DB?.prepare!=="function")return new Response("No disponible",{status:503,headers:HEAD});
  const program=await env.DB.prepare("SELECT id FROM wallet_programs WHERE slug=? AND active=1 LIMIT 1")
   .bind(slug).first();
  if(!program)return new Response("No disponible",{status:404,headers:HEAD});
 }
 const nonce=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(18))));
 const data=JSON.stringify({demo,slug,providers:demo?{apple:false,google:false}:walletIssuerReadiness(env),strings:WALLET_I18N,mock:MOCK_CARD,
  program:MOCK_PROGRAM}).replace(/</g,"\\u003c");
 const script=String.raw`
(()=>{
 "use strict";
 const config=JSON.parse(document.getElementById("wallet-config").textContent);
 const el=id=>document.getElementById(id);
 const lang=()=>localStorage.getItem("bellaquitas-lang")==="fr"?"fr":"es";
 let language=lang(),challengeId=null,card=null;
 const dict=()=>config.strings[language],t=k=>dict()[k]||k;
 const providerAvailability=config.providers||{apple:false,google:false};
 function refreshProviderState(){
  for(const type of ["apple","google"])el(type).hidden=!providerAvailability[type];
  el("wallet-actions").hidden=!(providerAvailability.apple||providerAvailability.google);
  el("wallet-provider-note").textContent=t(providerAvailability.apple||providerAvailability.google?"nativeAvailable":"nativeUnavailable");
 }
 const status=(m)=>{el("status").textContent=m;};
 function switchLang(next){
  language=next;document.documentElement.lang=next;
  localStorage.setItem("bellaquitas-lang",next);
  for(const node of document.querySelectorAll("[data-i18n]"))
   node.textContent=t(node.dataset.i18n);
  for(const node of document.querySelectorAll("[data-i18n-placeholder]"))
   node.setAttribute("placeholder",t(node.dataset.i18nPlaceholder));
  refreshProviderState();status("");
 }
 el("es").addEventListener("click",()=>switchLang("es"));
 el("fr").addEventListener("click",()=>switchLang("fr"));
 const call=async(path,data)=>{
  const res=await fetch(path,{method:data?"POST":"GET",credentials:"same-origin",cache:"no-store",
   headers:{"Accept":"application/json",...(data?{"Content-Type":"application/json"}:{})},
   body:data?JSON.stringify(data):undefined});
  const body=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(body.error||t("error"));
  return body;
 };
 function renderCard(c){
  card=c;
  el("registration").hidden=true;el("verification").hidden=true;el("card").hidden=false;
  for(const field of ["logo","banner"]){
   const image=el("card-"+field),value=c[field]||"";
   const valid=typeof value==="string"&&value.startsWith("/assets/")&&
    !value.includes("..")&&!value.includes("?")&&!value.includes("#")&&
    [".png",".jpg",".jpeg",".webp"].some(ext=>value.endsWith(ext));
   image.hidden=!valid;
   if(valid)image.src=value;else image.removeAttribute("src");
  }
  el("card-brand").textContent=c.business||config.program.name;
  el("card-owner").textContent=c.name;
  el("stamps").textContent=c.stamps+" / "+c.goal;
  el("reward").textContent=c.reward;
  el("stamp-dots").replaceChildren();
  for(let n=0;n<c.goal;n++){const dot=document.createElement("span");
   dot.className="dot"+(n<c.stamps?" filled":"");dot.textContent=n<c.stamps?"✓":"✦";
   el("stamp-dots").append(dot);}
  el("available").hidden=!(c.available>0);
  el("card-visual").style.setProperty("--w-bg",c.color||"#21121b");
  el("card-visual").style.setProperty("--w-gold",c.accent||"#e9c477");
  const code=c.scanCode;
  if(code&&window.BellaWalletQR)window.BellaWalletQR.render(el("wallet-qr"),code,{label:"QR tarjeta cliente"});
  refreshProviderState();
 }
 async function load(){
  if(config.demo){renderCard(config.mock);status(t("preview"));return;}
  try{
   const me=await call("/v1/wallet/me?slug="+encodeURIComponent(config.slug));
   if(me.card)renderCard(me.card);
  }catch{el("registration").hidden=false;}
 }
 el("register").addEventListener("submit",async e=>{
  e.preventDefault();status(t("loading"));
  const form=e.currentTarget;
  if(!form.elements.consent.checked){status(t("consent"));return;}
  try{
   const result=await call("/v1/wallet/enroll/start",{
    slug:config.slug,name:form.elements.name.value,email:form.elements.email.value,
    phone:form.elements.phone.value,consent:form.elements.consent.checked,
    marketing:form.elements.marketing.checked});
   challengeId=result.challengeId;
   el("registration").hidden=true;el("verification").hidden=false;
   status(t("verifySent"));
  }catch(err){status(err.message);}
 });
 el("verify").addEventListener("submit",async e=>{
  e.preventDefault();if(!challengeId)return;
  status(t("loading"));
  try{
   await call("/v1/wallet/enroll/verify",{challengeId,
    code:el("code").value});
   await load();
   status("");
  }catch(err){status(err.message);}
 });
 const ua=navigator.userAgent||"";
 if(/iPhone|iPad|iPod/i.test(ua))el("apple").classList.add("primary");
 else if(/Android/i.test(ua))el("google").classList.add("primary");
 else el("google").classList.add("primary");
 for(const type of ["apple","google"])
  el(type).addEventListener("click",async()=>{
   if(config.demo){status(t("preview"));return;}
   if(!providerAvailability[type]){status(t("nativeUnavailable"));return;}
   status(t("loading"));
   try{
    const result=await call("/v1/wallet/pass/"+type,{slug:config.slug});
    if(result.mock){status(t("preview"));return;}
    if(type==="google"&&typeof result.url==="string"&&result.url.startsWith("https://pay.google.com/gp/v/save/"))
     window.location.assign(result.url);
    else if(type==="apple"&&result.url&&result.url.startsWith("/v1/wallet/"))
     window.location.assign(result.url);
    else status(t("error"));
   }catch(err){status(err.message);}
  });
 el("delete").addEventListener("click",async()=>{
  if(config.demo){status(t("preview"));return;}
  if(!window.confirm(t("deleteConfirm")))return;
  try{await call("/v1/wallet/me/delete",{confirm:true});
   el("card").hidden=true;el("registration").hidden=false;
   el("wallet-actions").hidden=true;status(t("deleteConfirm"));
  }catch(err){status(err.message);}
 });
 switchLang(language);load();
})();`;
 const html=[
 '<!doctype html><html lang="es"><head><meta charset="utf-8">',
 '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">',
 '<meta name="robots" content="noindex,nofollow"><title>Bellaquitas Fest · Wallet</title>',
 '<link rel="stylesheet" href="/styles.css">',
 '<style>:root{color-scheme:dark}*{box-sizing:border-box}body{background:#0e0a0e;color:#fbeee9;font:16px/1.5 Outfit,system-ui,sans-serif;min-height:100vh;margin:0}.wallet-shell{width:min(570px,calc(100% - 28px));margin:28px auto 60px}.wallet-top{display:flex;justify-content:space-between;align-items:center}.wallet-top a{color:#e9c477}.wallet-panel{border:1px solid #644451;border-radius:21px;background:#22151e;padding:clamp(18px,4vw,28px);margin-top:18px;box-shadow:0 18px 50px #0006}.wallet-panel h1{margin:0 0 8px;font-size:clamp(1.6rem,5vw,2.2rem)}.wallet-panel p{color:#cdb8bd}.field{display:grid;gap:6px;margin:14px 0}.field input{padding:12px;border-radius:10px;background:#160e15;border:1px solid #75505a;color:#fff;width:100%;font:inherit}.check{display:flex;align-items:flex-start;gap:9px;margin:15px 0;font-size:.85rem}.check input{margin-top:5px}.wallet-btn{font:700 15px system-ui;cursor:pointer;border:1px solid #a27a51;color:#f2d099;border-radius:11px;background:#24151f;padding:12px 16px}.wallet-btn.primary,.wallet-btn:focus-visible{background:#e9c477;color:#20121a}.wallet-btn:disabled{opacity:.45}#wallet-actions{display:grid;gap:9px;margin-top:16px}.wallet-card{--w-bg:#21121b;--w-gold:#e9c477;background:linear-gradient(125deg,var(--w-bg),#452434);border:1px solid var(--w-gold);border-radius:18px;padding:25px;box-shadow:0 20px 36px #0008}.wallet-card h2{margin:0;color:var(--w-gold);font-size:1.6rem}.wallet-card .owner{font-size:1.15rem}.wallet-card .count{font-size:2.7rem;font-weight:900;color:var(--w-gold);margin:10px 0}.wallet-card .dots{display:flex;flex-wrap:wrap;gap:9px}.wallet-card .dot{width:34px;height:34px;display:grid;place-items:center;border:1px solid #c6a163;border-radius:100%;color:#d2a973}.wallet-card .dot.filled{background:#e9c477;color:#170b15}#wallet-qr{background:#fff;border-radius:12px;padding:12px;width:min(220px,100%);aspect-ratio:1;margin:20px auto}#status{min-height:30px;color:#e9c477}button[hidden],section[hidden],div[hidden]{display:none!important}@media(max-width:430px){.wallet-card{padding:17px}}</style>',
 '</head><body><main class="wallet-shell"><div class="wallet-top">',
 '<a href="/">Bellaquitas Fest</a><div><button class="wallet-btn" id="es" type="button">ES</button> <button class="wallet-btn" id="fr" type="button">FR</button></div></div>',
 '<section class="wallet-panel"><h1 data-i18n="title">Tu tarjeta digital</h1>',
 '<p data-i18n="retrieve">¿Ya tienes tarjeta? Entra con el mismo correo para recuperarla.</p>',
 '<section id="registration"><form id="register"><div class="field"><label for="name" data-i18n="name">Nombre</label><input name="name" id="name" required minlength="2" maxlength="80" autocomplete="name"></div>',
 '<div class="field"><label for="email" data-i18n="email">Correo</label><input name="email" id="email" type="email" required autocomplete="email"></div>',
 '<div class="field"><label for="phone" data-i18n="phone">Teléfono (opcional)</label><input name="phone" id="phone" type="tel" autocomplete="tel" placeholder="+33…"></div>',
 '<label class="check"><input name="consent" type="checkbox" required><span data-i18n="consent">Acepto el tratamiento de mis datos</span></label>',
 '<label class="check"><input name="marketing" type="checkbox"><span data-i18n="marketing">Deseo recibir avisos</span></label>',
 '<button class="wallet-btn primary" data-i18n="join" type="submit">Crear mi tarjeta</button></form>',
 '<p data-i18n="noSms">Para recuperar la tarjeta sin contraseña debes verificar tu correo.</p></section>',
 '<section id="verification" hidden><form id="verify"><div class="field"><label for="code" data-i18n="code">Código de 6 dígitos</label>',
 '<input id="code" name="code" maxlength="6" minlength="6" inputmode="numeric" pattern="[0-9]{6}" autocomplete="one-time-code" required></div>',
 '<button class="wallet-btn primary" type="submit" data-i18n="verify">Verificar</button></form></section>',
 '<section id="card" hidden><div class="wallet-card" id="card-visual"><img id="card-banner" alt="Banner Bellaquitas" style="width:100%;height:90px;object-fit:cover;border-radius:10px" hidden><img id="card-logo" alt="Logo Bellaquitas" style="width:80px;height:80px;object-fit:contain" hidden><h2 id="card-brand">Bellaquitas Fest</h2>',
 '<p class="owner" id="card-owner"></p><div class="count" id="stamps"></div><div class="dots" id="stamp-dots"></div>',
 '<p><span data-i18n="reward">Recompensa</span>: <b id="reward"></b></p>',
 '<p id="available" hidden data-i18n="ready">¡Recompensa disponible!</p></div>',
 '<div id="wallet-qr" aria-label="QR personal"></div><p id="wallet-provider-note" role="status"></p>',
 '<div id="wallet-actions" hidden><button id="apple" class="wallet-btn" type="button" data-i18n="apple">Añadir a Apple Wallet</button>',
 '<button id="google" class="wallet-btn" type="button" data-i18n="google">Añadir a Google Wallet</button></div>',
 '<button class="wallet-btn" id="delete" type="button" data-i18n="delete">Solicitar eliminación de mis datos</button></section>',
 '<p id="status" aria-live="polite" role="status"></p>',
 '<p style="font-size:.78rem" data-i18n="notes">El programa nuevo utiliza sellos; los puntos antiguos quedan archivados.</p></section></main>'
 '<script type="application/json" id="wallet-config">'+data+'</script>',
 '<script src="/wallet/qr.js"></script>',
 '<script nonce="'+nonce+'">'+script+'</script></body></html>'
 ].join("");
 const h=new Headers({...HEAD,"Content-Type":"text/html; charset=utf-8"});
 h.set("Content-Security-Policy","default-src 'none'; base-uri 'none'; form-action 'self';"+
  " script-src 'self' 'nonce-"+nonce+"'; connect-src 'self';"+
  " style-src 'unsafe-inline' 'self'; img-src 'self' data:; frame-ancestors 'none'");
 return new Response(request.method==="HEAD"?null:html,{status:200,headers:h});
}
