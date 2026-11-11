import {authenticatedProfile} from "./auth-routes.js";
// Endpoints de lectura para conectar el renderer ORIGINAL al staging de Cloudflare.
// Nunca devuelven registros privados a personas anónimas ni escriben puntos/visitas.
const HEADERS={
 "Content-Type":"application/json; charset=utf-8",
 "Cache-Control":"private, no-store",
 "X-Content-Type-Options":"nosniff",
 "X-Robots-Tag":"noindex, nofollow"
};
function reply(body,status=200){
 return new Response(JSON.stringify(body),{status,headers:HEADERS});
}
function forbidden(){return reply({error:"Acceso no autorizado"},403);}
const fail=()=>reply({error:"Inicia sesión"},401);
const isStaff=p=>p?.role==="puerta"||p?.role==="admin";
const isAdmin=p=>p?.role==="admin";
function parseCatalog(rows){
 return rows.map(row=>{
  const result={...row};
  if(typeof result.localized_content==="string"){
   try{result.localized_content=JSON.parse(result.localized_content);}
   catch{result.localized_content={};}
  }
  if("active" in result)result.active=result.active===1||result.active===true;
  return result;
 });
}
function photoRow(row,admin=false){
 const output={...row,storage_path:(admin?"admin-photo:":"public-photo:")+row.id};
 delete output.storage_key;
 return output;
}
export async function mirrorDataRoute(request,env){
 const path=new URL(request.url).pathname;
 if(!path.startsWith("/v1/mirror/"))return null;
 if(request.method!=="GET")return reply({error:"Método no permitido"},405);
 try{
  if(path==="/v1/mirror/public/photos"){
   const res=await env.DB.prepare(
    "SELECT p.id,p.album_id,p.caption,p.created_at FROM moments_photos p "+
    "JOIN moments_albums a ON a.id=p.album_id WHERE a.published=1 "+
    "ORDER BY p.created_at ASC LIMIT 500"
   ).all();
   return reply({items:(res.results||[]).map(x=>photoRow(x))});
  }
  const actor=await authenticatedProfile(request,env);
  if(!actor)return fail();
  if(path==="/v1/mirror/me/redemptions"){
   const res=await env.DB.prepare(
    "SELECT id,code,user_id,reward_id,cost,status,created_at,validated_at,validated_by "+
    "FROM redemptions WHERE user_id=? ORDER BY created_at DESC LIMIT 100"
   ).bind(actor.id).all();
   return reply({items:res.results||[]});
  }
  if(path==="/v1/mirror/door/redemptions"){
   if(!isStaff(actor))return forbidden();
   const res=await env.DB.prepare(
    "SELECT id,code,user_id,reward_id,cost,status,created_at,validated_at,validated_by "+
    "FROM redemptions ORDER BY created_at DESC LIMIT 200"
   ).all();
   return reply({items:res.results||[]});
  }
  if(!isAdmin(actor))return forbidden();
  if(path==="/v1/mirror/admin/catalog/events"){
   const res=await env.DB.prepare("SELECT * FROM events ORDER BY created_at DESC LIMIT 500").all();
   return reply({items:parseCatalog(res.results||[])});
  }
  if(path==="/v1/mirror/admin/catalog/rewards"){
   const res=await env.DB.prepare("SELECT * FROM rewards ORDER BY created_at DESC LIMIT 500").all();
   return reply({items:parseCatalog(res.results||[])});
  }
  if(path==="/v1/mirror/admin/catalog/promos"){
   const res=await env.DB.prepare("SELECT * FROM promos ORDER BY created_at DESC LIMIT 500").all();
   return reply({items:parseCatalog(res.results||[])});
  }
  if(path==="/v1/mirror/admin/activity"){
   const res=await env.DB.prepare(
    "SELECT id,user_id,type,delta,detail,created_at,staff_id "+
    "FROM activity ORDER BY created_at DESC LIMIT 200"
   ).all();
   return reply({items:res.results||[]});
  }
  if(path==="/v1/mirror/admin/changes"){
   const res=await env.DB.prepare(
    "SELECT id,member_id,admin_id,before_data,after_data,reason,created_at "+
    "FROM admin_member_changes ORDER BY created_at DESC LIMIT 40"
   ).all();
   return reply({items:res.results||[]});
  }
  if(path==="/v1/mirror/admin/site-drafts"){
   const res=await env.DB.prepare(
    "SELECT key,settings,updated_at FROM site_drafts LIMIT 1"
   ).all();
   return reply({items:(res.results||[]).map(row=>{
    let settings={};try{settings=JSON.parse(row.settings||"{}");}catch{}
    return {...row,settings};
   })});
  }
  if(path==="/v1/mirror/admin/community"){
   const [a,p,s]=await env.DB.batch([
    env.DB.prepare("SELECT id,title,event_date,published,created_at FROM moments_albums ORDER BY event_date DESC LIMIT 300"),
    env.DB.prepare(
     "SELECT p.id,p.album_id,p.caption,p.created_at,a.published "+
     "FROM moments_photos p INNER JOIN moments_albums a ON a.id=p.album_id "+
     "ORDER BY p.created_at ASC LIMIT 500"
    ),
    env.DB.prepare(
     "SELECT id,name,message,status,created_at FROM community_suggestions "+
     "ORDER BY created_at DESC LIMIT 200"
    )
   ]);
   return reply({
    albums:(a.results||[]).map(row=>({...row,published:row.published===1})),
    photos:(p.results||[]).map(row=>photoRow(row,row.published!==1)),
    suggestions:s.results||[]
   });
  }
  const photoMatch=path.match(/^\/v1\/mirror\/admin\/media\/([0-9a-f-]{36})$/i);
  if(photoMatch){
   const record=await env.DB.prepare(
    "SELECT storage_path FROM moments_photos WHERE id=? LIMIT 1"
   ).bind(photoMatch[1]).first();
   if(!record)return reply({error:"Fotografía no encontrada"},404);
   const stored=await env.MEDIA.get(record.storage_path);
   if(!stored)return reply({error:"Fotografía no encontrada"},404);
   const type=stored.httpMetadata?.contentType;
   if(!["image/png","image/jpeg","image/webp"].includes(type))
    return reply({error:"Formato no admitido"},415);
   return new Response(stored.body,{headers:{
    "Content-Type":type,"Cache-Control":"private, no-store",
    "X-Content-Type-Options":"nosniff","X-Robots-Tag":"noindex, nofollow"
   }});
  }
  return reply({error:"Ruta no encontrada"},404);
 }catch(error){
  console.error("mirror read:",String(error?.message||"unknown").slice(0,120));
  return reply({error:"No se ha podido consultar esta información"},503);
 }
}
