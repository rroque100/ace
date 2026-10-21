# Activar la corrección del lector de PDF

1. En el proyecto Supabase que usa ACE, aplicar `docs/supabase/archivo-publicar-indice.sql`
   después de `expediente-legajo.sql` (ya requerida por el módulo actual). La función
   solo concede ejecución al backend. No modifica documentos al instalarse.
2. Desplegar el código en Vercel. No desplegar sin la función: el código rechaza
   publicar si falta, conservando el índice existente; no hay fallback destructivo.
3. El bucket configurado debe aceptar PDF de hasta 100 MB si se desea ese máximo.
   El binario grande viaja a Storage por URL firmada, no a la función de Vercel.
   Las referencias expiran a los 30 minutos y se limitan al usuario autenticado.
   Los objetos temporales se eliminan al consumirlos. Una subida abandonada antes
   de enviar la referencia puede dejar un objeto en `archivo-temp/`; limpiar objetos
   de ese prefijo con más de dos horas como tarea de mantenimiento del bucket.
4. Validar con sesión: PDF con texto, PDF escaneado, PDF de más de 4,5 MB y documento
   largo que active el aviso de lectura parcial. Comprobar «Leer con IA», alta,
   reemplazo y reindexación. La generación anterior queda disponible hasta publicar
   la nueva. Los fallos se registran sin borrar la versión anterior.

## Validaciones locales

`npm run typecheck`

`npx vitest run tests/archivo-pdf-safety.test.ts tests/archivo-processing.test.ts tests/archivo-extract-route.test.ts tests/archivo-upload-client.test.ts tests/archivo-upload-server.test.ts tests/pdf-server.test.ts tests/expedientes-archivo.test.ts`

Después de `npm run build`: `node scripts/check-pdf-trace.mjs`.
Si se usa `NEXT_DIST_DIR`, pasar esa carpeta como argumento.

`scripts/check-archivo-index.mjs` prueba la función en PostgreSQL embebido sin acceso
a producción. Recibe la ruta a `@electric-sql/pglite/dist/index.js`, instalado en una
carpeta temporal. Verifica rollback, publicación, conflicto de versión y permisos.

## Límites intencionales

El OCR mantiene su máximo configurable (25 páginas por defecto) y el análisis
14.000 caracteres. El formulario advierte explícitamente cuando se aplica alguno.
Una caída de red al publicar puede dejar vectores preparados sin chunks vigentes;
la búsqueda los excluye. No se borran a ciegas porque el commit puede haber ocurrido.
