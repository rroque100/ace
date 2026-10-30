begin;
create or replace function public.ace_review_entity_v1(p_actor uuid,p_input jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare oldrow legal_entities; newrow legal_entities; link record; k text;
begin
 select * into oldrow from legal_entities where id=(p_input->>'id')::uuid for update;
 if not found then raise exception 'Entidad ausente' using errcode='P0002';end if;
 if oldrow.revision<>(p_input->>'revision')::integer then raise exception 'Revisión desactualizada' using errcode='40001';end if;
 update legal_entities set name=p_input->>'name',aliases=array(select jsonb_array_elements_text(p_input->'aliases')),ruc=nullif(p_input->>'ruc',''),status=p_input->>'status',ruc_verified=(p_input->>'rucVerified')::boolean,source_url=p_input->>'sourceUrl',evidence=p_input->>'evidence',reviewed_by=p_actor,reviewed_at=now(),revision=revision+1 where id=oldrow.id returning * into newrow;
 insert into legal_entity_reviews(entity_id,actor_id,before_record,after_record,reason)values(oldrow.id,p_actor,to_jsonb(oldrow),to_jsonb(newrow),p_input->>'reason');
 for link in select document_id,role from legal_entity_documents where entity_id=oldrow.id loop
 k:=case link.role when 'requester' then 'requestingEntity' when 'contracting' then 'contractingEntity' else null end;
 if k is not null and newrow.status<>'rejected' then
 update documents set metadata=metadata||jsonb_build_object(k,newrow.name,k||'ReviewStatus',newrow.status,k||'DirectoryId',newrow.id,k||'ReviewSource',newrow.source_url)||case when newrow.ruc_verified then jsonb_build_object(k||'Ruc',newrow.ruc)else '{}'::jsonb end where id=link.document_id and es_institucional=true;
 end if;
 end loop;
 return to_jsonb(newrow);
end;$$;
revoke all on function public.ace_review_entity_v1(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.ace_review_entity_v1(uuid,jsonb) to service_role;
commit;
