-- Campos del Gerente de la Municipalidad (Configuracion > Autoridad).
-- Estos datos se usan en contratos, documentos oficiales y firmas.
--
-- Ejecutar en el SQL Editor de Supabase (una sola vez).

alter table public.entity_settings
  add column if not exists manager_degree text,
  add column if not exists manager_dni text check (manager_dni = '' or manager_dni ~ '^[0-9]{8}$'),
  add column if not exists manager_full_name text,
  add column if not exists manager_position text,
  add column if not exists manager_resolution_date text,
  add column if not exists manager_resolution_number text;
