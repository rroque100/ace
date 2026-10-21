-- Merge ATÓMICO de un parche sobre documents.metadata (JSONB).
--
-- Varias rutas del módulo EETT/TDR guardaban sub-claves distintas de `metadata`
-- (propuesta, revision, textoExtraido, contenidoHtml, trasladados) con un
-- read-modify-write en la aplicación: leían el objeto entero y lo reescribían.
-- Dos escrituras concurrentes de claves distintas —p. ej. cachear el OCR mientras
-- se genera la propuesta— se pisaban (lost update).
--
-- Esta función hace el merge en el servidor, bajo `for update`, de modo que las
-- escrituras concurrentes se serializan y ninguna pierde a la otra. El merge es
-- de UN NIVEL: si la clave existente y la del parche son objetos, se fusionan sus
-- sub-claves (así `trasladados` acumula); en otro caso, el parche reemplaza.
--
-- Filtra por kind/necesidadId para no tocar un documento ajeno (misma comprobación
-- que hacían las rutas). Solo la puede ejecutar service_role (las rutas escriben
-- la metadata con service_role); no se expone a usuarios autenticados.
--
-- Idempotente: se puede ejecutar varias veces sin efecto.
--
-- Aplicado el 2026-07-30 vía MCP (migración `merge_document_metadata`).

create or replace function public.merge_document_metadata(
  p_id uuid,
  p_necesidad_id text,
  p_patch jsonb
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  k text;
  v jsonb;
  merged jsonb;
begin
  select coalesce(metadata, '{}'::jsonb) into merged
  from public.documents
  where id = p_id
    and metadata->>'kind' = 'eett_tdr'
    and metadata->>'necesidadId' = p_necesidad_id
  for update;

  if not found then
    return; -- documento inexistente o de otra necesidad: no se toca
  end if;

  for k, v in select key, value from jsonb_each(p_patch) loop
    if jsonb_typeof(merged -> k) = 'object' and jsonb_typeof(v) = 'object' then
      merged := jsonb_set(merged, array[k], (merged -> k) || v);
    else
      merged := jsonb_set(merged, array[k], v);
    end if;
  end loop;

  update public.documents set metadata = merged where id = p_id;
end;
$$;

-- Solo service_role: las rutas escriben la metadata con service_role. Supabase
-- concede EXECUTE a authenticated/anon por default privileges, así que se revoca
-- explícitamente además de a public.
revoke all on function public.merge_document_metadata(uuid, text, jsonb) from public, authenticated, anon;
grant execute on function public.merge_document_metadata(uuid, text, jsonb) to service_role;
