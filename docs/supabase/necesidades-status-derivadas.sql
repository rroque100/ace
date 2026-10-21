-- Corrige las necesidades que tienen expediente pero cuyo estado no lo refleja.
--
-- Invariante del flujo (lib/necesidad-workflow.ts): una necesidad con
-- `process_id` fue derivada, y la única acción que sale de ese punto es
-- "reabrir", que pone `conforme` Y limpia `process_id`. Por tanto:
--
--     process_id IS NOT NULL  ⟹  status = 'incorporado_cmn'
--
-- Hay filas anteriores a la migración del flujo que lo incumplen (p. ej.
-- REQ-2026-0004 quedó en 'borrador' con expediente). Esas filas están
-- ATASCADAS: no se pueden derivar (el endpoint responde 409 porque ya tienen
-- process_id) ni reabrir (esa acción exige 'incorporado_cmn'). Además dejan la
-- ficha editable, así que el requerimiento de un expediente vivo puede cambiar
-- por debajo y el expediente no se entera.

-- PASO 1 · Ver qué filas se van a corregir (ejecutar primero y revisar).
select id, codigo, nombre, status, process_id
from public.necesidades
where process_id is not null
  and status <> 'incorporado_cmn';

-- PASO 2 · Corregir. El estado real de una necesidad derivada es
-- 'incorporado_cmn': el expediente ya existe.
update public.necesidades
set status = 'incorporado_cmn'
where process_id is not null
  and status <> 'incorporado_cmn';

-- PASO 3 (opcional) · Impedir que el estado vuelva a divergir.
--
-- Con los datos ya corregidos, esta restricción hace imposible reintroducir el
-- problema desde cualquier vía (API, SQL manual o un bug futuro).
--
-- Ojo: si algún día se necesita un estado distinto conservando el vínculo con
-- el expediente, habrá que quitarla. Hoy el flujo no lo contempla.
--
-- alter table public.necesidades
--   add constraint necesidades_derivada_incorporada
--   check (process_id is null or status = 'incorporado_cmn');
