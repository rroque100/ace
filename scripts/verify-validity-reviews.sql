-- Integration checks only. Every change below is rolled back.
begin;
set local role service_role;
do $$
declare actor uuid; doc uuid; art uuid; rev integer; rec jsonb; data jsonb; count_before integer;
begin
 select id into actor from public.profiles where activo is not false and role='admin' order by id limit 1;
 select d.id into doc from public.documents d where d.es_institucional is true and d.status='indexed'
 and exists(select 1 from public.norma_articulos a where a.document_id=d.id) order by d.id limit 1;
 if actor is null or doc is null then raise exception 'Missing authorized fixture';end if;
 perform set_config('ace.test_actor',actor::text,true);
 perform set_config('ace.test_document',doc::text,true);
 select id into art from public.norma_articulos where document_id=doc order by id limit 1;
 select coalesce((metadata->>'validityRevision')::integer,0) into rev from public.documents where id=doc;
 select count(*) into count_before from public.document_validity_reviews where document_id=doc;
 data=jsonb_build_object('result','current','scope','document','articleIds','[]'::jsonb,'version','Transactional test only',
 'asOf','2026-01-01','sourceUrl','https://www.gob.pe/','basis','Transactional test, not a real legal review. Must be rolled back.','revision',rev);
 rec=public.ace_review_validity_v1(doc,actor,data);
 if rec->>'reviewer' is null or rec->>'recordedAt' is null then raise exception 'Missing server audit';end if;
 if not exists(select 1 from public.documents where id=doc and metadata->'validityReviews'->'document'->>'id'=rec->>'id') then raise exception 'Missing active review';end if;
 if not exists(select 1 from public.ace_search_documents_v2 where document_id=doc and validity='current' and metadata->'validityReviews'->'document'->>'id'=rec->>'id')then raise exception 'Search index not synchronized';end if;
 begin
  perform public.ace_review_validity_v1(doc,actor,data);
  raise exception 'Stale revision accepted';
 exception when serialization_failure then null;end;
 begin
  perform public.ace_review_validity_v1(doc,'00000000-0000-4000-8000-999999999999',data);
  raise exception 'Unauthorized reviewer accepted';
 exception when insufficient_privilege then null;end;
 data=data||jsonb_build_object('revision',rev+1,'scope','articles','articleIds',jsonb_build_array(art),'result','not_current');
 perform public.ace_review_validity_v1(doc,actor,data);
 if not exists(select 1 from public.documents where id=doc and not(metadata->'validityReviews' ? 'document') and metadata->>'vigencia'='por revisar' and metadata->'validityReviews'->'articles'->art::text->>'result'='not_current')then raise exception 'Article review incorrectly confirmed whole document';end if;
 begin
  perform public.ace_review_validity_v1(doc,actor,data||jsonb_build_object('revision',rev+2,'articleIds',jsonb_build_array('00000000-0000-4000-8000-999999999999')));
  raise exception 'Foreign article accepted';
 exception when invalid_parameter_value then null;end;
 update public.documents set file_name=file_name||'.rollback-test' where id=doc;
 if exists(select 1 from public.documents where id=doc and metadata ? 'validityReviews')then raise exception 'File change did not invalidate review';end if;
 if exists(select 1 from public.ace_search_documents_v2 where document_id=doc and validity='current')then raise exception 'Invalidated document still filtered as current';end if;
 if (select count(*) from public.document_validity_reviews where document_id=doc)<>count_before+2 then raise exception 'History lost';end if;
 select coalesce((metadata->>'validityRevision')::integer,0) into rev from public.documents where id=doc;
 perform public.ace_review_validity_v1(doc,actor,data||jsonb_build_object('revision',rev));
 update public.norma_articulos set content=content||E'\n' where id=art;
 if exists(select 1 from public.documents where id=doc and metadata ? 'validityReviews')then raise exception 'Article change did not invalidate review';end if;
 if (select count(*) from public.document_validity_reviews where document_id=doc)<>count_before+3 then raise exception 'Article history lost';end if;
 begin
  update public.document_validity_reviews set record='{}' where document_id=doc;
  raise exception 'History was mutable';
 exception when insufficient_privilege then null;end;
end;$$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('ace.test_actor'),'role','authenticated')::text,true);
set local role authenticated;
do $$
begin
 begin
  perform public.ace_review_validity_v1(current_setting('ace.test_document')::uuid,current_setting('ace.test_actor')::uuid,'{}');
  raise exception 'Direct RPC accepted';
 exception when insufficient_privilege then null;end;
 begin
  perform 1 from public.document_validity_reviews limit 1;
  raise exception 'Raw history table accessible';
 exception when insufficient_privilege then null;end;
 begin
  update public.documents set metadata=coalesce(metadata,'{}')||'{"validityReviews":{"document":{"result":"current"}}}'::jsonb where id=current_setting('ace.test_document')::uuid;
  if found then raise exception 'Direct review metadata forgery accepted';end if;
 exception when insufficient_privilege then null;end;
end;$$;
rollback;
select 'Validity review checks passed; transaction rolled back.' as result;
