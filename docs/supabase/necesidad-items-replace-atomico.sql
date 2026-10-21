-- Reemplazo ATÓMICO del cuadro de ítems (sección 3.2) de una necesidad.
--
-- `PUT /api/necesidades/[id]/items` borraba todas las filas de `necesidad_items`
-- y las reinsertaba en dos llamadas PostgREST separadas (sin transacción). Si el
-- DELETE tenía éxito y el INSERT fallaba después (violación de constraint, corte
-- de red), el cuadro quedaba VACÍO en la base sin forma de deshacerlo.
--
-- Esta función hace el borrado y la reinserción dentro de la misma transacción
-- de PostgreSQL (una función plpgsql es una única sentencia para PostgREST), así
-- que un fallo a mitad de camino revierte TODO, no deja el cuadro a medias.
--
-- `security invoker`: corre como el rol que llama (el usuario autenticado), así
-- que las políticas RLS de `necesidad_items_write` se siguen aplicando igual que
-- si la ruta hiciera el DELETE/INSERT directamente — el enforcement sigue siendo
-- RLS, esta función solo junta los dos pasos en una transacción.
--
-- Falta aplicar: ejecutar en el SQL Editor de Supabase. Hasta entonces la ruta
-- cae al DELETE+INSERT de siempre (mismo riesgo que antes, no peor).

create or replace function public.necesidad_items_replace(
  p_necesidad_id uuid,
  p_items jsonb
) returns setof necesidad_items
language plpgsql
security invoker
set search_path = public
as $$
begin
  delete from necesidad_items where necesidad_id = p_necesidad_id;

  insert into necesidad_items (
    necesidad_id, nro, descripcion, codigo_catalogo, unidad_medida,
    cantidad, costo_unitario, costo_total, tipo_objeto, nro_paquete, descripcion_paquete
  )
  select
    p_necesidad_id,
    (elem->>'nro')::integer,
    elem->>'descripcion',
    elem->>'codigo_catalogo',
    elem->>'unidad_medida',
    (elem->>'cantidad')::numeric,
    (elem->>'costo_unitario')::numeric,
    (elem->>'costo_total')::numeric,
    elem->>'tipo_objeto',
    (elem->>'nro_paquete')::integer,
    elem->>'descripcion_paquete'
  from jsonb_array_elements(p_items) as elem;

  return query
    select * from necesidad_items where necesidad_id = p_necesidad_id order by nro;
end;
$$;

revoke all on function public.necesidad_items_replace(uuid, jsonb) from public, anon;
grant execute on function public.necesidad_items_replace(uuid, jsonb) to authenticated;
