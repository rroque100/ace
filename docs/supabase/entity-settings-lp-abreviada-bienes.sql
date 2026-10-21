-- Rango de cuantía de la "Licitación Pública abreviada para bienes" en la
-- configuración institucional.
--
-- Es un dato ANUAL y único para toda la entidad, igual que el PAC y la UIT. La
-- modalidad "abreviada" depende de la cuantía, pero los Arts. 93-95 del
-- Reglamento NO traen la tabla de umbrales (remiten a un enlace web), así que el
-- rango se registra aquí, en Configuración → Municipalidad, y se actualiza cada
-- ejercicio.
--
-- Uso: en un requerimiento por relación de ítems, sirve para saber qué ítems
-- tienen una cuantía que corresponde a una Licitación Pública abreviada de
-- bienes, y así redactar por ítem el requisito de experiencia del postor.
--
-- Idempotente: se puede ejecutar varias veces sin efecto.
--
-- Aplicado el 2026-07-30 vía MCP (migración `entity_settings_lp_abreviada_bienes`).

alter table public.entity_settings
  -- Límites (en soles) de la banda de cuantía de la LP abreviada para bienes.
  add column if not exists lp_abreviada_bienes_min numeric(14, 2),
  add column if not exists lp_abreviada_bienes_max numeric(14, 2),
  -- Ejercicio fiscal al que corresponde el rango (p. ej. 2026).
  add column if not exists lp_abreviada_bienes_anio integer;

comment on column public.entity_settings.lp_abreviada_bienes_min is
  'Cuantia minima (S/) de la Licitacion Publica abreviada para bienes. Umbral anual editable.';
comment on column public.entity_settings.lp_abreviada_bienes_max is
  'Cuantia maxima (S/) de la Licitacion Publica abreviada para bienes; por encima es Licitacion Publica plena.';
comment on column public.entity_settings.lp_abreviada_bienes_anio is
  'Ejercicio fiscal del rango de la LP abreviada para bienes.';
