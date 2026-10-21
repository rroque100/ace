-- Índice de `audit_logs` por entidad.
--
-- La línea de tiempo del expediente filtra por `entity_id`:
--
--   audit_logs?entity_id=eq.<uuid>&order=created_at.desc&limit=200
--
-- `audit_logs` es una tabla de solo-inserción que crece con CADA acción del
-- sistema —hay 47 acciones distintas registrándose— y no tiene poda. Sin índice,
-- esa consulta hace un recorrido secuencial completo, así que se degrada sola con
-- el uso: hoy responde en ~155 ms y no se nota, dentro de un año sí.
--
-- El índice va sobre (entity_id, created_at DESC) y no solo sobre entity_id: la
-- consulta ordena por fecha descendente, y con las dos columnas el planificador
-- resuelve el filtro Y el orden sin pasar por una ordenación aparte.
--
-- CONCURRENTLY para no bloquear las escrituras mientras se construye. Ojo: no se
-- puede ejecutar dentro de una transacción, así que hay que lanzarlo suelto en el
-- editor SQL de Supabase, no dentro de un BEGIN/COMMIT.

CREATE INDEX CONCURRENTLY IF NOT EXISTS audit_logs_entity_id_created_at_idx
  ON public.audit_logs (entity_id, created_at DESC);

-- Comprobación: debe aparecer el índice recién creado.
--
--   SELECT indexname, indexdef
--     FROM pg_indexes
--    WHERE tablename = 'audit_logs';
--
-- Y que el planificador lo use (buscar "Index Scan", no "Seq Scan"):
--
--   EXPLAIN ANALYZE
--   SELECT action, actor_reference, created_at, details
--     FROM audit_logs
--    WHERE entity_id = '00000000-0000-0000-0000-000000000000'
--    ORDER BY created_at DESC
--    LIMIT 200;
