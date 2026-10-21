-- ============================================================================
-- BAJA de la tabla `riesgo_necesidad` (matriz de riesgos ESTRUCTURADA).
--
-- Por qué: era una DUPLICACIÓN del campo de prosa `gestion_riesgos` (Art. 44.3).
-- Ese campo es el que la IA (copiloto) redacta como matriz, el que se muestra en
-- la ficha y —lo decisivo— el ÚNICO que va al Word oficial del requerimiento
-- (`desdeMatrizRiesgos(gestion_riesgos)`, lib/requerimiento-estructura.ts). La
-- tabla estructurada solo alimentaba el sembrado de A4 s), duplicando lo mismo, y
-- por eso quedaba casi siempre en "0 registrados": nadie la llenaba.
--
-- El código ya NO lee ni escribe esta tabla (se retiró el panel, su endpoint CRUD,
-- el embed `EMBED_RIESGOS` de la precarga y el tipo `RiesgoNecesidad`). La tabla
-- queda HUÉRFANA.
--
-- ⚠️  EJECUCIÓN MANUAL Y OPCIONAL en el SQL Editor de Supabase. BORRA DATOS: las
--     filas de riesgos que algún expediente antiguo hubiera cargado a mano se
--     pierden. Si quieres conservarlas, expórtalas antes (o deja la tabla como
--     archivo muerto: el código ya no la toca, así que no estorba).
--
-- El backfill `backfill-riesgos-necesidad-s.sql` (que componía A4 s) desde esta
-- tabla) queda obsoleto con esta baja.
-- ============================================================================

-- Opcional: respaldo antes de borrar.
-- create table if not exists riesgo_necesidad_bak as table riesgo_necesidad;

drop table if exists public.riesgo_necesidad;
