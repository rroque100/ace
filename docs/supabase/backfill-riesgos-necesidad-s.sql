-- ============================================================================
-- BACKFILL `riesgos_necesidad` (A4 · variable s) desde la necesidad.
--
-- El campo s) del Formato de Estrategia (Art. 46.1.s) arranca en "NO CORRESPONDE"
-- y ofrece, con un botón, TRAER la gestión de riesgos que el área usuaria ya
-- identificó en el requerimiento (Art. 44.3). El texto de esa matriz se guarda en
-- `A4.data.riesgos_necesidad` al DERIVAR el expediente (lib/fase1-precarga.ts).
--
-- Los expedientes creados ANTES de ese cambio no tienen la clave, así que el botón
-- no aparecía. Aquí se rellena `riesgos_necesidad` con la MISMA composición que la
-- precarga —"Gestión de riesgos (del requerimiento): {gestion_riesgos}" + la matriz
-- de riesgos estructurada (`riesgo_necesidad`) en el formato de `matrizRiesgosTexto`—.
--
-- Es una DERIVACIÓN (no un valor inventado): sale de la propia necesidad de origen.
-- Solo toca expedientes con A4, sin la clave ya, y cuya necesidad tiene riesgos.
-- NO toca `var_s_objetivo` (s) sigue como esté). Idempotente.
--
-- Ejecución MANUAL en el SQL Editor de Supabase (ya aplicado vía MCP).
-- ============================================================================

with matriz as (
  select r.necesidad_id,
    'Matriz de riesgos (' || count(*) || '):' || E'\n' || string_agg(
      '- ' || trim(r.riesgo)
      || case when r.probabilidad is not null or r.impacto is not null
           then ' (' || concat_ws(' / ',
             case when r.probabilidad is not null then 'probabilidad ' || r.probabilidad end,
             case when r.impacto is not null then 'impacto ' || r.impacto end) || ')' else '' end
      || case when nullif(trim(r.mitigacion), '') is not null then '. Mitigación: ' || trim(r.mitigacion) else '' end
      || case when nullif(trim(r.responsable), '') is not null then '. Responsable: ' || trim(r.responsable) else '' end,
      E'\n' order by r.created_at) as texto
  from public.riesgo_necesidad r
  where coalesce(trim(r.riesgo), '') <> ''
  group by r.necesidad_id
)
update public.procurement_processes p
set hitos = jsonb_set(
  p.hitos,
  '{A4,data,riesgos_necesidad}',
  to_jsonb(concat_ws(E'\n',
    case when coalesce(n.gestion_riesgos, '') <> '' then 'Gestión de riesgos (del requerimiento): ' || n.gestion_riesgos end,
    m.texto))
)
from public.necesidades n
left join matriz m on m.necesidad_id = n.id
where n.id = p.necesidad_id
  and p.hitos ? 'A4'
  and coalesce(p.hitos->'A4'->'data'->>'riesgos_necesidad', '') = ''
  and coalesce(concat_ws(E'\n',
    case when coalesce(n.gestion_riesgos, '') <> '' then 'x' end, m.texto), '') <> '';
