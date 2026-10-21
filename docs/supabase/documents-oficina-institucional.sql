-- ============================================================================
-- Biblioteca de documentos: oficina que subio cada documento + bandera
-- "institucional" (visible para toda la entidad).
--
-- Antes cualquier usuario autenticado veia TODOS los documentos de la
-- biblioteca normativa, sin distinguir de que oficina venian. Se agrega:
--   - oficina_id: la oficina (FK a expedientes_oficinas) de quien lo subio.
--     Se resuelve de auth.user.oficinaId (el mismo FK que ya usa el scope
--     del archivo de expedientes, lib/auth.ts).
--   - es_institucional: si es true, el documento se ve desde cualquier
--     oficina (p. ej. la Ley 32069 o su Reglamento, o una plantilla comun
--     de la entidad); si es false (default), solo lo ve la oficina que lo
--     subio y el administrador.
--
-- Los documentos ya existentes quedan con oficina_id = null y
-- es_institucional = false: hasta que alguien los reclasifique, solo los
-- ve el administrador (que siempre ve todo). Si la mayoria del corpus
-- actual debe tratarse como institucional desde ya, correr aparte:
--   update public.documents set es_institucional = true where oficina_id is null;
--
-- Ejecucion MANUAL en el SQL Editor de Supabase.
-- ============================================================================

alter table public.documents
  add column if not exists oficina_id uuid references public.expedientes_oficinas(id),
  add column if not exists es_institucional boolean not null default false;

create index if not exists documents_oficina_id_idx on public.documents (oficina_id);
