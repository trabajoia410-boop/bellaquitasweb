/**
 * Bellaquitas Fest — frontera de coste estricto para el Worker CANDIDATO.
 *
 * Coste cero es una POLÍTICA DE RECURSOS, no un medidor de facturación.
 * Workers/D1/KV deben permanecer en el plan Free (cuotas nativas -> error).
 * R2 tiene cobros por exceso: NO se entrega su binding a ninguna ruta.
 * Resend u otros correos externos NO reciben credenciales en modo Free-only.
 *
 * Fail-closed si la política no está configurada explícitamente. No hay un
 * interruptor de cuenta Cloudflare en este archivo: la facturación de OTROS
 * Workers, buckets, DNS, planes, etc. requiere auditoría del propietario.
 *
 * Laboratorio: las pruebas de integración existentes necesitan R2 ficticio
 * en memoria. El permiso de ensayo NO es una variable de entorno ni un header
 * y solo se aplica a objetos de fixtures mediante una referencia local.
 */
const testEnvs=new WeakSet();
const DENIED_BINDINGS=new Set([
  "MEDIA",                      // R2: lecturas, altas, borrados y listados
  "RESEND_API_KEY",              // no emitir emails con proveedor externo
  "RESEND_FROM",
  "R2_MUTATIONS_APPROVED",
  "R2_READS_APPROVED",
  "EMAIL_DELIVERY_APPROVED",
  "MAIL_PROVIDER_API_KEY",
]);
const DENIED_FLAGS=new Set([
  "ADMIN_EMAIL_ACTIVATION_ENABLED",
  "EMAIL_REGISTRATION_ENABLED",
]);
function safeResponse(error,status=503){
  return new Response(JSON.stringify({error}),{
    status,headers:{
      "Content-Type":"application/json; charset=utf-8",
      "Cache-Control":"no-store",
      "X-Content-Type-Options":"nosniff",
      "X-Robots-Tag":"noindex, nofollow",
      "Referrer-Policy":"no-referrer"
    }
  });
}
export function allowSyntheticCostServicesForTests(env){
  // Exclusivo para test harness Node: no se evalúa en runtime Workers.
  // Ningún string administrable de Cloudflare activa este permiso.
  if(!env||typeof env!=="object"||!env.DB||!env.MEDIA||
     env.__syntheticMemoryOnly!==true)
    throw new TypeError("Solo se admiten fixtures sintéticos aislados");
  testEnvs.add(env);
}
/** Devuelve un entorno limitado y/o respuesta de rechazo antes de procesar. */
export function freeOnlyRequestBoundary(request,env){
  if(testEnvs.has(env))return {env,blocked:null,synthetic:true};
  // Nunca procesar una petición si faltan políticas explícitas Free-only.
  if(env?.COST_POLICY!=="free-only"){
    return {env:null,blocked:safeResponse("Servicio pendiente de verificación del plan gratuito"),synthetic:false};
  }
  // Anular el acceso al binding R2 incluso si otras flags se activan.
  const safeEnv=new Proxy(env,{
    get(target,key,receiver){
      if(DENIED_BINDINGS.has(key))return undefined;
      if(DENIED_FLAGS.has(key))return "no";
      return Reflect.get(target,key,receiver);
    },
    set(){throw new Error("La política de coste no se puede modificar en una solicitud");},
    defineProperty(){throw new Error("La política de coste no permite nuevos recursos");},
    deleteProperty(){throw new Error("La política de coste no permite borrar restricciones");}
  });
  const pathname=new URL(request.url).pathname;
  // Si el Worker conserva la antigua opción de identidad externa,
  // bloquearlo: nunca recurrir a un proveedor retirado por el dueño.
  if(env.ADMIN_SUPABASE_BRIDGE==="yes"){
    return {env:safeEnv,blocked:safeResponse(
      "Configuración de autenticación antigua prohibida",503),synthetic:false};
  }
  // Google OAuth propio emite una sesión HttpOnly respaldada por D1.
  // El panel solo la canjea a través de /administracion/api/sso.
  const mediaRead=request.method==="GET"&&(
    /^\/v1\/assets\/logos\//.test(pathname)||
    /^\/v1\/moments\/photos\//.test(pathname)||
    /^\/v1\/mirror\/admin\/media\//.test(pathname)||
    /^\/administracion\/api\/photos\//.test(pathname)
  );
  const mediaUpload=(request.method==="PUT"&&(
    pathname==="/v1/mirror/admin/media/upload"||
    pathname==="/administracion/api/upload"))||
    (request.method==="POST"&&(
      /^\/v1\/admin\/moments\/[0-9a-f-]{36}\/photo$/i.test(pathname)||
      /^\/administracion\/api\/moments\/[0-9a-f-]{36}\/photo$/i.test(pathname)
    ));
  // R2 Class B (lecturas) también cuesta. Rechazar explícitamente.
  if(mediaRead||mediaUpload){
    return {env:safeEnv,blocked:safeResponse(
      "Las fotos dinámicas están desactivadas para evitar cargos de almacenamiento",423),synthetic:false};
  }
  return {env:safeEnv,blocked:null,synthetic:false};
}
