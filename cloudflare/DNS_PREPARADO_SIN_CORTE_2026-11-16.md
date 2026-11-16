# Bellaquitas Fest — Cloudflare DNS preparado sin corte (16/11/2026)

## Cambio realizado de manera segura
- Se creó la zona de DNS `bellaquitas.fr` en Cloudflare, cuenta actual.
- Identificador de zona: `2db206b4c20dd4a8a76692f7ddf0a70a`.
- Estado `pending`: la delegación DNS del dominio **todavía no se ha cambiado**.
- Plan confirmado por API: `Free Website`, precio `0`.
- Nameservers asignados por Cloudflare: `donald.ns.cloudflare.com` y `tricia.ns.cloudflare.com`.
- Se pidió el escaneo DNS de Cloudflare, que importó **9 registros**: 4 A (GitHub Pages), 1 CNAME (`www` a GitHub Pages), 1 MX (enrutamiento de envío Resend/Amazon SES) y 3 TXT (Search Console, DKIM y SPF).
- **No reconfigurar DNS del registrador ni conectar el dominio al Worker aún.** Los registros importados sirven para preparar el cambio, no garantizan integridad de todos los subdominios que pudiera tener el propietario.

## Pasos técnicos previos al corte
1. Hacer inventario final de los DNS publicados en Hostinger y contrastarlo contra los 9 importados. Conservar también registros no detectados (CAA, AAAA, subdominios o correo si existen).
2. Recuperar y cifrar backup integral actualizado de usuarios/auth/perfiles/actividad y restaurarlo sin errores, con clave fuera del chat.
3. Conciliar cambios de origen ↔ D1; mantener séptima cuenta verificada de staging y dos administradores sin duplicar los seis originales.
4. Preparar Worker final distinto de staging y una D1 de producción separada, con permisos y dominio correcto. El Worker `bellaquitasweb` existente no tiene bindings D1 ni credenciales; NO apuntar el dominio a él como si fuera API funcional.
5. Validar endpoints, OAuth con hostname de producción y recuperación de contraseña sin usar claves reales en el repositorio.
6. Solo con todos los gates prepublicación aprobados y el dominio listo, ejecutar un cambio de nameservers reversible siguiendo el plan del registrador.

## QA del propietario pospublicación
Por decisión explícita del propietario, **la prueba personal** de reproducción iPhone/Samsung, QR/puerta y revisión visual final ES/FR se realizará **después** de la publicación. No marcar estas pruebas como aprobadas antes de ejecutarlas. La seguridad previa de los datos no se aplaza.

## Plan de vuelta atrás
Conservar en lugar privado la configuración anterior de Hostinger, versión de código, copia real cifrada, comprobantes de integridad y configuración previa del Worker. DNS/code rollback no implica rollback de D1; reconciliar cualquier mutación antes de revertir. Nunca borrar la base antigua ni reescribir puntos para "arreglar" una comparación.

**Sitio público y usuarios al 16/11/2026:** sin cambios por esta creación. El proyecto sigue en rama de migración; PR #3 en borrador.
