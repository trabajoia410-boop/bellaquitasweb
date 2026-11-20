// Prueba offline de la API pública de staging sin vinculación R2.
// El archivo real se carga sin llamadas externas; los módulos de autenticación
// se sustituyen solo dentro de esta prueba, no en el código desplegado.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./bellaquitas-api-staging.js", import.meta.url), "utf8");
const stripped = source.replace(/^import \{[^}]+\} from "[^"]+";\r?\n/gm, "");
assert.equal((source.match(/^import \{[^}]+\} from "[^"]+";/gm) || []).length, 3);
const mockRoutes = [
  "const authRoute = () => null;",
  "const protectedRoute = () => null;",
  "const clerkReadOnlyRoute = () => null;"
].join("\n");
const moduleUrl = "data:text/javascript;base64," +
  Buffer.from(mockRoutes + "\n" + stripped).toString("base64");
const api = (await import(moduleUrl)).default;
const base = "https://bellaquitas-api-staging.bellaquitas-fest-410.workers.dev";
const allowed = "705cc152-5de2-407a-a880-1e78ca4b30ea.png";
const request = path => new Request(base + path);

test("Una imagen permitida devuelve 404 si R2 está eliminado, sin excepción 503", async () => {
  const response = await api.fetch(request("/v1/assets/logos/" + allowed), {});
  assert.equal(response.status, 404);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  const body = await response.json();
  assert.equal(body.error, "Imagen no encontrada");
});

test("Las rutas de logos no enumeradas no acceden al almacenamiento", async () => {
  let calls = 0;
  const response = await api.fetch(
    request("/v1/assets/logos/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.png"),
    { MEDIA: { async get() { calls++; return null; } } }
  );
  assert.equal(response.status, 404);
  assert.equal(calls, 0);
});

test("Si una imagen permitida está presente, conserva su contenido y tipo", async () => {
  let key = "";
  const response = await api.fetch(request("/v1/assets/logos/" + allowed), {
    MEDIA: {
      async get(k) {
        key = k;
        return { body: "imagen-qa", httpMetadata: { contentType: "image/png" } };
      }
    }
  });
  assert.equal(key, "logos/" + allowed);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/png");
  assert.equal(await response.text(), "imagen-qa");
});

test("La ruta de salud no simula que R2 siga activo", async () => {
  const response = await api.fetch(request("/health"), {
    DB: { prepare() { return { async first() { return { ok: 1 }; } }; } }
  });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.status, "ok");
  assert.equal(data.storage, "unavailable");
});

test("No se consulta D1 por fotografías cuando el almacenamiento fue retirado", async () => {
  let queries = 0;
  const response = await api.fetch(
    request("/v1/moments/photos/00000000-0000-0000-0000-000000000000"),
    { DB: { prepare() { queries++; throw Error("D1 no debe consultarse"); } } }
  );
  assert.equal(response.status, 404);
  assert.equal(queries, 0);
});
