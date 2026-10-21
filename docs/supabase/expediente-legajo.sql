-- ============================================================================
-- LEGAJO MULTIDOCUMENTO — expedientes_archivo_legajos + expediente_id en documentos
-- ============================================================================
-- Separa dos conceptos que hoy viven fusionados en `expedientes_archivo`:
--   * LEGAJO (`expedientes_archivo_legajos`, tabla nueva): la carpeta física que
--     se abre una vez y acumula documentos — ubicación física, SGD, serie,
--     oficina, persona interesada, asunto general.
--   * DOCUMENTO (`expedientes_archivo`, ya existe): cada PDF individual que
--     entra al legajo — tipo, fecha, folio correlativo DENTRO del legajo,
--     status de OCR/indexación, storage_path.
--
-- Retrocompatible: hay filas productivas en `expedientes_archivo`, así que esta
-- migración NO trunca nada. Cada documento sin `expediente_id` recibe su propio
-- legajo 1:1 (reusando el mismo id: mismo valor de PK en ambas tablas, sin tabla
-- de mapeo intermedia — son tablas distintas, no hay colisión). El id del
-- DOCUMENTO no cambia — todo lo que ya apunta a él (respuestas, vectores de
-- Pinecone, audit logs, enlaces guardados) sigue funcionando igual.
--
-- Prerrequisito: docs/supabase/rls-archivo-por-usuario.sql ya aplicado (provee
-- is_admin(), is_editor(), archivo_es_jefe(), archivo_oficina_id(), archivo_norm()).
--
-- Ejecutar UNA VEZ en el SQL Editor de Supabase. Idempotente.
-- ============================================================================

-- ── 1) Tabla `expedientes_archivo_legajos` ──────────────────────────────────

create table if not exists public.expedientes_archivo_legajos (
  id uuid primary key default gen_random_uuid(),
  -- Identificación del caso
  sgd_expediente        text,
  serie_documento       text,
  anio                  integer,
  asunto                text,
  materia               text,
  oficina               text,
  oficina_id            uuid references public.expedientes_oficinas(id) on delete set null,
  -- Persona interesada
  persona_tipo          text check (persona_tipo in ('natural','juridica')),
  persona_documento     text,
  persona_nombre        text,
  -- Almacenamiento físico (el legajo completo vive en un solo sitio)
  tipo_almacenamiento   text not null default 'folder' check (tipo_almacenamiento in
                          ('folder','archivador','caja','tomo','paquete','estante','otros')),
  nro_archivador        text,
  nro_paquete           text,
  empastado             boolean not null default false,
  color_archivador      text,
  nro_estante           text,
  nro_piso              text,
  nro_local             text,
  observaciones         text,
  -- Estado agregado: lo mantienen los triggers de la sección 4, nunca la app.
  documentos_count         integer not null default 0,
  documentos_error_count   integer not null default 0,
  documentos_pending_count integer not null default 0,
  -- Próximo folio a asignar dentro de este legajo (1, 2, 3...).
  next_folio             integer not null default 1,
  uploaded_by            uuid references auth.users(id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists idx_expedientes_archivo_legajos_sgd
  on public.expedientes_archivo_legajos(sgd_expediente);
create index if not exists idx_expedientes_archivo_legajos_serie
  on public.expedientes_archivo_legajos(serie_documento);
create index if not exists idx_expedientes_archivo_legajos_oficina_id
  on public.expedientes_archivo_legajos(oficina_id);
create index if not exists idx_expedientes_archivo_legajos_anio
  on public.expedientes_archivo_legajos(anio desc);
create index if not exists idx_expedientes_archivo_legajos_created_at
  on public.expedientes_archivo_legajos(created_at desc);

drop trigger if exists set_expedientes_archivo_legajos_updated_at on public.expedientes_archivo_legajos;
create trigger set_expedientes_archivo_legajos_updated_at
before update on public.expedientes_archivo_legajos
for each row execute function public.set_updated_at();

-- Resuelve oficina_id automáticamente desde el texto `oficina`, igual que ya
-- existe para expedientes_archivo (rls-archivo-por-usuario.sql).
create or replace function public.expedientes_archivo_legajos_resolve_oficina()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.oficina_id is null
     or (tg_op = 'UPDATE' and new.oficina is distinct from old.oficina) then
    select o.id into new.oficina_id
    from public.expedientes_oficinas o
    where public.archivo_norm(o.nombre) = public.archivo_norm(new.oficina)
    limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists expedientes_archivo_legajos_resolve_oficina_trg on public.expedientes_archivo_legajos;
create trigger expedientes_archivo_legajos_resolve_oficina_trg
  before insert or update of oficina on public.expedientes_archivo_legajos
  for each row execute function public.expedientes_archivo_legajos_resolve_oficina();

-- ── 2) `expediente_id` + `numero_folio` en el documento ─────────────────────

alter table public.expedientes_archivo
  add column if not exists expediente_id uuid references public.expedientes_archivo_legajos(id) on delete cascade;
alter table public.expedientes_archivo
  add column if not exists numero_folio integer;

create index if not exists idx_expedientes_archivo_expediente_id
  on public.expedientes_archivo(expediente_id);

-- ── 3) Chunks: `expediente_id` → `documento_id` (rename) + `expediente_id` nuevo (legajo) ──
-- El nombre viejo (apuntaba al PDF) queda ambiguo ahora que "expediente" pasa a
-- significar el legajo. Se renombra a `documento_id` (mismo FK, mismos datos;
-- ALTER ... RENAME actualiza sola la constraint unique(expediente_id,chunk_index)
-- a unique(documento_id,chunk_index), no hace falta tocarla) y se agrega un
-- `expediente_id` NUEVO que apunta al legajo, para que un resultado de búsqueda
-- pueda decir "este hit es del legajo X" sin un join extra.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'expedientes_archivo_chunks' and column_name = 'expediente_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_name = 'expedientes_archivo_chunks' and column_name = 'documento_id'
  ) then
    alter table public.expedientes_archivo_chunks rename column expediente_id to documento_id;
  end if;
end $$;

alter table public.expedientes_archivo_chunks
  add column if not exists expediente_id uuid references public.expedientes_archivo_legajos(id) on delete cascade;

create index if not exists idx_expedientes_archivo_chunks_expediente_id
  on public.expedientes_archivo_chunks(expediente_id);

-- ── 4) Triggers: folio correlativo + estado agregado ─────────────────────────

-- Asigna numero_folio al insertar un documento con expediente_id: toma
-- next_folio del legajo y lo incrementa en la misma sentencia (evita una
-- carrera entre dos subidas simultáneas al mismo legajo).
create or replace function public.archivo_legajo_assign_folio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.expediente_id is not null and new.numero_folio is null then
    update public.expedientes_archivo_legajos
    set next_folio = next_folio + 1
    where id = new.expediente_id
    returning next_folio - 1 into new.numero_folio;
  end if;
  return new;
end;
$$;

drop trigger if exists expedientes_archivo_assign_folio_trg on public.expedientes_archivo;
create trigger expedientes_archivo_assign_folio_trg
  before insert on public.expedientes_archivo
  for each row execute function public.archivo_legajo_assign_folio();

-- Recalcula los contadores agregados del legajo cuando cambian sus documentos
-- (alta, cambio de status, baja, o cambio de legajo). Evita referenciar NEW en
-- un DELETE (o OLD en un INSERT): PL/pgSQL no los tiene asignados y revienta.
create or replace function public.archivo_legajo_recompute_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
  previous_id uuid;
begin
  if tg_op = 'DELETE' then
    target_id := null;
    previous_id := old.expediente_id;
  elsif tg_op = 'INSERT' then
    target_id := new.expediente_id;
    previous_id := null;
  else
    target_id := new.expediente_id;
    previous_id := case
      when old.expediente_id is distinct from new.expediente_id then old.expediente_id
      else null
    end;
  end if;

  if target_id is not null then
    update public.expedientes_archivo_legajos e
    set
      documentos_count = (select count(*) from public.expedientes_archivo d where d.expediente_id = target_id),
      documentos_error_count = (select count(*) from public.expedientes_archivo d where d.expediente_id = target_id and d.status = 'error'),
      documentos_pending_count = (select count(*) from public.expedientes_archivo d where d.expediente_id = target_id and d.status in ('uploaded','processing')),
      updated_at = now()
    where e.id = target_id;
  end if;

  if previous_id is not null then
    update public.expedientes_archivo_legajos e
    set
      documentos_count = (select count(*) from public.expedientes_archivo d where d.expediente_id = previous_id),
      documentos_error_count = (select count(*) from public.expedientes_archivo d where d.expediente_id = previous_id and d.status = 'error'),
      documentos_pending_count = (select count(*) from public.expedientes_archivo d where d.expediente_id = previous_id and d.status in ('uploaded','processing')),
      updated_at = now()
    where e.id = previous_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists expedientes_archivo_recompute_status_trg on public.expedientes_archivo;
create trigger expedientes_archivo_recompute_status_trg
  after insert or update of status, expediente_id or delete on public.expedientes_archivo
  for each row execute function public.archivo_legajo_recompute_status();

-- ── 5) Backfill: cada documento sin legajo recibe uno propio (1:1) ──────────

insert into public.expedientes_archivo_legajos (
  id, sgd_expediente, serie_documento, anio, asunto, materia, oficina, oficina_id,
  persona_tipo, persona_documento, persona_nombre,
  tipo_almacenamiento, nro_archivador, nro_paquete, empastado, color_archivador,
  nro_estante, nro_piso, nro_local, observaciones,
  documentos_count, documentos_error_count, documentos_pending_count,
  next_folio, uploaded_by, created_at, updated_at
)
select
  d.id, d.sgd_expediente, d.serie_documento, d.anio, d.asunto, d.materia, d.oficina, d.oficina_id,
  d.persona_tipo, d.persona_documento, d.persona_nombre,
  coalesce(d.tipo_almacenamiento::text, 'folder'), d.nro_archivador, d.nro_paquete,
  coalesce(d.empastado, false), d.color_archivador,
  d.nro_estante, d.nro_piso, d.nro_local, d.observaciones,
  1,
  case when d.status = 'error' then 1 else 0 end,
  case when d.status in ('uploaded','processing') then 1 else 0 end,
  2, d.uploaded_by, d.created_at, d.updated_at
from public.expedientes_archivo d
where d.expediente_id is null
on conflict (id) do nothing;

update public.expedientes_archivo d
set expediente_id = d.id, numero_folio = 1
where d.expediente_id is null;

update public.expedientes_archivo_chunks c
set expediente_id = d.expediente_id
from public.expedientes_archivo d
where c.documento_id = d.id and c.expediente_id is null;

-- ── 6) RLS de `expedientes_archivo_legajos` (mismo patrón que expedientes_archivo) ──

alter table public.expedientes_archivo_legajos enable row level security;

do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'expedientes_archivo_legajos'
  loop
    execute format('drop policy %I on public.expedientes_archivo_legajos', pol.policyname);
  end loop;
end $$;

create policy expedientes_archivo_legajos_scoped_select on public.expedientes_archivo_legajos
  for select to authenticated
  using (
    public.is_admin()
    or uploaded_by = auth.uid()
    or (public.archivo_es_jefe() and oficina_id is not null and oficina_id = public.archivo_oficina_id())
  );

create policy expedientes_archivo_legajos_scoped_insert on public.expedientes_archivo_legajos
  for insert to authenticated
  with check (public.is_editor() and uploaded_by = auth.uid());

create policy expedientes_archivo_legajos_scoped_update on public.expedientes_archivo_legajos
  for update to authenticated
  using (
    public.is_editor()
    and (
      public.is_admin()
      or uploaded_by = auth.uid()
      or (public.archivo_es_jefe() and oficina_id is not null and oficina_id = public.archivo_oficina_id())
    )
  )
  with check (
    public.is_editor()
    and (
      public.is_admin()
      or uploaded_by = auth.uid()
      or (public.archivo_es_jefe() and oficina_id is not null and oficina_id = public.archivo_oficina_id())
    )
  );

create policy expedientes_archivo_legajos_scoped_delete on public.expedientes_archivo_legajos
  for delete to authenticated
  using (
    public.is_editor()
    and (
      public.is_admin()
      or uploaded_by = auth.uid()
      or (public.archivo_es_jefe() and oficina_id is not null and oficina_id = public.archivo_oficina_id())
    )
  );

-- ── 7) Verificación rápida ───────────────────────────────────────────────────
-- select count(*) from public.expedientes_archivo_legajos;
-- select id, expediente_id, numero_folio from public.expedientes_archivo limit 5;
-- select documento_id, expediente_id from public.expedientes_archivo_chunks limit 5;
-- select tablename, policyname from pg_policies where schemaname='public' and tablename='expedientes_archivo_legajos';
