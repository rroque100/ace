-- ============================================================================
-- RIESGO_NECESIDAD · RLS y saneamiento de la matriz de riesgos de la Ficha de
-- Necesidad (Módulo 1). La tabla `public.riesgo_necesidad` ya existe (creada en
-- schema.sql) pero quedó SIN políticas RLS: schema.sql solo activó RLS para
-- `necesidades` y `necesidad_documentos`. Esta migración cierra ese hueco.
--
-- Modelo (igual que necesidades/necesidad_documentos, colaborativo): cualquier
-- autenticado LEE; escribe el dueño de la necesidad padre o un colaborador de
-- expedientes (is_expediente_colaborador()). La app la consume con el JWT del
-- usuario (supabaseUserRest), así que estas políticas son el enforcement real.
--
-- Ejecutar UNA VEZ en el SQL Editor de Supabase. Idempotente.
-- ============================================================================

-- 1) Tabla (idempotente; ya debería existir con esta forma).
create table if not exists public.riesgo_necesidad (
  id uuid primary key default gen_random_uuid(),
  necesidad_id uuid not null references public.necesidades(id) on delete cascade,
  riesgo text not null,
  probabilidad text check (probabilidad in ('baja','media','alta')),
  impacto text check (impacto in ('bajo','medio','alto')),
  mitigacion text,
  responsable text,
  created_at timestamptz not null default now()
);

create index if not exists idx_riesgo_necesidad_necesidad
  on public.riesgo_necesidad(necesidad_id);

-- 2) RLS colaborativo, escopado por la necesidad padre.
alter table public.riesgo_necesidad enable row level security;

drop policy if exists riesgo_necesidad_read on public.riesgo_necesidad;
create policy riesgo_necesidad_read on public.riesgo_necesidad
  for select to authenticated using (true);

drop policy if exists riesgo_necesidad_write on public.riesgo_necesidad;
create policy riesgo_necesidad_write on public.riesgo_necesidad
  for all to authenticated
  using (
    public.is_expediente_colaborador()
    or exists (
      select 1 from public.necesidades n
      where n.id = riesgo_necesidad.necesidad_id and n.owner_id = auth.uid()
    )
  )
  with check (
    public.is_expediente_colaborador()
    or exists (
      select 1 from public.necesidades n
      where n.id = riesgo_necesidad.necesidad_id and n.owner_id = auth.uid()
    )
  );

-- 3) Verificación:
-- select policyname, cmd from pg_policies where tablename = 'riesgo_necesidad';
