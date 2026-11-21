# Bellaquitas Fest — plan de publicación reversible (preparado 16/11/2026)

> **NO EJECUTAR TODAVÍA.** La publicación definitiva en `bellaquitas.fr` sigue bloqueada por `cloudflare/release-gates-2026-11-15.json`. Este archivo es una planificación, no una aprobación ni una solicitud de cambiar DNS.

## Inventario verificado

- Rama técnica exclusiva `migracion/fase5-segura-20261114`; PR #3 en borrador; no mezclar con `main` por accidente.
- API y administración de pruebas `bellaquitas-api-staging.bellaquitas-fest-410.workers.dev` con D1 `bellaquitas-staging`. Acceso al panel `/administracion/` en pestaña separada.
- Medios originales en `bellaquitas-media-qa` (Workers Static Assets); cinco MP4 con HTTP Range 206 y tres logos verificados. No depender de R2.
- D1 `bellaquitas-origen-recuperacion-20261116` aislada en jurisdicción EU: exactamente seis perfiles de origen, seis identidades Google, 14 registros públicos, 1.999.998 puntos actuales/históricos y cero visitas, 17 índices, cinco triggers.
- D1 staging: siete perfiles (sexto + uno de pruebas), dos administradores y los mismos puntos/visitas; política documentada para no destruir esa séptima cuenta de staging.
- La base original y la web pública permanecen intactas.

## PRECONDICIONES OBLIGATORIAS

1. Completar los controles estrictos del registro de 16 gates: **ningún cambio de producción** si falta un gate o firma expresa.
2. Dos administradores reales autenticados en Cloudflare y reautenticación del panel; crear email/contraseña solo mediante vinculación y verificación privada de cada propietario; **no inventar ni importar contraseñas**, ni reutilizar las claves de la plataforma antigua.
3. Copia del origen completa y restaurable, cifrada con nueva clave que no se haya compartido en chats; conservarla fuera de GitHub.
4. Comparación de datos inmediatamente antes del cambio: últimos usuarios, puntos, visitas, canjes, eventos, identidad Google, correo vinculado, y nueva actividad entre extracción y corte. Nunca sobrescribir puntos/roles sin reconciliación.
5. QA móvil y diseño ES/FR. Los vídeos en iPhone físico y control real en dominio final quedaron acordados para **después** de publicar; requieren ventana de rollback y observación supervisada sin modificar puntos durante pruebas.
6. Comprobar límites del plan gratuito y capacidad de Workers Static Assets/D1 con demanda esperada. Sin R2 y sin proveedor anterior para hosting final.

## Ejecución controlada de fase 6 (solo tras aprobar gates)

1. Registrar hora, versión Git, hash de manifest de medios, nombre D1 y estado del sitio actual.
2. Crear **backup puntual de Cloudflare destino** y un export del origen actual; comparar recuentos y valores de conservación antes de dar servicio.
3. Poner en pausa solo las operaciones **mutables** durante la copia final con aviso al personal; no borrar perfiles ni permitir pruebas que alteren contadores.
4. Conciliar delta de cuentas y eventos; preservar los dos perfiles admin, Google subject y sesión; mantener séptima cuenta verificada de staging conforme a la política aprobada, evitando duplicar 6 usuarios existentes.
5. Publicar Worker/Static Assets probado. Definir binding D1 de producción **diferente** de staging; configurar dominios, Google OAuth y remitente email sin mostrar secretos; probar Health/HTTPS/CORS/CSP en ruta previa.
6. Preparar cambio DNS desde el proveedor autorizado; cambiar a `bellaquitas.fr` solo cuando la versión, el backend y el certificado estén validados y se autorice el corte.
7. Hacer pruebas de lectura/no destructivas de eventos, puntos, tarjeta QR, panel y ES/FR; administrar pruebas de puerta con datos sintéticos en entorno aislado.
8. Monitorizar errores, medias móviles, OAuth y correo de recuperación. Revisar iPhone físico en la web final conforme a la decisión del propietario.

## Rollback

- Conservar los registros DNS anteriores, versión anterior de Worker, copia inmutable de datos y respaldo de entorno original.
- Si se detectan errores graves de vídeo, sesión, QR, privilegios o paridad, **detener escrituras** y restaurar versión anterior del frontend / Worker. Revertir DNS al estado guardado si procede.
- **Nunca** asumir que el rollback de código revierte una D1: cualquier cambio en usuarios/puntos debe analizarse y reconciliarse por separado antes de devolver servicio.
- No borrar staging, la restauración aislada ni origen antiguo hasta comprobar integridad y funcionamiento real y completar retención segura.

## Restricciones

- Ninguna clave, email personal, CSV de producción o archivo cifrado privado en el repositorio.
- No cambiar ni borrar R2 (ya retirado); no reactivar proveedor original como alojamiento futuro.
- No se afirma compatibilidad iPhone física ni dos sesiones admin reales hasta tener evidencia.
- `main`, `bellaquitas.fr`, Hostinger/DNS y usuarios reales permanecen inalterados en fase 5.
