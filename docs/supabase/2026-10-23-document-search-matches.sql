create or replace function public.ace_literal_document_matches_v1(p_query text,p_id uuid,p_offset integer default 0,p_article text default '')
returns jsonb language plpgsql stable security invoker set search_path=public
as $$
declare needle text:=public.ace_search_normalize_v1(p_query); answer jsonb;
begin
 if length(needle)<2 or length(needle)>500 or p_offset<0 or p_offset>10000 then raise exception 'Invalid search bounds'; end if;
 with hits as (
  select c.* from public.document_chunks c join public.documents d on d.id=c.document_id
  where d.id=p_id and d.es_institucional is true and d.status='indexed'
  and d.document_type in ('ley','reglamento','directiva','opinion','resolucion','acuerdo_sala_plena','pronunciamiento','informe_vicio_nulidad','bases_estandar','guia_instructivo')
  and (coalesce(p_article,'')='' or c.metadata->>'article'=p_article)
  and position(needle in public.ace_search_normalize_v1(c.content))>0
 ), page as (select * from hits order by chunk_index,id limit 10 offset p_offset)
 select jsonb_build_object('totalMatches',(select count(*) from hits),'matches',coalesce((select jsonb_agg(jsonb_build_object('chunkId',id,'excerpt',substring(content from 1 for 16000),'pageStart',page_start,'pageEnd',page_end,'article',metadata->>'article','score',null) order by chunk_index,id) from page),'[]'::jsonb)) into answer;
 return answer;
end $$;
revoke all on function public.ace_literal_document_matches_v1(text,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.ace_literal_document_matches_v1(text,uuid,integer,text) to service_role;
