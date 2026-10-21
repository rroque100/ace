-- Numeracion por oficina, POR TIPO de documento Y POR AÑO fiscal.
--
-- 1) Amplia el catalogo de tipos: OFICIO, OFICIO MULTIPLE, INFORME, CARTA,
--    MEMORANDUM, MEMORANDUM MULTIPLE, CONTRATO.
-- 2) Agrega `sufijo` POR TIPO en expedientes_doc_counters: cada tipo de
--    documento puede tener su propia sigla (INFORME N° 001-2026-MDCH/LOG,
--    CARTA N° 001-2026-MDCH/ABAST, etc.). Si el tipo no tiene sufijo,
--    se usa el sufijo general de la oficina (expedientes_oficinas.sufijo).
-- 3) Particiona la PK por (oficina_id, tipo, year): cada tipo arranca su
--    correlativo en 1 al cambiar de ejercicio fiscal, sin pisar la serie del
--    año anterior.
-- 4) Redefine expedientes_next_doc_number para:
--      - recibir p_year (el año del DOCUMENTO, no el del reloj del servidor:
--        un oficio con fecha del año pasado toma la serie de ese año);
--      - usar el mismo formato que la UI (lib/document-number.ts):
--        {TIPO} N° {NNN}-{AAAA}-{SUFIJO}.
--
-- Modelo "el contador existe = la oficina emite ese tipo en ese año":
--   - Habilitar un tipo en Configuracion → Numeracion inserta la fila del contador.
--   - Deshabilitarlo elimina la fila (el correlativo se pierde; la UI lo advierte).
--
-- ── Por qué el parámetro p_year ─────────────────────────────────────────────
-- Antes la función usaba `extract(year from now())` y ON CONFLICT (oficina, tipo)
-- sin año: la serie de cada enero arrancaba en el último correlativo de diciembre
-- en vez de en 1. Y un oficio con fecha 31-dic que se guardaba el 2-ene tomaba
-- la serie nueva aunque su fecha fuera del ejercicio anterior.
--
-- La llamada en app/api/expedientes-archivo/respuesta/save/route.ts envía
-- p_year; la DDL vieja del repo (2 params) hacía que la llamada fallara con
-- SQLSTATE 42P10 (invalid_parameter_name). El catch del endpoint lo ocultó
-- durante semanas y ningún documento llegó a numerarse.
--
-- Idempotente: se puede ejecutar varias veces sin efecto.

-- 1) Catalogo de tipos --------------------------------------------------------
alter table public.expedientes_doc_counters
  drop constraint if exists expedientes_doc_counters_tipo_check;

alter table public.expedientes_doc_counters
  add constraint expedientes_doc_counters_tipo_check
  check (tipo in (
    'OFICIO',
    'OFICIO MULTIPLE',
    'INFORME',
    'CARTA',
    'MEMORANDUM',
    'MEMORANDUM MULTIPLE',
    'CONTRATO'
  ));

alter table public.expedientes_respuestas
  drop constraint if exists expedientes_respuestas_tipo_documento_check;

alter table public.expedientes_respuestas
  add constraint expedientes_respuestas_tipo_documento_check
  check (tipo_documento is null or tipo_documento in (
    'OFICIO',
    'OFICIO MULTIPLE',
    'INFORME',
    'CARTA',
    'MEMORANDUM',
    'MEMORANDUM MULTIPLE',
    'CONTRATO'
  ));

-- 2) Sufijo por tipo + columna year ------------------------------------------
alter table public.expedientes_doc_counters
  add column if not exists sufijo text;

alter table public.expedientes_doc_counters
  add column if not exists year integer not null default extract(year from now())::int;

-- 3) PK compuesta por (oficina, tipo, año) -----------------------------------
-- Antes era (oficina, tipo); al añadir `year` hay que partirla para que cada
-- ejercicio tenga su serie independiente. Si la PK vieja sigue presente, se
-- reemplaza.
alter table public.expedientes_doc_counters
  drop constraint if exists expedientes_doc_counters_pkey;

alter table public.expedientes_doc_counters
  drop constraint if exists expedientes_doc_counters_oficina_id_tipo_key;

alter table public.expedientes_doc_counters
  add constraint expedientes_doc_counters_pkey primary key (oficina_id, tipo, year);

-- 4) Asignacion atomica del siguiente numero ---------------------------------
-- Formato identico al de la UI (lib/document-number.ts):
--   {TIPO} N° {NNN}-{AAAA}[-{SUFIJO con segmentos unidos por /}]
-- El sufijo se toma del contador (por tipo y año); si es null, del de la oficina.
-- El año es el del documento (p_year), no el del reloj del servidor.
create or replace function public.expedientes_next_doc_number(
  p_oficina uuid,
  p_tipo text,
  p_year integer default (extract(year from now()))::integer
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_num integer;
  v_ancho integer;
  v_sufijo text;
  v_segs text;
begin
  -- Toma y avanza el correlativo de forma atomica (crea la fila si no existe).
  insert into public.expedientes_doc_counters (oficina_id, tipo, siguiente, year)
  values (p_oficina, p_tipo, 2, p_year)
  on conflict (oficina_id, tipo, year)
  do update set siguiente = public.expedientes_doc_counters.siguiente + 1
  returning siguiente - 1 into v_num;

  -- El sufijo propio del tipo manda sobre el de la oficina; la fila del contador
  -- se busca por el MISMO año que se acaba de consumir.
  select o.ancho, coalesce(c.sufijo, o.sufijo)
    into v_ancho, v_sufijo
  from public.expedientes_oficinas o
  left join public.expedientes_doc_counters c
    on c.oficina_id = o.id and c.tipo = p_tipo and c.year = p_year
  where o.id = p_oficina;

  v_ancho := least(8, greatest(1, coalesce(v_ancho, 3)));

  -- Normaliza el sufijo: segmentos separados por "/" o "-", unidos con "/".
  -- Espejo de splitSufijo/joinSufijo en lib/document-number.ts, para que la
  -- sugerencia de la vista previa y el numero asignado no discrepen.
  if v_sufijo is not null and btrim(v_sufijo) <> '' then
    select string_agg(seg, '/')
      into v_segs
    from (
      select btrim(x) as seg
      from unnest(regexp_split_to_array(v_sufijo, '[/\-]')) as x
      where btrim(x) <> ''
    ) s;
  end if;

  if v_segs is not null and v_segs <> '' then
    return p_tipo || ' N° ' || lpad(v_num::text, v_ancho, '0') || '-' ||
           p_year || '-' || v_segs;
  end if;
  return p_tipo || ' N° ' || lpad(v_num::text, v_ancho, '0') || '-' || p_year;
end;
$$;

-- Verificacion rapida (opcional):
-- select public.expedientes_next_doc_number(
--   (select id from public.expedientes_oficinas where activo limit 1), 'INFORME');
