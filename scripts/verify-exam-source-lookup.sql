-- Compara la optimización con la regla anterior sin modificar funciones persistentes.
begin isolation level repeatable read;
create function pg_temp.exam_eligible_before(q public.exam_questions,p_preview boolean) returns boolean language sql stable set search_path=public as $$
 select coalesce(((q.status='published' and q.reviewed_by is not null and q.reviewed_at is not null and length(q.review_basis)>=20) or (p_preview and q.status='draft')) and jsonb_array_length(q.sources)>0 and not exists(
 select 1 from jsonb_array_elements(q.sources) s where not exists(select 1 from documents d where d.id::text=s->>'documentId' and d.es_institucional=true and d.status='indexed' and d.metadata->>'indexedTextComplete'='true' and d.metadata->>'sha256'=s->>'sha256' and d.title=s->>'title' and d.metadata->>'officialVersion'=s->>'version' and (d.metadata->>'regime'=q.regime or (d.metadata->'declaredRegimes')?q.regime))),false)
$$;
create temp table cases as
select 'bank:'||id as name,to_jsonb(q) payload from exam_questions q
union all
select v.name,v.payload from (select to_jsonb(q) base from exam_questions q order by id limit 1) q
cross join lateral (values
 ('draft',jsonb_set(base,'{status}','"draft"')),
 ('retired',jsonb_set(base,'{status}','"retired"')),
 ('unreviewed',jsonb_set(base,'{reviewed_by}','null')),
 ('short_basis',jsonb_set(base,'{review_basis}','"short"')),
 ('empty_sources',jsonb_set(base,'{sources}','[]')),
 ('bad_id',jsonb_set(base,'{sources,0,documentId}','"invalid-uuid"')),
 ('upper_id',jsonb_set(base,'{sources,0,documentId}',to_jsonb(upper(base#>>'{sources,0,documentId}')))),
 ('null_id',jsonb_set(base,'{sources,0,documentId}','null')),
 ('missing_id',base#-'{sources,0,documentId}'),
 ('wrong_hash',jsonb_set(base,'{sources,0,sha256}','"wrong"'))
)v(name,payload);
do $$
begin
 if exists(select 1 from cases c cross join (values(false),(true)) modes(preview)
 where pg_temp.exam_eligible_before(jsonb_populate_record(null::exam_questions,c.payload),modes.preview)
 is distinct from ace_exam_eligible(jsonb_populate_record(null::exam_questions,c.payload),modes.preview)) then
  raise exception 'La optimización cambió los criterios de elegibilidad';
 end if;
end $$;
select count(*)*2 as comparaciones_equivalentes from cases;
rollback;
