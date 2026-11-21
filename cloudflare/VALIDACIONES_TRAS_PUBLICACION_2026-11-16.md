# Bellaquitas Fest — pruebas personales después de publicar

**Decisión del propietario:** 16 de noviembre de 2026. No solicitar pruebas manuales de la web antes de terminar la migración. **Rama exclusiva:** `migracion/fase5-segura-20261114`.

## Verificaciones PERSONALES aplazadas a la nueva web publicada
1. Los **dos inicios de sesión reales de administrador** en la pestaña independiente `/administracion/`, reautenticación y vinculación segura de email/contraseña sin duplicar perfiles.
2. Reproducción, calidad y encuadre de vídeo en iPhone y Android físicos.
3. Cámara, QR y control de puerta desde dispositivo físico, sin modificar contadores reales durante pruebas.
4. Revisión completa del diseño, editor, traducciones ES/FR y contenido dinámico en la web final.

Estas cuatro condiciones permanecen `passed:false` en `release-gates-2026-11-15.json`; no fingir que la simulación del navegador sustituye los dispositivos o credenciales personales.

## Condiciones TÉCNICAS que siguen siendo previas y obligatorias
- El respaldo de ocho CSV **ya fue recuperado, cifrado y restaurado** el 16/11; no repetirlo ni solicitar los archivos de nuevo. Su alcance es datos públicos, perfiles, puntos y vínculos Google; no contiene contraseñas ni una exportación integral de autenticación. Acreditar recuperación de accesos por nueva identidad y la existencia de un respaldo privado suficiente para volver atrás.
- Rotación y custodia segura de la antigua clave de respaldo, que se entregó a través de ChatGPT; no volver a poner el secreto en un repositorio o una conversación. La rotación todavía no está certificada fuera del chat.
- **Probar técnicamente** OAuth (incluido anti-CSRF), recuperación/vinculación de correo, permisos, seguridad y editor con usuarios sintéticos en QA. Eso sí se hace antes, sin pedir contraseñas a nadie.
- Preservar el séptimo perfil con correo verificado, los seis originales, los dos roles de administrador, puntos/visitas y cambios tardíos. No importar saldos de una copia antigua sin comparar el delta final.
- Disponer de la D1 de producción cargada, su Worker con rutas y autenticación precomprobadas, medios originales sin R2, DNS revisado, TLS y reversión probada.
- Obtener autorización deliberada de producción después de pasar estas condiciones.

El software impide publicar si falta alguno de esos elementos técnicos. Los accesos reales se verifican después del cambio, tal y como solicita el propietario.

## Estado Cloudflare verificado el 16/11
- Origen aislado: 6 perfiles originales, 6 Google, 2 administradores y 1.999.998 puntos.
- Staging: 7 perfiles, 2 administradores, mismos puntos/visitas, una identidad email verificada.
- **Nueva D1 independiente:** `bellaquitas-produccion-preparada-20261116` (jurisdicción EU), con esquema idéntico y una **primera copia de 23 filas en 14 tablas**; siete perfiles, dos administradores, 1.999.998 puntos, 0 visitas, cero sesiones antiguas y cero errores FK. Aún NO conectada a la web pública. Informe: `cloudflare/PREPRODUCCION_SEGURA_2026-11-16.md`.
- Cloudflare DNS para `bellaquitas.fr`: zona Free creada en estado `pending`, nueve registros recuperados; los servidores NS de Hostinger NO se han cambiado.
- GitHub `main`, dominio y datos originales: **sin cambios**.

## Candado automatizado
```sh
node cloudflare/test-preproduction-config.mjs
node cloudflare/test-release-gates.mjs
node cloudflare/check-release-gates.mjs --assert-blocked
```
El gate solo admite publicación controlada si todos los controles técnicos y la preparación REAL del destino están completos y se ha dado autorización final. Las cuatro pruebas del propietario pueden permanecer pendientes hasta después de publicar, pero no se borran ni se aprueban anticipadamente.

**No hace falta PowerShell ni repetir pruebas manuales por ahora.**
