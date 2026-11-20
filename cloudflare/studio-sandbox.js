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
/* Editor category accordion and touch-friendly sidebar */
.panel{max-height:calc(100dvh - 66px);overflow-y:auto;scrollbar-width:thin;overscroll-behavior:contain;position:sticky;top:0}
.lab-accordion{border:1px solid #574059;border-radius:13px;overflow:hidden;background:#19141d;margin:9px 0}
.lab-accordion>summary{cursor:pointer;list-style:none;position:relative;padding:14px 32px 14px 13px;font-weight:800;font-size:13px;color:#f4e7db;min-height:47px;display:flex;align-items:center}
.lab-accordion>summary::-webkit-details-marker{display:none}
.lab-accordion>summary::after{content:"⌄";position:absolute;right:14px;color:var(--gold);font-size:20px;top:8px;transform:rotate(-90deg);transition:transform .18s}
.lab-accordion[open]>summary{border-bottom:1px solid #68506c;background:#312435}
.lab-accordion[open]>summary::after{transform:rotate(0)}
.lab-accordion-body{padding:12px 11px 16px}
.lab-accordion-body>p:first-child{margin-top:0}
.lab-accordion-body>.menu{gap:6px}
.lab-accordion-body .btn{min-height:40px}
.lab-accordion-body .studio-presets{gap:8px}
.panel .notice{margin:0 0 10px}
.panel h2{margin:8px 0;font-size:14px}
.lab-sidebar-heading{display:flex;align-items:center;justify-content:space-between;gap:5px;margin:0 0 9px}
.lab-sidebar-heading strong{letter-spacing:.04em}
.lab-sidebar-close{display:none;border:1px solid #715773;border-radius:8px;padding:5px 11px;background:#312534;color:white;font-size:18px}
#labOpenEditor{display:none;background:var(--gold);color:#211722;font-weight:800}
.lab-quick-actions{display:flex;gap:7px;padding:9px 3px 3px;position:sticky;bottom:0;background:#201a22ee;backdrop-filter:blur(12px);z-index:1}
.lab-quick-actions #save{flex:1;text-align:center}
.studio-palette-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;margin:9px 0 5px}
.studio-palette{min-height:40px;border:1px solid #68506c;color:#fcf4e8;background:#2d2232;border-radius:8px;font-size:12px;cursor:pointer}
.studio-minor-title{font-size:12px;margin:12px 0 6px;color:var(--muted)}
.lab-accordion-body label{font-size:12px}
.lab-accordion-body input[type=color]{height:41px}
.studio-advanced[data-inspector="icon"] #studioFile,
.studio-advanced[data-inspector="icon"] #studioImageUrl,
.studio-advanced[data-inspector="icon"] #studioApplyImage,
.studio-advanced[data-inspector="icon"] #studioRestoreImage,
.studio-advanced[data-inspector="icon"] label[for="studioFile"],
.studio-advanced[data-inspector="icon"] label[for="studioImageUrl"]{display:none!important}
.studio-advanced[data-inspector="image"] #studioIcon,
.studio-advanced[data-inspector="image"] #studioIcons,
.studio-advanced[data-inspector="image"] label[for="studioIcon"]{display:none!important}
@media(max-width:800px){
 .panel{position:fixed;top:0;bottom:0;left:0;height:100dvh;max-height:100dvh;overflow-y:auto;padding:13px;overscroll-behavior:contain}
 .lab-sidebar-close{display:inline-flex}
 .lab-accordion>summary{min-height:54px;font-size:14px}
 .head{min-height:59px}.head small{font-size:10px}
 .preview-head{position:sticky;top:0;z-index:3;background:#0d0a0ef3;padding:9px 3px}
 .stage{height:calc(100dvh - 190px);min-height:400px}
 .lab-quick-actions{padding-bottom:max(8px,env(safe-area-inset-bottom))}
}
body.lab-sim-mobile #labOpenEditor{display:inline-flex}
body.lab-sim-mobile-open .panel{display:block!important;position:fixed;inset:0 auto 0 0;width:min(88vw,358px);z-index:11;height:100dvh;max-height:100dvh;overflow-y:auto}
body.lab-sim-mobile-open #drawerBg{display:block!important;position:fixed;inset:0;background:#000b;z-index:10;width:100%;border:none}
body.lab-sim-mobile-open .lab-sidebar-close{display:inline-flex}
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
<section class="studio-advanced" aria-label="Personalización visual">
<div class="studio-group"><h2>Plantillas completas</h2><p>Escoge un modelo y personaliza cada elemento. Siempre puedes recuperar el original.</p><div class="studio-presets" id="studioPresets">
<button class="studio-preset" data-preset="original" type="button" aria-pressed="true"><span class="studio-swatch" style="background:linear-gradient(110deg,#080809 45%,#e9c477 45% 65%,#211825 65%)"></span><strong>Original Bellaquitas</strong><small>Diseño actual</small></button>
<button class="studio-preset" data-preset="noir" type="button" aria-pressed="false"><span class="studio-swatch" style="background:linear-gradient(110deg,#090a0d 45%,#cdaa66 45% 65%,#171717 65%)"></span><strong>Noir & Dorado</strong><small>Elegante, nocturno</small></button>
<button class="studio-preset" data-preset="urban" type="button" aria-pressed="false"><span class="studio-swatch" style="background:linear-gradient(110deg,#171020 45%,#ae81e5 45% 65%,#32213b 65%)"></span><strong>Urbano Club</strong><small>Streetwear y fiesta</small></button>
<button class="studio-preset" data-preset="glass" type="button" aria-pressed="false"><span class="studio-swatch" style="background:linear-gradient(110deg,#132231 45%,#55c8d4 45% 65%,#1c3037 65%)"></span><strong>Cristal</strong><small>Transparencias</small></button>
<button class="studio-preset" data-preset="violet" type="button" aria-pressed="false"><span class="studio-swatch" style="background:linear-gradient(110deg,#1d0f27 45%,#d8a1ff 45% 65%,#41234d 65%)"></span><strong>Festival Violeta</strong><small>Contraste y color</small></button>
<button class="studio-preset" data-preset="editorial" type="button" aria-pressed="false"><span class="studio-swatch" style="background:linear-gradient(110deg,#231c1c 45%,#dfc39d 45% 65%,#45372d 65%)"></span><strong>Editorial</strong><small>Minimalista profesional</small></button>
<button class="studio-preset" data-preset="cobalt" type="button" aria-pressed="false"><span class="studio-swatch" style="background:linear-gradient(110deg,#071628 45%,#82adf6 45% 65%,#203b5c 65%)"></span><strong>Azul Medianoche</strong><small>Azul profundo y cobre</small></button>
<button class="studio-preset" data-preset="rose" type="button" aria-pressed="false"><span class="studio-swatch" style="background:linear-gradient(110deg,#230f20 45%,#ed98c3 45% 65%,#39233c 65%)"></span><strong>Rosa Noche</strong><small>Rosa suave, club urbano</small></button>
<button class="studio-preset" data-preset="emerald" type="button" aria-pressed="false"><span class="studio-swatch" style="background:linear-gradient(110deg,#0b1d1b 45%,#8adbc0 45% 65%,#1a3933 65%)"></span><strong>Esmeralda</strong><small>Verde joya y negro</small></button>
<button class="studio-preset" data-preset="ice" type="button" aria-pressed="false"><span class="studio-swatch" style="background:linear-gradient(110deg,#102027 45%,#a8e4ed 45% 65%,#2a4049 65%)"></span><strong>Hielo Premium</strong><small>Azul hielo y grafito</small></button>
<button class="studio-preset" data-preset="copper" type="button" aria-pressed="false"><span class="studio-swatch" style="background:linear-gradient(110deg,#261b16 45%,#e6ac73 45% 65%,#453028 65%)"></span><strong>Cobre & Ámbar</strong><small>Cálido, sofisticado</small></button>
<button class="studio-preset" data-preset="monochrome" type="button" aria-pressed="false"><span class="studio-swatch" style="background:linear-gradient(110deg,#151515 45%,#d9d8d7 45% 65%,#303030 65%)"></span><strong>Blanco & Negro</strong><small>Editorial monocromo</small></button>
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
<div class="studio-two"><div><label for="studioBg">Fondo general</label><input id="studioBg" type="color" value="#100d12"/></div><div><label for="studioNav">Fondo de menús</label><input id="studioNav" type="color" value="#1a111a"/></div></div>
<div class="studio-two"><div><label for="studioTextColor">Color de textos</label><input id="studioTextColor" type="color" value="#fff7ef"/></div><div><label for="studioSecondary">Color secundario</label><input id="studioSecondary" type="color" value="#bb85a0"/></div></div>
<div class="studio-two"><div><label for="studioBorder">Color de bordes</label><input id="studioBorder" type="color" value="#62404f"/></div></div>
<h3 class="studio-minor-title">Paletas rápidas</h3>
<div id="studioPalettes" class="studio-palette-grid" role="group" aria-label="Paletas de color">
<button type="button" class="studio-palette" data-palette="noir">Dorado</button>
<button type="button" class="studio-palette" data-palette="urban">Morado</button>
<button type="button" class="studio-palette" data-palette="cobalt">Azul</button>
<button type="button" class="studio-palette" data-palette="rose">Rosa</button>
<button type="button" class="studio-palette" data-palette="emerald">Verde</button>
<button type="button" class="studio-palette" data-palette="monochrome">Neutro</button>
</div>
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
<h2>Acabados básicos (opcional)</h2><div class="menu" id="themes">
<button class="btn" type="button" data-theme="classic">Original Bellaquitas</button>
<button class="btn" type="button" data-theme="minimal">Minimalista</button>
<button class="btn" type="button" data-theme="festival">Festival</button>
</div>
<h2>Edición de textos</h2><p>Pulsa un texto de la página para modificarlo en esta vista previa.</p>
<div id="chosen" aria-live="polite">Selecciona un texto de la página</div>
<label for="editing">Texto seleccionado</label><textarea id="editing" maxlength="600" disabled placeholder="Selecciona primero un texto de la página"></textarea>

<h2>Borrador</h2><div class="menu">
<button class="btn primary" id="save" type="button">Guardar borrador local</button>
<button class="btn" id="reset" type="button">Restablecer vista sin guardar</button>
</div><p id="notice" role="status" aria-live="polite"></p></aside>
<main class="preview"><div class="preview-head"><div><strong>Vista previa interactiva</strong>
<small>Portada auténtica · textos editables sólo en este navegador</small></div>
<div class="row"><button class="btn" id="labOpenEditor" type="button" aria-controls="controls" aria-expanded="false">☰ Editar</button><button class="btn" data-device="desktop" type="button" aria-pressed="true">▭ Ordenador</button>
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
  chosen.textContent="Editando texto de "+(currentPage()==="/"?"Portada":currentPage().slice(1));
  window.bfLabOpen?.("text");
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
 const m=b.dataset.device;stage.classList.toggle("mobile",m==="mobile");
 document.body.classList.toggle("lab-sim-mobile",m==="mobile");
 document.body.classList.remove("lab-sim-mobile-open");
 setPressed("[data-device]","device",m);
 inform(m==="mobile"?"Vista móvil: puedes abrir el panel izquierdo con «☰ Editar».":"Vista ordenador restaurada.");
}));
document.querySelectorAll("[data-lang]").forEach(b=>b.addEventListener("click",()=>{
 lang=b.dataset.lang;if(!["es","fr"].includes(lang))return;
 try{const el=frame.contentDocument.querySelector('[data-action="set-lang"][data-lang="'+lang+'"]');if(el)el.click();}catch{}
 setPressed("[data-lang]","lang",lang);
}));
editing.addEventListener("input",()=>{
 // La web original puede regenerar nodos tras navegar o cambiar de idioma:
 // conservar el borrador por clave incluso si el elemento fue sustituido.
 const key=selected?.dataset.bfStudioKey;
 if(!key||key.length>130)return;
 const value=editing.value.slice(0,600);
 draft[key]=value;
 if(selected.isConnected)selected.textContent=value;
 else {
  const latest=frame.contentDocument?.querySelector('[data-bf-studio-key="'+key.replace(/[^A-Za-z0-9|/_-]/g,"")+'"]');
  if(latest){selected=latest;selected.textContent=value;}
 }
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
</script><script nonce="__NONCE__">
(()=>{"use strict";
const frame=document.getElementById("site"),byId=id=>document.getElementById(id),KEY="bf_studio_design_v2";
const sections=["experiencia","eventos","ventajas","preguntas","unete"];
const PRESETS={"original":{"header":"original","menu":"original","hero":"original","cards":"original","buttons":"original","font":"#e9c477","accent":"#211825","surface":"#100d12","bg":"#1a111a","nav":"#fff7ef","text":"#bb85a0","secondary":"#62404f"},"noir":{"header":"outlined","menu":"underline","hero":"cinema","cards":"outlined","buttons":"outline","font":"modern","accent":"#d4af66","surface":"#161318","bg":"#090a0e","nav":"#161318","text":"#f7e6c7","secondary":"#a78f75","border":"#8c7452"},"urban":{"header":"compact","menu":"pills","hero":"full","cards":"square","buttons":"square","font":"urban","accent":"#b78be9","surface":"#2b2038","bg":"#161122","nav":"#271a37","text":"#f5eaff","secondary":"#d887bd","border":"#76539b"},"glass":{"header":"glass","menu":"pills","hero":"soft","cards":"glass","buttons":"pill","font":"modern","accent":"#5bd2d8","surface":"#182a36","bg":"#0b1b26","nav":"#1d3440","text":"#f1fdff","secondary":"#a0bded","border":"#4d8698"},"violet":{"header":"centered","menu":"pills","hero":"cinema","cards":"glass","buttons":"pill","font":"urban","accent":"#d3a2ff","surface":"#301b42","bg":"#170e23","nav":"#29123b","text":"#f9efff","secondary":"#d98edf","border":"#755198"},"editorial":{"header":"centered","menu":"minimal","hero":"framed","cards":"soft","buttons":"outline","font":"editorial","accent":"#dfbe8c","surface":"#352c29","bg":"#211b1a","nav":"#312521","text":"#f9f0e3","secondary":"#ad907b","border":"#856e55"},"cobalt":{"header":"outlined","menu":"underline","hero":"full","cards":"glass","buttons":"pill","font":"modern","accent":"#82adf6","surface":"#203b5c","bg":"#071628","nav":"#122743","text":"#eff6ff","secondary":"#7bbcd4","border":"#5779a4"},"rose":{"header":"glass","menu":"pills","hero":"cinema","cards":"glass","buttons":"pill","font":"modern","accent":"#ed98c3","surface":"#39233c","bg":"#230f20","nav":"#321629","text":"#fff0f9","secondary":"#b985df","border":"#995779"},"emerald":{"header":"compact","menu":"underline","hero":"soft","cards":"glass","buttons":"outline","font":"modern","accent":"#8adbc0","surface":"#1a3933","bg":"#0b1d1b","nav":"#16352d","text":"#effff7","secondary":"#d2bd78","border":"#497e6b"},"ice":{"header":"glass","menu":"minimal","hero":"full","cards":"soft","buttons":"pill","font":"modern","accent":"#a8e4ed","surface":"#2a4049","bg":"#102027","nav":"#1b333b","text":"#effdff","secondary":"#9dbde2","border":"#668b99"},"copper":{"header":"outlined","menu":"underline","hero":"cinema","cards":"soft","buttons":"outline","font":"editorial","accent":"#e6ac73","surface":"#453028","bg":"#261b16","nav":"#39251e","text":"#fff2e4","secondary":"#d89171","border":"#986c56"},"monochrome":{"header":"centered","menu":"minimal","hero":"framed","cards":"outlined","buttons":"square","font":"editorial","accent":"#d9d8d7","surface":"#303030","bg":"#151515","nav":"#252525","text":"#f6f6f6","secondary":"#aaa8a7","border":"#777777"}};
const defaults={...PRESETS.original,preset:"original",logo:true,ticker:true,banner:"",order:[...sections],hidden:[],images:{},icons:{}};
let design=structuredClone(defaults),selected=null,obs=null,queued=false;
const keys=["header","menu","hero","cards","buttons","font","accent","surface","bg","nav","text","secondary","border"];
const colorKeys=new Set(["accent","surface","bg","nav","text","secondary","border"]);
const form={header:"studioHeader",menu:"studioMenu",hero:"studioHero",cards:"studioCards",buttons:"studioButtons",font:"studioFont",accent:"studioAccent",surface:"studioSurface",bg:"studioBg",nav:"studioNav",text:"studioTextColor",secondary:"studioSecondary",border:"studioBorder"};
const status=msg=>{byId("studioStatus").textContent=msg;};
const goodKey=k=>typeof k==="string"&&k.length<135&&/^[a-z0-9|/_-]+$/i.test(k);
const page=()=>{try{return(frame.contentWindow.location.hash.slice(1)||"/").slice(0,40)}catch{return"/"}};
try{
 const saved=JSON.parse(localStorage.getItem(KEY)||"null");
 if(saved&&typeof saved==="object"&&!Array.isArray(saved)){
  const base=saved.preset==="custom"?"custom":Object.keys(PRESETS).includes(saved.preset)?saved.preset:"original";
  design={...defaults,...(PRESETS[base]||PRESETS.original),preset:base};
  for(const key of keys){
   const input=byId(form[key]);
   if(colorKeys.has(key)){
    if(typeof saved[key]==="string"&&/^#[0-9a-f]{6}$/i.test(saved[key]))design[key]=saved[key];
   }else if(Array.from(input.options).some(opt=>opt.value===saved[key]))design[key]=saved[key];
  }
  design.logo=saved.logo!==false;design.ticker=saved.ticker!==false;
  design.banner=typeof saved.banner==="string"?saved.banner.slice(0,100):"";
  if(Array.isArray(saved.hidden))design.hidden=saved.hidden.filter(id=>sections.includes(id));
  if(Array.isArray(saved.order)&&saved.order.length===5&&new Set(saved.order).size===5&&saved.order.every(id=>sections.includes(id)))design.order=saved.order;
  for(const [k,v] of Object.entries(saved.images||{}).slice(0,80))
   if(goodKey(k)&&typeof v==="string"&&v.length<140000&&(/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(v)||/^https:\/\/[^<>"'\s]{1,600}$/.test(v)))design.images[k]=v;
  for(const [k,v] of Object.entries(saved.icons||{}).slice(0,150))
   if(goodKey(k)&&typeof v==="string"&&v.length<=8)design.icons[k]=v;
 }
}catch{}
function sync(){
 for(const k of keys)byId(form[k]).value=design[k];
 byId("studioLogoShow").checked=design.logo;
 byId("studioTickerShow").checked=design.ticker;
 byId("studioBanner").value=design.banner;
 document.querySelectorAll("[data-preset]").forEach(btn=>btn.setAttribute("aria-pressed",String(btn.dataset.preset===design.preset)));
 for(const key of design.order){
  const row=byId("studioSections").querySelector('[data-section="'+key+'"]');
  row.querySelector("input").checked=!design.hidden.includes(key);
  byId("studioSections").append(row);
 }
}
sync();
const css="\nbody.studio-on:not([data-s-preset=\"original\"]) .site-header{border-color:var(--s-accent)!important}\nbody.studio-on:not([data-s-preset=\"original\"]) .btn-primary{background:var(--s-accent)!important;color:#120e14!important;border-color:var(--s-accent)!important}\nbody.studio-on:not([data-s-preset=\"original\"]) .feature,\nbody.studio-on:not([data-s-preset=\"original\"]) .event-card,\nbody.studio-on:not([data-s-preset=\"original\"]) .faq-card,\nbody.studio-on:not([data-s-preset=\"original\"]) .big-benefit,\nbody.studio-on:not([data-s-preset=\"original\"]) .benefit-item{\nbackground:var(--s-surface)!important;border-color:var(--s-accent)!important}\nbody.studio-on[data-s-header=\"glass\"] .site-header{\nmax-width:min(95vw,1180px)!important;margin:12px auto 0!important;border-radius:19px!important;\nbackground:color-mix(in srgb,var(--s-surface) 68%,transparent)!important;\nborder:1px solid var(--s-accent)!important;backdrop-filter:blur(19px)!important}\nbody.studio-on[data-s-header=\"compact\"] .site-header .nav-wrap{min-height:50px!important;padding-block:3px!important}\nbody.studio-on[data-s-header=\"centered\"] .site-header .nav-wrap{\njustify-content:center!important;gap:20px!important;flex-wrap:wrap!important;text-align:center!important}\nbody.studio-on[data-s-header=\"outlined\"] .site-header{\nwidth:min(94%,1100px)!important;margin:10px auto!important;border:2px solid var(--s-accent)!important;border-radius:14px!important}\nbody.studio-on[data-s-menu=\"pills\"] .nav-link{background:#ffffff19!important;border-radius:40px!important;padding:8px 12px!important}\nbody.studio-on[data-s-menu=\"pills\"] .nav-link.active{color:#120b15!important;background:var(--s-accent)!important}\nbody.studio-on[data-s-menu=\"underline\"] .nav-link.active{border-bottom:2px solid var(--s-accent)!important;border-radius:0!important}\nbody.studio-on[data-s-menu=\"minimal\"] .nav-link{background:transparent!important;box-shadow:none!important;letter-spacing:.09em!important}\nbody.studio-on[data-s-hero=\"full\"] .bf-video-hero{min-height:100vh!important}\nbody.studio-on[data-s-hero=\"cinema\"] .bf-video-hero{min-height:72vh!important;filter:contrast(1.12)!important}\nbody.studio-on[data-s-hero=\"framed\"] .bf-video-hero{width:94%!important;overflow:hidden!important;margin:16px auto!important;border:2px solid var(--s-accent)!important;border-radius:25px!important}\nbody.studio-on[data-s-hero=\"soft\"] .bf-video-hero{filter:brightness(.66) saturate(.89)!important}\nbody.studio-on[data-s-cards=\"glass\"] .feature,\nbody.studio-on[data-s-cards=\"glass\"] .event-card,\nbody.studio-on[data-s-cards=\"glass\"] .faq-card,\nbody.studio-on[data-s-cards=\"glass\"] .big-benefit,\nbody.studio-on[data-s-cards=\"glass\"] .benefit-item{\nbackground:color-mix(in srgb,var(--s-surface) 60%,transparent)!important;backdrop-filter:blur(15px)!important;box-shadow:0 15px 40px #0009!important}\nbody.studio-on[data-s-cards=\"outlined\"] .feature,\nbody.studio-on[data-s-cards=\"outlined\"] .event-card,\nbody.studio-on[data-s-cards=\"outlined\"] .faq-card,\nbody.studio-on[data-s-cards=\"outlined\"] .big-benefit{background:transparent!important;border:1px solid var(--s-accent)!important}\nbody.studio-on[data-s-cards=\"square\"] .feature,\nbody.studio-on[data-s-cards=\"square\"] .event-card,\nbody.studio-on[data-s-cards=\"square\"] .faq-card,\nbody.studio-on[data-s-cards=\"square\"] .big-benefit{border-radius:3px!important}\nbody.studio-on[data-s-cards=\"soft\"] .feature,\nbody.studio-on[data-s-cards=\"soft\"] .event-card,\nbody.studio-on[data-s-cards=\"soft\"] .faq-card,\nbody.studio-on[data-s-cards=\"soft\"] .big-benefit{border-radius:28px!important}\nbody.studio-on[data-s-buttons=\"pill\"] .btn{border-radius:99px!important}\nbody.studio-on[data-s-buttons=\"outline\"] .btn{background:transparent!important;border-color:var(--s-accent)!important;color:var(--s-accent)!important}\nbody.studio-on[data-s-buttons=\"square\"] .btn{border-radius:3px!important}\nbody.studio-on[data-s-font=\"urban\"] h1,\nbody.studio-on[data-s-font=\"urban\"] h2,\nbody.studio-on[data-s-font=\"urban\"] h3{font-family:Impact,\"Arial Black\",sans-serif!important;letter-spacing:.025em!important;text-transform:uppercase!important}\nbody.studio-on[data-s-font=\"modern\"]{font-family:Arial,Helvetica,sans-serif!important}\nbody.studio-on[data-s-font=\"editorial\"] h1,\nbody.studio-on[data-s-font=\"editorial\"] h2{font-family:Georgia,\"Times New Roman\",serif!important;font-weight:400!important}\nbody.studio-on[data-s-logo=\"hidden\"] .bf-new-navbar-logo img{visibility:hidden!important}\nbody.studio-on[data-s-ticker=\"hidden\"] .bf-marquee{display:none!important}\nbody.studio-on[data-s-hide-experiencia=\"true\"] section#experiencia,\nbody.studio-on[data-s-hide-eventos=\"true\"] section#eventos,\nbody.studio-on[data-s-hide-ventajas=\"true\"] section#ventajas,\nbody.studio-on[data-s-hide-preguntas=\"true\"] section#preguntas,\nbody.studio-on[data-s-hide-unete=\"true\"] section#unete{display:none!important}\n[data-studio-image]:hover,[data-studio-icon]:hover{outline:2px dashed #f1c981!important;outline-offset:4px!important;cursor:pointer!important}\n\nbody.studio-on:not([data-s-preset=\"original\"]){\n --bg:var(--s-bg)!important;--bg2:var(--s-nav)!important;\n --surface:var(--s-surface)!important;--surface2:var(--s-nav)!important;\n --gold:var(--s-accent)!important;--gold2:var(--s-secondary)!important;\n --berry:var(--s-secondary)!important;--berry2:var(--s-secondary)!important;\n --border:var(--s-border)!important;--text:var(--s-text)!important;\n background:var(--s-bg)!important;color:var(--s-text)!important;\n}\nbody.studio-on:not([data-s-preset=\"original\"]) :is(\n .site-header,.main-nav,.bf-community-menu,.bf-menu-mobile-primary,\n .bf-menu-community-links,.mobile-menu-actions,.sidebar,.app-top,.mobile-appbar,\n .footer,.site-search-panel,.search-panel,.bf-topbar,.bf-marquee\n){background:var(--s-nav)!important;border-color:var(--s-border)!important;color:var(--s-text)!important}\nbody.studio-on:not([data-s-preset=\"original\"]) :is(\n .nav-link,.community-menu-link,.side-link,.mobile-appbar a,.app-top,\n .menu-toggle,.footer a,.main-nav a\n){color:var(--s-text)!important;border-color:var(--s-border)!important}\nbody.studio-on:not([data-s-preset=\"original\"]) :is(\n .nav-link:hover,.nav-link.active,.side-link.active,.app-public-home,\n .eyebrow,.feature-icon,.round-icon,.gold,.bf-ticker-set b,.bf-marquee-item b\n){color:var(--s-accent)!important;border-color:var(--s-accent)!important}\nbody.studio-on:not([data-s-preset=\"original\"]) :is(\n .feature,.faq-card,.event-card,.reward-card,.big-benefit,.benefit-item,\n .pane,.cta-banner,.auth-panel,.community-album,.community-intro,.profile-form\n){background:var(--s-surface)!important;border-color:var(--s-border)!important;color:var(--s-text)!important}\nbody.studio-on:not([data-s-preset=\"original\"]) :is(\n input,textarea,select,.pill,.btn-secondary,.lang-switch button,.header-search-button,.menu-toggle\n){border-color:var(--s-border)!important;color:var(--s-text)!important}\nbody.studio-on:not([data-s-preset=\"original\"]) :is(.btn-primary,.progress-fill){\n background:var(--s-accent)!important;color:var(--s-bg)!important;border-color:var(--s-accent)!important\n}\nbody.studio-on:not([data-s-preset=\"original\"]) .bf-desktop-nav .nav-link[href=\"#/\"]:not(.active){\n color:var(--s-text)!important;border-bottom-color:transparent!important\n}\nbody.studio-on:not([data-s-preset=\"original\"]) :is(.nav-link.active[aria-current=\"page\"],.bf-desktop-nav .nav-link[aria-current=\"page\"]){\n border-bottom-color:var(--s-accent)!important;color:var(--s-accent)!important\n}\nbody.studio-on[data-s-cards=\"glass\"] :is(.feature,.faq-card,.event-card,.big-benefit,.benefit-item,.cta-banner){\n background:color-mix(in srgb,var(--s-surface) 65%,transparent)!important;\n backdrop-filter:blur(16px)!important;box-shadow:0 15px 40px #0009!important\n}\nbody.studio-on[data-s-cards=\"outlined\"] :is(.feature,.faq-card,.event-card,.big-benefit,.benefit-item){\n background:transparent!important;border-color:var(--s-accent)!important\n}\n/* The mobile preview account switches duplicate bottom Inicio items for a left drawer. */\nbody.studio-on[data-s-mobile=\"yes\"] .app-shell{display:block!important}\nbody.studio-on[data-s-mobile=\"yes\"] .mobile-appbar{display:none!important}\nbody.studio-on[data-s-mobile=\"yes\"] .app-shell .sidebar{\n display:flex!important;position:fixed!important;top:0!important;bottom:0!important;left:0!important;\n height:100dvh!important;width:min(84vw,320px)!important;\n background:var(--s-nav,#180e18)!important;z-index:900!important;\n transform:translateX(-110%)!important;transition:transform .2s ease!important;\n overflow-y:auto!important\n}\nbody.studio-on[data-s-mobile=\"yes\"][data-s-account-open=\"yes\"] .app-shell .sidebar{\n transform:translateX(0)!important\n}\nbody.studio-on[data-s-mobile=\"yes\"] .app-shell .app-main{\n width:100%!important;min-width:0!important;grid-column:1/-1!important\n}\nbody.studio-on .studio-account-trigger{display:none}\nbody.studio-on[data-s-mobile=\"yes\"] .studio-account-trigger{\n display:flex!important;align-items:center!important;gap:7px!important;\n padding:10px 14px!important;margin:10px!important;position:sticky!important;\n top:7px!important;z-index:50!important;font-weight:800!important;\n border:1px solid var(--s-accent,#dfb477)!important;border-radius:10px!important;\n background:var(--s-nav,#201520)!important;color:var(--s-text,#fff)!important\n}\nbody.studio-on .studio-account-backdrop{display:none}\nbody.studio-on[data-s-mobile=\"yes\"][data-s-account-open=\"yes\"] .studio-account-backdrop{\n display:block!important;position:fixed!important;inset:0!important;z-index:899!important;\n background:#000a!important;border:0!important;width:100%!important\n}\n\n/* Original Bellaquitas has an ID-scoped !important navbar rule.\n   Override it ONLY inside this staged preview (never alter production CSS). */\nbody.studio-on:not([data-s-preset=\"original\"]) > #app .site-header,\nbody.studio-on:not([data-s-preset=\"original\"]) > #app .bf-marquee,\nbody.studio-on:not([data-s-preset=\"original\"]) > #app .bf-topbar,\nbody.studio-on:not([data-s-preset=\"original\"]) > #app .bf-community-menu{\n background:var(--s-nav)!important;background-color:var(--s-nav)!important;\n color:var(--s-text)!important;border-color:var(--s-border)!important;\n}\nbody.studio-on:not([data-s-preset=\"original\"]) > #app .site-header .nav-link{\n color:var(--s-text)!important;text-shadow:none!important\n}\nbody.studio-on:not([data-s-preset=\"original\"]) > #app .site-header .nav-link[aria-current=\"page\"]{\n color:var(--s-accent)!important;border-bottom-color:var(--s-accent)!important\n}\nbody.studio-on:not([data-s-preset=\"original\"]) > #app .feature,\nbody.studio-on:not([data-s-preset=\"original\"]) > #app .faq-card,\nbody.studio-on:not([data-s-preset=\"original\"]) > #app .event-card,\nbody.studio-on:not([data-s-preset=\"original\"]) > #app .big-benefit,\nbody.studio-on:not([data-s-preset=\"original\"]) > #app .benefit-item{\n background:var(--s-surface)!important;color:var(--s-text)!important;\n border-color:var(--s-border)!important\n}\nbody.studio-on[data-s-cards=\"glass\"] > #app :is(.feature,.faq-card,.event-card,.big-benefit,.benefit-item){\n background:color-mix(in srgb,var(--s-surface) 65%,transparent)!important;\n backdrop-filter:blur(16px)!important\n}\nbody.studio-on[data-s-cards=\"outlined\"] > #app :is(.feature,.faq-card,.event-card,.big-benefit,.benefit-item){\n background:transparent!important;border-color:var(--s-accent)!important\n}\nbody.studio-on[data-s-header=\"glass\"] > #app .site-header{\n width:min(95vw,1180px)!important;max-width:95vw!important;\n margin:12px auto 0!important;border-radius:18px!important;\n background:color-mix(in srgb,var(--s-nav) 75%,transparent)!important;\n backdrop-filter:blur(17px)!important\n}\nbody.studio-on[data-s-header=\"compact\"] > #app .site-header{\n width:min(97vw,1200px)!important;min-height:54px!important;margin:6px auto 0!important\n}\nbody.studio-on[data-s-header=\"centered\"] > #app .site-header{\n width:min(96vw,1100px)!important;max-width:96vw!important;\n margin:10px auto!important;border-radius:16px!important\n}\nbody.studio-on[data-s-header=\"centered\"] > #app .site-header .nav-wrap{\n justify-content:center!important;flex-wrap:wrap!important;gap:13px!important\n}\nbody.studio-on[data-s-header=\"outlined\"] > #app .site-header{\n width:min(92vw,1100px)!important;max-width:92vw!important;\n margin:12px auto 0!important;border:2px solid var(--s-accent)!important;\n border-radius:14px!important\n}\nbody.studio-on[data-s-hero=\"framed\"] > #app .bf-video-hero{\n width:94%!important;margin:16px auto!important;overflow:hidden!important;\n border:2px solid var(--s-accent)!important;border-radius:24px!important\n}\nbody.studio-on[data-s-hero=\"full\"] > #app .bf-video-hero{min-height:100vh!important}\n";
function reorder(doc){
 const parent=doc.querySelector(".bf-after-marquee-content");if(!parent)return;
 const elems=Array.from(parent.children).filter(e=>e.matches("section[id]")&&sections.includes(e.id));
 if(elems.length!==5||elems.map(e=>e.id).join("|")===design.order.join("|"))return;
 const groups=new Map(elems.map(section=>[section.id,{section,line:section.previousElementSibling?.classList.contains("line")?section.previousElementSibling:null}]));
 const fragment=doc.createDocumentFragment();
 for(const key of design.order){const pair=groups.get(key);if(pair?.line)fragment.append(pair.line);if(pair)fragment.append(pair.section);}
 parent.append(fragment);
}
function apply(){
 let doc;try{doc=frame.contentDocument}catch{return}
 if(!doc?.body)return;
 let style=doc.getElementById("bf-studio-live-style");
 if(!style){style=doc.createElement("style");style.id="bf-studio-live-style";style.textContent=css;doc.head.append(style);}
 const body=doc.body;body.classList.add("studio-on");
 for(const k of ["preset","header","menu","hero","cards","buttons","font"])body.setAttribute("data-s-"+k,design[k]);
 body.setAttribute("data-s-logo",design.logo?"visible":"hidden");
 body.setAttribute("data-s-ticker",design.ticker?"visible":"hidden");
 for(const k of sections)body.setAttribute("data-s-hide-"+k,String(design.hidden.includes(k)));
 for(const key of colorKeys)body.style.setProperty("--s-"+key,design[key]);
 const mobile=frame.contentWindow.innerWidth<=800;
 body.setAttribute("data-s-mobile",mobile?"yes":"no");
 const app=doc.querySelector(".app-shell");
 if(app){
  const home=app.querySelector('.sidebar .side-link[href="#/"]');
  if(home&&!home.dataset.studioRenamed){
   const node=home.lastChild;
   if(node?.nodeType===3)node.textContent=" Portada web";
   home.dataset.studioRenamed="yes";
  }
  if(!app.querySelector(".studio-account-trigger")){
   const main=app.querySelector(".app-main");
   if(main){
    const trigger=doc.createElement("button");
    trigger.type="button";trigger.className="studio-account-trigger";
    trigger.textContent="☰ Menú lateral";trigger.setAttribute("aria-label","Abrir menú lateral de cuenta");
    trigger.addEventListener("click",()=>body.setAttribute("data-s-account-open","yes"));
    main.prepend(trigger);
    const backdrop=doc.createElement("button");backdrop.type="button";
    backdrop.className="studio-account-backdrop";
    backdrop.setAttribute("aria-label","Cerrar menú lateral");
    backdrop.addEventListener("click",()=>body.setAttribute("data-s-account-open","no"));
    app.append(backdrop);
    app.querySelector(".sidebar")?.addEventListener("click",event=>{
      if(event.target?.closest?.("a"))body.setAttribute("data-s-account-open","no");
    });
   }
  }
 }
 reorder(doc);
 Array.from(doc.querySelectorAll("img")).slice(0,90).forEach((img,i)=>{
  const key=img.closest(".bf-new-navbar-logo")?"global|header-logo":page()+"|img|"+i;
  img.dataset.studioImage=key;
  const val=design.images[key];if(val&&img.getAttribute("src")!==val)img.setAttribute("src",val);
 });
 Array.from(doc.querySelectorAll(".feature-icon,.round-icon,.ico")).slice(0,160).forEach((icon,i)=>{
  const key=page()+"|icon|"+i;icon.dataset.studioIcon=key;
  if(typeof design.icons[key]==="string"&&icon.textContent!==design.icons[key])icon.textContent=design.icons[key];
 });
 if(design.banner){
  doc.querySelectorAll(".bf-marquee-item").forEach(item=>{
   const val=design.banner+" ✦ BELLAQUITAS FEST ✦";
   if(item.textContent!==val)item.textContent=val;
  });
 }
}
function schedule(){
 if(queued)return;
 queued=true;requestAnimationFrame(()=>{queued=false;apply();});
}
function bind(){
 let doc;try{doc=frame.contentDocument}catch{return}
 if(!doc?.body)return;
 obs?.disconnect();
 doc.addEventListener("click",e=>{
  const target=e.target?.nodeType===1?e.target.closest("[data-studio-image],[data-studio-icon]"):null;
  if(!target)return;
  e.preventDefault();e.stopImmediatePropagation();
  selected={element:target,key:target.dataset.studioImage||target.dataset.studioIcon,type:target.hasAttribute("data-studio-image")?"image":"icon"};
  byId("studioSelection").textContent=(selected.type==="image"?"Imagen: ":"Icono: ")+(selected.key==="global|header-logo"?"Logo superior":selected.key);
  byId("studioIcon").disabled=selected.type!=="icon";
  byId("studioIcon").value=selected.type==="icon"?target.textContent.trim():"";
  status("Seleccionado. Modifícalo desde las opciones de la izquierda.");
  window.bfLabOpen?.("media",selected.type);
 },true);
 obs=new MutationObserver(schedule);
 obs.observe(doc.body,{childList:true,subtree:true});
 schedule();
}
frame.addEventListener("load",bind);
if(frame.contentDocument?.readyState==="complete")bind();
byId("studioPresets").addEventListener("click",e=>{
 const btn=e.target.closest("[data-preset]");if(!btn||!PRESETS[btn.dataset.preset])return;
 Object.assign(design,PRESETS[btn.dataset.preset],{preset:btn.dataset.preset});
 sync();schedule();status("Plantilla "+btn.querySelector("strong").textContent+" aplicada únicamente en pruebas.");
});
byId("studioPalettes").addEventListener("click",event=>{
 const button=event.target.closest("[data-palette]");
 if(!button||!PRESETS[button.dataset.palette])return;
 const palette=PRESETS[button.dataset.palette];
 for(const key of colorKeys)design[key]=palette[key];
 design.preset="custom";sync();schedule();
 status("Paleta aplicada a menús, botones, tarjetas, textos y todos los fondos.");
});
for(const k of keys){
 byId(form[k]).addEventListener("input",()=>{
  const value=byId(form[k]).value;
  if(colorKeys.has(k)?!/^#[a-f0-9]{6}$/i.test(value):
    !Array.from(byId(form[k]).options).some(o=>o.value===value))return;
  design[k]=value;
  if(colorKeys.has(k))design.preset="custom";
  sync();schedule();status("Estilo actualizado en esta vista previa.");
 });
}
byId("studioLogoShow").addEventListener("change",()=>{design.logo=byId("studioLogoShow").checked;schedule();});
byId("studioTickerShow").addEventListener("change",()=>{design.ticker=byId("studioTickerShow").checked;schedule();});
byId("studioBanner").addEventListener("input",()=>{design.banner=byId("studioBanner").value.slice(0,100);schedule();});
byId("studioSections").addEventListener("change",()=>{
 design.hidden=sections.filter(id=>!byId("studioSections").querySelector('[data-section="'+id+'"] input').checked);
 schedule();
});
byId("studioSections").addEventListener("click",e=>{
 const btn=e.target.closest("[data-move]");if(!btn)return;
 const key=btn.closest("[data-section]").dataset.section,i=design.order.indexOf(key);
 const offset=btn.dataset.move==="up"?-1:1;if(i<0||i+offset<0||i+offset>=5)return;
 [design.order[i],design.order[i+offset]]=[design.order[i+offset],design.order[i]];
 sync();schedule();status("Orden de las secciones cambiado en la vista previa.");
});
byId("studioPickLogo").addEventListener("click",()=>{
 const image=frame.contentDocument?.querySelector(".bf-new-navbar-logo img");
 if(!image)return status("Abre primero Inicio para seleccionar el logo.");
 selected={element:image,key:"global|header-logo",type:"image"};
 byId("studioSelection").textContent="Logo superior seleccionado";
 byId("studioIcon").disabled=true;
 window.bfLabOpen?.("media","image");
 status("Elige una imagen local o dirección HTTPS para el logo.");
});
function imageApply(val){
 if(selected?.type!=="image"||!selected.element?.isConnected)return status("Primero selecciona una imagen de la vista previa.");
 if(!goodKey(selected.key))return status("Elemento no válido");
 design.images[selected.key]=val;selected.element.setAttribute("src",val);
 schedule();status("Imagen cambiada solo en pruebas. No se ha subido a Cloudflare.");
}
byId("studioFile").addEventListener("change",async()=>{
 try{
  const file=byId("studioFile").files[0];
  if(!file||file.size<=0||file.size>3*1024*1024||!["image/jpeg","image/png","image/webp"].includes(file.type))
   throw Error("Selecciona JPG, PNG o WebP de hasta 3 MB.");
  const raw=await new Promise((resolve,reject)=>{
   const reader=new FileReader();reader.onload=()=>resolve(reader.result);
   reader.onerror=()=>reject(Error("No se puede leer imagen"));reader.readAsDataURL(file);
  });
  const img=await new Promise((resolve,reject)=>{
   const pic=new Image();pic.onload=()=>resolve(pic);pic.onerror=()=>reject(Error("Imagen inválida"));pic.src=raw;
  });
  const canvas=document.createElement("canvas"),factor=Math.min(1,650/Math.max(img.width,img.height));
  canvas.width=Math.max(1,Math.round(img.width*factor));canvas.height=Math.max(1,Math.round(img.height*factor));
  canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);
  const data=canvas.toDataURL("image/webp",.76);
  if(data.length>140000)throw Error("Imagen demasiado pesada para borrador local.");
  imageApply(data);
 }catch(err){status(err.message||"No se puede cargar esta imagen");}
});
byId("studioApplyImage").addEventListener("click",()=>{
 try{const uri=new URL(byId("studioImageUrl").value.trim());
 if(uri.protocol!=="https:"||uri.username||uri.password||uri.href.length>600)throw Error();
 imageApply(uri.href);
 }catch{status("Introduce una URL HTTPS válida.");}
});
byId("studioRestoreImage").addEventListener("click",()=>{
 if(selected?.type!=="image")return status("Selecciona una imagen primero.");
 delete design.images[selected.key];
 frame.src="/espejo/?admin_embed=1#"+page();
 status("Imagen restaurada en pruebas.");
});
byId("studioIcon").addEventListener("input",()=>{
 if(selected?.type!=="icon"||!selected.element?.isConnected)return;
 const value=byId("studioIcon").value.slice(0,8);
 design.icons[selected.key]=value;selected.element.textContent=value;
});
byId("studioIcons").addEventListener("click",e=>{
 const icon=e.target.closest("[data-icon]");
 if(!icon)return;
 if(selected?.type!=="icon")return status("Selecciona primero un icono en la página.");
 byId("studioIcon").value=icon.dataset.icon;
 byId("studioIcon").dispatchEvent(new Event("input"));
});
function save(){
 try{
  const value=JSON.stringify(design);
  if(value.length>250000)throw Error("Borrador demasiado grande");
  localStorage.setItem(KEY,value);status("Diseño guardado en este navegador. No publicado.");
 }catch(e){status("No se pudo guardar localmente: "+e.message);}
}
byId("save").addEventListener("click",save);
function reset(){
 design=structuredClone(defaults);selected=null;
 try{localStorage.removeItem(KEY)}catch{}
 byId("studioSelection").textContent="Ningún elemento seleccionado";
 byId("studioIcon").disabled=true;byId("studioIcon").value="";
 sync();frame.src="/espejo/?admin_embed=1#"+page();
 status("Plantilla original restaurada sin alterar la web pública.");
}
byId("studioResetDesign").addEventListener("click",()=>{
 if(confirm("¿Restaurar el diseño original de este laboratorio?"))reset();
});
window.addEventListener("bf-studio-reset",reset);
})();
</script><script nonce="__NONCE__">
(()=>{"use strict";
const panel=document.getElementById("controls"),body=document.body;
const iconFor={pages:"▤",templates:"◈",header:"☰",hero:"▣",media:"◉",sections:"↕",basic:"✧",text:"✎",save:"✓"};
const labels={pages:"Páginas de la web",templates:"Plantillas completas",header:"Barra superior y menú",
 hero:"Inicio, ventanas y tarjetas",media:"Logos, imágenes e iconos",sections:"Secciones y orden",
 basic:"Acabados adicionales",text:"Editar textos",save:"Borrador y restauración"};
function makeFold(id,title,expanded=false){
 const details=document.createElement("details");details.className="lab-accordion";
 details.dataset.panel=id;details.open=expanded;
 const summary=document.createElement("summary");
 summary.textContent=iconFor[id]+"  "+(title||labels[id]);summary.setAttribute("aria-label",title||labels[id]);
 const content=document.createElement("div");content.className="lab-accordion-body";
 details.append(summary,content);
 details.addEventListener("toggle",()=>{
  if(details.open){
   for(const other of panel.querySelectorAll(".lab-accordion"))
    if(other!==details&&other.open)other.open=false;
  }
 });
 return {details,content};
}
const groups=Array.from(panel.querySelectorAll(".studio-advanced > .studio-group"));
const advancedPanels=["templates","header","hero","media","sections"];
for(let i=0;i<groups.length;i++){
 const group=groups[i],id=advancedPanels[i];if(!id)continue;
 const h=group.querySelector(":scope > h2");
 const {details,content}=makeFold(id,labels[id]);
 if(h)h.remove();
 while(group.firstChild)content.append(group.firstChild);
 group.replaceWith(details);
}
function wrapHead(title,id,open=false){
 const heading=Array.from(panel.querySelectorAll(":scope > h2")).find(el=>el.textContent.trim()===title);
 if(!heading)return;
 const {details,content}=makeFold(id,labels[id],open);
 let next=heading.nextSibling;
 while(next){
  if(next.nodeType===1&&(next.matches("h2")||next.matches(".studio-advanced")||next.matches(".lab-accordion")))break;
  const after=next.nextSibling;content.append(next);next=after;
 }
 heading.replaceWith(details);
}
wrapHead("Páginas","pages",true);
wrapHead("Acabados básicos (opcional)","basic");
wrapHead("Edición de textos","text");
wrapHead("Borrador","save");
// A single, always-visible Save action: no long scroll required.
const save=document.getElementById("save");
if(save){
 const quick=document.createElement("div");quick.className="lab-quick-actions";
 quick.setAttribute("role","group");quick.setAttribute("aria-label","Guardar borrador");
 quick.append(save);panel.append(quick);
}
const head=document.createElement("div");head.className="lab-sidebar-heading";
const title=document.createElement("strong");title.textContent="EDITOR BELLAQUITAS";
const close=document.createElement("button");close.type="button";
close.className="lab-sidebar-close";close.textContent="×";close.setAttribute("aria-label","Cerrar panel lateral");
head.append(title,close);panel.prepend(head);
const pages=document.querySelector('#pages [data-page="/"]');
if(pages)pages.textContent="Portada web";
function closeMenus(){
 body.classList.remove("menu-open","lab-sim-mobile-open");
 const trigger=document.getElementById("labOpenEditor");
 if(trigger)trigger.setAttribute("aria-expanded","false");
}
function openDrawer(){
 if(window.matchMedia("(max-width:800px)").matches)body.classList.add("menu-open");
 else body.classList.add("lab-sim-mobile-open");
 document.getElementById("labOpenEditor")?.setAttribute("aria-expanded","true");
}
document.getElementById("labOpenEditor")?.addEventListener("click",()=>{
 if(body.classList.contains("lab-sim-mobile-open")||body.classList.contains("menu-open"))closeMenus();
 else openDrawer();
});
document.getElementById("drawer")?.setAttribute("aria-controls","controls");
close.addEventListener("click",closeMenus);
document.getElementById("drawerBg")?.addEventListener("click",closeMenus);
document.addEventListener("keydown",ev=>{if(ev.key==="Escape")closeMenus()});
window.bfLabOpen=(id,kind)=>{
 const fold=panel.querySelector('.lab-accordion[data-panel="'+id+'"]');
 if(!fold)return;
 fold.open=true;
 if(id==="media"){
  document.querySelector(".studio-advanced")?.setAttribute("data-inspector",kind==="icon"?"icon":"image");
 }
 fold.scrollIntoView({block:"nearest"});
 if(window.matchMedia("(max-width:800px)").matches||body.classList.contains("lab-sim-mobile"))openDrawer();
 if(id==="media"&&kind==="icon"){
  const input=document.getElementById("studioIcon");
  if(input&&!input.disabled)input.focus({preventScroll:true});
 }
};
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
 const sameOriginFrame=url.searchParams.get("admin_embed")==="1";
 const nonce=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(18))));
 const headers={
  "Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store",
  "X-Robots-Tag":"noindex,nofollow","X-Content-Type-Options":"nosniff",
  "Referrer-Policy":"no-referrer","X-Frame-Options":sameOriginFrame?"SAMEORIGIN":"DENY",
  "Content-Security-Policy":"default-src 'none'; frame-src 'self'; script-src 'nonce-"+nonce+"'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors "+(sameOriginFrame?"'self'":"'none'")+""
 };
 return new Response(request.method==="HEAD"?null:HTML.replaceAll("__NONCE__",nonce),{status:200,headers});
}
