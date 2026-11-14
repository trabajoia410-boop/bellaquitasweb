/* Bellaquitas Fest: server-side access control and atomic loyalty operations.
 * All mutations are disabled unless STAGING_MUTATIONS='enabled'.
 * D1 triggers enforce redemption debits, staff-only validation and admin audit.
 */
import {authenticatedProfile,authenticatedAdminAccess,checkOrigin} from "./auth-routes.js";
const HEAD={"Content-Type":"application/json; charset=utf-8",
  "Cache-Control":"no-store","X-Content-Type-Options":"nosniff",
  "X-Robots-Tag":"noindex, nofollow"};
const out=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:HEAD});
const error=(message,status=400)=>out({error:message},status);
const uuid=v=>typeof v==="string"&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
function staff(actor){return actor && (actor.role==="puerta"||actor.role==="admin");}
function admin(privilegedActor){return actor&&actor.role==="admin";}
async function readJson(req){
  if(!/^application\/json(?:;|$)/i.test(req.headers.get("Content-Type")||""))throw new Error("Se requiere JSON");
  const size=Number(req.headers.get("Content-Length")||0);
  if(size>16384)throw new Error("Solicitud demasiado grande");
  const text=await req.text();if(text.length>16384)throw new Error("Solicitud demasiado grande");
  const body=JSON.parse(text);
  if(!body||typeof body!=="object"||Array.isArray(body))throw new Error("JSON inválido");
  return body;
}
function errorMessage(err){
  const message=String(err?.message||"Error");
  if(/UNIQUE constraint failed|idx_activity_one_visit_per_day/i.test(message))
    return "Esta visita ya se ha validado hoy";
  if(/Puntos insuficientes/.test(message))return "Puntos insuficientes";
  if(/Recompensa no disponible/.test(message))return "Recompensa no disponible";
  if(/No puedes|Solo un administrador|El cambio está desactualizado|Datos inválidos|Personal no autorizado|Canje ya está cerrado|Debe permanecer|El motivo es obligatorio|Saldo inválido|Rol inválido/.test(message))return message;
  return "No se pudo completar la operación";
}
export async function protectedRoute(request,env){
  const path=new URL(request.url).pathname;
  const known=[
    "/v1/me/activity","/v1/admin/members","/v1/door/members",
    "/v1/account/name","/v1/door/checkin","/v1/rewards/request",
    "/v1/door/redemptions/validate","/v1/admin/member",
    "/v1/admin/moments/create","/v1/admin/moments/publish"
  ];
  const photoMatch=path.match(/^\/v1\/admin\/moments\/([0-9a-f-]{36})\/photo$/i);
  if(!known.includes(path)&&!photoMatch)return null;
  const actor=await authenticatedProfile(request,env);
  if(!actor)return error("Inicia sesión para acceder a esta función",401);
  const privilegedActor=actor.role==="admin"?await authenticatedAdminAccess(request,env):null;
  if(path==="/v1/me/activity"){
    if(request.method!=="GET")return error("Método no permitido",405);
    const q=await env.DB.prepare("SELECT id,type,delta,detail,created_at FROM activity WHERE user_id=? ORDER BY created_at DESC LIMIT 100").bind(actor.id).all();
    return out({items:q.results||[]});
  }
  if(path==="/v1/admin/members"){
    if(request.method!=="GET")return error("Método no permitido",405);
    if(!admin(privilegedActor))return error("Acceso reservado a administradores",403);
    const q=await env.DB.prepare("SELECT id,name,role,member_code,points,lifetime_points,visits,created_at FROM profiles ORDER BY created_at DESC LIMIT 500").all();
    return out({items:q.results||[]});
  }
  if(path==="/v1/door/members"){
    if(request.method!=="GET")return error("Método no permitido",405);
    if(!staff(actor))return error("Acceso reservado al personal",403);
    const q=await env.DB.prepare("SELECT id,name,role,member_code,visits,lifetime_points FROM profiles ORDER BY name LIMIT 500").all();
    return out({items:q.results||[]});
  }
  if(request.method!=="POST")return error("Método no permitido",405);
  if(!checkOrigin(request,env))return error("Origen de solicitud no permitido",403);
  if(env.STAGING_MUTATIONS!=="enabled")return error("Las operaciones de pruebas están desactivadas",423);
  let body;
  try{if(!photoMatch)body=await readJson(request);}catch(e){return error("Solicitud JSON inválida",400);}
  try{
    if(path==="/v1/account/name"){
      const name=String(body.name||"").trim();
      if(name.length<2||name.length>80)return error("El nombre debe tener entre 2 y 80 caracteres");
      const updated=await env.DB.prepare("UPDATE profiles SET name=? WHERE id=? RETURNING id,name")
        .bind(name,actor.id).first();
      return out({profile:updated});
    }
    if(path==="/v1/door/checkin"){
      if(!staff(actor))return error("Acceso reservado al personal",403);
      const code=String(body.code||"").trim().toUpperCase();
      if(!/^MBR-[A-Z0-9-]{5,80}$/.test(code))return error("Código de socio no válido");
      const member=await env.DB.prepare("SELECT id FROM profiles WHERE upper(member_code)=? LIMIT 1").bind(code).first();
      if(!member)return error("Tarjeta no encontrada",404);
      if(member.id===actor.id)return error("No puedes validar tu propia tarjeta",403);
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO activity(id,user_id,type,delta,detail,staff_id,created_at) "+
          "VALUES (? ,? ,'visita',10,'Visita validada',?,datetime('now'))"
        ).bind(crypto.randomUUID(),member.id,actor.id),
        env.DB.prepare("UPDATE profiles SET points=points+10,lifetime_points=lifetime_points+10,visits=visits+1 WHERE id=?").bind(member.id)
      ]);
      return out({ok:true,points_awarded:10});
    }
    if(path==="/v1/rewards/request"){
      const rewardId=body.reward_id;
      if(!uuid(rewardId))return error("Recompensa inválida");
      const reward=await env.DB.prepare("SELECT id,cost,name FROM rewards WHERE id=? AND active=1").bind(rewardId).first();
      if(!reward)return error("Recompensa no disponible",404);
      const redemptionCode="CNJ-"+crypto.randomUUID().replace(/-/g,"").slice(0,10).toUpperCase();
      // A D1 trigger enforces sufficient points and deducts the cost atomically.
      await env.DB.prepare("INSERT INTO redemptions(id,code,user_id,reward_id,cost) VALUES (?,?,?,?,?)")
        .bind(crypto.randomUUID(),redemptionCode,actor.id,rewardId,reward.cost).run();
      return out({ok:true,code:redemptionCode});
    }
    if(path==="/v1/door/redemptions/validate"){
      if(!staff(actor))return error("Acceso reservado al personal",403);
      const code=String(body.code||"").trim().toUpperCase();
      if(!/^CNJ-[A-F0-9]{10}$/.test(code))return error("Código de canje inválido");
      const redemption=await env.DB.prepare("SELECT id,user_id,status FROM redemptions WHERE code=?").bind(code).first();
      if(!redemption||redemption.status!=="pendiente")return error("Canje no encontrado o ya validado",404);
      if(redemption.user_id===actor.id)return error("No puedes validar tu propio canje",403);
      const result=await env.DB.prepare(
        "UPDATE redemptions SET status='validado',validated_at=datetime('now'),validated_by=? "+
        "WHERE id=? AND status='pendiente' RETURNING id"
      ).bind(actor.id,redemption.id).first();
      if(!result)return error("Canje no encontrado o ya validado",409);
      return out({ok:true});
    }
    if(path==="/v1/admin/member"){
      if(!admin(privilegedActor))return error("Acceso reservado a administradores",403);
      if(!uuid(body.member_id))return error("Socio inválido");
      const target=await env.DB.prepare("SELECT id,name,role,points,lifetime_points,visits FROM profiles WHERE id=?").bind(body.member_id).first();
      if(!target)return error("La cuenta ya no existe",404);
      const name=String(body.name||"").trim(),role=String(body.role||""),
        reason=String(body.reason||"").trim();
      if(name.length<2||name.length>80||!["socio","puerta","admin"].includes(role)||reason.length<5||reason.length>250)
        return error("Nombre, rol o motivo no válidos");
      const points=Number(body.points),lifetime=Number(body.lifetime_points),visits=Number(body.visits);
      if(![points,lifetime,visits].every(Number.isSafeInteger)||points<0||points>100000000||
         lifetime<0||lifetime>100000000||visits<0||visits>1000000)
        return error("Puntos o visitas no válidos");
      const before={name:target.name,role:target.role,points:target.points,
        lifetime_points:target.lifetime_points,visits:target.visits};
      const after={name,role,points,lifetime_points:Math.max(lifetime,points),visits};
      // The trigger verifies admin rights, concurrency and the last-admin invariant
      // before applying the update and recording its audit log atomically.
      await env.DB.prepare(
        "INSERT INTO admin_member_changes(id,member_id,admin_id,before_data,after_data,reason) "+
        "VALUES (?,?,?,?,?,?)"
      ).bind(crypto.randomUUID(),target.id,actor.id,JSON.stringify(before),JSON.stringify(after),reason).run();
      return out({ok:true,profile:{id:target.id,...after}});
    }
    if(path==="/v1/admin/moments/create"){
      if(!admin(privilegedActor))return error("Acceso reservado a administradores",403);
      const title=String(body.title||"").trim(),date=String(body.event_date||"");
      if(title.length<2||title.length>120||!/^\d{4}-\d{2}-\d{2}$/.test(date))return error("Datos de la galería no válidos");
      const id=crypto.randomUUID();
      await env.DB.prepare("INSERT INTO moments_albums(id,title,event_date,published) VALUES (?,?,?,0)").bind(id,title,date).run();
      return out({ok:true,id});
    }
    if(path==="/v1/admin/moments/publish"){
      if(!admin(privilegedActor))return error("Acceso reservado a administradores",403);
      if(!uuid(body.album_id)||typeof body.published!=="boolean")return error("Galería inválida");
      const record=await env.DB.prepare("UPDATE moments_albums SET published=? WHERE id=? RETURNING id,published")
        .bind(body.published?1:0,body.album_id).first();
      return record?out({ok:true,published:!!record.published}):error("Galería no encontrada",404);
    }
    if(photoMatch)return error("Las fotografías quedan bloqueadas hasta completar la migración estática",423);
  }catch(err){
    console.error("Staging operation:",String(err?.message||"error").slice(0,200));
    return error(errorMessage(err),409);
  }
  return error("Ruta no encontrada",404);
}
