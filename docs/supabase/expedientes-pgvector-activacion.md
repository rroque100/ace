# Activación gradual de pgvector para expedientes archivados

El lector predeterminado sigue siendo Pinecone. La aplicación escribe los
mismos embeddings en ambos destinos, con una sola generación por fragmento.
Aplicar SQL por sí solo no cambia el lector ni oculta documentos anteriores.

1. Aplicar `expedientes-archivo-pgvector.sql` en el proyecto Supabase correcto.
   Si ya se aplicó una versión anterior, volver a ejecutarla para corregir el
   filtro: el año documental es `expedientes_archivo.anio`, no el año de carga
   del fragmento. Requiere las migraciones previas del archivo y sus políticas RLS.
2. Reindexar los documentos anteriores. Los PDF normales usan Reindexar;
   los documentos RAG conservan el OCR por bloques. Para documentos RAG ya
   indexados sin embeddings, el botón Reindexar genera de nuevo el índice
   completo reutilizando la caché normal cuando está disponible.
3. Verificar con una cuenta administradora en SQL:

   ```sql
   select count(*) as total,
          count(embedding) as migrados,
          count(*) filter (where embedding is null) as pendientes
   from public.expedientes_archivo_chunks;
   ```

4. Con cero pendientes, configurar en el servidor
   `EXPEDIENTES_VECTOR_READ=pgvector` y reiniciar o volver a desplegar la aplicación.
   Probar búsqueda por contenido con un administrador y un usuario de área;
   comprobar año documental y que cada uno vea únicamente lo autorizado.
5. Para volver al lector anterior, quitar esa variable o asignarle `pinecone`.

Incluso con la opción activada, si quedan fragmentos visibles sin embedding
se consulta Pinecone para ese usuario. Si falta la columna o el RPC también
se conserva el lector anterior. Los errores reales de permisos o conexión se
propagan: no se presentan como búsquedas sin resultados.

La doble escritura mantiene Pinecone como dependencia durante esta fase y
permite revertir el lector. No borrar su índice todavía. Un cambio de modelo
de embeddings requiere reindexar todos los documentos antes de activar el lector.

Esta tarea prepara el código y el SQL; no aplica cambios a la base remota ni
a las variables de producción automáticamente.
