-- Topes por CUANTÍA de los procedimientos de selección (tabla DSEACE-OECE;
-- Arts. 93, 94 y 95 del Reglamento, D.S. 009-2025-EF). Importes anuales editables
-- desde Configuración: no están en la norma publicada. Es el espejo de las
-- columnas `lp_abreviada_bienes_*`.
--
-- MIGRACIÓN MANUAL: ejecutar a mano en el SQL Editor de Supabase (no hay
-- herramienta de migraciones en el proyecto). El código tolera que aún no exista
-- (topesDeConfiguracion cae al defecto 2026), así que se puede aplicar cuando se
-- pueda.

alter table public.entity_settings
  add column if not exists tope_anio integer,
  add column if not exists tope_piso numeric(14, 2),
  add column if not exists tope_licitacion_concurso numeric(14, 2),
  add column if not exists tope_licitacion_obras numeric(14, 2),
  add column if not exists tope_comparacion_precios numeric(14, 2);

comment on column public.entity_settings.tope_anio is
  'Año fiscal al que corresponden los topes de procedimiento.';
comment on column public.entity_settings.tope_piso is
  'Piso: por ENCIMA de este monto aplican los procedimientos; por debajo, contrato menor (2026: 44 000).';
comment on column public.entity_settings.tope_licitacion_concurso is
  'Frontera bienes/servicios: >= este monto Licitación/Concurso Público; por debajo, su Abreviada (2026: 485 000).';
comment on column public.entity_settings.tope_licitacion_obras is
  'Obras: >= este monto Licitación Pública; por debajo, Licitación Pública abreviada de obras (2026: 5 000 000).';
comment on column public.entity_settings.tope_comparacion_precios is
  'Techo de la Comparación de Precios en bienes y servicios en general (2026: 100 000).';

-- Siembra los valores 2026 en la fila única de la entidad, SIN pisar lo que ya
-- estuviera configurado (coalesce).
update public.entity_settings
set tope_anio = coalesce(tope_anio, 2026),
    tope_piso = coalesce(tope_piso, 44000),
    tope_licitacion_concurso = coalesce(tope_licitacion_concurso, 485000),
    tope_licitacion_obras = coalesce(tope_licitacion_obras, 5000000),
    tope_comparacion_precios = coalesce(tope_comparacion_precios, 100000)
where id = 'default';
