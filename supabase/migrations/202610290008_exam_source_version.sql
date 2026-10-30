begin;
create or replace function public.ace_exam_eligible(q public.exam_questions,p_preview boolean default false) returns boolean language sql stable set search_path=public as $$
 select coalesce(((q.status='published' and q.reviewed_by is not null and q.reviewed_at is not null and length(q.review_basis)>=20) or (p_preview and q.status='draft')) and jsonb_array_length(q.sources)>0 and not exists(
 select 1 from jsonb_array_elements(q.sources) s where not exists(select 1 from documents d where d.id::text=s->>'documentId' and d.es_institucional=true and d.status='indexed' and d.metadata->>'indexedTextComplete'='true' and d.metadata->>'sha256'=s->>'sha256' and d.title=s->>'title' and d.metadata->>'officialVersion'=s->>'version' and (d.metadata->>'regime'=q.regime or (d.metadata->'declaredRegimes')?q.regime))),false)
$$;
commit;
