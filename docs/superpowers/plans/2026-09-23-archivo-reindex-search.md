# Reindexación y transición segura del archivo

Alcance aprobado: proteger la reindexación, mantener accesibles los documentos
durante la migración a pgvector y resolver números antes de buscar por similitud.

1. Centralizar la reserva CAS por `updated_at` antes del OCR normal; compartir
   el plazo de procesamiento activo con el worker por bloques. Reintentar desde
   la interfaz un documento por vez usando `updated_at`, con espera ante 429.
   Para documentos RAG, conservar el procesamiento por bloques.
2. Mantener Pinecone como lector predeterminado. Permitir activar pgvector con
   una variable del servidor y comprobar que no queden chunks sin embedding
   visibles para el usuario antes de cambiar de lector. Usar el año documental
   en SQL. Reutilizar los embeddings para la doble escritura.
3. Buscar candidatos por número en Supabase con JWT/RLS, validar límites
   numéricos y recuperar sus chunks antes de invocar embeddings. Conservar
   filtros de documento, propietario, oficina, materia y año.
4. Probar reservas concurrentes, documentos activos, transición incompleta,
   errores reales de BD y códigos exactos frente a números similares. Ejecutar
   pruebas del módulo y TypeScript. Documentar activación y reversión.

No aplicar SQL remoto ni cambiar variables de producción durante esta tarea.
No incluir cambios ajenos ni realizar commit/push sin solicitud.
