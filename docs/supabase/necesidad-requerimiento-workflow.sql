-- ============================================================================
-- NECESIDADES · Workflow del Requerimiento (Ley 32069, Guía de Actuaciones
-- Preparatorias, Cap. II). Alinea la tabla `necesidades` al flujo por actor:
-- área usuaria/ATE formula → DEC verifica CMN y revisa → ciclo de no objeción →
-- conforme → derivar.
--
-- Ejecutar UNA VEZ en el SQL Editor de Supabase. Idempotente.
-- ============================================================================

-- 1) Columnas nuevas del workflow ------------------------------------------------
alter table public.necesidades
  add column if not exists tipo_area text not null default 'area_usuaria',
  add column if not exists cmn_verificado boolean not null default false,
  add column if not exists no_objecion text not null default 'no_aplica',
  add column if not exists no_objecion_sustento text,
  add column if not exists no_objecion_mecanismo text;

-- CHECK de tipo_area (área usuaria o ATE)
alter table public.necesidades drop constraint if exists necesidades_tipo_area_check;
alter table public.necesidades add constraint necesidades_tipo_area_check
  check (tipo_area in ('area_usuaria', 'ate'));

-- CHECK de no_objecion
alter table public.necesidades drop constraint if exists necesidades_no_objecion_check;
alter table public.necesidades add constraint necesidades_no_objecion_check
  check (no_objecion in ('no_aplica', 'solicitada', 'otorgada', 'objetada'));

-- 2) Migración de estados al nuevo workflow --------------------------------------
-- Se quita primero el CHECK para poder remapear los valores históricos.
alter table public.necesidades drop constraint if exists necesidades_status_check;

update public.necesidades set status = 'remitido_dec'
  where status in ('pendiente_revision', 'subsanado', 'enviado_dec');
update public.necesidades set status = 'conforme'
  where status = 'aprobado_area_usuaria';
-- 'borrador', 'observado' e 'incorporado_cmn' se conservan.

alter table public.necesidades add constraint necesidades_status_check
  check (status in (
    'borrador', 'remitido_dec', 'en_revision_dec', 'observado',
    'no_objecion_pendiente', 'conforme', 'incorporado_cmn'
  ));

alter table public.necesidades alter column status set default 'borrador';

-- Verificación:
-- select status, count(*) from public.necesidades group by status;
-- select id, nombre, tipo_area, cmn_verificado, no_objecion from public.necesidades limit 10;
