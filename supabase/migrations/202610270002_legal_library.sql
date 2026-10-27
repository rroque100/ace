begin;
alter table public.documents drop constraint if exists documents_document_type_check;
alter table public.documents add constraint documents_document_type_check check(document_type in('ley','reglamento','opinion','directiva','bases_integradas','resolucion','contrato','expediente','otros','acuerdo_sala_plena','pronunciamiento','informe_vicio_nulidad','bases_estandar','guia_instructivo','lineamiento','codigo_etica','comunicado','indice_documental'));

create or replace function public.ace_library_collections_v1(title text,m jsonb) returns jsonb language sql immutable set search_path=public as $$
select case when m->'libraryCollections'->'reviewed'='true'::jsonb then coalesce(m->'libraryCollections'->'values','[]'::jsonb) else
 (select coalesce(jsonb_agg(id),'[]'::jsonb) from(values('rnp','\mrnp\M|registro nacional de proveedores'),('seace','\mseace\M'),('obras','\mobra|valorizacion|cuaderno de incidencia'),('garantias','garantia|fiel cumplimiento|retencion'),('arbitraje','arbitra|disputa|controversia|jprd|regaju'),('sanciones','sancion|multa|inhabilitacion')) t(id,pattern) where public.ace_search_normalize_v1(title||' '||coalesce(m->>'topic',''))~pattern) end;
$$;
create or replace function public.ace_library_filter_v1(title text,m jsonb,f jsonb) returns boolean language sql immutable set search_path=public as $$
select (coalesce(f->>'collection','')='' or public.ace_library_collections_v1(title,m)?(f->>'collection'))
and (coalesce(f->>'contractingEntity','')='' or position(public.ace_search_normalize_v1(f->>'contractingEntity') in public.ace_search_normalize_v1(coalesce(m->>'contractingEntity','')||' '||coalesce(m->>'requestingEntity','')))>0)
and (coalesce(f->>'ruc','')='' or m->>'contractingEntityRuc'=f->>'ruc' or m->>'requestingEntityRuc'=f->>'ruc');
$$;

-- Extend only the documented type allowlist, keeping current review and filtering logic intact.
do $$ declare fn record; definition text; begin
 for fn in select oid,proname from pg_proc where pronamespace='public'::regnamespace and proname in('ace_refresh_search_document_v2','ace_search_library_counts_v2','ace_literal_document_search_v1') loop
  definition:=pg_get_functiondef(fn.oid);
  if position('''lineamiento''' in definition)=0 and position('''guia_instructivo''' in definition)>0 then
   execute replace(definition,'''guia_instructivo''','''guia_instructivo'',''lineamiento'',''codigo_etica'',''comunicado'',''indice_documental''');
  end if;
 end loop;
 for fn in select oid,proname from pg_proc where pronamespace='public'::regnamespace and proname in('ace_search_filtered_v3','ace_search_documents_page_v2') loop
  definition:=pg_get_functiondef(fn.oid);
  if position('ace_library_filter_v1' in definition)=0 then
   if position('where (coalesce(p_filters' in definition)>0 then
    execute replace(definition,'where (coalesce(p_filters','where public.ace_library_filter_v1(d.title,d.metadata,p_filters) and (coalesce(p_filters');
   elsif position('where (d.normalized_body' in definition)>0 then
    execute replace(definition,'where (d.normalized_body','where public.ace_library_filter_v1(d.title,d.metadata,p_filters) and (d.normalized_body');
   else raise exception 'Unexpected search function definition: %',fn.proname; end if;
  end if;
 end loop;
end $$;

create or replace function public.ace_library_catalogue_v1(p_filters jsonb default '{}',p_page integer default 1) returns jsonb language sql stable security invoker set search_path=public,extensions as $$
with eligible as materialized (
 select d.*,public.ace_library_collections_v1(d.title,d.metadata) collections from public.documents d where es_institucional=true
 and document_type in('ley','reglamento','directiva','opinion','resolucion','acuerdo_sala_plena','pronunciamiento','informe_vicio_nulidad','bases_estandar','guia_instructivo','lineamiento','codigo_etica','comunicado','indice_documental')
), filtered as materialized (
 select * from eligible d where public.ace_library_filter_v1(title,metadata,p_filters)
 and (coalesce(p_filters->>'view','')<>'templates' or document_type='bases_estandar')
 and (coalesce(p_filters->>'view','')<>'templates' or p_filters->>'editableOnly'='false' or mime_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document')
 and (coalesce(p_filters->>'documentType','')='' or document_type=p_filters->>'documentType')
 and (coalesce(p_filters->>'q','')='' or not exists(select 1 from regexp_split_to_table(public.ace_search_normalize_v1(p_filters->>'q'),'\s+') word where position(word in public.ace_search_normalize_v1(title||' '||coalesce(metadata->>'documentNumber','')))=0))
 and (coalesce(p_filters->>'processType','')='' or process_type=p_filters->>'processType' or metadata->>'procedureCode'=p_filters->>'processType')
 and (coalesce(p_filters->>'object','')='' or metadata->>'contractObject'=p_filters->>'object')
 and (coalesce(p_filters->>'publishedFrom','')='' or public.ace_search_date_v2(metadata->>'publicationDate')>=public.ace_search_date_v2(p_filters->>'publishedFrom'))
 and (coalesce(p_filters->>'publishedTo','')='' or public.ace_search_date_v2(metadata->>'publicationDate')<=public.ace_search_date_v2(p_filters->>'publishedTo'))
 and (coalesce(p_filters->>'version','')='' or position(public.ace_search_normalize_v1(p_filters->>'version') in public.ace_search_normalize_v1(coalesce(metadata->>'officialVersion','')||' '||title))>0)
 and (coalesce(p_filters->>'regime','')='' or (case when metadata->'regimeReviewed'='true'::jsonb or metadata->>'regimeReviewStatus'='confirmed' then metadata->>'regime' else 'no_determinado' end)=p_filters->>'regime')
), counts as(select count(*)::integer total from filtered), bounds as(select total,greatest(1,least(greatest(1,p_page),greatest(1,ceil(total/12.0)::integer))) page from counts), selected as(
 select * from filtered order by case when p_filters->>'view'='news' then public.ace_search_date_v2(metadata->>'publicationDate') end desc nulls last,case when p_filters->>'view'='news' then created_at end desc,title,id limit 12 offset(select (page-1)*12 from bounds)
)
select jsonb_build_object('documents',coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title,'documentType',document_type,'sourceEntity',source_entity,'processType',process_type,'status',status,'mimeType',mime_type,'metadata',metadata,'createdAt',created_at,'collections',collections))from selected),'[]'::jsonb),'total',total,'page',page,'pages',ceil(total/12.0)::integer,
 'facets',jsonb_build_object('collections',(select coalesce(jsonb_object_agg(value,n),'{}'::jsonb) from(select value,count(*) n from eligible,jsonb_array_elements_text(collections) value group by value)x),'entityClassified',(select count(*) from eligible where coalesce(metadata->>'contractingEntity',metadata->>'requestingEntity')is not null),'rucClassified',(select count(*) from eligible where coalesce(metadata->>'contractingEntityRuc',metadata->>'requestingEntityRuc')is not null))) from bounds;
$$;
revoke all on function public.ace_library_catalogue_v1(jsonb,integer) from public,anon,authenticated;
grant execute on function public.ace_library_catalogue_v1(jsonb,integer) to service_role;

create table if not exists public.legal_source_work_links(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),document_id uuid not null references public.documents(id),target_type text not null check(target_type in('necesidad','expediente','contrato_sie','contrato_cp')),target_id uuid not null,snapshot jsonb not null,comment text not null default '',created_at timestamptz not null default now());
create index if not exists legal_source_work_links_owner on public.legal_source_work_links(owner_id,target_type,target_id);
alter table public.legal_source_work_links enable row level security;
drop policy if exists legal_source_work_links_owner on public.legal_source_work_links;
create policy legal_source_work_links_owner on public.legal_source_work_links for all to authenticated using(owner_id=auth.uid())with check(owner_id=auth.uid());
grant select,insert,update,delete on public.legal_source_work_links to authenticated;
grant all on public.legal_source_work_links to service_role;
commit;
