# Bellaquitas Fest — conciliación del socio exclusivo de Cloudflare staging

**Fecha:** 15 de noviembre de 2026. **Ámbito:** solo Cloudflare D1 staging, nueva restauración D1 aislada, esquema y controles de lanzamiento. **Ninguna fila se ha eliminado, añadido o modificado.** No se consultó de nuevo el proveedor original.

## Qué ha ocurrido

La carga inicial a D1 staging está documentada en la tabla `migration_audit` el **10/11/2026 a las 21:20:31 (UTC)**, con seis perfiles de origen y seis identidades de Google. La comparación con la base de producción en revisiones anteriores encontró seis perfiles idénticos.

En una revisión únicamente de lectura se identificó **un séptimo perfil** que no tiene identidad Google vinculada. Fecha de creación en D1: **10/11/2026 a las 23:53:05 (UTC)**, unas dos horas y media después de la carga inicial. Por tanto, es **posterior a la importación** registrada, aunque el historial no demuestra quién creó la cuenta.

### Estado y relaciones del perfil extra (sin identificadores privados)

| Atributo | Resultado |
|---|---|
| Número de perfiles adicionales sin Google | 1 |
| Rol | `socio` |
| Puntos / puntos históricos / visitas | 0 / 0 / 0 |
| Identidades email | 1 |
| Credenciales email verificadas | 1 |
| Sesiones actuales / activas | 0 / 0 |
| Registros de actividad, canjes, auditoría admin | 0 |
| Sesiones admin reforzadas | 0 |

La auditoría recorrió **las 22 tablas y 44 filas** actuales de staging buscando referencias exactas y embebidas al ID de este perfil, sin copiarlo ni mostrarlo. Las únicas referencias fueron en **`profiles`, `auth_identity_links`, `auth_email_credentials`**; ninguna fila de otro sistema lo referencia.

**Conclusión:** La ficha es independiente y no tiene actividad/puntos, pero conserva **correo y contraseña verificados**. NO debe tratarse como dato desechable ni borrarse automáticamente por estar fuera de los seis perfiles importados. Tampoco debe anunciarse como usuario puramente ficticio: **no se conoce el titular**.

## Política de conservación durante la migración

1. **No borrar** el perfil ni sus dos relaciones de identidad/credenciales, ni sustituir la base D1 staging por una copia que contenga solo seis perfiles.
2. **No sobrescribir credenciales de correo** al actualizar las seis identidades Google de origen; comprobar unicidad de email, `profile_id` y `provider_subject`.
3. Antes del corte definitivo, comparar el conjunto actualizado de usuarios de origen con la base final, **preservando cualquier alta legítima posterior a la importación**.
4. Mantener la cuenta adicional sin cambios hasta confirmar con el responsable del sistema si se conserva como cuenta real en el lanzamiento o se gestiona por un procedimiento autorizado de privacidad. **Nunca eliminar silenciosamente ni crear un perfil duplicado**.
5. El plan de corte debe asegurar que todas las identidades/credenciales activas presentes en D1 staging y las altas de origen posteriores al respaldo aparezcan exactamente una vez en la D1 final. No se autoriza registrar gente nueva en staging mientras se revisa esto.

## Verificación automatizada sin exposición de datos

- `cloudflare/verify-staging-restore-readonly.mjs` compara en Cloudflare por API D1 las **22 tablas**, DDL de índices y triggers, cada campo de cada fila, claves foráneas y la presencia del socio exclusivo en ambas copias.
- No escribe ni imprime IDs, emails, hashes o datos de los usuarios; usa un token Cloudflare inyectado **solo por variables de entorno de la máquina autorizada**. En GitHub no hay credenciales, por lo que la integración continua no consulta la base real.
- `cloudflare/test-staging-restore-readonly.mjs` genera administradores y socio ficticios y prueba que el programa detecta pérdida de la ficha extra, contraseña/email, puntos o trigger. Se ejecuta con las pruebas GitHub.
- La restauración aislada `bellaquitas-restore-postadmin-20261115` ya fue comprobada **manualmente en la API Cloudflare**, con 22 tablas y 44 filas idénticas, y ninguna referencia desde Workers públicos. No sustituye el respaldo externo cifrado de producción.

Ejemplo de ejecución futura en un equipo de confianza, con **un token de lectura D1** configurado localmente (no subirlo a GitHub ni pegarlo en el chat):

```bash
CLOUDFLARE_API_TOKEN="<token-local>" CLOUDFLARE_ACCOUNT_ID="<id-cuenta>" node cloudflare/verify-staging-restore-readonly.mjs
```

La salida está limitada a recuentos y nombres de tablas que difieran.

## Control de publicación

- `cloudflareExtraProfileReviewed` puede marcarse **revisado**, porque su fecha, rol, datos y relaciones se han auditado de forma exhaustiva sin alterar nada.
- Se crea explícitamente `stagingOnlyAccountCutoverPolicyApproved=false` hasta confirmar una estrategia de conservación y una conciliación final. **No permitir publicar solo porque el socio tenga 0 puntos.**
- Quedan bloqueadas por separado la rotación de la clave antigua, el respaldo externo de producción, accesos reales de administradores y los recursos multimedia/móvil/QR.

**Copia y dominio público:** sin modificaciones. La PR #3 sigue en borrador; el usuario pidió evitar cuotas y cambios de diseño.
