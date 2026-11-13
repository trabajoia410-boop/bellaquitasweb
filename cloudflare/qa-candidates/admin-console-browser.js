/* Bellaquitas Fest — consola privada independiente, sin dependencias externas. */
(function(){
"use strict";
const ROOT="/administracion/api";
const initialSection=new URLSearchParams(location.search).get("seccion")==="web"?"web":"inicio";
const $=selector=>document.querySelector(selector);
const H=value=>String(value==null?"":value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
let state={tab:"inicio",section:"hero",language:"es",collection:"events",
 events:[],rewards:[],promos:[],members:[],community:null,
 settings:null,siteSaved:null,draft:null,editing:null};
const sectionNames={hero:"Portada",experience:"Experiencia",events:"Eventos",benefits:"Ventajas",faq:"Preguntas",cta:"Invitación final",other:"Cabecera y pie"};
const tabNames={inicio:["Escritorio","Gestiona Bellaquitas Fest desde un solo lugar"],
 web:["Editor de la web","Modifica textos, imágenes e idiomas sin alterar la estructura"],
 eventos:["Eventos","Crea, edita y publica las próximas fiestas"],
 ventajas:["Premios y ventajas","Gestiona promociones y recompensas de fidelidad"],
 socios:["Socios y permisos","Consulta socios y gestiona roles, puntos y visitas con motivo"],
 comunidad:["Comunidad","Sugerencias, galerías y Bellaquitas Moments"],
 actividad:["Historial","Movimientos de puntos, visitas y cambios administrativos"]};
const editableSection=key=>{
 if(/^hero_|^announcement|^logo_url$/.test(key))return "hero";
 if(/^experience_|^feature_/.test(key))return "experience";
 if(/^events_|^nav_events$/.test(key))return "events";
 if(/^benefit|^nav_benefits/.test(key))return "benefits";
 if(/^faq_|^nav_faq$/.test(key))return "faq";
 if(/^cta_/.test(key))return "cta";
 return "other";
};
function feedback(message,error=false){
 const el=$("#work-feedback");el.textContent=message||"";el.classList.toggle("error",error);
}
function loginFeedback(message,error=false){
 const el=$("#login-feedback");el.textContent=message||"";el.classList.toggle("error",error);
}
function showLogin(){
 $("#access").hidden=false;$("#portal").hidden=true;
}
function showPortal(profile){
 $("#access").hidden=true;$("#portal").hidden=false;
 $("#user-name").textContent=profile?.name||"Administrador";
}
async function api(path,opts={}){
 const options={method:opts.method||"GET",credentials:"same-origin",cache:"no-store",headers:{}};
 if(opts.body!==undefined){
  if(opts.body instanceof Blob){
   options.body=opts.body;
   options.headers["Content-Type"]=opts.body.type||"application/octet-stream";
  }else{
   options.body=JSON.stringify(opts.body);
   options.headers["Content-Type"]="application/json";
  }
 }
 const response=await fetch(ROOT+path,options);
 let data;
 try{data=await response.json();}catch{data={};}
 if(!response.ok){
  if(response.status===401&&path!=="/sso")showLogin();
  throw new Error(data.error||("Error HTTP "+response.status));
 }
 return data;
}
function switchTab(tab){
 if(!tabNames[tab])return;
 state.tab=tab;state.editing=null;
 document.querySelectorAll("[data-tab]").forEach(x=>x.classList.toggle("selected",x.dataset.tab===tab));
 $("#sidebar").classList.remove("open");$("#admin-menu").setAttribute("aria-expanded","false");
 $("#section-title").textContent=tabNames[tab][0];
 $("#section-description").textContent=tabNames[tab][1];
 $("#section-actions").replaceChildren();
 feedback("");
 $("#work-content").innerHTML="<div class=\"panel\">Cargando información…</div>";
 renderTab().catch(err=>{feedback(err.message,true);$("#work-content").replaceChildren();});
}
const stat=(number,label)=>"<div class=\"stat\"><div class=\"number\">"+H(number)+"</div><span>"+H(label)+"</span></div>";
async function renderDashboard(){
 const responses=await Promise.all(["/events","/rewards","/promos","/members","/community"].map(api));
 state.events=responses[0].items||[];state.rewards=responses[1].items||[];
 state.promos=responses[2].items||[];state.members=responses[3].items||[];
 state.community=responses[4];
 const content=$("#work-content");
 content.innerHTML="<div class=\"stats\">"+
  stat(state.events.length,"Eventos")+" "+stat(state.members.length,"Socios registrados")+
  stat(state.rewards.length,"Premios")+" "+stat((state.community.suggestions||[]).filter(x=>x.status==="nuevo").length,"Sugerencias nuevas")+"</div>"+
  "<div class=\"panel\"><h2>¿Qué quieres modificar?</h2><p>Selecciona una herramienta. Los cambios de la web no se publican hasta que pulses Publicar.</p>"+
  "<div class=\"cards\">"+
  "<button class=\"grid-link\" data-tab=\"web\"><strong>✎ Editar página</strong><small>Textos, secciones, traducciones e imágenes</small></button>"+
  "<button class=\"grid-link\" data-tab=\"eventos\"><strong>▦ Eventos</strong><small>Crear o cambiar fiestas y sus fotografías</small></button>"+
  "<button class=\"grid-link\" data-tab=\"socios\"><strong>♙ Socios</strong><small>Roles y puntos con historial de auditoría</small></button>"+
  "<button class=\"grid-link\" data-tab=\"comunidad\"><strong>◈ Comunidad</strong><small>Sugerencias recibidas y álbumes</small></button></div></div>";
}
function readSettings(){
 const current=state.draft?.settings||state.siteSaved?.settings||{};
 return JSON.parse(JSON.stringify(current));
}
function siteForm(){
 const settings=state.settings||{};
 const base=state.language==="fr"?(settings.translations?.fr||{}):settings;
 const fields=Object.keys(settings).filter(key=>{
  const type=typeof settings[key];
  return (type==="string"||type==="boolean")&&editableSection(key)===state.section;
 }).sort();
 const fieldHtml=fields.map(key=>{
  const value=base[key]===undefined?settings[key]:base[key];
  const label=key.replace(/_/g," ").replace(/\b\w/g,x=>x.toUpperCase());
  const multiline=/(desc|text|announcement|_a$|content)/.test(key)&&String(value).length>75;
  const control=typeof value==="boolean"?
   "<select data-site-key=\""+H(key)+"\"><option value=\"true\""+(value?" selected":"")+">Mostrar</option><option value=\"false\""+(!value?" selected":"")+">Ocultar</option></select>":
   multiline?"<textarea data-site-key=\""+H(key)+"\" rows=\"3\">"+H(value)+"</textarea>":
   "<input data-site-key=\""+H(key)+"\" type=\"text\" maxlength=\"1800\" value=\""+H(value)+"\">";
  return "<div class=\"form-field\"><label>"+H(label)+"</label>"+control+"</div>";
 }).join("");
 const sectionButtons=Object.keys(sectionNames).map(key=>
  "<button type=\"button\" data-site-section=\""+key+"\" class=\""+(state.section===key?"active":"")+"\">"+sectionNames[key]+"</button>").join("");
 const extra=state.section==="other"?
  "<div class=\"form-field\"><label>Configuración avanzada (JSON)</label><p class=\"field-desc\">Solo si necesitas cambiar valores adicionales. No modifica colores ni vídeos salvo que tú lo indiques.</p><details><summary>Mostrar configuración completa</summary><textarea id=\"settings-json\" rows=\"14\" spellcheck=\"false\">"+H(JSON.stringify(settings,null,2))+"</textarea><button type=\"button\" class=\"secondary\" data-action=\"apply-json\">Aplicar configuración</button></details></div>":"";
 $("#work-content").innerHTML="<div class=\"panel\"><h2>Contenido de "+H(sectionNames[state.section])+"</h2>"+
  "<p class=\"section-subtitle\">Todos los cambios se guardan primero como borrador. Puedes alternar entre español y francés.</p>"+
  "<div class=\"section-switch\">"+sectionButtons+"</div>"+
  "<div class=\"section-switch\"><button type=\"button\" data-site-lang=\"es\" class=\""+(state.language==="es"?"active":"")+"\">Español ES</button>"+
  "<button type=\"button\" data-site-lang=\"fr\" class=\""+(state.language==="fr"?"active":"")+"\">Français FR</button></div>"+
  "<form id=\"site-form\" class=\"editor-form\"><div class=\"row-form\">"+
  (fieldHtml||"<p class=\"muted\">No hay campos de texto en esta sección.</p>")+"</div>"+extra+
  "<div class=\"actions save-actions\"><button class=\"secondary\" type=\"button\" data-action=\"save-draft\">Guardar borrador</button>"+
  "<button class=\"primary\" type=\"button\" data-action=\"publish\">Publicar cambios en la web</button></div></form></div>";
}
async function renderSite(){
 const [saved,drafts]=await Promise.all([api("/site"),api("/site-drafts")]);
 state.siteSaved=saved.site;
 state.draft=(drafts.items||[])[0]||null;
 state.settings=readSettings();
 siteForm();
}
function collectSiteFields(){
 document.querySelectorAll("[data-site-key]").forEach(el=>{
  const key=el.dataset.siteKey;
  const target=state.language==="fr"?(state.settings.translations??={},state.settings.translations.fr??={}):state.settings;
  const base=target[key];
  if(typeof base==="boolean"||typeof state.settings[key]==="boolean")target[key]=el.value==="true";
  else target[key]=el.value;
 });
}
async function saveSite(publish){
 collectSiteFields();
 const settings=state.settings;
 if(!settings.hero_text)settings.hero_text=state.siteSaved?.hero_text||"Bellaquitas Fest";
 if(!settings.announcement)settings.announcement=state.siteSaved?.announcement||"Bellaquitas Fest";
 await api("/write",{method:"POST",body:{kind:publish?"site_content":"site_drafts",action:publish?"publish":"save",settings}});
 feedback(publish?"Cambios publicados. La web conservará el diseño existente.":"Borrador guardado; todavía no está publicado.");
}
const formInput=(name,label,value="",type="text",required=true)=>
 "<div class=\"form-field\"><label for=\"f-"+H(name)+"\">"+H(label)+"</label><input id=\"f-"+H(name)+"\" name=\""+H(name)+"\" type=\""+type+"\" value=\""+H(value)+"\" "+(required?"required":"")+"></div>";
const formText=(name,label,value="")=>
 "<div class=\"form-field wide\"><label for=\"f-"+H(name)+"\">"+H(label)+"</label><textarea id=\"f-"+H(name)+"\" name=\""+H(name)+"\">"+H(value)+"</textarea></div>";
function currentRows(){return state.collection==="events"?state.events:state.collection==="rewards"?state.rewards:state.promos;}
function displayDate(x){return x.date_label||"";}
function renderCatalogForm(item){
 const table=state.collection,x=item||{},localized=x.localized_content?.fr||{};
 const extras=table==="events"?
  formInput("date_label","Fecha del evento",x.date_label||"","date")+
  formInput("start_time","Hora de inicio",x.start_time||"21:00","time",false)+
  formInput("location","Lugar",x.location||"")+
  formInput("image_url","URL de imagen",x.image_url||"","url",false):
  table==="rewards"?
   formInput("cost","Puntos necesarios",x.cost||10,"number")+
   formInput("category","Categoría",x.category||"Premios")+
   formInput("symbol","Símbolo",x.symbol||"✦"):
   formInput("bonus","Puntos de bonificación",x.bonus||10,"number");
 $("#work-content").innerHTML="<div class=\"panel\"><div class=\"toolbar\"><h2>"+(x.id?"Editar":"Crear")+" "+(table==="events"?"evento":table==="rewards"?"premio":"promoción")+"</h2><button type=\"button\" class=\"subtle\" data-action=\"back-catalog\">Volver</button></div>"+
 "<form id=\"catalog-form\" class=\"editor-form\"><div class=\"row-form\">"+
 formInput("name","Nombre en español",x.name||"")+extras+
 formText("description","Descripción en español",x.description||"")+
 formInput("name_fr","Nombre en francés",localized.name||"","text",false)+
 formText("description_fr","Descripción en francés",localized.description||"")+
 "<div class=\"form-field\"><label for=\"f-active\">Estado</label><select name=\"active\" id=\"f-active\"><option value=\"true\""+(x.active!==false?" selected":"")+">Publicado</option><option value=\"false\""+(x.active===false?" selected":"")+">Oculto / borrador</option></select></div>"+
 (table!=="promos"?"<div class=\"form-field wide\"><label for=\"catalog-photo\">Subir foto (JPG, PNG o WebP)</label><input type=\"file\" id=\"catalog-photo\" accept=\"image/jpeg,image/png,image/webp\"><span class=\"field-desc\">Se conserva la imagen existente si no eliges otra.</span></div>":"")+
 "</div><div class=\"actions\"><button type=\"submit\" class=\"primary\">Guardar "+(x.id?"cambios":"nuevo")+"</button><button type=\"button\" class=\"secondary\" data-action=\"back-catalog\">Cancelar</button></div></form></div>";
}
async function catalogLoad(){
 const table=state.collection;
 const result=await api("/"+table);
 state[table]=result.items||[];
}
function catalogList(){
 const table=state.collection,rows=currentRows();
 const title=table==="events"?"Eventos":table==="rewards"?"Premios":"Promociones";
 const switches=["events","rewards","promos"].map(key=>
  "<button type=\"button\" data-catalog-tab=\""+key+"\" class=\""+(key===table?"active":"")+"\">"+
  (key==="events"?"Eventos":key==="rewards"?"Premios":"Promociones")+"</button>").join("");
 const headers=table==="events"?"Fecha / Lugar":table==="rewards"?"Coste":"Bonificación";
 const cells=rows.map(x=>"<tr><td><strong>"+H(x.name)+"</strong><br><small class=\"muted\">"+H(x.description||"").slice(0,125)+"</small></td>"+
  "<td>"+H(table==="events"?(displayDate(x)+" · "+(x.location||"")):table==="rewards"?(x.cost+" puntos"):(x.bonus+" puntos"))+"</td>"+
  "<td><span class=\"pill "+(x.active===false?"off":"")+"\">"+(x.active===false?"Oculto":"Publicado")+"</span></td>"+
  "<td class=\"actions-cell\"><div class=\"actions\"><button type=\"button\" class=\"secondary\" data-edit-id=\""+H(x.id)+"\">Editar</button>"+
  "<button type=\"button\" class=\"subtle\" data-toggle-id=\""+H(x.id)+"\">"+(x.active===false?"Publicar":"Ocultar")+"</button>"+
  "<button type=\"button\" class=\"danger\" data-delete-id=\""+H(x.id)+"\">Borrar</button></div></td></tr>").join("");
 $("#work-content").innerHTML="<div class=\"panel\"><div class=\"toolbar\"><h2>"+title+"</h2><button type=\"button\" data-action=\"create-item\" class=\"primary\">+ Crear "+(table==="events"?"evento":"contenido")+"</button></div>"+
  (state.tab==="ventajas"?"<div class=\"section-switch\">"+switches+"</div>":"")+
  (rows.length?"<div class=\"table-wrap\"><table><thead><tr><th>Nombre</th><th>"+headers+"</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>"+cells+"</tbody></table></div>":
   "<div class=\"empty\">Todavía no hay elementos. Pulsa Crear para añadir el primero.</div>")+"</div>";
}
async function renderCatalog(){
 if(state.tab==="eventos")state.collection="events";
 else if(state.collection==="events")state.collection="rewards";
 await catalogLoad();catalogList();
}
async function saveCatalog(form){
 const data=new FormData(form),table=state.collection,id=state.editing?.id;
 const item=Object.assign({},state.editing||{},Object.fromEntries(data.entries()));
 const fr=Object.assign({},state.editing?.localized_content?.fr||{});
 fr.name=String(data.get("name_fr")||"");
 fr.description=String(data.get("description_fr")||"");
 delete item.name_fr;delete item.description_fr;
 item.localized_content=Object.assign({},state.editing?.localized_content||{},{fr});
 item.active=data.get("active")==="true";
 if(table==="rewards")item.cost=Number(data.get("cost"));
 if(table==="promos")item.bonus=Number(data.get("bonus"));
 if(table!=="promos"){
  const file=$("#catalog-photo")?.files?.[0];
  if(file&&file.size){
   if(file.size>5*1024*1024)throw new Error("La imagen debe ser de 5 MB o menos.");
   if(!["image/png","image/jpeg","image/webp"].includes(file.type))throw new Error("Solo JPG, PNG o WebP.");
   const upload=await api("/upload?category="+encodeURIComponent(table),{method:"PUT",body:file});
   item.image_url=upload.url;
  }
 }
 await api("/write",{method:"POST",body:{kind:"catalog",table,action:id?"update":"insert",...(id?{id}:{}),item}});
 state.editing=null;await catalogLoad();catalogList();
 feedback("Guardado correctamente.");
}
function renderMembers(){
 const rows=state.members||[];
 const html=rows.map(x=>"<tr><td>"+H(x.name)+"<br><small class=\"muted\">"+H(x.member_code)+"</small></td>"+
 "<td>"+H(x.role)+"</td><td>"+H(x.points)+"</td><td>"+H(x.visits)+"</td>"+
 "<td><button type=\"button\" class=\"secondary\" data-edit-member=\""+H(x.id)+"\">Gestionar</button></td></tr>").join("");
 $("#work-content").innerHTML="<div class=\"panel\"><h2>Socios registrados</h2><p>Los cambios en puntos o permisos requieren un motivo y quedan registrados en el historial.</p>"+
 "<div class=\"table-wrap\"><table><thead><tr><th>Cuenta</th><th>Rol</th><th>Puntos</th><th>Visitas</th><th></th></tr></thead><tbody>"+html+"</tbody></table></div></div>";
}
async function loadMembers(){state.members=(await api("/members")).items||[];renderMembers();}
function memberForm(x){
 $("#work-content").innerHTML="<div class=\"panel\"><div class=\"toolbar\"><h2>Gestionar socio</h2><button type=\"button\" class=\"subtle\" data-action=\"back-members\">Volver</button></div>"+
  "<p>Estás modificando "+H(x.member_code)+". Todos los cambios quedan auditados.</p>"+
  "<form id=\"member-form\" class=\"editor-form\"><div class=\"row-form\">"+
  formInput("name","Nombre",x.name)+
  "<div class=\"form-field\"><label>Rol</label><select name=\"role\">"+
  ["socio","puerta","admin"].map(role=>"<option value=\""+role+"\""+(x.role===role?" selected":"")+">"+role+"</option>").join("")+"</select></div>"+
  formInput("points","Puntos actuales",x.points,"number")+
  formInput("lifetime_points","Puntos históricos",x.lifetime_points,"number")+
  formInput("visits","Visitas",x.visits,"number")+
  formText("reason","Motivo de la modificación (obligatorio)")+
  "</div><button type=\"submit\" class=\"primary\">Guardar cambio auditado</button></form></div>";
}
async function saveMember(form){
 const x=state.editing,data=new FormData(form);
 const body={member_id:x.id,name:String(data.get("name")||"").trim(),role:data.get("role"),
  points:Number(data.get("points")),lifetime_points:Number(data.get("lifetime_points")),
  visits:Number(data.get("visits")),reason:String(data.get("reason")||"").trim()};
 if(body.reason.length<5)throw new Error("Debes explicar el motivo del cambio (mínimo 5 caracteres).");
 if(!confirm("¿Confirmas modificar este socio? La operación quedará registrada."))return;
 await api("/member",{method:"POST",body});
 state.editing=null;await loadMembers();feedback("Socio actualizado y cambio auditado.");
}
async function renderCommunity(){
 const result=await api("/community");
 state.community=result;
 const suggestions=(result.suggestions||[]).map(x=>
  "<div class=\"list-item\"><div><strong>"+H(x.name||"Anónimo")+"</strong><small class=\"muted\"> · "+H(x.status)+"</small>"+
  "<p>"+H(x.message)+"</p></div><div class=\"actions\"><button class=\"secondary\" type=\"button\" data-suggestion-id=\""+H(x.id)+"\" data-status=\"revisado\">Revisada</button>"+
  "<button class=\"subtle\" type=\"button\" data-suggestion-id=\""+H(x.id)+"\" data-status=\"archivado\">Archivar</button></div></div>").join("");
 const albums=(result.albums||[]).map(x=>{
  const photos=(result.photos||[]).filter(p=>p.album_id===x.id).map(p=>
   "<div class=\"photo-tile\"><img alt=\"Foto de galería\" loading=\"lazy\" src=\"/administracion/api/photos/"+H(p.id)+"\">"+
   "<button type=\"button\" class=\"danger\" data-delete-photo=\""+H(p.id)+"\">Eliminar foto</button></div>").join("");
  return "<div class=\"list-item album-item\"><div class=\"album-main\"><strong>"+H(x.title)+"</strong><p>"+H(x.event_date)+" · "+(x.published?"Publicada":"Oculta")+"</p>"+
   "<div class=\"photo-grid\">"+photos+"</div>"+
   "<div class=\"actions\"><input type=\"file\" aria-label=\"Subir una foto a "+H(x.title)+"\" data-file-album=\""+H(x.id)+"\" accept=\"image/jpeg,image/png,image/webp\">"+
   "<button type=\"button\" class=\"secondary\" data-upload-album=\""+H(x.id)+"\">Subir foto</button></div></div>"+
   "<div class=\"actions\"><button type=\"button\" class=\"secondary\" data-album-id=\""+H(x.id)+"\" data-published=\""+(x.published?"true":"false")+"\">"+(x.published?"Ocultar":"Publicar")+"</button>"+
   "<button type=\"button\" class=\"danger\" data-delete-album=\""+H(x.id)+"\">Borrar galería</button></div></div>";
 }).join("");
 $("#work-content").innerHTML="<div class=\"panel\"><h2>Sugerencias recibidas</h2><div class=\"list-items\">"+(suggestions||"<div class=\"empty\">No hay sugerencias nuevas.</div>")+"</div></div>"+
 "<div class=\"panel\"><h2>Bellaquitas Moments</h2><p>Crear una galería para fotografías de un evento.</p>"+
 "<form id=\"album-form\" class=\"row-form\">"+formInput("title","Título del álbum")+formInput("event_date","Fecha del evento","","date")+
 "<div class=\"wide\"><button type=\"submit\" class=\"primary\">Crear galería</button></div></form><hr class=\"divider\"><div class=\"list-items\">"+
 (albums||"<div class=\"empty\">Todavía no hay galerías.</div>")+"</div></div>";
}
async function renderActivity(){
 const [a,b]=await Promise.all([api("/activity"),api("/changes")]);
 const rows=(a.items||[]).map(x=>"<tr><td>"+H(x.type)+"</td><td>"+H(x.detail||"")+"</td><td>"+H(x.delta)+"</td><td>"+H(x.created_at)+"</td></tr>").join("");
 const audits=(b.items||[]).map(x=>"<tr><td>"+H(x.reason||"")+"</td><td>"+H(x.member_id)+"</td><td>"+H(x.created_at)+"</td></tr>").join("");
 $("#work-content").innerHTML="<div class=\"panel\"><h2>Actividad de puntos y visitas</h2><div class=\"table-wrap\"><table><thead><tr><th>Tipo</th><th>Detalle</th><th>Cambio</th><th>Fecha</th></tr></thead><tbody>"+rows+"</tbody></table></div></div>"+
 "<div class=\"panel\"><h2>Cambios de administración</h2><div class=\"table-wrap\"><table><thead><tr><th>Motivo</th><th>Socio</th><th>Fecha</th></tr></thead><tbody>"+audits+"</tbody></table></div></div>";
}
async function renderTab(){
 if(state.tab==="inicio")return renderDashboard();
 if(state.tab==="web")return renderSite();
 if(state.tab==="eventos"||state.tab==="ventajas")return renderCatalog();
 if(state.tab==="socios")return loadMembers();
 if(state.tab==="comunidad")return renderCommunity();
 if(state.tab==="actividad")return renderActivity();
}
async function autoLogin(){
 loginFeedback("");
 const button=$("#retry-sso");
 button.disabled=true;button.textContent="Comprobando sesión…";
 $("#access-status").textContent="Verificando tu cuenta en la web principal…";
 try{
  let response;
  try{response=await api("/me");}
  catch{response=await api("/sso",{method:"POST",body:{}});}
  if(response.profile?.role!=="admin")throw new Error("Acceso reservado a administradores");
  showPortal(response.profile);
  switchTab(initialSection);
 }catch(err){
  showLogin();
  $("#access-status").textContent="Inicia sesión en Bellaquitas Fest y vuelve aquí.";
  loginFeedback(err.message,true);
 }finally{
  button.disabled=false;button.textContent="Comprobar mi acceso de administrador";
 }
}
async function logout(){
 try{await api("/logout",{method:"POST",body:{}});}catch{}
 showLogin();$("#access-status").textContent="Panel cerrado. La sesión de tu web sigue abierta.";loginFeedback("Sesión administrativa cerrada.");
}
document.addEventListener("click",async e=>{
 const el=e.target.closest("button");if(!el)return;
 try{
  if(el.id==="retry-sso")return autoLogin();
  if(el.id==="logout-top"||el.id==="logout-side")return logout();
  if(el.id==="admin-menu"){const open=$("#sidebar").classList.toggle("open");el.setAttribute("aria-expanded",String(open));return;}
  if(el.dataset.tab)return switchTab(el.dataset.tab);
  if(el.dataset.siteSection){collectSiteFields();state.section=el.dataset.siteSection;siteForm();return;}
  if(el.dataset.siteLang){collectSiteFields();state.language=el.dataset.siteLang;siteForm();return;}
  if(el.dataset.catalogTab){state.collection=el.dataset.catalogTab;state.editing=null;await catalogLoad();catalogList();return;}
  if(el.dataset.action==="save-draft")return await saveSite(false);
  if(el.dataset.action==="publish"){
   if(!confirm("¿Publicar estos cambios en la web?"))return;
   return await saveSite(true);
  }
  if(el.dataset.action==="apply-json"){
   const s=JSON.parse($("#settings-json").value);
   if(!s||typeof s!=="object"||Array.isArray(s))throw new Error("La configuración JSON no es válida.");
   state.settings=s;siteForm();feedback("Configuración cargada. Guarda el borrador o publica.");
   return;
  }
  if(el.dataset.action==="create-item"){state.editing=null;renderCatalogForm(null);return;}
  if(el.dataset.action==="back-catalog"){state.editing=null;catalogList();return;}
  if(el.dataset.editId){state.editing=currentRows().find(x=>x.id===el.dataset.editId);renderCatalogForm(state.editing);return;}
  if(el.dataset.toggleId){
   const item=currentRows().find(x=>x.id===el.dataset.toggleId);
   await api("/write",{method:"POST",body:{kind:"catalog",table:state.collection,action:"toggle",id:item.id,active:!item.active}});
   await catalogLoad();catalogList();feedback("Estado actualizado.");return;
  }
  if(el.dataset.deleteId){
   if(!confirm("¿Borrar este elemento? No podrás recuperarlo sin una copia de seguridad."))return;
   await api("/write",{method:"POST",body:{kind:"catalog",table:state.collection,action:"delete",id:el.dataset.deleteId}});
   await catalogLoad();catalogList();feedback("Elemento eliminado.");return;
  }
  if(el.dataset.editMember){state.editing=state.members.find(x=>x.id===el.dataset.editMember);memberForm(state.editing);return;}
  if(el.dataset.action==="back-members"){state.editing=null;renderMembers();return;}
  if(el.dataset.suggestionId){
   await api("/write",{method:"POST",body:{kind:"community_suggestions",action:"status",id:el.dataset.suggestionId,status:el.dataset.status}});
   await renderCommunity();feedback("Sugerencia actualizada.");return;
  }
  if(el.dataset.albumId){
   await api("/moments/publish",{method:"POST",body:{album_id:el.dataset.albumId,published:el.dataset.published!=="true"}});
   await renderCommunity();feedback("Estado de la galería actualizado.");return;
  }
  if(el.dataset.uploadAlbum){
   const input=document.querySelector("[data-file-album=\""+el.dataset.uploadAlbum+"\"]");
   const file=input?.files?.[0];
   if(!file)throw new Error("Selecciona primero una fotografía.");
   if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>8*1024*1024||file.size===0)
     throw new Error("La foto debe ser JPG, PNG o WebP y pesar hasta 8 MB.");
   await api("/moments/"+encodeURIComponent(el.dataset.uploadAlbum)+"/photo",{method:"POST",body:file});
   await renderCommunity();feedback("Fotografía subida correctamente.");return;
  }
  if(el.dataset.deletePhoto){
   if(!confirm("¿Eliminar la fotografía de la galería?"))return;
   await api("/write",{method:"POST",body:{kind:"moments_photos",action:"delete",id:el.dataset.deletePhoto}});
   await renderCommunity();feedback("Fotografía eliminada.");return;
  }
  if(el.dataset.deleteAlbum){
   if(!confirm("¿Eliminar esta galería y sus fotografías?"))return;
   await api("/write",{method:"POST",body:{kind:"moments_albums",action:"delete",id:el.dataset.deleteAlbum}});
   await renderCommunity();feedback("Galería eliminada.");return;
  }

 }catch(err){feedback(err.message,true);}
});
document.addEventListener("submit",async e=>{
 const form=e.target;
 if(!["catalog-form","member-form","album-form"].includes(form.id))return;
 e.preventDefault();
 const button=form.querySelector("[type='submit']");
 if(button)button.disabled=true;
 try{
  if(form.id==="catalog-form")await saveCatalog(form);
  if(form.id==="member-form")await saveMember(form);
  if(form.id==="album-form"){
   const fields=new FormData(form);
   await api("/moments/create",{method:"POST",body:{title:String(fields.get("title")||""),event_date:String(fields.get("event_date")||"")}});
   await renderCommunity();feedback("Galería creada en borrador.");
  }
 }catch(err){feedback(err.message,true);}
 finally{if(button?.isConnected)button.disabled=false;}
});
showLogin();
autoLogin();
})();