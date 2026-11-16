# Bellaquitas Fest — pruebas comunicadas por el responsable (16/11/2026)

## Declaraciones recibidas directamente
En conversación del 16/11/2026, el responsable de Bellaquitas Fest comunica:
- **Cuentas administradoras:** ha comprobado personalmente las cuentas y declara que funcionan bien.
- **Vídeos en Android:** ha probado la reproducción y la da por funcional.
- **Vídeos en iPhone:** decide expresamente **posponer la prueba** hasta que la página definitiva esté preparada/publicada; no se debe exigir que repita el ensayo antes de ello.
- **QR y control de puerta:** confirma que ambos funcionan en sus pruebas.
Estas afirmaciones son **validaciones manuales informadas por el responsable**. No son capturas, logs o pruebas técnicas que identifiquen el origen exacto utilizado, por lo que no se convertirán automáticamente en aprobaciones de producción o staging de Cloudflare.

## Comprobaciones independientes de Cloudflare (solo lectura, misma fecha)
- D1 `bellaquitas-staging` tiene **7 perfiles, 2 roles de administrador, 1.999.998 puntos y 0 visitas**.
- Cloudflare staging registra **sesiones activas de exactamente un perfil administrador** y **una sesión de reautenticación administrativa**; la base todavía **no acredita dos cuentas administradoras distintas** a través de sus registros de autenticación. Esto **no contradice** las pruebas de ambas cuentas descritas por el responsable, que pueden haber sido en otro origen o dispositivo. No se hicieron inicios de sesión simulados ni consultas con contraseñas.
- El registro automático de email de usuarios continúa cerrado y las mutaciones de puntos/visitas de staging permanecen desactivadas.
- GitHub mantiene la PR #3 en borrador; no se ha cambiado el dominio.

## Orden del trabajo restante autorizado
1. **Respaldo auténtico de datos actuales**, con prueba de restauración aislada y comparación; la copia cifrada disponible hasta ahora es únicamente de D1 staging.
2. **Rotación verificada de la clave histórica** vinculada a la copia auténtica; la herramienta offline AES-256-GCM `--rotate` ya está lista para respaldos de formato compatible, pero la clave histórica de otro formato no está rotada.
3. Revisar paridad ES/FR, diseño y seguridad antes de cortar la web pública.
4. Preparar Cloudflare/domino `bellaquitas.fr` con plan de rollback. Evitar cambios de DNS hasta recuperar los datos del origen y validar la restauración.
5. **Después de publicación:** prueba real de iPhone/ Safari, más comprobación funcional final de QR y acceso de cuentas en dominio definitivo. El responsable decidió posponer iPhone; mantener incidencia reconocida y un modo rápido de revertir vídeos si falla.

## Política sobre los 16 gates
No se marcan aprobados gates estrictos sin su prueba específica, incluso si hay validación manual positiva del responsable, **pero tampoco se solicita repetir pruebas manuales ya confirmadas**. A efectos del plan, Android, QR, puerta y experiencia manual de acceso se registran como comprobaciones realizadas por el responsable; la evidencia que falta es de alcance del *backend Cloudflare / cutover definitivo*. Este documento es el origen de esa distinción.

**Sin Supabase, sin R2, sin modificación de puntos, sin DNS ni acceso a claves personales.**
