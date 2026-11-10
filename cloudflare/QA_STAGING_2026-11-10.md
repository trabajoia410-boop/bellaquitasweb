# Bellaquitas Fest — verificación sin afectar producción

Fecha: 10 noviembre 2026.

## Reconciliación de base de datos
Comparación entre Supabase original y D1 de Cloudflare tras copia de
datos (consultas de solo lectura en Supabase):

| Indicador | Supabase | Cloudflare D1 |
| --- | ---: | ---: |
| Perfiles | 6 | 6 |
| Saldo de puntos | 1.999.998 | 1.999.998 |
| Puntos históricos | 1.999.998 | 1.999.998 |
| Visitas | 0 | 0 |
| Identidades Google | 6 | 6 |
| Movimientos | 2 | 2 |
| Cambios administrativos | 3 | 3 |

Las seis identidades tienen formato Google Subject compatible. Ninguna
de las seis cuentas tiene una contraseña propia almacenada en Supabase.

## Pruebas con datos ficticios en D1
Se crearon temporalmente tres perfiles con identificadores
`00000000-0000-4000-8000-00000000f00[1-3]`, un premio y un canje
de prueba, únicamente en D1 staging.

- ✅ Primera visita ficticia: +10 puntos / +1 visita.
- ✅ Segunda visita el mismo día: bloqueada por índice único.
- ✅ Canje ficticio: descuento exacto de 20 puntos mediante trigger.
- ✅ Validación del canje: sin segundo descuento.
- ✅ Modificación administrativa: aplicada y auditada dentro de D1.
- ✅ Todos los registros ficticios eliminados.
- ✅ Tras limpiar, permanecen 6 perfiles, 1.999.998 puntos y 0 visitas.

## Prueba HTTP
- ✅ GET /health: HTTP 200, `database=connected`, `storage=configured`
  verificado usando el navegador remoto de Cloudflare.
- ⏳ Las demás rutas HTTP no están verificadas: Cloudflare Browser
  Rendering devolvió HTTP 429 (límite temporal). No tratarlas como éxito.

## Controles activos
- El endpoint público no tiene operaciones de escritura habilitadas.
- Las rutas privadas requieren cookie de sesión validada y permisos
  del servidor; aún no se han configurado credenciales OAuth.
- `STAGING_MUTATIONS=disabled`, `ALLOW_NEW_ACCOUNTS=no`.
- El bucket R2 `bellaquitas-media-staging` permanece privado.
- La web de producción sigue usando Supabase.

## Bloqueos antes del corte definitivo
- Credenciales Google OAuth nuevas para Worker, almacenadas como secrets.
- Servicio verificable de correo para alta/restablecimiento con contraseña.
- Revisión y activación de la ruta del mismo origen en el dominio final.
- Copia verificada de los tres logos de Supabase Storage a R2.
- Pruebas HTTP completas, navegador móvil, perfil administrador y QR.
- Reconciliación final de datos tras congelar escrituras antes del corte.
