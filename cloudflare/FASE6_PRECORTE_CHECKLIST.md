# Bellaquitas Fest — Comprobación de preparación para la fase 6

**12/11/2026 · Estado: NO AUTORIZADO EL CORTE DE BACKEND**

La web `bellaquitas.fr` continúa en su sistema oficial. El nuevo panel de administración tipo WordPress, con acceso independiente en otra pestaña, sigue en la rama de auditoría.

## Para qué sirve

`cloudflare/phase6_readiness.py` impide **considerar listo** un corte si falta cualquier evidencia declarada de seguridad o autorización. Es una herramienta de comprobación manual que se integrará como paso previo obligatorio de cualquier futuro procedimiento de despliegue, no un mecanismo que pueda impedir por sí mismo una publicación hecha por otros medios.

**No ejecuta migraciones, no inicia sesión, no consulta cuentas, no lee contraseñas ni realiza operaciones de escritura.**

### Comprobaciones exigidas

| Área | Antes de publicar debe estar confirmado |
|---|---|
| Respaldo | Archivo privado cifrado, hash SHA-256, restauración Postgres **en entorno aislado**, restauración D1 de prueba, verificaciones de archivos Supabase Storage/R2, segunda copia comprobada, menos de 48 horas |
| Integridad | Perfiles reales en origen = perfiles en destino; **la cuenta ficticia de staging debe retirarse/excluirse**; totales de puntos y visitas iguales; idioma ES/FR y vídeos intactos |
| Autenticación | Correo+contraseña y Google probados, admins originales vinculados sin duplicados, sesión/logout correctos, viabilidad de CPU o proveedor externo aprobada **sin cargos automáticos**, comprobada en los últimos 14 días |
| Reversión | Procedimiento ensayado, backend anterior disponible, protocolo para evitar pérdidas si se generan escrituras durante una reversión, dominio/DNS preparados y diseño conservado |
| Consentimiento | Autorización **expresa y reciente** del propietario para este corte concreto; no se infiere de «continúa», «hazlo» ni de la aprobación de pruebas |

**Las pruebas físicas de Safari iPhone y Samsung no son requisito previo:** como acordó el propietario, van inmediatamente **después** de la publicación migrada, con cuentas de ensayo seguras y plan de vuelta atrás.

### Modo seguro para comprobar el bloqueo

```bash
python3 cloudflare/phase6_readiness.py --self-test
```

El ensayo usa solamente perfiles, cantidades y fechas inventados. Verifica que no se puede considerar preparado el corte si faltan copias, coinciden mal los perfiles o puntos, el login exige un plan de pago, las contraseñas admin no están listas, falla la reversión o no hay autorización del propietario.

La prueba aprobada en CI: https://github.com/trabajoia410-boop/bellaquitasweb/actions/runs/43207324961

### Uso en el momento apropiado

Con los respaldos reales ya creados y **restaurados en un entorno aislado**, se documentarán únicamente indicadores NO sensibles (fechas y recuentos agregados), **en un JSON privado fuera del repositorio**. No almacenar emails, hashes, IDs de usuarios, contraseñas, tokens, dumps ni claves en ese archivo ni subirlo a GitHub.

```bash
python3 cloudflare/phase6_readiness.py --check /carpeta-privada/evidencias.json
```

Se exige completar de forma verídica cada apartado: `backup`, `reconciliation`, `authentication`, `rollback`, `authorization`. El código de comprobación ofrece los nombres de los campos pendientes.

**Que el programa dé resultado correcto no certifica por sí solo las evidencias, ni autoriza un despliegue sin supervisión.** Todo dato de evidencia requiere revisión humana. No se permite crear un fichero ficticio para esquivar el bloqueo.

## Estado de hoy

- **Aprobado:** más de 70 comprobaciones automáticas del panel/Google y ensayos con medios y QR; herramienta de copia cifrada preparada y probada con datos sintéticos.
- **Pendiente:** backup **real** completo de Supabase, Auth, Storage, D1 y R2, más restauración Postgres en instancia aislada.
- **Pendiente:** alternativa para correo+contraseña que respete el límite de Workers Free de 10 ms CPU y cero cobros automáticos, sin cambiar roles ni duplicar cuentas. Clerk Hobby es solo candidato de investigación, no conectado.
- **Pendiente:** quitar/excluir definitivamente el perfil ficticio de staging del conjunto final antes de cumplir la igualdad de perfiles, sin tocar perfiles de socios reales.
- **Pendiente:** ensayo documentado de reversión y aprobación explícita para pasar a fase 6.

**No se ha tocado `main`, el DNS, el Worker desplegado, las cuentas, los puntos ni las visitas.**

## Enlaces

- [Plan de respaldo y corte](./PLAN_RESPALDO_Y_CORTE_SEGURO.md)
- [Panel independiente de administración](./PANEL_ADMIN_SEPARADO_FASE5.md)
- [Seguridad del hash de contraseñas](./SEGURIDAD_PASSWORD_WORKERS_FREE_2026-11-12.md)
- [Comparativa de alternativas gratuitas](./ALTERNATIVAS_LOGIN_GRATIS_FASE5.md)
