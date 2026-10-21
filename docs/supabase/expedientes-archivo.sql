-- ============================================================
-- Sub-módulo: Biblioteca de Expedientes Archivados (ESQUEMA CANÓNICO).
-- Expedientes/documentos terminados, escaneados (OCR) e indexados en Pinecone
-- (namespace propio PINECONE_EXPEDIENTES_NAMESPACE, aislado del corpus normativo
-- y del archivo administrativo). Registra además la UBICACIÓN FÍSICA exacta
-- (catálogo fijo: tipo de contenedor, color) + estante/piso/local + persona interesada.
--
-- INDEPENDIENTE del expediente de contratación (Ley 32069): otra tratativa.
--
-- ⚠ FUENTE ÚNICA DE VERDAD del esquema. Debe coincidir 1:1 con:
--     lib/expedientes-archivo.ts -> ExpedienteArchivo
--     app/components/expedientes-archivo/types.ts -> ExpedienteItem
--
-- Idempotente y NO destructivo: seguro de re-ejecutar. Converge cualquier estado
-- (instalación nueva o tabla creada con el esquema viejo) al esquema canónico:
--   1) crea la tabla canónica si no existe,
--   2) añade columnas canónicas que falten,
--   3) elimina columnas del esquema viejo (numero_*, fecha, tipo_contenedor, etc.).
-- Si necesitas reconstruir desde cero (sin datos), usa expedientes-archivo-canonico.sql
-- (incluye TRUNCATE).
--
-- Depende de objetos del esquema principal:
--   - extension pg_trgm · funcion public.set_updated_at() · funcion public.is_editor()
-- Aplicar en Supabase Dashboard -> SQL Editor.
-- ============================================================

-- 1) Tabla canónica (instalaciones nuevas).
create table if not exists public.expedientes_archivo (
  id uuid primary key default gen_random_uuid(),
  -- Identificación documental
  sgd_expediente text,
  serie_documento text,
  anio integer,
  tipo_documento text,
  asunto text,
  materia text,
  resumen text,
  title text not null,
  oficina text,
  -- Almacenamiento físico (catálogo fijo CONTENEDOR_TIPOS de la UI)
  tipo_almacenamiento text not null default 'folder'
    check (tipo_almacenamiento in ('folder','archivador','caja','tomo','paquete','estante','otros')),
  nro_archivador text,
  nro_paquete text,
  empastado boolean not null default false,
  color_archivador text,
  -- Ubicación física exacta
  nro_estante text,
  nro_piso text,
  nro_local text,
  folio text,
  observaciones text,
  -- Persona interesada
  persona_tipo text check (persona_tipo in ('natural','juridica')),
  persona_documento text,
  persona_nombre text,
  -- Archivo digital
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

-- 2) Asegurar columnas canónicas en tablas creadas con el esquema viejo (idempotente).
--    NOTA de diseño:
--      * tipo_documento: TEXT libre (la UI ofrece Resolución/Oficio/Decreto/Ordenanza/
--        Informe/Memorando/Carta/Otro+custom; un CHECK de pocos valores colapsaría datos).
--      * tipo_almacenamiento: CHECK contra el catálogo CONTENEDOR_TIPOS de la UI.
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='expedientes_archivo' and column_name='sgd_expediente') then
    alter table public.expedientes_archivo add column sgd_expediente text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='expedientes_archivo' and column_name='serie_documento') then
    alter table public.expedientes_archivo add column serie_documento text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='expedientes_archivo' and column_name='tipo_documento') then
    alter table public.expedientes_archivo add column tipo_documento text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='expedientes_archivo' and column_name='oficina') then
    alter table public.expedientes_archivo add column oficina text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='expedientes_archivo' and column_name='tipo_almacenamiento') then
    alter table public.expedientes_archivo add column tipo_almacenamiento text not null default 'folder'
      check (tipo_almacenamiento in ('folder','archivador','caja','tomo','paquete','estante','otros'));
  end if;
  if not exists (select 1 from information_schema.columns where table_name='expedientes_archivo' and column_name='nro_archivador') then
    alter table public.expedientes_archivo add column nro_archivador text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='expedientes_archivo' and column_name='nro_paquete') then
    alter table public.expedientes_archivo add column nro_paquete text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='expedientes_archivo' and column_name='empastado') then
    alter table public.expedientes_archivo add column empastado boolean not null default false;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='expedientes_archivo' and column_name='color_archivador') then
    alter table public.expedientes_archivo add column color_archivador text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='expedientes_archivo' and column_name='nro_estante') then
    alter table public.expedientes_archivo add column nro_estante text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='expedientes_archivo' and column_name='nro_piso') then
    alter table public.expedientes_archivo add column nro_piso text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='expedientes_archivo' and column_name='nro_local') then
    alter table public.expedientes_archivo add column nro_local text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='expedientes_archivo' and column_name='folio') then
    alter table public.expedientes_archivo add column folio text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='expedientes_archivo' and column_name='persona_tipo') then
    alter table public.expedientes_archivo add column persona_tipo text check (persona_tipo in ('natural','juridica'));
  end if;
  if not exists (select 1 from information_schema.columns where table_name='expedientes_archivo' and column_name='persona_documento') then
    alter table public.expedientes_archivo add column persona_documento text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='expedientes_archivo' and column_name='persona_nombre') then
    alter table public.expedientes_archivo add column persona_nombre text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='expedientes_archivo' and column_name='body_text') then
    alter table public.expedientes_archivo add column body_text text;
  end if;
end $$;

-- 3) Eliminar columnas del esquema viejo (idempotente). Si la tabla tuviera datos
--    productivos en estas columnas, hacer el backfill ANTES (ver
--    docs/PLAN-MIGRACION-EXPEDIENTES-ARCHIVO.md §3) — en localhost sin datos es seguro.
do $$
declare col text;
begin
  foreach col in array array[
    'numero_expediente','numero_documento','fecha','tipo_contenedor',
    'nro_caja','color','ubicacion','codigo_ubicacion','nro_folios',
    'remitente','destinatario'
  ] loop
    if exists (select 1 from information_schema.columns where table_name='expedientes_archivo' and column_name=col) then
      execute format('alter table public.expedientes_archivo drop column %I', col);
    end if;
  end loop;
end $$;

-- 4) Tabla de chunks (fragmentos indexados en Pinecone).
create table if not exists public.expedientes_archivo_chunks (
  id uuid primary key default gen_random_uuid(),
  expediente_id uuid not null references public.expedientes_archivo(id) on delete cascade,
  chunk_index integer not null,
  page_start integer,
  page_end integer,
  content text not null,
  pinecone_vector_id text unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (expediente_id, chunk_index)
);

-- 5) Índices (alineados al esquema canónico).
create index if not exists idx_expedientes_archivo_status     on public.expedientes_archivo(status);
create index if not exists idx_expedientes_archivo_anio       on public.expedientes_archivo(anio desc);
create index if not exists idx_expedientes_archivo_serie      on public.expedientes_archivo(serie_documento);
create index if not exists idx_expedientes_archivo_oficina    on public.expedientes_archivo(oficina);
create index if not exists idx_expedientes_archivo_estante    on public.expedientes_archivo(nro_estante);
create index if not exists idx_expedientes_archivo_created_at on public.expedientes_archivo(created_at desc);
create index if not exists idx_expedientes_archivo_chunks_exp on public.expedientes_archivo_chunks(expediente_id);
create index if not exists idx_expedientes_archivo_chunks_trgm
  on public.expedientes_archivo_chunks using gin (content gin_trgm_ops);

drop trigger if exists set_expedientes_archivo_updated_at on public.expedientes_archivo;
create trigger set_expedientes_archivo_updated_at
before update on public.expedientes_archivo
for each row execute function public.set_updated_at();

-- 6) RLS: lectura para autenticados; escritura para editor/admin (patrón del corpus).
do $$
declare t text;
begin
  foreach t in array array['expedientes_archivo','expedientes_archivo_chunks']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format('create policy %I_select on public.%I for select to authenticated using (true)', t, t);
    execute format('drop policy if exists %I_editor_insert on public.%I', t, t);
    execute format('create policy %I_editor_insert on public.%I for insert to authenticated with check (public.is_editor())', t, t);
    execute format('drop policy if exists %I_editor_update on public.%I', t, t);
    execute format('create policy %I_editor_update on public.%I for update to authenticated using (public.is_editor()) with check (public.is_editor())', t, t);
    execute format('drop policy if exists %I_editor_delete on public.%I', t, t);
    execute format('create policy %I_editor_delete on public.%I for delete to authenticated using (public.is_editor())', t, t);
  end loop;
end $$;

-- 7) Verificación.
select column_name, data_type
from information_schema.columns
where table_name = 'expedientes_archivo'
order by ordinal_position;
