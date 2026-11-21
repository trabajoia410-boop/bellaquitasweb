/** Admin loyalty dashboard embedded in existing Bellaquitas /administracion/. */
import {authenticatedAdminAccess} from "../cloudflare/auth-routes.js";
import {WALLET_I18N} from "./i18n.js";
const HEAD={"Cache-Control":"no-store, private","X-Content-Type-Options":"nosniff",
 "X-Robots-Tag":"noindex,nofollow","Referrer-Policy":"no-referrer","X-Frame-Options":"SAMEORIGIN"};
export async function walletAdminPage(request,env){
 const url=new URL(request.url);
 if(!["/administracion/fidelidad/","/administracion/fidelidad"].includes(url.pathname))return null;
 if(request.method!=="GET"&&request.method!=="HEAD")return new Response(null,{status:405,headers:HEAD});
 if(env?.SITE_MODE!=="production"||env.WALLET_ENABLED!=="yes")
  return new Response("No disponible",{status:404,headers:HEAD});
 let actor=null;try{actor=await authenticatedAdminAccess(request,env);}catch{}
 if(!actor||actor.role!=="admin")return new Response("Acceso reservado",{status:403,headers:HEAD});
 if(url.pathname==="/administracion/fidelidad")return Response.redirect("/administracion/fidelidad/",308);
 const nonce=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(18))));
 const config=JSON.stringify({strings:WALLET_I18N,slug:"bellaquitas-fest"}).replace(/</g,"\\u003c");
 const script=String.raw`
(()=>{
 "use strict";
 const el=id=>document.getElementById(id),cfg=JSON.parse(el("config").textContent);
 let lang=localStorage.getItem("bellaquitas-lang")==="fr"?"fr":"es";
 const t=k=>cfg.strings[lang][k]||k;
 const state={program:null,customers:[],campaigns:[],employees:[]};
 const status=s=>el("state").textContent=s;
 const api=async (path,data)=>{
  const response=await fetch(path,{method:data?"POST":"GET",cache:"no-store",credentials:"same-origin",
   headers:{"Accept":"application/json",...(data?{"Content-Type":"application/json"}:{})},
   body:data?JSON.stringify(data):undefined});
  const value=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(value.error||"HTTP "+response.status);
  return value;
 };
 const fields=["name","logo","banner","color","accent","goal","reward","message","cooldown"];
 const safe=t=>String(t??"");
 function design(){
  const d=Object.fromEntries(fields.map(k=>[k,el("design-"+k).value]));
  el("live").style.background="linear-gradient(125deg,"+d.color+",#452231)";
  el("live").style.borderColor=d.accent;
  // En la vista previa solo mostrar imágenes estáticas de la propia web.
  for(const field of ["logo","banner"]){
   const image=el("live-"+field);
   const valid=/^\\/assets\\/[a-zA-Z0-9/_-]+\\.(?:png|webp|jpe?g)$/.test(d[field]||"");
   image.hidden=!valid;
   if(valid)image.src=d[field];else image.removeAttribute("src");
  }
  el("live-name").textContent=d.name||"Bellaquitas Fest";
  el("live-reward").textContent=d.reward;
  el("live-progress").textContent="4 / "+d.goal;
  el("live-message").textContent=d.message;
 }
 fields.forEach(k=>el("design-"+k).addEventListener("input",design));
 const show=(id)=>{
  for(const item of document.querySelectorAll("[data-panel]"))
   item.hidden=item.dataset.panel!==id;
  for(const tab of document.querySelectorAll("[data-tab]"))
   tab.setAttribute("aria-pressed",String(tab.dataset.tab===id));
 };
 for(const tab of document.querySelectorAll("[data-tab]"))
  tab.addEventListener("click",()=>show(tab.dataset.tab));
 function translation(){
  document.documentElement.lang=lang;
  for(const item of document.querySelectorAll("[data-i18n]"))item.textContent=t(item.dataset.i18n);
 }
 for(const value of ["es","fr"])el("lang-"+value).addEventListener("click",()=>{
  lang=value;localStorage.setItem("bellaquitas-lang",value);translation();
 });
 const cell=(tr,value)=>{const td=document.createElement("td");td.textContent=safe(value);tr.append(td)};
 async function fetchCustomers(){
  const search=el("search").value.trim().slice(0,80),inactive=el("inactive").value;
  const data=await api("/v1/wallet/admin/customers?search="+encodeURIComponent(search)+
   "&inactive="+encodeURIComponent(inactive));
  state.customers=data.items;el("clients").replaceChildren();
  for(const row of data.items){
   const tr=document.createElement("tr");
   cell(tr,row.name);cell(tr,row.email);cell(tr,row.stamps);
   cell(tr,row.last_stamp_at?new Date(row.last_stamp_at*1000).toLocaleDateString(lang):"—");
   cell(tr,row.redeemed_rewards);
   const td=document.createElement("td");
   const select=document.createElement("button");select.textContent="✓";
   select.title="Seleccionar";select.type="button";
   select.addEventListener("click",()=>{el("selected-customer").value=row.id;
    status(row.name);});
   td.append(select);tr.append(td);el("clients").append(tr);
  }
  el("client-total").textContent=String(data.total);
 }
 el("search").addEventListener("input",()=>fetchCustomers().catch(err=>status(err.message)));
 el("inactive").addEventListener("change",()=>fetchCustomers().catch(err=>status(err.message)));
 async function refresh(){
  try{
   const [designData,employees,stats,messages]=await Promise.all([
    api("/v1/wallet/admin/program"),api("/v1/wallet/admin/employees"),
    api("/v1/wallet/admin/stats"),api("/v1/wallet/admin/campaigns")]);
   state.program=designData.program;state.employees=employees.items;
   state.campaigns=messages.items;
   if(state.program){
    const p=state.program;
    const values={name:p.name,logo:p.logo_url,banner:p.banner_url,color:p.color,
     accent:p.accent_color,goal:p.stamp_goal,reward:p.reward_label,
     message:p.card_message,cooldown:p.cooldown_seconds};
    for(const field of fields)el("design-"+field).value=values[field]??"";
   }
   design();
   el("metrics").textContent=stats.newCustomers+" clientes · "+stats.stamps+
    " sellos · "+stats.redeemed+" canjes (30 días)";
   const chart=el("daily");chart.replaceChildren();
   const largest=Math.max(1,...stats.days.map(d=>d.n));
   for(const row of stats.days){
    const bar=document.createElement("div");bar.className="bar";
    bar.style.height=Math.max(3,Math.round(100*row.n/largest))+"%";
    bar.title=row.day+": "+row.n;
    chart.append(bar);
   }
   el("employees-list").replaceChildren();
   for(const person of employees.items){
    const li=document.createElement("li");li.textContent=person.name+" · "+(person.enabled?"Activo":"Inactivo");
    if(person.enabled){
     const button=document.createElement("button");button.type="button";button.textContent="Revocar";
     button.addEventListener("click",async()=>{
      if(!confirm("¿Revocar el código?"))return;
      try{await api("/v1/wallet/admin/employee/revoke",{employeeId:person.id});
       await refresh();}catch(err){status(err.message);}
     });li.append(button);
    }el("employees-list").append(li);
   }
   el("campaigns-list").replaceChildren();
   for(const c of messages.items){
    const li=document.createElement("li");
    li.textContent=c.message_es+" — "+c.status+
     " ("+new Date(c.created_at*1000).toLocaleDateString(lang)+")";
    el("campaigns-list").append(li);
   }
   el("qr-link").textContent="https://bellaquitas.fr/tarjeta/"+cfg.slug;
   window.BellaWalletQR?.render(el("business-qr"),el("qr-link").textContent,{label:"QR alta Bellaquitas"});
   await fetchCustomers();
  }catch(err){status(err.message);}
 }
 el("save-design").addEventListener("click",async()=>{
  try{
   const data=Object.fromEntries(fields.map(k=>[k,el("design-"+k).value]));
   const result=await api("/v1/wallet/admin/program/save",data);
   status(result.ok?"Diseño guardado":"No guardado");
  }catch(err){status(err.message);}
 });
 el("employee-form").addEventListener("submit",async e=>{
  e.preventDefault();
  try{const result=await api("/v1/wallet/admin/employee/create",{
   name:el("employee-name").value});
   el("employee-pin").textContent=result.pin+" — Guardar ahora; no se mostrará otra vez.";
   await refresh();
  }catch(err){status(err.message);}
 });
 el("redeem").addEventListener("click",async()=>{
  if(!el("selected-customer").value)return;
  try{await api("/v1/wallet/admin/reward/redeem",{
   customerId:el("selected-customer").value});await fetchCustomers();
   status("Recompensa canjeada");
  }catch(err){status(err.message);}
 });
 el("remove-stamp").addEventListener("click",async()=>{
  const reason=prompt("Motivo para retirar el sello (obligatorio):");
  if(!reason)return;
  try{await api("/v1/wallet/admin/stamp/remove",{customerId:el("selected-customer").value,
   requestId:crypto.randomUUID(),reason});await fetchCustomers();status("Sello retirado");
  }catch(err){status(err.message);}
 });
 el("delete-client").addEventListener("click",async()=>{
  const id=el("selected-customer").value;if(!id)return;
  if(!confirm(t("deleteConfirm")))return;
  try{await api("/v1/wallet/admin/customer/delete",{customerId:id,confirm:true});
   el("selected-customer").value="";await fetchCustomers();status("Cliente eliminado");
  }catch(err){status(err.message);}
 });
 el("campaign-form").addEventListener("submit",async e=>{
  e.preventDefault();
  try{const d=await api("/v1/wallet/admin/campaign/create",{
   audience:el("audience").value,days:Number(el("campaign-days").value),
   message_es:el("message-es").value,message_fr:el("message-fr").value});
   status("Borrador creado. No se ha enviado ninguna notificación.");
   await refresh();
  }catch(err){status(err.message);}
 });
 el("png").addEventListener("click",()=>{
  const svg=el("business-qr").querySelector("svg");if(!svg)return;
  const data=new XMLSerializer().serializeToString(svg),image=new Image();
  image.onload=()=>{
   const canvas=document.createElement("canvas");canvas.width=1000;canvas.height=1000;
   const ctx=canvas.getContext("2d");ctx.fillStyle="white";ctx.fillRect(0,0,1000,1000);
   ctx.drawImage(image,0,0,1000,1000);
   const a=document.createElement("a");a.download="bellaquitas-qr-alta.png";
   a.href=canvas.toDataURL("image/png");a.click();
  };
  image.src="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(data);
 });
 el("pdf").addEventListener("click",()=>window.print());
 translation();design();show("design");refresh();
})();`;
 const html=[
 '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
 '<title>Fidelidad digital · Bellaquitas Fest</title>',
 '<style>*{box-sizing:border-box}body{margin:0;background:#0e0a0e;color:#fff3e7;font:15px/1.5 system-ui,sans-serif}main{max-width:1140px;padding:20px;margin:0 auto}h1,h2{color:#efd099}h1{font-size:clamp(1.5rem,4vw,2rem)}.tabs{display:flex;gap:8px;flex-wrap:wrap;margin:20px 0}button,a.action{border:1px solid #98734d;background:#352534;color:#e6c17b;border-radius:9px;padding:9px 12px;cursor:pointer;font:inherit;text-decoration:none}button[aria-pressed=true],button.main{background:#e9c477;color:#23131a}section{border:1px solid #654653;background:#221721;border-radius:16px;padding:20px;margin:15px 0}[hidden]{display:none!important}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.field{display:grid;gap:5px}input,select,textarea{width:100%;background:#100c12;border:1px solid #765363;border-radius:8px;padding:10px;color:#fff;font:inherit}textarea{min-height:100px}table{width:100%;border-collapse:collapse;font-size:.9rem}th,td{border-bottom:1px solid #523945;padding:9px;text-align:left}.overflow{overflow-x:auto}.preview{border:2px solid #e9c477;border-radius:18px;min-height:220px;padding:25px;margin:20px 0}.preview strong{font-size:1.8rem;display:block;color:#e9c477}.chart{height:130px;display:flex;align-items:end;gap:7px}.bar{width:24px;background:#e9c477;border-radius:7px 7px 0 0}#business-qr{width:280px;aspect-ratio:1;background:white;padding:14px;border-radius:12px;margin:20px auto}#business-qr svg{width:100%;height:100%}#qr-print{text-align:center}@media(max-width:650px){.grid{grid-template-columns:1fr}main{padding:12px}section{padding:14px}}@media print{body{background:white;color:black}body>*:not(main){display:none}main>*:not(#qr-print){display:none}#qr-print{display:block!important;border:0;background:white;color:black;padding:10mm;margin:0}#qr-print h2{color:black}#business-qr{width:110mm;height:110mm}#qr-buttons{display:none}}</style>',
 '</head><body><main><header><h1 data-i18n="admin">Tarjetas digitales</h1><p>Panel original Bellaquitas · módulo de fidelidad independiente</p>',
 '<button type="button" id="lang-es">ES</button> <button type="button" id="lang-fr">FR</button></header>',
 '<nav class="tabs" aria-label="Secciones Wallet">',
 '<button data-tab="design" aria-pressed="true" data-i18n="design">Diseño de tarjeta</button>',
 '<button data-tab="customers" aria-pressed="false" data-i18n="customers">Clientes</button>',
 '<button data-tab="employees" aria-pressed="false" data-i18n="employees">Empleados</button>',
 '<button data-tab="campaigns" aria-pressed="false" data-i18n="campaigns">Mensajes</button>',
 '<button data-tab="stats" aria-pressed="false" data-i18n="statistics">Estadísticas</button>',
 '<button data-tab="qr" aria-pressed="false" data-i18n="download">Descargar QR</button>',
 '<a class="action" href="/admin/escanear" target="_blank" rel="noopener noreferrer" data-i18n="scanner">Escanear tarjeta</a></nav>',
 '<section data-panel="design"><h2 data-i18n="design">Diseño de tarjeta</h2><div class="grid">',
 ...[["name","Nombre del negocio","text","Bellaquitas Fest"],["logo","Logo /assets/...","text","/assets/logo-bellaquitas.webp"],
 ["banner","Banner /assets/...","text",""],["color","Color de fondo","color","#21121b"],
 ["accent","Color de texto","color","#e9c477"],["goal","Número de sellos","number","7"],
 ["reward","Recompensa","text","Consumición gratis"],["message","Texto","text","Vive el momento"],
 ["cooldown","Segundos entre sellos","number","600"]].map(([id,label,type,value])=>
 '<label class="field">'+label+'<input id="design-'+id+'" type="'+type+'" value="'+value+'"></label>'),
 '</div><div id="live" class="preview"><img id="live-banner" alt="Banner de tarjeta" style="width:100%;height:110px;object-fit:cover;border-radius:9px" hidden><img id="live-logo" alt="Logo de tarjeta" style="width:75px;height:75px;object-fit:contain" hidden><strong id="live-name">Bellaquitas Fest</strong><p id="live-message"></p><h2 id="live-progress">4 / 7</h2><b id="live-reward">Consumición gratis</b></div><button id="save-design" class="main" data-i18n="save">Guardar</button></section>',
 '<section data-panel="customers" hidden><h2 data-i18n="customers">Clientes</h2><p><span id="client-total">0</span> clientes</p>',
 '<div class="grid"><label>Buscar<input id="search" type="search" maxlength="80"></label>',
 '<label data-i18n="inactive">No vuelve desde<select id="inactive"><option value="0">Todos</option><option value="7">7 días</option><option value="30">30 días</option><option value="90">90 días</option></select></label></div>',
 '<div class="overflow"><table><thead><tr><th>Nombre</th><th>Email</th><th>Sellos</th><th>Última visita</th><th>Canjes</th><th>Seleccionar</th></tr></thead><tbody id="clients"></tbody></table></div>',
 '<input type="hidden" id="selected-customer"><p><button id="redeem">Canjear recompensa</button> <button id="remove-stamp">Quitar sello</button> <button id="delete-client">Eliminar datos</button></p></section>',
 '<section data-panel="employees" hidden><h2 data-i18n="employees">Empleados</h2><form id="employee-form"><label>Nombre<input id="employee-name" required minlength="2" maxlength="80"></label><button class="main">Generar PIN 4 dígitos</button></form>',
 '<p id="employee-pin" role="status"></p><ul id="employees-list"></ul></section>',
 '<section data-panel="campaigns" hidden><h2 data-i18n="campaigns">Mensajes</h2><form id="campaign-form"><label>Destinatarios<select id="audience"><option value="all">Clientes con consentimiento</option><option value="inactive">Inactivos</option></select></label>',
 '<label>Días de inactividad<input type="number" min="0" max="365" value="30" id="campaign-days"></label>',
 '<label>Español<textarea id="message-es" required maxlength="160"></textarea></label>',
 '<label>Français<textarea id="message-fr" required maxlength="160"></textarea></label>',
 '<p>Se guardará un borrador; Wallet no envía mensajes reales sin emisor autorizado.</p><button class="main">Guardar borrador</button></form><h3>Historial</h3><ul id="campaigns-list"></ul></section>',
 '<section data-panel="stats" hidden><h2 data-i18n="statistics">Estadísticas</h2><p id="metrics">0</p><div class="chart" id="daily"></div></section>',
 '<section data-panel="qr" id="qr-print" hidden><h2>Únete al Club Bellaquitas</h2><p>Escanea este código y consigue tu tarjeta digital.</p>',
 '<div id="business-qr"></div><p id="qr-link">https://bellaquitas.fr/tarjeta/bellaquitas-fest</p>',
 '<div id="qr-buttons"><button type="button" id="png">Descargar PNG</button> <button type="button" id="pdf">Imprimir / Guardar como PDF</button></div></section>',
 '<p id="state" role="status" aria-live="polite"></p></main>',
 '<script id="config" type="application/json">'+config+'</script><script src="/wallet/qr.js"></script>',
 '<script nonce="'+nonce+'">'+script+'</script></body></html>'
 ].join("");
 const headers=new Headers({...HEAD,"Content-Type":"text/html; charset=utf-8"});
 headers.set("Content-Security-Policy",
 "default-src 'none'; base-uri 'none'; form-action 'self'; script-src 'self' 'nonce-"+nonce+
 "'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'self'");
 return new Response(request.method==="HEAD"?null:html,{status:200,headers});
}
