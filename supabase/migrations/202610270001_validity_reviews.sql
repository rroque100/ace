begin;
create table public.document_validity_reviews (
 id uuid primary key default gen_random_uuid(), document_id uuid not null references public.documents(id),
 actor_id uuid not null references auth.users(id), revision integer not null,
 record jsonb not null, before_state jsonb not null, created_at timestamptz not null default now(),
 unique(document_id,revision)
);
alter table public.document_validity_reviews enable row level security;
revoke all on public.document_validity_reviews from anon,authenticated;
grant select,insert on public.document_validity_reviews to service_role;
revoke update,delete,truncate on public.document_validity_reviews from service_role;

create function public.ace_review_validity_v1(p_document uuid,p_actor uuid,p_review jsonb)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare doc public.documents; rev integer; rec jsonb; cache jsonb; reviewid uuid=gen_random_uuid(); reviewer text; article uuid;
begin
 select coalesce(nullif(btrim(nombre_completo),''),(case when role='admin' then 'Administrador' else 'Revisor jurídico' end)||' · perfil '||left(id::text,8))
 into reviewer from public.profiles where id=p_actor and activo is not false and role in('admin','legal');
 if not found then raise exception 'No autorizado' using errcode='42501';end if;
 if p_review->>'result' not in('current','partial','not_current','insufficient') or p_review->>'scope' not in('document','articles')
 or length(btrim(coalesce(p_review->>'version','')))<3 or length(p_review->>'version')>200
 or length(btrim(coalesce(p_review->>'basis','')))<20 or length(p_review->>'basis')>6000
 or coalesce(p_review->>'sourceUrl','') !~ '^https://([a-zA-Z0-9-]+\.)*gob\.pe(/|$)'
 or length(p_review->>'sourceUrl')>2000 or (p_review->>'asOf')::date>(now() at time zone 'America/Lima')::date or p_review->>'asOf' is null
 or p_review->>'revision' is null or p_review->>'result' is null or p_review->>'scope' is null
 or jsonb_typeof(p_review->'articleIds') is distinct from 'array' then raise exception 'Datos de revisión inválidos' using errcode='22023';end if;
 if jsonb_array_length(p_review->'articleIds')>30 or ((p_review->>'scope'='articles')<>(jsonb_array_length(p_review->'articleIds')>0))then raise exception 'Revisa el alcance' using errcode='22023';end if;
 if (select count(distinct value) from jsonb_array_elements_text(p_review->'articleIds'))<>jsonb_array_length(p_review->'articleIds')then raise exception 'Artículos repetidos' using errcode='22023';end if;
 select * into doc from public.documents where id=p_document for update;
 if not found or doc.es_institucional is not true or doc.status<>'indexed' then raise exception 'Documento institucional no disponible' using errcode='P0002';end if;
 rev=coalesce((doc.metadata->>'validityRevision')::integer,0);
 if rev<>(p_review->>'revision')::integer then raise exception 'La revisión cambió; vuelve a cargarla' using errcode='40001';end if;
 for article in select value::uuid from jsonb_array_elements_text(p_review->'articleIds') loop
  if not exists(select 1 from public.norma_articulos where id=article and document_id=p_document) then raise exception 'El artículo no pertenece a esta versión' using errcode='22023';end if;
 end loop;
 rec=jsonb_build_object('id',reviewid,'result',p_review->>'result','scope',p_review->>'scope','articleIds',p_review->'articleIds',
 'version',btrim(p_review->>'version'),'asOf',p_review->>'asOf','sourceUrl',p_review->>'sourceUrl','basis',btrim(p_review->>'basis'),
 'reviewer',reviewer,'recordedAt',now(),'revision',rev+1);
 cache=coalesce(doc.metadata->'validityReviews','{"articles":{}}'::jsonb);
 if p_review->>'scope'='document' then cache=jsonb_set(cache,'{document}',rec,true);
 else
  cache=cache-'document';
  cache=jsonb_set(cache,'{articles}',coalesce(cache->'articles','{}'::jsonb),true);
  for article in select value::uuid from jsonb_array_elements_text(p_review->'articleIds') loop cache=jsonb_set(cache,array['articles',article::text],rec,true);end loop;
 end if;
 insert into public.document_validity_reviews(id,document_id,actor_id,revision,record,before_state)
 values(reviewid,p_document,p_actor,rev+1,rec,coalesce(doc.metadata->'validityReviews','{}'::jsonb));
 update public.documents set metadata=coalesce(doc.metadata,'{}'::jsonb)||jsonb_build_object('validityReviews',cache,'validityRevision',rev+1)||
 case when p_review->>'scope'='document' then jsonb_build_object('vigencia',case p_review->>'result' when 'current' then 'vigente' when 'not_current' then 'no vigente' when 'partial' then 'parcialmente vigente' else 'por revisar' end) else jsonb_build_object('vigencia','por revisar') end where id=p_document;
 return rec;
end;$$;
revoke all on function public.ace_review_validity_v1(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.ace_review_validity_v1(uuid,uuid,jsonb) to service_role;

create function public.ace_invalidate_validity_v1() returns trigger language plpgsql set search_path=public as $$
begin
 if row(new.storage_path,new.storage_bucket,new.file_size,new.file_name,new.title,new.metadata->>'officialVersion',new.metadata->>'version',new.metadata->>'versionDate',new.metadata->>'updatedTextAt',new.metadata->>'sha256')
 is distinct from row(old.storage_path,old.storage_bucket,old.file_size,old.file_name,old.title,old.metadata->>'officialVersion',old.metadata->>'version',old.metadata->>'versionDate',old.metadata->>'updatedTextAt',old.metadata->>'sha256') then
  new.metadata=(coalesce(new.metadata,'{}'::jsonb)-'validityReviews')||jsonb_build_object('validityInvalidatedAt',now(),'validityRevision',coalesce((old.metadata->>'validityRevision')::integer,0)+1);
 end if;
 return new;
end;$$;
create trigger document_validity_invalidation before update on public.documents for each row execute function public.ace_invalidate_validity_v1();

create function public.ace_invalidate_article_validity_v1() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='INSERT' then
  update public.documents set metadata=(coalesce(metadata,'{}'::jsonb)-'validityReviews')||jsonb_build_object('validityInvalidatedAt',now(),'validityRevision',coalesce((metadata->>'validityRevision')::integer,0)+1) where id=new.document_id and metadata ? 'validityReviews';
 elsif tg_op='DELETE' or (tg_op='UPDATE' and row(new.content,new.article_number,new.document_id,new.metadata->'normativeBody') is distinct from row(old.content,old.article_number,old.document_id,old.metadata->'normativeBody')) then
  update public.documents set metadata=(coalesce(metadata,'{}'::jsonb)-'validityReviews')||jsonb_build_object('validityInvalidatedAt',now(),'validityRevision',coalesce((metadata->>'validityRevision')::integer,0)+1) where id=old.document_id and metadata ? 'validityReviews';
 end if;
 return old;
end;$$;
create trigger article_validity_invalidation after insert or update or delete on public.norma_articulos for each row execute function public.ace_invalidate_article_validity_v1();
create index document_validity_history on public.document_validity_reviews(document_id,revision desc);
create function public.ace_guard_validity_metadata_v1() returns trigger language plpgsql set search_path=public as $$
begin
 if current_user not in('postgres','service_role','supabase_admin') then
  if tg_op='INSERT' and (new.metadata ? 'validityReviews' or new.metadata ? 'validityRevision') then
   raise exception 'Registra la revisión mediante el formulario autorizado' using errcode='42501';
  elsif tg_op='UPDATE' and (new.metadata->'validityReviews' is distinct from old.metadata->'validityReviews' or new.metadata->'validityRevision' is distinct from old.metadata->'validityRevision') then
   raise exception 'Registra la revisión mediante el formulario autorizado' using errcode='42501';
  end if;
 end if;
 return new;
end;$$;
create trigger document_validity_guard before insert or update on public.documents for each row execute function public.ace_guard_validity_metadata_v1();
create function public.ace_reviewed_search_validity_v1() returns trigger language plpgsql set search_path=public as $$
declare rec jsonb=new.metadata->'validityReviews'->'document';
begin
 if rec->>'scope'='document' and rec->>'id' is not null then
  new.validity=case rec->>'result' when 'current' then 'current' when 'not_current' then 'not_current' else 'unknown' end;
 end if;
 return new;
end;$$;
create trigger reviewed_search_validity before insert or update on public.ace_search_documents_v2 for each row execute function public.ace_reviewed_search_validity_v1();
revoke all on function public.ace_invalidate_validity_v1(),public.ace_invalidate_article_validity_v1(),public.ace_guard_validity_metadata_v1(),public.ace_reviewed_search_validity_v1() from public,anon,authenticated;
grant execute on function public.ace_invalidate_validity_v1(),public.ace_invalidate_article_validity_v1(),public.ace_guard_validity_metadata_v1(),public.ace_reviewed_search_validity_v1() to service_role;
notify pgrst,'reload schema';
commit;
