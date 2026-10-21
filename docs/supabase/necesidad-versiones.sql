-- ============================================================================
-- NECESIDAD_VERSIONES · Snapshots del requerimiento para el diff del ciclo de no
-- objeción (D3, Art. 44.7). Se guarda el estado del requerimiento al REMITIR
-- (versión del área usuaria) y al PROPONER MODIFICACIÓN (versión de la DEC); el
-- panel de no objeción los compara campo a campo para que el área usuaria decida
-- su no objeción viendo "qué cambió la DEC".
--
-- Mismo modelo RLS colaborativo que riesgo_necesidad / necesidad_observaciones:
-- lee cualquier autenticado; escribe el dueño de la necesidad padre o un
-- colaborador de expedientes. Enforcement real por RLS (supabaseUserRest).
--
-- Ya aplicado vía apply_migration (create_necesidad_versiones). Idempotente.
-- ============================================================================

create table if not exists public.necesidad_versiones (
  id uuid primary key default gen_random_uuid(),
  necesidad_id uuid not null references public.necesidades(id) on delete cascade,
  snapshot jsonb not null,
  transicion text,
  etiqueta text,
  autor_referencia text,
  autor_rol text,
  created_at timestamptz not null default now()
);

create index if not exists idx_necesidad_versiones_necesidad
  on public.necesidad_versiones(necesidad_id);

alter table public.necesidad_versiones enable row level security;

drop policy if exists necesidad_versiones_read on public.necesidad_versiones;
create policy necesidad_versiones_read on public.necesidad_versiones
  for select to authenticated using (true);

drop policy if exists necesidad_versiones_write on public.necesidad_versiones;
create policy necesidad_versiones_write on public.necesidad_versiones
  for all to authenticated
  using (
    public.is_expediente_colaborador()
    or exists (
      select 1 from public.necesidades n
      where n.id = necesidad_versiones.necesidad_id and n.owner_id = auth.uid()
    )
  )
  with check (
    public.is_expediente_colaborador()
    or exists (
      select 1 from public.necesidades n
      where n.id = necesidad_versiones.necesidad_id and n.owner_id = auth.uid()
    )
  );
