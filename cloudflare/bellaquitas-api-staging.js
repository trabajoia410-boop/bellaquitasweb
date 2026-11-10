import {authRoute} from "./auth-routes.js";
import {previewRoute} from "./preview-page.js";
import {protectedRoute} from "./protected-routes.js";
/**
 * Bellaquitas Fest — API de lectura para entorno de pruebas en Cloudflare.
 * No usar para gestionar usuarios, puntos, visitas ni permisos.
 * Las escrituras y la autenticación quedan bloqueadas hasta completar
 * la revisión de seguridad del nuevo sistema.
 */
const ALLOWED_ORIGINS = new Set([
  "https://bellaquitas.fr",
  "https://www.bellaquitas.fr",
  "https://trabajoia410-boop.github.io"
]);
const COMMON_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "no-store",
  "Vary": "Origin"
};
function responseHeaders(request, extra = {}) {
  const origin = request.headers.get("Origin");
  const headers = new Headers(COMMON_HEADERS);
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Accept, Content-Type");
  }
  for (const [key, value] of Object.entries(extra)) headers.set(key, value);
  return headers;
}
function jsonResponse(request, body, status = 200) {
  const headers = responseHeaders(request, {"Content-Type": "application/json; charset=utf-8"});
  return new Response(JSON.stringify(body), {status, headers});
}
function withJsonFields(rows) {
  return rows.map(record => {
    const item = {...record};
    for (const field of ["localized_content", "page_settings"]) {
      if (typeof item[field] === "string") {
        try { item[field] = JSON.parse(item[field]); }
        catch { item[field] = {}; }
      }
    }
    for (const field of ["active", "published"]) {
      if (field in item) item[field] = item[field] === 1;
    }
    return item;
  });
}
export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {status: 204, headers: responseHeaders(request)});
    }
    try {
      const previewResponse = previewRoute(request);
      if (previewResponse) return previewResponse;
      const authResponse = await authRoute(request, env);
      if (authResponse) return authResponse;
      const protectedResponse = await protectedRoute(request, env);
      if (protectedResponse) return protectedResponse;
      if (request.method !== "GET") {
        return jsonResponse(request, {error: "Método no permitido"}, 405);
      }
      const {pathname} = new URL(request.url);
      if (pathname === "/health") {
        const record = await env.DB.prepare("SELECT 1 AS ok").first();
        return jsonResponse(request, {
          service: "bellaquitas-staging",
          status: record?.ok === 1 ? "ok" : "error",
          database: record?.ok === 1 ? "connected" : "unavailable",
          storage: env.MEDIA ? "configured" : "unavailable"
        }, record?.ok === 1 ? 200 : 503);
      }
      const publicQueries = {
        "/v1/events": "SELECT id, name, date_label, location, description, start_time, image_url, localized_content FROM events WHERE active = 1 ORDER BY date_label ASC LIMIT 100",
        "/v1/rewards": "SELECT id, name, category, cost, symbol, description, image_url, localized_content FROM rewards WHERE active = 1 ORDER BY cost ASC LIMIT 100",
        "/v1/promos": "SELECT id, name, bonus, description, localized_content FROM promos WHERE active = 1 ORDER BY name ASC LIMIT 100",
        "/v1/moments": "SELECT id, title, event_date FROM moments_albums WHERE published = 1 ORDER BY event_date DESC LIMIT 100"
      };
      if (Object.prototype.hasOwnProperty.call(publicQueries, pathname)) {
        const results = await env.DB.prepare(publicQueries[pathname]).all();
        return jsonResponse(request, {items: withJsonFields(results.results || [])});
      }
      if (pathname === "/v1/site") {
        const row = await env.DB.prepare(
          "SELECT hero_text, announcement, page_settings, updated_at FROM site_content WHERE key = ?"
        ).bind("homepage").first();
        if (!row) return jsonResponse(request, {error: "Publicación no encontrada"}, 404);
        return jsonResponse(request, {site: withJsonFields([row])[0]});
      }
      // These three logo objects were public at the source and have been
      // copied and checksum-verified in private R2. No other R2 keys are public.
      const logo = pathname.match(/^\/v1\/assets\/logos\/([0-9a-f-]{36}\.(?:png|jpg))$/i);
      if (logo) {
        const permitted = new Set([
          "705cc152-5de2-407a-a880-1e78ca4b30ea.png",
          "af5b256c-877b-4c9c-8d36-d00854885c4b.jpg",
          "f4978ae8-1058-43a7-b5cd-ef9b17c11843.png"
        ]);
        const name = logo[1].toLowerCase();
        if (!permitted.has(name)) return jsonResponse(request,{error:"Imagen no encontrada"},404);
        const object = await env.MEDIA.get("logos/" + name);
        if (!object) return jsonResponse(request,{error:"Imagen no encontrada"},404);
        const mime = name.endsWith(".png")?"image/png":"image/jpeg";
        if (object.httpMetadata?.contentType !== mime)
          return jsonResponse(request,{error:"Formato inválido"},415);
        return new Response(object.body,{
          status:200,headers:responseHeaders(request,{
            "Content-Type":mime,
            "Content-Disposition":"inline",
            "Cache-Control":"public, max-age=86400, immutable",
            "X-Content-Type-Options":"nosniff"
          })
        });
      }
      const photo = pathname.match(/^\/v1\/moments\/photos\/([0-9a-f-]{36})$/i);
      if (photo) {
        const record = await env.DB.prepare(
          "SELECT p.storage_path, p.caption FROM moments_photos p " +
          "INNER JOIN moments_albums a ON a.id = p.album_id " +
          "WHERE p.id = ? AND a.published = 1 LIMIT 1"
        ).bind(photo[1]).first();
        if (!record || !env.MEDIA) return jsonResponse(request, {error: "Foto no encontrada"}, 404);
        const object = await env.MEDIA.get(record.storage_path);
        if (!object) return jsonResponse(request, {error: "Foto no encontrada"}, 404);
        const mime = object.httpMetadata?.contentType || "";
        if (!["image/jpeg", "image/png", "image/webp"].includes(mime)) {
          return jsonResponse(request, {error: "Tipo de archivo no admitido"}, 415);
        }
        return new Response(object.body, {
          status: 200,
          headers: responseHeaders(request, {
            "Content-Type": mime,
            "Content-Disposition": "inline",
            "X-Content-Type-Options": "nosniff"
          })
        });
      }
      return jsonResponse(request, {error: "Ruta no encontrada"}, 404);
    } catch (error) {
      console.error("Bellaquitas staging API:", error?.message || "unknown");
      return jsonResponse(request, {error: "Servicio temporalmente no disponible"}, 503);
    }
  }
};
