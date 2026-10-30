-- Non-destructive regression checks: every fixture and correction is rolled back.
begin;
do $$
declare cat jsonb; filtered jsonb; fixture uuid; actor uuid; target public.norma_articulos; source public.norma_concordancias; outcome jsonb; n integer;
begin
 cat=public.ace_normative_catalogue_v1('{}',array['ley','reglamento','directiva'],'',1,5);
 if (cat->>'total')::integer<1 or jsonb_array_length(cat->'documents')>5 then raise exception 'Fallo de paginación';end if;
 filtered=public.ace_normative_catalogue_v1(jsonb_build_object('vigencia','vigente'),array['ley','reglamento','directiva'],'',1,50);
 if exists(select 1 from jsonb_array_elements(filtered->'documents') d where d->'metadata'->>'vigencia' ilike '%no vigente%')then raise exception 'Vigencia incorrecta';end if;
 if has_function_privilege('authenticated','public.ace_correct_reference_v1(uuid,uuid,uuid,uuid,text,integer)','execute') then raise exception 'Acceso directo no permitido';end if;
 select id into actor from public.profiles where role='admin' and activo is not false limit 1;
 select a.* into target from public.norma_articulos a join public.documents d on d.id=a.document_id where d.es_institucional=true and d.status='indexed' limit 1;
 select c.* into source from public.norma_concordancias c join public.documents d on d.id=c.source_document_id where d.es_institucional=true and c.source_article_id is not null limit 1;
 if actor is null or target.id is null or source.id is null then raise exception 'Falta fixture institucional para comprobar';end if;
 select * into target from public.norma_articulos where document_id=source.source_document_id limit 1;
 insert into public.norma_concordancias(source_document_id,source_article_id,source_article_number,ref_type,raw_text,resolved,metadata)
 values(source.source_document_id,source.source_article_id,source.source_article_number,'interno','Prueba transaccional reversible',false,'{}')returning id into fixture;
 outcome=public.ace_correct_reference_v1(fixture,actor,target.document_id,target.id,'Prueba de destino y auditoría, revertida al terminar',0);
 select count(*) into n from public.normative_reference_reviews where reference_id=fixture;
 if n<>1 or (outcome->>'revision')::integer<>1 then raise exception 'La corrección no quedó auditada';end if;
 begin
  perform public.ace_correct_reference_v1(fixture,actor,target.document_id,target.id,'Revisión concurrente rechazada',0);
  raise exception 'Se permitió sobrescribir una revisión concurrente';
 exception when serialization_failure then null;end;
 outcome=public.ace_review_article_body_v1(target.id,actor,'Cuerpo de prueba reversible','Verificación transaccional de la estructura',coalesce((target.metadata->>'bodyRevision')::integer,0));
 if not exists(select 1 from public.normative_structure_reviews where article_id=target.id and actor_id=actor)then raise exception 'Falta auditoría del cuerpo';end if;
 raise notice 'Paginación, vigencia, permisos, concurrencia y auditoría correctos. Se revertirán todas las escrituras de prueba.';
end;$$;
rollback;
