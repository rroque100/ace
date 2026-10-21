-- ============================================================================
-- RLS POR USUARIO Y OFICINA — Biblioteca de Expedientes Archivados y Responder
-- ============================================================================
-- Modelo de acceso (jerarquico):
--   * admin ............ ve y administra TODO.
--   * jefe de oficina .. ve y administra lo de SU oficina (profiles.es_jefe).
--   * resto ............ SOLO lo que subio/creo (uploaded_by / created_by).
--
-- La app aplica el mismo modelo en las rutas API (lib/auth.ts:
-- getArchivoScopeLevel / canAccessArchivoRow). Estas politicas son la defensa
-- en profundidad a nivel de base de datos: protegen el acceso directo con la
-- anon key. Las rutas del servidor usan service_role (bypassa RLS) y validan
-- en codigo.
--
-- Ejecutar UNA VEZ en el SQL Editor de Supabase. Idempotente.
-- ============================================================================

-- ── 1) Columnas nuevas ──────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists oficina_id uuid references public.expedientes_oficinas(id) on delete set null;

alter table public.profiles
  add column if not exists es_jefe boolean not null default false;

alter table public.expedientes_archivo
  add column if not exists oficina_id uuid references public.expedientes_oficinas(id) on delete set null;

create index if not exists expedientes_archivo_uploaded_by_idx
  on public.expedientes_archivo (uploaded_by);
create index if not exists expedientes_archivo_oficina_id_idx
  on public.expedientes_archivo (oficina_id);
create index if not exists expedientes_respuestas_created_by_idx
  on public.expedientes_respuestas (created_by);

-- ── 2) Normalizacion de nombres de oficina ──────────────────────────────────
-- Equivalente SQL de normalizeEntity() de la app (lib/entity-utils.ts):
-- minusculas, sin tildes/ñ, espacios colapsados.

create or replace function public.archivo_norm(t text)
returns text
language sql
immutable
as $$
  select nullif(
    trim(regexp_replace(
      translate(lower(coalesce(t, '')), 'áéíóúüñàèìòù', 'aeiouunaeiou'),
      '\s+', ' ', 'g'
    )),
    ''
  );
$$;

-- ── 3) Backfill de oficina_id (expedientes y perfiles) ──────────────────────

update public.expedientes_archivo e
set oficina_id = o.id
from public.expedientes_oficinas o
where e.oficina_id is null
  and public.archivo_norm(e.oficina) = public.archivo_norm(o.nombre);

update public.profiles p
set oficina_id = o.id
from public.expedientes_oficinas o
where p.oficina_id is null
  and public.archivo_norm(p.entity) = public.archivo_norm(o.nombre);

-- Trigger: resuelve oficina_id automaticamente desde el texto `oficina` al
-- insertar/actualizar (la app sigue escribiendo el nombre en texto).
create or replace function public.expedientes_archivo_resolve_oficina()
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

drop trigger if exists expedientes_archivo_resolve_oficina_trg on public.expedientes_archivo;
create trigger expedientes_archivo_resolve_oficina_trg
  before insert or update of oficina on public.expedientes_archivo
  for each row execute function public.expedientes_archivo_resolve_oficina();

-- ── 4) Helpers de scope (security definer evita recursion de RLS) ───────────

create or replace function public.archivo_es_jefe()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select es_jefe from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.archivo_oficina_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select oficina_id from public.profiles where id = auth.uid();
$$;

-- is_admin() e is_editor() ya existen (schema.sql). Se recrean por si esta
-- migracion corre en una BD donde aun no estan.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_editor()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role in ('dec', 'admin')
  );
$$;

-- ── 5) Politicas RLS ────────────────────────────────────────────────────────
-- Se eliminan TODAS las politicas previas de estas tablas (eran genericas:
-- select para cualquier autenticado) y se crean las escopadas.

do $$
declare pol record;
begin
  for pol in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('expedientes_archivo', 'expedientes_archivo_chunks', 'expedientes_respuestas')
  loop
    execute format('drop policy %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

alter table public.expedientes_archivo enable row level security;
alter table public.expedientes_archivo_chunks enable row level security;
alter table public.expedientes_respuestas enable row level security;

-- Expedientes: dueño, jefe de la misma oficina, o admin.
create policy expedientes_archivo_scoped_select on public.expedientes_archivo
  for select to authenticated
  using (
    public.is_admin()
    or uploaded_by = auth.uid()
    or (public.archivo_es_jefe() and oficina_id is not null and oficina_id = public.archivo_oficina_id())
  );

create policy expedientes_archivo_scoped_insert on public.expedientes_archivo
  for insert to authenticated
  with check (public.is_editor() and uploaded_by = auth.uid());

create policy expedientes_archivo_scoped_update on public.expedientes_archivo
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

create policy expedientes_archivo_scoped_delete on public.expedientes_archivo
  for delete to authenticated
  using (
    public.is_editor()
    and (
      public.is_admin()
      or uploaded_by = auth.uid()
      or (public.archivo_es_jefe() and oficina_id is not null and oficina_id = public.archivo_oficina_id())
    )
  );

-- Chunks: heredan el acceso del expediente padre.
create policy expedientes_archivo_chunks_scoped_select on public.expedientes_archivo_chunks
  for select to authenticated
  using (
    exists (
      select 1 from public.expedientes_archivo e
      where e.id = expediente_id
        and (
          public.is_admin()
          or e.uploaded_by = auth.uid()
          or (public.archivo_es_jefe() and e.oficina_id is not null and e.oficina_id = public.archivo_oficina_id())
        )
    )
  );

create policy expedientes_archivo_chunks_scoped_write on public.expedientes_archivo_chunks
  for all to authenticated
  using (
    public.is_editor()
    and exists (
      select 1 from public.expedientes_archivo e
      where e.id = expediente_id
        and (
          public.is_admin()
          or e.uploaded_by = auth.uid()
          or (public.archivo_es_jefe() and e.oficina_id is not null and e.oficina_id = public.archivo_oficina_id())
        )
    )
  )
  with check (
    public.is_editor()
    and exists (
      select 1 from public.expedientes_archivo e
      where e.id = expediente_id
        and (
          public.is_admin()
          or e.uploaded_by = auth.uid()
          or (public.archivo_es_jefe() and e.oficina_id is not null and e.oficina_id = public.archivo_oficina_id())
        )
    )
  );

-- Respuestas (Responder): autor, jefe de la misma oficina, o admin.
create policy expedientes_respuestas_scoped_select on public.expedientes_respuestas
  for select to authenticated
  using (
    public.is_admin()
    or created_by = auth.uid()
    or (public.archivo_es_jefe() and oficina_id is not null and oficina_id = public.archivo_oficina_id())
  );

create policy expedientes_respuestas_scoped_insert on public.expedientes_respuestas
  for insert to authenticated
  with check (public.is_editor() and created_by = auth.uid());

create policy expedientes_respuestas_scoped_update on public.expedientes_respuestas
  for update to authenticated
  using (
    public.is_editor()
    and (
      public.is_admin()
      or created_by = auth.uid()
      or (public.archivo_es_jefe() and oficina_id is not null and oficina_id = public.archivo_oficina_id())
    )
  )
  with check (
    public.is_editor()
    and (
      public.is_admin()
      or created_by = auth.uid()
      or (public.archivo_es_jefe() and oficina_id is not null and oficina_id = public.archivo_oficina_id())
    )
  );

create policy expedientes_respuestas_scoped_delete on public.expedientes_respuestas
  for delete to authenticated
  using (
    public.is_editor()
    and (
      public.is_admin()
      or created_by = auth.uid()
      or (public.archivo_es_jefe() and oficina_id is not null and oficina_id = public.archivo_oficina_id())
    )
  );

-- ── 6) Verificacion rapida ──────────────────────────────────────────────────
-- select tablename, policyname from pg_policies
--  where schemaname='public'
--    and tablename in ('expedientes_archivo','expedientes_archivo_chunks','expedientes_respuestas')
--  order by 1, 2;
--
-- select id, email, role, entity, oficina_id, es_jefe from public.profiles;
