# Seguridad de Bellaquitas Fest — auditoría del 4/11/2026

Esta guía documenta las medidas aplicadas y las pendientes. **No existe una garantía de cero vulnerabilidades ni de disponibilidad ante todo ataque DDoS.** No se realizaron pruebas de intrusión sobre usuarios reales.

## Protecciones implementadas

- Supabase: RLS activo en las 9 tablas públicas; permisos por rol para datos de socios y para editar eventos, premios, promociones y contenido.
- El usuario anónimo ya **no puede ejecutar `public.is_admin()`**. La lectura de catálogo se separó de la lectura administrativa mediante políticas distintas. Ver `SEGURIDAD_SUPABASE_RLS.sql`.
- Funciones de puntos, roles y canjes: validan autorización del lado del servidor; los cambios de socios dejan registro de auditoría. El lector QR impide validarse a sí mismo.
- Sin claves secretas en el frontend: `config.js` únicamente contiene URL de Supabase y clave pública publicable.
- **GitHub Pages:** el archivo `index.html` incluye una política CSP mediante `<meta http-equiv="Content-Security-Policy">`, para restringir scripts externos, conexiones y recursos, y una política de referencias `no-referrer`. GitHub Pages **no permite establecer cabeceras HTTP personalizadas** desde el repositorio, por lo que esta CSP no reemplaza protecciones de cabecera como `frame-ancestors`, `X-Frame-Options`, `Strict-Transport-Security` o `Permissions-Policy`. Esas protecciones requerirían infraestructura adicional o un proxy compatible.
- Librería Supabase del navegador fijada a una versión concreta (`@supabase/supabase-js@2.118.0`) para evitar saltos inesperados del CDN.
- Sin `eval`, `document.write` ni manejadores HTML `onclick` detectados en el código principal. Los valores dinámicos se escapan antes de mostrarse como HTML. Esto no sustituye pruebas de penetración.
- La PWA conserva el historial de caché estática, pero **no guarda respuestas con cuentas ni datos privados**.

## Controles todavía pendientes (requieren panel de los servicios)

1. **Supabase → Authentication → Bot and Abuse Protection**: configurar Cloudflare Turnstile o hCaptcha tanto en Supabase como en los formularios de la web. No basta con encender el interruptor sin enviar tokens CAPTCHA desde el navegador.
2. **Supabase → Authentication → Rate Limits**: revisar los límites de registro, inicio de sesión, recuperación y verificación. Supabase ya aplica límites predeterminados. Nunca insertar una clave de servicio en el navegador.
3. **Supabase → Authentication → Security and Protection**: aumentar la longitud mínima de contraseñas (al menos 12 caracteres para nuevos registros) y valorar MFA para administradores. La detección de contraseñas filtradas aparece como desactivada; según la documentación de Supabase, está disponible en Pro y superiores, no en el plan gratuito.
4. **GitHub → Settings → Rules → Rulesets**: proteger la rama main, impedir borrados y cambios sin revisión. Activar 2FA o passkey para la cuenta propietaria de GitHub y Supabase. No se ha podido habilitar estas reglas automáticamente por permisos de la integración.
5. **GitHub Pages y Supabase**: revisar los despliegues en GitHub Actions, configurar alertas y límites de consumo en Supabase y conservar una copia de seguridad. GitHub Pages es alojamiento estático, no un firewall administrable para las API de Supabase. El despliegue debe verificarse en la URL oficial de GitHub Pages.
6. **Copias y recuperación**: conservar exportaciones cifradas y fuera de GitHub de los datos de Supabase, habilitar alertas de consumo y documentar cómo restaurar un despliegue anterior. No subir copias con datos de socios al repositorio público.

## Verificación y riesgos residuales

- Auditor Supabase: queda el aviso de funciones `SECURITY DEFINER` ejecutables por usuarios autenticados. Sus funciones actuales validan roles internamente, pero cualquier cambio futuro en ellas requiere revisión específica.
- Auditor Supabase: queda el aviso de contraseñas filtradas desactivado.
- No hay auditoría externa independiente, escaneo dinámico con sesión real, prueba DDoS ni prueba de penetración destructiva.
- `esm.sh` sigue siendo un proveedor externo para la biblioteca de Supabase; tener la versión fijada reduce cambios inesperados pero no elimina el riesgo de cadena de suministro.
- Verificar desde GitHub Pages que la CSP de la etiqueta `<meta>` no bloquea el inicio de sesión, Google, el lector QR ni el editor visual. Las cabeceras de seguridad HTTP no pueden configurarse desde el repositorio de GitHub Pages; no atribuirle protecciones de otro proveedor.

## Si ocurre un incidente

Suspender accesos afectados, revocar sesiones en Supabase, rotar credenciales **secretas** comprometidas (nunca publicar las nuevas), revisar los registros de cambios de socios, restaurar un despliegue conocido y contactar con el soporte de los proveedores. Mantener el repositorio público sin secretos.

## Auditoría adicional de puerta y canjes

- Se han añadido las columnas `activity.staff_id` y `redemptions.validated_by` para conocer qué cuenta de personal validó cada visita o premio futuro.
- El personal no puede aprobar su propio canje, de la misma forma que no puede validar una visita en su propia tarjeta.
- Ambas operaciones siguen protegidas mediante funciones de Supabase que comprueban `auth.uid()` y `is_staff()`; el rol anónimo no tiene permiso para ejecutarlas.
- El cambio no altera actividades ni canjes anteriores; los registros anteriores no tienen necesariamente el identificador del empleado responsable.
- Script SQL reproducible: `SEGURIDAD_AUDITORIA_PUERTA.sql`.
