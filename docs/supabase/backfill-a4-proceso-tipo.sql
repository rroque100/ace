-- ============================================================================
-- BACKFILL A4 · Proceso específico y tipo de evaluador de expedientes antiguos
--
-- Las mejoras de A4→A6/A7/A8 leen dos datos que los expedientes creados ANTES no
-- persistían en el paso A4:
--
--  · `var_a_proceso` — el proceso ESPECÍFICO de la ficha ("Licitación Pública
--    abreviada para bienes"), que hoy A4 siembra desde `necesidades.
--    tipo_proceso_seleccion`. Sin él, los documentos caen al procedimiento
--    genérico del Art. 54. Se rellena DERIVÁNDOLO de la necesidad (fuente
--    autoritativa), no se inventa: solo donde A4 existe y el campo está vacío.
--
--  · `var_e_tipo_evaluador` — el tipo que decide la Estrategia (Art. 46.1.e) y
--    que A6 confirma (Art. 54.2.e). En expedientes antiguos A4 quedó vacío
--    mientras A6 sí tenía el tipo, lo que dejaba a A4 y A6 en silencio
--    contradictorios. Se alinea A4 al valor YA elegido en A6.
--
-- Ambos son DERIVACIONES seguras (no valores inventados). NO se tocan datos que
-- son decisión del usuario y que degradan con respaldo: la "Cuantía actualizada"
-- de A5 (cae a valor_estimado), los integrantes del comité, ni el texto libre de
-- AL/ATENCIÓN de expedientes viejos (el documento ya los imprime tal cual).
--
-- Los expedientes NUEVOS no lo necesitan: A4 siembra `var_a_proceso` al abrir el
-- paso, `var_e_tipo_evaluador` es obligatorio, y el blindaje de calidad impide
-- que A4 y A6 diverjan.
--
-- Ejecución MANUAL en el SQL Editor de Supabase (ya aplicado vía MCP). Idempotente.
-- ============================================================================

-- 1) var_a_proceso ← proceso de la necesidad, donde A4 existe y está vacío.
update public.procurement_processes p
set hitos = jsonb_set(p.hitos, '{A4,data,var_a_proceso}', to_jsonb(n.tipo_proceso_seleccion))
from public.necesidades n
where n.id = p.necesidad_id
  and p.hitos ? 'A4'
  and coalesce(p.hitos->'A4'->'data'->>'var_a_proceso', '') = ''
  and coalesce(n.tipo_proceso_seleccion, '') <> '';

-- 2) var_e_tipo_evaluador de A4 ← tipo_evaluador de A6, donde A4 está vacío.
update public.procurement_processes p
set hitos = jsonb_set(p.hitos, '{A4,data,var_e_tipo_evaluador}', p.hitos->'A6'->'data'->'tipo_evaluador')
where p.hitos ? 'A4'
  and coalesce(p.hitos->'A4'->'data'->>'var_e_tipo_evaluador', '') = ''
  and coalesce(p.hitos->'A6'->'data'->>'tipo_evaluador', '') <> '';
