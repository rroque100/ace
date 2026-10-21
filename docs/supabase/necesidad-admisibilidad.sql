-- ============================================================================
-- NECESIDAD_ADMISIBILIDAD · Checklist de admisibilidad de la DEC (P3).
-- Una fila por necesidad; el estado de cada punto (marcado + nota) va en `items`
-- jsonb: { [itemKey]: { ok: boolean, nota?: string } }. El catálogo de puntos
-- vive en lib/necesidad-admisibilidad.ts.
--
-- RLS: lee cualquier autenticado (el área usuaria puede ver qué verificó la DEC).
-- La escritura la hace la app con SERVICE-ROLE tras requireDec (la DEC puede no
-- ser dueña ni colaboradora de la necesidad), por eso no hay política de INSERT/
-- UPDATE: los JWT de usuario no pueden escribir por REST, solo el service-role
-- (que ignora RLS). El endpoint es el enforcement del rol.
--
-- Ya aplicado en el proyecto Supabase vía apply_migration
-- (create_necesidad_admisibilidad). Se deja aquí como registro. Idempotente.
-- ============================================================================

create table if not exists public.necesidad_admisibilidad (
  necesidad_id uuid primary key references public.necesidades(id) on delete cascade,
  items jsonb not null default '{}'::jsonb,
  actualizado_por text,
  updated_at timestamptz not null default now()
);

alter table public.necesidad_admisibilidad enable row level security;

drop policy if exists necesidad_admisibilidad_read on public.necesidad_admisibilidad;
create policy necesidad_admisibilidad_read on public.necesidad_admisibilidad
  for select to authenticated using (true);

-- Verificación:
-- select policyname, cmd from pg_policies where tablename = 'necesidad_admisibilidad';
