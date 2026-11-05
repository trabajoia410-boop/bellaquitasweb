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
function emptyData(){ return {profiles:[],events:[],rewards:[],promos:[],redemptions:[],activity:[],site_content:[],site_drafts:[],member_changes:[]}; }
const tier = pts => pts>=2000?'Black':pts>=900?'VIP':pts>=500?'Gold':'Member';
const tierNext = pts => pts>=2000?null:[500,900,2000].find(v=>pts<v);
let sb = null, session = null, data = emptyData(), current = null;
let activeLang='es';
try{activeLang=localStorage.getItem('bellaquitas-lang')==='fr'?'fr':'es';}catch{}
const UI_FR={
 'Inicio':'Accueil','Experiencia':'Expériences','Eventos':'Événements','Ventajas':'Avantages','Preguntas':'Questions',
 'Iniciar sesión':'Se connecter','Crear cuenta':'Créer un compte','Cerrar sesión':'Déconnexion',
 'Mi espacio':'Mon espace','Mi tarjeta':'Ma carte','Premios':'Cadeaux','Perfil':'Profil',
 'Panel administrador':'Administration','Editar web':'Modifier le site','Puerta':'Contrôle',
 'Una comunidad. Tu espacio.':'Une communauté. Votre espace.',
 'Inicia sesión.':'Connectez-vous.','Crea tu cuenta.':'Créez votre compte.',
 'Recupera tu acceso.':'Récupérez votre accès.','Elige una contraseña nueva.':'Choisissez un nouveau mot de passe.',
 'Accede a tu tarjeta y a tu espacio personal.':'Accédez à votre carte et votre espace personnel.',
 'Regístrate para empezar con tu propia cuenta de Bellaquitas Fest.':'Inscrivez-vous pour commencer votre expérience Bellaquitas Fest.',
 'Te enviaremos un enlace para restablecer la contraseña.':'Nous vous enverrons un lien pour réinitialiser votre mot de passe.',
 'Escribe tu nueva contraseña para recuperar el acceso.':'Choisissez un nouveau mot de passe pour récupérer votre accès.',
 'Correo electrónico':'Adresse e-mail','Contraseña':'Mot de passe','Repetir contraseña':'Confirmer le mot de passe','Nombre':'Prénom ou nom',
 'Continuar con Google':'Continuer avec Google','o continúa con correo electrónico':'ou continuer avec une adresse e-mail',
 'Registrar mi cuenta':'Créer mon compte','Enviar enlace de recuperación':'Envoyer le lien de récupération','Guardar nueva contraseña':'Enregistrer le mot de passe',
 '¿Has olvidado tu contraseña?':'Mot de passe oublié ?', 'Volver a iniciar sesión':'Retour à la connexion',
 'Instalar la app':'Installer l’application','Preguntas frecuentes':'Questions fréquentes',
 'Volver a la web pública':'Retour au site',
 'Tu tarjeta de socio':'Votre carte de membre','Tu identificación digital para las actividades de la comunidad.':'Votre carte numérique pour les activités de la communauté.',
 'Mi perfil':'Mon profil','Gestiona los datos visibles de tu cuenta.':'Gérez les informations visibles de votre compte.',
 'CUENTA PERSONAL':'COMPTE PERSONNEL','Nombre visible':'Nom affiché','Código de socio':'Code membre','Tipo de cuenta':'Type de compte',
 'Guardar cambios':'Enregistrer','Socio/a':'Membre','Personal de puerta':'Contrôle d’accès','Administración':'Administration',
 'Una comunidad':'Une communauté','Momentos por vivir':'Des moments à vivre','Ventajas para socios':'Des avantages pour les membres',
 'La tarjeta de fidelidad':'La carte de fidélité','Descubre tu tarjeta de fidelidad Bellaquitas Fest.':'Découvrez votre carte de fidélité Bellaquitas Fest.',
 'Cara delantera':'Recto','Ver mi QR':'Voir mon QR','Mostrar QR':'Afficher le QR','Ver frente':'Voir le recto','Ampliar QR':'Agrandir le QR',
 'Tarjeta con la conejita':'Carte avec la mascotte','Reverso con QR personal':'Verso avec QR personnel',
 'Escanea este QR al entrar.':'Scannez ce QR à l’entrée.','TU CÓDIGO PERSONAL':'VOTRE CODE PERSONNEL',
 'Si no se puede leer el QR, el personal puede introducir el código manualmente.':'Si le QR ne peut être lu, le personnel peut saisir le code manuellement.',
 'Copiar código':'Copier le code','Cómo funciona':'Comment ça marche',
 'Muestra tu código a personal autorizado para validar una visita. No compartas capturas de tu tarjeta pública y libremente.':'Présentez votre code au personnel autorisé pour valider une visite. Ne partagez pas publiquement votre carte.',
 'Puntos disponibles':'Points disponibles','Visitas registradas':'Visites enregistrées','Ver mi tarjeta':'Voir ma carte',
 'Tu tarjeta de fidelidad':'Votre carte de fidélité','Disfruta de las ventajas de Bellaquitas Fest':'Profitez des avantages de Bellaquitas Fest',
 'Tus beneficios como miembro':'Vos avantages en tant que membre',
 'Entradas especiales':'Entrées spéciales','Descuentos exclusivos':'Réductions exclusives','Sorpresas y regalos':'Surprises et cadeaux',
 'Puntos y ventajas':'Points et avantages','Tu propio espacio':'Votre espace personnel',
 'Una tarjeta, todas tus ventajas.':'Une carte, tous vos avantages.',
 'Únete al club':'Rejoindre le club','Conoce los beneficios':'Découvrir les avantages',
 'Ver tarjeta':'Voir la carte', 'Tu nivel':'Votre niveau','Puntos históricos':'Points cumulés',
 'Tus puntos disponibles':'Vos points disponibles','Próximas experiencias':'Prochaines expériences',
 'Francés':'Français','Español':'Espagnol',
 'MI IDENTIDAD':'MON IDENTITÉ',
 'Buscar':'Rechercher','Buscar en Bellaquitas Fest':'Rechercher sur Bellaquitas Fest',
 'Buscar eventos, ventajas, tarjeta…':'Événements, avantages, carte…',
 'Cerrar búsqueda':'Fermer la recherche',
 'Volver a la portada':'Retour à l’accueil',
 'Experiencias de Bellaquitas':'Expériences Bellaquitas',
 'Tarjeta, puntos y beneficios':'Carte, points et avantages',
 'Registro e inicio de sesión':'Inscription et connexion',
 'Acceso a tu perfil':'Accéder à votre profil',
 'Evento':'Événement','Premio':'Récompense','puntos':'points',
 'No encontramos resultados. Prueba con otra palabra.':'Aucun résultat. Essayez un autre mot.',
 'Buscar premios y recompensas':'Rechercher des récompenses',
 'Busca por nombre o categoría…':'Chercher par nom ou catégorie…',
 'Buscar eventos':'Rechercher des événements',
 'Busca por nombre, fecha o lugar…':'Chercher par nom, date ou lieu…',
 'No hay premios que coincidan con la búsqueda.':'Aucune récompense ne correspond à votre recherche.',
 'No hay eventos que coincidan con la búsqueda.':'Aucun événement ne correspond à votre recherche.',
};
const UI_ALL_FR={...UI_FR,...(window.BELLAQUITAS_I18N_FR||{})};
function translateLabel(value,lang=activeLang,sourceSettings=null){
 const original=String(value??'');
 const copy=(sourceSettings||settings?.())?.ui_copy?.[lang];
 const override=copy?.[original.trim()];if(typeof override==='string')return override;
 if(lang!=='fr')return original;
 const translated=UI_ALL_FR[original.trim()];if(translated!==undefined)return translated;
 // Dynamic counter and point labels: do not translate names, emails, identifiers or codes.
 let m=original.trim().match(/^(\d+) resultados?$/);if(m)return `${m[1]} résultat${m[1]==='1'?'':'s'}`;
 m=original.trim().match(/^(\d+) visitas?$/);if(m)return `${m[1]} visite${m[1]==='1'?'':'s'}`;
 m=original.trim().match(/^(\d+) puntos?$/);if(m)return `${m[1]} points`;
 m=original.trim().match(/^En espera \((\d+)\)$/);if(m)return `En attente (${m[1]})`;
 m=original.trim().match(/^(.+) puntos históricos para el próximo nivel\.$/);if(m)return `${m[1]} points cumulés pour le prochain niveau.`;
 m=original.trim().match(/^\d+ en total · \d+ visibles para la gente$/);if(m)return original.replace('en total','au total').replace('visibles para la gente','visibles par le public');
 m=original.trim().match(/^Imagen de (.+)$/);if(m)return 'Image de '+m[1];
 m=original.trim().match(/^Vas a modificar la cuenta de ([^\n]+)\./);if(m)return original.replace('Vas a modificar la cuenta de','Vous allez modifier le compte de').replace('¿Confirmas los cambios?','Confirmez-vous ces modifications ?').replace('Se cambiará','Sera modifié');
 m=original.trim().match(/^Solicitar "(.+)" por (\d+) puntos\?$/);if(m)return `Demander « ${m[1]} » pour ${m[2]} points ?`;
 if(original.trim().startsWith('¿Quieres eliminar definitivamente'))return original.replace('¿Quieres eliminar definitivamente','Voulez-vous supprimer définitivement').replace('Esta acción no se puede deshacer.','Cette action est irréversible.').replace('Si solo quieres quitarlo de la web, pulsa Cancelar y usa Ocultar.','Pour le retirer du site sans le supprimer, cliquez sur Annuler puis sur Masquer.');
  m=original.trim().match(/^(NUEVO|EDITAR) (EVENTO|PREMIO|PROMOCIÓN)$/);if(m)return (m[1]==='NUEVO'?'CRÉER UNE ':'MODIFIER UNE ')+({EVENTO:'ÉVÉNEMENT',PREMIO:'RÉCOMPENSE',PROMOCIÓN:'PROMOTION'}[m[2]]);
 return original;
}
function t(v){return H(translateLabel(v));}
// Traducir también los textos y etiquetas estáticos de formularios, mensajes y paneles.
// El texto introducido en inputs no se modifica. El contenido de eventos se traduce mediante campos localizados.
function translateDOM(root=document,lang=activeLang,sourceSettings=null){
 if(!root)return;
 const candidates=[];
 for(const base of [root.querySelector?.('#app')||root,root.querySelector?.('#install-guide'),root.querySelector?.('#toast')]){
  if(!base||candidates.includes(base))continue;candidates.push(base);
  const walker=(base.ownerDocument||root).createTreeWalker(base,NodeFilter.SHOW_TEXT);
  let node;
  while((node=walker.nextNode())){
   const parent=node.parentElement;if(!parent||parent.closest('script,style,textarea,option[data-raw],.user-data,[data-no-translate]'))continue;
   const original=node.nodeValue||'',trimmed=original.trim();if(!trimmed)continue;
   const translated=translateLabel(trimmed,lang,sourceSettings);
   if(translated!==trimmed)node.nodeValue=original.replace(trimmed,translated);
  }
  base.querySelectorAll?.('[placeholder],[aria-label],[title]').forEach(el=>{
   for(const attr of ['placeholder','aria-label','title','alt']){
    const before=el.getAttribute(attr);if(!before)continue;
    const after=translateLabel(before,lang,sourceSettings);if(after!==before)el.setAttribute(attr,after);
   }
  });
 }
}
function localizedValue(entity,key){
 const raw=String(entity?.[key]??'');
 const translated=activeLang==='fr'?entity?.localized_content?.fr?.[key]:entity?.localized_content?.es?.[key];
 // No inventar traducciones de contenido personalizado que el autor aún no haya traducido.
 return typeof translated==='string'&&translated.trim()?translated:translateLabel(raw);
}
// Búsqueda pública: no consulta ni muestra datos privados de socios.
const searchFold=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-ES').trim();
function filterCatalogCards(input){
 const reward=input.id==='rewards-search',cards=document.querySelectorAll(reward?'.reward-grid .reward-card':'.three-grid .event-card');
 const needle=searchFold(input.value);let matches=0;
 for(const card of cards){card.hidden=!card.dataset.catalogSearch?.includes(needle);if(!card.hidden)matches++;}
 const empty=$('#'+(reward?'rewards-search-empty':'agenda-search-empty'));if(empty)empty.hidden=matches>0||!needle;
}
function siteSearchItems(){
 const content=publishedSettings();
 const items=[
  {title:t('Inicio'),detail:t('Volver a la portada'),route:'/',terms:'bellaquitas fest portada home accueil'},
  {title:siteText('experience_title'),detail:t('Experiencias de Bellaquitas'),route:'/experiencia',terms:'experiencia experiencias experience vivre eventos actividades'},
  {title:siteText('benefits_title'),detail:t('Tarjeta, puntos y beneficios'),route:'/ventajas',terms:'ventajas beneficios tarjeta fidelidad carte carte fidelite puntos puntos membresía promociones'},
  {title:siteText('faq_title'),detail:t('Preguntas frecuentes'),route:'/preguntas',terms:'ayuda dudas preguntas questions frecuentes'},
  {title:t('Crear cuenta'),detail:t('Registro e inicio de sesión'),route:'/registro',terms:'crear cuenta registro registrarse inscription cuenta'},
  {title:t('Iniciar sesión'),detail:t('Acceso a tu perfil'),route:'/acceso',terms:'login acceder cuenta perfil entrer connexion'},
  ...data.events.filter(e=>e.active).map(e=>({title:localizedValue(e,'name'),detail:t('Evento')+' · '+eventDate(e.date_label,e.start_time),route:'/eventos',terms:String(e.description||'')+' '+String(e.location||'')+' '+String(e.date_label||'')+' eventos'})),
  ...data.rewards.filter(r=>r.active).map(r=>({title:localizedValue(r,'name'),detail:t('Premio')+' · '+fmt(r.cost)+' '+t('puntos'),route:'/acceso',terms:String(r.description||'')+' '+String(r.category||'')+' recompensa premio'}))
 ];
 return items.filter(i=>i.title);
}
function searchPanel(){return `<div class="site-search-panel" id="site-search-panel" hidden><label for="site-search-input">${t('Buscar en Bellaquitas Fest')}</label><div class="site-search-entry"><span aria-hidden="true">⌕</span><input type="search" id="site-search-input" autocomplete="off" placeholder="${t('Buscar eventos, ventajas, tarjeta…')}" aria-controls="site-search-results"/><button type="button" data-action="close-search" aria-label="${t('Cerrar búsqueda')}">✕</button></div><div id="site-search-results" class="site-search-results" role="status" aria-live="polite"></div></div>`;}
function renderSiteSearch(){
 const input=$('#site-search-input'),box=$('#site-search-results');if(!input||!box)return;
 const needle=searchFold(input.value);const matches=siteSearchItems().filter(i=>!needle||searchFold(i.title+' '+i.detail+' '+i.terms).includes(needle)).slice(0,12);
 box.innerHTML=matches.length?matches.map(i=>`<a class="site-search-result" href="#${H(i.route)}"><strong>${H(i.title)}</strong><small>${H(i.detail)}</small><span aria-hidden="true">↗</span></a>`).join(''):`<p class="site-search-empty">${t('No encontramos resultados. Prueba con otra palabra.')}</p>`;
}
function setSiteSearchOpen(open){
 const panel=$('#site-search-panel');if(!panel)return;
 panel.hidden=!open;const button=$('[data-action="open-search"]');if(button)button.setAttribute('aria-expanded',String(open));
 if(open){menuOpen=false;$('#site-menu')?.classList.remove('open');const toggle=$('.menu-toggle');if(toggle){toggle.setAttribute('aria-expanded','false');toggle.textContent='☰';}renderSiteSearch();setTimeout(()=>$('#site-search-input')?.focus({preventScroll:true}),0);}
}
function langSwitcher(){return `<div class="lang-switch" role="group" aria-label="Idioma / Langue"><span class="lang-globe" aria-hidden="true">🌐</span><button type="button" data-action="set-lang" data-lang="es" class="lang-choice ${activeLang==='es'?'active':''}" aria-pressed="${activeLang==='es'}"><span class="lang-full">Español</span><span class="lang-short">ES</span></button><span class="lang-sep" aria-hidden="true">·</span><button type="button" data-action="set-lang" data-lang="fr" class="lang-choice ${activeLang==='fr'?'active':''}" aria-pressed="${activeLang==='fr'}"><span class="lang-full">Français</span><span class="lang-short">FR</span></button></div>`;}

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
  else window.alert(translateLabel('iPhone: abre Safari, pulsa Compartir y Añadir a pantalla de inicio. Android: abre Chrome y pulsa Instalar aplicación en el menú.'));
}
if('serviceWorker' in navigator && /^https?:$/.test(location.protocol)){
  window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(err=>console.warn('Instalación PWA no disponible:',err)));
}
let authTab = 'login', authNotice = '', adminTab='summary', adminEditId=null, adminFormOpen=false, memberEditId=null, memberSearch='', memberRoleFilter='all', search='', scanner=null, scanLoop=null, noticeTimer=null, menuOpen=false;
const AUTH_ROUTES = {'/acceso':'login','/iniciar-sesion':'login','/registro':'signup','/recuperar':'recover','/restablecer':'reset'};
function authRedirectUrl(recovery=false){const url=new URL(window.location.href);url.hash='';url.search='';if(recovery)url.searchParams.set('recuperar','1');return url.toString();}
// El retorno de Google identifica el flujo sin guardar contraseñas ni tokens en la URL.
function googleRedirectUrl(){const url=new URL(authRedirectUrl());url.searchParams.set('acceso','google');return url.toString();}
function cleanGoogleReturnUrl(){const url=new URL(window.location.href);for(const key of ['acceso','code','error','error_code','error_description'])url.searchParams.delete(key);history.replaceState(null,'',url.pathname+url.search+url.hash);}
function destinationForUser(){return current?.role==='admin'?'/panel':current?.role==='puerta'?'/puerta':'/mi-espacio';}
function formFeedback(message){const box=$('#auth-feedback');if(!box)return;box.textContent=translateLabel(message);box.hidden=!message;}
function clearRecoveryUrl(){const url=new URL(window.location.href);url.searchParams.delete('recuperar');url.searchParams.delete('code');history.replaceState(null,'',url.pathname+url.search+url.hash);}

let route = location.hash.slice(1) || '/';
const ico = {editor:'✎', home:'⌂', card:'◈', rewards:'✦', events:'▦', profile:'♙', gate:'◎', admin:'▥', logout:'↪'};
const byDate = (a,b) => String(b.created_at||b.date||'').localeCompare(String(a.created_at||a.date||''));
function getProfile(id) { return data.profiles.find(p=>p.id===id); }
function getReward(id) { return data.rewards.find(r=>r.id===id); }
// Los cambios publicados se leen de site_content; los borradores tienen su propia tabla privada.
const SITE_DEFAULTS = {
  theme:'classic', logo_url:'', header_logo_url:'', hero_video_url:'', experience_video_url:'', header_show_logo:true, header_show_text:true, hero_show_logo:true, ui_copy:{es:{},fr:{}}, brand_title:'BELLAQUITAS', brand_suffix:'FEST',
  nav_home:'Inicio', icon_home:'⌂', icon_card:'◈', icon_rewards:'✦', icon_events:'▦', icon_profile:'♙', icon_gate:'◎', icon_admin:'▥', icon_logout:'↪', nav_experience:'Experiencia', nav_events:'Eventos', nav_benefits:'Ventajas', nav_faq:'Preguntas',
  hero_eyebrow:'UNA COMUNIDAD. UNA EXPERIENCIA.', hero_title_a:'VIVE EL', hero_title_b:'MOMENTO.',
  hero_text:'Tu tarjeta, tus puntos, tus experiencias.',
  hero_tag_a_icon:'✦', hero_tag_a_title:'BELLAQUITAS CLUB', hero_tag_a_desc:'', hero_tag_b_icon:'♛', hero_tag_b_title:'MEMBER EXPERIENCE', hero_tag_b_desc:'',
  hero_primary:'Únete al club', hero_secondary:'Conoce los beneficios',
  hero_stat_1:'Una comunidad',hero_stat_2:'Momentos por vivir',hero_stat_3:'Ventajas para socios',
  announcement_brand:'BELLAQUITAS FEST',announcement:'Tu tarjeta, tus puntos, tus experiencias.',
  experience_eyebrow:'LA EXPERIENCIA',experience_title:'Todo empieza contigo.',experience_desc:'Una nueva forma de disfrutar de todo lo que ocurre en Bellaquitas Fest.',
  feature_1_icon:'♛', feature_1_title:'Tu propio espacio', feature_1_desc:'Accede a tu cuenta, consulta tu tarjeta digital y lleva tu historial siempre contigo.',
  feature_2_icon:'✧', feature_2_title:'Puntos y ventajas', feature_2_desc:'Acumula puntos por actividades validadas y descubre recompensas pensadas para ti.',
  feature_3_icon:'▦', feature_3_title:'Experiencias', feature_3_desc:'Descubre las próximas novedades y actividades de la comunidad.',
  events_eyebrow:'EVENTOS PUBLICADOS',events_title:'Próximos encuentros.', events_desc:'Descubre los eventos que ha publicado nuestro equipo.',
  events_empty_title:'Lo que está por venir.',events_empty_desc:'Las fechas definitivas se anunciarán cuando estén confirmadas.',
  benefits_eyebrow:'BELLAQUITAS CLUB',benefits_title:'Ser parte tiene premio.',benefits_desc:'Una tarjeta digital para tu comunidad y sus ventajas.',
  benefits_card_eyebrow:'TU TARJETA DIGITAL',benefits_card_title:'Todo en una tarjeta.',benefits_card_desc:'Tu código de socio, tus puntos y tus ventajas reunidos en un mismo lugar.',benefits_card_button:'Acceder a mi tarjeta',
  benefit_1_icon:'✦', benefit_1_title:'Acumula puntos', benefit_1_desc:'Consigue puntos por participaciones autorizadas y visitas registradas.',
  benefit_2_icon:'♛', benefit_2_title:'Sube de categoría', benefit_2_desc:'Member, Gold, VIP y Black: cada etapa reconoce tu participación.',
  benefit_3_icon:'🎁', benefit_3_title:'Canjea recompensas',benefit_3_desc:'Explora el catálogo y solicita los premios disponibles.',
  benefit_4_icon:'◎', benefit_4_title:'Acceso personal',benefit_4_desc:'Las herramientas de gestión están reservadas a las cuentas autorizadas.',
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
  main:[['brand_title','Nombre de la cabecera'],['brand_suffix','Segunda línea del nombre'],['header_logo_url','Imagen de la cabecera (independiente)','image'],['header_show_logo','Mostrar imagen de cabecera','checkbox'],['header_show_text','Mostrar nombre junto al logo','checkbox'],['hero_show_logo','Mostrar logo grande de portada','checkbox'],['hero_eyebrow','Frase pequeña de arriba'],['hero_title_a','Primera línea del título'],['hero_title_b','Segunda línea del título'],['hero_text','Texto de presentación','textarea'],['hero_tag_a_icon','Cartel junto al logo · icono 1'],['hero_tag_a_title','Cartel junto al logo · título 1'],['hero_tag_a_desc','Cartel junto al logo · texto 1'],['hero_tag_b_icon','Cartel junto al logo · icono 2'],['hero_tag_b_title','Cartel junto al logo · título 2'],['hero_tag_b_desc','Cartel junto al logo · texto 2'],['hero_primary','Botón principal'],['hero_secondary','Segundo botón'],['hero_stat_1','Etiqueta 1'],['hero_stat_2','Etiqueta 2'],['hero_stat_3','Etiqueta 3'],['announcement_brand','Nombre de la banda'],['announcement','Frase de la banda'],['hero_video_url','Vídeo cinematográfico de portada (URL MP4/WebM)','video'],['experience_video_url','Segundo vídeo de fondo · Experiencia (URL MP4/WebM)','video'],['logo_url','Imagen principal / logotipo (URL segura)','image']],
  experience:[['experience_eyebrow','Texto pequeño'],['experience_title','Título'],['experience_desc','Descripción','textarea'],['feature_1_icon','Tarjeta 1 · icono'],['feature_1_title','Tarjeta 1 · título'],['feature_1_desc','Tarjeta 1 · texto','textarea'],['feature_2_icon','Tarjeta 2 · icono'],['feature_2_title','Tarjeta 2 · título'],['feature_2_desc','Tarjeta 2 · texto','textarea'],['feature_3_icon','Tarjeta 3 · icono'],['feature_3_title','Tarjeta 3 · título'],['feature_3_desc','Tarjeta 3 · texto','textarea']],
  events:[['events_eyebrow','Etiqueta cuando hay eventos'],['events_title','Título cuando hay eventos'],['events_desc','Descripción con eventos','textarea'],['events_empty_title','Título si no hay eventos'],['events_empty_desc','Descripción si no hay eventos','textarea']],
  benefits:[['benefits_eyebrow','Texto pequeño'],['benefits_title','Título'],['benefits_desc','Descripción','textarea'],['benefits_card_eyebrow','Tarjeta principal · etiqueta'],['benefits_card_title','Tarjeta principal · título'],['benefits_card_desc','Tarjeta principal · texto','textarea'],['benefits_card_button','Botón de la tarjeta'],['benefit_1_icon','Ventaja 1 · icono'],['benefit_1_title','Ventaja 1 · título'],['benefit_1_desc','Ventaja 1 · texto','textarea'],['benefit_2_icon','Ventaja 2 · icono'],['benefit_2_title','Ventaja 2 · título'],['benefit_2_desc','Ventaja 2 · texto','textarea'],['benefit_3_icon','Ventaja 3 · icono'],['benefit_3_title','Ventaja 3 · título'],['benefit_3_desc','Ventaja 3 · texto','textarea'],['benefit_4_icon','Ventaja 4 · icono'],['benefit_4_title','Ventaja 4 · título'],['benefit_4_desc','Ventaja 4 · texto','textarea']],
  faq:[['faq_eyebrow','Texto pequeño'],['faq_title','Título'],...Array.from({length:4},(_,i)=>[[`faq_${i+1}_q`,`Pregunta ${i+1}`],[`faq_${i+1}_a`,`Respuesta ${i+1}`,'textarea']]).flat()],
  cta:[['cta_eyebrow','Texto pequeño'],['cta_title','Título final'],['cta_desc','Texto de invitación','textarea'],['cta_button','Texto del botón']],
  other:[['nav_home','Menú: Inicio'],['icon_home','Icono del inicio'],['icon_card','Icono de mi tarjeta'],['icon_rewards','Icono de premios'],['icon_events','Icono de eventos'],['icon_profile','Icono del perfil'],['icon_gate','Icono del personal de puerta'],['icon_admin','Icono del administrador'],['icon_logout','Icono de salir'],['brand_title','Nombre de la cabecera'],['brand_suffix','Segunda línea del nombre'],['header_logo_url','Imagen de cabecera (independiente)','image'],['header_show_logo','Mostrar imagen de cabecera','checkbox'],['header_show_text','Mostrar nombre junto al logo','checkbox'],['nav_experience','Menú: Experiencia'],['nav_events','Menú: Eventos'],['nav_benefits','Menú: Ventajas'],['nav_faq','Menú: Preguntas'],['footer_desc','Pie de página · lema']]
};
let editorDraft=null,editorDirty=false,editorCategory='main',editorDevice='desktop',editorPreviewOverride=null,editorBusy=false,editorSelection=null,editorPage='home',editorLanguage=activeLang;
function publishedSettings(){const row=data.site_content.find(x=>x.key==='homepage')||{};return {...SITE_DEFAULTS,hero_text:row.hero_text||SITE_DEFAULTS.hero_text,announcement:row.announcement||SITE_DEFAULTS.announcement,...(row.page_settings||{}),visible:{...SITE_DEFAULTS.visible,...(row.page_settings?.visible||{})},order:validOrder(row.page_settings?.order)};}
function validOrder(order){const keys=Object.keys(EDITOR_SECTIONS);return Array.isArray(order)?[...new Set(order.filter(x=>keys.includes(x))),...keys.filter(x=>!order.includes(x))]:keys;}
function settings(){return editorPreviewOverride||publishedSettings();}
const FR_SITE={
 nav_experience:'Expériences',nav_events:'Événements',nav_benefits:'Avantages',nav_faq:'Questions',
 hero_eyebrow:'UNE COMMUNAUTÉ. UNE EXPÉRIENCE.',hero_title_a:'VIVEZ LE',hero_title_b:'MOMENT.',
 hero_text:'Votre carte, vos points, vos expériences.',
 hero_primary:'Rejoindre le club',hero_secondary:'Découvrir les avantages',hero_stat_1:'Une communauté',hero_stat_2:'Des moments à vivre',hero_stat_3:'Avantages membres',
 announcement:'Votre carte, vos points, vos expériences.',
 experience_eyebrow:'L’EXPÉRIENCE',experience_title:'Tout commence avec vous.',experience_desc:'Une nouvelle façon de profiter de Bellaquitas Fest.',
 feature_1_title:'Votre espace personnel',feature_1_desc:'Accédez à votre compte, votre carte numérique et votre historique.',
 feature_2_title:'Points et avantages',feature_2_desc:'Cumulez des points et découvrez des récompenses.',
 feature_3_title:'Expériences',feature_3_desc:'Découvrez les nouveautés et activités de la communauté.',
 benefits_eyebrow:'BELLAQUITAS CLUB',benefits_title:'Être membre, ça rapporte.',benefits_desc:'Une carte numérique et des avantages pour la communauté.',
 benefits_card_eyebrow:'VOTRE CARTE NUMÉRIQUE',benefits_card_title:'Tous vos avantages sur une carte.',benefits_card_desc:'Votre code de membre, vos points et vos avantages au même endroit.', benefits_card_button:'Accéder à ma carte',
 benefit_1_title:'Cumulez des points',benefit_1_desc:'Gagnez des points lors de visites ou participations validées.',
 benefit_2_title:'Passez au niveau supérieur',benefit_2_desc:'Member, Gold, VIP et Black : progressez à votre rythme.',
 benefit_3_title:'Échangez vos récompenses',benefit_3_desc:'Découvrez le catalogue et demandez vos cadeaux.',
 benefit_4_title:'Accès personnel',benefit_4_desc:'Les outils de gestion sont réservés aux comptes autorisés.',
 faq_eyebrow:'VOS QUESTIONS',faq_title:'Questions fréquentes.',
 cta_eyebrow:'DÉJÀ MEMBRE ?',cta_title:'Votre place est ici.',cta_desc:'Accédez à votre espace et découvrez vos avantages.',cta_button:'Se connecter',
  events_empty_title:'Ce qui arrive bientôt.',events_empty_desc:'Les dates seront annoncées dès leur confirmation.',
  events_eyebrow:'ÉVÉNEMENTS PUBLIÉS',events_title:'Nos prochains rendez-vous.',events_desc:'Découvrez les événements publiés par notre équipe.',
  faq_1_q:'Comment obtenir ma carte ?',faq_1_a:'Connectez-vous pour voir votre code de membre et votre QR personnel.',
  faq_2_q:'Comment gagner des points ?',faq_2_a:'Des points sont ajoutés après une visite ou une activité validée.',
  faq_3_q:'Où voir mes cadeaux ?',faq_3_a:'Retrouvez le catalogue de récompenses dans votre compte.',
  faq_4_q:'Tout le monde peut-il accéder à l’administration ?',faq_4_a:'Non, seuls les comptes autorisés disposent de cet accès.',
 footer_desc:'Des expériences qui nous rapprochent.'
};
function siteText(field,fallback=''){
 const content=settings();const raw=typeof content[field]==='string'?content[field]:(fallback||SITE_DEFAULTS[field]||'');
 const lang=editorPreviewOverride?editorLanguage:activeLang;
 if(lang==='fr'){
  const localized=content.translations?.fr?.[field];
  if(typeof localized==='string')return localized;
  if(FR_SITE[field] && raw===SITE_DEFAULTS[field])return FR_SITE[field];
  return translateLabel(raw,'fr');
 }
 const localized=content.translations?.es?.[field];
 return typeof localized==='string'?localized:raw;
}
function headerImage(){return safeImage(settings().header_logo_url)||siteImage();}
function headerBrand(preview=false){
 const brandText=settings().header_show_text!==false?`<span class="brand-wordmark">${preview?`<span data-edit-field="brand_title">${H(siteText('brand_title'))}</span>`:H(siteText('brand_title'))} <em>${preview?`<span data-edit-field="brand_suffix">${H(siteText('brand_suffix'))}</span>`:H(siteText('brand_suffix'))}</em></span>`:'';
 const brandImage=settings().header_show_logo!==false?`<span class="brand-symbol" ${preview?'data-edit-image="header_logo_url" role="button" tabindex="0" aria-label="Editar imagen de cabecera"':''}><img class="brand-logo-image" src="${H(headerImage())}" alt=""/></span>`:'';
 return brandImage+brandText;
}
function showSection(key){return settings().visible?.[key]!==false;}
function siteImage(){return safeImage(siteText('logo_url'))||'assets/logo-bellaquitas.webp';}
function eventDate(value,time){if(!value)return 'Fecha por confirmar';const iso=/^\d{4}-\d{2}-\d{2}$/.test(value);const friendly=iso?new Date(value+'T12:00:00').toLocaleDateString(activeLang==='fr'?'fr-FR':'es-ES',{day:'numeric',month:'long',year:'numeric'}):value;return friendly+(time?' · '+String(time).slice(0,5):'');}
function safeImage(url){const v=String(url||'');return /^https:\/\//i.test(v)?v:'';}
const MEDIA_BUCKET='bellaquitas-media';
function storageKeyFromPublicUrl(url){
 if(!url)return '';
 try{
  const parsed=new URL(String(url),location.href);
  const marker='/storage/v1/object/public/'+MEDIA_BUCKET+'/';
  const i=parsed.pathname.indexOf(marker);
  return i>=0?decodeURIComponent(parsed.pathname.slice(i+marker.length)):'';
 }catch{return '';}
}
async function removeStoredPublicUrl(url){
 const key=storageKeyFromPublicUrl(url);
 if(!key||!sb)return false;
 const {error}=await sb.storage.from(MEDIA_BUCKET).remove([key]);
 if(error){console.warn('No se pudo eliminar la imagen anterior:',error.message);return false;}
 return true;
}
function adminMeta(table,x){return table==='events'?eventDate(x.date_label,x.start_time)+' · '+x.location:table==='rewards'?`${fmt(x.cost)} puntos · ${x.category}`:`+${fmt(x.bonus)} puntos`;}
function adminLabel(table){return {events:'evento',rewards:'premio',promos:'promoción'}[table]||'contenido';}
function focusAdminForm(){requestAnimationFrame(()=>document.getElementById('admin-item-form')?.querySelector('input[name="name"]')?.focus());}
function recentDate(d) { try {return new Date(d).toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'numeric'});}catch {return '—';} }
function ask(message){return window.confirm(translateLabel(message));}
function toast(message) {const el=$('#toast'); if(!el)return;clearTimeout(noticeTimer);el.textContent=translateLabel(message);el.classList.add('show');noticeTimer=setTimeout(()=>el.classList.remove('show'),4000);}
function header(){
 const preview=!!editorPreviewOverride;
 const authActions=current&&!preview?`<a href="#${current.role==='admin'?'/panel':'/mi-espacio'}" class="btn btn-secondary btn-mini">${current.role==='admin'?'Panel':t('Mi espacio')}</a>${current.role==='admin'?'<a href="#/editor" class="btn btn-primary btn-mini admin-edit-top">✎ Editar web</a>':''}`:`<a href="#/acceso" class="btn btn-secondary btn-mini">${t('Iniciar sesión')}</a><a href="#/registro" class="btn btn-primary btn-mini">${t('Crear cuenta')} ↗</a>`;
 const tickerText=H(siteText('announcement')),tickerBrand=H(siteText('announcement_brand'));
 const tickerSet=`<span class="bf-ticker-set"><b>✦ ${tickerBrand}</b><span>✦</span><span>${tickerText}</span><span>✦</span><span>${H(siteText('hero_eyebrow'))}</span></span>`;
 const topbar=`<div class="bf-topbar" role="region" aria-label="${activeLang==='fr'?'Actualités Bellaquitas Fest':'Novedades de Bellaquitas Fest'}"><div class="bf-topbar-track" aria-hidden="true">${tickerSet}${tickerSet}</div></div>`;
 const nav=[['experience','experiencia','nav_experience'],['events','eventos','nav_events'],['benefits','ventajas','nav_benefits'],['faq','preguntas','nav_faq']].filter(([key])=>showSection(key)).map(([,path,label])=>`<a class="nav-link" href="#/${path}">${preview?`<span data-edit-field="${label}">${H(siteText(label))}</span>`:H(siteText(label))}</a>`).join('');
 const menuAccount=current&&!preview?`<a class="btn btn-secondary" href="#${destinationForUser()}">Mi cuenta</a>${current.role==='admin'?'<a class="btn btn-primary" href="#/editor">✎ Editar web</a>':''}`:`<a class="btn btn-secondary" href="#/acceso">${t('Iniciar sesión')}</a><a class="btn btn-primary" href="#/registro">${t('Crear cuenta')}</a>`;
 return `${topbar}<header class="site-header"><div class="container nav-wrap"><a class="brand" href="#/" aria-label="Bellaquitas Fest, inicio">${headerBrand(preview)}</a><nav id="site-menu" class="main-nav ${menuOpen?'open':''}" aria-label="Navegación principal"><a class="nav-link" href="#/">${preview?`<span data-edit-field="nav_home">${H(siteText('nav_home'))}</span>`:H(siteText('nav_home'))}</a>${nav}<div class="mobile-menu-actions">${menuAccount}</div><button type="button" class="menu-install" data-action="install-app">📲 Instalar la app</button></nav><div class="nav-actions">${langSwitcher()}<button class="header-search-button" type="button" data-action="open-search" aria-label="${t('Buscar')}" aria-expanded="false" aria-controls="site-search-panel" title="${t('Buscar')}">⌕</button>${authActions}<button class="btn btn-secondary btn-mini menu-toggle ${menuOpen?'is-open':''}" type="button" data-action="menu" aria-controls="site-menu" aria-expanded="${menuOpen}" aria-label="${menuOpen?'Cerrar menú':'Abrir menú'}"><span class="bf-menu-lines" aria-hidden="true"><i></i><i></i><i></i></span></button></div></div>${searchPanel()}</header>`;
}
function footer(){return `<footer class="footer"><div class="container footer-flex"><div class="brand">${headerBrand(!!editorPreviewOverride)}</div><p>© ${new Date().getFullYear()} Bellaquitas Fest. ${editorPreviewOverride?`<span data-edit-field="footer_desc">${H(siteText('footer_desc'))}</span>`:H(siteText('footer_desc'))}</p><p>${showSection('faq')?'<a href="#/preguntas">Preguntas frecuentes</a> · ':''}<a href="#/acceso">${t('Iniciar sesión')}</a> · <a href="#/registro">${t('Crear cuenta')}</a></p><button type="button" class="footer-install" data-action="install-app">📲 Instalar la app</button></div></footer>`;}
function publicEvents(limit=3){return data.events.filter(x=>x.active).sort((a,b)=>(a.date_label||'9999').localeCompare(b.date_label||'9999')).slice(0,limit).map((e,i)=>`<article class="event-card" data-catalog-search="${H(searchFold(e.name+' '+(e.description||'')+' '+e.location+' '+e.date_label))}" ${editorPreviewOverride?`data-edit-event-id="${H(e.id)}"`:``}>${safeImage(e.image_url)?`<img class="event-photo" src="${H(safeImage(e.image_url))}" alt="Imagen de ${H(e.name)}" loading="lazy"/>`:``}<div class="event-top"><span class="pill"><span class="dot"></span> ${H(eventDate(e.date_label,e.start_time))}</span><span class="event-num">0${i+1}</span></div><h3>${H(localizedValue(e,'name'))}</h3><p>${H(localizedValue(e,'description'))}</p><div class="event-meta"><span>📍 ${H(e.location)}</span></div></article>`).join('')||'<p class="empty">No hay eventos publicados por ahora.</p>';}
// Los vídeos de las referencias no se copian: aceptar únicamente material propio o autorizado.
function safeVideoUrl(value){
 const url=String(value||'').trim();
 if(!(/^(https:\/\/|assets\/)/i.test(url)))return '';
 if(!(/\.(mp4|webm)(?:[?#].*)?$/i.test(url)))return '';
 if(/[\s<>"'\x60]/.test(url))return '';
 return url;
}
function ambientVideo(value,cls){
 const src=safeVideoUrl(value);if(!src)return '';
 const type=/\.webm(?:[?#]|$)/i.test(src)?'video/webm':'video/mp4';
 return `<video class="${cls}" autoplay muted loop playsinline preload="none" aria-hidden="true" tabindex="-1"><source src="${H(src)}" type="${type}"></video>`;
}
function animatedMarquee(){
 const title=H(siteText('hero_title_a'))+' '+H(siteText('hero_title_b'));
 const segment=`<span class="bf-marquee-item">${title}<b aria-hidden="true">✦</b>BELLAQUITAS FEST<b aria-hidden="true">✦</b></span>`;
 const group=`<span class="bf-marquee-set">${segment}${segment}</span>`;
 return `<section class="bf-marquee" aria-label="${H(siteText('hero_title_a')+' '+siteText('hero_title_b'))}"><div class="bf-marquee-track" aria-hidden="true">${group}${group}</div></section>`;
}
function landing(sectionOnly=""){
 const txt=k=>editorPreviewOverride?`<span data-edit-field="${H(k)}">${H(siteText(k))}</span>`:H(siteText(k));
 const hasEvents=data.events.some(x=>x.active);
 const blocks={
  experience:`<section class="section bf-experience-section" id="experiencia" ${editorPreviewOverride?'data-edit-section="experience"':''}>${ambientVideo(settings().experience_video_url,'bf-experience-video')}<div class="container"><div class="section-head"><div><span class="eyebrow">${txt('experience_eyebrow')}</span><h2>${txt('experience_title')}</h2><p>${txt('experience_desc')}</p></div></div><div class="three-grid">${[1,2,3].map((n)=>`<article class="feature"><div class="feature-icon">${txt('feature_'+n+'_icon')}</div><h3>${txt('feature_'+n+'_title')}</h3><p>${txt('feature_'+n+'_desc')}</p></article>`).join('')}</div></div></section>`,
  events:`<section class="section" id="eventos" ${editorPreviewOverride?'data-edit-section="events"':''}><div class="container"><div class="section-head"><div><span class="eyebrow">${hasEvents?txt('events_eyebrow'):'PRÓXIMAMENTE'}</span><h2>${hasEvents?txt('events_title'):txt('events_empty_title')}</h2><p>${hasEvents?txt('events_desc'):txt('events_empty_desc')}</p></div><a class="btn btn-secondary btn-mini" href="#/acceso">Ver en mi cuenta ↗</a></div><div class="three-grid">${publicEvents()}</div></div></section>`,
  benefits:`<section class="section" id="ventajas" ${editorPreviewOverride?'data-edit-section="benefits"':''}><div class="container"><div class="section-head"><div><span class="eyebrow">${txt('benefits_eyebrow')}</span><h2>${txt('benefits_title')}</h2><p>${txt('benefits_desc')}</p></div></div><div class="benefit-grid"><div class="big-benefit"><div class="eyebrow">${txt('benefits_card_eyebrow')}</div><div class="loyalty-showcase"><a href="#/tarjeta" aria-label="Ver tarjeta de fidelidad"><img src="assets/tarjeta-conejita-frente.webp" alt="Bellaquitas Fest: tarjeta de fidelidad con la conejita" loading="lazy"/></a></div><h3>${txt('benefits_card_title')}</h3><p>${txt('benefits_card_desc')}</p><a href="${current?'#/tarjeta':'#/registro'}" class="btn btn-primary">${txt('benefits_card_button')} ↗</a></div><div class="list-benefits">${[1,2,3,4].map(n=>`<div class="benefit-item"><div class="round-icon">${txt('benefit_'+n+'_icon')}</div><div><strong>${txt('benefit_'+n+'_title')}</strong><p>${txt('benefit_'+n+'_desc')}</p></div></div>`).join('')}</div></div></div></section>`,
  faq:`<section class="section" id="preguntas" ${editorPreviewOverride?'data-edit-section="faq"':''}><div class="container"><div class="section-head"><div><span class="eyebrow">${txt('faq_eyebrow')}</span><h2>${txt('faq_title')}</h2></div></div><div class="faq-list">${[1,2,3,4].map(n=>`<div class="faq-card"><h3>${txt('faq_'+n+'_q')}</h3><p>${txt('faq_'+n+'_a')}</p></div>`).join('')}</div></div></section>`,
  cta:`<section class="section" id="unete" ${editorPreviewOverride?'data-edit-section="cta"':''} style="padding-top:15px"><div class="container"><div class="cta-banner"><div><div class="eyebrow">${txt('cta_eyebrow')}</div><h2>${txt('cta_title')}</h2><p>${txt('cta_desc')}</p></div><a href="#/acceso" class="btn btn-primary">${txt('cta_button')} ↗</a></div></div></section>`
 };
 const blockHTML=validOrder(settings().order).filter(k=>showSection(k)).map(k=>`<div class="line"></div>${blocks[k]}`).join('');
 if(sectionOnly&&Object.prototype.hasOwnProperty.call(blocks,sectionOnly)){
  const title=siteText({experience:'experience_title',events:'events_title',benefits:'benefits_title',faq:'faq_title',cta:'cta_title'}[sectionOnly]);
  return `${header()}<main class="standalone-page"><div class="container standalone-navigation"><a href="#/" class="btn btn-secondary btn-mini">← ${t('Inicio')}</a><strong>${H(title)}</strong></div>${blocks[sectionOnly]}</main>${footer()}`;
 }
 return `${header()}<main><section class="hero" id="inicio">${ambientVideo(settings().hero_video_url,'bf-hero-video')}<div class="container hero-inner"><div class="hero-copy"><div class="eyebrow">✦ ${txt('hero_eyebrow')}</div><h1>${txt('hero_title_a')}<br/><span>${txt('hero_title_b')}</span></h1><p>${txt('hero_text')}</p><div class="hero-cta"><a class="btn btn-primary" href="${current?'#/mi-espacio':'#/registro'}">${txt('hero_primary')} <span>↗</span></a><a class="btn btn-ghost" href="#/ventajas">${txt('hero_secondary')} <span>→</span></a></div><div class="hero-stats"><div class="hero-stat"><strong>01</strong><span>${txt('hero_stat_1')}</span></div><div class="hero-stat"><strong>∞</strong><span>${txt('hero_stat_2')}</span></div><div class="hero-stat"><strong>✦</strong><span>${txt('hero_stat_3')}</span></div></div></div><div class="hero-art">${settings().hero_show_logo!==false?`<img class="hero-emblem" src="${H(siteImage())}" alt="Imagen de Bellaquitas Fest" ${editorPreviewOverride?'data-edit-image="logo_url" tabindex="0" role="button" aria-label="Cambiar imagen principal"':''}/>`:''}</div></div></section>${animatedMarquee()}${blockHTML}</main>${footer()}`;
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
    fields=field('auth-password','Nueva contraseña','password','password','new-password',true)+field('auth-confirm',t('Repetir contraseña'),'confirmPassword','password','new-password',true);
  }else{
    if(authTab==='signup')fields+=`<div class="field"><label for="auth-name">${t('Nombre')}</label><input id="auth-name" name="name" type="text" autocomplete="name" minlength="2" maxlength="80" required /></div>`;
    fields+=`<div class="field"><label for="auth-email">${t('Correo electrónico')}</label><input id="auth-email" name="email" type="email" autocomplete="email" inputmode="email" maxlength="254" required /></div>`;
    if(authTab!=='recover'){
      fields+=field('auth-password',t('Contraseña'),'password','password',authTab==='signup'?'new-password':'current-password',true);
      if(authTab==='signup')fields+=field('auth-confirm','Repetir contraseña','confirmPassword','password','new-password',true);
    }
  }
  const labels={login:'Iniciar sesión',signup:'Registrar mi cuenta',recover:'Enviar enlace de recuperación',reset:'Guardar nueva contraseña'};
  const extras={login:'¿Has olvidado tu contraseña? <a class="login-link" href="#/recuperar">Recupérala aquí</a>.',signup:'Recibirás un correo para confirmar tu cuenta si está activada la verificación de email.',recover:'¿Ya recuerdas tus datos? <a class="login-link" href="#/acceso">Volver a iniciar sesión</a>.',reset:'Después de cambiarla, inicia sesión de nuevo.'};
  const social=['login','signup'].includes(authTab)?`<div class="auth-social"><button class="btn google-signin" type="button" data-action="google-login"${off}><img src="assets/google-g.svg" width="21" height="21" alt="" aria-hidden="true"/><span class="google-label">${t('Continuar con Google')}</span></button><div class="auth-divider"><span>${t('o continúa con correo electrónico')}</span></div></div>`:'';
  const form=`<form id="auth-form">${fields}<button class="btn btn-primary auth-submit" type="submit"${off}>${t(labels[authTab])} ↗</button><p class="form-note">${extras[authTab]}</p><p id="auth-feedback" class="auth-feedback" role="alert" hidden></p></form>`;
  return `${header()}<main class="auth-layout"><div class="auth-art"><img src="${H(siteImage())}" alt="Logotipo Bellaquitas Fest"/><div class="auth-quote">Una comunidad. Tu espacio.</div></div><div class="auth-main"><div class="auth-panel"><div class="eyebrow">BELLAQUITAS CLUB</div><h1>${t(titles[authTab])}</h1><p>${t(intro[authTab])}</p>${tabs}${unavailable}${authNotice?`<div class="auth-notice" role="status">${H(authNotice)}</div>`:''}${social}${form}<p class="small muted" style="margin-top:25px">← <a class="login-link" href="#/">${t('Volver a la web pública')}</a></p></div></div></main>`;
}
function roleLabel(role){return role==='admin'?'Administración':role==='puerta'?'Personal de puerta':'Socio/a';}
function allowed(path){if(!current) return false;if(path==='/panel'||path==='/editor')return current.role==='admin';if(path==='/puerta')return ['puerta','admin'].includes(current.role);return ['/mi-espacio','/tarjeta','/premios','/agenda','/perfil'].includes(path);}
function appShell(content){
  const memberLinks=[['/mi-espacio','home','Mi espacio'],['/tarjeta','card','Mi tarjeta'],['/premios','rewards','Premios'],['/agenda','events','Eventos'],['/perfil','profile','Perfil']];
  const links=current.role==='admin'?[['/panel','admin','Panel administrador'],['/editor','editor','Editar web'],['/puerta','gate','Puerta'],...memberLinks]:current.role==='puerta'?[...memberLinks,['/puerta','gate','Puerta']]:memberLinks;
  const mobileLinks=current.role==='admin'?[links[0],links[1],memberLinks[0],memberLinks[3],memberLinks[4]]:current.role==='puerta'?[memberLinks[0],memberLinks[1],memberLinks[2],memberLinks[3],links[5]]:memberLinks;
  const side=links.map(([url,ic,label])=>`<a href="#${url}" class="side-link ${route===url?'active':''}"><span class="ico">${H(siteText('icon_'+ic))}</span>${t(label)}</a>`).join('');
  const mobile=mobileLinks.map(([url,ic,label])=>`<a href="#${url}" class="${route===url?'active':''}"><span class="ico">${H(siteText('icon_'+ic))}</span>${t(label==='Panel administrador'?'Panel':label==='Mi espacio'?'Inicio':label==='Mi tarjeta'?'Tarjeta':label)}</a>`).join('');
  return `<div class="app-shell"><aside class="sidebar"><div class="side-head"><a class="brand" href="#${current.role==='admin'?'/panel':'/mi-espacio'}">${headerBrand(!!editorPreviewOverride)}</a></div><div class="side-group"><div class="side-caption">${current.role==='admin'?'Administración':'Mi comunidad'}</div>${side}</div><div class="side-bottom"><div class="side-profile"><span class="avatar">${H(current.name.split(' ').map(x=>x[0]).slice(0,2).join(''))}</span><span><b>${H(current.name)}</b><small>${roleLabel(current.role)}</small></span></div><button class="btn btn-secondary btn-mini" style="width:100%" type="button" data-action="logout">${H(siteText('icon_logout'))} Cerrar sesión</button></div></aside><main class="app-main"><div class="app-top"><div class="app-page"><a href="#${current.role==='admin'?'/panel':'/mi-espacio'}" class="gold">${current.role==='admin'?t('Panel administrador'):'Bellaquitas Club'}</a> &nbsp; / &nbsp; <b>${H(route.replace('/','')||'inicio')}</b></div><div class="app-top-right">${langSwitcher()}${current.role==='admin'?'<a class="btn btn-primary btn-mini" href="#/editor">✎ Editar web</a>':''}<span class="pill"><span class="dot"></span>Cuenta activa</span><button type="button" class="btn btn-secondary btn-mini" data-action="logout">Salir ↪</button></div></div>${content}</main><nav class="mobile-appbar" aria-label="Menú de cuenta">${mobile}</nav></div>`;
}
const pageHead=(title,sub,eyebrow='TU ESPACIO')=>`<div class="app-header"><div class="eyebrow">${H(eyebrow)}</div><h1>${H(title)}</h1><p>${H(sub)}</p></div>`;
function summary(){const next=tierNext(current.lifetime_points);const progress=next?Math.min(100,Math.round(current.lifetime_points/next*100)):100;const events=data.events.filter(e=>e.active).sort((a,b)=>(a.date_label||'9999').localeCompare(b.date_label||'9999')).slice(0,3);const rewardList=data.rewards.filter(r=>r.active).slice(0,3);return `${pageHead(`Hola, ${current.name.split(' ')[0]} ✦`,'Aquí tienes todo lo que ocurre en tu comunidad.','BELLAQUITAS MEMBER')}<div class="dash-grid"><div><div class="points-banner"><div><div class="eyebrow">TUS PUNTOS DISPONIBLES</div><div class="points-number">${fmt(current.points)}</div><p>Puntos para canjear en tus próximos premios.</p><a href="#/premios" class="btn btn-primary btn-mini">Explorar premios ↗</a></div><div class="points-symbol">✦</div></div><div class="metric-row"><div class="metric"><strong>${fmt(current.visits)}</strong><span>Visitas</span></div><div class="metric"><strong>${H(tier(current.lifetime_points))}</strong><span>Tu nivel</span></div><div class="metric"><strong>${fmt(current.lifetime_points)}</strong><span>Puntos históricos</span></div></div><div class="pane section-gap"><div class="section-title"><h2>Próximas experiencias</h2><a class="link-tiny" href="#/agenda">Ver todas ↗</a></div><div class="mini-list">${events.length?events.map(e=>`<div class="mini-item"><div class="mini-left"><span class="mini-glyph">▦</span><div><strong>${H(localizedValue(e,'name'))}</strong><small>${H(eventDate(e.date_label,e.start_time))} · ${H(e.location)}</small></div></div><span class="gold">↗</span></div>`).join(''):'<div class="empty">Próximamente</div>'}</div></div></div><div><div class="pane"><div class="section-title"><h2>Tu categoría</h2><span class="pill">♛ ${H(tier(current.lifetime_points))}</span></div><div style="font:900 2rem Outfit;color:var(--gold)">${next?'Hacia '+tier(next):'Nivel máximo'}</div><p class="muted small">${next?`${fmt(next-current.lifetime_points)} puntos históricos para el próximo nivel.`:'Has alcanzado la categoría más alta.'}</p><div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div><div class="progress-label"><span>${fmt(current.lifetime_points)} puntos</span><span>${next?fmt(next):'★'}</span></div><a class="btn btn-secondary btn-mini" style="margin-top:20px" href="#/tarjeta">Ver mi tarjeta ↗</a></div><div class="pane section-gap"><div class="section-title"><h2>Recompensas destacadas</h2><a class="link-tiny" href="#/premios">Catálogo ↗</a></div><div class="mini-list">${rewardList.map(r=>`<div class="mini-item"><div class="mini-left"><span class="mini-glyph">${H(r.symbol||'✦')}</span><div><strong>${H(localizedValue(r,'name'))}</strong><small>${fmt(r.cost)} puntos</small></div></div><span class="gold">↗</span></div>`).join('')||'<div class="empty">No hay recompensas disponibles.</div>'}</div></div></div></div><div class="pane section-gap"><div class="section-title"><h2>Promociones activas</h2><span class="muted small">Información para socios</span></div><div class="mini-list">${data.promos.filter(p=>p.active).map(p=>`<div class="mini-item"><div class="mini-left"><span class="mini-glyph">✦</span><div><strong>${H(localizedValue(p,'name'))}</strong><small>${H(localizedValue(p,'description'))}</small></div></div><span class="pill">+${fmt(p.bonus)} pts</span></div>`).join('')||'<div class="empty">No hay promociones activas.</div>'}</div><p class="muted small">Las bonificaciones requieren validación según sus condiciones; no se conceden automáticamente desde esta pantalla.</p></div>`;}
function loyaltyCardView(){
 const displayed=t('La tarjeta de fidelidad');
 return `<section class="loyalty-profile" aria-label="${H(displayed)}">
 <div class="loyalty-profile-header"><div><div class="eyebrow">BELLAQUITAS FEST · MEMBER CLUB</div><h2>${H(displayed)}</h2><p>${t('Descubre tu tarjeta de fidelidad Bellaquitas Fest.')}</p></div><span class="loyalty-tier">♛ ${H(tier(current.lifetime_points))}</span></div>
 <div class="loyalty-flip-controls" role="group" aria-label="Dos caras de la tarjeta">
   <button type="button" class="loyalty-face-button active" data-action="loyalty-face" data-face="front" aria-pressed="true">✦ ${t('Cara delantera')}</button>
   <button type="button" class="loyalty-face-button" data-action="loyalty-face" data-face="back" aria-pressed="false">▦ ${t('Ver mi QR')}</button>
 </div>
 <div class="loyalty-card-stage">
   <div class="loyalty-card-face loyalty-front" data-loyalty-face="front">
     <img src="assets/tarjeta-conejita-frente.webp" alt="${t('Tarjeta con la conejita')}" loading="eager"/>
     <button type="button" class="loyalty-turn" data-action="loyalty-face" data-face="back" aria-label="${t('Mostrar QR')}">↻ ${t('Ver mi QR')}</button>
   </div>
   <div class="loyalty-card-face loyalty-back" data-loyalty-face="back" hidden>
     <img src="assets/tarjeta-qr-dorso.webp" alt="${t('Reverso con QR personal')}" loading="lazy"/>
     <div class="loyalty-qr-overlay"><div id="qr-code"><span class="loyalty-qr-loading">${t('TU CÓDIGO PERSONAL')}</span></div></div>
     <button type="button" class="loyalty-turn" data-action="loyalty-face" data-face="front" aria-label="${t('Ver frente')}">↻ ${t('Ver frente')}</button>
   </div>
 </div>
 <div class="loyalty-code-tools"><div><span class="eyebrow">${t('TU CÓDIGO PERSONAL')}</span><strong>${H(current.member_code)}</strong><small>${t('Escanea este QR al entrar.')}</small></div><button class="btn btn-secondary btn-mini" type="button" data-action="copy-code">${t('Copiar código')}</button><button type="button" class="btn btn-primary btn-mini" data-action="qr-expand">${t('Ampliar QR')}</button></div>
 <div id="loyalty-qr-large" class="loyalty-qr-large" hidden><div id="qr-code-big"><span>${t('TU CÓDIGO PERSONAL')}</span></div><p>${H(current.member_code)}</p><button class="btn btn-primary btn-mini" type="button" data-action="qr-expand">▣ ${t('Ampliar QR')}</button></div><dialog id="member-qr-dialog" class="member-qr-dialog" aria-label="${t('TU CÓDIGO PERSONAL')}"><div class="member-qr-dialog-inner"><div class="eyebrow">BELLAQUITAS FEST</div><h2>${t('TU CÓDIGO PERSONAL')}</h2><div id="qr-code-modal"></div><p>${H(current.member_code)}</p><button type="button" class="btn btn-primary" data-action="qr-close">✕ ${t('Ver frente')}</button></div></dialog>
 <div class="loyalty-summary"><div><span>${t('Puntos disponibles')}</span><strong>${fmt(current.points)}</strong></div><div><span>${t('Visitas registradas')}</span><strong>${fmt(current.visits)}</strong></div><div><span>${t('Tu nivel')}</span><strong>${H(tier(current.lifetime_points))}</strong></div></div>
 <p class="loyalty-note">${t('Si no se puede leer el QR, el personal puede introducir el código manualmente.')}</p>
 </section>`;
}
function card(){return `${pageHead(t('Tu tarjeta de socio'),t('Tu identificación digital para las actividades de la comunidad.'),t('MI IDENTIDAD'))}${loyaltyCardView()}<div class="pane section-gap"><h2>${t('Cómo funciona')}</h2><p class="muted small">${t('Muestra tu código a personal autorizado para validar una visita. No compartas capturas de tu tarjeta pública y libremente.')}</p></div>`;}

function rewards(){const items=data.rewards.filter(r=>r.active);const myRed=data.redemptions.filter(r=>r.user_id===current.id).sort(byDate);return `${pageHead('Premios y experiencias','Descubre qué puedes conseguir con tus puntos.','CATÁLOGO DE PREMIOS')}<div class="points-banner" style="min-height:140px;margin-bottom:22px"><div><div class="eyebrow">SALDO ACTUAL</div><div class="points-number" style="font-size:3.3rem">${fmt(current.points)} <span style="font-size:1.1rem;letter-spacing:0">pts</span></div></div><div class="points-symbol" style="font-size:5rem">✦</div></div><div class="catalog-search-bar"><label for="rewards-search">${t('Buscar premios y recompensas')}</label><input id="rewards-search" class="search-field" type="search" autocomplete="off" placeholder="${t('Busca por nombre o categoría…')}"/></div><div id="rewards-search-empty" class="empty" hidden>${t('No hay premios que coincidan con la búsqueda.')}</div><div class="reward-grid">${items.map(r=>`<article class="reward-card" data-catalog-search="${H(searchFold(r.name+' '+r.description+' '+r.category))}"><div class="reward-illus">${safeImage(r.image_url)?`<img class="reward-photo" src="${H(safeImage(r.image_url))}" alt="${H(r.name)}" loading="lazy"/>`:H(r.symbol||'✦')}</div><span class="eyebrow" style="margin-top:12px;font-size:.63rem">${H(localizedValue(r,'category'))}</span><h3>${H(localizedValue(r,'name'))}</h3><p>${H(localizedValue(r,'description')||t('Recompensa de la comunidad.'))}</p><div class="reward-foot"><strong>${fmt(r.cost)} pts</strong><button class="btn btn-primary btn-mini" data-action="redeem" data-id="${H(r.id)}" ${current.points<r.cost?'disabled title="Puntos insuficientes"':''}>${current.points<r.cost?'Faltan puntos':'Solicitar ↗'}</button></div></article>`).join('')||'<div class="empty">No hay recompensas publicadas por ahora.</div>'}</div><div class="pane section-gap"><div class="section-title"><h2>Mis solicitudes de canje</h2></div><div class="mini-list">${myRed.length?myRed.map(r=>`<div class="mini-item"><div><strong>${H(getReward(r.reward_id)?.name||'Premio')}</strong><small>${H(r.code)} · ${recentDate(r.created_at)}</small></div><span class="status ${r.status==='validado'?'ok':'pending'}">${H(r.status)}</span></div>`).join(''):'<div class="empty">Aún no has solicitado premios.</div>'}</div></div>`;}
function agenda(){return `${pageHead('Eventos y novedades','Descubre todo lo que está por venir.','AGENDA BELLAQUITAS')}<div class="catalog-search-bar"><label for="agenda-search">${t('Buscar eventos')}</label><input id="agenda-search" type="search" autocomplete="off" class="search-field" placeholder="${t('Busca por nombre, fecha o lugar…')}"/></div><div id="agenda-search-empty" class="empty" hidden>${t('No hay eventos que coincidan con la búsqueda.')}</div><div class="three-grid">${publicEvents(Infinity)}</div>`;}
function profile(){return `${pageHead(t('Mi perfil'),t('Gestiona los datos visibles de tu cuenta.'),t('CUENTA PERSONAL'))}${loyaltyCardView()}<div class="pane profile-form section-gap"><h2>${t('Mi perfil')}</h2><form id="profile-form"><div class="field"><label>${t('Nombre visible')}</label><input type="text" maxlength="80" minlength="2" name="name" value="${H(current.name)}" required /></div><div class="field"><label>${t('Código de socio')}</label><input type="text" value="${H(current.member_code)}" disabled /></div><div class="field"><label>${t('Tipo de cuenta')}</label><input type="text" value="${H(t(roleLabel(current.role)))}" disabled /></div><button class="btn btn-primary" type="submit">${t('Guardar cambios')}</button></form><p class="form-note" style="margin-top:18px">${activeLang==='fr'?'Les points et le niveau sont gérés par les personnes autorisées.':'La categoría y el saldo no se pueden editar desde el perfil. Los gestiona el sistema autorizado.'}</p></div>`;}

function gate(){const members=data.profiles.filter(x=>x.role==='socio');const filtered=members.filter(p=>searchFold(p.name+' '+p.member_code).includes(searchFold(search)));const pending=data.redemptions.filter(r=>r.status==='pendiente').sort(byDate);return `${pageHead('Control de acceso','Validación de socios y canjes desde una cuenta autorizada.','PERSONAL · PUERTA')}<div class="two-col"><div class="pane"><h2>Validar visita</h2><p class="muted small">Lee el QR de un socio o introduce su código de tarjeta.</p><form id="checkin-form" class="checkin-form"><input class="search-field" name="code" placeholder="Código del socio (MBR-...)" required /><button class="btn btn-primary" type="submit">Validar</button></form><div style="display:flex;gap:8px;margin-top:13px;flex-wrap:wrap"><button class="btn btn-secondary btn-mini" data-action="scan" type="button">◎ Activar cámara QR</button><button class="btn btn-ghost btn-mini" data-action="stop-scan" type="button">Detener cámara</button></div><div id="camera-wrap" class="camera-wrap"><video id="camera" muted playsinline></video><p>Apunta al QR del socio. Si no funciona, introduce el código manualmente.</p></div><div class="info-note">Por seguridad, una visita se valida una sola vez por día por socio.</div></div><div class="pane"><h2>Validar canje</h2><p class="muted small">Introduce el código de solicitud que muestra la cuenta del socio.</p><form class="checkin-form" id="validate-form"><input class="search-field" name="code" placeholder="Código CNJ-..." required /><button type="submit" class="btn btn-primary">Validar</button></form><div class="section-title" style="margin-top:26px"><h2>En espera (${pending.length})</h2></div><div class="mini-list">${pending.slice(0,6).map(r=>`<div class="mini-item"><div><strong>${H(getProfile(r.user_id)?.name||'Socio')} · ${H(getReward(r.reward_id)?.name||'Premio')}</strong><small>${H(r.code)}</small></div><button class="btn btn-secondary btn-mini" data-action="validate" data-code="${H(r.code)}">Validar</button></div>`).join('')||'<div class="empty">No hay canjes pendientes.</div>'}</div></div></div><div class="pane section-gap"><div class="section-title"><h2>Buscar socio</h2><span class="muted small">${filtered.length} resultados</span></div><div class="toolbar"><input type="search" class="search-field" id="member-search" placeholder="Buscar por nombre o código" value="${H(search)}" /></div><div class="data-table-wrap"><table class="data-table"><thead><tr><th>Nombre</th><th>Código</th><th>Categoría</th><th>Visitas</th><th>Acción</th></tr></thead><tbody>${filtered.map(p=>`<tr><td><b>${H(p.name)}</b></td><td>${H(p.member_code)}</td><td><span class="role-chip">${H(tier(p.lifetime_points))}</span></td><td>${fmt(p.visits)}</td><td><button class="btn btn-secondary btn-mini" data-action="checkin" data-code="${H(p.member_code)}">Registrar visita</button></td></tr>`).join('')||'<tr><td colspan="5">No se encontraron socios.</td></tr>'}</tbody></table></div></div>`;}
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
 // Un mismo registro, dos traducciones reales: no se reescriben nombres ni descripciones en el idioma contrario.
 const fr=item.localized_content?.fr||{};
 fields+=`<div class="admin-language-intro full"><strong>🇫🇷 Version française</strong><p>Rellena estos campos para que los visitantes vean el contenido en francés. Si están vacíos, se muestra el original hasta que lo traduzcas.</p></div>`;
 fields+=adminField('name_fr','Nom en français',`<input id="admin-name_fr" name="name_fr" type="text" maxlength="120" value="${H(fr.name||'')}" placeholder="Nom en français"/>`,'Traducción del título, independiente del español.',true);
 fields+=adminField('description_fr','Description en français',`<textarea id="admin-description_fr" name="description_fr" rows="3" maxlength="1200" placeholder="Description en français">${H(fr.description||'')}</textarea>`,'Traducción de la descripción.',true);
 if(table==='events')fields+=adminField('location_fr','Lieu en français',`<input id="admin-location_fr" name="location_fr" type="text" maxlength="160" value="${H(fr.location||'')}" placeholder="Lieu en français"/>`,'Si el lugar tiene otro nombre en francés.',true);
 if(table==='rewards')fields+=adminField('category_fr','Catégorie en français',`<input id="admin-category_fr" name="category_fr" type="text" maxlength="80" value="${H(fr.category||'')}" placeholder="Catégorie en français"/>`,'Tipo de premio para visitantes franceses.',true);
 if(['events','rewards'].includes(table))fields+=adminField('image','Añadir una foto (opcional)',`<div class="admin-file-row"><label class="admin-file-button" for="admin-image">📷 Elegir foto</label><span id="admin-file-status">Ninguna foto seleccionada</span></div><input class="admin-file-input" id="admin-image" name="image" type="file" accept="image/jpeg,image/png,image/webp"/>`,'Elige una foto del móvil o del ordenador (JPG, PNG o WebP, máximo 5 MB).',true)+(item.image_url?`<div class="admin-existing-photo"><img src="${H(safeImage(item.image_url))}" alt="Foto guardada"/><label class="admin-check"><input type="checkbox" name="remove_image"/> Quitar la foto actual</label></div>`:'');
 fields+=`<label class="admin-publish full"><input type="checkbox" name="active" ${item.active===false?'':'checked'}/><span><strong>Mostrar a la gente ahora</strong><small>Desmarca esta opción para guardarlo oculto y publicarlo más adelante.</small></span></label>`;
 return `<div class="pane admin-edit-pane"><div class="admin-form-heading"><div><span class="eyebrow">${editing?'MODIFICAR':'NUEVO'} ${type.toUpperCase()}</span><h2>${editing?'Editar':'Crear'} ${type}</h2><p>Rellena los campos que tengan * y guarda al terminar.</p></div><button class="btn btn-secondary btn-mini" type="button" data-action="admin-cancel">✕ Cerrar</button></div><form id="admin-item-form" data-table="${table}" data-id="${editing?H(editing.id):''}" class="admin-form">${fields}<div class="admin-preview full" aria-live="polite"><div class="eyebrow">ASÍ SE VERÁ</div><strong id="admin-preview-name">${H(item.name||'Tu '+type)}</strong><p id="admin-preview-info">${H(editing?adminMeta(table,item):'Completa el formulario para ver una vista previa.')}</p></div><div id="admin-form-feedback" class="admin-form-feedback full" role="alert" hidden></div><div class="admin-form-buttons full"><button class="btn btn-primary" type="submit">${editing?'Guardar cambios':'Guardar '+type}</button><button class="btn btn-secondary" type="button" data-action="admin-cancel">Cancelar</button></div></form></div>`;
}
function adminCatalog(table){
 const singular=adminLabel(table);const plural={events:'eventos',rewards:'premios',promos:'promociones'}[table];const activeCount=data[table].filter(x=>x.active).length;
 const list=data[table].map(x=>`<article class="admin-list-item" data-search="${H(searchFold(x.name+' '+(x.description||'')+' '+(x.location||'')+' '+(x.category||'')+' '+(x.date_label||'')))}"><div class="admin-list-top"><div class="admin-item-intro">${safeImage(x.image_url)?`<img class="admin-item-photo" src="${H(safeImage(x.image_url))}" alt=""/>`:`<span class="admin-item-icon">${table==='events'?'▦':table==='rewards'?H(x.symbol||'🎁'):'✦'}</span>`}<div><strong>${H(x.name)}</strong><small>${H(adminMeta(table,x))}</small></div></div><span class="admin-state ${x.active?'published':'draft'}">${x.active?'Publicado':'Oculto'}</span></div><div class="admin-item-buttons"><button class="btn btn-secondary btn-mini" type="button" data-action="admin-edit" data-table="${table}" data-id="${H(x.id)}">✎ Editar</button><button class="btn btn-secondary btn-mini" type="button" data-action="toggle" data-table="${table}" data-id="${H(x.id)}">${x.active?'Ocultar':'Publicar'}</button><button class="btn btn-danger btn-mini" type="button" data-action="admin-delete" data-table="${table}" data-id="${H(x.id)}">Eliminar</button></div></article>`).join('');
 return `<div class="admin-catalog-heading"><div><h2>Mis ${plural}</h2><p>${data[table].length} en total · ${activeCount} visibles para la gente</p></div><button class="btn btn-primary" type="button" data-action="admin-new" data-table="${table}">+ Crear ${singular}</button></div><div class="admin-guide"><span class="admin-guide-icon">💡</span><p><strong>Es muy fácil:</strong> crea un ${singular}, publícalo cuando esté listo y usa <b>Editar</b> para cambiarlo en cualquier momento. <b>Ocultar</b> lo retira de la web sin borrarlo.</p></div>${adminFormOpen?adminItemForm(table):''}<div class="pane admin-list-pane"><div class="section-title"><h2>Lo que has creado</h2><input type="search" id="admin-list-search" class="search-field" aria-label="Buscar ${plural}" placeholder="Buscar ${plural} por nombre, descripción o lugar..."/></div><div class="admin-list">${list||`<div class="empty">Todavía no hay ${plural}. Pulsa «Crear ${singular}» para empezar.</div>`}</div><div class="empty" id="admin-search-empty" hidden>No se ha encontrado ningún resultado.</div></div></div>`;
}
function adminSite(){return `<div class="pane admin-edit-pane"><h2>Editar y actualizar toda la página</h2><p class="muted">Abre el editor visual: cambia todos los textos públicos, elige un modelo, reorganiza las secciones y comprueba el resultado antes de publicarlo. No hace falta saber programación.</p><p class="admin-guide"><strong>1.</strong> Abre el editor &nbsp; <strong>2.</strong> Cambia lo que quieras &nbsp; <strong>3.</strong> Guarda borrador &nbsp; <strong>4.</strong> Publica cuando esté listo.</p><a class="btn btn-primary" href="#/editor">✎ Abrir editor de la web ↗</a></div>`;}
function adminMemberForm(member){
 const isSelf=member.id===session?.id;
 const options=[['socio','Socio · cuenta normal'],['puerta','Personal de puerta · validar visitas y canjes'],['admin','Administrador · acceso completo']];
 const ownRole=isSelf?`<input type="hidden" name="role" value="admin"/>`:'';
 const roleInput=`<select id="member-role" name="role" ${isSelf?'disabled':''} required>${options.map(([r,label])=>`<option value="${r}" ${member.role===r?'selected':''}>${label}</option>`).join('')}</select>${ownRole}`;
 const input=(key,label,value,max,hint='')=>`<div class="field"><label for="member-${key}">${label}</label><input type="number" id="member-${key}" name="${key}" min="0" max="${max}" step="1" required value="${H(value)}"/>${hint?`<small class="field-help">${hint}</small>`:''}</div>`;
 return `<section class="pane member-editor" aria-label="Editar cuenta seleccionada" id="member-editor"><div class="admin-form-heading"><div><span class="eyebrow">CAMBIAR DATOS DE UN SOCIO</span><h2>✎ ${H(member.name)}</h2><p>Código: ${H(member.member_code)} · Todos los cambios se guardan en Supabase.</p></div><button type="button" class="btn btn-secondary btn-mini" data-action="member-close">✕ Cerrar</button></div>
 <form id="member-edit-form" data-id="${H(member.id)}" class="member-edit-form">
  <div class="field member-name"><label for="member-name">Nombre de la cuenta</label><input type="text" id="member-name" name="name" minlength="2" maxlength="80" required value="${H(member.name)}"/></div>
  <div class="field member-role"><label for="member-role">Permisos de esta persona</label>${roleInput}<small class="field-help">Socio: utiliza su cuenta. Puerta: registra visitas y valida premios. Administrador: puede modificar toda la web y gestionar a otros socios.${isSelf?' No puedes quitarte tus propios permisos de administrador.':''}</small></div>
  <div class="member-points-panel"><h3>✦ Puntos del socio</h3><p class="muted small">Puedes escribir la cantidad exacta o usar los botones. Los puntos históricos nunca quedarán por debajo de los disponibles.</p><div class="member-points-grid">${input('points','Puntos disponibles',member.points,100000000,'Saldo que puede gastar en premios.')}${input('lifetime_points','Puntos históricos',member.lifetime_points,100000000,'Determinan su categoría (Member, Gold, VIP o Black).')}${input('visits','Visitas acumuladas',member.visits,1000000,'Corrección del contador. No borra el historial de visitas.')}</div><div class="member-quick" aria-label="Ajustar puntos rápidamente"><span>Modificar saldo:</span>${[[10,'+10'],[50,'+50'],[100,'+100'],[-10,'−10']].map(([n,label])=>`<button type="button" class="btn btn-secondary btn-mini" data-action="member-points-quick" data-delta="${n}">${label}</button>`).join('')}</div></div>
  <div class="field member-reason"><label for="member-reason">Motivo del cambio *</label><textarea id="member-reason" name="reason" rows="2" maxlength="250" minlength="5" required placeholder="Por ejemplo: corregir los puntos de una visita o actualizar el permiso del equipo."></textarea><small class="field-help">El motivo queda guardado en el historial privado de administración.</small></div>
  <p class="admin-form-feedback" id="member-form-feedback" role="alert" hidden></p>
  <div class="admin-form-buttons"><button class="btn btn-primary" type="submit">✓ Guardar cambios del socio</button><button class="btn btn-secondary" type="button" data-action="member-close">Cancelar</button></div>
 </form></section>`;
}
function adminMemberHistory(){
 const changes=data.member_changes||[];
 if(!changes.length)return '';
 return `<section class="pane member-history"><div class="section-title"><h2>Últimos cambios de cuentas</h2><span class="muted small">Solo los administradores pueden ver este historial</span></div><div class="mini-list">${changes.slice(0,8).map(c=>{
  const name=getProfile(c.member_id)?.name||'Cuenta anterior';const actor=getProfile(c.admin_id)?.name||'Administrador';
  const before=c.before_data||{},after=c.after_data||{};
  const diff=Number(after.points??0)-Number(before.points??0);
  const detail=[before.role!==after.role?`${roleLabel(before.role)} → ${roleLabel(after.role)}`:'',diff!==0?`Saldo ${diff>0?'+':''}${fmt(diff)} puntos`:'',before.lifetime_points!==after.lifetime_points?'Puntos históricos modificados':'',before.visits!==after.visits?'Visitas corregidas':'',before.name!==after.name?'Nombre cambiado':''].filter(Boolean).join(' · ');
  return `<div class="mini-item member-change-entry"><div><strong>${H(name)}</strong><small>${H(detail)} · ${H(c.reason||'')}</small><small>${H(actor)} · ${recentDate(c.created_at)}</small></div></div>`;
 }).join('')}</div></section>`;
}
function adminMembers(){
 const people=data.profiles.slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'es'));
 const selected=memberEditId?data.profiles.find(p=>p.id===memberEditId):null;
 const searchTerm=searchFold(memberSearch);
 const visible=people.filter(p=>(memberRoleFilter==='all'||p.role===memberRoleFilter)&&searchFold(p.name+' '+p.member_code).includes(searchTerm));
 return `<div class="admin-catalog-heading"><div><h2>Gestión de socios y personal</h2><p>${data.profiles.length} cuentas registradas de verdad</p></div></div>
 <div class="admin-guide"><span class="admin-guide-icon">👥</span><p><strong>Así de sencillo:</strong> busca una persona y pulsa <b>Editar socio</b>. Podrás cambiarle el nombre, los permisos, sus puntos y el contador de visitas. Cada cambio requiere un motivo y queda registrado.</p></div>
 ${selected?adminMemberForm(selected):''}
 <section class="pane member-list-pane"><div class="section-title"><h2>Buscar personas</h2><span class="muted small" id="member-results">${visible.length} resultados</span></div>
 <div class="member-tools"><div class="field"><label for="admin-member-search">Nombre o código de socio</label><input type="search" class="search-field" id="admin-member-search" placeholder="Buscar persona..." value="${H(memberSearch)}" autocomplete="off"/></div><div class="field"><label for="admin-member-role">Mostrar</label><select id="admin-member-role">${[['all','Todas las cuentas'],['socio','Solo socios'],['puerta','Personal de puerta'],['admin','Administradores']].map(([val,label])=>`<option value="${val}" ${memberRoleFilter===val?'selected':''}>${label}</option>`).join('')}</select></div></div>
 <div class="member-list">${people.map(p=>`<article class="member-record" data-search="${H(searchFold(p.name+' '+p.member_code))}" data-role="${H(p.role)}" ${!visible.includes(p)?'hidden':''}><div class="member-record-icon" aria-hidden="true">${H(p.name.slice(0,1).toLocaleUpperCase('es-ES'))}</div><div class="member-record-details"><strong>${H(p.name)}</strong><small>${H(p.member_code)}</small><span class="role-chip">${H(roleLabel(p.role))}</span></div><div class="member-record-stats"><span><b>${fmt(p.points)}</b> puntos</span><span>${fmt(p.visits)} visitas</span></div><button type="button" class="btn btn-secondary btn-mini" data-action="member-edit" data-id="${H(p.id)}">✎ Editar socio</button></article>`).join('')}</div>
 <div class="empty" id="member-empty" ${visible.length?'hidden':''}>${people.length?'No se encontraron personas con esos filtros.':'Todavía no hay personas registradas.'}</div>
 </section>${adminMemberHistory()}`;
}
function filterAdminMembers(){
 const needle=searchFold(memberSearch);let count=0;
 for(const row of document.querySelectorAll('.member-record')){
  row.hidden=!(row.dataset.search.includes(needle)&&(memberRoleFilter==='all'||row.dataset.role===memberRoleFilter));
  if(!row.hidden)count++;
 }
 const empty=$('#member-empty');if(empty){empty.hidden=count>0;empty.textContent=data.profiles.length?'No se encontraron personas con esos filtros.':'Todavía no hay personas registradas.';}
 const results=$('#member-results');if(results)results.textContent=count+' resultados';
}
async function saveMemberForm(form){
 if(current?.role!=='admin'||!session)throw new Error('Acceso exclusivo de administración.');
 const member=data.profiles.find(p=>p.id===form.dataset.id);
 if(!member)throw new Error('Esta cuenta ya no está disponible.');
 const fd=new FormData(form);
 const values={p_member_id:member.id,p_name:String(fd.get('name')||'').trim(),p_role:String(fd.get('role')||''),
  p_points:Number(fd.get('points')),p_lifetime_points:Number(fd.get('lifetime_points')),
  p_visits:Number(fd.get('visits')),p_reason:String(fd.get('reason')||'').trim()};
 if(!values.p_name||values.p_name.length<2||values.p_name.length>80)throw new Error('Escribe un nombre entre 2 y 80 caracteres.');
 if(!['socio','puerta','admin'].includes(values.p_role))throw new Error('Selecciona un rol válido.');
 if(![values.p_points,values.p_lifetime_points,values.p_visits].every(Number.isSafeInteger)||
   values.p_points<0||values.p_lifetime_points<0||values.p_visits<0||
   values.p_points>100000000||values.p_lifetime_points>100000000||values.p_visits>1000000)
   throw new Error('Los puntos y visitas deben ser cantidades enteras sin negativos.');
 if(values.p_reason.length<5||values.p_reason.length>250)throw new Error('Explica el motivo del cambio en al menos 5 caracteres.');
 if(member.id===session.id&&values.p_role!=='admin')throw new Error('No puedes quitarte el rol de administrador.');
 const original={name:member.name,role:member.role,points:member.points,lifetime_points:member.lifetime_points,visits:member.visits};
 if(values.p_name===original.name&&values.p_role===original.role&&values.p_points===original.points&&
   values.p_lifetime_points===original.lifetime_points&&values.p_visits===original.visits)throw new Error('Todavía no has cambiado ningún dato.');
 const warnings=[];
 if(values.p_role!==original.role)warnings.push(`Rol: ${roleLabel(original.role)} → ${roleLabel(values.p_role)}`);
 if(values.p_points!==original.points)warnings.push(`Puntos: ${fmt(original.points)} → ${fmt(values.p_points)}`);
 if(values.p_lifetime_points!==original.lifetime_points)warnings.push(`Puntos históricos: ${fmt(original.lifetime_points)} → ${fmt(Math.max(values.p_lifetime_points,values.p_points))}`);
 if(values.p_visits!==original.visits)warnings.push(`Visitas: ${fmt(original.visits)} → ${fmt(values.p_visits)}`);
 if(warnings.length&&!ask(`Vas a modificar la cuenta de ${member.name}.\n\n${warnings.join('\n')}\n\n¿Confirmas los cambios?`))return;
 const btn=form.querySelector('[type="submit"]');if(btn){btn.disabled=true;btn.textContent='Guardando…';}
 try{
  const result=await sb.rpc('admin_update_member',values);
  if(result.error)throw new Error(result.error.message||'No se pudo actualizar la cuenta.');
  memberEditId=null;
  await refresh();
  toast('Cambios guardados en la ficha del socio y registrados en el historial.');
 } finally{if(btn?.isConnected){btn.disabled=false;btn.textContent='✓ Guardar cambios del socio';}}
}
function adminRules(){return `<div class="two-col"><div class="pane"><h2>Cómo se ganan puntos</h2><div class="mini-list"><div class="mini-item"><span>Visita validada por personal</span><strong class="gold">+10 pts</strong></div><div class="mini-item"><span>Solicitar un premio</span><strong>− Coste en puntos</strong></div><div class="mini-item"><span>Una visita por socio al día</span><span class="status ok">Activo</span></div></div><p class="form-note">Las promociones que crees se mostrarán a los socios, pero no suman puntos automáticamente. Estas reglas son fijas por seguridad y para cambiarlas necesitas actualizar las funciones del servidor.</p></div><div class="pane"><h2>Niveles de socio</h2><div class="mini-list"><div class="mini-item"><b>Member</b><span>0–499 puntos históricos</span></div><div class="mini-item"><b class="gold">Gold</b><span>500–899 puntos</span></div><div class="mini-item"><b>VIP</b><span>900–1.999 puntos</span></div><div class="mini-item"><b>Black</b><span>2.000 puntos o más</span></div></div></div></div>`;}
function adminActivity(){return `<div class="pane"><h2>Historial de movimientos</h2><p class="muted small">Consulta de operaciones reales. Aquí no se añaden ni modifican puntos.</p><div class="data-table-wrap"><table class="data-table"><thead><tr><th>Fecha</th><th>Socio</th><th>Tipo</th><th>Detalle</th><th>Puntos</th></tr></thead><tbody>${data.activity.slice().sort(byDate).map(x=>`<tr><td>${recentDate(x.created_at)}</td><td>${H(getProfile(x.user_id)?.name||'Sistema')}</td><td>${H(x.type)}</td><td>${H(x.detail)}</td><td class="${x.delta>=0?'gold':'rose'}">${x.delta>0?'+':''}${fmt(x.delta)}</td></tr>`).join('')||'<tr><td colspan="5">Todavía no se han registrado movimientos.</td></tr>'}</tbody></table></div></div>`;}
// EDITOR VISUAL: personalización completa de la portada, borradores privados y publicación.
function ensureEditor(){
 if(editorDraft)return;
 const stored=data.site_drafts.find(x=>x.key==='homepage')?.settings;
 editorDraft=normalizeEditor(stored||publishedSettings());
 editorDirty=false;editorLanguage=activeLang;
}
function normalizeEditor(value){
 const output={...SITE_DEFAULTS,...(value&&typeof value==='object'&&!Array.isArray(value)?value:{})};
 for(const key of Object.keys(SITE_DEFAULTS)){
  if(typeof SITE_DEFAULTS[key]==='string')output[key]=String(output[key]??SITE_DEFAULTS[key]).slice(0,key==='hero_text'?1000:1200);
 }
 output.theme=['classic','minimal','festival'].includes(output.theme)?output.theme:'classic';
 output.logo_url=safeImage(output.logo_url);output.header_logo_url=safeImage(output.header_logo_url);output.hero_video_url=safeVideoUrl(output.hero_video_url);output.experience_video_url=safeVideoUrl(output.experience_video_url);
 output.header_show_logo=output.header_show_logo!==false;output.header_show_text=output.header_show_text!==false;output.hero_show_logo=output.hero_show_logo!==false;
 output.translations={es:{...(output.translations?.es||{})},fr:{...(output.translations?.fr||{})}};
 output.ui_copy={es:{...(output.ui_copy?.es||{})},fr:{...(output.ui_copy?.fr||{})}};
 output.visible=Object.fromEntries(Object.keys(EDITOR_SECTIONS).map(k=>[k,output.visible?.[k]!==false]));
 output.order=validOrder(output.order);
 return output;
}
const EDITOR_GROUPS=[['main','🏠 Portada'],['experience','✦ Experiencia'],['events','▦ Eventos'],['benefits','🎁 Ventajas'],['faq','❔ Preguntas'],['cta','↗ Invitación final'],['other','☷ Menú y pie'],['sections','☰ Orden y visibilidad'],['design','✧ Modelos'],['ui','☷ Textos de toda la aplicación']];
const EDITOR_IMAGE_KEYS=new Set(['logo_url','header_logo_url','hero_video_url','experience_video_url']);
function editorFieldValue(key){
 if(editorLanguage==='fr' && !EDITOR_IMAGE_KEYS.has(key) && typeof SITE_DEFAULTS[key]==='string'){
  const specific=editorDraft.translations?.fr?.[key];
  if(typeof specific==='string')return specific;
  if(FR_SITE[key] && editorDraft[key]===SITE_DEFAULTS[key])return FR_SITE[key];
  return translateLabel(editorDraft[key]||'','fr');
 }
 return editorDraft[key]??'';
}
function setEditorLocalizedValue(key,value){
 if(editorLanguage==='fr' && !EDITOR_IMAGE_KEYS.has(key)){
  if(!editorDraft.translations)editorDraft.translations={es:{},fr:{}};
  if(!editorDraft.translations.fr)editorDraft.translations.fr={};
  editorDraft.translations.fr[key]=value;
 }else editorDraft[key]=value;
}
function editorUIStrings(){
 const keys=Object.keys(UI_ALL_FR).filter(k=>k.length>3&&k.length<220&&!/^\d/.test(k));
 return `<p class="muted small">${t('Selecciona cualquier pantalla en la vista previa y pulsa un texto para editarlo. También puedes buscar aquí cualquier etiqueta de la aplicación. Los cambios se guardan por idioma.')}</p><label for="editor-ui-search">${t('Buscar texto de la web')}</label><input id="editor-ui-search" class="search-field" type="search" placeholder="${t('Buscar texto de la web')}…"/><p id="editor-ui-count" class="muted small">${keys.length} ${t('textos editables')}</p><div class="editor-ui-copy-list" id="editor-ui-copy-list">${keys.map(key=>`<div class="editor-ui-copy-item" data-ui-search="${H(searchFold(key+' '+(UI_ALL_FR[key]||'')))}"><label>${H(key)}</label><textarea data-ui-copy-key="${H(key)}" maxlength="240" rows="2">${H(editorDraft.ui_copy?.[editorLanguage]?.[key]??translateLabel(key,editorLanguage,editorDraft))}</textarea></div>`).join('')}</div>`;
}
function editorFields(group){
 const rows=SITE_FIELDS[group]||[];
 return `<div class="editor-field-list">${rows.map(([key,label,kind])=>{
  const id='editor-'+key;
  if(kind==='checkbox')return `<div class="editor-field"><label class="editor-switch"><input type="checkbox" data-editor-bool="${key}" ${editorDraft[key]!==false?'checked':''}/><span>${H(t(label))}</span></label></div>`;
  const val=H(editorFieldValue(key));
  const text=kind==='textarea'?`<textarea id="${id}" data-editor-field="${key}" maxlength="1200" rows="3">${val}</textarea>`:`<input id="${id}" data-editor-field="${key}" value="${val}" maxlength="${kind==='image'||kind==='video'?800:300}" type="${kind==='image'||kind==='video'?'url':'text'}" placeholder="${kind==='image'||kind==='video'?'https://...':''}"/>`;
  const upload=kind==='image'?`<p class="field-help">${t('Puedes pegar una URL HTTPS o subir una foto. Para mantener el logo original, deja este campo vacío.')}</p><label class="editor-upload" for="editor-file-${key}">${t('📷 Subir imagen')}</label><input type="file" id="editor-file-${key}" data-editor-image-key="${key}" accept="image/jpeg,image/png,image/webp" class="admin-file-input"/><p class="field-help">${t('PNG, JPG o WebP de hasta 5 MB.')}</p>`:'';
  return `<div class="editor-field"><label for="${id}">${H(t(label))}</label>${text}${upload}${kind==='video'?'<p class="field-help">Solo vídeo propio o autorizado, en MP4/WebM por HTTPS. Si lo dejas vacío, se mantiene el fondo actual.</p>':''}</div>`;
 }).join('')}</div>`;
}
function editorSections(){return `<p class="muted small">Cambia el orden de las secciones con las flechas. Puedes ocultar una sección sin borrar su contenido.</p><div class="editor-section-list">${editorDraft.order.map((key,i)=>`<div class="editor-section-item"><label class="editor-switch"><input type="checkbox" data-editor-visibility="${key}" ${editorDraft.visible[key]?'checked':''}/> <span>${H(EDITOR_SECTIONS[key])}</span></label><div class="editor-order"><button class="btn btn-secondary btn-mini" type="button" aria-label="Subir ${H(EDITOR_SECTIONS[key])}" data-action="editor-move" data-section="${key}" data-direction="up" ${i===0?'disabled':''}>↑</button><button class="btn btn-secondary btn-mini" type="button" aria-label="Bajar ${H(EDITOR_SECTIONS[key])}" data-action="editor-move" data-section="${key}" data-direction="down" ${i===editorDraft.order.length-1?'disabled':''}>↓</button></div></div>`).join('')}</div>`;}
function editorDesign(){return `<p class="muted small">Selecciona el aspecto de la web. Solo cambia los colores y el estilo: no borra el contenido.</p><div class="editor-theme-list">${[['classic','Bellaquitas rojo y oro','Negro, rojo y dorado de la marca.'],['minimal','Modelo elegante','Fondo oscuro y toques claros.'],['festival','Modelo festival','Más color y energía para eventos.']].map(([key,title,desc])=>`<button type="button" data-action="editor-theme" data-theme="${key}" class="editor-theme ${editorDraft.theme===key?'chosen':''}" aria-pressed="${editorDraft.theme===key}"><span class="theme-swatch theme-swatch-${key}"><i></i><i></i><i></i></span><strong>${title}</strong><small>${desc}</small>${editorDraft.theme===key?'<b>✓ Elegido</b>':''}</button>`).join('')}</div>`;}
function editor(){
 ensureEditor();
 const selected=EDITOR_GROUPS.find(x=>x[0]===editorCategory)?.[1]||'Portada';
 const editorUI=editorCategory==='sections'?editorSections():editorCategory==='design'?editorDesign():editorCategory==='ui'?editorUIStrings():editorFields(editorCategory);
 const pageTabs=[['home','Inicio'],['experience','Experiencia'],['events','Eventos'],['benefits','Ventajas'],['faq','Preguntas'],['cta','Invitación final'],['login','Acceso'],['signup','Registro'],['member','Mi espacio'],['card','Mi tarjeta'],['profile','Perfil'],['rewards','Premios'],['agenda','Agenda'],['gate','Puerta'],['panel','Panel administrador']];
 const pagePicker=`<div class="editor-page-switch"><strong>${t('Página a editar')}</strong><div class="editor-page-options">${pageTabs.map(([p,label])=>`<button type="button" class="btn btn-secondary btn-mini ${editorPage===p?'active':''}" data-action="editor-page" data-page="${p}">${H(t(label))}</button>`).join('')}</div></div>`;
 const langPicker=`<div class="editor-language-switch"><strong>${t('Idioma de edición')}</strong><button class="btn btn-secondary btn-mini ${editorLanguage==='es'?'active':''}" type="button" data-action="editor-lang" data-lang="es">🇪🇸 Español</button><button class="btn btn-secondary btn-mini ${editorLanguage==='fr'?'active':''}" type="button" data-action="editor-lang" data-lang="fr">🇫🇷 Français</button><small>${t('Cada idioma se edita sin borrar el otro. La información de socios y la seguridad no se modifican aquí.')}</small></div>`;
 return `${pageHead('Editar mi página web','Cambia textos, secciones y modelos sin tocar código. Comprueba la vista previa y publica solo cuando esté todo listo.','EDITOR VISUAL')}
 <div class="editor-intro"><div><strong>1. Toca la web</strong><span>Pulsa sobre el logo, una imagen, un icono o un texto en la vista previa.</span></div><div><strong>2. Cambia lo seleccionado</strong><span>Elige otra foto o escribe el texto nuevo.</span></div><div><strong>3. Publica cuando quieras</strong><span>Primero puedes guardar el borrador sin mostrarlo a nadie.</span></div></div>
 <div class="editor-toolbar"><span class="editor-status" id="editor-status" role="status">${editorDirty?'● Cambios sin guardar':'✓ Vista previa lista'}</span><div class="editor-toolbar-buttons"><button type="button" class="btn btn-secondary" data-action="editor-reset">↶ Recuperar lo publicado</button><button type="button" class="btn btn-secondary" data-action="editor-save">Guardar borrador</button><button type="button" class="btn btn-primary" data-action="editor-publish">✓ Publicar cambios</button></div></div>
 <div id="editor-notice" class="admin-form-feedback" role="alert" hidden></div>
 ${pagePicker}<div class="editor-layout"><div class="editor-panel">${langPicker}<nav class="editor-categories" aria-label="Elementos que puedes editar">${EDITOR_GROUPS.map(([key,title])=>`<button type="button" data-action="editor-category" data-category="${key}" class="editor-category ${editorCategory===key?'active':''}" aria-current="${editorCategory===key?'true':'false'}">${title}</button>`).join('')}</nav><section class="editor-controls"><div class="editor-controls-head"><span class="eyebrow">PERSONALIZAR</span><h2>${H(selected.replace(/^[^ ]+ /,''))}</h2><p>Modifica los campos a tu gusto. No cambiarán para el público hasta que pulses «Publicar cambios».</p></div>${editorUI}</section></div>
 <div class="editor-preview-wrap"><div class="editor-preview-head"><div><strong>Vista previa · toca para editar ✎</strong><small>Haz clic sobre cualquier texto, icono o sobre el logo para modificarlo aquí</small></div><div class="editor-devices"><button class="btn btn-secondary btn-mini ${editorDevice==='desktop'?'active':''}" type="button" data-action="editor-device" data-device="desktop" aria-pressed="${editorDevice==='desktop'}">▭ Ordenador</button><button class="btn btn-secondary btn-mini ${editorDevice==='mobile'?'active':''}" type="button" data-action="editor-device" data-device="mobile" aria-pressed="${editorDevice==='mobile'}">▯ Móvil</button></div></div><div class="editor-inspector" id="editor-inspector" hidden aria-live="polite"><div class="editor-inspector-head"><div><span class="eyebrow">EDICIÓN DIRECTA</span><h3 id="editor-inspector-title">Elemento seleccionado</h3></div><button type="button" class="btn btn-secondary btn-mini" data-action="editor-inspector-close" aria-label="Cerrar edición">✕ Cerrar</button></div><p class="editor-inspector-help" id="editor-inspector-help"></p><div id="editor-inspector-image" hidden><img class="editor-inspector-photo" id="editor-inspector-photo" src="assets/logo-bellaquitas.webp" alt="Imagen seleccionada"/><label class="btn btn-primary editor-pick-photo" for="editor-click-image-file">📷 Cambiar esta imagen</label><input class="admin-file-input" id="editor-click-image-file" type="file" accept="image/jpeg,image/png,image/webp"/><button type="button" class="btn btn-secondary btn-mini" data-action="editor-logo-reset">↶ Recuperar logo original</button><p class="field-help">JPG, PNG o WebP, máximo 5 MB. Al elegir una imagen, primero se guardará como cambio sin publicar.</p></div><div id="editor-inspector-text" hidden><label class="editor-inspector-label" for="editor-inspector-input">Escribe el texto nuevo</label><textarea id="editor-inspector-input" rows="3" maxlength="1200"></textarea><p class="field-help">Mira cómo cambia la vista previa. Para que los visitantes lo vean, pulsa «Publicar cambios».</p></div><div id="editor-inspector-event" hidden><button type="button" class="btn btn-primary" data-action="editor-event-open">✎ Cambiar foto y datos del evento</button><p class="field-help">Los eventos se gestionan por separado en el panel, para mantener su fecha y publicación.</p></div></div><div class="editor-preview-surface"><iframe id="editor-preview" class="editor-preview ${editorDevice==='mobile'?'mobile':''}" sandbox="allow-same-origin" referrerpolicy="no-referrer" title="Vista previa interactiva: pulsa un elemento para editarlo"></iframe></div><p class="editor-preview-foot">Puedes tocar el logo, los iconos y los textos de la vista previa para modificarlos. Si pulsas un elemento de «Experiencia» o «Ventajas», el editor te lleva directamente a esa parte. Para crear eventos, premios y promociones utiliza <a href="#/panel">Panel administrador</a>. Esos contenidos se guardan por separado.</p><a class="btn btn-secondary btn-mini" href="#/" target="_blank" rel="noopener noreferrer">↗ Ver página publicada</a></div></div>`;
}
function editorPreviewHTML(){
 const previous=editorPreviewOverride;editorPreviewOverride=editorDraft;
 let html;
 try{
  if(['home','experience','events','benefits','faq','cta'].includes(editorPage))html=landing(editorPage==='home'?'':editorPage);
  else if(['login','signup'].includes(editorPage)){
   const tab=authTab;authTab=editorPage==='signup'?'signup':'login';
   try{html=auth();}finally{authTab=tab;}
  }else{
   const pageRoutes={member:'/mi-espacio',card:'/tarjeta',profile:'/perfil',rewards:'/premios',agenda:'/agenda',gate:'/puerta',panel:'/panel'};
   const screens={member:summary,card,profile,rewards,agenda,gate,panel:admin};
   const previousRoute=route;route=pageRoutes[editorPage]||'/';
   try{html=appShell((screens[editorPage]||summary)());}finally{route=previousRoute;}
  }
 }finally{editorPreviewOverride=previous;}
 const theme=editorDraft.theme==='classic'?'':'theme-'+editorDraft.theme;
 const css=H(new URL('styles.css',location.href).href);
 return `<!doctype html><html lang="${editorLanguage}"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><link rel="stylesheet" href="${css}"/><style>[data-edit-field],[data-edit-image],[data-edit-event-id]{cursor:pointer!important;outline:1px dashed #f3ca83;outline-offset:4px;border-radius:3px;transition:outline-color .12s,background .12s}[data-edit-field]:hover,[data-edit-field]:focus-visible,[data-edit-image]:hover,[data-edit-image]:focus-visible,[data-edit-event-id]:hover{outline:3px solid #ffe6a5!important;background:#e6a33d25}span[data-edit-field]{-webkit-box-decoration-break:clone;box-decoration-break:clone}.hero h1>[data-edit-field="hero_title_a"]{display:inline!important;background:none!important;color:inherit!important}.hero h1>span>[data-edit-field="hero_title_b"]{display:inline!important}img[data-edit-image]{outline-offset:-3px}a,button{cursor:default!important}</style></head><body class="${theme} bf-neon">${html}</body></html>`;
}
function editorFieldInfo(key){
 for(const [group,fields] of Object.entries(SITE_FIELDS)){
  const found=fields.find(([id])=>id===key);
  if(found)return {group,label:found[1]};
 }
 return {group:'main',label:'Texto de la web'};
}
function clearEditorSelection(){
 editorSelection=null;
 const panel=$('#editor-inspector');if(panel)panel.hidden=true;
}
function showEditorSelection(info){
 if(route!=='/editor'||current?.role!=='admin'||!editorDraft)return;
 const box=$('#editor-inspector');if(!box)return;
 editorSelection=info;
 const title=$('#editor-inspector-title'),help=$('#editor-inspector-help');
 const image=$('#editor-inspector-image'),text=$('#editor-inspector-text'),event=$('#editor-inspector-event');
 image.hidden=info.type!=='image';text.hidden=!['text','ui'].includes(info.type);event.hidden=info.type!=='event';
 if(info.type==='image'){
  title.textContent=info.key==='header_logo_url'?'Imagen de la cabecera':'Imagen principal · logo';
  help.textContent=info.key==='header_logo_url'?'Puedes cambiar el logo pequeño sin tocar el de la portada.':'Puedes sustituir la imagen principal.';
  $('#editor-inspector-photo').src=info.key==='header_logo_url'?headerImage():siteImageFromEditor();
 }else if(info.type==='ui'){
  editorCategory='ui';title.textContent='Texto de la aplicación';help.textContent='Edita este texto del idioma seleccionado. Los datos reales de socios no se modifican aquí.';$('#editor-inspector-input').value=editorDraft.ui_copy?.[editorLanguage]?.[info.key]??translateLabel(info.key,editorLanguage,editorDraft);
 }else if(info.type==='text'){
  const field=editorFieldInfo(info.key);
  title.textContent=field.label;
  help.textContent='Estás editando justo el texto que has pulsado en la página.';
  const input=$('#editor-inspector-input');input.value=editorFieldValue(info.key);
  input.maxLength=1200;
  // Mantener los campos laterales sincronizados sin reiniciar la posición de la vista previa.
  editorCategory=field.group;
  const controls=$('.editor-controls');
  if(controls){
   const title=EDITOR_GROUPS.find(x=>x[0]===field.group)?.[1]||'Portada';
   controls.innerHTML=`<div class="editor-controls-head"><span class="eyebrow">PERSONALIZAR</span><h2>${H(title.replace(/^[^ ]+ /,''))}</h2><p>También puedes pulsar directamente sobre los elementos de la vista previa.</p></div>${editorFields(field.group)}`;
   document.querySelectorAll('.editor-category').forEach(btn=>{
    const selected=btn.dataset.category===field.group;
    btn.classList.toggle('active',selected);btn.setAttribute('aria-current',selected?'true':'false');
   });
  }
 }else{
  title.textContent='Foto o datos del evento';
  help.textContent='Has seleccionado un evento publicado. Puedes editar su imagen, fecha, ubicación o descripción desde el panel.';
 }
 box.hidden=false;
 box.scrollIntoView({behavior:'instant',block:'nearest'});
 if(info.type==='text' && window.matchMedia('(min-width: 720px)').matches)$('#editor-inspector-input')?.focus({preventScroll:true});
}
function siteImageFromEditor(){return safeImage(editorDraft?.logo_url)||'assets/logo-bellaquitas.webp';}
function bindEditorPreview(frame,restoreY=0){
 if(route!=='/editor'||current?.role!=='admin'||!frame.isConnected)return;
 let doc;try{doc=frame.contentDocument;}catch{return;}
 if(!doc||doc.__bellaquitasBound||!doc.body)return;
 doc.__bellaquitasBound=true;translateDOM(doc,editorLanguage,editorDraft);
 doc.addEventListener('click',ev=>{
  ev.preventDefault();ev.stopPropagation();
  const navlink=ev.target?.closest?.('a[href^="#/"]');
  if(navlink){
   const routeName=(navlink.getAttribute('href')||'').slice(2);
   const page={experiencia:'experience',eventos:'events',ventajas:'benefits',preguntas:'faq', acceso:'login',registro:'signup','mi-espacio':'member',tarjeta:'card',perfil:'profile',premios:'rewards',agenda:'agenda',puerta:'gate',panel:'panel', '':'home'}[routeName];
   if(page){editorPage=page;editorCategory=page==='home'?'main':['experience','events','benefits','faq','cta'].includes(page)?page:'ui';clearEditorSelection();render();return;}
  }
  const target=ev.target?.closest?.('[data-edit-image],[data-edit-field],[data-edit-event-id],[data-edit-section]');
  if(!target){
   const leaf=ev.target?.closest?.('h1,h2,h3,p,label,small,strong,button,a,span,th,td');
   if(!leaf||leaf.closest('img,svg,.side-profile,.loyalty-code-tools,.member-record,.member-editor,[data-no-translate]'))return;
   const text=leaf.textContent.trim();
   if(!text||text.length>230||/^[\d.,\s+−-]+$/.test(text)||text.includes('@')||/^(BF|MBR|CNJ)-[\w-]+/.test(text))return;
   const reverse=Object.entries(UI_ALL_FR).find(([key,val])=>val===text)?.[0];
   showEditorSelection({type:'ui',key:reverse||text,node:leaf});return;
  }
  if(target.dataset.editImage){showEditorSelection({type:'image',key:target.dataset.editImage});return;}
  if(target.dataset.editField&&Object.hasOwn(SITE_DEFAULTS,target.dataset.editField)){
   showEditorSelection({type:'text',key:target.dataset.editField});return;
  }
  const event=target.closest('[data-edit-event-id]');
  if(event?.dataset.editEventId){showEditorSelection({type:'event',id:event.dataset.editEventId});return;}
  const section=target.closest('[data-edit-section]');if(section?.dataset.editSection){editorCategory=section.dataset.editSection;editorPage=editorCategory;clearEditorSelection();render();return;}
 },true);
 doc.addEventListener('keydown',ev=>{
  if(!['Enter',' '].includes(ev.key))return;
  if(!ev.target?.matches?.('[data-edit-field],[data-edit-image]'))return;
  ev.preventDefault();ev.target.click();
 });
 try{frame.contentWindow.scrollTo({top:restoreY,left:0,behavior:'instant'});}catch{}
}
function renderEditorPreview(){
 const frame=$('#editor-preview');if(!frame||!editorDraft)return;
 let restoreY=0;
 try{restoreY=frame.contentWindow?.scrollY||0;}catch{}
 frame.addEventListener('load',()=>bindEditorPreview(frame,restoreY),{once:true});
 frame.srcdoc=editorPreviewHTML();
 // Vincular los clics también antes de que terminen de cargar imágenes y fuentes.
 requestAnimationFrame(()=>bindEditorPreview(frame,restoreY));
 setTimeout(()=>bindEditorPreview(frame,restoreY),120);
 setTimeout(()=>bindEditorPreview(frame,restoreY),550);
}
function setInlineEditorText(value){
 if(!editorSelection||!['text','ui'].includes(editorSelection.type)||current?.role!=='admin'||route!=='/editor')return;
 if(editorSelection.type==='ui'){
  const lang=editorLanguage;editorDraft.ui_copy[lang][editorSelection.key]=value;
  if(editorSelection.node?.isConnected)editorSelection.node.textContent=value||' ';
  const other=$('[data-ui-copy-key="'+CSS.escape(editorSelection.key)+'"]');if(other)other.value=value;
  markEditorDirty();return;
 }
 const key=editorSelection.key;
 if(!Object.hasOwn(SITE_DEFAULTS,key)||typeof SITE_DEFAULTS[key]!=='string')return;
 setEditorLocalizedValue(key,value);
 const side=$('#editor-'+key);if(side&&side.value!==value)side.value=value;
 const frame=$('#editor-preview');
 try{frame.contentDocument?.querySelectorAll('[data-edit-field="'+key+'"]').forEach(node=>{node.textContent=value||' ';});}catch{}
 markEditorDirty();
}
function markEditorDirty(){editorDirty=true;const el=$('#editor-status');if(el)el.textContent='● Cambios sin guardar';}
function updateEditorValue(el){
 if(route!=='/editor'||current?.role!=='admin')return;
 ensureEditor();
 if(el.hasAttribute('data-editor-field')){
  const key=el.dataset.editorField;
  if(!Object.hasOwn(SITE_DEFAULTS,key)||typeof SITE_DEFAULTS[key]!=='string')return;
  setEditorLocalizedValue(key,el.value);
 }else if(el.hasAttribute('data-editor-visibility')){
  const key=el.dataset.editorVisibility;
  if(!Object.hasOwn(EDITOR_SECTIONS,key))return;
  editorDraft.visible[key]=el.checked;
 }else if(el.hasAttribute('data-editor-bool')){
  const key=el.dataset.editorBool;if(!['header_show_logo','header_show_text','hero_show_logo'].includes(key))return;editorDraft[key]=el.checked;
 }
 markEditorDirty();renderEditorPreview();
}
async function editorUploadLogo(input){
 if(!sb||current?.role!=='admin')throw new Error('Debes entrar con una cuenta administradora.');
 const file=input.files?.[0];if(!file)return;
 input.disabled=true;
 try{
  const image=await uploadAdminImage('logos',file);
  const key=(input.dataset.editorImageKey||editorSelection?.key||'logo_url');
  if(!['logo_url','header_logo_url'].includes(key))throw new Error('Imagen no autorizada.');
  editorDraft[key]=image.url;
  const field=$('#editor-'+key);if(field)field.value=image.url;
  const photo=$('#editor-inspector-photo');if(photo)photo.src=image.url;
  const inspectorHelp=$('#editor-inspector-help');if(inspectorHelp&&!$('#editor-inspector')?.hidden)inspectorHelp.textContent='✓ Nueva foto subida y visible en la vista previa. Pulsa «Guardar borrador» o «Publicar cambios».';
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
 if(!ask('¿Publicar esta versión de la web para todos los visitantes?'))return;
 const previousPublished=publishedSettings();
 const settings=normalizeEditor(editorDraft);
 const result=await sb.from('site_content').upsert({key:'homepage',hero_text:settings.hero_text||' ',announcement:settings.announcement||' ',page_settings:settings,updated_at:new Date().toISOString()},{onConflict:'key'});
 if(result.error)throw new Error('No se pudo publicar. Ejecuta INSTALAR_EDITOR_WEB.sql y comprueba los permisos. '+result.error.message);
 for(const oldUrl of new Set([previousPublished.logo_url,previousPublished.header_logo_url])){if(oldUrl&&oldUrl!==settings.logo_url&&oldUrl!==settings.header_logo_url)await removeStoredPublicUrl(oldUrl);}
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
 if(act==='editor-category'){editorCategory=el.dataset.category;if(['main','experience','events','benefits','faq','cta'].includes(editorCategory))editorPage=editorCategory==='main'?'home':editorCategory;clearEditorSelection();await render();return;}
 if(act==='editor-page'){editorPage=el.dataset.page;editorCategory=editorPage==='home'?'main':['experience','events','benefits','faq','cta'].includes(editorPage)?editorPage:'ui';clearEditorSelection();await render();return;}
 if(act==='editor-lang'){editorLanguage=el.dataset.lang==='fr'?'fr':'es';clearEditorSelection();await render();return;}
 if(act==='editor-inspector-close'){clearEditorSelection();return;}
 if(act==='editor-logo-reset'){const key=editorSelection?.type==='image'&&editorSelection.key==='header_logo_url'?'header_logo_url':'logo_url';editorDraft[key]='';const side=$('#editor-'+key);if(side)side.value='';const photo=$('#editor-inspector-photo');if(photo)photo.src='assets/logo-bellaquitas.webp';markEditorDirty();renderEditorPreview();toast('Logo original seleccionado. Publica los cambios para aplicarlo.');return;}
 if(act==='editor-event-open'){if(editorSelection?.type!=='event')return;adminTab='events';adminEditId=editorSelection.id;adminFormOpen=true;clearEditorSelection();to('/panel');return;}
 if(act==='editor-device'){editorDevice=el.dataset.device;clearEditorSelection();await render();return;}
 if(act==='editor-theme'){
  if(!['classic','minimal','festival'].includes(el.dataset.theme))return;
  editorDraft.theme=el.dataset.theme;markEditorDirty();clearEditorSelection();await render();return;
 }
 if(act==='editor-move'){
  const key=el.dataset.section,index=editorDraft.order.indexOf(key),dir=el.dataset.direction==='up'?-1:1;
  if(index<0||index+dir<0||index+dir>=editorDraft.order.length)return;
  [editorDraft.order[index],editorDraft.order[index+dir]]=[editorDraft.order[index+dir],editorDraft.order[index]];
  markEditorDirty();await render();return;
 }
 if(act==='editor-reset'){
  if(!ask('¿Volver a la última versión publicada? Los cambios del editor que no hayas publicado se perderán.'))return;
  editorDraft=normalizeEditor(publishedSettings());markEditorDirty();clearEditorSelection();await render();toast('Vista previa restaurada. Para hacerla definitiva, pulsa Guardar borrador.');return;
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
  document.body.classList.add('bf-neon');
  if(!route.startsWith('/panel') && route!=='/editor' && (!current || !allowed(route))){const t=publishedSettings().theme;if(t==='minimal'||t==='festival')document.body.classList.add('theme-'+t);}
  if(Object.prototype.hasOwnProperty.call(AUTH_ROUTES,route))authTab=AUTH_ROUTES[route];
  const needsAuth=route.startsWith('/mi-')||['/tarjeta','/premios','/agenda','/perfil','/puerta','/panel','/editor'].includes(route);
  if(!current&&needsAuth)route='/acceso';
  if(current&&route in AUTH_ROUTES&&route!=='/restablecer')route=current.role==='admin'?'/panel':current.role==='puerta'?'/puerta':'/mi-espacio';
  if(current&&route!=='/'&&!allowed(route)&&!['/experiencia','/eventos','/ventajas','/preguntas','/restablecer'].includes(route))route='/mi-espacio';
  let html='';
  if(route in AUTH_ROUTES)html=auth();
  else if(current&&allowed(route))html=appShell(route==='/mi-espacio'?summary():route==='/tarjeta'?card():route==='/premios'?rewards():route==='/agenda'?agenda():route==='/perfil'?profile():route==='/puerta'?gate():route==='/editor'?editor():admin());
  else html=landing(({experiencia:'experience',eventos:'events',ventajas:'benefits',preguntas:'faq'}[route.slice(1)])||'');
  $('#app').innerHTML=html;
 document.documentElement.classList.remove('auth-booting');
 translateDOM(document);
  document.title=(route==='/'?'Bellaquitas Fest':(current&&allowed(route)?translateLabel('Mi cuenta')+' · Bellaquitas Fest':translateLabel('Acceso y registro')+' · Bellaquitas Fest'));
  document.querySelector('meta[name="robots"]')?.setAttribute('content',current&&allowed(route)?'noindex,nofollow':'index,follow');
  window.scrollTo({top:0,behavior:'instant'});
  if(route==='/tarjeta'||route==='/perfil')createQR(current.member_code);
  if(route==='/editor')renderEditorPreview();
}
function to(path){if(location.hash==='#'+path){render();return;}location.hash=path;}
// La sesión de Supabase se guarda en el almacenamiento persistente del navegador.
// No duplicar ni guardar tokens en otras claves: Supabase se encarga de renovarlos.
let authStartupComplete=false;
let authResumeBusy=false;
let authListenerAttached=false;
function browserCanRememberSession(){
 try{
  const key='bellaquitas-storage-check';
  localStorage.setItem(key,'ok');
  const available=localStorage.getItem(key)==='ok';
  localStorage.removeItem(key);
  return available;
 }catch{return false;}
}
function showAuthLoadingError(error){
 document.documentElement.classList.remove('auth-booting');
 console.warn('No se pudo recuperar la cuenta sin cerrar la sesión:',error);
 const box=$('#app');
 if(!box)return;
 box.innerHTML='<main class="container" style="padding:90px 20px;max-width:700px;text-align:center"><h1>Conectando con tu cuenta…</h1><p>No hemos podido recuperar tus datos en este momento. Tu sesión no se ha cerrado. Comprueba la conexión y vuelve a intentarlo.</p><button type="button" class="btn btn-primary" data-action="auth-retry">↻ Reintentar</button></main>';
}
async function loadLive(){
 const {data:authData,error:authError}=await sb.auth.getSession();
 if(authError)throw new Error('No se pudo comprobar la sesión guardada: '+authError.message);
 const user=authData?.session?.user||null;
 if(!user){session=null;current=null;editorDraft=null;data=emptyData();return;}
 const uid=user.id;
 // Primero confirmar la ficha del usuario. Nunca tratar un fallo de red como cierre de sesión.
 const own=await sb.from('profiles').select('*').eq('id',uid).maybeSingle();
 if(own.error)throw new Error('No se pudo cargar tu ficha de socio: '+own.error.message);
 if(!own.data)throw new Error('La sesión está activa pero tu ficha no está disponible. Contacta con administración.');
 const [p,e,r,pr,re,a,sc]=await Promise.all([
  sb.from('profiles').select('*'),
  sb.from('events').select('*').order('created_at',{ascending:false}),
  sb.from('rewards').select('*').order('created_at',{ascending:false}),
  sb.from('promos').select('*'),
  sb.from('redemptions').select('*').order('created_at',{ascending:false}),
  sb.from('activity').select('*').order('created_at',{ascending:false}).limit(200),
  sb.from('site_content').select('*')
 ]);
 for(const x of [p,e,r,pr,re,a,sc])if(x.error)console.warn('Consulta de datos:',x.error.message);
 session=user;
 data={profiles:p.data||[own.data],events:e.data||[],rewards:r.data||[],promos:pr.data||[],redemptions:re.data||[],activity:a.data||[],site_content:sc.data||[],site_drafts:[]};
 if(!data.profiles.some(x=>x.id===uid))data.profiles.push(own.data);
 current=own.data;
 if(current.role==='admin'){
  const [dr,changes]=await Promise.all([
   sb.from('site_drafts').select('*').eq('key','homepage'),
   sb.from('admin_member_changes').select('*').order('created_at',{ascending:false}).limit(40)
  ]);
  if(dr.error)console.warn('Editor:',dr.error.message);
  if(changes.error)console.warn('Socios:',changes.error.message);
  data.site_drafts=dr.data||[];
  data.member_changes=changes.data||[];
 }
}
async function resumeSavedSession(){
 if(!sb||!authStartupComplete||authResumeBusy||document.visibilityState==='hidden')return;
 authResumeBusy=true;
 try{
  const {data:authData,error}=await sb.auth.getSession();
  if(error)throw error;
  const uid=authData?.session?.user?.id||null;
  if(!uid){
   if(session){session=null;current=null;editorDraft=null;await loadPublic();await render();}
   return;
  }
  if(!current||current.id!==uid){
   await loadLive();
   await render();
  }else{
   session=authData.session.user;
  }
 }catch(err){
  // Los fallos temporales de conexión no deben provocar un nuevo inicio de sesión.
  console.warn('Restauración de sesión aplazada:',err);
  if(!current)showAuthLoadingError(err);
 }finally{authResumeBusy=false;}
}
window.addEventListener('pageshow',ev=>{if(ev.persisted)void resumeSavedSession();});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void resumeSavedSession();});
window.addEventListener('online',()=>{void resumeSavedSession();});

async function loadPublic(){const [e,r,pr,sc]=await Promise.all([sb.from('events').select('*').eq('active',true),sb.from('rewards').select('*').eq('active',true),sb.from('promos').select('*').eq('active',true),sb.from('site_content').select('*')]);data={...emptyData(),events:e.data||[],rewards:r.data||[],promos:pr.data||[],site_content:sc.data||[]};}
async function refresh(){if(!sb)throw new Error('Servicio de cuentas no configurado.');if(session)await loadLive();else await loadPublic();await render();}
function subscribeToSessionChanges(){
 if(authListenerAttached||!sb)return;
 authListenerAttached=true;
sb.auth.onAuthStateChange((event,newSession)=>{
    if(event==='PASSWORD_RECOVERY'){
     authTab='reset';location.hash='/restablecer';
     if(authStartupComplete)void render();
     return;
    }
    if(event==='SIGNED_OUT'){
     if(session||current){
      session=null;current=null;editorDraft=null;
      setTimeout(()=>{void loadPublic().then(render).catch(showAuthLoadingError);},0);
     }
     return;
    }
    // En otra pestaña o al regresar de Google, recuperar la sesión sin pedir contraseña.
    // Nunca esperar consultas SQL dentro del callback de Supabase Auth.
    if((event==='SIGNED_IN'||event==='TOKEN_REFRESHED')&&newSession?.user &&
       authStartupComplete && (!current||current.id!==newSession.user.id)){
      setTimeout(()=>{void resumeSavedSession();},0);
    }
   });
}

async function init(){
 clearOldLocalData();
 document.documentElement.lang=activeLang;
 authStartupComplete=false;
 if(live){
  try{
   const m=await import('https://esm.sh/@supabase/supabase-js@2.118.0');
   sb=m.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey,{
    auth:{
     autoRefreshToken:true,
     persistSession:true,
     detectSessionInUrl:true,
     flowType:'pkce'
    }
   });
   subscribeToSessionChanges();
   await loadLive();
   if(!session)await loadPublic();
   const callbackParams=new URLSearchParams(location.search);
   if(callbackParams.get('acceso')==='google'){
    const providerError=callbackParams.get('error_description')||callbackParams.get('error');
    cleanGoogleReturnUrl();
    if(session&&current){location.hash=destinationForUser();authNotice='';}
    else{
     authNotice=providerError
       ?'No se pudo completar el acceso con Google. Revisa los permisos e inténtalo de nuevo.'
       :session?'Google ha confirmado tu cuenta, pero no se ha creado la ficha de socio. Comprueba la instalación de supabase.sql.'
       :'No se ha completado el acceso con Google. Inténtalo otra vez o utiliza tu correo.';
     location.hash='/acceso';
    }
   }
   if(callbackParams.get('recuperar')==='1'&&session){authTab='reset';location.hash='/restablecer';}
   authStartupComplete=true;
   if(session&&!browserCanRememberSession())toast('Tu navegador no permite guardar la sesión. Abre la web en Safari o Chrome fuera de WhatsApp.');
  }catch(err){
   authStartupComplete=false;
   console.error('Error de inicio de sesión:',err);
   showAuthLoadingError(err);
   return;
  }
 }else{data=emptyData();session=null;current=null;}
 await render();
}
function createQR(code){
 // El generador QR está integrado en la web. No depende de CDN, conexiones externas ni servicios de terceros.
 if(!$('#qr-code'))return;
 try{
  if(!window.BellaQR?.render)throw new Error('El generador QR no se ha cargado. Recarga la aplicación.');
  const value=String(code||'').trim().toUpperCase();
  for(const selector of ['#qr-code','#qr-code-big','#qr-code-modal']){
   const box=$(selector);if(!box)continue;
   window.BellaQR.render(box,value,{label:activeLang==='fr'?'Code QR personnel du membre':'Código QR personal del socio'});
  }
 }catch(err){
  console.error('Error al dibujar el QR:',err);
  for(const selector of ['#qr-code','#qr-code-big','#qr-code-modal']){
   const box=$(selector);if(box){box.replaceChildren();const span=document.createElement('span');span.textContent=(activeLang==='fr'?'QR indisponible. Code : ':'QR no disponible. Código: ')+String(code||'');box.append(span);}
  }
 }
}

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
  if(!ask(`Solicitar "${r.name}" por ${r.cost} puntos?`))return;
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
 if(!ask(`¿Quieres eliminar definitivamente «${item.name}»? Esta acción no se puede deshacer.\n\nSi solo quieres quitarlo de la web, pulsa Cancelar y usa Ocultar.`))return;
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
 const fr={};for(const field of ['name','description','location','category']){
  if(fd.has(field+'_fr')){
   const val=String(fd.get(field+'_fr')||'').trim();
   if(val.length>(field==='description'?1200:field==='location'?160:120))throw new Error('La traducción francesa es demasiado larga.');
   if(val)fr[field]=val;
  }
 }
 item.localized_content={fr};
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
 const {error}=await sb.storage.from(MEDIA_BUCKET).upload(key,file,{contentType:file.type,upsert:false});
 if(error)throw new Error('No se pudo subir la foto. Comprueba que has instalado la ampliación SQL del panel. '+error.message);
 const {data:publicData}=sb.storage.from(MEDIA_BUCKET).getPublicUrl(key);
 return {url:publicData.publicUrl,key};
}
async function saveAdminItem(form){
 if(!sb||current?.role!=='admin')throw new Error('Solo el administrador puede guardar contenido.');
 const table=form.dataset.table;const id=form.dataset.id;const fd=new FormData(form);const item=itemPayload(table,fd);const previousItem=id?data[table].find(x=>x.id===id):null;
 const feedback=form.querySelector('#admin-form-feedback');const button=form.querySelector('button[type="submit"]');
 if(feedback){feedback.hidden=true;feedback.textContent='';}button.disabled=true;const previousText=button.textContent;button.textContent='Guardando…';
 let uploaded=null;
 try{
  if(fd.has('remove_image')&&fd.get('remove_image')==='on')item.image_url='';
  const file=fd.get('image');if(file instanceof File&&file.size>0){uploaded=await uploadAdminImage(table,file);item.image_url=uploaded.url;}
  const result=id?await sb.from(table).update(item).eq('id',id):await sb.from(table).insert(item);
  if(result.error)throw new Error(result.error.message);
  if(previousItem?.image_url && previousItem.image_url!==item.image_url)await removeStoredPublicUrl(previousItem.image_url);
  adminEditId=null;adminFormOpen=false;
  await refresh();toast(id?'Cambios guardados correctamente.':'Contenido creado correctamente.');
 }catch(err){
  if(uploaded){try{await sb.storage.from(MEDIA_BUCKET).remove([uploaded.key]);}catch{}}
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
// La cámara puede tardar en conceder permisos. El contador cancela inicios
// pendientes cuando cambia la página o se cierra el lector.
let scanGeneration=0;
let scanStarting=false;
function stopScan(){
 scanGeneration++;
 if(scanLoop){clearInterval(scanLoop);scanLoop=null;}
 if(scanner){scanner.getTracks().forEach(track=>track.stop());scanner=null;}
 $('#camera-wrap')?.classList.remove('active');
}
let qrScannerLibraryPromise=null;
async function getQRScanner(){
 if(typeof window.jsQR==='function')return window.jsQR;
 if(!qrScannerLibraryPromise){
  qrScannerLibraryPromise=new Promise((resolve,reject)=>{
   const script=document.createElement('script');
   script.src=new URL('assets/jsqr-local.js',location.href).href;
   script.async=true;
   script.onload=()=>typeof window.jsQR==='function'
     ?resolve(window.jsQR):reject(new Error('El lector QR auxiliar no está disponible.'));
   script.onerror=()=>reject(new Error('No se pudo cargar el lector QR auxiliar.'));
   document.head.appendChild(script);
  }).catch(err=>{qrScannerLibraryPromise=null;throw err;});
 }
 return qrScannerLibraryPromise;
}
async function startScan(){
 if(scanStarting||scanner)return;
 if(!navigator.mediaDevices?.getUserMedia){
  toast('La cámara no está disponible. Introduce el código del socio manualmente.');
  return;
 }
 const generation=scanGeneration;
 scanStarting=true;
 let openedStream=null;
 try{
  openedStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
  // Si el usuario abandonó la pantalla durante el diálogo de permisos,
  // cerrar inmediatamente la cámara recién concedida.
  if(generation!==scanGeneration||route!=='/puerta'){
   openedStream.getTracks().forEach(track=>track.stop());
   return;
  }
  scanner=openedStream;
  const v=$('#camera');
  if(!v){stopScan();return;}
  v.srcObject=scanner;
  v.setAttribute('playsinline','');
  await v.play();
  if(generation!==scanGeneration||!v.isConnected){stopScan();return;}
  $('#camera-wrap')?.classList.add('active');
  let detector=null;
  if('BarcodeDetector' in window){
   try{detector=new BarcodeDetector({formats:['qr_code']});}
   catch(err){console.warn('Se utilizará el lector QR alternativo:',err);}
  }
  // El lector nativo continúa funcionando aunque no se cargue la biblioteca auxiliar.
  let jsqr=null;
  try{jsqr=await getQRScanner();}
  catch(err){if(!detector)throw err;console.warn('Continuando con el lector QR nativo:',err.message);}
  if(generation!==scanGeneration||!scanner||!v.isConnected){stopScan();return;}
  const canvas=jsqr?document.createElement('canvas'):null;
  const ctx=canvas?.getContext('2d',{willReadFrequently:true})||null;
  if(!detector&&!ctx)throw new Error('Este navegador no puede analizar la cámara. Usa el código manual.');
  let busy=false;
  scanLoop=setInterval(async()=>{
   if(busy||!scanner||generation!==scanGeneration||v.readyState<2)return;
   busy=true;
   try{
    let code='';
    if(detector){
     try{const detected=await detector.detect(v);code=detected[0]?.rawValue||'';}
     catch(err){detector=null;console.warn('Cambiando al lector QR alternativo:',err.message);}
    }
    if(!code&&ctx){
     const width=Math.min(900,v.videoWidth||900);
     const height=Math.round(width*(v.videoHeight||480)/Math.max(1,v.videoWidth||900));
     canvas.width=width;canvas.height=height;
     ctx.drawImage(v,0,0,width,height);
     const image=ctx.getImageData(0,0,width,height);
     code=jsqr(image.data,width,height,{inversionAttempts:'attemptBoth'})?.data||'';
    }
    if(generation!==scanGeneration)return;
    if(!detector&&!ctx)throw new Error('No hay un lector QR compatible. Introduce el código manualmente.');
    if(code){
     code=String(code).trim().toUpperCase();
     if(!/^MBR-[A-Z0-9-]{5,80}$/.test(code)){
      toast('Este QR no es de una tarjeta Bellaquitas Fest.');
      return;
     }
     stopScan();
     try{
      await visit(code);
     }catch(err){
      // Tras detener la cámara cambia scanGeneration: el error de la RPC
      // debe seguir mostrándose aunque el lector ya esté cerrado.
      console.error('Validación de visita:',err);
      toast(err.message||'No se ha podido registrar esta visita. Introduce el código manualmente.');
     }
    }
   }catch(err){
    console.error('Lectura QR:',err);
    if(generation===scanGeneration)toast(err.message||'No se pudo validar el QR. Usa el código manual.');
   }finally{busy=false;}
  },650);
 }catch(err){
  if(generation===scanGeneration){
   stopScan();
   toast('No se pudo abrir el lector QR. Permite usar la cámara o introduce el código manualmente. '+(err.message||''));
  }
 }finally{
  scanStarting=false;
 }
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
document.addEventListener('click',ev=>{const link=ev.target.closest('a[href^="#/"]');if(route==='/editor'&&editorDirty&&link&&link.getAttribute('href')!=='#/editor'&&link.target!=='_blank'&&!ask('Tienes cambios sin guardar. ¿Quieres salir sin guardarlos?')){ev.preventDefault();ev.stopImmediatePropagation();}},true);
document.addEventListener('click',ev=>{const el=ev.target.closest('[data-action]');if(!el)return;const act=el.dataset.action;execute(async()=>{if(act.startsWith('editor-')){await editorAction(el,act);return;}if(act==='open-search'){setSiteSearchOpen($('#site-search-panel')?.hidden);return;}if(act==='close-search'){setSiteSearchOpen(false);return;}if(act==='menu'){setSiteSearchOpen(false);menuOpen=!menuOpen;$('#site-menu')?.classList.toggle('open',menuOpen);el.setAttribute('aria-expanded',String(menuOpen));el.setAttribute('aria-label',menuOpen?'Cerrar menú':'Abrir menú');el.classList.toggle('is-open',menuOpen);return;}if(act==='set-lang'){if(!['es','fr'].includes(el.dataset.lang))return;activeLang=el.dataset.lang;try{localStorage.setItem('bellaquitas-lang',activeLang);}catch{}document.documentElement.lang=activeLang;await render();return;}if(act==='auth-retry'){try{if(!sb)await init();else{await loadLive();if(!session)await loadPublic();authStartupComplete=true;await render();}}catch(err){showAuthLoadingError(err);}return;}if(act==='install-app'){await installApp();return;}if(act==='auth-tab'){authNotice='';authTab=el.dataset.tab;render();return;}if(act==='google-login'){await signInWithGoogle(el);return;}if(act==='logout'){editorDraft=null;editorDirty=false;stopScan();if(!sb)throw new Error('Servicio no disponible.');await sb.auth.signOut({scope:'local'});session=null;current=null;await loadPublic();to('/acceso');return;}if(act==='loyalty-face'){
 const chosen=el.dataset.face==='back'?'back':'front';
 document.querySelectorAll('[data-loyalty-face]').forEach(face=>{face.hidden=face.dataset.loyaltyFace!==chosen;});
 document.querySelectorAll('.loyalty-face-button').forEach(btn=>{const on=btn.dataset.face===chosen;btn.classList.toggle('active',on);btn.setAttribute('aria-pressed',String(on));});
 const qrLarge=$('#loyalty-qr-large');if(qrLarge)qrLarge.hidden=chosen!=='back';
 return;
 }
 if(act==='qr-expand'){const dlg=$('#member-qr-dialog');if(dlg?.showModal){dlg.showModal();}else{const box=$('#loyalty-qr-large');if(box){box.hidden=false;box.scrollIntoView({block:'center',behavior:'smooth'});}}return;}
 if(act==='qr-close'){const dlg=$('#member-qr-dialog');if(dlg?.open)dlg.close();return;}
 if(act==='copy-code'){await navigator.clipboard.writeText(current.member_code);toast('Código copiado.');return;}if(act==='redeem'){await redeem(el.dataset.id);return;}if(act==='checkin'){await visit(el.dataset.code);return;}if(act==='validate'){await validate(el.dataset.code);return;}if(act==='scan'){await startScan();return;}if(act==='stop-scan'){stopScan();return;}if(act==='admin-tab'||act==='admin-go'){adminTab=el.dataset.tab;adminEditId=null;memberEditId=null;adminFormOpen=act==='admin-go'&&!el.dataset.list&&adminTab!=='site';render();if(adminFormOpen)focusAdminForm();return;}if(act==='member-edit'){memberEditId=el.dataset.id;render();document.getElementById('member-editor')?.scrollIntoView({behavior:'smooth',block:'start'});document.getElementById('member-name')?.focus({preventScroll:true});return;}if(act==='member-close'){memberEditId=null;render();return;}if(act==='member-points-quick'){const points=$('#member-points');const lifetime=$('#member-lifetime_points');if(!points||!lifetime)return;const next=Math.max(0,Number(points.value||0)+Number(el.dataset.delta||0));if(next>100000000)throw new Error('Se supera el límite de puntos.');points.value=String(next);if(Number(lifetime.value)<next)lifetime.value=String(next);points.dispatchEvent(new Event('input',{bubbles:true}));return;}if(act==='admin-new'){adminTab=el.dataset.table;adminEditId=null;adminFormOpen=true;render();focusAdminForm();return;}if(act==='admin-edit'){adminTab=el.dataset.table;adminEditId=el.dataset.id;adminFormOpen=true;render();focusAdminForm();return;}if(act==='admin-cancel'){adminEditId=null;adminFormOpen=false;render();return;}if(act==='admin-delete'){await removeItem(el.dataset.table,el.dataset.id);return;}if(act==='toggle'){await toggle(el.dataset.table,el.dataset.id);return;}});});
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
  if(!browserCanRememberSession())toast('Para mantener la sesión abierta, utiliza Safari o Chrome y evita el navegador interno de WhatsApp.');
  authNotice='';to(current.role==='admin'?'/panel':current.role==='puerta'?'/puerta':'/mi-espacio');
}
document.addEventListener('submit',ev=>{
  const el=ev.target;
  if(!['auth-form','profile-form','checkin-form','validate-form','admin-item-form','admin-site-form','member-edit-form'].includes(el.id))return;
  ev.preventDefault();const fd=new FormData(el);
  if(el.id==='auth-form'){
    const button=el.querySelector('[type="submit"]');const text=button?.textContent;
    if(button){button.disabled=true;button.textContent='Procesando…';}
    formFeedback('');
    handleAuthSubmit(fd).catch(err=>{console.error(err);formFeedback(err.message||'No se pudo completar la operación.');}).finally(()=>{if(button?.isConnected){button.disabled=!live;button.textContent=text;}});
    return;
  }
  if(el.id==='member-edit-form'){saveMemberForm(el).catch(err=>{console.error(err);const box=el.querySelector('#member-form-feedback');if(box){box.textContent=err.message;box.hidden=false;}});return;}if(el.id==='admin-item-form'){saveAdminItem(el).catch(err=>{console.error(err);const box=el.querySelector('#admin-form-feedback');if(box){box.textContent=err.message;box.hidden=false;}});return;}
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
document.addEventListener('change',ev=>{if(ev.target.id==='admin-member-role'){memberRoleFilter=ev.target.value;filterAdminMembers();return;}if(ev.target.matches('[data-editor-visibility],[data-editor-bool]')){updateEditorValue(ev.target);return;}if(ev.target.id==='editor-click-image-file'||ev.target.id.startsWith('editor-file-')){editorUploadLogo(ev.target).catch(err=>{const help=$('#editor-inspector-help');if(help&&!$('#editor-inspector')?.hidden)help.textContent=err.message;toast(err.message);});return;}if(ev.target.id==='admin-image'){const label=$('#admin-file-status');if(label)label.textContent=ev.target.files[0]?.name||'Ninguna foto seleccionada';}});
document.addEventListener('input',ev=>{if(ev.target.id==='editor-ui-search'){const filter=searchFold(ev.target.value);let visible=0;document.querySelectorAll('.editor-ui-copy-item').forEach(box=>{box.hidden=!box.dataset.uiSearch.includes(filter);if(!box.hidden)visible++;});const count=$('#editor-ui-count');if(count)count.textContent=visible+' '+t('textos editables');return;}if(ev.target.matches('[data-ui-copy-key]')){editorDraft.ui_copy[editorLanguage][ev.target.dataset.uiCopyKey]=ev.target.value;markEditorDirty();return;}if(ev.target.id==='rewards-search'||ev.target.id==='agenda-search'){filterCatalogCards(ev.target);return;}if(ev.target.id==='site-search-input'){renderSiteSearch();return;}if(ev.target.id==='editor-inspector-input'){setInlineEditorText(ev.target.value);return;}if(ev.target.matches('[data-editor-field]')){updateEditorValue(ev.target);return;}if(ev.target.closest('#admin-item-form'))updateAdminPreview(ev.target.closest('#admin-item-form'));if(ev.target.id==='admin-member-search'){memberSearch=ev.target.value;filterAdminMembers();return;}if(ev.target.id==='admin-list-search'){const value=searchFold(ev.target.value);const cards=Array.from(document.querySelectorAll('.admin-list-item'));let count=0;for(const card of cards){card.hidden=!card.dataset.search.includes(value);if(!card.hidden)count++;}const empty=$('#admin-search-empty');if(empty)empty.hidden=count>0;return;}if(ev.target.id==='member-search'){const value=ev.target.value;search=value;const row=ev.target.closest('.pane');const tbody=row?.querySelector('tbody');if(!tbody)return;const list=data.profiles.filter(x=>x.role==='socio'&&searchFold(x.name+' '+x.member_code).includes(searchFold(value)));tbody.innerHTML=list.map(p=>`<tr><td><b>${H(p.name)}</b></td><td>${H(p.member_code)}</td><td><span class="role-chip">${H(tier(p.lifetime_points))}</span></td><td>${fmt(p.visits)}</td><td><button class="btn btn-secondary btn-mini" data-action="checkin" data-code="${H(p.member_code)}">Registrar visita</button></td></tr>`).join('')||'<tr><td colspan="5">No se encontraron socios.</td></tr>';}});
document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&!$('#site-search-panel')?.hidden){setSiteSearchOpen(false);return;}if(ev.key==='Escape'&&menuOpen){menuOpen=false;const menu=$('#site-menu');menu?.classList.remove('open');const btn=$('.menu-toggle');btn?.setAttribute('aria-expanded','false');btn?.setAttribute('aria-label','Abrir menú');btn?.classList.remove('is-open');btn?.focus();}});
document.addEventListener('click',ev=>{if(ev.target.closest('.site-search-result'))setSiteSearchOpen(false);if(ev.target.closest('#site-menu a')){menuOpen=false;$('#site-menu')?.classList.remove('open');$('.menu-toggle')?.setAttribute('aria-expanded','false');$('.menu-toggle')?.classList.remove('is-open');}if(menuOpen&&!ev.target.closest('#site-menu,.menu-toggle')){menuOpen=false;$('#site-menu')?.classList.remove('open');$('.menu-toggle')?.classList.remove('is-open');$('.menu-toggle')?.setAttribute('aria-expanded','false');}});
function updateKeyboardState(){const active=document.activeElement;document.body.classList.toggle('keyboard-active',!!active&&active.matches('input:not([type=checkbox]):not([type=radio]):not([type=file]),textarea,select'));}
document.addEventListener('focusin',updateKeyboardState);
document.addEventListener('focusout',()=>setTimeout(updateKeyboardState,0));
window.addEventListener('beforeunload',ev=>{if(editorDirty){ev.preventDefault();ev.returnValue='';}});
window.addEventListener('hashchange',()=>{execute(async()=>{await render();});});
init();
})();
