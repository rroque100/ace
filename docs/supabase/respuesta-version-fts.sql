-- =============================================================================
-- Sprint 3: Versionado de respuestas + busqueda full-text
-- =============================================================================
-- Cambios:
--   1. expedientes_respuestas.version: numero de version (v1, v2, v3, ...)
--   2. expedientes_respuestas.parent_version_id: id de la version de la que
--      deriva esta. NULL para la version original. ON DELETE SET NULL para no
--      perder el historial si se borra el padre.
--   3. expedientes_respuestas.fts: columna generada tsvector para full-text
--      search en espanol (incluye asunto, cuerpo, nro_oficio, destinatario).
--   4. Indice GIN sobre fts para busquedas eficientes.
-- =============================================================================

-- 1. Versionado
ALTER TABLE expedientes_respuestas
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

ALTER TABLE expedientes_respuestas
  ADD COLUMN IF NOT EXISTS parent_version_id uuid
    REFERENCES expedientes_respuestas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS expedientes_respuestas_parent_idx
  ON expedientes_respuestas (parent_version_id);

CREATE INDEX IF NOT EXISTS expedientes_respuestas_version_idx
  ON expedientes_respuestas (parent_version_id, version DESC);

-- Comentario para documentar la intencion
COMMENT ON COLUMN expedientes_respuestas.version IS
  'Numero de version. v1 = original, v2+ = revisiones derivadas de parent_version_id.';
COMMENT ON COLUMN expedientes_respuestas.parent_version_id IS
  'Id de la version de la que deriva. NULL = version original.';

-- 2. Full-text search en espanol
-- Columna generada: se actualiza automaticamente al cambiar asunto/cuerpo/etc.
ALTER TABLE expedientes_respuestas
  ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('spanish', coalesce(asunto, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(cuerpo, '')), 'B') ||
    setweight(to_tsvector('spanish', coalesce(nro_oficio, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(destinatario, '')), 'C')
  ) STORED;

-- Indice GIN para busquedas full-text eficientes
CREATE INDEX IF NOT EXISTS expedientes_respuestas_fts_gin
  ON expedientes_respuestas USING GIN (fts);

-- 3. RLS: el versionado respeta la misma policy que ya existe.
-- Si la tabla tiene RLS, las policies existentes aplican a las nuevas
-- columnas automaticamente. No hay que duplicar policies.
-- Verificar: si la tabla NO tiene RLS, activarla.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'expedientes_respuestas'
    AND rowsecurity = true
  ) THEN
    ALTER TABLE expedientes_respuestas ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'RLS activado en expedientes_respuestas (estaba desactivado)';
  END IF;
END $$;
