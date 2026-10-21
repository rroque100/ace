-- Fechas de versión del requerimiento para el ciclo de no objeción (Art. 44.7-44.8).
-- Alimentan las celdas D21 ("Fecha de la 2ª versión") y D23 ("Fecha de la 'n'
-- versión") del Anexo N° 2. El resultado SÍ/NO de la no objeción ya vive en
-- `no_objecion`; estas columnas solo agregan la fecha de cada iteración.
--
-- Aplicado en Supabase el 2026-07-18 (migración necesidades_fechas_version_no_objecion).

alter table public.necesidades
  add column if not exists fecha_version_dos date,
  add column if not exists fecha_version_n date;

comment on column public.necesidades.fecha_version_dos is 'Fecha de la 2a version del requerimiento en el ciclo de no objecion (Art. 44.7). Anexo N 2, celda D21.';
comment on column public.necesidades.fecha_version_n is 'Fecha de la n version (ultima) del requerimiento en el ciclo de no objecion (Art. 44.7). Anexo N 2, celda D23.';
