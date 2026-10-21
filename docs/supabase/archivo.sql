-- ============================================================
-- Modulo Archivo: archivo administrativo de la entidad (resoluciones,
-- acuerdos, ordenanzas, oficios, informes). Corpus SEPARADO del normativo:
-- vive en su propio namespace de Pinecone (PINECONE_ARCHIVO_NAMESPACE).
--
-- Migracion idempotente: segura de re-ejecutar. Depende de objetos que ya
-- existen en el esquema principal (docs/supabase/schema.sql):
--   - extension pg_trgm (para gin_trgm_ops)
--   - funcion public.set_updated_at()
--   - funcion public.is_editor()
-- Aplicar en Supabase Dashboard -> SQL Editor.
-- ============================================================

create table if not exists public.archivo_documentos (
  id uuid primary key default gen_random_uuid(),
  document_number text,
  fecha date,
  asunto text,
  title text not null,
  doc_kind text not null default 'otros'
    check (doc_kind in ('resolucion_alcaldia','resolucion_gerencia','acuerdo_concejo','ordenanza','decreto_alcaldia','oficio','informe','otros')),
  file_name text not null,
  file_size bigint not null check (file_size > 0),
  mime_type text not null default 'application/pdf',
  storage_bucket text not null,
  storage_path text not null unique,
  status text not null default 'uploaded'
    check (status in ('uploaded','processing','indexed','error')),
  error_message text,
  body_text text,
  metadata jsonb not null default '{}'::jsonb,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.archivo_chunks (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null references public.archivo_documentos(id) on delete cascade,
  chunk_index integer not null,
  page_start integer,
  page_end integer,
  content text not null,
  pinecone_vector_id text unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (documento_id, chunk_index)
);

create index if not exists idx_archivo_documentos_status on public.archivo_documentos(status);
create index if not exists idx_archivo_documentos_kind on public.archivo_documentos(doc_kind);
create index if not exists idx_archivo_documentos_fecha on public.archivo_documentos(fecha desc);
create index if not exists idx_archivo_documentos_created_at on public.archivo_documentos(created_at desc);
create index if not exists idx_archivo_chunks_documento_id on public.archivo_chunks(documento_id);
create index if not exists idx_archivo_chunks_content_trgm on public.archivo_chunks using gin (content gin_trgm_ops);

drop trigger if exists set_archivo_documentos_updated_at on public.archivo_documentos;
create trigger set_archivo_documentos_updated_at
before update on public.archivo_documentos
for each row execute function public.set_updated_at();

-- RLS: lectura para autenticados; escritura para editor o admin (igual que el corpus).
do $$
declare t text;
begin
  foreach t in array array['archivo_documentos','archivo_chunks']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format('create policy %I_select on public.%I for select to authenticated using (true)', t, t);
    execute format('drop policy if exists %I_admin_insert on public.%I', t, t);
    execute format('create policy %I_admin_insert on public.%I for insert to authenticated with check (public.is_editor())', t, t);
    execute format('drop policy if exists %I_admin_update on public.%I', t, t);
    execute format('create policy %I_admin_update on public.%I for update to authenticated using (public.is_editor()) with check (public.is_editor())', t, t);
    execute format('drop policy if exists %I_admin_delete on public.%I', t, t);
    execute format('create policy %I_admin_delete on public.%I for delete to authenticated using (public.is_editor())', t, t);
  end loop;
end $$;
