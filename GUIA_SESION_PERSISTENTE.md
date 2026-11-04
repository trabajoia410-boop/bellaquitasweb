# Permanecer conectado en Bellaquitas Fest

Bellaquitas Fest utiliza **Supabase Auth** con `persistSession: true` y `autoRefreshToken: true`. Las sesiones se recuperan al recargar, cerrar/reabrir una pestaña o volver a la aplicación instalada, siempre que el navegador conserve su almacenamiento y Supabase no haya revocado la sesión.

## Uso recomendado
1. Entra desde **https://bellaquitasfest.netlify.app/** usando Safari en iPhone o Chrome en Android, y guarda esa misma web en la pantalla de inicio.
2. Inicia sesión una vez. Al regresar debería abrirse tu cuenta sin volver a escribir la contraseña.
3. En iPhone, abre directamente en Safari en lugar del navegador interno de WhatsApp, que puede usar almacenamiento separado o temporal.
4. No cambies de `bellaquitasfest.netlify.app` a `trabajoia410-boop.github.io` esperando compartir la sesión: son **orígenes distintos** y el navegador mantiene sesiones separadas.
5. La navegación privada, la limpieza de datos del sitio, el cierre de sesión o la revocación de credenciales pueden requerir una nueva autenticación.
6. Si aparece «Conectando con tu cuenta…», verifica Internet y pulsa **Reintentar**. No se borran tokens por un error temporal de red.

**Nota:** La opción «Cerrar sesión» usa `scope: 'local'`, por lo que no termina las sesiones de otros dispositivos. Nunca guardes tokens, contraseñas o claves secretas en archivos del repositorio.
