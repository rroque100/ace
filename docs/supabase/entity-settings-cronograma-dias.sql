-- Días ESTIMADOS del cronograma (o) del Art. 46.1.o), editables POR PROCEDIMIENTO y
-- año fiscal desde Configuración. Son los plazos que el Reglamento NO fija: duración
-- de las actuaciones preparatorias y los pasos de la ejecución previos al contrato.
-- Los mínimos legales (Arts. 64.1/66.1/68.1/304/82.1, más los 6 días hábiles de la
-- subasta inversa de la directiva SIE) y las etapas por procedimiento (Arts.
-- 93/94/95) se quedan en código: son la norma, no una preferencia de la entidad.
--
-- Se guarda como JSONB (un objeto por procedimiento) para no multiplicar columnas:
--   { "licitacion_publica": { "aprobacionExpediente": 3, "elaboracionBases": 5,
--     "presentacionRequisitos": 8, "suscripcionContrato": 3 },
--     "concurso_publico": { ... }, ... }
--
-- MIGRACIÓN MANUAL: ejecutar a mano en el SQL Editor de Supabase (no hay
-- herramienta de migraciones en el proyecto). El código tolera que aún no exista
-- (parseDiasPorProcedimiento cae a los valores por defecto), así que se puede
-- aplicar cuando se pueda.

alter table public.entity_settings
  add column if not exists cronograma_anio integer,
  add column if not exists cronograma_dias jsonb;

comment on column public.entity_settings.cronograma_anio is
  'Año fiscal al que corresponden los días estimados del cronograma.';
comment on column public.entity_settings.cronograma_dias is
  'Días hábiles estimados del cronograma POR PROCEDIMIENTO (JSON): { procedimiento: { aprobacionExpediente, elaboracionBases, presentacionRequisitos, suscripcionContrato } }. Lo que el Reglamento no fija; los mínimos legales van en código.';

-- Siembra el año por defecto en la fila única, sin pisar lo configurado. El JSON de
-- los días se deja NULL: el código lo completa con los valores por defecto por
-- procedimiento hasta que la entidad lo edite en Configuración.
update public.entity_settings
set cronograma_anio = coalesce(cronograma_anio, 2026)
where id = 'default';
