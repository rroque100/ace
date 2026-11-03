-- ============================================================================
-- ÍNDICE TRIGRAM PARA LA BÚSQUEDA POR PALABRAS DEL CHAT
-- ============================================================================
-- Síntoma: el chat avisaba «la búsqueda por palabras no estuvo disponible» y la
-- vía léxica devolvía error 57014 (statement timeout).
--
-- Causa: lib/chat-lexical.ts busca con `content ilike '%palabra%'`. Sin índice,
-- cada patrón recorre TODA la tabla document_chunks. Medido en producción con el
-- statement_timeout de PostgREST (~8 s): un OR con 1-3 palabras tarda 0,2-0,5 s,
-- con 4 sube a ~8 s y con 5-6 agota el tiempo. El código ya limita el OR a 3
-- palabras (MAX_TOKENS_OR) y tolera que un paso falle; este índice quita la causa
-- de fondo y permite, si se quiere, subir ese tope.
--
-- Un índice GIN con gin_trgm_ops acelera `ilike '%…%'`, incluidos los patrones con
-- comodín `_` que el chat usa para tolerar tildes («garant_a»): Postgres saca los
-- trigramas de las partes sin comodín.
--
-- CÓMO EJECUTAR (a mano, en el SQL Editor del proyecto de PRODUCCIÓN):
--   - Es el proyecto que usa https://ace-rormi.vercel.app, el de la URL en
--     NEXT_PUBLIC_SUPABASE_URL de Vercel. Compruébalo antes: hay más de un
--     proyecto Supabase en esta cuenta.
--   - CREATE INDEX normal bloquea las ESCRITURAS de document_chunks mientras se
--     construye (lecturas, no). Con ~54 000 fragmentos son segundos o pocos
--     minutos; evita hacerlo mientras se indexa un PDF. No se usa CONCURRENTLY
--     porque el SQL Editor envuelve el script en una transacción.
--   - Es idempotente: se puede volver a correr.
-- ============================================================================

create extension if not exists pg_trgm;

-- Construir el índice puede superar el timeout por defecto del editor.
set statement_timeout = 0;

create index if not exists idx_document_chunks_content_trgm
  on public.document_chunks using gin (content gin_trgm_ops);

analyze public.document_chunks;

-- Verificación: el plan debe mostrar «Bitmap Index Scan on idx_document_chunks_content_trgm»
-- y no «Seq Scan».
--   explain select id from public.document_chunks where content ilike '%garant_a%' limit 50;
