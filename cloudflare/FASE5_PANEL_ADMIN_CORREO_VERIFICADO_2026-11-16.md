# Bellaquitas Fest — actualización real de panel admin ES/FR y vinculación de contraseña (16/11/2026)

**Ámbito:** Cloudflare staging exclusivamente, dominio público `bellaquitas.fr` intacto, PR #3 en borrador.

## Diferencia detectada y resuelta
- La prueba real en Safari simulado de `/administracion/` detectó que el Worker publicado **no incluía todavía** el selector ES/FR (`#bq-admin-language`), aunque el archivo GitHub `cloudflare/admin-console.js` sí lo tenía.
- Se configuró un despliegue manual **Workers Builds conectado al repo `trabajoia410-boop/bellaquitasweb` en rama `migracion/fase5-segura-20261114`**; nunca dispara cambios en `main`.
- Configuración `cloudflare/wrangler-api-staging.jsonc`: solo Worker `bellaquitas-api-staging`, D1 staging original, binding de vídeo original, misma fecha de compatibilidad; `keep_vars=true` para preservar variables ya existentes, secretos preservados por Wrangler.
- Compilación/despliegue `1eb0e0b2-50db-4511-88d2-634911b55ca3` **SUCCESS**, versión `efdf4284-f79d-407a-8614-620d556b5847`, con **16 bindings originales conservados**.
- Se ejecutó nuevamente la auditoría real de navegador ES/FR `https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43805946182`: **SUCCESS, intento 2**. La auditoría HTTPS de endpoints, reautenticación anónima, CSP, espejo y medios también pasó `https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43806655495` intento 2.
- La **versión previa `efbaa67c-acd6-4d38-beb8-d4567212402e` permanece disponible para rollback** si fuera necesario.

## Email/contraseña para las DOS cuentas existentes
- Ambas cuentas existentes tienen Google vinculado. Para no duplicar perfiles, la API implementa un **enlace al mismo perfil**, no un registro nuevo.
- La batería `cloudflare/test-admin-email-link.mjs` ya prueba con **dos administradores ficticios**: un correo verificado por cada uno, contraseñas separadas, tokens caducables no intercambiables, sesiones revocadas y puntos/roles intactos.
- Configuración de staging **`ADMIN_EMAIL_LINK_ENABLED=yes`** añadida como ÚNICA variable nueva en Wrangler; no incluye credenciales, identificadores personales ni contraseñas.
- Segundo despliegue manual `c179d627-589f-4336-bd00-e5b010b1f3fa` **SUCCESS**, versión `c608e3e6-2157-43dc-8807-0b6944352458`.
- Cloudflare API confirmó los 17 bindings y preservación de **cinco secretos**, D1, service binding, `STAGING_MUTATIONS=disabled`, `ALLOW_NEW_ACCOUNTS=no`, `EMAIL_REGISTRATION_ENABLED=no`; la API de correos administrativos solo se activa con **Google + reautenticación administrativa** y verificación del correo.
- GitHub Actions [QA de cierre de registros y bloqueo de anonimato](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43807285506) SUCCESS: el anónimo obtiene 401 si intenta vincular un email, no se envían cookies de sesión ni se crean usuarios.
- Consulta de **solo lectura** a D1 tras despliegue: **7 perfiles**, **2 admins**, **1.999.998 puntos disponibles**, **0 visitas** y **0 credenciales de correo aún añadidas a los admins**. No se alteraron cuentas reales.

## Qué deben hacer las personas administradoras (sin proporcionar contraseñas al asistente)
Cada una de las dos cuentas debe **autenticar de verdad** en:
`https://bellaquitas-api-staging.bellaquitas-fest-410.workers.dev/administracion/`

1. Abrir el enlace en una **nueva pestaña**, entrar con la identidad **Google ya vinculada**; se pide reautenticación específica del panel.
2. Abrir pestaña **Seguridad**, rellenar el **correo controlado por ese administrador** y crear contraseña nueva de 12 a 128 caracteres (no reutilizar y **no escribir en ChatGPT**).
3. Pulsar **Enviar correo de confirmación**, abrir el correo y confirmar el enlace temporal en ese navegador dentro de los 20 minutos.
4. El sistema conserva el mismo perfil Google y sus puntos, añade credencial email verificada, revoca sesiones previas y obliga a volver a iniciar sesión.
5. Verificar acceso por email/contraseña desde otra pestaña y revisar que no haya modificaciones de puntos, visitas o roles.
6. Repetir para **la segunda cuenta**, con su correo y clave **diferentes**.

**Nunca utilizar esta ficha como demostración de login real; hasta que lo hagan ambas personas, el control `bothRealAdminLoginsVerified` sigue FALSO.** No es una instrucción para volver a Supabase y no se toca producción.

## Protección de copias de seguridad
- Se añadieron `cloudflare/test-no-private-backup-leaks.mjs` y entradas `.gitignore`: QA rechaza claves PEM, bases locales, ZIP privados de recuperación y respaldos personales versionados.
- La ejecución en Workers Builds revisó **181 archivos Git**, 165 de texto, sin claves privadas/ZIP de backup accidentalmente compartidos.
- **No se ha rotado la clave histórica expuesta**, ni se ha obtenido copia cifrada real de origen productivo. Ambos controles mantienen `passed:false`; la copia restaurada existente solo cubre **D1 staging**.

## Estado
**10/16 controles de lanzamiento.** La disponibilidad del panel bilingüe y la función de vinculación administrativa están listas en staging; quedan los dos accesos **reales**, backup original, clave histórica, QR y reproducción física, y verificación móvil final. La rama `main` y el DNS de `bellaquitas.fr` no se han modificado.
