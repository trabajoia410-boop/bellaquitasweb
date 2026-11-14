import {authRoute} from "./auth-routes.js";
import {adminConsoleRoute} from "./admin-console.js";
import {previewRoute} from "./preview-page.js";
import {mirrorRoute} from "./web-mirror.js";
import {mirrorDataRoute} from "./mirror-data-routes.js";
import {mirrorWriteRoute} from "./mirror-write-routes.js";
import {suggestionRoute} from "./suggestion-routes.js";
import {protectedRoute} from "./protected-routes.js";
import {emailAuthRoute} from "./email-auth-routes.js";
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
      // Consola en ruta separada, sin cambiar la portada ni la API pública.
      const adminPage = adminConsoleRoute(request);
      if (adminPage) return adminPage;
      const mirrorResponse = await mirrorRoute(request, env);
      if (mirrorResponse) return mirrorResponse;
      const previewResponse = previewRoute(request);
      if (previewResponse) return previewResponse;
      const emailResponse = await emailAuthRoute(request, env);
      if (emailResponse) return emailResponse;
      const authResponse = await authRoute(request, env);
      if (authResponse) return authResponse;
      const suggestionResponse = await suggestionRoute(request, env);
      if (suggestionResponse) return suggestionResponse;
      const mirrorWrite = await mirrorWriteRoute(request, env);
      if (mirrorWrite) return mirrorWrite;
      const mirrorData = await mirrorDataRoute(request, env);
      if (mirrorData) return mirrorData;
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
          storage: env.ASSETS ? "static-assets" : "not-configured"
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
      // Los logos originales deben subirse a Static Assets con los mismos bytes
      // ANTES del corte. No servir sustituciones visuales ni recurrir a R2.
      const logo = pathname.match(/^\/v1\/assets\/logos\/([0-9a-f-]{36}\.(?:png|jpg))$/i);
      if (logo) {
        const permitted = new Set([
          "705cc152-5de2-407a-a880-1e78ca4b30ea.png",
          "af5b256c-877b-4c9c-8d36-d00854885c4b.jpg",
          "f4978ae8-1058-43a7-b5cd-ef9b17c11843.png"
        ]);
        const filename=logo[1].toLowerCase();
        if (!permitted.has(filename)) return jsonResponse(request,{error:"No encontrado"},404);
        if (!env.ASSETS) return jsonResponse(request,{error:"Medios pendientes de despliegue"},503);
        const target=new URL(request.url);
        target.pathname="/assets/migrated-logos/"+filename;
        const response=await env.ASSETS.fetch(new Request(target,{method:"GET"}));
        if(response.status!==200)return jsonResponse(request,{error:"Logo original aún no migrado"},503);
        const mime=filename.endsWith(".png")?"image/png":"image/jpeg";
        return new Response(response.body,{status:200,headers:responseHeaders(request,{
          "Content-Type":mime,"Content-Disposition":"inline",
          "Cache-Control":"public,max-age=86400","X-Content-Type-Options":"nosniff"
        })});
      }
      // Hasta disponer del archivo de imagen original, el registro no se borra
      // ni se sustituye por una imagen de menor calidad.
      if (/^\/v1\/moments\/photos\/[0-9a-f-]{36}$/i.test(pathname))
        return jsonResponse(request,{error:"Galería todavía no migrada a medios estáticos"},503);
      return jsonResponse(request, {error: "Ruta no encontrada"}, 404);
    } catch (error) {
      console.error("Bellaquitas staging API:", error?.message || "unknown");
      return jsonResponse(request, {error: "Servicio temporalmente no disponible"}, 503);
    }
  }
};
