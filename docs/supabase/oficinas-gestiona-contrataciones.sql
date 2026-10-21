-- Flag explícito para las oficinas que gestionan procedimientos de contratación.
-- Reemplaza el frágil match por nombre ("logistica") en Config › Áreas.
--
-- Aplicado en Supabase el 2026-07-18 (migración oficinas_gestiona_contrataciones).

alter table public.expedientes_oficinas
  add column if not exists gestiona_contrataciones boolean not null default false;

-- Backfill: las oficinas de logística ya gestionaban contrataciones por el
-- antiguo match por nombre. Se preserva ese comportamiento con el flag.
update public.expedientes_oficinas
  set gestiona_contrataciones = true
  where gestiona_contrataciones = false
    and lower(nombre) like '%logist%';

comment on column public.expedientes_oficinas.gestiona_contrataciones is 'Si true, la oficina gestiona procedimientos de contratacion (muestra "Gestionar procesos" en Config > Areas). Reemplaza el antiguo match por nombre "logistica".';
