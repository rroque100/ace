-- ============================================================================
-- NECESIDAD_OBSERVACIONES · Observaciones por campo de la Ficha de Necesidad (D2).
-- La DEC comenta un campo concreto y el área usuaria lo subsana, en vez de un
-- único texto de observación para toda la necesidad.
--
-- Mismo modelo RLS colaborativo que riesgo_necesidad: lee cualquier autenticado;
-- escribe el dueño de la necesidad padre o un colaborador de expedientes
-- (is_expediente_colaborador()). La app la consume con el JWT del usuario
-- (supabaseUserRest), así que estas políticas son el enforcement real.
--
-- Ya aplicado en el proyecto Supabase vía apply_migration
-- (create_necesidad_observaciones). Se deja aquí como registro. Idempotente.
-- ============================================================================

create table if not exists public.necesidad_observaciones (
  id uuid primary key default gen_random_uuid(),
  necesidad_id uuid not null references public.necesidades(id) on delete cascade,
  campo text not null, -- clave `api` del campo observado (p. ej. "descripcionDetallada")
  comentario text not null,
  autor_referencia text,
  autor_rol text,
  resuelto boolean not null default false,
  resuelto_por text,
  created_at timestamptz not null default now(),
  resuelto_at timestamptz
);

create index if not exists idx_necesidad_observaciones_necesidad
  on public.necesidad_observaciones(necesidad_id);

alter table public.necesidad_observaciones enable row level security;

drop policy if exists necesidad_observaciones_read on public.necesidad_observaciones;
create policy necesidad_observaciones_read on public.necesidad_observaciones
  for select to authenticated using (true);

drop policy if exists necesidad_observaciones_write on public.necesidad_observaciones;
create policy necesidad_observaciones_write on public.necesidad_observaciones
  for all to authenticated
  using (
    public.is_expediente_colaborador()
    or exists (
      select 1 from public.necesidades n
      where n.id = necesidad_observaciones.necesidad_id and n.owner_id = auth.uid()
    )
  )
  with check (
    public.is_expediente_colaborador()
    or exists (
      select 1 from public.necesidades n
      where n.id = necesidad_observaciones.necesidad_id and n.owner_id = auth.uid()
    )
  );

-- Verificación:
-- select policyname, cmd from pg_policies where tablename = 'necesidad_observaciones';
