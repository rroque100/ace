-- Elimina de `necesidades` los cuatro campos de SUSTENTO de la finalidad pública
-- (Art. 44.1) que no consumía ninguna fase:
--
--   problema_identificado
--   objetivo_contratacion
--   beneficio_esperado
--   poblacion_beneficiaria
--
-- Criterio (el mismo de necesidades-drop-requisitos-duplicados.sql): un campo se
-- retira solo si falla las TRES pruebas — no lo exige la norma como contenido
-- propio, no se imprime en ningún documento, y no lo lee ninguna fase.
--
--   · Norma: el Art. 44.1 exige la FINALIDAD PÚBLICA, que se conserva. Estos
--     cuatro eran su sustento redactado, no un contenido exigido aparte.
--   · Documentos: desde que se retiró la Ficha de Necesidad en Word ya no se
--     imprimen en ningún sitio.
--   · Fases: NO están en COLUMNAS_SEED ni en ningún `select` de las rutas de
--     Actuaciones Preparatorias, Selección o Ejecución. Su único lector era el
--     texto de respaldo que se le pasa a la IA cuando el PDF del EETT/TDR es
--     ilegible, que se apoya igual en la finalidad pública y el alcance.
--
-- El ALCANCE (44.2.a) NO se toca: sí viaja por COLUMNAS_SEED y compone
-- `A3.descripcion`, que es el requerimiento que llega al expediente.
--
-- Ejecutar en el SQL Editor de Supabase. Es idempotente.

-- 1. RESPALDO — hace la migración reversible.
CREATE TABLE IF NOT EXISTS necesidades_sustento_legacy_backup (
  necesidad_id uuid PRIMARY KEY REFERENCES necesidades (id) ON DELETE CASCADE,
  problema_identificado text,
  objetivo_contratacion text,
  beneficio_esperado text,
  poblacion_beneficiaria text,
  respaldado_en timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE necesidades_sustento_legacy_backup ENABLE ROW LEVEL SECURITY;
-- Sin políticas a propósito: es respaldo técnico, solo accesible con la service
-- role key. La aplicación no la consulta.

INSERT INTO necesidades_sustento_legacy_backup (
  necesidad_id, problema_identificado, objetivo_contratacion, beneficio_esperado, poblacion_beneficiaria
)
SELECT id, problema_identificado, objetivo_contratacion, beneficio_esperado, poblacion_beneficiaria
FROM necesidades
WHERE COALESCE(btrim(problema_identificado), '') <> ''
   OR COALESCE(btrim(objetivo_contratacion), '') <> ''
   OR COALESCE(btrim(beneficio_esperado), '') <> ''
   OR COALESCE(btrim(poblacion_beneficiaria), '') <> ''
ON CONFLICT (necesidad_id) DO NOTHING;

-- 2. DROP.
ALTER TABLE necesidades DROP COLUMN IF EXISTS problema_identificado;
ALTER TABLE necesidades DROP COLUMN IF EXISTS objetivo_contratacion;
ALTER TABLE necesidades DROP COLUMN IF EXISTS beneficio_esperado;
ALTER TABLE necesidades DROP COLUMN IF EXISTS poblacion_beneficiaria;

-- Comprobación (debe devolver 0 filas):
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'necesidades'
--   AND column_name IN ('problema_identificado','objetivo_contratacion',
--                       'beneficio_esperado','poblacion_beneficiaria');
