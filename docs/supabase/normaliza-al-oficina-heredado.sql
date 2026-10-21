-- ============================================================================
-- NORMALIZA el AL (destinatario / autoridad) heredado como TEXTO LIBRE al
-- nombre EXACTO de la oficina del catálogo (Configuración → Oficinas).
--
-- Los campos AL de la cabecera de los informes son desplegables de oficina:
--   · A6 · destinatario  (solicitud de comité)
--   · A7 · solicitud_al  (solicitud de certificación)
--   · A8 · autoridad     (informe de aprobación del expediente)
-- Guardan el `nombre` de la oficina para que la previa y el .docx/.xlsx impriman
-- a su responsable desde Configuración. En expedientes creados ANTES de que fueran
-- desplegables, la DEC tecleó el destinatario a mano —"CPC. SAUL QUISPE CHIPANA\n
-- OFICINA GENERAL DE ADMINISTRACION JEFATURA", "GERENCIA MUNICIPAL"—, así que el
-- select salía vacío y el documento caía al respaldo.
--
-- El destino NO se inventa: el nombre de la oficina ya venía embebido en el propio
-- texto, y se mapea al nombre canónico del catálogo:
--   · "…OFICINA GENERAL DE ADMINISTRACION…" → "OFICINA GENERAL DE ADMINISTRACION JEFATURA" (la OGA)
--   · "GERENCIA MUNICIPAL"                   → "OFICINA DE GERENCIA MUNICIPAL"
-- Se respeta la elección deliberada de otra autoridad (la Gerencia Municipal en
-- A8 de algunos expedientes); no se fuerza todo a la OGA.
--
-- Solo toca valores que NO son ya un nombre válido del catálogo → IDEMPOTENTE:
-- correrlo dos veces no cambia nada la segunda. Un expediente nuevo ya nace con el
-- nombre de la oficina (el campo es un select), así que no lo necesita.
--
-- Ejecución MANUAL en el SQL Editor de Supabase (ya aplicado vía MCP).
-- ============================================================================

-- 1) A6 · destinatario → OGA
update public.procurement_processes p
set hitos = jsonb_set(p.hitos, '{A6,data,destinatario}', to_jsonb('OFICINA GENERAL DE ADMINISTRACION JEFATURA'::text))
where p.hitos->'A6'->'data' ? 'destinatario'
  and p.hitos->'A6'->'data'->>'destinatario' not in (select nombre from public.expedientes_oficinas)
  and p.hitos->'A6'->'data'->>'destinatario' ilike '%OFICINA GENERAL DE ADMINISTRACION%';

-- 2) A8 · autoridad → OGA
update public.procurement_processes p
set hitos = jsonb_set(p.hitos, '{A8,data,autoridad}', to_jsonb('OFICINA GENERAL DE ADMINISTRACION JEFATURA'::text))
where p.hitos->'A8'->'data' ? 'autoridad'
  and p.hitos->'A8'->'data'->>'autoridad' not in (select nombre from public.expedientes_oficinas)
  and p.hitos->'A8'->'data'->>'autoridad' ilike '%OFICINA GENERAL DE ADMINISTRACION%';

-- 3) A8 · autoridad → Oficina de Gerencia Municipal (elección deliberada de otra autoridad)
update public.procurement_processes p
set hitos = jsonb_set(p.hitos, '{A8,data,autoridad}', to_jsonb('OFICINA DE GERENCIA MUNICIPAL'::text))
where p.hitos->'A8'->'data' ? 'autoridad'
  and p.hitos->'A8'->'data'->>'autoridad' not in (select nombre from public.expedientes_oficinas)
  and p.hitos->'A8'->'data'->>'autoridad' ilike '%GERENCIA MUNICIPAL%';

-- 4) A7 · solicitud_al → OGA (por simetría; hoy no hay filas, guarda futuros heredados)
update public.procurement_processes p
set hitos = jsonb_set(p.hitos, '{A7,data,solicitud_al}', to_jsonb('OFICINA GENERAL DE ADMINISTRACION JEFATURA'::text))
where p.hitos->'A7'->'data' ? 'solicitud_al'
  and p.hitos->'A7'->'data'->>'solicitud_al' not in (select nombre from public.expedientes_oficinas)
  and p.hitos->'A7'->'data'->>'solicitud_al' ilike '%OFICINA GENERAL DE ADMINISTRACION%';

-- ============================================================================
-- ATENCIÓN heredada (A6 y A8): el campo pasó de texto libre a DESPLEGABLE de rol
-- (aga / gerente). Los expedientes viejos guardaron el rol tecleado a mano —"…\n
-- Gerente General", "…\nAUTORIDAD DE GESTION ADMINISTRATIVA"—, con lo que el
-- select salía vacío. Se mapea al valor del desplegable PRESERVANDO la intención
-- (no se fuerza todo a la AGA): la 2ª línea del texto dice el rol.
--   · "…AUTORIDAD DE GESTION…" → 'aga'
--   · "…GERENTE…"             → 'gerente'
--   · cualquier otro texto     → 'aga' (el valor por defecto del campo)
-- Solo toca valores no vacíos que NO son ya 'aga'/'gerente' → IDEMPOTENTE.
-- ============================================================================

-- 5) A6 · atencion → valor del desplegable
update public.procurement_processes p
set hitos = jsonb_set(p.hitos, '{A6,data,atencion}', to_jsonb(
  case
    when p.hitos->'A6'->'data'->>'atencion' ilike '%AUTORIDAD DE GESTION%' then 'aga'
    when p.hitos->'A6'->'data'->>'atencion' ilike '%GERENTE%' then 'gerente'
    else 'aga'
  end::text))
where p.hitos->'A6'->'data' ? 'atencion'
  and p.hitos->'A6'->'data'->>'atencion' <> ''
  and p.hitos->'A6'->'data'->>'atencion' not in ('aga', 'gerente');

-- 6) A8 · atencion → valor del desplegable
update public.procurement_processes p
set hitos = jsonb_set(p.hitos, '{A8,data,atencion}', to_jsonb(
  case
    when p.hitos->'A8'->'data'->>'atencion' ilike '%AUTORIDAD DE GESTION%' then 'aga'
    when p.hitos->'A8'->'data'->>'atencion' ilike '%GERENTE%' then 'gerente'
    else 'aga'
  end::text))
where p.hitos->'A8'->'data' ? 'atencion'
  and p.hitos->'A8'->'data'->>'atencion' <> ''
  and p.hitos->'A8'->'data'->>'atencion' not in ('aga', 'gerente');
