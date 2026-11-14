# Construcción segura de recursos estáticos sin R2
Ejecutar desde la raíz del repositorio:

    node cloudflare/build-static-assets.mjs

Esto construye cloudflare/dist-static/assets/ copiando solo el inventario verificado. Los archivos MP4, logos y recursos no se transcodifican ni se cambian; cada byte y cada SHA-1 Git blob se comprueban. La carpeta de salida NO debe contener archivos de configuración, credenciales, SQL ni todo el repositorio.

El Worker de la rama espera una vinculación ASSETS con raíz cloudflare/dist-static, y devuelve los medios /assets/<nombre>. Esto todavía NO ha sido desplegado.

Antes del despliegue de pruebas se necesita:
- confirmar que el logo original referenciado en D1 por UUID tiene bytes idénticos (quedan tres assets externos no disponibles en Git);
- configurar la vinculación ASSETS sin habilitar R2;
- comprobar las solicitudes Range 206 y audio/video iOS;
- completar la reautenticación administrativa y la migración 0007 en una copia aislada;
- confirmar que DNS y la rama main siguen intactos.
