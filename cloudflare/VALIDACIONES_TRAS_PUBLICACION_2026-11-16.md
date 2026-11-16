# Bellaquitas Fest — pruebas personales después de publicar
**Decisión del propietario:** 16 de noviembre de 2026.
**Rama:** `migracion/fase5-segura-20261114`.
**Producción:** sin modificar en esta preparación.

## Qué NO se le pedirá comprobar al propietario antes de publicar
Las verificaciones manuales con su dispositivo y la revisión final se harán una vez que el nuevo sitio esté publicado en `bellaquitas.fr`. No presentarlas como realizadas anticipadamente:

1. Reproducción/encuadre de vídeo en **iPhone físico** y Android físico.
2. Cámara, tarjeta QR y control de puerta en dispositivo real y dominio final, con prueba no destructiva.
3. Revisión visual final de menús, panel, idioma ES/FR y contenido dinámico desde dispositivos reales.

Estas tres categorías permanecen con `passed:false` hasta que haya evidencia real pospublicación. Los tests con WebKit, Chromium y 206 permiten preparar la publicación, pero NO equivalen a estas validaciones humanas.

## Qué NO se puede posponer sin poner en riesgo a los usuarios
La nueva política `release-policy.mjs` separa esas tres comprobaciones de las otras **13 condiciones previas**. Publicar sigue bloqueado si falta cualquiera de las condiciones previas o la autorización explícita de producción.

En particular:
- Copia **real, actual y completa** del sistema origen (incluidas identidades de acceso), cifrada con clave privada nueva, restaurable y conciliada. El respaldo de ocho CSV recuperados, aunque verificado, no incluye toda la autenticación original.
- Rotación de la antigua clave de backup expuesta y custodia segura de clave y copia por separado fuera del chat y de GitHub.
- Comprobar que ambos administradores podrán iniciar sesión de manera legítima en la autenticación final, sin suplantar sesiones ni duplicar perfiles. Puede hacerse por enlace verificado privado. Nunca solicitar contraseñas al usuario en el chat.
- Conciliar altas y cambios de puntos/visitas entre el último respaldo de origen y D1; bloquear si hay divergencias sin resolver.
- Mantener los MP4 originales sin recomprimir y sin R2; medios y panel funcionando en entorno aislado.
- Tener zona/domino y DNS con ruta reversible, certificado TLS y un rollback probado. No crear una cuenta de pago.
- Puesta en marcha con observación técnica y capacidad de detener escrituras ante errores críticos.

## Estado verificado sin manipular datos (16/11/2026)
Cuenta Cloudflare leída mediante API:
- `bellaquitas-staging`: 7 perfiles, 2 administradores, 1.999.998 puntos actuales, 1.999.998 históricos, 0 visitas; `foreign_key_check` sin filas.
- `bellaquitas-origen-recuperacion-20261116`: 6 perfiles, 2 administradores, mismos puntos y visitas; `foreign_key_check` sin filas.
- 7 Workers, 6 D1, 0 proyectos Pages, 0 Worker Domains, **sin zona activa para bellaquitas.fr**.
- Sin cambios en datos, DNS, credenciales, rama `main` ni dominio.

**Próxima condición operativa:** terminar los respaldos completos, credenciales y DNS antes de realizar el corte. La promesa de no exigir pruebas físicas al propietario antes del corte NO significa permitir un corte con riesgo de pérdida de cuentas o puntos.

## Cómo comprobar el candado de publicación
```bash
node cloudflare/test-release-gates.mjs
node cloudflare/check-release-gates.mjs --assert-blocked
```
La simulación permite `readyForControlledPublication:true` con solo las **tres pruebas pospublicación pendientes** *si y solo si* el resto está aprobado y hay autorización final explícita. El estado real sigue bloqueado mientras falten pruebas previas.

Tras publicar: acompañar la prueba iPhone/Samsung, accesos de administradores, controles QR/puerta y edición ES/FR; si algo falla, aplicar recuperación sin reescribir puntos/visitas.
