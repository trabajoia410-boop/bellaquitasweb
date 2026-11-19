# Bellaquitas Fest — fase 6: despliegue privado, seguridad de medios y medición real

**Comprobación:** 19 de noviembre de 2026.  
**Ámbito:** rama `migracion/fase5-segura-20261114`, PR #3 borrador; **sin fusión ni cambios DNS, cuentas, puntos o visitas**.

## 1. Problema y corrección verificada

El Worker API staging anterior consumía CPU excesiva al recuperar fragmentos HTTP 206 de los cinco vídeos originales, especialmente cerca del final de los MP4. Este coste arriesga el límite de CPU de **Workers Free** y las cuotas de solicitudes. No se degradan el diseño, la resolución ni el contenido.

- Se utilizó el `VIDEO_QA_PROXY` que ya existía, por **Service Binding** interno a `bellaquitas-media-qa`; únicamente para recursos MP4 públicos, ruta del espejo y modo de pruebas. Sin cookie, `Authorization`, acceso D1 ni nueva dependencia R2.
- La respuesta del vídeo original público permite `Cache-Control: public,max-age=86400`. Se elimina explícitamente `Set-Cookie` antes de producir la respuesta que puede almacenarse en caché.
- No se altera la política `no-store` de cuentas, panel administrativo, puntos, sesiones, QR ni la API.
- Las pruebas de regresión ahora inyectan una cookie sintética en el intermediario y exigen que **no salga** en el MP4 público.
- Se comprobaron de nuevo los fragmentos HTTP **206**, bytes de los vídeos originales y las respuestas HTTP de staging. Hubo una prueba antigua con expectativa `no-store` que se actualizó para evaluar la nueva política pública *solo de vídeos*.

## 2. Despliegues seguros y comprobación

**Staging:** `bellaquitas-api-staging` compilado correctamente tras activar `cloudflare/deploy-staging.trigger`. Build de corrección `cf0031ea-544c-478b-b6ce-deeb4ea85fb4`, versión `667b56f5-cb02-40ff-b1e1-88a4fa2ff0f9`, desplegada a las 09:48:22 UTC. Se conservan los secretos privados Google, Resend, Turnstile y Service Binding multimedia. `STAGING_MUTATIONS=disabled` y `ALLOW_NEW_ACCOUNTS=no`.

**Preproducción:** `bellaquitas-api-preproduccion` compilado y desplegado correctamente mediante un disparador específico de rama. Build `c5c33e9c-c0f4-4c43-8dc3-c02f5afce6fa`, versión `dc139a2e-f8c2-4d75-a04c-4a47214bfda6`, 09:53:46 UTC. Confirmado por API: `SITE_MODE=preproduction`, `PUBLISH_APPROVED=no`, `FREE_TIER_BILLING_VERIFIED=no`, `FINAL_ORIGIN_RECONCILED=no`, `BACKUP_KEY_CUSTODIED=no`; `workers.dev` y previews desactivados; **0 rutas públicas**; binding D1 de destino y broker privado de Google/Resend presentes.

**Integridad D1 de ambos entornos, solo lectura:**

| Indicador | Staging | Preproducción |
|---|---:|---:|
| Perfiles | 7 | 7 |
| Administradores | 2 | 2 |
| Puntos | 1.999.998 | 1.999.998 |
| Visitas | 0 | 0 |

## 3. CPU REAL por versión, no por promedio histórico

Cloudflare GraphQL `workersInvocationsAdaptive` tras desplegar la versión corregida de staging:

- **570 solicitudes exitosas; CPU P99 = 4,663 ms**, inferior a 10 ms en esta muestra.
- Nuevo Worker multimedia `bellaquitas-media-qa`: 401 peticiones exitosas observadas anteriormente; CPU P99 = 1,377 ms.
- Versión API antigua `55945671-...`: P99 alrededor de 137 ms con los vídeos antiguos, y versión multimedia antigua hasta 222 ms, razón de la optimización.

**No confundir P99 con máximo:** no está demostrado que todas las solicitudes estén debajo de 10 ms ni que KDF de contraseña (600.000 iteraciones), cache fría y todas las rutas de 206 puedan funcionar siempre en Workers Free. Los cuatro booleanos estrictos de `phase6CpuSafety` siguen **false**. No elevar `limits.cpu_ms` ni activar modalidad de pago.

## 4. CI y seguridad

Pruebas del repositorio al commit candidato anterior al acta: tres flujos de migración y prepublicación terminaron correctamente, incluidos controles sintéticos de secretos y cookies, HTTP 206 desde staging, seguridad del panel y navegación ES/FR con WebKit/Chromium. La publicación continúa cerrada en `cloudflare/release-policy.mjs`.

Además, en Cloudflare: zona `bellaquitas.fr` en **Free Website / pending**, cero buckets R2, cero rutas públicas. Cloudflare Build Minutes todavía no agotadas. Este inventario **no certifica facturas futuras** ni permite marcar `phase6ZeroSpend.billingAuditComplete=true`.

## 5. Pendientes SIN repetir trabajo hecho

1. No se ha podido recifrar el respaldo antiguo del 16/11: archivos localizados, pero su acceso a bytes originales y clave fue denegado por Files. No solicitar otra vez la clave RSA nueva que el propietario ya confirmó guardada. El respaldo D1 independiente del 18/11 **ya fue cifrado y restaurado**.
2. La cuenta Cloudflare aún no ha acreditado exhaustivamente ausencia de otros cargos y el cierre administrativo de la suscripción R2, aunque el uso mostrado es 0 y R2 tiene 0 buckets. No repetir fotos ya aportadas ni dar falsamente por validado Billing.
3. Validar máximo CPU y KDF con datos sintéticos antes de abrir producción; medir bajo la versión candidata.
4. En la ventana final, revalidar el delta del proveedor de origen y asegurar la copia definitiva. **No trasladar automáticamente puntos o sesiones sin esta lectura**.
5. Dominio y OAuth/Resend canónicos: solo después de cumplir los gates, delegar DNS de forma controlada; las pruebas físicas del propietario se difieren hasta después de publicar según lo acordado.

**Estado final de esta entrega:** técnica de staging y preproducción actualizada, la web pública sigue intacta, el PR permanece borrador y **no se declara la fase 6 cerrada mientras los bloqueos anteriores permanezcan**.
