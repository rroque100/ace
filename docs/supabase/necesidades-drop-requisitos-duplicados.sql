-- Elimina las dos columnas de `necesidades` que DUPLICAN un tipo del Art. 72.3
-- del Reglamento, ya gestionado íntegramente por el editor de requisitos:
--
--   experiencia_requerida → tipo `experiencia_postor`  ("Experiencia del postor en la especialidad")
--   personal_clave        → tipo `capacidad_tecnica`   ("Capacidad técnica y profesional")
--
-- No se borran "porque no se usan en las fases siguientes": se borran porque el
-- MISMO dato vive en dos columnas y solo `requisitos_calificacion` viaja al
-- expediente (A3 propuesta_requisitos_calificacion y A4 f). Mantener las dos es
-- garantizar que un día discrepen y que el expediente se lleve la versión vieja.
--
-- Aplicable a CUALQUIER procedimiento de selección: la duplicidad no depende del
-- tipo de proceso. El resto de campos "sin consumo aguas abajo" NO se tocan:
-- varios solo aplican a un procedimiento concreto (código de catálogo en Subasta
-- Inversa, costo unitario en Comparación de Precios) y eso se resuelve con el
-- eje `mostrarEnProceso`/`obligatorioEnProceso` de la ficha, no borrándolos.
--
-- Ejecutar en el SQL Editor de Supabase. Es idempotente.

-- 1. RESPALDO — hace la migración reversible. Se conserva el valor original de
--    las dos columnas para toda fila que tuviera contenido.
CREATE TABLE IF NOT EXISTS necesidades_requisitos_legacy_backup (
  necesidad_id uuid PRIMARY KEY REFERENCES necesidades (id) ON DELETE CASCADE,
  experiencia_requerida text,
  personal_clave text,
  respaldado_en timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE necesidades_requisitos_legacy_backup ENABLE ROW LEVEL SECURITY;
-- Sin políticas: es una tabla de respaldo técnico, solo accesible con la service
-- role key. No la consulta la aplicación.

INSERT INTO necesidades_requisitos_legacy_backup (necesidad_id, experiencia_requerida, personal_clave)
SELECT id, experiencia_requerida, personal_clave
FROM necesidades
WHERE COALESCE(btrim(experiencia_requerida), '') <> ''
   OR COALESCE(btrim(personal_clave), '') <> ''
ON CONFLICT (necesidad_id) DO NOTHING;

-- 2. BACKFILL — vuelca el contenido heredado al texto canónico de
--    `requisitos_calificacion`, SOLO donde el editor está vacío.
--
--    Es la misma regla que aplicaba el cliente (`consolidarRequisitosLegacy`):
--    si el editor ya tiene contenido, manda el editor. Si el usuario quitó un
--    tipo a propósito, reinyectarlo lo resucitaría.
--
--    El formato replica el de `formatRequisitos`: cabecera "OBLIGATORIOS:",
--    una línea "- <Etiqueta del tipo>: <detalle>" por requisito, en el orden del
--    Art. 72.3 (capacidad técnica antes que experiencia), y los saltos internos
--    del detalle codificados como chr(1), que es lo que el parser espera.
UPDATE necesidades n
SET requisitos_calificacion = 'OBLIGATORIOS:' || E'\n' || array_to_string(
  ARRAY(
    SELECT linea
    FROM (
      VALUES
        (1, CASE WHEN COALESCE(btrim(n.personal_clave), '') <> ''
                 THEN '- Capacidad técnica y profesional: '
                      || replace(replace(btrim(n.personal_clave), E'\r\n', chr(1)), E'\n', chr(1))
            END),
        (2, CASE WHEN COALESCE(btrim(n.experiencia_requerida), '') <> ''
                 THEN '- Experiencia del postor en la especialidad: '
                      || replace(replace(btrim(n.experiencia_requerida), E'\r\n', chr(1)), E'\n', chr(1))
            END)
    ) AS t (orden, linea)
    WHERE linea IS NOT NULL
    ORDER BY orden
  ),
  E'\n'
)
WHERE COALESCE(btrim(n.requisitos_calificacion), '') = ''
  AND (COALESCE(btrim(n.experiencia_requerida), '') <> ''
    OR COALESCE(btrim(n.personal_clave), '') <> '');

-- 3. DROP.
ALTER TABLE necesidades DROP COLUMN IF EXISTS experiencia_requerida;
ALTER TABLE necesidades DROP COLUMN IF EXISTS personal_clave;

-- Comprobación (debe devolver 0 filas):
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'necesidades'
--   AND column_name IN ('experiencia_requerida', 'personal_clave');
