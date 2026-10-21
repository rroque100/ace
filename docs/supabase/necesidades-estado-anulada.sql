-- Añade el estado `anulada` al workflow del Requerimiento.
--
-- Hasta ahora una necesidad que se abandonaba —no se contrata, cambia la
-- prioridad, se agota el año fiscal— se quedaba en el estado donde murió
-- (remitido, en revisión, conforme…) y la única salida era BORRARLA. Borrarla
-- pierde el rastro de que existió y de por qué se dejó; `anulada` lo conserva,
-- con el sustento que la transición exige.
--
-- Es terminal pero reversible: la acción `reactivar` la devuelve a borrador.
-- Solo se puede anular mientras NO haya expediente derivado (la guarda vive en
-- app/api/necesidades/[id]/transicion/route.ts); con expediente, primero hay que
-- reabrir para desvincularlo.
--
-- Ejecutar en el SQL Editor de Supabase. Es idempotente.

ALTER TABLE necesidades DROP CONSTRAINT IF EXISTS necesidades_status_check;

ALTER TABLE necesidades ADD CONSTRAINT necesidades_status_check CHECK (
  status = ANY (ARRAY[
    'borrador'::text,
    'remitido_dec'::text,
    'en_revision_dec'::text,
    'observado'::text,
    'no_objecion_pendiente'::text,
    'conforme'::text,
    'incorporado_cmn'::text,
    'anulada'::text
  ])
);

-- Comprobación: debe incluir 'anulada'.
-- SELECT pg_get_constraintdef(c.oid)
-- FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
-- WHERE t.relname = 'necesidades' AND c.conname = 'necesidades_status_check';
