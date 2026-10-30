begin;
alter table public.documents drop constraint if exists documents_document_type_check;
alter table public.documents add constraint documents_document_type_check check(document_type in('ley','reglamento','opinion','directiva','bases_integradas','resolucion','contrato','expediente','otros','acuerdo_sala_plena','pronunciamiento','informe_vicio_nulidad','bases_estandar','guia_instructivo','lineamiento','codigo_etica','comunicado','indice_documental','laudo_arbitral'));
do $$declare f record;d text;begin
 for f in select oid,proname from pg_proc where pronamespace='public'::regnamespace and proname in('ace_refresh_search_document_v2','ace_search_library_counts_v2','ace_literal_document_search_v1','ace_library_catalogue_v1')loop
 d:=pg_get_functiondef(f.oid);if position('''laudo_arbitral''' in d)=0 and position('''indice_documental''' in d)>0 then execute replace(d,'''indice_documental''','''indice_documental'',''laudo_arbitral''');end if;
 end loop;
end $$;
create or replace function public.ace_library_filter_v1(title text,m jsonb,f jsonb) returns boolean language sql immutable set search_path=public as $$
select (coalesce(f->>'collection','')='' or public.ace_library_collections_v1(title,m)?(f->>'collection'))
and (coalesce(f->>'contractingEntity','')='' or position(public.ace_search_normalize_v1(f->>'contractingEntity') in public.ace_search_normalize_v1(coalesce(m->>'contractingEntity','')||' '||coalesce(m->>'requestingEntity','')))>0)
and (coalesce(f->>'ruc','')='' or m->>'contractingEntityRuc'=f->>'ruc' or m->>'requestingEntityRuc'=f->>'ruc')
and not exists(select 1 from(values('arbitrator','arbitrators'),('claimant','claimant'),('respondent','respondent'),('arbitralInstitution','arbitralInstitution')) x(filter_key,metadata_key) where coalesce(f->>filter_key,'')<>'' and position(public.ace_search_normalize_v1(f->>filter_key) in public.ace_search_normalize_v1(coalesce(m->>metadata_key,'')))=0);
$$;
commit;
