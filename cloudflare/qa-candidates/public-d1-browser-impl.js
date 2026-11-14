/* Bellaquitas Fest — adaptación pública a Cloudflare Workers y D1.
 * Se inyecta DENTRO de la IIFE de app.js solo en el artefacto candidato.
 * No hay tokens en JS/localStorage ni redirecciones a orígenes externos.
 * Las rutas de escritura se conservan bloqueadas en staging por el servidor.
 */
async function cloudApi(path,{method='GET',body,allow401=false}={}){
 if(!/^\/v1\/[a-z0-9/_-]+$/i.test(path))
   throw new Error('Ruta de datos no autorizada');
 const options={
   method,credentials:'same-origin',cache:'no-store',redirect:'error',
   headers:{'Accept':'application/json'}
 };
 if(body!==undefined){
   options.headers['Content-Type']='application/json';
   options.body=JSON.stringify(body);
 }
 const response=await fetch(path,options);
 if(allow401&&response.status===401)return null;
 let result;
 try{result=await response.json();}
 catch{throw new Error('Respuesta del servidor inválida');}
 if(!response.ok)throw new Error(result.error||'Servicio temporalmente no disponible');
 return result;
}
async function cloudLoadPublic(){
 const [events,rewards,promos,site]=await Promise.all([
   cloudApi('/v1/events'),cloudApi('/v1/rewards'),
   cloudApi('/v1/promos'),cloudApi('/v1/site')
 ]);
 data={...emptyData(),
   events:events.items||[],rewards:rewards.items||[],
   promos:promos.items||[],site_content:site.site?[site.site]:[]
 };
}
async function cloudLoadLive(){
 // HTTP-only, SameSite cookie: el servidor es quien identifica el socio.
 const auth=await cloudApi('/v1/auth/me',{allow401:true});
 if(!auth?.authenticated||!auth.profile){
   session=null;current=null;editorDraft=null;
   await cloudLoadPublic();return;
 }
 await cloudLoadPublic();
 const privateData=await cloudApi('/v1/me/overview');
 if(privateData.profile?.id!==auth.profile.id)
   throw new Error('No se puede verificar tu identidad en D1');
 const person=privateData.profile;
 session={id:person.id};
 current=person;
 data.redemptions=privateData.redemptions||[];
 data.activity=privateData.activity||[];
 data.profiles=[person];
 if(person.role==='admin'||person.role==='puerta'){
   const staff=await cloudApi('/v1/door/overview');
   data.profiles=[person,...(staff.members||[]).filter(x=>x.id!==person.id)];
   data.redemptions=[...data.redemptions,...(staff.redemptions||[]).filter(x=>
      !(privateData.redemptions||[]).some(o=>o.id===x.id))];
 }
}
async function cloudLoadCommunity(){
 const [albums,photos]=await Promise.all([
   cloudApi('/v1/moments'),cloudApi('/v1/moments/public-photos')
 ]);
 momentsAlbums=(albums.items||[]).map(x=>({...x,published:true}));
 momentsPhotos=(photos.items||[]).map(x=>({...x}));
}
async function cloudResumeSavedSession(){
 if(!authStartupComplete||authResumeBusy||document.visibilityState==='hidden')return;
 authResumeBusy=true;
 try{
   const prior=current?.id;
   await cloudLoadLive();
   if(prior!==current?.id||current)await render();
 }catch(err){
   console.warn('No se pudo refrescar la sesión de Cloudflare:',err);
   if(!current)showAuthLoadingError(err);
 }finally{authResumeBusy=false;}
}
async function cloudRefresh(){
 if(session)await cloudLoadLive();else await cloudLoadPublic();
 await cloudLoadCommunity();
 await render();
}
async function cloudInit(){
 clearOldLocalData();
 document.documentElement.lang=activeLang;
 authStartupComplete=false;
 try{
   await cloudLoadLive();
   await cloudLoadCommunity();
   authStartupComplete=true;
   await render();
 }catch(err){
   console.error('Cloudflare D1 no disponible:',err);
   showAuthLoadingError(err);
 }
}
function cloudAuthScreen(){
 const fr=activeLang==='fr';
 const title=fr?'Connectez-vous à votre compte.':'Inicia sesión en tu cuenta.';
 const text=fr?'Retrouvez votre carte, vos points et vos avantages.':
    'Accede a tu tarjeta, tus puntos y todas tus ventajas.';
 const pending=fr?
    'La connexion par e-mail et mot de passe reste désactivée pendant les tests de migration.':
    'El acceso con correo y contraseña está desactivado durante las pruebas de migración.';
 const link=fr?'Retour au site':'Volver a la web pública';
 return header()+
  '<main class="auth-layout">'+
  '<div class="auth-art"><img src="'+H(siteImage())+'" alt="Bellaquitas Fest"/>'+
  '<div class="auth-quote">Una comunidad. Tu espacio.</div></div>'+
  '<div class="auth-main"><div class="auth-panel">'+
  '<div class="eyebrow">BELLAQUITAS CLUB</div>'+
  '<h1>'+H(title)+'</h1><p>'+H(text)+'</p>'+
  (authNotice?'<div class="auth-notice" role="status">'+H(authNotice)+'</div>':'')+
  '<div class="auth-social"><button class="btn google-signin" type="button" data-action="google-login">'+
  '<img src="assets/google-g.svg" width="21" height="21" alt="" aria-hidden="true"/>'+
  '<span class="google-label">'+H(fr?'Continuer avec Google':'Continuar con Google')+'</span>'+
  '</button></div><p class="form-note">'+H(pending)+'</p>'+
  '<p class="small muted" style="margin-top:25px">← <a class="login-link" href="#/">'+
  H(link)+'</a></p></div></div></main>';
}
async function cloudGoogleLogin(button){
 const label=button.querySelector('.google-label');
 button.disabled=true;
 if(label)label.textContent=activeLang==='fr'?'Connexion avec Google…':'Conectando con Google…';
 // Las credenciales Google SOLO se intercambian entre Google y el Worker.
 // El navegador no recibe nunca los secretos del servidor.
 location.assign('/v1/auth/google/start');
}
async function cloudLogout(){
 editorDraft=null;editorDirty=false;stopScan();
 await cloudApi('/v1/auth/logout',{method:'POST'});
 session=null;current=null;
 await cloudLoadPublic();
 to('/acceso');
}
async function cloudVisit(code){
 await cloudApi('/v1/door/checkin',{method:'POST',body:{
    code:String(code||'').trim().toUpperCase()
 }});
 await cloudRefresh();
 toast('Visita validada: +10 puntos.');
}
async function cloudRedeem(id){
 const reward=getReward(id);
 if(!reward?.active)throw new Error('Premio no disponible');
 if(current.points<reward.cost)throw new Error('Puntos insuficientes');
 if(!ask('Solicitar "'+reward.name+'" por '+reward.cost+' puntos?'))return;
 await cloudApi('/v1/rewards/request',{method:'POST',body:{reward_id:id}});
 await cloudRefresh();
 toast('Canje solicitado. Consulta tus solicitudes.');
}
async function cloudValidate(code){
 await cloudApi('/v1/door/redemptions/validate',{
  method:'POST',body:{code:String(code||'').trim().toUpperCase()}
 });
 await cloudRefresh();
 toast('Canje validado correctamente.');
}
async function cloudSaveSuggestion(form){
 const feedback=form.querySelector('#suggestion-feedback');
 if(feedback)feedback.textContent=activeLang==='fr'?
  'Les suggestions seront activées après la vérification anti-abus.':
  'Las sugerencias estarán disponibles tras activar la protección contra abusos.';
}
async function cloudUpdateName(name){
 await cloudApi('/v1/account/name',{method:'POST',body:{name}});
 await cloudRefresh();
 toast('Perfil actualizado.');
}
