begin;

-- Institutional catalogue filtering, facets and pagination stay in PostgreSQL.
create or replace function public.ace_normative_catalogue_v1(p_filters jsonb default '{}',p_types text[] default array['ley','reglamento','directiva'],p_query text default '',p_page integer default 1,p_page_size integer default 20)
returns jsonb language sql stable security invoker set search_path=public,extensions as $$
with category as materialized (
 select * from public.ace_search_filtered_v3('{}'::jsonb) where document_type=any(p_types)
), matches as materialized (
 select d.* from public.ace_search_filtered_v3(p_filters) d where d.document_type=any(p_types)
 and (btrim(p_query)='' or not exists(select 1 from regexp_split_to_table(public.ace_search_normalize_v1(p_query),'\s+') word where position(word in public.ace_search_normalize_v1(d.title||' '||coalesce(d.metadata->>'documentNumber',d.metadata->>'number','')))=0)
 or (p_query~'[0-9]' and regexp_replace(lower(p_query),'[^a-z0-9]','','g')=regexp_replace(lower(coalesce(d.metadata->>'documentNumber',d.metadata->>'number','')),'[^a-z0-9]','','g')))
), counts as (select count(*)::integer total from matches), bounds as (
 select total,greatest(1,least(greatest(1,p_page),greatest(1,ceil(total::numeric/greatest(5,least(50,p_page_size)))::integer))) page,greatest(5,least(50,p_page_size)) size from counts
), selected as (
 select m.* from matches m order by lower(m.title),m.document_id limit (select size from bounds) offset (select (page-1)*size from bounds)
)
select jsonb_build_object('documents',coalesce((select jsonb_agg(jsonb_build_object('id',document_id,'title',title,'document_type',document_type,'source_entity',source_entity,'process_type',process_type,'metadata',metadata) order by lower(title),document_id) from selected),'[]'::jsonb),
 'total',b.total,'page',b.page,'pages',ceil(b.total::numeric/b.size)::integer,'pageSize',b.size,
 'facets',jsonb_build_object('categoryTotal',(select count(*) from category),'entities',coalesce((select jsonb_agg(e order by e) from (select distinct source_entity e from category where source_entity is not null) x),'[]'::jsonb),'years',coalesce((select jsonb_agg(y order by y desc) from(select distinct registered_year y from category where registered_year is not null)x),'[]'::jsonb))) from bounds b;
$$;
revoke all on function public.ace_normative_catalogue_v1(jsonb,text[],text,integer,integer) from public,anon,authenticated;
grant execute on function public.ace_normative_catalogue_v1(jsonb,text[],text,integer,integer) to service_role;

create or replace function public.ace_normative_versions_v1(p_document uuid)
returns jsonb language sql stable security invoker set search_path=public,extensions as $$
select coalesce(jsonb_agg(jsonb_build_object('id',b.document_id,'title',b.title,'document_type',b.document_type,'source_entity',b.source_entity,'process_type',b.process_type,'metadata',b.metadata) order by b.document_id),'[]'::jsonb)
from public.ace_search_documents_v2 a join public.ace_search_documents_v2 b on a.family_key=b.family_key
join public.documents d on d.id=b.document_id and d.es_institucional=true and d.status='indexed'
where a.document_id=p_document;
$$;
revoke all on function public.ace_normative_versions_v1(uuid) from public,anon,authenticated;
grant execute on function public.ace_normative_versions_v1(uuid) to service_role;

-- Each correction is atomic with its audit trail; raw detected wording is retained.
create table if not exists public.normative_reference_reviews (
 id uuid primary key default gen_random_uuid(), reference_id uuid not null references public.norma_concordancias(id),
 actor_id uuid not null references auth.users(id), reason text not null check(length(btrim(reason)) between 10 and 2000),
 before_state jsonb not null, after_state jsonb not null, created_at timestamptz not null default now()
);
alter table public.normative_reference_reviews enable row level security;
revoke all on public.normative_reference_reviews from anon,authenticated;
grant select,insert on public.normative_reference_reviews to service_role;

create or replace function public.ace_correct_reference_v1(p_reference uuid,p_actor uuid,p_document uuid,p_article uuid,p_reason text,p_revision integer)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare oldrow public.norma_concordancias; newrow public.norma_concordancias; doc public.documents; art public.norma_articulos; rev integer;
begin
 if not exists(select 1 from public.profiles where id=p_actor and activo is not false and role in ('admin','dec','editor','legal')) then raise exception 'No autorizado' using errcode='42501'; end if;
 if length(btrim(p_reason))<10 or length(p_reason)>2000 then raise exception 'Indica un motivo de 10 a 2000 caracteres'; end if;
 select * into oldrow from public.norma_concordancias where id=p_reference for update;
 if not found then raise exception 'Referencia no encontrada'; end if;
 if not exists(select 1 from public.documents where id=oldrow.source_document_id and es_institucional=true) then raise exception 'Fuente no institucional' using errcode='42501'; end if;
 rev=coalesce((oldrow.metadata->>'destinationRevision')::integer,0);
 if rev<>p_revision then raise exception 'La referencia cambió; vuelve a cargarla' using errcode='40001'; end if;
 select * into doc from public.documents where id=p_document and es_institucional=true and status='indexed';
 if not found then raise exception 'Destino institucional no disponible'; end if;
 if oldrow.ref_type='interno' and p_document<>oldrow.source_document_id then raise exception 'Una referencia interna debe apuntar al mismo documento';end if;
 if oldrow.ref_type in ('ley','reglamento','directiva','opinion') and oldrow.ref_type<>doc.document_type then raise exception 'El tipo del destino no coincide con la referencia';end if;
 if p_article is not null then
  select * into art from public.norma_articulos where id=p_article and document_id=p_document;
  if not found then raise exception 'El artículo no pertenece al documento'; end if;
 elsif oldrow.ref_article_number is not null then raise exception 'Selecciona el artículo exacto';
 end if;
 update public.norma_concordancias set target_document_id=p_document,target_article_id=p_article,resolved=true,
  ref_article_number=case when p_article is not null then art.article_number else null end,
  ref_document_number=coalesce(doc.metadata->>'documentNumber',doc.metadata->>'number'),
  metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('destinationRevision',rev+1,'destinationReview',jsonb_build_object('actor',p_actor,'at',now(),'reason',p_reason,'scope','destination-only'))
 where id=p_reference returning * into newrow;
 insert into public.normative_reference_reviews(reference_id,actor_id,reason,before_state,after_state) values(p_reference,p_actor,p_reason,to_jsonb(oldrow),to_jsonb(newrow));
 return jsonb_build_object('id',p_reference,'revision',rev+1,'scope','destination-only');
end;$$;
revoke all on function public.ace_correct_reference_v1(uuid,uuid,uuid,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.ace_correct_reference_v1(uuid,uuid,uuid,uuid,text,integer) to service_role;
notify pgrst,'reload schema';
commit;
