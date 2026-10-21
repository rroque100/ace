-- ============================================================================
-- MIGRACION: GESTION POR AÑO FISCAL
-- ============================================================================
-- Añade columna `year` a las tablas de configuracion y datos para que cada
-- año fiscal tenga su propio conjunto de registros. Ejecutar en orden.
--
-- Uso:
--   1. psql -f year-based-schema.sql
--   2. Verificar con: SELECT year, count(*) FROM entity_settings GROUP BY year;
-- ============================================================================

-- ── 1. ENTITY SETTINGS ─────────────────────────────────────────────────────
alter table public.entity_settings
  add column if not exists year integer not null default extract(year from now())::int;

-- La combinacion id + year es unica (cada año tiene su propia fila).
alter table public.entity_settings
  drop constraint if exists entity_settings_pkey cascade;

alter table public.entity_settings
  add primary key (id, year);

-- ── 2. PROCESS TYPE SETTINGS ───────────────────────────────────────────────
alter table public.process_type_settings
  add column if not exists year integer not null default extract(year from now())::int;

alter table public.process_type_settings
  drop constraint if exists process_type_settings_pkey cascade;

-- Cada año puede tener sus propios codes; la unica combinacion code + year.
alter table public.process_type_settings
  add primary key (code, year);

-- ── 3. EXPEDIENTES OFICINAS ────────────────────────────────────────────────
alter table public.expedientes_oficinas
  add column if not exists year integer not null default extract(year from now())::int;

-- La PK sigue siendo id (uuid), pero agregamos indice por year para filtrado.
create index if not exists idx_expedientes_oficinas_year
  on public.expedientes_oficinas (year);

-- ── 4. EXPEDIENTES DOC COUNTERS ────────────────────────────────────────────
alter table public.expedientes_doc_counters
  add column if not exists year integer not null default extract(year from now())::int;

alter table public.expedientes_doc_counters
  drop constraint if exists expedientes_doc_counters_pkey cascade;

-- Un contador por (oficina, tipo, año): el correlativo se reinicia cada año.
alter table public.expedientes_doc_counters
  add primary key (oficina_id, tipo, year);

-- ── 5. EXPEDIENTES ARCHIVO ─────────────────────────────────────────────────
alter table public.expedientes_archivo
  add column if not exists year integer not null default extract(year from now())::int;

create index if not exists idx_expedientes_archivo_year
  on public.expedientes_archivo (year);

-- ── 6. EXPEDIENTES ARCHIVO CHUNKS ──────────────────────────────────────────
alter table public.expedientes_archivo_chunks
  add column if not exists year integer not null default extract(year from now())::int;

create index if not exists idx_expedientes_archivo_chunks_year
  on public.expedientes_archivo_chunks (year);

-- ── 7. EXPEDIENTES RESPUESTAS ──────────────────────────────────────────────
alter table public.expedientes_respuestas
  add column if not exists year integer not null default extract(year from now())::int;

create index if not exists idx_expedientes_respuestas_year
  on public.expedientes_respuestas (year);

-- ── 8. RESPUESTA ANTECEDENTES ──────────────────────────────────────────────
alter table public.respuesta_antecedentes
  add column if not exists year integer not null default extract(year from now())::int;

create index if not exists idx_respuesta_antecedentes_year
  on public.respuesta_antecedentes (year);

-- ── 9. RESPUESTA FEEDBACK ──────────────────────────────────────────────────
alter table public.respuesta_feedback
  add column if not exists year integer not null default extract(year from now())::int;

create index if not exists idx_respuesta_feedback_year
  on public.respuesta_feedback (year);

-- ── 10. AUDIT LOGS ─────────────────────────────────────────────────────────
alter table public.audit_logs
  add column if not exists year integer;

create index if not exists idx_audit_logs_year
  on public.audit_logs (year);

-- ── VERIFICACION ───────────────────────────────────────────────────────────
-- select table_name, column_name
-- from information_schema.columns
-- where column_name = 'year'
--   and table_schema = 'public'
--   and table_name in (
--     'entity_settings',
--     'process_type_settings',
--     'expedientes_oficinas',
--     'expedientes_doc_counters',
--     'expedientes_archivo',
--     'expedientes_archivo_chunks',
--     'expedientes_respuestas',
--     'respuesta_antecedentes',
--     'respuesta_feedback',
--     'audit_logs'
--   )
-- order by table_name;
