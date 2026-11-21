/**
 * Clerk Browser sign-in for the future Bellaquitas production site.
 * No real user/DB access while SITE_MODE=preproduction or approvals are off.
 * The BF session only exists after a verified Clerk JWT and confirmed D1 link.
 */
const HEAD={
 "Cache-Control":"no-store, private",
 "X-Robots-Tag":"noindex, nofollow",
 "X-Content-Type-Options":"nosniff",
 "Referrer-Policy":"no-referrer",
 "Cross-Origin-Resource-Policy":"same-origin",
 "X-Frame-Options":"DENY"
};
const HOST="clerk.bellaquitas.fr";
const ORIGIN="https://bellaquitas.fr";
const unavailable=(status=404)=>new Response("Acceso no disponible",{
 status,headers:{...HEAD,"Content-Type":"text/plain; charset=utf-8"}
});
export function productionClerkUiConfig(env){
 if(env?.SITE_MODE!=="production"||env.CLERK_UI_ENABLED!=="yes"||
    env.CLERK_JWT_ENABLED!=="yes"||env.CLERK_EXCHANGE_ENABLED!=="yes"||
    env.CLERK_ISSUER!=="https://"+HOST||
    env.CLERK_ALLOWED_ORIGIN!==ORIGIN)return null;
 const key=env.CLERK_PUBLISHABLE_KEY;
 if(typeof key!=="string"||!/^pk_live_[A-Za-z0-9_-]{15,300}$/.test(key))return null;
 let decoded;
 try{
  const enc=key.slice("pk_live_".length).replace(/-/g,"+").replace(/_/g,"/");
  decoded=atob(enc);
 }catch{return null;}
 if(decoded!==HOST+"$")return null;
 return Object.freeze({publishableKey:key,clerkHost:HOST});
}
export function clerkLoginPage(request,env){
 const url=new URL(request.url);
 if(url.pathname!=="/acceso/"&&url.pathname!=="/acceso")return null;
 if(request.method!=="GET"&&request.method!=="HEAD")return unavailable(405);
 const config=productionClerkUiConfig(env);
 if(!config||url.origin!==ORIGIN)return unavailable(404);
 if(url.pathname==="/acceso")return Response.redirect(ORIGIN+"/acceso/"+url.search,308);
 // Never accept a return URL; the only post-login paths are fixed.
 const admin=url.searchParams.get("return")==="administracion";
 const target=admin?"/administracion/":"/#/mi-espacio";
 const nonce=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(18))));
 const inline=String.raw`
(()=>{
 "use strict";
 const clerk=window.Clerk;
 const status=document.getElementById("status");
 const continueButton=document.getElementById("continue");
 const signIn=document.getElementById("sign-in");
 const account=document.getElementById("account");
 const reverify=document.getElementById("reverify");
 const admin=document.body.dataset.admin==="yes";
 const messagesFr={
  "Preparando inicio de sesión…":"Préparation de la connexion…",
  "Inicia sesión para continuar.":"Connectez-vous pour continuer.",
  "Tu cuenta Clerk todavía no está vinculada a tu ficha original de Bellaquitas. No hemos creado otra ficha.":
   "Votre compte Clerk n’est pas encore associé à votre profil Bellaquitas d’origine. Aucun autre profil n’a été créé.",
  "El acceso todavía no está habilitado. No se ha modificado ningún punto.":
   "La connexion n’est pas encore autorisée. Aucun point n’a été modifié.",
  "Para entrar al panel debes volver a identificarte y continuar en los siguientes dos minutos.":
   "Pour accéder au panneau, reconnectez-vous puis continuez dans les deux minutes.",
  "El acceso administrativo permanece protegido.":"L’accès administratif reste protégé.",
  "No se pudo comprobar la sesión. Vuelve a intentarlo.":
   "La session n’a pas pu être vérifiée. Réessayez.",
  "No se pudo cerrar la sesión. Utiliza el menú de Clerk.":
   "Impossible de fermer la session. Utilisez le menu Clerk.",
  "Identidad Clerk disponible. Pulsa Continuar para comprobar tu ficha.":
   "Identité Clerk reconnue. Cliquez sur Continuer pour vérifier votre profil.",
  "Inicio de sesión temporalmente no disponible.":"Connexion temporairement indisponible."
 };
 let lang="es",statusKey="Preparando inicio de sesión…";
 try{if(localStorage.getItem("bellaquitas-lang")==="fr")lang="fr";}catch{}
 const setStatus=v=>{statusKey=v;status.textContent=lang==="fr"?(messagesFr[v]||v):v;};
 function setLanguage(next){
  lang=next==="fr"?"fr":"es";
  document.documentElement.lang=lang;
  document.title=lang==="fr"?"Bellaquitas Fest · Connexion":"Bellaquitas Fest · Acceso";
  for(const node of document.querySelectorAll("[data-es][data-fr]"))
   node.textContent=node.dataset[lang];
  for(const value of ["es","fr"])
   document.getElementById("lang-"+value).setAttribute("aria-pressed",String(value===lang));
  try{localStorage.setItem("bellaquitas-lang",lang);}catch{}
  setStatus(statusKey);
 }
 for(const value of ["es","fr"])
  document.getElementById("lang-"+value).addEventListener("click",()=>setLanguage(value));
 setLanguage(lang);
 let busy=false;
 async function proceed(){
  if(busy)return;
  busy=true;continueButton.disabled=true;
  try{
   const current=window.Clerk;
   const token=await current?.session?.getToken();
   if(!token){setStatus("Inicia sesión para continuar.");return;}
   const options={method:"POST",credentials:"same-origin",cache:"no-store",
    headers:{Authorization:"Bearer "+token,Accept:"application/json"}};
   const result=await fetch("/v1/auth/clerk/exchange",options);
   if(!result.ok){
    setStatus(result.status===403?
     "Tu cuenta Clerk todavía no está vinculada a tu ficha original de Bellaquitas. No hemos creado otra ficha.":
     "El acceso todavía no está habilitado. No se ha modificado ningún punto.");
    return;
   }
   if(admin){
    const second=await fetch("/v1/auth/clerk/admin/step-up",options);
    if(!second.ok){
     setStatus(second.status===403?
      "Para entrar al panel debes volver a identificarte y continuar en los siguientes dos minutos.":
      "El acceso administrativo permanece protegido.");
     if(second.status===403)reverify.hidden=false;
     return;
    }
    // The server verified signed Clerk identity + the same BF admin session.
    // Merely visiting the login page never sets this independent tab proof.
    sessionStorage.setItem("bf_admin_tab_login","1");
   }
   location.assign(admin?"/administracion/":"/#/mi-espacio");
  }catch{
   setStatus("No se pudo comprobar la sesión. Vuelve a intentarlo.");
  }finally{busy=false;continueButton.disabled=false;}
 }
 continueButton.addEventListener("click",proceed);
 // La reverificación funciona también en Clerk Free: cerrar sesión en
 // Clerk y volver a entrar con Google o código/contraseña. Sin MFA de pago.
 reverify.addEventListener("click",async()=>{
  reverify.disabled=true;
  try{
   await fetch("/v1/auth/logout",{method:"POST",credentials:"same-origin",cache:"no-store"});
   await window.Clerk?.signOut();
   location.assign("/acceso/?return=administracion");
  }catch{
   setStatus("No se pudo cerrar la sesión. Utiliza el menú de Clerk.");
   reverify.disabled=false;
  }
 });
 window.addEventListener("load",async()=>{
  try{
   if(!window.Clerk||!window.__internal_ClerkUICtor)
    throw Error("SDK not available");
   await window.Clerk.load({ui:{ClerkUI:window.__internal_ClerkUICtor}});
   const update=()=>{
    const signed=!!window.Clerk.session;
    continueButton.disabled=!signed;
    account.hidden=!signed;
    if(signed){
     setStatus("Identidad Clerk disponible. Pulsa Continuar para comprobar tu ficha.");
    }
   };
   window.Clerk.addListener(update);
   if(window.Clerk.session)window.Clerk.mountUserButton(account);
   else window.Clerk.mountSignIn(signIn);
   update();
  }catch{
   continueButton.disabled=true;
   setStatus("Inicio de sesión temporalmente no disponible.");
  }
 });
})();`;
 const html=[
  '<!doctype html><html lang="es"><head><meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width,initial-scale=1">',
  '<meta name="robots" content="noindex,nofollow">',
  '<title>Bellaquitas Fest · Acceso</title>',
  '<style>:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:#100b13;color:#fff6e9;font:16px/1.5 system-ui,sans-serif}main{max-width:650px;margin:8vh auto;padding:24px}h1{color:#efd099}section{background:#211827;border:1px solid #765a77;border-radius:18px;padding:24px}button{cursor:pointer;background:#e9c477;color:#180d17;border:0;border-radius:10px;padding:12px 20px;font:700 16px system-ui}button:disabled{opacity:.5;cursor:not-allowed}a{color:#e9c477}p{line-height:1.5}#status{min-height:3em}#account{margin:10px 0}</style>',
  '</head><body data-admin="'+(admin?'yes':'no')+'"><main>',
  '<nav aria-label="Idioma / Langue" style="display:flex;justify-content:flex-end;gap:8px"><button id="lang-es" type="button" aria-pressed="true">ES</button><button id="lang-fr" type="button" aria-pressed="false">FR</button></nav>',
  '<p><a href="/" data-es="Volver a Bellaquitas Fest" data-fr="Retour à Bellaquitas Fest">Volver a Bellaquitas Fest</a></p>',
  '<section><h1 data-es="'+(admin?'Acceso de administración':'Acceder a Bellaquitas Fest')+'" data-fr="'+(admin?'Accès à l’administration':'Connexion à Bellaquitas Fest')+'">'+(admin?'Acceso de administración':'Acceder a Bellaquitas Fest')+'</h1>',
  '<p data-es="Inicia sesión con tu cuenta. Tus puntos y permisos se conservan en tu ficha original; no creamos otra automáticamente." data-fr="Connectez-vous à votre compte. Vos points et vos autorisations restent liés à votre profil initial ; aucun doublon ne sera créé.">Inicia sesión con tu cuenta. Tus puntos y permisos se conservan en tu ficha original; no creamos otra automáticamente.</p>',
  '<div id="sign-in"></div><div id="account" hidden></div>',
  '<p id="status" role="status" aria-live="polite">Preparando inicio de sesión…</p>',
  '<button type="button" id="continue" disabled data-es="Continuar" data-fr="Continuer">Continuar</button>',
  '<button type="button" id="reverify" hidden style="margin-left:8px" data-es="Volver a identificarme" data-fr="Me reconnecter">Volver a identificarme</button>',
  '<p><small data-es="'+(admin?'La administración requiere verificación reciente y una sesión previamente vinculada.':'Solo las identidades vinculadas pueden recuperar su ficha original.')+'" data-fr="'+(admin?'L’administration exige une vérification récente et une session préalablement associée.':'Seules les identités associées peuvent retrouver leur profil initial.')+'">'+(admin?'La administración requiere verificación reciente y una sesión previamente vinculada.':'Solo las identidades vinculadas pueden recuperar su ficha original.')+'</small></p>',
  '</section></main>',
  '<script defer crossorigin="anonymous" src="https://'+HOST+'/npm/@clerk/ui@1/dist/ui.browser.js"></script>',
  '<script defer crossorigin="anonymous" data-clerk-publishable-key="'+config.publishableKey+'" src="https://'+HOST+'/npm/@clerk/clerk-js@6/dist/clerk.browser.js"></script>',
  '<script nonce="'+nonce+'">'+inline+'</script></body></html>'
 ].join("");
 const headers=new Headers({...HEAD,"Content-Type":"text/html; charset=utf-8"});
 headers.set("Content-Security-Policy",
  "default-src 'none'; base-uri 'none'; form-action 'self' https://"+HOST+
  " https://accounts.bellaquitas.fr; script-src 'nonce-"+nonce+"' https://"+HOST+
  "; connect-src 'self' https://"+HOST+" https://accounts.bellaquitas.fr"+
  "; frame-src https://"+HOST+" https://accounts.bellaquitas.fr https://accounts.google.com"+
  "; img-src 'self' data: https://"+HOST+
  "; style-src 'unsafe-inline' https://"+HOST+"; frame-ancestors 'none'");
 return new Response(request.method==="HEAD"?null:html,{status:200,headers});
}
