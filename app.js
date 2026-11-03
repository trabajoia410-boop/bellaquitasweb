/* Bellaquitas Fest — interfaz pública y cuentas reales con Supabase.
   La autorización y los permisos se verifican en el servidor mediante RLS. */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const H = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = n => Intl.NumberFormat('es-ES').format(Number(n)||0);
const cfg = window.BELLAQUITAS_CONFIG || {};
const live = !!(cfg.supabaseUrl && cfg.supabaseAnonKey);
// Al actualizar, descarta únicamente las fichas y sesiones locales antiguas de prueba.
const LEGACY_LOCAL_KEYS = [
  'bellaquitas_fest_demo_v2', 'bellaquitas_fest_session_v2',
  'bellaquitas_fest_demo_v3', 'bellaquitas_fest_session_v3'
];
function clearOldLocalData(){
  try { for(const key of LEGACY_LOCAL_KEYS) localStorage.removeItem(key); }
  catch(err){ console.warn('No se pudo limpiar el almacenamiento anterior:', err); }
}
function emptyData(){ return {profiles:[],events:[],rewards:[],promos:[],redemptions:[],activity:[],site_content:[],site_drafts:[]}; }
const tier = pts => pts>=2000?'Black':pts>=900?'VIP':pts>=500?'Gold':'Member';
const tierNext = pts => pts>=2000?null:[500,900,2000].find(v=>pts<v);
let sb = null, session = null, data = emptyData(), current = null;
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredInstallPrompt=event;});
window.addEventListener('appinstalled',()=>{deferredInstallPrompt=null;toast('Bellaquitas Fest se ha instalado correctamente.');});
window.addEventListener('offline',()=>toast('Sin conexión. Para guardar cambios o iniciar sesión necesitas Internet.'));
window.addEventListener('online',()=>toast('Conexión recuperada. Puedes continuar.'));
async function installApp(){
  if(window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone){toast('Ya estás utilizando Bellaquitas Fest como aplicación.');return;}
  if(deferredInstallPrompt){const prompt=deferredInstallPrompt;deferredInstallPrompt=null;await prompt.prompt();await prompt.userChoice;return;}
  const dialog=document.getElementById('install-guide');
  if(dialog&&typeof dialog.showModal==='function')dialog.showModal();
  else window.alert('iPhone: abre Safari, pulsa Compartir y Añadir a pantalla de inicio. Android: abre Chrome y pulsa Instalar aplicación en el menú.');
}
if('serviceWorker' in navigator && /^https?:$/.test(location.protocol)){
  window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(err=>console.warn('Instalación PWA no disponible:',err)));
}
let authTab = 'login', authNotice = '', adminTab='summary', adminEditId=null, adminFormOpen=false, search='', scanner=null, scanLoop=null, noticeTimer=null, menuOpen=false;
const AUTH_ROUTES = {'/acceso':'login','/iniciar-sesion':'login','/registro':'signup','/recuperar':'recover','/restablecer':'reset'};
function authRedirectUrl(recovery=false){const url=new URL(window.location.href);url.hash='';url.search='';if(recovery)url.searchParams.set('recuperar','1');return url.toString();}
// El retorno de Google identifica el flujo sin guardar contraseñas ni tokens en la URL.
function googleRedirectUrl(){const url=new URL(authRedirectUrl());url.searchParams.set('acceso','google');return url.toString();}
function cleanGoogleReturnUrl(){const url=new URL(window.location.href);for(const key of ['acceso','code','error','error_code','error_description'])url.searchParams.delete(key);history.replaceState(null,'',url.pathname+url.search+url.hash);}
function destinationForUser(){return current?.role==='admin'?'/panel':current?.role==='puerta'?'/puerta':'/mi-espacio';}
function formFeedback(message){const box=$('#auth-feedback');if(!box)return;box.textContent=message;box.hidden=!message;}
function clearRecoveryUrl(){const url=new URL(window.location.href);url.searchParams.delete('recuperar');url.searchParams.delete('code');history.replaceState(null,'',url.pathname+url.search+url.hash);}

let route = location.hash.slice(1) || '/';
const ico = {editor:'✎', home:'⌂', card:'◈', rewards:'✦', events:'▦', profile:'♙', gate:'◎', admin:'▥', logout:'↪'};
const byDate = (a,b) => String(b.created_at||b.date||'').localeCompare(String(a.created_at||a.date||''));
function getProfile(id) { return data.profiles.find(p=>p.id===id); }
function getReward(id) { return data.rewards.find(r=>r.id===id); }
// Los cambios publicados se leen de site_content; los borradores tienen su propia tabla privada.
const SITE_DEFAULTS = {
  theme:'classic', logo_url:'',
  nav_experience:'Experiencia', nav_events:'Eventos', nav_benefits:'Ventajas', nav_faq:'Preguntas',
  hero_eyebrow:'UNA COMUNIDAD. UNA EXPERIENCIA.', hero_title_a:'VIVE EL', hero_title_b:'MOMENTO.',
  hero_text:'Bellaquitas Fest es mucho más que un evento. Descubre experiencias, guarda tus momentos y disfruta de ventajas por formar parte de nuestra comunidad.',
  hero_primary:'Crear cuenta', hero_secondary:'Iniciar sesión',
  hero_stat_1:'Una comunidad',hero_stat_2:'Momentos por vivir',hero_stat_3:'Ventajas para socios',
  announcement_brand:'BELLAQUITAS FEST',announcement:'Tu tarjeta, tus puntos, tus experiencias.',
  experience_eyebrow:'LA EXPERIENCIA',experience_title:'Todo empieza contigo.',experience_desc:'Una nueva forma de disfrutar de todo lo que ocurre en Bellaquitas Fest.',
  feature_1_title:'Tu propio espacio', feature_1_desc:'Accede a tu cuenta, consulta tu tarjeta digital y lleva tu historial siempre contigo.',
  feature_2_title:'Puntos y ventajas', feature_2_desc:'Acumula puntos por actividades validadas y descubre recompensas pensadas para ti.',
  feature_3_title:'Experiencias', feature_3_desc:'Descubre las próximas novedades y actividades de la comunidad.',
  events_eyebrow:'EVENTOS PUBLICADOS',events_title:'Próximos encuentros.', events_desc:'Descubre los eventos que ha publicado nuestro equipo.',
  events_empty_title:'Lo que está por venir.',events_empty_desc:'Las fechas definitivas se anunciarán cuando estén confirmadas.',
  benefits_eyebrow:'BELLAQUITAS CLUB',benefits_title:'Ser parte tiene premio.',benefits_desc:'Una tarjeta digital para tu comunidad y sus ventajas.',
  benefits_card_eyebrow:'TU TARJETA DIGITAL',benefits_card_title:'Todo en una tarjeta.',benefits_card_desc:'Tu código de socio, tus puntos y tus ventajas reunidos en un mismo lugar.',benefits_card_button:'Acceder a mi tarjeta',
  benefit_1_title:'Acumula puntos', benefit_1_desc:'Consigue puntos por participaciones autorizadas y visitas registradas.',
  benefit_2_title:'Sube de categoría', benefit_2_desc:'Member, Gold, VIP y Black: cada etapa reconoce tu participación.',
  benefit_3_title:'Canjea recompensas',benefit_3_desc:'Explora el catálogo y solicita los premios disponibles.',
  benefit_4_title:'Acceso personal',benefit_4_desc:'Las herramientas de gestión están reservadas a las cuentas autorizadas.',
  faq_eyebrow:'RESOLVEMOS TUS DUDAS',faq_title:'Preguntas frecuentes.',
  faq_1_q:'¿Cómo consigo mi tarjeta?',faq_1_a:'Entra en tu cuenta de socio para encontrar tu identificador y, cuando corresponda, el QR.',
  faq_2_q:'¿Cómo se suman los puntos?',faq_2_a:'Se suman al validar una visita o actividad, según las reglas de la comunidad.',
  faq_3_q:'¿Dónde veo mis recompensas?',faq_3_a:'Desde tu cuenta puedes consultar el catálogo y solicitar tus canjes.',
  faq_4_q:'¿Puede todo el mundo abrir el panel?',faq_4_a:'No. Las herramientas de puerta y administración aparecen únicamente en los perfiles autorizados.',
  cta_eyebrow:'¿YA FORMAS PARTE?',cta_title:'Tu lugar está aquí.',cta_desc:'Accede a tu espacio personal y descubre todas tus ventajas.',cta_button:'Iniciar sesión',
  footer_desc:'Experiencias que conectan.',
  visible:{experience:true,events:true,benefits:true,faq:true,cta:true},
  order:['experience','events','benefits','faq','cta']
};
const EDITOR_SECTIONS = {experience:'Experiencia',events:'Eventos',benefits:'Ventajas',faq:'Preguntas',cta:'Invitación final'};
const SITE_FIELDS = {
  main:[['hero_eyebrow','Frase pequeña de arriba'],['hero_title_a','Primera línea del título'],['hero_title_b','Segunda línea del título'],['hero_text','Texto de presentación','textarea'],['hero_primary','Botón principal'],['hero_secondary','Segundo botón'],['hero_stat_1','Etiqueta 1'],['hero_stat_2','Etiqueta 2'],['hero_stat_3','Etiqueta 3'],['announcement_brand','Nombre de la banda'],['announcement','Frase de la banda'],['logo_url','Imagen principal / logotipo (URL segura)','image']],
  experience:[['experience_eyebrow','Texto pequeño'],['experience_title','Título'],['experience_desc','Descripción','textarea'],['feature_1_title','Tarjeta 1 · título'],['feature_1_desc','Tarjeta 1 · texto','textarea'],['feature_2_title','Tarjeta 2 · título'],['feature_2_desc','Tarjeta 2 · texto','textarea'],['feature_3_title','Tarjeta 3 · título'],['feature_3_desc','Tarjeta 3 · texto','textarea']],
  events:[['events_eyebrow','Etiqueta cuando hay eventos'],['events_title','Título cuando hay eventos'],['events_desc','Descripción con eventos','textarea'],['events_empty_title','Título si no hay eventos'],['events_empty_desc','Descripción si no hay eventos','textarea']],
  benefits:[['benefits_eyebrow','Texto pequeño'],['benefits_title','Título'],['benefits_desc','Descripción','textarea'],['benefits_card_eyebrow','Tarjeta principal · etiqueta'],['benefits_card_title','Tarjeta principal · título'],['benefits_card_desc','Tarjeta principal · texto','textarea'],['benefits_card_button','Botón de la tarjeta'],['benefit_1_title','Ventaja 1 · título'],['benefit_1_desc','Ventaja 1 · texto','textarea'],['benefit_2_title','Ventaja 2 · título'],['benefit_2_desc','Ventaja 2 · texto','textarea'],['benefit_3_title','Ventaja 3 · título'],['benefit_3_desc','Ventaja 3 · texto','textarea'],['benefit_4_title','Ventaja 4 · título'],['benefit_4_desc','Ventaja 4 · texto','textarea']],
  faq:[['faq_eyebrow','Texto pequeño'],['faq_title','Título'],...Array.from({length:4},(_,i)=>[[`faq_${i+1}_q`,`Pregunta ${i+1}`],[`faq_${i+1}_a`,`Respuesta ${i+1}`,'textarea']]).flat()],
  cta:[['cta_eyebrow','Texto pequeño'],['cta_title','Título final'],['cta_desc','Texto de invitación','textarea'],['cta_button','Texto del botón']],
  other:[['nav_experience','Menú: Experiencia'],['nav_events','Menú: Eventos'],['nav_benefits','Menú: Ventajas'],['nav_faq','Menú: Preguntas'],['footer_desc','Pie de página · lema']]
};
let editorDraft=null,editorDirty=false,editorCategory='main',editorDevice='desktop',editorPreviewOverride=null,editorBusy=false;
function publishedSettings(){const row=data.site_content.find(x=>x.key==='homepage')||{};return {...SITE_DEFAULTS,hero_text:row.hero_text||SITE_DEFAULTS.hero_text,announcement:row.announcement||SITE_DEFAULTS.announcement,...(row.page_settings||{}),visible:{...SITE_DEFAULTS.visible,...(row.page_settings?.visible||{})},order:validOrder(row.page_settings?.order)};}
function validOrder(order){const keys=Object.keys(EDITOR_SECTIONS);return Array.isArray(order)?[...new Set(order.filter(x=>keys.includes(x))),...keys.filter(x=>!order.includes(x))]:keys;}
function settings(){return editorPreviewOverride||publishedSettings();}
function siteText(field, fallback=''){const value=settings()[field];return typeof value==='string'?value:(fallback||SITE_DEFAULTS[field]||'');}
function showSection(key){return settings().visible?.[key]!==false;}
function siteImage(){return safeImage(siteText('logo_url'))||'assets/logo-bellaquitas.webp';}
function eventDate(value,time){if(!value)return 'Fecha por confirmar';const iso=/^\d{4}-\d{2}-\d{2}$/.test(value);const friendly=iso?new Date(value+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'}):value;return friendly+(time?' · '+String(time).slice(0,5):'');}
function safeImage(url){const v=String(url||'');return /^https:\/\//i.test(v)?v:'';}
function adminMeta(table,x){return table==='events'?eventDate(x.date_label,x.start_time)+' · '+x.location:table==='rewards'?`${fmt(x.cost)} puntos · ${x.category}`:`+${fmt(x.bonus)} puntos`;}
function adminLabel(table){return {events:'evento',rewards:'premio',promos:'promoción'}[table]||'contenido';}
function focusAdminForm(){requestAnimationFrame(()=>document.getElementById('admin-item-form')?.querySelector('input[name="name"]')?.focus());}
function recentDate(d) { try {return new Date(d).toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'numeric'});}catch {return '—';} }
function toast(message) {const el=$('#toast'); if(!el)return;clearTimeout(noticeTimer);el.textContent=message;el.classList.add('show');noticeTimer=setTimeout(()=>el.classList.remove('show'),4000);}
function header(){
 const preview=!!editorPreviewOverride;
 const authActions=current&&!preview?`<a href="#${current.role==='admin'?'/panel':'/mi-espacio'}" class="btn btn-secondary btn-mini">${current.role==='admin'?'Panel':'Mi espacio'}</a>${current.role==='admin'?'<a href="#/editor" class="btn btn-primary btn-mini admin-edit-top">✎ Editar web</a>':''}`:`<a href="#/acceso" class="btn btn-secondary btn-mini">Iniciar sesión</a><a href="#/registro" class="btn btn-primary btn-mini">Crear cuenta ↗</a>`;
 const nav=[['experience','experiencia','nav_experience'],['events','eventos','nav_events'],['benefits','ventajas','nav_benefits'],['faq','preguntas','nav_faq']].filter(([key])=>showSection(key)).map(([,path,label])=>`<a class="nav-link" href="#/${path}">${H(siteText(label))}</a>`).join('');
 const menuAccount=current&&!preview?`<a class="btn btn-secondary" href="#${destinationForUser()}">Mi cuenta</a>${current.role==='admin'?'<a class="btn btn-primary" href="#/editor">✎ Editar web</a>':''}`:'<a class="btn btn-secondary" href="#/acceso">Iniciar sesión</a><a class="btn btn-primary" href="#/registro">Crear cuenta</a>';
 return `<header class="site-header"><div class="container nav-wrap"><a class="brand" href="#/" aria-label="Bellaquitas Fest, inicio"><span class="brand-symbol">♛</span><span>BELLAQUITAS <em>FEST</em></span></a><nav id="site-menu" class="main-nav ${menuOpen?'open':''}" aria-label="Navegación principal"><a class="nav-link" href="#/">Inicio</a>${nav}<div class="mobile-menu-actions">${menuAccount}</div><button type="button" class="menu-install" data-action="install-app">📲 Instalar la app</button></nav><div class="nav-actions">${authActions}<button class="btn btn-secondary btn-mini menu-toggle" type="button" data-action="menu" aria-controls="site-menu" aria-expanded="${menuOpen}" aria-label="${menuOpen?'Cerrar menú':'Abrir menú'}">${menuOpen?'✕':'☰'}</button></div></div></header>`;
}
function footer(){return `<footer class="footer"><div class="container footer-flex"><div class="brand"><span class="brand-symbol">♛</span>BELLAQUITAS <em>FEST</em></div><p>© ${new Date().getFullYear()} Bellaquitas Fest. ${H(siteText('footer_desc'))}</p><p>${showSection('faq')?'<a href="#/preguntas">Preguntas frecuentes</a> · ':''}<a href="#/acceso">Iniciar sesión</a> · <a href="#/registro">Crear cuenta</a></p><button type="button" class="footer-install" data-action="install-app">📲 Instalar la app</button></div></footer>`;}
function publicEvents(limit=3){return data.events.filter(x=>x.active).sort((a,b)=>(a.date_label||'9999').localeCompare(b.date_label||'9999')).slice(0,limit).map((e,i)=>`<article class="event-card">${safeImage(e.image_url)?`<img class="event-photo" src="${H(safeImage(e.image_url))}" alt="Imagen de ${H(e.name)}" loading="lazy"/>`:``}<div class="event-top"><span class="pill"><span class="dot"></span> ${H(eventDate(e.date_label,e.start_time))}</span><span class="event-num">0${i+1}</span></div><h3>${H(e.name)}</h3><p>${H(e.description)}</p><div class="event-meta"><span>📍 ${H(e.location)}</span></div></article>`).join('')||'<p class="empty">No hay eventos publicados por ahora.</p>';}
function landing(){
 const txt=k=>H(siteText(k));
 const hasEvents=data.events.some(x=>x.active);
 const blocks={
  experience:`<section class="section" id="experiencia"><div class="container"><div class="section-head"><div><span class="eyebrow">${txt('experience_eyebrow')}</span><h2>${txt('experience_title')}</h2><p>${txt('experience_desc')}</p></div></div><div class="three-grid">${[1,2,3].map((n)=>`<article class="feature"><div class="feature-icon">${['♛','✧','▦'][n-1]}</div><h3>${txt('feature_'+n+'_title')}</h3><p>${txt('feature_'+n+'_desc')}</p></article>`).join('')}</div></div></section>`,
  events:`<section class="section" id="eventos"><div class="container"><div class="section-head"><div><span class="eyebrow">${hasEvents?txt('events_eyebrow'):'PRÓXIMAMENTE'}</span><h2>${hasEvents?txt('events_title'):txt('events_empty_title')}</h2><p>${hasEvents?txt('events_desc'):txt('events_empty_desc')}</p></div><a class="btn btn-secondary btn-mini" href="#/acceso">Ver en mi cuenta ↗</a></div><div class="three-grid">${publicEvents()}</div></div></section>`,
  benefits:`<section class="section" id="ventajas"><div class="container"><div class="section-head"><div><span class="eyebrow">${txt('benefits_eyebrow')}</span><h2>${txt('benefits_title')}</h2><p>${txt('benefits_desc')}</p></div></div><div class="benefit-grid"><div class="big-benefit"><div class="eyebrow">${txt('benefits_card_eyebrow')}</div><div class="card-gold"><strong>♛ BELLAQUITAS</strong><span>MEMBER CLUB</span></div><h3>${txt('benefits_card_title')}</h3><p>${txt('benefits_card_desc')}</p><a href="#/acceso" class="btn btn-primary">${txt('benefits_card_button')} ↗</a></div><div class="list-benefits">${[1,2,3,4].map(n=>`<div class="benefit-item"><div class="round-icon">${['✦','♛','🎁','◎'][n-1]}</div><div><strong>${txt('benefit_'+n+'_title')}</strong><p>${txt('benefit_'+n+'_desc')}</p></div></div>`).join('')}</div></div></div></section>`,
  faq:`<section class="section" id="preguntas"><div class="container"><div class="section-head"><div><span class="eyebrow">${txt('faq_eyebrow')}</span><h2>${txt('faq_title')}</h2></div></div><div class="faq-list">${[1,2,3,4].map(n=>`<div class="faq-card"><h3>${txt('faq_'+n+'_q')}</h3><p>${txt('faq_'+n+'_a')}</p></div>`).join('')}</div></div></section>`,
  cta:`<section class="section" id="unete" style="padding-top:15px"><div class="container"><div class="cta-banner"><div><div class="eyebrow">${txt('cta_eyebrow')}</div><h2>${txt('cta_title')}</h2><p>${txt('cta_desc')}</p></div><a href="#/acceso" class="btn btn-primary">${txt('cta_button')} ↗</a></div></div></section>`
 };
 const blockHTML=validOrder(settings().order).filter(k=>showSection(k)).map(k=>`<div class="line"></div>${blocks[k]}`).join('');
 return `${header()}<main><section class="hero" id="inicio"><div class="container hero-inner"><div class="hero-copy"><div class="eyebrow">✦ ${txt('hero_eyebrow')}</div><h1>${txt('hero_title_a')}<br/><span>${txt('hero_title_b')}</span></h1><p>${txt('hero_text')}</p><div class="hero-cta"><a class="btn btn-primary" href="#/registro">${txt('hero_primary')} <span>↗</span></a><a class="btn btn-ghost" href="#/acceso">${txt('hero_secondary')} <span>→</span></a></div><div class="hero-stats"><div class="hero-stat"><strong>01</strong><span>${txt('hero_stat_1')}</span></div><div class="hero-stat"><strong>∞</strong><span>${txt('hero_stat_2')}</span></div><div class="hero-stat"><strong>✦</strong><span>${txt('hero_stat_3')}</span></div></div></div><div class="hero-art"><img class="hero-emblem" src="${H(siteImage())}" alt="Imagen de Bellaquitas Fest"/><div class="floating-tag a"><b>✦ BELLAQUITAS CLUB</b> Tu espacio personal</div><div class="floating-tag b"><b>♛ MEMBER EXPERIENCE</b> Momentos que cuentan</div></div></div></section><div class="announce"><span>✦ ${txt('announcement_brand')}</span> &nbsp; · &nbsp; ${txt('announcement')}</div>${blockHTML}</main>${footer()}`;
}
function auth(){
  const titles={login:'Inicia sesión.',signup:'Crea tu cuenta.',recover:'Recupera tu acceso.',reset:'Elige una contraseña nueva.'};
  const intro={login:'Accede a tu tarjeta y a tu espacio personal.',signup:'Regístrate para empezar con tu propia cuenta de Bellaquitas Fest.',recover:'Te enviaremos un enlace para restablecer la contraseña.',reset:'Escribe tu nueva contraseña para recuperar el acceso.'};
  const unavailable=!live?'<div class="info-note" role="status">El formulario está preparado, pero aún falta conectar el servicio de usuarios. El propietario debe configurar Supabase para activar las cuentas reales.</div>':'';
  const off=!live?' disabled aria-disabled="true" title="Pendiente de configurar el servicio de cuentas"':'';
  const tabs=authTab==='reset'?'':`<nav class="switch-row" aria-label="Acceso a cuentas"><a href="#/acceso" class="${authTab==='login'?'active':''}" ${authTab==='login'?'aria-current="page"':''}>Iniciar sesión</a><a href="#/registro" class="${authTab==='signup'?'active':''}" ${authTab==='signup'?'aria-current="page"':''}>Crear cuenta</a></nav>`;
  const field=(id,label,name,type,complete,min,extra='')=>`<div class="field"><label for="${id}">${label}</label><input id="${id}" name="${name}" type="${type}" autocomplete="${complete}" ${min?'minlength="8"':''} ${extra} required /></div>`;
  let fields='';
  if(authTab==='reset'){
    fields=field('auth-password','Nueva contraseña','password','password','new-password',true)+field('auth-confirm','Repetir contraseña','confirmPassword','password','new-password',true);
  }else{
    if(authTab==='signup')fields+=`<div class="field"><label for="auth-name">Nombre</label><input id="auth-name" name="name" type="text" autocomplete="name" minlength="2" maxlength="80" required /></div>`;
    fields+=`<div class="field"><label for="auth-email">Correo electrónico</label><input id="auth-email" name="email" type="email" autocomplete="email" inputmode="email" maxlength="254" required /></div>`;
    if(authTab!=='recover'){
      fields+=field('auth-password','Contraseña','password','password',authTab==='signup'?'new-password':'current-password',true);
      if(authTab==='signup')fields+=field('auth-confirm','Repetir contraseña','confirmPassword','password','new-password',true);
    }
  }
  const labels={login:'Iniciar sesión',signup:'Registrar mi cuenta',recover:'Enviar enlace de recuperación',reset:'Guardar nueva contraseña'};
  const extras={login:'¿Has olvidado tu contraseña? <a class="login-link" href="#/recuperar">Recupérala aquí</a>.',signup:'Recibirás un correo para confirmar tu cuenta si está activada la verificación de email.',recover:'¿Ya recuerdas tus datos? <a class="login-link" href="#/acceso">Volver a iniciar sesión</a>.',reset:'Después de cambiarla, inicia sesión de nuevo.'};
  const social=['login','signup'].includes(authTab)?`<div class="auth-social"><button class="btn google-signin" type="button" data-action="google-login"${off}><img src="assets/google-g.svg" width="21" height="21" alt="" aria-hidden="true"/><span class="google-label">Continuar con Google</span></button><div class="auth-divider"><span>o continúa con correo electrónico</span></div></div>`:'';
  const form=`<form id="auth-form">${fields}<button class="btn btn-primary auth-submit" type="submit"${off}>${labels[authTab]} ↗</button><p class="form-note">${extras[authTab]}</p><p id="auth-feedback" class="auth-feedback" role="alert" hidden></p></form>`;
  return `${header()}<main class="auth-layout"><div class="auth-art"><img src="assets/logo-bellaquitas.webp" alt="Logotipo Bellaquitas Fest"/><div class="auth-quote">Una comunidad. Tu espacio.</div></div><div class="auth-main"><div class="auth-panel"><div class="eyebrow">BELLAQUITAS CLUB</div><h1>${titles[authTab]}</h1><p>${intro[authTab]}</p>${tabs}${unavailable}${authNotice?`<div class="auth-notice" role="status">${H(authNotice)}</div>`:''}${social}${form}<p class="small muted" style="margin-top:25px">← <a class="login-link" href="#/">Volver a la web pública</a></p></div></div></main>`;
}
function roleLabel(role){return role==='admin'?'Administración':role==='puerta'?'Personal de puerta':'Socio/a';}
function allowed(path){if(!current) return false;if(path==='/panel'||path==='/editor')return current.role==='admin';if(path==='/puerta')return ['puerta','admin'].includes(current.role);return ['/mi-espacio','/tarjeta','/premios','/agenda','/perfil'].includes(path);}
function appShell(content){
  const memberLinks=[['/mi-espacio','home','Mi espacio'],['/tarjeta','card','Mi tarjeta'],['/premios','rewards','Premios'],['/agenda','events','Eventos'],['/perfil','profile','Perfil']];
  const links=current.role==='admin'?[['/panel','admin','Panel administrador'],['/editor','editor','Editar web'],['/puerta','gate','Puerta'],...memberLinks]:current.role==='puerta'?[...memberLinks,['/puerta','gate','Puerta']]:memberLinks;
  const mobileLinks=current.role==='admin'?[links[0],links[1],memberLinks[0],memberLinks[3],memberLinks[4]]:current.role==='puerta'?[memberLinks[0],memberLinks[1],memberLinks[2],memberLinks[3],links[5]]:memberLinks;
  const side=links.map(([url,ic,label])=>`<a href="#${url}" class="side-link ${route===url?'active':''}"><span class="ico">${ico[ic]}</span>${label}</a>`).join('');
  const mobile=mobileLinks.map(([url,ic,label])=>`<a href="#${url}" class="${route===url?'active':''}"><span class="ico">${ico[ic]}</span>${label==='Panel administrador'?'Panel':label==='Mi espacio'?'Inicio':label==='Mi tarjeta'?'Tarjeta':label}</a>`).join('');
  return `<div class="app-shell"><aside class="sidebar"><div class="side-head"><a class="brand" href="#${current.role==='admin'?'/panel':'/mi-espacio'}"><span class="brand-symbol">♛</span><span>BELLAQUITAS <em>FEST</em></span></a></div><div class="side-group"><div class="side-caption">${current.role==='admin'?'Administración':'Mi comunidad'}</div>${side}</div><div class="side-bottom"><div class="side-profile"><span class="avatar">${H(current.name.split(' ').map(x=>x[0]).slice(0,2).join(''))}</span><span><b>${H(current.name)}</b><small>${roleLabel(current.role)}</small></span></div><button class="btn btn-secondary btn-mini" style="width:100%" type="button" data-action="logout">${ico.logout} Cerrar sesión</button></div></aside><main class="app-main"><div class="app-top"><div class="app-page"><a href="#${current.role==='admin'?'/panel':'/mi-espacio'}" class="gold">${current.role==='admin'?'Panel administrador':'Bellaquitas Club'}</a> &nbsp; / &nbsp; <b>${H(route.replace('/','')||'inicio')}</b></div><div class="app-top-right">${current.role==='admin'?'<a class="btn btn-primary btn-mini" href="#/editor">✎ Editar web</a>':''}<span class="pill"><span class="dot"></span>Cuenta activa</span><button type="button" class="btn btn-secondary btn-mini" data-action="logout">Salir ↪</button></div></div>${content}</main><nav class="mobile-appbar" aria-label="Menú de cuenta">${mobile}</nav></div>`;
}
const pageHead=(title,sub,eyebrow='TU ESPACIO')=>`<div class="app-header"><div class="eyebrow">${H(eyebrow)}</div><h1>${H(title)}</h1><p>${H(sub)}</p></div>`;
function summary(){const next=tierNext(current.lifetime_points);const progress=next?Math.min(100,Math.round(current.lifetime_points/next*100)):100;const events=data.events.filter(e=>e.active).sort((a,b)=>(a.date_label||'9999').localeCompare(b.date_label||'9999')).slice(0,3);const rewardList=data.rewards.filter(r=>r.active).slice(0,3);return `${pageHead(`Hola, ${current.name.split(' ')[0]} ✦`,'Aquí tienes todo lo que ocurre en tu comunidad.','BELLAQUITAS MEMBER')}<div class="dash-grid"><div><div class="points-banner"><div><div class="eyebrow">TUS PUNTOS DISPONIBLES</div><div class="points-number">${fmt(current.points)}</div><p>Puntos para canjear en tus próximos premios.</p><a href="#/premios" class="btn btn-primary btn-mini">Explorar premios ↗</a></div><div class="points-symbol">✦</div></div><div class="metric-row"><div class="metric"><strong>${fmt(current.visits)}</strong><span>Visitas</span></div><div class="metric"><strong>${H(tier(current.lifetime_points))}</strong><span>Tu nivel</span></div><div class="metric"><strong>${fmt(current.lifetime_points)}</strong><span>Puntos históricos</span></div></div><div class="pane section-gap"><div class="section-title"><h2>Próximas experiencias</h2><a class="link-tiny" href="#/agenda">Ver todas ↗</a></div><div class="mini-list">${events.length?events.map(e=>`<div class="mini-item"><div class="mini-left"><span class="mini-glyph">▦</span><div><strong>${H(e.name)}</strong><small>${H(eventDate(e.date_label,e.start_time))} · ${H(e.location)}</small></div></div><span class="gold">↗</span></div>`).join(''):'<div class="empty">Próximamente</div>'}</div></div></div><div><div class="pane"><div class="section-title"><h2>Tu categoría</h2><span class="pill">♛ ${H(tier(current.lifetime_points))}</span></div><div style="font:900 2rem Outfit;color:var(--gold)">${next?'Hacia '+tier(next):'Nivel máximo'}</div><p class="muted small">${next?`${fmt(next-current.lifetime_points)} puntos históricos para el próximo nivel.`:'Has alcanzado la categoría más alta.'}</p><div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div><div class="progress-label"><span>${fmt(current.lifetime_points)} puntos</span><span>${next?fmt(next):'★'}</span></div><a class="btn btn-secondary btn-mini" style="margin-top:20px" href="#/tarjeta">Ver mi tarjeta ↗</a></div><div class="pane section-gap"><div class="section-title"><h2>Recompensas destacadas</h2><a class="link-tiny" href="#/premios">Catálogo ↗</a></div><div class="mini-list">${rewardList.map(r=>`<div class="mini-item"><div class="mini-left"><span class="mini-glyph">${H(r.symbol||'✦')}</span><div><strong>${H(r.name)}</strong><small>${fmt(r.cost)} puntos</small></div></div><span class="gold">↗</span></div>`).join('')||'<div class="empty">No hay recompensas disponibles.</div>'}</div></div></div></div><div class="pane section-gap"><div class="section-title"><h2>Promociones activas</h2><span class="muted small">Información para socios</span></div><div class="mini-list">${data.promos.filter(p=>p.active).map(p=>`<div class="mini-item"><div class="mini-left"><span class="mini-glyph">✦</span><div><strong>${H(p.name)}</strong><small>${H(p.description)}</small></div></div><span class="pill">+${fmt(p.bonus)} pts</span></div>`).join('')||'<div class="empty">No hay promociones activas.</div>'}</div><p class="muted small">Las bonificaciones requieren validación según sus condiciones; no se conceden automáticamente desde esta pantalla.</p></div>`;}
function card(){return `${pageHead('Tu tarjeta de socio','Tu identificación digital para las actividades de la comunidad.','MI IDENTIDAD')}<div class="member-info"><div><div class="card-member"><div class="card-brand">♛ BELLAQUITAS <span>FEST</span></div><div class="card-tier">${H(tier(current.lifetime_points))}</div><div><strong>${H(current.name)}</strong><div class="card-code">${H(current.member_code)}</div></div></div><div class="pane section-gap"><h2>Cómo funciona</h2><p class="muted small">Muestra tu código a personal autorizado para validar una visita. No compartas capturas de tu tarjeta pública y libremente.</p><div class="mini-list"><div class="mini-item"><span class="small">Puntos disponibles</span><b class="gold">${fmt(current.points)}</b></div><div class="mini-item"><span class="small">Visitas registradas</span><b>${fmt(current.visits)}</b></div></div></div></div><div><div class="qr-box"><div class="eyebrow" style="margin-bottom:14px">TU CÓDIGO PERSONAL</div><div id="qr-code"><span class="muted small">Preparando QR…</span></div><p style="font-weight:900;letter-spacing:.12em">${H(current.member_code)}</p><p class="muted small">Si no se puede leer el QR, el personal puede introducir el código manualmente.</p><button class="btn btn-secondary btn-mini" type="button" data-action="copy-code">Copiar código</button></div></div></div>`;}
function rewards(){const items=data.rewards.filter(r=>r.active);const myRed=data.redemptions.filter(r=>r.user_id===current.id).sort(byDate);return `${pageHead('Premios y experiencias','Descubre qué puedes conseguir con tus puntos.','CATÁLOGO DE PREMIOS')}<div class="points-banner" style="min-height:140px;margin-bottom:22px"><div><div class="eyebrow">SALDO ACTUAL</div><div class="points-number" style="font-size:3.3rem">${fmt(current.points)} <span style="font-size:1.1rem;letter-spacing:0">pts</span></div></div><div class="points-symbol" style="font-size:5rem">✦</div></div><div class="reward-grid">${items.map(r=>`<article class="reward-card"><div class="reward-illus">${safeImage(r.image_url)?`<img class="reward-photo" src="${H(safeImage(r.image_url))}" alt="${H(r.name)}" loading="lazy"/>`:H(r.symbol||'✦')}</div><span class="eyebrow" style="margin-top:12px;font-size:.63rem">${H(r.category)}</span><h3>${H(r.name)}</h3><p>${H(r.description||'Recompensa de la comunidad.')}</p><div class="reward-foot"><strong>${fmt(r.cost)} pts</strong><button class="btn btn-primary btn-mini" data-action="redeem" data-id="${H(r.id)}" ${current.points<r.cost?'disabled title="Puntos insuficientes"':''}>${current.points<r.cost?'Faltan puntos':'Solicitar ↗'}</button></div></article>`).join('')||'<div class="empty">No hay recompensas publicadas por ahora.</div>'}</div><div class="pane section-gap"><div class="section-title"><h2>Mis solicitudes de canje</h2></div><div class="mini-list">${myRed.length?myRed.map(r=>`<div class="mini-item"><div><strong>${H(getReward(r.reward_id)?.name||'Premio')}</strong><small>${H(r.code)} · ${recentDate(r.created_at)}</small></div><span class="status ${r.status==='validado'?'ok':'pending'}">${H(r.status)}</span></div>`).join(''):'<div class="empty">Aún no has solicitado premios.</div>'}</div></div>`;}
function agenda(){return `${pageHead('Eventos y novedades','Descubre todo lo que está por venir.','AGENDA BELLAQUITAS')}<div class="three-grid">${publicEvents(Infinity)}</div>`;}
function profile(){return `${pageHead('Mi perfil','Gestiona los datos visibles de tu cuenta.','CUENTA PERSONAL')}<div class="pane profile-form"><form id="profile-form"><div class="field"><label>Nombre visible</label><input type="text" maxlength="80" minlength="2" name="name" value="${H(current.name)}" required /></div><div class="field"><label>Código de socio</label><input type="text" value="${H(current.member_code)}" disabled /></div><div class="field"><label>Tipo de cuenta</label><input type="text" value="${H(roleLabel(current.role))}" disabled /></div><button class="btn btn-primary" type="submit">Guardar cambios</button></form><p class="form-note" style="margin-top:18px">La categoría y el saldo no se pueden editar desde el perfil. Los gestiona el sistema autorizado.</p></div>`;}
function gate(){const members=data.profiles.filter(x=>x.role==='socio');const filtered=members.filter(p=>(p.name+' '+p.member_code).toLowerCase().includes(search.toLowerCase()));const pending=data.redemptions.filter(r=>r.status==='pendiente').sort(byDate);return `${pageHead('Control de acceso','Validación de socios y canjes desde una cuenta autorizada.','PERSONAL · PUERTA')}<div class="two-col"><div class="pane"><h2>Validar visita</h2><p class="muted small">Lee el QR de un socio o introduce su código de tarjeta.</p><form id="checkin-form" class="checkin-form"><input class="search-field" name="code" placeholder="Código del socio (MBR-...)" required /><button class="btn btn-primary" type="submit">Validar</button></form><div style="display:flex;gap:8px;margin-top:13px;flex-wrap:wrap"><button class="btn btn-secondary btn-mini" data-action="scan" type="button">◎ Activar cámara QR</button><button class="btn btn-ghost btn-mini" data-action="stop-scan" type="button">Detener cámara</button></div><div id="camera-wrap" class="camera-wrap"><video id="camera" muted playsinline></video><p>Apunta al QR del socio. Si no funciona, introduce el código manualmente.</p></div><div class="info-note">Por seguridad, una visita se valida una sola vez por día por socio.</div></div><div class="pane"><h2>Validar canje</h2><p class="muted small">Introduce el código de solicitud que muestra la cuenta del socio.</p><form class="checkin-form" id="validate-form"><input class="search-field" name="code" placeholder="Código CNJ-..." required /><button type="submit" class="btn btn-primary">Validar</button></form><div class="section-title" style="margin-top:26px"><h2>En espera (${pending.length})</h2></div><div class="mini-list">${pending.slice(0,6).map(r=>`<div class="mini-item"><div><strong>${H(getProfile(r.user_id)?.name||'Socio')} · ${H(getReward(r.reward_id)?.name||'Premio')}</strong><small>${H(r.code)}</small></div><button class="btn btn-secondary btn-mini" data-action="validate" data-code="${H(r.code)}">Validar</button></div>`).join('')||'<div class="empty">No hay canjes pendientes.</div>'}</div></div></div><div class="pane section-gap"><div class="section-title"><h2>Buscar socio</h2><span class="muted small">${filtered.length} resultados</span></div><div class="toolbar"><input type="search" class="search-field" id="member-search" placeholder="Buscar por nombre o código" value="${H(search)}" /></div><div class="data-table-wrap"><table class="data-table"><thead><tr><th>Nombre</th><th>Código</th><th>Categoría</th><th>Visitas</th><th>Acción</th></tr></thead><tbody>${filtered.map(p=>`<tr><td><b>${H(p.name)}</b></td><td>${H(p.member_code)}</td><td><span class="role-chip">${H(tier(p.lifetime_points))}</span></td><td>${fmt(p.visits)}</td><td><button class="btn btn-secondary btn-mini" data-action="checkin" data-code="${H(p.member_code)}">Registrar visita</button></td></tr>`).join('')||'<tr><td colspan="5">No se encontraron socios.</td></tr>'}</tbody></table></div></div>`;}
function countMove(type,daysBack){return data.activity.filter(x=>x.type===type&&new Date(x.created_at)>=new Date(Date.now()-daysBack*86400000)).length;}
function graph(){const days=Array.from({length:7},(_,i)=>{const date=new Date(Date.now()-(6-i)*86400000).toISOString().slice(0,10);return {date,plus:data.activity.filter(a=>a.created_at.slice(0,10)===date&&a.delta>0).reduce((s,a)=>s+a.delta,0),minus:data.activity.filter(a=>a.created_at.slice(0,10)===date&&a.delta<0).reduce((s,a)=>s-a.delta,0)}});const max=Math.max(1,...days.map(d=>Math.max(d.plus,d.minus)));return `<div class="chart">${days.map(d=>`<div class="chart-col"><div class="bar-pair"><div title="${fmt(d.plus)} puntos añadidos" class="bar" style="height:${Math.max(3,d.plus/max*100)}%"></div><div title="${fmt(d.minus)} puntos canjeados" class="bar out" style="height:${Math.max(3,d.minus/max*100)}%"></div></div><small>${d.date.slice(8)}</small></div>`).join('')}</div><p class="muted small" style="margin-top:28px">● Rosa: puntos sumados. &nbsp; <span class="gold">● Dorado: canjeados.</span></p>`;}
function adminTabs(){const tabs=[['summary','Inicio'],['events','Eventos'],['rewards','Premios'],['promos','Promociones'],['site','Editar web'],['members','Socios'],['rules','Puntos'],['activity','Movimientos']];return `<nav class="admin-tabs" aria-label="Apartados de administración">${tabs.map(([k,l])=>`<button type="button" class="tab-btn ${adminTab===k?'active':''}" data-action="admin-tab" data-tab="${k}" aria-current="${adminTab===k?'page':'false'}">${l}</button>`).join('')}</nav>`;}
function adminSummary(){
 const members=data.profiles.filter(p=>p.role==='socio');const pending=data.redemptions.filter(x=>x.status==='pendiente');
 const actions=[['events','▦','Crear evento','Pon una fecha y un lugar y publícalo.'],['rewards','🎁','Añadir premio','Elige cuántos puntos cuesta.'],['promos','✦','Crear promoción','Anuncia una nueva bonificación.'],['site','✎','Editar toda la web','Modelos, textos y publicación visual.']];
 return `<div class="admin-welcome"><div><span class="eyebrow">EMPIEZA POR AQUÍ</span><h2>¿Qué quieres hacer hoy?</h2><p>Elige una opción. Solo tienes que rellenar los datos y pulsar Guardar. Puedes cambiarlo después.</p></div></div><div class="admin-quick-grid">${actions.map(([k,icon,title,desc])=>`<button type="button" class="admin-quick" data-action="admin-go" data-tab="${k}"><span class="admin-quick-icon">${icon}</span><strong>${title}</strong><small>${desc}</small><span class="admin-quick-link">Empezar →</span></button>`).join('')}</div>
 <div class="admin-section-title"><h2>Tu actividad de un vistazo</h2><p>Estos números se actualizan con los datos reales de tu web.</p></div>
 <div class="simple-grid"><div class="stat-box"><strong>${fmt(members.length)}</strong><span>Socios registrados</span></div><div class="stat-box"><strong>${fmt(data.events.filter(x=>x.active).length)}</strong><span>Eventos publicados</span></div><div class="stat-box"><strong>${fmt(data.rewards.filter(x=>x.active).length)}</strong><span>Premios visibles</span></div><div class="stat-box"><strong>${fmt(pending.length)}</strong><span>Canjes pendientes</span></div></div>
 <div class="two-col section-gap"><div class="pane"><div class="section-title"><h2>Eventos recientes</h2><button class="btn btn-secondary btn-mini" type="button" data-action="admin-go" data-tab="events" data-list="1">Ver todos</button></div><div class="mini-list">${data.events.slice(0,4).map(x=>`<div class="mini-item"><div><strong>${H(x.name)}</strong><small>${H(eventDate(x.date_label,x.start_time))}</small></div><span class="admin-state ${x.active?'published':'draft'}">${x.active?'Publicado':'Borrador'}</span></div>`).join('')||'<div class="empty">Todavía no hay eventos. Puedes crear el primero con el botón de arriba.</div>'}</div></div><div class="pane"><div class="section-title"><h2>Canjes pendientes</h2><a class="btn btn-secondary btn-mini" href="#/puerta">Gestionar canjes</a></div><div class="mini-list">${pending.slice(0,5).map(r=>`<div class="mini-item"><div><strong>${H(getProfile(r.user_id)?.name||'Socio')}</strong><small>${H(getReward(r.reward_id)?.name||'Premio')} · ${H(r.code)}</small></div><a class="link-tiny" href="#/puerta">Validar →</a></div>`).join('')||'<div class="empty">No hay canjes pendientes.</div>'}</div></div></div>`;
}
function adminField(name,label,body,hint='',full=false){return `<div class="field ${full?'full':''}"><label for="admin-${name}">${label}</label>${body}${hint?`<small class="field-help">${hint}</small>`:''}</div>`;}
function adminItemForm(table){
 const editing=adminEditId?data[table].find(x=>x.id===adminEditId):null;const item=editing||{};const val=(key)=>H(item[key]??'');
 const type=adminLabel(table);let fields='';
 fields+=adminField('name',`Nombre del ${type} *`,`<input id="admin-name" name="name" type="text" minlength="2" maxlength="120" value="${val('name')}" placeholder="Escribe un nombre claro" required/>`,'Este es el nombre que verá la gente.',true);
 if(table==='events'){
  const original=/^\d{4}-\d{2}-\d{2}$/.test(item.date_label||'')?item.date_label:'';
  fields+=adminField('date_label','¿Qué día es? *',`<input id="admin-date_label" name="date_label" type="date" value="${H(original)}" required/>`,'Selecciona el día en el calendario.');
  fields+=adminField('start_time','¿A qué hora empieza?',`<input id="admin-start_time" name="start_time" type="time" value="${val('start_time').slice(0,5)}"/>`,'Opcional: si aún no sabes la hora, déjalo vacío.');
  fields+=adminField('location','¿Dónde se celebra? *',`<input id="admin-location" name="location" type="text" maxlength="160" value="${val('location')}" placeholder="Nombre del local o dirección" required/>`,'Escribe el lugar al que debe ir la gente.',true);
 }
 if(table==='rewards'){
  fields+=adminField('cost','¿Cuántos puntos cuesta? *',`<input id="admin-cost" name="cost" type="number" min="1" max="999999" step="1" value="${val('cost')}" placeholder="Puntos" required/>`,'Los socios gastarán esta cantidad al solicitarlo.');
  fields+=adminField('category','Tipo de premio *',`<select id="admin-category" name="category" required>${['Premios','Accesos','Merchandising','Experiencias','Otros'].map(c=>`<option value="${c}" ${item.category===c?'selected':''}>${c}</option>`).join('')}</select>`);
  fields+=adminField('symbol','Icono del premio',`<input id="admin-symbol" name="symbol" type="text" maxlength="12" value="${val('symbol')||'🎁'}" placeholder="🎁"/>`,'Puedes poner un emoji.');
 }
 if(table==='promos'){
  fields+=adminField('bonus','Puntos de la promoción *',`<input id="admin-bonus" name="bonus" type="number" min="1" max="999999" step="1" value="${val('bonus')}" placeholder="Puntos" required/>`,'Esta promoción es informativa: no añade puntos automáticamente.',true);
 }
 fields+=adminField('description','Cuéntale a la gente de qué trata',`<textarea id="admin-description" name="description" rows="4" maxlength="1200" placeholder="Escribe una explicación sencilla...">${val('description')}</textarea>`,'Opcional, pero ayuda a entender lo que ofreces.',true);
 if(['events','rewards'].includes(table))fields+=adminField('image','Añadir una foto (opcional)',`<div class="admin-file-row"><label class="admin-file-button" for="admin-image">📷 Elegir foto</label><span id="admin-file-status">Ninguna foto seleccionada</span></div><input class="admin-file-input" id="admin-image" name="image" type="file" accept="image/jpeg,image/png,image/webp"/>`,'Elige una foto del móvil o del ordenador (JPG, PNG o WebP, máximo 5 MB).',true)+(item.image_url?`<div class="admin-existing-photo"><img src="${H(safeImage(item.image_url))}" alt="Foto guardada"/><label class="admin-check"><input type="checkbox" name="remove_image"/> Quitar la foto actual</label></div>`:'');
 fields+=`<label class="admin-publish full"><input type="checkbox" name="active" ${item.active===false?'':'checked'}/><span><strong>Mostrar a la gente ahora</strong><small>Desmarca esta opción para guardarlo oculto y publicarlo más adelante.</small></span></label>`;
 return `<div class="pane admin-edit-pane"><div class="admin-form-heading"><div><span class="eyebrow">${editing?'MODIFICAR':'NUEVO'} ${type.toUpperCase()}</span><h2>${editing?'Editar':'Crear'} ${type}</h2><p>Rellena los campos que tengan * y guarda al terminar.</p></div><button class="btn btn-secondary btn-mini" type="button" data-action="admin-cancel">✕ Cerrar</button></div><form id="admin-item-form" data-table="${table}" data-id="${editing?H(editing.id):''}" class="admin-form">${fields}<div class="admin-preview full" aria-live="polite"><div class="eyebrow">ASÍ SE VERÁ</div><strong id="admin-preview-name">${H(item.name||'Tu '+type)}</strong><p id="admin-preview-info">${H(editing?adminMeta(table,item):'Completa el formulario para ver una vista previa.')}</p></div><div id="admin-form-feedback" class="admin-form-feedback full" role="alert" hidden></div><div class="admin-form-buttons full"><button class="btn btn-primary" type="submit">${editing?'Guardar cambios':'Guardar '+type}</button><button class="btn btn-secondary" type="button" data-action="admin-cancel">Cancelar</button></div></form></div>`;
}
function adminCatalog(table){
 const singular=adminLabel(table);const plural={events:'eventos',rewards:'premios',promos:'promociones'}[table];const activeCount=data[table].filter(x=>x.active).length;
 const list=data[table].map(x=>`<article class="admin-list-item" data-search="${H((x.name+' '+(x.description||'')).toLocaleLowerCase('es-ES'))}"><div class="admin-list-top"><div class="admin-item-intro">${safeImage(x.image_url)?`<img class="admin-item-photo" src="${H(safeImage(x.image_url))}" alt=""/>`:`<span class="admin-item-icon">${table==='events'?'▦':table==='rewards'?H(x.symbol||'🎁'):'✦'}</span>`}<div><strong>${H(x.name)}</strong><small>${H(adminMeta(table,x))}</small></div></div><span class="admin-state ${x.active?'published':'draft'}">${x.active?'Publicado':'Oculto'}</span></div><div class="admin-item-buttons"><button class="btn btn-secondary btn-mini" type="button" data-action="admin-edit" data-table="${table}" data-id="${H(x.id)}">✎ Editar</button><button class="btn btn-secondary btn-mini" type="button" data-action="toggle" data-table="${table}" data-id="${H(x.id)}">${x.active?'Ocultar':'Publicar'}</button><button class="btn btn-danger btn-mini" type="button" data-action="admin-delete" data-table="${table}" data-id="${H(x.id)}">Eliminar</button></div></article>`).join('');
 return `<div class="admin-catalog-heading"><div><h2>Mis ${plural}</h2><p>${data[table].length} en total · ${activeCount} visibles para la gente</p></div><button class="btn btn-primary" type="button" data-action="admin-new" data-table="${table}">+ Crear ${singular}</button></div><div class="admin-guide"><span class="admin-guide-icon">💡</span><p><strong>Es muy fácil:</strong> crea un ${singular}, publícalo cuando esté listo y usa <b>Editar</b> para cambiarlo en cualquier momento. <b>Ocultar</b> lo retira de la web sin borrarlo.</p></div>${adminFormOpen?adminItemForm(table):''}<div class="pane admin-list-pane"><div class="section-title"><h2>Lo que has creado</h2>${data[table].length>5?`<input type="search" id="admin-list-search" class="search-field" aria-label="Buscar ${plural}" placeholder="Buscar por nombre..."/>`:''}</div><div class="admin-list">${list||`<div class="empty">Todavía no hay ${plural}. Pulsa «Crear ${singular}» para empezar.</div>`}</div><div class="empty" id="admin-search-empty" hidden>No se ha encontrado ningún resultado.</div></div></div>`;
}
function adminSite(){return `<div class="pane admin-edit-pane"><h2>Editar y actualizar toda la página</h2><p class="muted">Abre el editor visual: cambia todos los textos públicos, elige un modelo, reorganiza las secciones y comprueba el resultado antes de publicarlo. No hace falta saber programación.</p><p class="admin-guide"><strong>1.</strong> Abre el editor &nbsp; <strong>2.</strong> Cambia lo que quieras &nbsp; <strong>3.</strong> Guarda borrador &nbsp; <strong>4.</strong> Publica cuando esté listo.</p><a class="btn btn-primary" href="#/editor">✎ Abrir editor de la web ↗</a></div>`;}
function adminMembers(){return `<div class="pane"><div class="section-title"><h2>Personas registradas</h2><span class="muted small">${data.profiles.length} cuentas reales</span></div><p class="muted small">Aquí puedes consultar socios y personal autorizado. Las cuentas se crean desde el botón «Crear cuenta» de la web; los permisos de administrador solo se asignan de forma segura desde Supabase.</p><div class="data-table-wrap"><table class="data-table"><thead><tr><th>Nombre</th><th>Código</th><th>Rol</th><th>Puntos</th><th>Visitas</th></tr></thead><tbody>${data.profiles.map(p=>`<tr><td>${H(p.name)}</td><td>${H(p.member_code)}</td><td><span class="role-chip">${H(roleLabel(p.role))}</span></td><td>${fmt(p.points)}</td><td>${fmt(p.visits)}</td></tr>`).join('')||'<tr><td colspan="5">Aún no hay cuentas registradas.</td></tr>'}</tbody></table></div></div>`;}
function adminRules(){return `<div class="two-col"><div class="pane"><h2>Cómo se ganan puntos</h2><div class="mini-list"><div class="mini-item"><span>Visita validada por personal</span><strong class="gold">+10 pts</strong></div><div class="mini-item"><span>Solicitar un premio</span><strong>− Coste en puntos</strong></div><div class="mini-item"><span>Una visita por socio al día</span><span class="status ok">Activo</span></div></div><p class="form-note">Las promociones que crees se mostrarán a los socios, pero no suman puntos automáticamente. Estas reglas son fijas por seguridad y para cambiarlas necesitas actualizar las funciones del servidor.</p></div><div class="pane"><h2>Niveles de socio</h2><div class="mini-list"><div class="mini-item"><b>Member</b><span>0–499 puntos históricos</span></div><div class="mini-item"><b class="gold">Gold</b><span>500–899 puntos</span></div><div class="mini-item"><b>VIP</b><span>900–1.999 puntos</span></div><div class="mini-item"><b>Black</b><span>2.000 puntos o más</span></div></div></div></div>`;}
function adminActivity(){return `<div class="pane"><h2>Historial de movimientos</h2><p class="muted small">Consulta de operaciones reales. Aquí no se añaden ni modifican puntos.</p><div class="data-table-wrap"><table class="data-table"><thead><tr><th>Fecha</th><th>Socio</th><th>Tipo</th><th>Detalle</th><th>Puntos</th></tr></thead><tbody>${data.activity.slice().sort(byDate).map(x=>`<tr><td>${recentDate(x.created_at)}</td><td>${H(getProfile(x.user_id)?.name||'Sistema')}</td><td>${H(x.type)}</td><td>${H(x.detail)}</td><td class="${x.delta>=0?'gold':'rose'}">${x.delta>0?'+':''}${fmt(x.delta)}</td></tr>`).join('')||'<tr><td colspan="5">Todavía no se han registrado movimientos.</td></tr>'}</tbody></table></div></div>`;}
// EDITOR VISUAL: personalización completa de la portada, borradores privados y publicación.
function ensureEditor(){
 if(editorDraft)return;
 const stored=data.site_drafts.find(x=>x.key==='homepage')?.settings;
 editorDraft=normalizeEditor(stored||publishedSettings());
 editorDirty=false;
}
function normalizeEditor(value){
 const output={...SITE_DEFAULTS,...(value&&typeof value==='object'&&!Array.isArray(value)?value:{})};
 for(const key of Object.keys(SITE_DEFAULTS)){
  if(typeof SITE_DEFAULTS[key]==='string')output[key]=String(output[key]??SITE_DEFAULTS[key]).slice(0,key==='hero_text'?1000:1200);
 }
 output.theme=['classic','minimal','festival'].includes(output.theme)?output.theme:'classic';
 output.logo_url=safeImage(output.logo_url);
 output.visible=Object.fromEntries(Object.keys(EDITOR_SECTIONS).map(k=>[k,output.visible?.[k]!==false]));
 output.order=validOrder(output.order);
 return output;
}
const EDITOR_GROUPS=[['main','🏠 Portada'],['experience','✦ Experiencia'],['events','▦ Eventos'],['benefits','🎁 Ventajas'],['faq','❔ Preguntas'],['cta','↗ Invitación final'],['other','☷ Menú y pie'],['sections','☰ Orden y visibilidad'],['design','✧ Modelos']];
function editorFields(group){
 const rows=SITE_FIELDS[group]||[];
 return `<div class="editor-field-list">${rows.map(([key,label,kind])=>{
  const id='editor-'+key, val=H(editorDraft[key]||'');
  const text=kind==='textarea'?`<textarea id="${id}" data-editor-field="${key}" maxlength="1200" rows="3">${val}</textarea>`:`<input id="${id}" data-editor-field="${key}" value="${val}" maxlength="${kind==='image'?800:300}" type="${kind==='image'?'url':'text'}" placeholder="${kind==='image'?'https://...':''}"/>`;
  return `<div class="editor-field"><label for="${id}">${H(label)}</label>${text}${kind==='image'?`<p class="field-help">Puedes pegar una URL HTTPS o subir una foto. Para mantener el logo original, deja este campo vacío.</p><label class="editor-upload" for="editor-logo-file">📷 Subir imagen</label><input type="file" id="editor-logo-file" accept="image/jpeg,image/png,image/webp" class="admin-file-input"/><p class="field-help">PNG, JPG o WebP de hasta 5 MB.</p>`:''}</div>`;
 }).join('')}</div>`;
}
function editorSections(){return `<p class="muted small">Cambia el orden de las secciones con las flechas. Puedes ocultar una sección sin borrar su contenido.</p><div class="editor-section-list">${editorDraft.order.map((key,i)=>`<div class="editor-section-item"><label class="editor-switch"><input type="checkbox" data-editor-visibility="${key}" ${editorDraft.visible[key]?'checked':''}/> <span>${H(EDITOR_SECTIONS[key])}</span></label><div class="editor-order"><button class="btn btn-secondary btn-mini" type="button" aria-label="Subir ${H(EDITOR_SECTIONS[key])}" data-action="editor-move" data-section="${key}" data-direction="up" ${i===0?'disabled':''}>↑</button><button class="btn btn-secondary btn-mini" type="button" aria-label="Bajar ${H(EDITOR_SECTIONS[key])}" data-action="editor-move" data-section="${key}" data-direction="down" ${i===editorDraft.order.length-1?'disabled':''}>↓</button></div></div>`).join('')}</div>`;}
function editorDesign(){return `<p class="muted small">Selecciona el aspecto de la web. Solo cambia los colores y el estilo: no borra el contenido.</p><div class="editor-theme-list">${[['classic','Original Bellaquitas','Oscuro, dorado y elegante.'],['minimal','Modelo elegante','Fondo oscuro y toques claros.'],['festival','Modelo festival','Más color y energía para eventos.']].map(([key,title,desc])=>`<button type="button" data-action="editor-theme" data-theme="${key}" class="editor-theme ${editorDraft.theme===key?'chosen':''}" aria-pressed="${editorDraft.theme===key}"><span class="theme-swatch theme-swatch-${key}"><i></i><i></i><i></i></span><strong>${title}</strong><small>${desc}</small>${editorDraft.theme===key?'<b>✓ Elegido</b>':''}</button>`).join('')}</div>`;}
function editor(){
 ensureEditor();
 const selected=EDITOR_GROUPS.find(x=>x[0]===editorCategory)?.[1]||'Portada';
 const editorUI=editorCategory==='sections'?editorSections():editorCategory==='design'?editorDesign():editorFields(editorCategory);
 return `${pageHead('Editar mi página web','Cambia textos, secciones y modelos sin tocar código. Comprueba la vista previa y publica solo cuando esté todo listo.','EDITOR VISUAL')}
 <div class="editor-intro"><div><strong>1. Elige qué modificar</strong><span>Usa el menú de apartados.</span></div><div><strong>2. Mira cómo queda</strong><span>La vista previa se actualiza al escribir.</span></div><div><strong>3. Publica la web</strong><span>Todo el mundo verá lo publicado.</span></div></div>
 <div class="editor-toolbar"><span class="editor-status" id="editor-status" role="status">${editorDirty?'● Cambios sin guardar':'✓ Vista previa lista'}</span><div class="editor-toolbar-buttons"><button type="button" class="btn btn-secondary" data-action="editor-reset">↶ Recuperar lo publicado</button><button type="button" class="btn btn-secondary" data-action="editor-save">Guardar borrador</button><button type="button" class="btn btn-primary" data-action="editor-publish">✓ Publicar cambios</button></div></div>
 <div id="editor-notice" class="admin-form-feedback" role="alert" hidden></div>
 <div class="editor-layout"><div class="editor-panel"><nav class="editor-categories" aria-label="Elementos que puedes editar">${EDITOR_GROUPS.map(([key,title])=>`<button type="button" data-action="editor-category" data-category="${key}" class="editor-category ${editorCategory===key?'active':''}" aria-current="${editorCategory===key?'true':'false'}">${title}</button>`).join('')}</nav><section class="editor-controls"><div class="editor-controls-head"><span class="eyebrow">PERSONALIZAR</span><h2>${H(selected.replace(/^[^ ]+ /,''))}</h2><p>Modifica los campos a tu gusto. No cambiarán para el público hasta que pulses «Publicar cambios».</p></div>${editorUI}</section></div>
 <div class="editor-preview-wrap"><div class="editor-preview-head"><div><strong>Vista previa de la página</strong><small>Solo tú ves estos cambios hasta publicar</small></div><div class="editor-devices"><button class="btn btn-secondary btn-mini ${editorDevice==='desktop'?'active':''}" type="button" data-action="editor-device" data-device="desktop" aria-pressed="${editorDevice==='desktop'}">▭ Ordenador</button><button class="btn btn-secondary btn-mini ${editorDevice==='mobile'?'active':''}" type="button" data-action="editor-device" data-device="mobile" aria-pressed="${editorDevice==='mobile'}">▯ Móvil</button></div></div><div class="editor-preview-surface"><iframe id="editor-preview" class="editor-preview ${editorDevice==='mobile'?'mobile':''}" sandbox="" referrerpolicy="no-referrer" title="Vista previa de la página sin publicar"></iframe></div><p class="editor-preview-foot">La vista previa muestra la portada. Para crear o editar eventos, premios y promociones utiliza <a href="#/panel">Panel administrador</a>. Esos contenidos se guardan por separado.</p><a class="btn btn-secondary btn-mini" href="#/" target="_blank" rel="noopener noreferrer">↗ Ver página publicada</a></div></div>`;
}
function editorPreviewHTML(){
 const previous=editorPreviewOverride;editorPreviewOverride=editorDraft;
 let html;
 try{html=landing();}finally{editorPreviewOverride=previous;}
 const theme=editorDraft.theme==='classic'?'':'theme-'+editorDraft.theme;
 const css=H(new URL('styles.css',location.href).href);
 return `<!doctype html><html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><link rel="stylesheet" href="${css}"/></head><body class="${theme}">${html}</body></html>`;
}
function renderEditorPreview(){
 const frame=$('#editor-preview');if(frame&&editorDraft)frame.srcdoc=editorPreviewHTML();
}
function markEditorDirty(){editorDirty=true;const el=$('#editor-status');if(el)el.textContent='● Cambios sin guardar';}
function updateEditorValue(el){
 if(route!=='/editor'||current?.role!=='admin')return;
 ensureEditor();
 if(el.hasAttribute('data-editor-field')){
  const key=el.dataset.editorField;
  if(!Object.hasOwn(SITE_DEFAULTS,key)||typeof SITE_DEFAULTS[key]!=='string')return;
  editorDraft[key]=el.value;
 }else if(el.hasAttribute('data-editor-visibility')){
  const key=el.dataset.editorVisibility;
  if(!Object.hasOwn(EDITOR_SECTIONS,key))return;
  editorDraft.visible[key]=el.checked;
 }
 markEditorDirty();renderEditorPreview();
}
async function editorUploadLogo(input){
 if(!sb||current?.role!=='admin')throw new Error('Debes entrar con una cuenta administradora.');
 const file=input.files?.[0];if(!file)return;
 input.disabled=true;
 try{
  const image=await uploadAdminImage('logos',file);
  editorDraft.logo_url=image.url;
  const field=$('#editor-logo_url');if(field)field.value=image.url;
  markEditorDirty();renderEditorPreview();toast('Imagen subida. Publica los cambios para mostrarla a los visitantes.');
 }finally{if(input.isConnected)input.disabled=false;}
}
async function saveEditorDraft(){
 if(!sb||current?.role!=='admin')throw new Error('No tienes permisos de administrador.');
 const settings=normalizeEditor(editorDraft);
 const result=await sb.from('site_drafts').upsert({key:'homepage',settings,updated_at:new Date().toISOString()},{onConflict:'key'});
 if(result.error)throw new Error('No se pudo guardar el borrador. Ejecuta INSTALAR_EDITOR_WEB.sql en Supabase y comprueba los permisos. '+result.error.message);
 data.site_drafts=[{key:'homepage',settings}];
 editorDraft=settings;editorDirty=false;
 const state=$('#editor-status');if(state)state.textContent='✓ Borrador guardado (no publicado)';
 toast('Borrador guardado: todavía no es visible para los visitantes.');
}
async function publishEditor(){
 if(!sb||current?.role!=='admin')throw new Error('No tienes permisos de administrador.');
 if(!window.confirm('¿Publicar esta versión de la web para todos los visitantes?'))return;
 const settings=normalizeEditor(editorDraft);
 const result=await sb.from('site_content').upsert({key:'homepage',hero_text:settings.hero_text||' ',announcement:settings.announcement||' ',page_settings:settings,updated_at:new Date().toISOString()},{onConflict:'key'});
 if(result.error)throw new Error('No se pudo publicar. Ejecuta INSTALAR_EDITOR_WEB.sql y comprueba los permisos. '+result.error.message);
 data.site_content=[{key:'homepage',hero_text:settings.hero_text,announcement:settings.announcement,page_settings:settings}];
 editorDraft=settings;editorDirty=false;
 const state=$('#editor-status');if(state)state.textContent='✓ Publicado para todos';
 toast('¡Página actualizada y publicada! Los visitantes verán los cambios al recargar.');
 // Conservar copia del último diseño publicado como borrador (si falla, no oculta el éxito de publicar).
 const saved=await sb.from('site_drafts').upsert({key:'homepage',settings,updated_at:new Date().toISOString()},{onConflict:'key'});
 if(!saved.error)data.site_drafts=[{key:'homepage',settings}];
}
async function editorAction(el,act){
 if(route!=='/editor'||current?.role!=='admin')return;
 ensureEditor();
 if(act==='editor-category'){editorCategory=el.dataset.category;await render();return;}
 if(act==='editor-device'){editorDevice=el.dataset.device;await render();return;}
 if(act==='editor-theme'){
  if(!['classic','minimal','festival'].includes(el.dataset.theme))return;
  editorDraft.theme=el.dataset.theme;markEditorDirty();await render();return;
 }
 if(act==='editor-move'){
  const key=el.dataset.section,index=editorDraft.order.indexOf(key),dir=el.dataset.direction==='up'?-1:1;
  if(index<0||index+dir<0||index+dir>=editorDraft.order.length)return;
  [editorDraft.order[index],editorDraft.order[index+dir]]=[editorDraft.order[index+dir],editorDraft.order[index]];
  markEditorDirty();await render();return;
 }
 if(act==='editor-reset'){
  if(!window.confirm('¿Volver a la última versión publicada? Los cambios del editor que no hayas publicado se perderán.'))return;
  editorDraft=normalizeEditor(publishedSettings());markEditorDirty();await render();toast('Vista previa restaurada. Para hacerla definitiva, pulsa Guardar borrador.');return;
 }
 if(!['editor-save','editor-publish'].includes(act)||editorBusy)return;
 editorBusy=true;
 const label=el.textContent;el.disabled=true;el.textContent='Guardando…';
 const notice=$('#editor-notice');if(notice)notice.hidden=true;
 try{if(act==='editor-save')await saveEditorDraft();else await publishEditor();}
 catch(err){console.error(err);if(notice){notice.textContent=err.message;notice.hidden=false;}else toast(err.message);}
 finally{editorBusy=false;if(el.isConnected){el.disabled=false;el.textContent=label;}}
}

function admin(){const subtitle='Crea, publica y cambia el contenido de Bellaquitas Fest sin complicaciones.';const content=adminTab==='summary'?adminSummary():['events','rewards','promos'].includes(adminTab)?adminCatalog(adminTab):adminTab==='site'?adminSite():adminTab==='members'?adminMembers():adminTab==='rules'?adminRules():adminActivity();return `${pageHead('Tu panel de administrador',subtitle,'ADMINISTRACIÓN FÁCIL')}${adminTabs()}${content}`;}

async function render(){
  stopScan();route=location.hash.slice(1)||'/';menuOpen=false;
  document.body.classList.remove('theme-minimal','theme-festival');
  if(!route.startsWith('/panel') && route!=='/editor' && (!current || !allowed(route))){const t=publishedSettings().theme;if(t==='minimal'||t==='festival')document.body.classList.add('theme-'+t);}
  if(Object.prototype.hasOwnProperty.call(AUTH_ROUTES,route))authTab=AUTH_ROUTES[route];
  const needsAuth=route.startsWith('/mi-')||['/tarjeta','/premios','/agenda','/perfil','/puerta','/panel','/editor'].includes(route);
  if(!current&&needsAuth)route='/acceso';
  if(current&&route in AUTH_ROUTES&&route!=='/restablecer')route=current.role==='admin'?'/panel':current.role==='puerta'?'/puerta':'/mi-espacio';
  if(current&&route!=='/'&&!allowed(route)&&!['/experiencia','/eventos','/ventajas','/preguntas','/restablecer'].includes(route))route='/mi-espacio';
  let html='';
  if(route in AUTH_ROUTES)html=auth();
  else if(current&&allowed(route))html=appShell(route==='/mi-espacio'?summary():route==='/tarjeta'?card():route==='/premios'?rewards():route==='/agenda'?agenda():route==='/perfil'?profile():route==='/puerta'?gate():route==='/editor'?editor():admin());
  else html=landing();
  $('#app').innerHTML=html;
  document.title=(route==='/'?'Bellaquitas Fest':(current&&allowed(route)?'Mi cuenta · Bellaquitas Fest':'Acceso y registro · Bellaquitas Fest'));
  document.querySelector('meta[name="robots"]')?.setAttribute('content',current&&allowed(route)?'noindex,nofollow':'index,follow');
  if(['/experiencia','/eventos','/ventajas','/preguntas'].includes(route))document.getElementById(route.slice(1))?.scrollIntoView({behavior:'instant'});
  else window.scrollTo({top:0,behavior:'instant'});
  if(route==='/tarjeta')createQR(current.member_code);
  if(route==='/editor')renderEditorPreview();
}
function to(path){if(location.hash==='#'+path){render();return;}location.hash=path;}
async function loadLive(){const {data:authData}=await sb.auth.getSession();session=authData.session?.user||null;if(!session){current=null;editorDraft=null;data=emptyData();return;}const uid=session.id;const [p,e,r,pr,re,a,sc]=await Promise.all([sb.from('profiles').select('*'),sb.from('events').select('*').order('created_at',{ascending:false}),sb.from('rewards').select('*').order('created_at',{ascending:false}),sb.from('promos').select('*'),sb.from('redemptions').select('*').order('created_at',{ascending:false}),sb.from('activity').select('*').order('created_at',{ascending:false}).limit(200),sb.from('site_content').select('*')]);for(const x of [p,e,r,pr,re,a])if(x.error)console.warn('Consulta de datos:',x.error.message);data={profiles:p.data||[],events:e.data||[],rewards:r.data||[],promos:pr.data||[],redemptions:re.data||[],activity:a.data||[],site_content:sc.data||[],site_drafts:[]};current=data.profiles.find(x=>x.id===uid)||null;if(current?.role==='admin'){const dr=await sb.from('site_drafts').select('*').eq('key','homepage');if(dr.error)console.warn('Editor: comprueba INSTALAR_EDITOR_WEB.sql',dr.error.message);data.site_drafts=dr.data||[];}}
async function loadPublic(){const [e,r,pr,sc]=await Promise.all([sb.from('events').select('*').eq('active',true),sb.from('rewards').select('*').eq('active',true),sb.from('promos').select('*').eq('active',true),sb.from('site_content').select('*')]);data={...emptyData(),events:e.data||[],rewards:r.data||[],promos:pr.data||[],site_content:sc.data||[]};}
async function refresh(){if(!sb)throw new Error('Servicio de cuentas no configurado.');if(session)await loadLive();else await loadPublic();await render();}
async function init(){
  clearOldLocalData();
  if(live){
    try{
      const m=await import('https://esm.sh/@supabase/supabase-js@2');
      sb=m.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true,flowType:'pkce'}});
      await loadLive();
      if(!session)await loadPublic();
      const callbackParams=new URLSearchParams(location.search);
      if(callbackParams.get('acceso')==='google'){
        const providerError=callbackParams.get('error_description') || callbackParams.get('error');
        cleanGoogleReturnUrl();
        if(session&&current){location.hash=destinationForUser();authNotice='';}
        else {
          authNotice=providerError?'No se pudo completar el acceso con Google. Revisa los permisos e inténtalo de nuevo.':session?'Google ha confirmado tu cuenta, pero no se ha creado la ficha de socio. Comprueba la instalación de supabase.sql.':'No se ha completado el acceso con Google. Inténtalo otra vez o utiliza tu correo.';
          location.hash='/acceso';
        }
      }
      if(callbackParams.get('recuperar')==='1'&&session){authTab='reset';location.hash='/restablecer';}
      sb.auth.onAuthStateChange(event=>{
        if(event==='PASSWORD_RECOVERY'){authTab='reset';location.hash='/restablecer';render();}
        if(event==='SIGNED_OUT'&&session){session=null;current=null;loadPublic().then(render).catch(console.error);}
      });
    }catch(err){
      console.error(err);
      $('#app').innerHTML=`${header()}<main class="container" style="padding:80px 20px"><h1>No se ha podido conectar con el servicio de cuentas</h1><p class="muted">La conexión no está disponible. Inténtalo más tarde.</p><a class="btn btn-secondary" href="#/">Volver al inicio</a></main>${footer()}`;
      return;
    }
  } else { data=emptyData();session=null;current=null; }
  await render();
}
async function createQR(code){const box=$('#qr-code');if(!box)return;try{if(!window.QRCode){await new Promise((resolve,reject)=>{const sc=document.createElement('script');sc.src='https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';sc.onload=resolve;sc.onerror=reject;document.head.appendChild(sc);});}const b=$('#qr-code');if(!b)return;b.innerHTML='';new window.QRCode(b,{text:code,width:182,height:182,colorDark:'#130b11',colorLight:'#ffffff',correctLevel:window.QRCode.CorrectLevel.M});}catch{const b=$('#qr-code');if(b)b.innerHTML='<div style="color:#25151b;padding:20px">QR no disponible sin conexión. Utiliza el código visible.</div>';}}
async function visit(code){
  if(!sb)throw new Error('El servicio no está disponible.');
  const r=await sb.rpc('register_visit',{p_member_code:code.trim().toUpperCase()});
  if(r.error)throw new Error(r.error.message);
  await refresh();toast('Visita validada: +10 puntos.');
}
async function redeem(reward_id){
  const r=getReward(reward_id);
  if(!r||!r.active)throw new Error('Premio no disponible.');
  if(current.points<r.cost)throw new Error('Puntos insuficientes.');
  if(!confirm(`Solicitar "${r.name}" por ${r.cost} puntos?`))return;
  const res=await sb.rpc('request_redemption',{p_reward_id:reward_id});
  if(res.error)throw new Error(res.error.message);
  await refresh();toast('Canje solicitado. Consulta el código en tus solicitudes.');
}
async function validate(code){
  const res=await sb.rpc('validate_redemption',{p_code:code.trim().toUpperCase()});
  if(res.error)throw new Error(res.error.message);
  await refresh();toast('Canje validado correctamente.');
}
async function toggle(table,id){
  if(!['events','rewards','promos'].includes(table))throw new Error('Operación no permitida.');
  const item=data[table].find(x=>x.id===id);
  if(!item)return;
  const res=await sb.from(table).update({active:!item.active}).eq('id',id);
  if(res.error)throw new Error(res.error.message);
  await refresh();toast('Visibilidad actualizada.');
}
async function removeItem(table,id){
 if(!['events','rewards','promos'].includes(table))throw new Error('Operación no permitida.');
 const item=data[table].find(x=>x.id===id);if(!item)return;
 if(!confirm(`¿Quieres eliminar definitivamente «${item.name}»? Esta acción no se puede deshacer.\n\nSi solo quieres quitarlo de la web, pulsa Cancelar y usa Ocultar.`))return;
 const res=await sb.from(table).delete().eq('id',id);
 if(res.error){if(table==='rewards'&&res.error.code==='23503')throw new Error('Este premio tiene solicitudes de canje y no se puede borrar. Usa «Ocultar» para conservar el historial.');throw new Error(res.error.message);}
 if(adminEditId===id){adminEditId=null;adminFormOpen=false;}
 await refresh();toast('Eliminado correctamente.');
}
function itemPayload(table,fd){
 const name=String(fd.get('name')||'').trim();const description=String(fd.get('description')||'').trim();
 if(name.length<2||name.length>120)throw new Error('Escribe un nombre de entre 2 y 120 caracteres.');
 if(description.length>1200)throw new Error('La descripción es demasiado larga.');
 const item={name,description,active:fd.has('active')};
 if(table==='events'){
  const date=String(fd.get('date_label')||'');const location=String(fd.get('location')||'').trim();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date+'T12:00:00')))throw new Error('Selecciona una fecha válida.');
  if(!location||location.length>160)throw new Error('Escribe dónde se celebra el evento.');
  const time=String(fd.get('start_time')||'');if(time&&!/^\d{2}:\d{2}$/.test(time))throw new Error('La hora no es válida.');
  Object.assign(item,{date_label:date,location,start_time:time||null});
 }else if(table==='rewards'){
  const cost=Number(fd.get('cost'));if(!Number.isInteger(cost)||cost<1||cost>999999)throw new Error('Pon un coste válido en puntos.');
  Object.assign(item,{cost,category:String(fd.get('category')||'Premios').slice(0,80),symbol:String(fd.get('symbol')||'🎁').trim().slice(0,12)||'🎁'});
 }else if(table==='promos'){
  const bonus=Number(fd.get('bonus'));if(!Number.isInteger(bonus)||bonus<1||bonus>999999)throw new Error('Pon una bonificación válida en puntos.');item.bonus=bonus;
 }else throw new Error('Operación no permitida.');
 return item;
}
async function uploadAdminImage(table,file){
 if(!file)return '';
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('La foto debe ser JPG, PNG o WebP.');
 if(file.size>5*1024*1024)throw new Error('La foto ocupa más de 5 MB. Elige una más pequeña.');
 const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];
 const key=table+'/'+(crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(36).slice(2))+'.'+ext;
 const {error}=await sb.storage.from('bellaquitas-media').upload(key,file,{contentType:file.type,upsert:false});
 if(error)throw new Error('No se pudo subir la foto. Comprueba que has instalado la ampliación SQL del panel. '+error.message);
 const {data:publicData}=sb.storage.from('bellaquitas-media').getPublicUrl(key);
 return {url:publicData.publicUrl,key};
}
async function saveAdminItem(form){
 if(!sb||current?.role!=='admin')throw new Error('Solo el administrador puede guardar contenido.');
 const table=form.dataset.table;const id=form.dataset.id;const fd=new FormData(form);const item=itemPayload(table,fd);
 const feedback=form.querySelector('#admin-form-feedback');const button=form.querySelector('button[type="submit"]');
 if(feedback){feedback.hidden=true;feedback.textContent='';}button.disabled=true;const previousText=button.textContent;button.textContent='Guardando…';
 let uploaded=null;
 try{
  if(fd.has('remove_image')&&fd.get('remove_image')==='on')item.image_url='';
  const file=fd.get('image');if(file instanceof File&&file.size>0){uploaded=await uploadAdminImage(table,file);item.image_url=uploaded.url;}
  const result=id?await sb.from(table).update(item).eq('id',id):await sb.from(table).insert(item);
  if(result.error)throw new Error(result.error.message);
  adminEditId=null;adminFormOpen=false;
  await refresh();toast(id?'Cambios guardados correctamente.':'Contenido creado correctamente.');
 }catch(err){
  if(uploaded){try{await sb.storage.from('bellaquitas-media').remove([uploaded.key]);}catch{}}
  console.error(err);if(feedback){feedback.textContent=err.message||'No se pudo guardar. Revisa los datos.';feedback.hidden=false;feedback.scrollIntoView({block:'nearest'});}else toast(err.message);
 }finally{if(button.isConnected){button.disabled=false;button.textContent=previousText;}}
}
async function saveSiteForm(form){
 if(!sb||current?.role!=='admin')throw new Error('Solo el administrador puede modificar la web.');
 const fd=new FormData(form);const hero_text=String(fd.get('hero_text')||'').trim();const announcement=String(fd.get('announcement')||'').trim();
 if(hero_text.length<10||hero_text.length>400||!announcement||announcement.length>160)throw new Error('Revisa la longitud de los textos.');
 const button=form.querySelector('button[type="submit"]');const feedback=form.querySelector('#admin-form-feedback');button.disabled=true;const label=button.textContent;button.textContent='Guardando…';
 try{const result=await sb.from('site_content').upsert({key:'homepage',hero_text,announcement},{onConflict:'key'});if(result.error)throw new Error(result.error.message);await refresh();toast('Portada actualizada correctamente.');}
 catch(err){console.error(err);feedback.textContent=err.message||'No se han podido guardar los textos.';feedback.hidden=false;}
 finally{if(button.isConnected){button.disabled=false;button.textContent=label;}}
}
function updateAdminPreview(form){
 const title=form.querySelector('#admin-preview-name');const info=form.querySelector('#admin-preview-info');if(!title||!info)return;
 const fd=new FormData(form);title.textContent=String(fd.get('name')||'Tu '+adminLabel(form.dataset.table));
 info.textContent=form.dataset.table==='events'?eventDate(fd.get('date_label'),fd.get('start_time'))+' · '+(fd.get('location')||'Lugar por indicar'):form.dataset.table==='rewards'?`${fd.get('cost')||'0'} puntos · ${fd.get('category')||'Premios'}`:`+${fd.get('bonus')||'0'} puntos`;
}
function stopScan(){if(scanLoop){clearInterval(scanLoop);scanLoop=null;}if(scanner){scanner.getTracks().forEach(x=>x.stop());scanner=null;}const c=$('#camera-wrap');if(c)c.classList.remove('active');}
let qrScannerLibraryPromise=null;
async function getQRScanner(){
  if(typeof window.jsQR==='function')return window.jsQR;
  if(!qrScannerLibraryPromise){qrScannerLibraryPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src='https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
    script.async=true;script.onload=()=>typeof window.jsQR==='function'?resolve(window.jsQR):reject(new Error('El lector QR no está disponible. Usa el código manual.'));script.onerror=()=>reject(new Error('No se pudo cargar el lector QR. Usa el código manual.'));
    document.head.appendChild(script);
  }).catch(err=>{qrScannerLibraryPromise=null;throw err;});}
  return qrScannerLibraryPromise;
}
async function startScan(){
  if(!navigator.mediaDevices?.getUserMedia){toast('La cámara no está disponible. Introduce el código del socio manualmente.');return;}
  try{
    scanner=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
    const v=$('#camera');
    if(!v){stopScan();return;}
    v.srcObject=scanner;v.setAttribute('playsinline','');await v.play();
    $('#camera-wrap')?.classList.add('active');
    let detector=null;
    if('BarcodeDetector' in window){try{detector=new BarcodeDetector({formats:['qr_code']});}catch(err){console.warn('Se utilizará un lector QR alternativo',err);}}
    const jsqr=detector?null:await getQRScanner();
    if(!scanner||!v.isConnected)return;
    const canvas=detector?null:document.createElement('canvas');
    const ctx=canvas?.getContext('2d',{willReadFrequently:true});
    if(!detector&&!ctx)throw new Error('Este navegador no puede analizar la cámara. Usa el código manual.');
    let busy=false;
    scanLoop=setInterval(async()=>{
      if(busy||!scanner||v.readyState<2)return;
      busy=true;
      try{
        let code='';
        if(detector){const detected=await detector.detect(v);code=detected[0]?.rawValue||'';}
        else{
          const width=Math.min(640,v.videoWidth||640);
          const height=Math.round(width*(v.videoHeight||480)/Math.max(1,v.videoWidth||640));
          canvas.width=width;canvas.height=height;
          ctx.drawImage(v,0,0,width,height);
          const image=ctx.getImageData(0,0,width,height);
          code=jsqr(image.data,width,height,{inversionAttempts:'dontInvert'})?.data||'';
        }
        if(code){stopScan();await visit(code);}
      }catch(err){console.warn('Lectura QR:',err.message||err);}
      finally{busy=false;}
    },650);
  }catch(err){stopScan();toast('No se pudo usar el lector QR. Introduce el código manualmente. '+(err.message||''));}
}
async function execute(fn){try{await fn();}catch(err){console.error(err);toast(err.message||'Se ha producido un error.');}}
async function signInWithGoogle(button){
  if(!sb){formFeedback('El acceso con Google estará disponible cuando se configure Supabase.');return;}
  formFeedback('');
  const label=button.querySelector('.google-label');
  button.disabled=true;if(label)label.textContent='Conectando con Google…';
  try{
    // Supabase redirige a Google y luego regresa a esta misma página (flujo PKCE).
    const {error}=await sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:googleRedirectUrl()}});
    if(error)throw error;
  }catch(err){
    console.error('Inicio con Google:',err);
    formFeedback('No se ha podido conectar con Google. Comprueba que el proveedor Google esté activado en Supabase e inténtalo de nuevo.');
  }finally{
    if(button.isConnected){button.disabled=!live;if(label)label.textContent='Continuar con Google';}
  }
}
document.addEventListener('click',ev=>{const link=ev.target.closest('a[href^="#/"]');if(route==='/editor'&&editorDirty&&link&&link.getAttribute('href')!=='#/editor'&&link.target!=='_blank'&&!window.confirm('Tienes cambios sin guardar. ¿Quieres salir sin guardarlos?')){ev.preventDefault();ev.stopImmediatePropagation();}},true);
document.addEventListener('click',ev=>{const el=ev.target.closest('[data-action]');if(!el)return;const act=el.dataset.action;execute(async()=>{if(act.startsWith('editor-')){await editorAction(el,act);return;}if(act==='menu'){menuOpen=!menuOpen;$('#site-menu')?.classList.toggle('open',menuOpen);el.setAttribute('aria-expanded',String(menuOpen));el.setAttribute('aria-label',menuOpen?'Cerrar menú':'Abrir menú');el.textContent=menuOpen?'✕':'☰';return;}if(act==='install-app'){await installApp();return;}if(act==='auth-tab'){authNotice='';authTab=el.dataset.tab;render();return;}if(act==='google-login'){await signInWithGoogle(el);return;}if(act==='logout'){editorDraft=null;editorDirty=false;stopScan();if(!sb)throw new Error('Servicio no disponible.');await sb.auth.signOut();session=null;current=null;await loadPublic();to('/acceso');return;}if(act==='copy-code'){await navigator.clipboard.writeText(current.member_code);toast('Código copiado.');return;}if(act==='redeem'){await redeem(el.dataset.id);return;}if(act==='checkin'){await visit(el.dataset.code);return;}if(act==='validate'){await validate(el.dataset.code);return;}if(act==='scan'){await startScan();return;}if(act==='stop-scan'){stopScan();return;}if(act==='admin-tab'||act==='admin-go'){adminTab=el.dataset.tab;adminEditId=null;adminFormOpen=act==='admin-go'&&!el.dataset.list&&adminTab!=='site';render();if(adminFormOpen)focusAdminForm();return;}if(act==='admin-new'){adminTab=el.dataset.table;adminEditId=null;adminFormOpen=true;render();focusAdminForm();return;}if(act==='admin-edit'){adminTab=el.dataset.table;adminEditId=el.dataset.id;adminFormOpen=true;render();focusAdminForm();return;}if(act==='admin-cancel'){adminEditId=null;adminFormOpen=false;render();return;}if(act==='admin-delete'){await removeItem(el.dataset.table,el.dataset.id);return;}if(act==='toggle'){await toggle(el.dataset.table,el.dataset.id);return;}});});
async function handleAuthSubmit(fd){
  if(!sb)throw new Error('No se puede registrar ni iniciar sesión hasta que el propietario conecte Supabase.');
  const email=String(fd.get('email')||'').trim().toLowerCase();
  const password=String(fd.get('password')||'');
  const confirmPassword=String(fd.get('confirmPassword')||'');
  if(authTab==='reset'){
    if(password!==confirmPassword)throw new Error('Las contraseñas no coinciden.');
    const result=await sb.auth.updateUser({password});
    if(result.error)throw new Error(result.error.message);
    const out=await sb.auth.signOut();if(out.error)throw new Error(out.error.message);
    clearRecoveryUrl();session=null;current=null;await loadPublic();
    authNotice='Contraseña actualizada. Ya puedes entrar con tus nuevos datos.';
    to('/acceso');return;
  }
  if(authTab==='recover'){
    const res=await sb.auth.resetPasswordForEmail(email,{redirectTo:authRedirectUrl(true)});
    if(res.error)throw new Error(res.error.message);
    authNotice='Si el correo está registrado, recibirás un enlace para recuperar la contraseña. Revisa también la carpeta de spam.';
    to('/acceso');return;
  }
  if(authTab==='signup'){
    const name=String(fd.get('name')||'').trim();
    if(name.length<2)throw new Error('Introduce un nombre de al menos dos caracteres.');
    if(password!==confirmPassword)throw new Error('Las contraseñas no coinciden.');
    const res=await sb.auth.signUp({email,password,options:{data:{name},emailRedirectTo:authRedirectUrl()}});
    if(res.error)throw new Error(res.error.message);
    if(res.data.session){
      await loadLive();
      if(!current)throw new Error('La cuenta se creó, pero todavía no se encuentra su perfil. Vuelve a iniciar sesión.');
      authNotice='';to('/mi-espacio');toast('¡Tu cuenta está lista!');
    }else{
      authNotice='Solicitud recibida. Comprueba tu correo y confirma el registro antes de iniciar sesión. Si ya tenías una cuenta, utiliza el inicio de sesión o la recuperación de contraseña.';
      to('/acceso');
    }
    return;
  }
  const res=await sb.auth.signInWithPassword({email,password});
  if(res.error){
    if(res.error.code==='email_not_confirmed')throw new Error('Necesitas confirmar tu correo antes de iniciar sesión.');
    throw new Error('No se pudo iniciar sesión. Comprueba tu correo y contraseña.');
  }
  await loadLive();
  if(!current)throw new Error('Has iniciado sesión, pero no se encuentra tu ficha de socio. Contacta con la administración.');
  authNotice='';to(current.role==='admin'?'/panel':current.role==='puerta'?'/puerta':'/mi-espacio');
}
document.addEventListener('submit',ev=>{
  const el=ev.target;
  if(!['auth-form','profile-form','checkin-form','validate-form','admin-item-form','admin-site-form'].includes(el.id))return;
  ev.preventDefault();const fd=new FormData(el);
  if(el.id==='auth-form'){
    const button=el.querySelector('[type="submit"]');const text=button?.textContent;
    if(button){button.disabled=true;button.textContent='Procesando…';}
    formFeedback('');
    handleAuthSubmit(fd).catch(err=>{console.error(err);formFeedback(err.message||'No se pudo completar la operación.');}).finally(()=>{if(button?.isConnected){button.disabled=!live;button.textContent=text;}});
    return;
  }
  if(el.id==='admin-item-form'){saveAdminItem(el).catch(err=>{console.error(err);const box=el.querySelector('#admin-form-feedback');if(box){box.textContent=err.message;box.hidden=false;}});return;}
  if(el.id==='admin-site-form'){saveSiteForm(el).catch(err=>{console.error(err);const box=el.querySelector('#admin-form-feedback');if(box){box.textContent=err.message;box.hidden=false;}});return;}
  execute(async()=>{
    if(el.id==='profile-form'){
      const name=String(fd.get('name')||'').trim();if(name.length<2)throw new Error('Nombre demasiado corto.');
      const r=await sb.rpc('update_display_name',{p_name:name});if(r.error)throw new Error(r.error.message);
      await refresh();toast('Perfil actualizado.');return;
    }
    if(el.id==='checkin-form'){await visit(String(fd.get('code')||''));return;}
    if(el.id==='validate-form'){await validate(String(fd.get('code')||''));return;}
  });
});
document.addEventListener('change',ev=>{if(ev.target.matches('[data-editor-visibility]')){updateEditorValue(ev.target);return;}if(ev.target.id==='editor-logo-file'){editorUploadLogo(ev.target).catch(err=>toast(err.message));return;}if(ev.target.id==='admin-image'){const label=$('#admin-file-status');if(label)label.textContent=ev.target.files[0]?.name||'Ninguna foto seleccionada';}});
document.addEventListener('input',ev=>{if(ev.target.matches('[data-editor-field]')){updateEditorValue(ev.target);return;}if(ev.target.closest('#admin-item-form'))updateAdminPreview(ev.target.closest('#admin-item-form'));if(ev.target.id==='admin-list-search'){const value=ev.target.value.toLocaleLowerCase('es-ES').trim();const cards=Array.from(document.querySelectorAll('.admin-list-item'));let count=0;for(const card of cards){card.hidden=!card.dataset.search.includes(value);if(!card.hidden)count++;}const empty=$('#admin-search-empty');if(empty)empty.hidden=count>0;return;}if(ev.target.id==='member-search'){const value=ev.target.value;search=value;const cursor=ev.target.selectionStart;const row=ev.target.closest('.pane');const tbody=row?.querySelector('tbody');if(!tbody)return;const list=data.profiles.filter(x=>x.role==='socio'&&(x.name+' '+x.member_code).toLowerCase().includes(value.toLowerCase()));tbody.innerHTML=list.map(p=>`<tr><td><b>${H(p.name)}</b></td><td>${H(p.member_code)}</td><td><span class="role-chip">${H(tier(p.lifetime_points))}</span></td><td>${fmt(p.visits)}</td><td><button class="btn btn-secondary btn-mini" data-action="checkin" data-code="${H(p.member_code)}">Registrar visita</button></td></tr>`).join('')||'<tr><td colspan="5">No se encontraron socios.</td></tr>';}});
document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&menuOpen){menuOpen=false;const menu=$('#site-menu');menu?.classList.remove('open');const btn=$('.menu-toggle');btn?.setAttribute('aria-expanded','false');btn?.setAttribute('aria-label','Abrir menú');if(btn)btn.textContent='☰';btn?.focus();}});
document.addEventListener('click',ev=>{if(ev.target.closest('#site-menu a')){menuOpen=false;$('#site-menu')?.classList.remove('open');$('.menu-toggle')?.setAttribute('aria-expanded','false');}});
function updateKeyboardState(){const active=document.activeElement;document.body.classList.toggle('keyboard-active',!!active&&active.matches('input:not([type=checkbox]):not([type=radio]):not([type=file]),textarea,select'));}
document.addEventListener('focusin',updateKeyboardState);
document.addEventListener('focusout',()=>setTimeout(updateKeyboardState,0));
window.addEventListener('beforeunload',ev=>{if(editorDirty){ev.preventDefault();ev.returnValue='';}});
window.addEventListener('hashchange',()=>{execute(async()=>{await render();});});
init();
})();