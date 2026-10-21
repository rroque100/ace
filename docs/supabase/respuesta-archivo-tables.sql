-- =============================================================================
-- Tablas para el modulo respuesta-archivo (Sprint 2 y 3)
-- =============================================================================
-- Este script crea las tablas que faltan en Supabase. Se debe ejecutar
-- desde el SQL Editor del dashboard de Supabase:
--   1. Ir a https://app.supabase.com/project/uxpitcawohjnpkzeexiz/editor
--   2. New query
--   3. Pegar este script
--   4. Run
-- =============================================================================

-- 1. Tabla respuesta_antecedentes (PDFs subidos por el usuario)
-- Almacena el binario en Supabase Storage y el texto en Pinecone.
CREATE TABLE IF NOT EXISTS public.respuesta_antecedentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  entity text,
  file_name text NOT NULL,
  file_size integer NOT NULL,
  storage_bucket text NOT NULL,
  storage_path text NOT NULL,
  pinecone_namespace text NOT NULL DEFAULT 'respuesta-antecedentes',
  pinecone_document_id text NOT NULL,
  page_count integer,
  text_length integer NOT NULL,
  char_count integer NOT NULL,
  chunk_count integer NOT NULL DEFAULT 0,
  extraction_method text NOT NULL DEFAULT 'pdf-text',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS respuesta_antecedentes_created_by_idx
  ON public.respuesta_antecedentes (created_by, created_at DESC);

CREATE INDEX IF NOT EXISTS respuesta_antecedentes_pinecone_idx
  ON public.respuesta_antecedentes (pinecone_document_id);

-- 2. RLS para respuesta_antecedentes
ALTER TABLE public.respuesta_antecedentes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ant_usuario_select ON public.respuesta_antecedentes;
CREATE POLICY ant_usuario_select ON public.respuesta_antecedentes
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR (auth.jwt() ->> 'role') = 'admin'
    OR (auth.jwt() ->> 'role') = 'dec'
  );

DROP POLICY IF EXISTS ant_usuario_insert ON public.respuesta_antecedentes;
CREATE POLICY ant_usuario_insert ON public.respuesta_antecedentes
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS ant_usuario_delete ON public.respuesta_antecedentes;
CREATE POLICY ant_usuario_delete ON public.respuesta_antecedentes
  FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR (auth.jwt() ->> 'role') = 'admin'
  );

-- 3. Tabla normativa_adjuntos (PDFs temporales subidos en la Biblioteca)
CREATE TABLE IF NOT EXISTS public.normativa_adjuntos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  document_id text NOT NULL,
  file_name text NOT NULL,
  file_size integer NOT NULL,
  namespace text NOT NULL DEFAULT 'respuesta-adjuntos',
  title text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS normativa_adjuntos_created_by_idx
  ON public.normativa_adjuntos (created_by, created_at DESC);

ALTER TABLE public.normativa_adjuntos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nat_select ON public.normativa_adjuntos;
CREATE POLICY nat_select ON public.normativa_adjuntos
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS nat_insert ON public.normativa_adjuntos;
CREATE POLICY nat_insert ON public.normativa_adjuntos
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS nat_delete ON public.normativa_adjuntos;
CREATE POLICY nat_delete ON public.normativa_adjuntos
  FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR (auth.jwt() ->> 'role') = 'admin'
  );

-- 4. Modificar expedientes_respuestas para soportar antecedente, version, FTS
DO $$
BEGIN
  -- 4a. Columna antecedente_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'expedientes_respuestas'
    AND column_name = 'antecedente_id'
  ) THEN
    ALTER TABLE public.expedientes_respuestas
      ADD COLUMN antecedente_id uuid;
  END IF;

  -- 4b. Columna version
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'expedientes_respuestas'
    AND column_name = 'version'
  ) THEN
    ALTER TABLE public.expedientes_respuestas
      ADD COLUMN version integer NOT NULL DEFAULT 1;
  END IF;

  -- 4c. Columna parent_version_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'expedientes_respuestas'
    AND column_name = 'parent_version_id'
  ) THEN
    ALTER TABLE public.expedientes_respuestas
      ADD COLUMN parent_version_id uuid;
  END IF;

  -- 4d. FK de antecedente_id -> respuesta_antecedentes(id)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
    AND table_name = 'expedientes_respuestas'
    AND constraint_name = 'expedientes_respuestas_antecedente_id_fkey'
  ) THEN
    ALTER TABLE public.expedientes_respuestas
      ADD CONSTRAINT expedientes_respuestas_antecedente_id_fkey
      FOREIGN KEY (antecedente_id) REFERENCES public.respuesta_antecedentes(id)
      ON DELETE SET NULL;
  END IF;

  -- 4e. FK de parent_version_id -> expedientes_respuestas(id)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
    AND table_name = 'expedientes_respuestas'
    AND constraint_name = 'expedientes_respuestas_parent_version_id_fkey'
  ) THEN
    ALTER TABLE public.expedientes_respuestas
      ADD CONSTRAINT expedientes_respuestas_parent_version_id_fkey
      FOREIGN KEY (parent_version_id) REFERENCES public.expedientes_respuestas(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS expedientes_respuestas_antecedente_idx
  ON public.expedientes_respuestas (antecedente_id);

CREATE INDEX IF NOT EXISTS expedientes_respuestas_parent_idx
  ON public.expedientes_respuestas (parent_version_id, version DESC);

-- 4f. Columna FTS para busqueda full-text en espanol
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'expedientes_respuestas'
    AND column_name = 'fts'
  ) THEN
    ALTER TABLE public.expedientes_respuestas
      ADD COLUMN fts tsvector
      GENERATED ALWAYS AS (
        setweight(to_tsvector('spanish', coalesce(asunto, '')), 'A') ||
        setweight(to_tsvector('spanish', coalesce(cuerpo, '')), 'B') ||
        setweight(to_tsvector('spanish', coalesce(nro_oficio, '')), 'A') ||
        setweight(to_tsvector('spanish', coalesce(destinatario, '')), 'C')
      ) STORED;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS expedientes_respuestas_fts_gin
  ON public.expedientes_respuestas USING GIN (fts);

-- 5. RLS en expedientes_respuestas (activar si no esta activo)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'expedientes_respuestas'
    AND rowsecurity = true
  ) THEN
    ALTER TABLE public.expedientes_respuestas ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;
