-- Migración nativa a pgvector para la Biblioteca de Expedientes Archivados.
--
-- Hasta ahora los embeddings de este módulo vivían en Pinecone (namespace
-- aparte); el texto y los metadatos ya vivían en Supabase
-- (expedientes_archivo_chunks). Esta migración agrega la columna de embedding
-- directamente en esa tabla y una función de búsqueda por similitud, para
-- dejar de depender de Pinecone en ESTE módulo — los demás (corpus legal,
-- EETT/TDR de necesidades, respuesta-antecedentes) siguen en Pinecone; esta es
-- la primera pieza migrada, a propósito acotada.
--
-- Ventajas sobre el camino anterior:
--  - El write y el search quedan en la MISMA base: la atomicidad la da la
--    transacción de Postgres, no hace falta el paso de "verificar que Pinecone
--    ya terminó de indexar" (era puro reintento por consistencia eventual
--    entre dos sistemas distintos).
--  - El scope admin/jefe/own ya lo aplica la RLS de expedientes_archivo_chunks
--    (expedientes_archivo_chunks_scoped_select, ya en producción): con
--    `security invoker`, la búsqueda semántica queda scopeada NATIVAMENTE en
--    la consulta, no por post-filtro en la aplicación (lib/expedientes-archivo-
--    search.ts sigue haciendo su post-filtro de todos modos, como defensa en
--    profundidad — no se quitó en esta migración).
--  - Borrar un expediente ya no necesita limpiar vectores aparte: al borrar la
--    fila de expedientes_archivo, el ON DELETE CASCADE de
--    expedientes_archivo_chunks se lleva también su embedding.
--
-- El código (lib/expedientes-archivo-search.ts, lib/expedientes-archivo-
-- processing.ts) sigue escribiendo Y leyendo de Pinecone EN PARALELO
-- mientras tanto: si esta función no existe todavía, la búsqueda cae sola al
-- camino de Pinecone (mismo patrón que necesidad_items_replace y
-- merge_document_metadata en este proyecto). Quitar el doble-escrito de
-- Pinecone es una limpieza aparte, DESPUÉS de confirmar que esto funciona bien
-- en producción.
--
-- Aplicar en el SQL Editor de Supabase.

begin;
create schema if not exists extensions;
create extension if not exists vector with schema extensions;
set local search_path = public, extensions;

-- 1536 dimensiones: la misma que ya usan los embeddings de este proyecto
-- (text-embedding-3-small de OpenAI, o Gemini a 1536 — ver embeddingDimensions
-- en lib/openai-server.ts). Cambiar de proveedor de embeddings sigue
-- obligando a reindexar (los espacios vectoriales no son intercambiables),
-- igual que ya pasaba con Pinecone.
alter table public.expedientes_archivo_chunks
  add column if not exists embedding vector(1536);

-- HNSW: buena relación velocidad/precisión y, a diferencia de IVFFlat, no
-- necesita filas ya cargadas para poder crearse — más simple para una tabla
-- que hoy tiene ~200 filas y va a seguir creciendo con cada subida.
create index if not exists idx_expedientes_archivo_chunks_embedding
  on public.expedientes_archivo_chunks
  using hnsw (embedding vector_cosine_ops);

-- Búsqueda por similitud, scopeada por RLS: `security invoker` hace que la
-- función corra como el usuario que llama, así que
-- expedientes_archivo_chunks_scoped_select decide qué filas puede ver
-- -admin todo, jefe su oficina, el resto solo lo suyo- DENTRO de esta misma
-- consulta.
--
-- p_document_id / p_year: mismos filtros nativos que ya se le pasaban a
-- Pinecone (SearchFilters.documentId / .year en lib/pinecone.ts).
create or replace function public.expedientes_buscar_vecinos(
  p_query_embedding vector(1536),
  p_top_k int default 8,
  p_document_id uuid default null,
  p_year int default null
) returns table (
  chunk_id uuid,
  documento_id uuid,
  chunk_index int,
  content text,
  page_start int,
  page_end int,
  metadata jsonb,
  score float
)
language sql stable security invoker set search_path = public, extensions
as $$
  select
    c.id as chunk_id,
    c.documento_id,
    c.chunk_index,
    c.content,
    c.page_start,
    c.page_end,
    c.metadata,
    1 - (c.embedding <=> p_query_embedding) as score
  from public.expedientes_archivo_chunks c
  join public.expedientes_archivo d on d.id = c.documento_id
  where c.embedding is not null
    and (p_document_id is null or c.documento_id = p_document_id)
    and (p_year is null or d.anio = p_year)
  order by c.embedding <=> p_query_embedding
  limit greatest(p_top_k, 1);
$$;

revoke all on function public.expedientes_buscar_vecinos(vector, int, uuid, int) from public, anon;
grant execute on function public.expedientes_buscar_vecinos(vector, int, uuid, int) to authenticated;

-- archivo_publicar_indice (docs/supabase/archivo-publicar-indice.sql) ahora
-- también recibe y guarda el embedding de cada chunk. `jsonb_to_recordset` no
-- soporta el tipo `vector` como campo directo, así que llega como jsonb (un
-- array de números) y se convierte a vector en el propio SELECT del INSERT.
-- Si algún chunk llega sin `embedding` (código viejo, o el LLM de embeddings
-- falló para ese texto), queda NULL — expedientes_buscar_vecinos ya filtra
-- `c.embedding is not null`, así que ese chunk simplemente no aparece en la
-- búsqueda semántica hasta que se reindexe, sin romper nada.
create or replace function public.archivo_publicar_indice(
  p_id uuid, p_base timestamptz, p_chunks jsonb, p_patch jsonb
) returns jsonb
language plpgsql security invoker set search_path = public, extensions
as $$
declare
  anterior public.expedientes_archivo;
  siguiente public.expedientes_archivo;
  viejos jsonb;
begin
  select * into anterior from public.expedientes_archivo where id = p_id for update;
  if not found then raise exception 'Documento inexistente'; end if;
  if anterior.updated_at is distinct from p_base then
    raise exception 'El documento cambió durante el procesamiento; vuelve a intentar' using errcode = '40001';
  end if;
  if jsonb_typeof(p_chunks) <> 'array' or jsonb_array_length(p_chunks) = 0 then
    raise exception 'El índice no puede estar vacío';
  end if;
  select coalesce(jsonb_agg(pinecone_vector_id) filter (where pinecone_vector_id is not null), '[]'::jsonb)
    into viejos from public.expedientes_archivo_chunks where documento_id = p_id;
  siguiente := jsonb_populate_record(anterior, p_patch);
  delete from public.expedientes_archivo_chunks where documento_id = p_id;
  insert into public.expedientes_archivo_chunks
    (id, documento_id, expediente_id, chunk_index, content, page_start, page_end, pinecone_vector_id, metadata, embedding)
    select
      x.id, p_id, anterior.expediente_id, x.chunk_index, x.content, x.page_start, x.page_end, x.pinecone_vector_id, x.metadata,
      (
        select array_agg(v::float4 order by position)::vector
        from jsonb_array_elements_text(x.embedding) with ordinality as elements(v, position)
      )
    from jsonb_to_recordset(p_chunks)
      as x(id uuid, chunk_index int, content text, page_start int, page_end int, pinecone_vector_id text, metadata jsonb, embedding jsonb);
  update public.expedientes_archivo set
    anio = siguiente.anio, asunto = siguiente.asunto, body_text = siguiente.body_text,
    folio = siguiente.folio, materia = siguiente.materia, tipo_documento = siguiente.tipo_documento,
    oficina = siguiente.oficina, metadata = siguiente.metadata, serie_documento = siguiente.serie_documento,
    resumen = siguiente.resumen, file_name = siguiente.file_name, file_size = siguiente.file_size,
    mime_type = siguiente.mime_type, storage_bucket = siguiente.storage_bucket, storage_path = siguiente.storage_path,
    status = 'indexed', error_message = null, updated_at = clock_timestamp()
    where id = p_id;
  return jsonb_build_object('oldVectorIds', viejos);
end;
$$;
revoke all on function public.archivo_publicar_indice(uuid,timestamptz,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.archivo_publicar_indice(uuid,timestamptz,jsonb,jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
