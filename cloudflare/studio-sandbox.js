/**
 * Bellaquitas Fest — laboratorio visual SIN AUTENTICACIÓN y SIN escrituras.
 * Distinto del editor real /administracion/ (que exige admin step-up).
 * No contiene datos de usuarios ni crea sesiones ni accede al catálogo privado.
 * Sólo en hostname exacto de staging con mutaciones/altas bloqueadas.
 */
const HOST="bellaquitas-api-staging.bellaquitas-fest-410.workers.dev";
const HTML=String.raw`<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow"><title>Laboratorio visual · Bellaquitas Fest</title>
<style>
:root{color-scheme:dark;--bg:#100d12;--panel:#201a22;--border:#44354d;--gold:#f1c981;--text:#fff7ef;--muted:#c0b2c3}
*{box-sizing:border-box}body{background:var(--bg);color:var(--text);margin:0;font:14px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
button,a,input,textarea{font:inherit}button{cursor:pointer}
button:focus-visible,a:focus-visible,textarea:focus-visible{outline:2px solid var(--gold);outline-offset:3px}
a{color:var(--gold)}.head{height:auto;min-height:62px;display:flex;align-items:center;gap:13px;justify-content:space-between;padding:13px 22px;border-bottom:1px solid var(--border)}
.head strong{font-size:17px;letter-spacing:.02em}.head small{display:block;color:var(--muted);font-size:11px}
.actions{display:flex;gap:9px;align-items:center;flex-wrap:wrap}
.btn{border:1px solid #8b6880;color:var(--text);background:#302332;padding:9px 12px;border-radius:9px;text-align:left}
.btn.primary{background:var(--gold);color:#1b121a;border-color:var(--gold);font-weight:800}
.btn[aria-pressed="true"]{border-color:var(--gold);box-shadow:inset 0 0 0 1px var(--gold)}
.layout{display:grid;grid-template-columns:minmax(260px,310px) minmax(0,1fr);min-height:calc(100vh - 65px)}
.panel{padding:20px;border-right:1px solid var(--border);background:var(--panel);overflow:auto}
.panel h2{font-size:16px;margin:22px 0 9px}.panel p{color:var(--muted);font-size:12px;margin:4px 0 12px}
.menu{display:grid;gap:8px}.menu .btn{width:100%}.row{display:flex;flex-wrap:wrap;gap:7px}
.preview{min-width:0;padding:18px;background:#0d0a0e}.preview-head{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:12px}
.preview-head strong{font-size:15px}.preview-head small{color:var(--muted);display:block}
.stage{margin:auto;width:100%;height:min(83vh,980px);border:1px solid #8b6e65;border-radius:12px;overflow:hidden;box-shadow:0 16px 50px #0008;background:#080608;transition:width .15s}
.stage.mobile{width:min(100%,390px);height:740px;max-height:79vh}
iframe{display:block;width:100%;height:100%;border:none;background:#080608}
.hint{font-size:12px;color:var(--muted)}.notice{padding:10px 12px;border:1px solid #b88a51;border-radius:10px;background:#3b281a;color:#f7d4a2}
#chosen{display:block;color:var(--gold);font-size:12px;min-height:28px;margin-top:7px}
label{display:block;font-size:12px;color:var(--muted);margin:9px 0 5px}
textarea{display:block;width:100%;min-height:110px;resize:vertical;border-radius:10px;background:#100d12;border:1px solid #69576d;color:white;padding:12px}
#drawer,#drawerBg{display:none}
@media(max-width:800px){
 .head{padding:12px}.head strong{font-size:15px}
 .layout{display:block}.panel{display:none}
 #drawer{display:inline-flex}
 body.menu-open .panel{display:block;position:fixed;inset:0 auto 0 0;width:min(87vw,345px);z-index:11;box-shadow:9px 0 40px #000b}
 body.menu-open #drawerBg{display:block;position:fixed;inset:0;z-index:10;background:#0009;border:0;width:100%}
 .preview{padding:9px}.stage{height:75vh}.preview-head{gap:7px}
}

.studio-group{border-top:1px solid #64546866;padding-top:8px;margin-top:20px}.studio-presets{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.studio-preset{border:1px solid #6d516f;background:#171219;color:#fef5ed;border-radius:11px;text-align:left;min-height:83px;padding:9px;cursor:pointer}
.studio-preset[aria-pressed=true]{border:2px solid #f1c981;padding:8px;background:#2d2431}
.studio-preset strong,.studio-preset small{display:block}.studio-preset strong{font-size:12px;margin-top:7px}.studio-preset small{color:#c0b2c3;font-size:10px}
.studio-swatch{display:block;height:25px;border-radius:5px}
.studio-field{width:100%;background:#120e14;color:#fff7ef;border:1px solid #806a82;border-radius:9px;padding:10px;font:inherit}
.studio-two{display:grid;grid-template-columns:1fr 1fr;gap:10px}.studio-two input[type=color]{width:100%;height:38px;background:#120e14;border-radius:7px;border:1px solid #806a82}
.studio-check{display:flex!important;gap:7px;align-items:center;color:#fff7ef!important;font-size:12px!important}
.studio-check input{accent-color:#e9c477}.studio-section{display:flex;gap:5px;align-items:center;border-bottom:1px solid #ffffff15;padding:6px 0}
.studio-section .studio-check{flex:1;margin:0}.studio-section button{padding:4px 8px}
.studio-icons{display:flex;flex-wrap:wrap;gap:6px}.studio-icons button{padding:5px 10px;min-width:34px;text-align:center}
#studioSelection,#studioStatus{color:#f1c981;font-size:12px;min-height:21px}
#studioFile{max-width:100%;font-size:12px}
</style></head><body>
<header class="head"><div><strong>BELLAQUITAS FEST <span style="color:var(--gold)">/ Laboratorio</span></strong>
<small>Versión de pruebas, no es el panel de administración real</small></div>
<div class="actions"><button id="drawer" class="btn" type="button" aria-label="Abrir menú lateral">☰</button>
<a class="btn" href="/espejo/" target="_blank" rel="noopener noreferrer">Ver portada completa</a></div></header>
<button id="drawerBg" type="button" aria-label="Cerrar menú" aria-hidden="true"></button>
<div class="layout"><aside class="panel" id="controls" aria-label="Opciones de edición visual">
<div class="notice"><strong>DEMO · SIN PUBLICAR</strong><p>Los cambios sólo se guardan en tu navegador cuando pulsas «Guardar borrador local». Nunca modifican eventos, cuentas o puntos en Cloudflare.</p></div>
<h2>Páginas</h2><div class="menu" id="pages">
<button class="btn" type="button" data-page="/">Inicio</button>
<button class="btn" type="button" data-page="/experiencia">Experiencia</button>
<button class="btn" type="button" data-page="/eventos">Eventos</button>
<button class="btn" type="button" data-page="/ventajas">Ventajas</button>
<button class="btn" type="button" data-page="/preguntas">Preguntas</button>
</div>
<h2>Modelos de diseño</h2><div class="menu" id="themes">
<button class="btn" type="button" data-theme="classic">Original Bellaquitas</button>
<button class="btn" type="button" data-theme="minimal">Minimalista</button>
<button class="btn" type="button" data-theme="festival">Festival</button>
</div>
<h2>Edición de textos</h2><p>Pulsa un texto de la página para modificarlo en esta vista previa.</p>
<div id="chosen" aria-live="polite">Selecciona un texto de la página</div>
<label for="editing">Texto seleccionado</label><textarea id="editing" maxlength="600" disabled placeholder="Selecciona primero un texto de la página"></textarea>

<section class="studio-advanced" aria-label="Personalización visual">
<div class="studio-group"><h2>Plantillas completas</h2><p>Escoge un modelo y personaliza cada elemento. Siempre puedes recuperar el original.</p><div class="studio-presets" id="studioPresets">
<button class="studio-preset" data-preset="original" type="button" aria-pressed="true"><span class="studio-swatch" style="background:linear-gradient(110deg,#080809 45%,#e9c477 45% 65%,#211825 65%)"></span><strong>Original Bellaquitas</strong><small>Diseño actual</small></button>
<button class="studio-preset" data-preset="noir" type="button" aria-pressed="false"><span class="studio-swatch" style="background:linear-gradient(110deg,#090a0d 45%,#cdaa66 45% 65%,#171717 65%)"></span><strong>Noir & Dorado</strong><small>Elegante, nocturno</small></button>
<button class="studio-preset" data-preset="urban" type="button" aria-pressed="false"><span class="studio-swatch" style="background:linear-gradient(110deg,#171020 45%,#ae81e5 45% 65%,#32213b 65%)"></span><strong>Urbano Club</strong><small>Streetwear y fiesta</small></button>
<button class="studio-preset" data-preset="glass" type="button" aria-pressed="false"><span class="studio-swatch" style="background:linear-gradient(110deg,#132231 45%,#55c8d4 45% 65%,#1c3037 65%)"></span><strong>Cristal</strong><small>Transparencias</small></button>
<button class="studio-preset" data-preset="violet" type="button" aria-pressed="false"><span class="studio-swatch" style="background:linear-gradient(110deg,#1d0f27 45%,#d8a1ff 45% 65%,#41234d 65%)"></span><strong>Festival Violeta</strong><small>Contraste y color</small></button>
<button class="studio-preset" data-preset="editorial" type="button" aria-pressed="false"><span class="studio-swatch" style="background:linear-gradient(110deg,#231c1c 45%,#dfc39d 45% 65%,#45372d 65%)"></span><strong>Editorial</strong><small>Minimalista profesional</small></button>
</div></div>
<div class="studio-group"><h2>Barra de arriba y menú</h2>
<label for="studioHeader">Plantilla de cabecera</label><select id="studioHeader" class="studio-field"><option value="original">Original</option><option value="glass">Flotante de cristal</option><option value="compact">Compacta</option><option value="centered">Centrada</option><option value="outlined">Con contorno</option></select>
<label for="studioMenu">Modelo de navegación</label><select id="studioMenu" class="studio-field"><option value="original">Original</option><option value="pills">Botones redondeados</option><option value="underline">Línea activa</option><option value="minimal">Minimalista</option></select>
<label class="studio-check"><input id="studioLogoShow" type="checkbox" checked/> Mostrar logo</label><label class="studio-check"><input id="studioTickerShow" type="checkbox" checked/> Mostrar banda animada</label>
<label for="studioBanner">Texto de la banda animada</label><input id="studioBanner" class="studio-field" maxlength="100" placeholder="BELLAQUITAS FEST · VIVE EL MOMENTO"/>
</div>
<div class="studio-group"><h2>Inicio, ventanas y tarjetas</h2>
<label for="studioHero">Plantilla de portada</label><select id="studioHero" class="studio-field"><option value="original">Original</option><option value="cinema">Cinematográfica</option><option value="full">Pantalla completa</option><option value="framed">Ventana enmarcada</option><option value="soft">Oscura elegante</option></select>
<label for="studioCards">Tarjetas y ventanas</label><select id="studioCards" class="studio-field"><option value="original">Original</option><option value="glass">Semitransparentes</option><option value="outlined">Con borde</option><option value="square">Rectangulares</option><option value="soft">Esquinas suaves</option></select>
<label for="studioButtons">Botones</label><select id="studioButtons" class="studio-field"><option value="original">Original</option><option value="pill">Redondeados</option><option value="outline">Contorno</option><option value="square">Rectangulares</option></select>
<label for="studioFont">Tipo de letra</label><select id="studioFont" class="studio-field"><option value="original">Original</option><option value="urban">Urbana fuerte</option><option value="modern">Moderna limpia</option><option value="editorial">Editorial</option></select>
<div class="studio-two"><div><label for="studioAccent">Color principal</label><input id="studioAccent" type="color" value="#e9c477"/></div><div><label for="studioSurface">Color ventanas</label><input id="studioSurface" type="color" value="#211825"/></div></div>
</div>
<div class="studio-group"><h2>Logos, fotos e iconos</h2><p>Pulsa en un logo, imagen o icono de la vista previa y cámbialo aquí. Los archivos no se suben al servidor.</p>
<div id="studioSelection" aria-live="polite">Ningún elemento seleccionado</div>
<button class="btn" id="studioPickLogo" type="button">Seleccionar logo superior</button>
<label for="studioFile">Elegir imagen JPG, PNG o WebP</label><input id="studioFile" type="file" accept="image/png,image/jpeg,image/webp"/>
<label for="studioImageUrl">O imagen mediante URL HTTPS</label><input class="studio-field" id="studioImageUrl" type="url" maxlength="600" placeholder="https://..."/>
<div class="menu"><button class="btn" id="studioApplyImage" type="button">Aplicar imagen</button><button class="btn" id="studioRestoreImage" type="button">Restaurar imagen original</button></div>
<label for="studioIcon">Icono seleccionado</label><input id="studioIcon" class="studio-field" maxlength="8" disabled placeholder="Pulsa un icono en la página"/>
<div id="studioIcons" class="studio-icons"><button class="btn" type="button" data-icon="✦">✦</button><button class="btn" type="button" data-icon="♛">♛</button><button class="btn" type="button" data-icon="★">★</button><button class="btn" type="button" data-icon="♥">♥</button><button class="btn" type="button" data-icon="◈">◈</button><button class="btn" type="button" data-icon="♫">♫</button><button class="btn" type="button" data-icon="◎">◎</button><button class="btn" type="button" data-icon="▦">▦</button></div></div>
<div class="studio-group"><h2>Secciones de la portada</h2><p>Ocultar y cambiar el orden de las ventanas sin borrarlas.</p><div id="studioSections">
<div class="studio-section" data-section="experiencia"><label class="studio-check"><input type="checkbox" checked/> Experiencia</label><button class="btn" type="button" data-move="up">↑</button><button class="btn" type="button" data-move="down">↓</button></div>
<div class="studio-section" data-section="eventos"><label class="studio-check"><input type="checkbox" checked/> Eventos</label><button class="btn" type="button" data-move="up">↑</button><button class="btn" type="button" data-move="down">↓</button></div>
<div class="studio-section" data-section="ventajas"><label class="studio-check"><input type="checkbox" checked/> Ventajas</label><button class="btn" type="button" data-move="up">↑</button><button class="btn" type="button" data-move="down">↓</button></div>
<div class="studio-section" data-section="preguntas"><label class="studio-check"><input type="checkbox" checked/> Preguntas</label><button class="btn" type="button" data-move="up">↑</button><button class="btn" type="button" data-move="down">↓</button></div>
<div class="studio-section" data-section="unete"><label class="studio-check"><input type="checkbox" checked/> Invitación final</label><button class="btn" type="button" data-move="up">↑</button><button class="btn" type="button" data-move="down">↓</button></div>
</div><button class="btn" type="button" id="studioResetDesign">Restablecer diseño original</button>
<p id="studioStatus" aria-live="polite"></p></div></section>
<h2>Borrador</h2><div class="menu">
<button class="btn primary" id="save" type="button">Guardar borrador local</button>
<button class="btn" id="reset" type="button">Restablecer vista sin guardar</button>
</div><p id="notice" role="status" aria-live="polite"></p></aside>
<main class="preview"><div class="preview-head"><div><strong>Vista previa interactiva</strong>
<small>Portada auténtica · textos editables sólo en este navegador</small></div>
<div class="row"><button class="btn" data-device="desktop" type="button" aria-pressed="true">▭ Ordenador</button>
<button class="btn" data-device="mobile" type="button" aria-pressed="false">▯ Móvil</button>
<button class="btn" data-lang="es" type="button" aria-pressed="true">ES</button><button class="btn" data-lang="fr" type="button" aria-pressed="false">FR</button></div></div>
<div class="stage" id="stage"><iframe id="site" src="/espejo/?admin_embed=1#/" title="Página Bellaquitas Fest, previsualización sin guardar" referrerpolicy="same-origin"></iframe></div>
<p class="hint">Puedes probar colores, textos y secciones. Para editar y publicar en la web real será obligatorio iniciar sesión como administrador.</p>
</main></div>
<script nonce="__NONCE__">
(()=>{"use strict";
const frame=document.getElementById("site"),stage=document.getElementById("stage"),editing=document.getElementById("editing"),chosen=document.getElementById("chosen");
const notice=document.getElementById("notice"),KEY="bf_studio_local_draft_v1";
let draft={},theme="classic",lang="es",selected=null,previousPage="/",observer=null,activeDoc=null;
const navigation=["/","/experiencia","/eventos","/ventajas","/preguntas"];
try{const value=JSON.parse(localStorage.getItem(KEY)||"{}");if(value&&typeof value==="object"&&!Array.isArray(value)&&Object.keys(value).length<300)draft=value;}catch{}
const currentPage=()=>{try{const path=frame.contentWindow.location.hash.slice(1)||"/";return navigation.includes(path)?path:"/";}catch{return "/";}};
const inform=message=>{notice.textContent=message};
const setPressed=(selector,attr,value)=>document.querySelectorAll(selector).forEach(b=>b.setAttribute("aria-pressed",String(b.dataset[attr]===value)));
function applyTheme(){
 try{const b=frame.contentDocument.body;if(!b)return;
 b.classList.remove("theme-minimal","theme-festival");
 if(theme!=="classic")b.classList.add("theme-"+theme);
 }catch{}
}
const contentSelector="main h1,main h2,main h3,main p,main strong,main small,.site-header .nav-link,.community-page .eyebrow";
function decorate(){
 let doc;try{doc=frame.contentDocument;}catch{return}
 if(!doc?.body||doc!==activeDoc)return;
 const page=currentPage();
 const all=Array.from(doc.querySelectorAll(contentSelector)).filter(el=>
   !el.querySelector("*")&&el.textContent.trim().length>=2&&el.textContent.trim().length<=450&&
   !el.closest("script,style,textarea,button,.mobile-appbar,.sidebar,.login-form"));
 all.slice(0,350).forEach((el,i)=>{
  const key=page+"|"+i+"|"+el.tagName;
  if(el.dataset.bfStudioKey===key)return;
  el.dataset.bfStudioKey=key;
  el.style.cursor="text";
  if(Object.prototype.hasOwnProperty.call(draft,key)&&typeof draft[key]==="string")el.textContent=draft[key].slice(0,600);
 });
 applyTheme();
}
function bindFrame(){
 let doc;try{doc=frame.contentDocument;}catch{return}
 if(!doc?.body)return;
 observer?.disconnect();activeDoc=doc;selected=null;editing.value="";editing.disabled=true;chosen.textContent="Selecciona un texto de la página";
 const style=doc.createElement("style");
 style.textContent="[data-bf-studio-key]:hover{outline:2px dashed #f4c985!important;outline-offset:3px!important}";
 doc.head.append(style);
 doc.addEventListener("click",event=>{
  // Elements inside an iframe belong to a DIFFERENT JS realm.
  // instanceof window.Element is false there; check nodeType instead.
  const target=event.target?.nodeType===1?event.target.closest("[data-bf-studio-key]"):null;
  if(!target||event.target?.closest?.("[data-studio-image],[data-studio-icon]"))return;
  event.preventDefault();event.stopImmediatePropagation();
  selected=target;editing.disabled=false;editing.value=target.textContent.trim();
  chosen.textContent="Editando texto de "+(currentPage()==="/"?"Inicio":currentPage().slice(1));
  editing.focus({preventScroll:true});
 },true);
 observer=new MutationObserver(()=>decorate());
 observer.observe(doc.body,{childList:true,subtree:true});
 decorate();
}
frame.addEventListener("load",bindFrame);
window.addEventListener("load",()=>{if(frame.contentDocument?.readyState==="complete")bindFrame()});
document.getElementById("pages").addEventListener("click",event=>{
 const b=event.target.closest("button[data-page]");if(!b)return;
 const p=b.dataset.page;if(!navigation.includes(p))return;
 if(p!==previousPage){previousPage=p;frame.src="/espejo/?admin_embed=1#"+p;}
 document.body.classList.remove("menu-open");selected=null;
});
document.getElementById("themes").addEventListener("click",event=>{
 const b=event.target.closest("button[data-theme]");if(!b)return;
 theme=b.dataset.theme; if(!["classic","minimal","festival"].includes(theme))return;
 applyTheme();setPressed("[data-theme]","theme",theme);inform("Modelo cambiado sólo en esta vista previa.");
});
document.querySelectorAll("[data-device]").forEach(b=>b.addEventListener("click",()=>{
 const m=b.dataset.device;stage.classList.toggle("mobile",m==="mobile");setPressed("[data-device]","device",m);
}));
document.querySelectorAll("[data-lang]").forEach(b=>b.addEventListener("click",()=>{
 lang=b.dataset.lang;if(!["es","fr"].includes(lang))return;
 try{const el=frame.contentDocument.querySelector('[data-action="set-lang"][data-lang="'+lang+'"]');if(el)el.click();}catch{}
 setPressed("[data-lang]","lang",lang);
}));
editing.addEventListener("input",()=>{
 if(!selected?.isConnected)return;
 const value=editing.value.slice(0,600);
 selected.textContent=value;draft[selected.dataset.bfStudioKey]=value;
 inform("Cambio sólo de vista previa; todavía no se ha guardado el borrador local.");
});
document.getElementById("save").addEventListener("click",()=>{
 try{
 const json=JSON.stringify(draft);
 if(json.length>40000)throw Error("Borrador demasiado grande");
 localStorage.setItem(KEY,json);inform("Borrador local guardado en este navegador. No se ha publicado nada.");
 }catch{inform("No se pudo guardar en este navegador. Prueba con menos texto.");}
});
document.getElementById("reset").addEventListener("click",()=>{
 if(!confirm("¿Restablecer la vista y borrar este borrador local?"))return;
 draft={};try{localStorage.removeItem(KEY);}catch{}
 window.dispatchEvent(new Event("bf-studio-reset"));
 frame.src="/espejo/?admin_embed=1#"+currentPage();
 inform("Vista restaurada; no se ha modificado ningún dato en Cloudflare.");
});
document.getElementById("drawer").addEventListener("click",()=>document.body.classList.toggle("menu-open"));
document.getElementById("drawerBg").addEventListener("click",()=>document.body.classList.remove("menu-open"));
document.addEventListener("keydown",event=>{if(event.key==="Escape")document.body.classList.remove("menu-open")});
})();
</script></body></html>`;
export function studioSandboxRoute(request,env){
 const url=new URL(request.url);
 if(url.pathname!=="/laboratorio/"&&url.pathname!=="/laboratorio")return null;
 if(env?.SITE_MODE==="production"||
    (env?.SITE_MODE!==undefined&&env.SITE_MODE!=="staging")||
    env?.STAGING_MUTATIONS!=="disabled"||env?.ALLOW_NEW_ACCOUNTS!=="no"||
    url.hostname!==HOST)
  return new Response("Laboratorio no disponible",{status:503,headers:{"Cache-Control":"no-store","X-Robots-Tag":"noindex,nofollow"}});
 if(url.pathname==="/laboratorio")return Response.redirect(url.origin+"/laboratorio/",308);
 if(request.method!=="GET"&&request.method!=="HEAD")return new Response("Método no permitido",{status:405});
 const nonce=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(18))));
 const headers={
  "Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store",
  "X-Robots-Tag":"noindex,nofollow","X-Content-Type-Options":"nosniff",
  "Referrer-Policy":"no-referrer","X-Frame-Options":"DENY",
  "Content-Security-Policy":"default-src 'none'; frame-src 'self'; script-src 'nonce-"+nonce+"'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
 };
 return new Response(request.method==="HEAD"?null:HTML.replaceAll("__NONCE__",nonce),{status:200,headers});
}
