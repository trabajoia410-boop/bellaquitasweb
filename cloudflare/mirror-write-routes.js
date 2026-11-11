import {authenticatedProfile,checkOrigin} from "./auth-routes.js";
// Bellaquitas Fest: futuras escrituras del editor y catálogos.
// MODO CERRADO en staging: STAGING_MUTATIONS=disabled -> HTTP 423.
// Todas las mutaciones requieren sesión admin y Origin de primera parte.
const HEAD={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",
 "X-Robots-Tag":"noindex,nofollow","X-Content-Type-Options":"nosniff"};
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:HEAD});
const bad=(message,status=400)=>reply({error:message},status);
const uuid=x=>typeof x==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const imageTypes={"image/png":"png","image/jpeg":"jpg","image/webp":"webp"};
const validCategory=x=>["events","rewards","promos","logos"].includes(x);
const validTable=x=>["events","rewards","promos"].includes(x);
const trim=(v,max=1200)=>typeof v==="string"?v.trim().slice(0,max+1):"";
const jsonObject=x=>x&&typeof x==="object"&&!Array.isArray(x);
const positive=x=>Number.isSafeInteger(x)&&x>=1&&x<=1000000;
async function parseBody(request){
 const length=Number(request.headers.get("Content-Length")||0);
 if(length>200000)throw Error("Solicitud demasiado grande");
 const raw=await request.text();
 if(raw.length>200000)throw Error("Solicitud demasiado grande");
 const value=JSON.parse(raw);
 if(!jsonObject(value))throw Error("JSON inválido");
 return value;
}
function validSettings(settings){
 if(!jsonObject(settings))throw Error("Configuración inválida");
 const str=JSON.stringify(settings);
 if(str.length>120000)throw Error("Configuración demasiado grande");
 if(settings.translations&&!jsonObject(settings.translations))throw Error("Idiomas inválidos");
 if(settings.ui_copy&&!jsonObject(settings.ui_copy))throw Error("Traducciones de interfaz inválidas");
 return str;
}
function validCatalog(table,item){
 if(!jsonObject(item))throw Error("Datos incompletos");
 const name=trim(item.name,120),description=trim(item.description||"",1200);
 if(name.length<2||name.length>120||description.length>1200)throw Error("Nombre o descripción inválidos");
 const active=item.active===true?1:0;
 const image=trim(item.image_url||"",800);
 if(image&&!/^https:\/\/[^\s"'<>]+$/i.test(image))throw Error("URL de foto no válida");
 const translations=jsonObject(item.localized_content)?item.localized_content:{};
 const localized=JSON.stringify(translations);
 if(localized.length>8000)throw Error("Traducciones demasiado largas");
 const common={name,description,active,localized,image};
 if(table==="events"){
   const date=trim(item.date_label,40),location=trim(item.location,160),time=trim(item.start_time||"",8);
   if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!location||location.length>160||
      (time&&!/^\d{2}:\d{2}(?::\d{2})?$/.test(time)))throw Error("Fecha, hora o lugar inválido");
   return {...common,date,location,time};
 }
 if(table==="rewards"){
   const cost=Number(item.cost),category=trim(item.category||"Premios",80),
    symbol=trim(item.symbol||"✦",12);
   if(!positive(cost)||!category||category.length>80||!symbol||symbol.length>12)throw Error("Premio inválido");
   return {...common,cost,category,symbol};
 }
 if(table==="promos"){
   const bonus=Number(item.bonus);
   if(!positive(bonus))throw Error("Bonificación inválida");
   return {...common,bonus};
 }
 throw Error("Tipo de catálogo inválido");
}
async function catalog(env,body){
 const table=body.table,action=body.action;
 if(!validTable(table)||!["insert","update","delete","toggle"].includes(action))throw Error("Operación de catálogo inválida");
 const id=body.id;
 if(action!=="insert"&&!uuid(id))throw Error("Identificador inválido");
 if(action==="delete"){
  const r=await env.DB.prepare("DELETE FROM "+table+" WHERE id=? RETURNING id").bind(id).first();
  if(!r)throw Error("Registro no encontrado");
  return {ok:true};
 }
 if(action==="toggle"){
  if(typeof body.active!=="boolean")throw Error("Estado inválido");
  const r=await env.DB.prepare("UPDATE "+table+" SET active=? WHERE id=? RETURNING id").bind(body.active?1:0,id).first();
  if(!r)throw Error("Registro no encontrado");
  return {ok:true};
 }
 const data=validCatalog(table,body.item);
 const insert=action==="insert",key=insert?crypto.randomUUID():id;
 let sql,values;
 if(table==="events"){
  sql=insert?
   "INSERT INTO events(id,name,date_label,location,description,active,start_time,image_url,localized_content) VALUES(?,?,?,?,?,?,?,?,?)":
   "UPDATE events SET name=?,date_label=?,location=?,description=?,active=?,start_time=?,image_url=?,localized_content=? WHERE id=? RETURNING id";
  values=insert?[key,data.name,data.date,data.location,data.description,data.active,data.time,data.image,data.localized]:
    [data.name,data.date,data.location,data.description,data.active,data.time,data.image,data.localized,key];
 }else if(table==="rewards"){
  sql=insert?
   "INSERT INTO rewards(id,name,category,cost,symbol,description,active,image_url,localized_content) VALUES(?,?,?,?,?,?,?,?,?)":
   "UPDATE rewards SET name=?,category=?,cost=?,symbol=?,description=?,active=?,image_url=?,localized_content=? WHERE id=? RETURNING id";
  values=insert?[key,data.name,data.category,data.cost,data.symbol,data.description,data.active,data.image,data.localized]:
   [data.name,data.category,data.cost,data.symbol,data.description,data.active,data.image,data.localized,key];
 }else{
  sql=insert?
   "INSERT INTO promos(id,name,bonus,description,active,localized_content) VALUES(?,?,?,?,?,?)":
   "UPDATE promos SET name=?,bonus=?,description=?,active=?,localized_content=? WHERE id=? RETURNING id";
  values=insert?[key,data.name,data.bonus,data.description,data.active,data.localized]:
   [data.name,data.bonus,data.description,data.active,data.localized,key];
 }
 if(insert)await env.DB.prepare(sql).bind(...values).run();
 else if(!await env.DB.prepare(sql).bind(...values).first())throw Error("Registro no encontrado");
 return {ok:true,id:key};
}
async function writes(env,body){
 const {kind,action}=body;
 if(kind==="catalog")return catalog(env,body);
 if(kind==="site_drafts"&&action==="save"){
  const settings=validSettings(body.settings);
  await env.DB.prepare("INSERT INTO site_drafts(key,settings,updated_at) VALUES('homepage',?,datetime('now')) "+
    "ON CONFLICT(key) DO UPDATE SET settings=excluded.settings,updated_at=datetime('now')").bind(settings).run();
  return {ok:true};
 }
 if(kind==="site_content"&&["publish","save_text"].includes(action)){
  if(action==="publish"){
   const settings=validSettings(body.settings);
   const hero=trim(body.settings.hero_text||"Bellaquitas Fest",400);
   const announcement=trim(body.settings.announcement||"Bellaquitas Fest",160);
   if(!hero||hero.length>400||!announcement||announcement.length>160)throw Error("Textos inválidos");
   await env.DB.prepare("INSERT INTO site_content(key,hero_text,announcement,page_settings,updated_at) "+
    "VALUES('homepage',?,?,?,datetime('now')) ON CONFLICT(key) DO UPDATE SET "+
    "hero_text=excluded.hero_text,announcement=excluded.announcement,page_settings=excluded.page_settings,updated_at=datetime('now')")
    .bind(hero,announcement,settings).run();
   return {ok:true};
  }
  const hero=trim(body.hero_text,400),announcement=trim(body.announcement,160);
  if(hero.length<10||hero.length>400||!announcement||announcement.length>160)throw Error("Texto de portada inválido");
  await env.DB.prepare("UPDATE site_content SET hero_text=?,announcement=?,updated_at=datetime('now') WHERE key='homepage'")
   .bind(hero,announcement).run();
  return {ok:true};
 }
 if(kind==="media"&&action==="remove"){
  if(!Array.isArray(body.keys)||body.keys.length>30)throw Error("Lista de archivos inválida");
  for(const key of body.keys){
   if(typeof key!=="string"||
     !/^media\/(?:events|rewards|promos|logos)\/[0-9a-f-]{36}\.(?:png|jpg|webp)$/i.test(key))
     throw Error("Ruta de imagen no autorizada");
  }
  for(const key of body.keys)await env.MEDIA.delete(key);
  return {ok:true};
 }
 if(kind==="community_suggestions"&&action==="status"){
  if(!uuid(body.id)||!["nuevo","revisado","archivado"].includes(body.status))throw Error("Estado inválido");
  const r=await env.DB.prepare("UPDATE community_suggestions SET status=? WHERE id=? RETURNING id")
    .bind(body.status,body.id).first();
  if(!r)throw Error("Sugerencia no encontrada");
  return {ok:true};
 }
 if(kind==="moments_albums"&&action==="delete"){
  if(!uuid(body.id))throw Error("Galería inválida");
  const photos=await env.DB.prepare("SELECT storage_path FROM moments_photos WHERE album_id=?").bind(body.id).all();
  const r=await env.DB.prepare("DELETE FROM moments_albums WHERE id=? RETURNING id").bind(body.id).first();
  if(!r)throw Error("Galería no encontrada");
  for(const photo of photos.results||[]){
   try{await env.MEDIA.delete(photo.storage_path);}
   catch(e){console.error("R2 orphan album",String(e?.message||"error").slice(0,80));}
  }
  return {ok:true};
 }
 if(kind==="moments_photos"&&action==="delete"){
  if(!uuid(body.id))throw Error("Foto inválida");
  const row=await env.DB.prepare("DELETE FROM moments_photos WHERE id=? RETURNING storage_path")
   .bind(body.id).first();
  if(!row)throw Error("Foto no encontrada");
  try{await env.MEDIA.delete(row.storage_path);}
  catch(e){console.error("R2 orphan photo",String(e?.message||"error").slice(0,80));}
  return {ok:true};
 }
 throw Error("Operación no permitida");
}
function validateBytes(mime,bytes){
 const b=new Uint8Array(bytes),n=b.length;
 if(n===0||n>5*1024*1024)throw Error("Tamaño de foto no permitido");
 const jpeg=mime==="image/jpeg"&&b[0]===255&&b[1]===216;
 const png=mime==="image/png"&&b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71;
 const webp=mime==="image/webp"&&String.fromCharCode(...b.slice(0,4))==="RIFF"&&String.fromCharCode(...b.slice(8,12))==="WEBP";
 if(!jpeg&&!png&&!webp)throw Error("Contenido de imagen incorrecto");
}
export async function mirrorWriteRoute(request,env){
 const url=new URL(request.url);
 const upload=url.pathname==="/v1/mirror/admin/media/upload";
 const write=url.pathname==="/v1/mirror/admin/write";
 const media=url.pathname.match(/^\/v1\/mirror\/media\/(events|rewards|promos|logos)\/([0-9a-f-]{36}\.(?:png|jpg|webp))$/i);
 if(!upload&&!write&&!media)return null;
 if(media){
  if(request.method!=="GET")return bad("Método no permitido",405);
  const object=await env.MEDIA.get("media/"+media[1]+"/"+media[2]);
  if(!object)return bad("Imagen no encontrada",404);
  const type=object.httpMetadata?.contentType;
  if(!imageTypes[type])return bad("Tipo de imagen no válido",415);
  return new Response(object.body,{headers:{
    "Content-Type":type,"Cache-Control":"public,max-age=86400",
    "X-Robots-Tag":"noindex,nofollow","X-Content-Type-Options":"nosniff"}});
 }
 if(request.method!==(upload?"PUT":"POST"))return bad("Método no permitido",405);
 const actor=await authenticatedProfile(request,env);
 if(!actor)return bad("Inicia sesión",401);
 if(actor.role!=="admin")return bad("Acceso reservado a administradores",403);
 if(!checkOrigin(request,env))return bad("Origen no autorizado",403);
 if(env.STAGING_MUTATIONS!=="enabled")return bad("Las operaciones de pruebas están desactivadas",423);
 try{
  if(upload){
   const category=url.searchParams.get("category");
   const type=(request.headers.get("Content-Type")||"").toLowerCase();
   if(!validCategory(category)||!imageTypes[type])throw Error("Categoría o formato no válido");
   const size=Number(request.headers.get("Content-Length")||0);
   if(size>5*1024*1024)throw Error("Foto demasiado grande");
   const bytes=await request.arrayBuffer();
   validateBytes(type,bytes);
   const key="media/"+category+"/"+crypto.randomUUID()+"."+imageTypes[type];
   await env.MEDIA.put(key,bytes,{httpMetadata:{contentType:type}});
   return reply({ok:true,key,url:url.origin+"/v1/mirror/"+key});
  }
  if(!/^application\/json(?:;|$)/i.test(request.headers.get("Content-Type")||""))
   throw Error("Se requiere JSON");
  const body=await parseBody(request);
  return reply(await writes(env,body));
 }catch(error){
  console.error("mirror write failed",String(error?.message||"error").slice(0,125));
  return bad(/constraint|FOREIGN KEY/i.test(String(error?.message||""))?"El elemento está siendo utilizado y no se puede borrar":String(error?.message||"Error al guardar").slice(0,180),409);
 }
}
