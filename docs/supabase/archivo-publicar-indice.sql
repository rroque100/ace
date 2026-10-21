-- Aplicar después de expediente-legajo.sql. Publicación atómica y CAS por documento.
-- Solo el backend puede publicar; los endpoints verifican usuario y oficina.
create or replace function public.archivo_publicar_indice(
  p_id uuid, p_base timestamptz, p_chunks jsonb, p_patch jsonb
) returns jsonb
language plpgsql security invoker set search_path = public
as $$
declare
  anterior public.expedientes_archivo;
  siguiente public.expedientes_archivo;
  viejos jsonb;
begin
  select * into anterior from public.expedientes_archivo where id = p_id for update;
  if not found then raise exception 'Documento inexistente'; end if;
  if anterior.updated_at is distinct from p_base then
    raise exception 'El documento cambió durante el procesamiento; vuelve a intentar' using errcode = '40001';
  end if;
  if jsonb_typeof(p_chunks) <> 'array' or jsonb_array_length(p_chunks) = 0 then
    raise exception 'El índice no puede estar vacío';
  end if;
  select coalesce(jsonb_agg(pinecone_vector_id) filter (where pinecone_vector_id is not null), '[]'::jsonb)
    into viejos from public.expedientes_archivo_chunks where documento_id = p_id;
  siguiente := jsonb_populate_record(anterior, p_patch);
  delete from public.expedientes_archivo_chunks where documento_id = p_id;
  insert into public.expedientes_archivo_chunks
    (id, documento_id, expediente_id, chunk_index, content, page_start, page_end, pinecone_vector_id, metadata)
    select x.id, p_id, anterior.expediente_id, x.chunk_index, x.content, x.page_start, x.page_end, x.pinecone_vector_id, x.metadata
    from jsonb_to_recordset(p_chunks) as x(id uuid, chunk_index int, content text, page_start int, page_end int, pinecone_vector_id text, metadata jsonb);
  update public.expedientes_archivo set
    anio = siguiente.anio, asunto = siguiente.asunto, body_text = siguiente.body_text,
    folio = siguiente.folio, materia = siguiente.materia, tipo_documento = siguiente.tipo_documento,
    oficina = siguiente.oficina, metadata = siguiente.metadata, serie_documento = siguiente.serie_documento,
    resumen = siguiente.resumen, file_name = siguiente.file_name, file_size = siguiente.file_size,
    mime_type = siguiente.mime_type, storage_bucket = siguiente.storage_bucket, storage_path = siguiente.storage_path,
    status = 'indexed', error_message = null, updated_at = clock_timestamp()
    where id = p_id;
  return jsonb_build_object('oldVectorIds', viejos);
end;
$$;
revoke all on function public.archivo_publicar_indice(uuid,timestamptz,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.archivo_publicar_indice(uuid,timestamptz,jsonb,jsonb) to service_role;
notify pgrst, 'reload schema';
