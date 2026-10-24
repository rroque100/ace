begin;
-- Only the institutional projection participates. No anonymous/client access.
create or replace function public.ace_search_filtered_v3(p_filters jsonb default '{}') returns setof public.ace_search_documents_v2
language sql stable security invoker set search_path=public,extensions as $$
select d.* from public.ace_search_documents_v2 d where (coalesce(p_filters->>'documentId','')='' or d.document_id::text=p_filters->>'documentId')
 and (case when coalesce(jsonb_array_length(p_filters->'documentTypes'),0)>0 then p_filters->'documentTypes' ? d.document_type else coalesce(p_filters->>'documentType','')='' or d.document_type=p_filters->>'documentType' end)
 and (case when coalesce(jsonb_array_length(p_filters->'years'),0)>0 then p_filters->'years' @> jsonb_build_array(d.registered_year) else coalesce(p_filters->>'year','')='' or d.registered_year=(p_filters->>'year')::integer end)
 and (coalesce(p_filters->>'regime','')='' or d.regime=p_filters->>'regime' or (p_filters->'includeUnknownRegime'='true'::jsonb and d.regime='no_determinado' and p_filters->>'regime'<>'no_determinado'))
 and (coalesce(p_filters->>'sourceEntity','')='' or position(public.ace_search_normalize_v1(p_filters->>'sourceEntity') in public.ace_search_normalize_v1(d.source_entity))>0)
 and (coalesce(p_filters->>'processType','')='' or d.process_type in (p_filters->>'processType','todos'))
 and (coalesce(p_filters->>'topic','')='' or position(public.ace_search_normalize_v1(p_filters->>'topic') in public.ace_search_normalize_v1(d.metadata->>'topic'))>0)
 and (coalesce(p_filters->>'status','')='' or position(public.ace_search_normalize_v1(p_filters->>'status') in public.ace_search_normalize_v1(d.metadata->>'status'))>0)
 and (coalesce(p_filters->>'vigencia','')='' or (p_filters->>'vigencia'='vigente' and d.validity='current') or (p_filters->>'vigencia' in ('no vigente','derogado') and d.validity='not_current') or (p_filters->>'vigencia'='unknown' and d.validity='unknown') or (p_filters->>'vigencia' not in ('vigente','no vigente','derogado','unknown') and position(public.ace_search_normalize_v1(p_filters->>'vigencia') in public.ace_search_normalize_v1(d.metadata->>'vigencia'))>0))
 and (coalesce(p_filters->>'publishedFrom','')='' or d.published>=public.ace_search_date_v2(p_filters->>'publishedFrom'))
 and (coalesce(p_filters->>'publishedTo','')='' or d.published<=public.ace_search_date_v2(p_filters->>'publishedTo'))
 and (coalesce(p_filters->>'object','')='' or (p_filters->>'object'='sin_clasificar' and jsonb_array_length(d.classification->'objects')=0) or d.classification->'objects' ? (p_filters->>'object'))
 and (coalesce(p_filters->>'subject','')='' or (p_filters->>'subject'='sin_clasificar' and jsonb_array_length(d.classification->'subjects')=0) or d.classification->'subjects' ? (p_filters->>'subject'))
 and (coalesce(p_filters->>'guidedTopic','')='' or (p_filters->>'guidedTopic'='sin_clasificar' and jsonb_array_length(d.classification->'topics')=0) or d.classification->'topics' ? (p_filters->>'guidedTopic'))
and (coalesce(p_filters->>'article','')='' or exists(select 1 from public.ace_search_chunks_v2 c where c.document_id=d.document_id and c.article=split_part(p_filters->>'article','.',1)))
$$;
create or replace function public.ace_search_candidates_v3(p_filters jsonb default '{}') returns jsonb
language sql stable security invoker set search_path=public,extensions as $$
with candidates as (select document_id,title,document_type,source_entity,process_type,metadata from public.ace_search_filtered_v3(p_filters) order by document_id limit 10001)
select jsonb_build_object('overflow',count(*)>10000,'documents',coalesce(jsonb_agg(jsonb_build_object('id',document_id,'title',title,'document_type',document_type,'source_entity',source_entity,'process_type',process_type,'metadata',metadata) order by document_id),'[]'::jsonb)) from candidates
$$;
create table if not exists public.ace_search_terms_v3(document_id uuid references public.ace_search_documents_v2(document_id) on delete cascade,term text not null,primary key(document_id,term));
alter table public.ace_search_terms_v3 enable row level security;
revoke all on public.ace_search_terms_v3 from public,anon,authenticated;
grant all on public.ace_search_terms_v3 to service_role;
create index if not exists ace_search_terms_token_v3 on public.ace_search_terms_v3(term);
create index if not exists ace_search_terms_trgm_v3 on public.ace_search_terms_v3 using gin(term extensions.gin_trgm_ops);
create or replace function public.ace_search_sync_terms_v3() returns trigger language plpgsql security invoker set search_path=public,extensions as $$
begin
 delete from public.ace_search_terms_v3 where document_id=new.document_id;
 insert into public.ace_search_terms_v3(document_id,term)
 select new.document_id,t from (select distinct t from regexp_split_to_table(new.normalized_title||' '||new.normalized_body,'[^a-z]+') t where length(t) between 4 and 30) words;
 return new;
end $$;
drop trigger if exists ace_search_terms_sync_v3 on public.ace_search_documents_v2;
create trigger ace_search_terms_sync_v3 after insert or update of normalized_title,normalized_body on public.ace_search_documents_v2 for each row execute function public.ace_search_sync_terms_v3();
insert into public.ace_search_terms_v3(document_id,term) select d.document_id,t from public.ace_search_documents_v2 d cross join lateral (select distinct t from regexp_split_to_table(d.normalized_title||' '||d.normalized_body,'[^a-z]+') t where length(t) between 4 and 30) words on conflict do nothing;
create or replace function public.ace_search_suggestions_v3(p_query text,p_filters jsonb default '{}') returns jsonb
language sql stable security invoker set search_path=public,extensions as $$
with terms as (select distinct t from regexp_split_to_table(public.ace_search_normalize_v1(left(p_query,200)),'[^a-z]+') t where length(t) between 5 and 30 limit 12),
docs as(select d.document_id,d.title,d.document_type,d.identifier,(case when d.identifier=public.ace_search_identifier_v2(p_query) then 2 else 0 end)+similarity(d.normalized_title,public.ace_search_normalize_v1(p_query)) relevance from public.ace_search_filtered_v3(p_filters) d where length(p_query) between 2 and 200 and (d.normalized_title like public.ace_search_pattern_v2(p_query) or (length(public.ace_search_identifier_v2(p_query))>1 and d.identifier=public.ace_search_identifier_v2(p_query)) or (p_query !~ '[0-9]' and d.normalized_title % public.ace_search_normalize_v1(p_query))) order by relevance desc,d.document_id limit 6),
vocabulary as(select q.t,word.term,word.relevance from terms q cross join lateral(select v.term,max(similarity(v.term,q.t)) relevance from public.ace_search_terms_v3 v where v.term % q.t and exists(select 1 from public.ace_search_filtered_v3(p_filters) d where d.document_id=v.document_id) group by v.term order by relevance desc,v.term limit 6) word)
select jsonb_build_object('documents',coalesce((select jsonb_agg(jsonb_build_object('documentId',document_id,'title',title,'documentType',document_type) order by relevance desc,document_id) from docs),'[]'::jsonb),'vocabulary',coalesce((select jsonb_agg(distinct term) from vocabulary),'[]'::jsonb))
$$;
revoke all on function public.ace_search_filtered_v3(jsonb),public.ace_search_candidates_v3(jsonb),public.ace_search_sync_terms_v3(),public.ace_search_suggestions_v3(text,jsonb) from public,anon,authenticated;
grant execute on function public.ace_search_filtered_v3(jsonb),public.ace_search_candidates_v3(jsonb),public.ace_search_sync_terms_v3(),public.ace_search_suggestions_v3(text,jsonb) to service_role;
analyze public.ace_search_terms_v3;
notify pgrst,'reload schema';
commit;
