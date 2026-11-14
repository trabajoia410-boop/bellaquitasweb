/**
 * Bellaquitas Fest — datos de la web pública desde Cloudflare D1.
 * Solo rutas GET de lectura, sin servicio ajeno, sin R2 ni créditos mutados.
 * La ficha privada del socio se obtiene siempre de la cookie HttpOnly D1,
 * jamás de un ID enviado en la URL o en el navegador.
 */
import {authenticatedProfile} from "./auth-routes.js";
const HEAD={
  "Content-Type":"application/json; charset=utf-8",
  "Cache-Control":"private, no-store",
  "X-Content-Type-Options":"nosniff",
  "X-Robots-Tag":"noindex, nofollow",
  "Referrer-Policy":"no-referrer"
};
const respond=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:HEAD});
const PRIVATE=["/v1/me/overview","/v1/door/overview"];
const PUBLIC="/v1/moments/public-photos";

export async function publicD1ReadRoute(request,env){
  const pathname=new URL(request.url).pathname;
  if(!PRIVATE.includes(pathname)&&pathname!==PUBLIC)return null;
  if(request.method!=="GET")return respond({error:"Método no permitido"},405);

  if(pathname===PUBLIC){
    // Solo URLs propias de GitHub Pages ya publicadas, NUNCA claves privadas
    // de Storage o buckets eliminados. No compartir rutas de álbumes ocultos.
    const rows=await env.DB.prepare(
      "SELECT p.id,p.album_id,p.caption,p.storage_path FROM moments_photos p "+
      "JOIN moments_albums a ON a.id=p.album_id WHERE a.published=1 "+
      "ORDER BY p.created_at DESC LIMIT 200"
    ).all();
    const items=(rows.results||[]).filter(item=>
      typeof item.storage_path==="string"&&
      /^assets\/[A-Za-z0-9][A-Za-z0-9_.\/-]{1,230}\.(?:jpg|jpeg|png|webp)$/i.test(item.storage_path)&&
      !item.storage_path.includes("..")
    ).map(item=>({
      id:item.id,album_id:item.album_id,caption:item.caption,
      image_url:"/"+item.storage_path
    }));
    return respond({items});
  }

  const actor=await authenticatedProfile(request,env);
  if(!actor)return respond({error:"Inicia sesión para acceder a esta función"},401);
  if(pathname==="/v1/me/overview"){
    const [red,activity]=await Promise.all([
      env.DB.prepare(
        "SELECT r.id,r.code,r.user_id,r.reward_id,r.cost,r.status,"+
        "r.created_at,r.validated_at FROM redemptions r "+
        "WHERE r.user_id=? ORDER BY r.created_at DESC LIMIT 100"
      ).bind(actor.id).all(),
      env.DB.prepare(
        "SELECT id,type,delta,detail,created_at FROM activity "+
        "WHERE user_id=? ORDER BY created_at DESC LIMIT 100"
      ).bind(actor.id).all()
    ]);
    return respond({
      profile:{
        id:actor.id,name:actor.name,role:actor.role,
        member_code:actor.member_code,points:actor.points,
        lifetime_points:actor.lifetime_points,visits:actor.visits,
        created_at:actor.created_at
      },
      redemptions:red.results||[],activity:activity.results||[]
    });
  }

  if(!["puerta","admin"].includes(actor.role))
    return respond({error:"Solo personal autorizado"},403);
  const [members,redemptions]=await Promise.all([
    env.DB.prepare(
      "SELECT id,name,role,member_code,visits,lifetime_points "+
      "FROM profiles WHERE role='socio' ORDER BY name LIMIT 500"
    ).all(),
    env.DB.prepare(
      "SELECT r.id,r.code,r.user_id,r.reward_id,r.cost,r.status,"+
      "r.created_at FROM redemptions r WHERE r.status='pendiente' "+
      "ORDER BY r.created_at DESC LIMIT 200"
    ).all()
  ]);
  return respond({members:members.results||[],redemptions:redemptions.results||[]});
}
