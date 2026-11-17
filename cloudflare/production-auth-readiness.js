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
  if (!env || env.SITE_MODE !== "production" ||
      env.PUBLISH_APPROVED !== "yes") return false;
  const has = (key, minimum) =>
    typeof env[key] === "string" && env[key].length >= minimum;
  const expectedFlags = {
    STAGING_MUTATIONS: "enabled",
    ALLOW_NEW_ACCOUNTS: "yes",
    EMAIL_AUTH_ENABLED: "yes",
    EMAIL_REGISTRATION_ENABLED: "yes",
    ADMIN_EMAIL_LINK_ENABLED: "yes",
    SUGGESTIONS_ENABLED: "yes"
  };
  if (!Object.entries(expectedFlags).every(([key,value])=>env[key]===value))
    return false;
  if (env.PUBLIC_ORIGIN !== CANONICAL_ORIGIN) return false;
  if (env.TURNSTILE_EXPECTED_HOSTNAME &&
      env.TURNSTILE_EXPECTED_HOSTNAME !== "bellaquitas.fr") return false;
  if (typeof env.DB?.prepare !== "function" ||
      typeof env.ASSETS?.fetch !== "function") return false;
  if (!has("GOOGLE_CLIENT_ID", 10) || !has("GOOGLE_CLIENT_SECRET", 12) ||
      !has("EMAIL_RATE_KEY", 32) || !has("RESEND_API_KEY", 9) ||
      !has("TURNSTILE_SECRET", 9) || !has("TURNSTILE_SITE_KEY", 9))
    return false;
  if (typeof env.RESEND_FROM !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.RESEND_FROM)) return false;
  return true;
}

export function productionAccessGate(request, env) {
  // Si alguien añade una ruta o workers.dev a la PREPRODUCCIÓN por error,
  // NUNCA servir API, datos públicos, login ni HTML: HTTP 503 en toda ruta.
  // Solo staging, sin SITE_MODE, conserva su comportamiento anterior.
  if (env?.SITE_MODE !== "production" && env?.SITE_MODE !== "preproduction") return null;
  const headers = {
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex,nofollow",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff"
  };
  if (env.SITE_MODE === "preproduction")
    return new Response("Entorno privado sin acceso público.",{
      status:503,headers:{"Content-Type":"text/plain; charset=utf-8",...headers}
    });
  // Dejar fallar cerrado sin publicar qué secreto o proveedor falta.
  if (!productionConfigurationReady(env))
    return new Response("Bellaquitas Fest no está preparado para publicar.",{
      status:503,headers:{"Content-Type":"text/plain; charset=utf-8",...headers}
    });
  const url = new URL(request.url);
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
