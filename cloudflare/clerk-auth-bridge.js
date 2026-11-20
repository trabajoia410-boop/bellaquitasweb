/* Bellaquitas Fest: SOLO verificacion Clerk para una ruta de consulta.
 * Ninguna cuenta se crea o vincula por email. Ningun permiso se deriva
 * de Clerk; solo auth_clerk_links con link_method=migration_confirmed.
 * La sesion del panel administrador requiere comprobacion adicional.
 * Uso: import { clerkReadOnlyRoute } from "./clerk-auth-bridge.js";
 */
const SECURITY_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer"
};
function result(status, data) {
  return new Response(JSON.stringify(data), { status, headers: SECURITY_HEADERS });
}
function decodeUrl64(value) {
  if (typeof value !== "string" || value.length > 12000 ||
      !/^[A-Za-z0-9_-]+$/.test(value)) throw Error("Invalid base64url");
  const bytes = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bytes, c => c.charCodeAt(0));
}
function jsonPart(part) {
  return JSON.parse(new TextDecoder().decode(decodeUrl64(part)));
}
function configuration(env) {
  if (env?.CLERK_JWT_ENABLED !== "yes") return null;
  if (typeof env.CLERK_ISSUER !== "string" ||
      typeof env.CLERK_ALLOWED_ORIGIN !== "string") return null;
  let issuer, origin;
  try {
    issuer = new URL(env.CLERK_ISSUER);
    origin = new URL(env.CLERK_ALLOWED_ORIGIN);
  } catch {
    return null;
  }
  const clean = x => x.protocol === "https:" && !x.username &&
    !x.password && !x.search && !x.hash && !x.port && x.pathname === "/";
  if (!clean(issuer) || !clean(origin)) return null;
  const devHost = /^[a-z0-9-]+\.clerk\.accounts\.dev$/i.test(issuer.hostname);
  if (!devHost && issuer.hostname !== "clerk.bellaquitas.fr") return null;
  if (env.SITE_MODE === "production" &&
      (issuer.hostname !== "clerk.bellaquitas.fr" ||
       origin.origin !== "https://bellaquitas.fr")) return null;
  return {
    issuer: issuer.origin,
    origin: origin.origin,
    jwks: issuer.origin + "/.well-known/jwks.json"
  };
}
// No fiarse únicamente de Content-Length: un servidor puede omitirlo o
// transmitir un JSON excesivo por chunks. Se cancela la lectura al superar
// el límite, antes de reservar memoria o analizar un cuerpo no confiable.
const MAX_JWKS_BYTES = 65536;
async function boundedJwksJson(response) {
  const header = response.headers.get("content-length");
  if (header !== null && (!/^\d+$/.test(header) || Number(header) > MAX_JWKS_BYTES))
    return null;
  if (!response.body || typeof response.body.getReader !== "function") return null;
  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) return null;
      received += value.byteLength;
      if (received > MAX_JWKS_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

export async function verifyClerkToken(request, env, network = fetch) {
  const config = configuration(env);
  if (!config) return null;
  const bearer = request.headers.get("Authorization") || "";
  if (!/^Bearer [A-Za-z0-9._-]{60,10000}$/.test(bearer)) return null;
  const jwt = bearer.slice(7), parts = jwt.split(".");
  if (parts.length !== 3) return null;
  let header, claims;
  try {
    header = jsonPart(parts[0]);
    claims = jsonPart(parts[1]);
  } catch {
    return null;
  }
  if (header?.alg !== "RS256" || (header.typ && header.typ !== "JWT") ||
      !/^[A-Za-z0-9_-]{5,128}$/.test(header.kid || "") ||
      header.jwk || header.jku || header.x5u) return null;
  const now = Math.floor(Date.now() / 1000);
  if (claims?.iss !== config.issuer || claims.azp !== config.origin ||
      !/^user_[A-Za-z0-9]{10,128}$/.test(claims.sub || "") ||
      !/^sess_[A-Za-z0-9]{10,128}$/.test(claims.sid || "") ||
      !Number.isSafeInteger(claims.iat) ||
      !Number.isSafeInteger(claims.nbf) ||
      !Number.isSafeInteger(claims.exp) ||
      claims.nbf > now + 5 || claims.iat > now + 60 ||
      claims.exp <= now || claims.exp - claims.iat > 3600 ||
      claims.exp <= claims.iat) return null;
  try {
    const answer = await network(config.jwks, {
      headers: { Accept: "application/json" },
      cf: { cacheEverything: true, cacheTtl: 300 }
    });
    if (!answer.ok) return null;
    const data = await boundedJwksJson(answer);
    if (!Array.isArray(data?.keys) || data.keys.length > 25) return null;
    const jwk = data.keys.find(key =>
      key.kid === header.kid && key.kty === "RSA" &&
      (!key.alg || key.alg === "RS256") &&
      (!key.use || key.use === "sig") &&
      typeof key.n === "string" && typeof key.e === "string"
    );
    if (!jwk) return null;
    const publicKey = await crypto.subtle.importKey(
      "jwk",
      { kty: "RSA", n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const signatureGood = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5", publicKey, decodeUrl64(parts[2]),
      new TextEncoder().encode(parts[0] + "." + parts[1])
    );
    if (!signatureGood) return null;
  } catch {
    return null;
  }
  return { clerkUserId: claims.sub, sessionId: claims.sid };
}
export async function clerkReadOnlyRoute(request, env) {
  if (new URL(request.url).pathname !== "/v1/auth/clerk/me") return null;
  if (request.method !== "GET") return result(405, { error: "Método no permitido" });
  if (env?.CLERK_JWT_ENABLED !== "yes") {
    return result(503, { error: "Clerk todavía no está habilitado" });
  }
  const identity = await verifyClerkToken(request, env);
  if (!identity) return result(401, { authenticated: false, error: "Token inválido" });
  if (typeof env.DB?.prepare !== "function") {
    return result(503, { error: "Base de datos no disponible" });
  }
  try {
    const profile = await env.DB.prepare(
      "SELECT p.id,p.name,p.role,p.member_code,p.points,p.lifetime_points,p.visits " +
      "FROM auth_clerk_links c JOIN profiles p ON p.id=c.profile_id " +
      "WHERE c.clerk_user_id=? AND c.link_method='migration_confirmed' LIMIT 1"
    ).bind(identity.clerkUserId).first();
    if (!profile) {
      return result(403, { authenticated: false,
        error: "Identidad sin vinculación verificada" });
    }
    return result(200, { authenticated: true, profile,
      adminSessionAuthorized: false });
  } catch {
    return result(503, { error: "Vinculación no preparada" });
  }
}
