-- Tabla para persistir los PDFs que el usuario sube como antecedentes
-- en la pestaña Responder (mesa de partes).
--
-- El binario va a Supabase Storage, el texto indexado va a Pinecone
-- (namespace 'respuesta-antecedentes'), y aqui guardamos metadata para
-- auditoria y para permitir re-abrir / re-usar el antecedente.

CREATE TABLE IF NOT EXISTS respuesta_antecedentes (
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
  ON respuesta_antecedentes (created_by, created_at DESC);

CREATE INDEX IF NOT EXISTS respuesta_antecedentes_pinecone_idx
  ON respuesta_antecedentes (pinecone_document_id);

ALTER TABLE respuesta_antecedentes ENABLE ROW LEVEL SECURITY;

-- El usuario ve solo sus propios antecedentes; admin ve todos.
DROP POLICY IF EXISTS ant_usuario_select ON respuesta_antecedentes;
CREATE POLICY ant_usuario_select ON respuesta_antecedentes
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR (auth.jwt() ->> 'role') = 'admin'
    OR (auth.jwt() ->> 'role') = 'dec'
  );

DROP POLICY IF EXISTS ant_usuario_insert ON respuesta_antecedentes;
CREATE POLICY ant_usuario_insert ON respuesta_antecedentes
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS ant_usuario_delete ON respuesta_antecedentes;
CREATE POLICY ant_usuario_delete ON respuesta_antecedentes
  FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR (auth.jwt() ->> 'role') = 'admin'
  );

-- Si la tabla de respuestas tiene la columna antecedente_id, la creamos.
ALTER TABLE expedientes_respuestas
  ADD COLUMN IF NOT EXISTS antecedente_id uuid REFERENCES respuesta_antecedentes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS expedientes_respuestas_antecedente_idx
  ON expedientes_respuestas (antecedente_id);
