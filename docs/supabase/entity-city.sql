-- Campo Ciudad de la Informacion institucional (Configuracion).
-- Se usa como el "Lugar" del encabezado de TODOS los documentos que genera
-- la pestaña Responder: "Challhuahuacho, 6 de julio de 2026".
--
-- Ejecutar en el SQL Editor de Supabase (una sola vez).

alter table public.entity_settings
  add column if not exists city text;
