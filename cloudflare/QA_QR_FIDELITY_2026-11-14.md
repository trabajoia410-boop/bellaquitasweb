# Bellaquitas Fest — Verificación de QR, puerta, puntos y canjes

Fecha: 14/11/2026. **Solo rama de migración; ningún perfil real editado.**

## 1. Prueba QR de extremo a extremo

Archivo: `cloudflare/test-qr-roundtrip.mjs`.

- Se carga `assets/qr-local.js` (mismo generador SVG que la tarjeta del socio).
- Se renderiza el SVG en memoria, creando una imagen RGBA con área blanca de separación y módulos negros idénticos a los del QR.
- Se decodifica con `assets/jsqr-local.js` (mismo lector de respaldo usado por el control de puerta).
- 3 códigos `MBR-` ficticios × 2 resoluciones por código.
- Verifica el contenido exacto y rechaza URLs ajenas y códigos de canje que no son tarjetas.
- Resultado: **OK en CI**, sin cámara ni red. Esto NO equivale a una prueba física en iPhone/Samsung.

## 2. API del espejo en Worker QA

Archivo: `cloudflare/test-qa-worker-http.mjs`.

- En el Worker independiente `bellaquitas-api-qa` se verificó por HTTP la entrega de
  `/espejo/assets/qr-local.js`, `/espejo/assets/jsqr-local.js` y `/espejo/`.
- Las librerías son locales, sin CDN externo; el HTML conservado usa el generador original.
- El Worker QA tiene registro, credenciales de Google/correo y cambios de usuario desactivados.
- Resultado: **OK en CI**.

## 3. Integración con reglas reales de D1

Archivo: `cloudflare/test-loyalty-door-integration.mjs`.
Esquema congelado SIN FILAS: `cloudflare/fixtures/loyalty-d1-schema.sql`.

- El fixture replica el DDL exacto de D1 staging de las tablas
  `profiles`, `activity`, `rewards`, `redemptions`,
  `admin_member_changes`, el índice de visita única diaria y 5 triggers.
- Las pruebas se ejecutan en **SQLite :memory:** con tres perfiles ficticios
  (socio, personal de puerta, administrador) y una recompensa ficticia.
- Se prueban las reglas:
  - socio no puede hacer check-in ni consultar los socios de la puerta;
  - personal de puerta no puede registrar su propia tarjeta;
  - tarjeta inexistente no altera puntos;
  - validación de visita inscribe una actividad, suma **10 puntos** y **1 visita**;
  - segunda visita el mismo día se rechaza, con rollback del lote;
  - canje con coste de **15 puntos** reduce saldo disponible pero no puntos históricos;
  - saldo insuficiente no inserta canjes ni descuenta nada;
  - empleado valida canje **solo una vez**;
  - sin segunda sesión administrativa, sin origen válido, o con mutaciones cerradas no se editan puntos;
  - con segunda sesión se puede auditar un ajuste ficticio; el admin no puede revocar su propio rol.
- Resultado: **OK en CI**. No se ha probado contra los datos de personas.

## 4. Bloqueos que se mantienen

- Reproducción de vídeos y uso de cámara (permisos, Safari iOS y Android) requieren ensayo en dispositivos.
- Los vídeos no están desplegados en Workers Static Assets; el Worker QA carece de binding `ASSETS`.
- Tres imágenes de logos referenciadas por UUID siguen sin los bytes originales verificados.
- La API R2 enumera **0 buckets** en la cuenta Cloudflare accesible, pese a existir un binding R2 antiguo en el Worker de preparación: no asumir que esos logos están disponibles allí. No usar sustitutos visuales.
- No fusionar PR #3 ni cambiar DNS mientras el backup no esté seguro, no se verifiquen los administradores reales y no exista paridad visual completa.

## 5. Comprobaciones CI

- `QA migracion Bellaquitas (sin despliegue)`: éxito (run 43639306244).
- `Cloudflare migration — safe QA`: éxito (run 43639306163).
- La migración principal permanece sin fusionar y los tests usan datos temporales.
