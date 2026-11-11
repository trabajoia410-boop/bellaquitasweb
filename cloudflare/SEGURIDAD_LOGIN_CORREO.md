# Bellaquitas Fest — revisión de seguridad del inicio de sesión por correo

**Fecha:** 11 noviembre 2026  
**Estado:** corrección candidata, **NO desplegada**, pendiente de validación en entorno aislado y revisión de arquitectura.

## Problema encontrado: diferencia de coste de cálculo en el login

En la versión desplegada (resguardada en `staging-source-2026-11-11/modules.json`) el endpoint `/v1/auth/email/login` consultaba la credencial y devolvía 401 inmediatamente si no existía. Para una cuenta existente con contraseña equivocada, ejecutaba antes seis fases sucesivas de PBKDF2.

Aunque el mensaje y el código HTTP son genéricos, este comportamiento puede permitir **enumerar direcciones registradas por diferencias de tiempo**, según la advertencia OWASP: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html

### Corrección propuesta, NO desplegada

Archivo: `cloudflare/qa-candidates/email-auth-routes.js`.

- Si no existe la cuenta, realiza el mismo cálculo de verificación con una sal ficticia de 32 bytes.
- Si existe, conserva exactamente el esquema, la sal y los datos almacenados.
- No reescribe contraseñas ni añade cuentas.
- La respuesta 401 de usuario inexistente y contraseña equivocada continúa siendo genérica.
- La prueba instrumentada confirma **6 operaciones PBKDF2 de 100.000 iteraciones** en ambos casos.
- Los controles actuales de IP/email se siguen evaluando antes del hash.

**Límite:** igualar el coste de derivación reduce la señal más importante, pero no garantiza tiempos HTTP idénticos. Las consultas de base de datos y la carga de infraestructura todavía pueden variar.

## Evidencia automatizada

- [Prueba del coste igualado y regresión de autenticación](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/42997720604)
- [Regresión completa con candidato inyectado SOLO en el runner de GitHub](https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/42997836661)

El flujo de GitHub **reconstruye la copia de código del Worker**, la modifica solo dentro del directorio efímero del runner y ejecuta pruebas. **No hace deploy, no toca usuarios, no cambia Cloudflare ni la rama `main`**.

## Riesgos todavía abiertos — bloquear el corte definitivo

1. **Registro de correo y diferencias temporales.** El endpoint de registro también responde rápidamente si detecta una dirección previamente registrada, mientras que para una nueva calcula el hash y solicita a Resend el envío del correo. El mensaje genérico reduce la filtración, pero los tiempos pueden revelar diferencias. No intentar «arreglarlo» enviando correo de confirmación a terceros o almacenando contraseñas; se requiere un diseño de cola/envío asíncrono y respuesta uniforme, probado y sujeto a límites.
2. **Hash de contraseñas no estandarizado.** El algoritmo `pbkdf2-chain6-sha256-v1` encadena seis llamadas PBKDF2 de 100.000 iteraciones. **NO es equivalente** al formato estándar PBKDF2-HMAC-SHA256 de 600.000 iteraciones y carece de análisis criptográfico independiente. OWASP recomienda algoritmos estandarizados, priorizando Argon2id y, en determinados contextos, PBKDF2-HMAC-SHA256 estándar con 600.000 iteraciones: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
3. **Coste bajo carga.** Ejecutar hash ficticio para direcciones inexistentes encarece los intentos anónimos; antes del despliegue hay que medir carga real del Worker, límites CPU, cuotas D1 y protección WAF/Turnstile para login.
4. **Compatibilidad.** No actualizar el esquema de hashes ni exigir nuevos passwords sin diseñar migración gradual compatible con cuentas y credenciales ya creadas.
5. **Prueba real.** Falta probar correo/Google en Safari iPhone, Samsung y ordenador con identidades ficticias y backend realmente aislado. Los mocks no sustituyen ese ensayo.

## Prohibiciones de despliegue

- No sustituir el Worker activo por este módulo mientras persistan puntos 1–5.
- No habilitar `STAGING_MUTATIONS` en la base que contiene perfiles originales.
- No guardar respaldos de usuarios, hashes reales, tokens o contraseñas en GitHub.
- No cambiar bellaquitas.fr, sus vídeos, sus traducciones o su DNS durante la auditoría.

**Conclusión:** candidato técnico y pruebas aisladas preparados; vulnerabilidad de enumeración por diferencia computacional del login mitigada a nivel de código en el candidato, **no corregida todavía en el Worker desplegado**.
