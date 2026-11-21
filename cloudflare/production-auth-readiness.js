import {productionClerkUiConfig} from "./clerk-login-page.js";
/**
 * Bellaquitas Fest — bloqueo de producción para no publicar una portada
 * que permita registrarse pero no iniciar sesión, ni un panel sin acceso.
 * Se evalúa sólo cuando SITE_MODE === 'production'.
 *
 * No expone ni registra secretos. La existencia de bindings NO reemplaza
 * una prueba OAuth/Resend/Turnstile real en el hostname final.
 */
export const CANONICAL_ORIGIN = "https://bellaquitas.fr";

export function productionConfigurationReady(env) {
  // Una bandera de despliegue y secretos válidos no bastan: la copia
  // restaurable debe estar bajo custodia y el delta del origen conciliado.
  // Estas dos verificaciones son independientes y se mantienen cerradas
  // en la configuración de preproducción.
  if (!env || env.SITE_MODE !== "production" ||
      env.PUBLISH_APPROVED !== "yes" ||
      env.FINAL_ORIGIN_RECONCILED !== "yes" ||
      env.BACKUP_KEY_CUSTODIED !== "yes" ||
      // Independientes del flag de publicación: sin enlaces reales Clerk
      // o tablas Wallet instaladas no se puede iniciar sesión ni sellar.
      env.CLERK_IDENTITIES_RECONCILED !== "yes" ||
      env.WALLET_SCHEMA_VERIFIED !== "yes" ||
      env.WALLET_ENABLED !== "yes" ||
      env.WALLET_REPLACE_LEGACY !== "yes" ||
      // Exigir verificación real de la facturación: zona Free no demuestra Workers Free.
      env.FREE_TIER_BILLING_VERIFIED !== "yes" ||
      // Workers Free: no abrir registro/login de contraseña sin ensayo real de CPU.
      env.FREE_TIER_CPU_VERIFIED !== "yes") return false;
  const has = (key, minimum) =>
    typeof env[key] === "string" && env[key].length >= minimum;
  const expectedFlags = {
    STAGING_MUTATIONS: "enabled",
    ALLOW_NEW_ACCOUNTS: "yes",
    // Clerk handles both Google and password/email in production. The
    // legacy PBKDF2 route consumed 136+ ms CPU on Workers Free (limit 10 ms).
    // Never require or enable its login/registration during Clerk cutover.
    EMAIL_AUTH_ENABLED: "no",
    EMAIL_REGISTRATION_ENABLED: "no",
    // Clerk also replaces the legacy admin email-link KDF.
    ADMIN_EMAIL_LINK_ENABLED: "no",
    SUGGESTIONS_ENABLED: "yes"
  };
  if (!Object.entries(expectedFlags).every(([key,value])=>env[key]===value))
    return false;
  // The old email password KDF must stay OFF in production. A Clerk JWKS
  // verifier is only usable with a pinned production issuer and canonical
  // origin, plus both explicit feature flags and a complete release gate.
  if (!productionClerkUiConfig(env) ||
      env.CLERK_JWT_ENABLED !== "yes" ||
      env.CLERK_EXCHANGE_ENABLED !== "yes" ||
      // El panel no puede quedar sin reverificación reciente de primer
      // factor Clerk (Hobby gratuito; MFA de producción sería de pago).
      // El flujo frontend y la prueba de identidad real siguen pendientes.
      env.CLERK_ADMIN_STEPUP_ENABLED !== "yes" ||
      env.CLERK_ISSUER !== "https://clerk.bellaquitas.fr" ||
      env.CLERK_ALLOWED_ORIGIN !== CANONICAL_ORIGIN) return false;
  if (env.PUBLIC_ORIGIN !== CANONICAL_ORIGIN) return false;
  if (env.TURNSTILE_EXPECTED_HOSTNAME &&
      env.TURNSTILE_EXPECTED_HOSTNAME !== "bellaquitas.fr") return false;
  if (typeof env.DB?.prepare !== "function" ||
      typeof env.ASSETS?.fetch !== "function") return false;
  // Reutilizar las credenciales reales de staging mediante Service Binding
  // autenticada con HMAC, SIN duplicar Google/Resend en el Worker nuevo.
  // También admitir secretos directos si en el futuro se provisionan
  // explícitamente. Ninguno de los dos modos evita los gates de datos/backup.
  const privateBridgeReady=env.PROVIDER_BROKER_ENABLED==="yes" &&
    has("PROVIDER_BROKER_KEY",43) &&
    typeof env.PROVIDER_BROKER?.fetch==="function";
  const googleReady=(has("GOOGLE_CLIENT_ID",10)&&
    has("GOOGLE_CLIENT_SECRET",12))||privateBridgeReady;
  const resendReady=has("RESEND_API_KEY",9)||privateBridgeReady;
  if (!googleReady || !resendReady ||
      !has("EMAIL_RATE_KEY", 32) ||
      !has("TURNSTILE_SECRET", 9) || !has("TURNSTILE_SITE_KEY", 9))
    return false;
  if (typeof env.RESEND_FROM !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.RESEND_FROM)) return false;
  return true;
}

export function productionAccessGate(request, env) {
  const url = new URL(request.url);
  // Un punto final DNS no debe esquivar el bloqueo: bellaquitas.fr.
  // es el mismo hostname en la jerarquía DNS que bellaquitas.fr.
  const canonicalHost = ["bellaquitas.fr","www.bellaquitas.fr"].includes(url.hostname.replace(/\.+$/,""));
  const headers = {
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex,nofollow",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff"
  };
  // Defensa contra un error de configuración: si alguien conecta una ruta
  // pública antes de definir SITE_MODE=production, NO servir el backend
  // de staging ni su panel ni responder OPTIONS con CORS permisivo.
  if (canonicalHost && env?.SITE_MODE !== "production")
    return new Response("Bellaquitas Fest todavía no está habilitado.",{
      status:503,headers:{"Content-Type":"text/plain; charset=utf-8",...headers}
    });
  // La preproducción está cerrada incluso en workers.dev o preview.
  // Staging conserva su API antigua solo en sus propios hostnames.
  if (env?.SITE_MODE !== "production" && env?.SITE_MODE !== "preproduction") return null;
  if (env.SITE_MODE === "preproduction")
    return new Response("Entorno privado sin acceso público.",{
      status:503,headers:{"Content-Type":"text/plain; charset=utf-8",...headers}
    });
  // Dejar fallar cerrado sin publicar qué secreto o proveedor falta.
  if (!productionConfigurationReady(env))
    return new Response("Bellaquitas Fest no está preparado para publicar.",{
      status:503,headers:{"Content-Type":"text/plain; charset=utf-8",...headers}
    });
  if (url.protocol !== "https:" ||
      !["bellaquitas.fr","www.bellaquitas.fr"].includes(url.hostname) ||
      (url.port && url.port !== "443"))
    return new Response("Origen no autorizado",{status:403,headers});
  if (url.hostname === "www.bellaquitas.fr") {
    // Asegurar cookies __Host-... y OAuth en un único origen; nunca
    // redirigir POST/PUT/DELETE con credenciales a otro host.
    if (request.method !== "GET" && request.method !== "HEAD")
      return new Response("Origen no autorizado",{status:403,headers});
    return Response.redirect(CANONICAL_ORIGIN+url.pathname+url.search,308);
  }
  return null;
}
