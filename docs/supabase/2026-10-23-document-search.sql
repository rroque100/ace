-- Solo corpus institucional indexado. No cambia tablas, RLS ni documentos.
create or replace function public.ace_search_normalize_v1(value text)
returns text language sql immutable parallel safe set search_path = public
as $$ select trim(regexp_replace(lower(translate(coalesce(value,''), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')), '\s+', ' ', 'g')) $$;

create or replace function public.ace_literal_document_search_v1(p_query text,p_ids uuid[],p_article text default '')
returns jsonb language plpgsql stable security invoker set search_path = public
as $$
declare needle text := public.ace_search_normalize_v1(p_query); answer jsonb;
begin
  if length(needle)<2 or length(needle)>500 or coalesce(cardinality(p_ids),0)>2000 then
    raise exception 'Invalid search bounds';
  end if;
  with eligible as (
    select d.id,d.title from public.documents d
    where d.id=any(p_ids) and d.es_institucional is true and d.status='indexed'
    and d.document_type in ('ley','reglamento','directiva','opinion','resolucion','acuerdo_sala_plena','pronunciamiento','informe_vicio_nulidad','bases_estandar','guia_instructivo')
  ), pieces as (
    select c.id,c.document_id,c.chunk_index,c.content,c.page_start,c.page_end,c.metadata,
      public.ace_search_normalize_v1(c.content) as normalized
    from public.document_chunks c join eligible d on d.id=c.document_id
    where coalesce(p_article,'')='' or c.metadata->>'article'=p_article
  ), full_text as (
    select d.id,position(needle in public.ace_search_normalize_v1(d.title))>0 as title_match,
      position(needle in coalesce(string_agg(p.normalized,' ' order by p.chunk_index),''))>0 as body_match
    from eligible d left join pieces p on p.document_id=d.id group by d.id,d.title
  ), hits as (
    select *,row_number() over(partition by document_id order by chunk_index,id) as rn
    from pieces where position(needle in normalized)>0
  ), result as (
    select f.id, f.title_match,
      (select count(*) from hits h where h.document_id=f.id) as match_count,
      coalesce((select jsonb_agg(jsonb_build_object('chunkId',h.id,'excerpt',substring(h.content from 1 for 16000),'pageStart',h.page_start,'pageEnd',h.page_end,'article',h.metadata->>'article','score',null) order by h.chunk_index,h.id) from hits h where h.document_id=f.id and rn<=5),'[]'::jsonb) as matches
    from full_text f where (f.title_match or f.body_match)
      and (coalesce(p_article,'')='' or exists(select 1 from pieces p where p.document_id=f.id))
  ) select coalesce(jsonb_agg(jsonb_build_object('documentId',id,'titleMatch',title_match,'matchCount',match_count,'matches',matches) order by id),'[]'::jsonb) into answer from result;
  return answer;
end $$;
revoke all on function public.ace_literal_document_search_v1(text,uuid[],text) from public,anon,authenticated;
grant execute on function public.ace_literal_document_search_v1(text,uuid[],text) to service_role;
revoke all on function public.ace_search_normalize_v1(text) from public,anon,authenticated;
grant execute on function public.ace_search_normalize_v1(text) to service_role;
