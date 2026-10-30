# Biblioteca e índice — Implementation Plan

Goal: ejecutar el segundo bloque autorizado, preservando la biblioteca y el acceso a fuentes.
Architecture: índice institucional transaccional en PostgreSQL, RPC paginado y compatibilidad acotada; metadatos conservadores e importación oficial existente.
Tech Stack: PostgreSQL, Next.js, TypeScript, Supabase, Pinecone y Vitest.

- [x] Crear migración `supabase/migrations/202610240001_document_search_index.sql`: normalización persistente, índices, sincronización y RPC filtrado/paginado con permisos de servidor.
- [x] Probar y conectar `lib/document-search-server.ts` y coincidencias: usar RPC v2, conservar errores reales y ordenar todas las coincidencias antes del recorte.
- [x] Mejorar `lib/search-document-metadata.ts` y vistas previas; probar familias, fechas y texto sustantivo.
- [x] Aplicar y verificar migración en ACE. Contrastar filtros con la lógica actual y probar páginas/aislamiento.
- [x] Descargar/validar e importar lote oficial identificado; auditar PDF, extracción, páginas, Pinecone y pendientes.
- [x] Ejecutar regresión, tipos, lint, compilación. Publicar selectivamente y verificar producción.

La publicación se comprueba en Vercel y navegador. Detalle de evidencias y límites: docs/importaciones/biblioteca-indice-2026-10-24.md. IVN queda pendiente de fuente primaria; las diez bases incorporadas son PDFs históricos identificados, no sustitutos de los DOCX de 2026.
