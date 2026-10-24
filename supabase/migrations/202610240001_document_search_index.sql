-- Institutional retrieval only. Originals, private documents and RLS stay intact.
begin;
create extension if not exists pg_trgm with schema extensions;

create or replace function public.ace_search_date_v2(value text) returns date
language plpgsql immutable set search_path=public as $$
declare d date;
begin
 if value is null or value !~ '^\d{4}-\d{2}-\d{2}($|T)' then return null; end if;
 begin d:=substring(value,1,10)::date; exception when others then return null; end;
 return d;
end $$;

create or replace function public.ace_search_classification_v2(title text, metadata jsonb) returns jsonb
language plpgsql immutable set search_path=public as $$
declare t text:=public.ace_search_normalize_v1(coalesce(title,'')||' '||coalesce(metadata->>'topic',''));
 r jsonb:=metadata->'searchClassification'; objects text[]:='{}'; topics text[]:='{}'; subjects text[]:='{}'; origin text:='suggested'; item text;
begin
 if r->'reviewed'='true'::jsonb then
  select coalesce(array_agg(value),'{}') into objects from jsonb_array_elements_text(case when jsonb_typeof(r->'objects')='array' then r->'objects' else '[]'::jsonb end) where value=any(array['bienes','servicios','consultoria','obras']);
  select coalesce(array_agg(value),'{}') into topics from jsonb_array_elements_text(case when jsonb_typeof(r->'topics')='array' then r->'topics' else '[]'::jsonb end) where value=any(array['requerimiento','presupuesto','ofertas','perfeccionamiento','garantias','modificaciones','penalidades','resolucion','pagos','recursos','arbitraje','impedimentos','principios']);
  select coalesce(array_agg(value),'{}') into subjects from jsonb_array_elements_text(case when jsonb_typeof(r->'subjects')='array' then r->'subjects' else '[]'::jsonb end) where value=any(array['preparacion','seleccion','ejecucion','controversias','general']);
  origin:='registered';
 else
  if t ~ '\mbienes\M|suministro' then objects:=array_append(objects,'bienes'); end if;
  if t ~ '\mservicios\M' then objects:=array_append(objects,'servicios'); end if;
  if t ~ 'consultor' then objects:=array_append(objects,'consultoria'); end if;
  if t ~ '\mobras?\M' then objects:=array_append(objects,'obras'); end if;
  if t ~ 'requerimiento|bases |especificaciones|terminos de referencia' then topics:=array_append(topics,'requerimiento'); end if;
  if t ~ 'presupuesto|valor estimado|valor referencial' then topics:=array_append(topics,'presupuesto'); end if;
  if t ~ 'ofertas|buena pro|admision|evaluacion' then topics:=array_append(topics,'ofertas'); end if;
  if t ~ 'perfeccionamiento|perfeccionar' then topics:=array_append(topics,'perfeccionamiento'); end if;
  if t ~ 'garantia|fianza|fideicomiso' then topics:=array_append(topics,'garantias'); end if;
  if t ~ 'modificaci|ampliacion|adicional' then topics:=array_append(topics,'modificaciones'); end if;
  if t ~ 'penalidad|mora' then topics:=array_append(topics,'penalidades'); end if;
  if t ~ 'resolucion del contrato|resolucion contractual' then topics:=array_append(topics,'resolucion'); end if;
  if t ~ '\mpago|adelanto' then topics:=array_append(topics,'pagos'); end if;
  if t ~ 'apelacion|recurso|impugnaci' then topics:=array_append(topics,'recursos'); end if;
  if t ~ 'arbitraje|conciliaci' then topics:=array_append(topics,'arbitraje'); end if;
  if t ~ 'impedimento|incompatibilidad' then topics:=array_append(topics,'impedimentos'); end if;
  if t ~ 'principio|procedimiento administrativo' then topics:=array_append(topics,'principios'); end if;
  foreach item in array topics loop
   subjects:=array_append(subjects,case when item in ('requerimiento','presupuesto') then 'preparacion' when item='ofertas' then 'seleccion' when item in ('recursos','arbitraje') then 'controversias' when item in ('impedimentos','principios') then 'general' else 'ejecucion' end);
  end loop;
  select coalesce(array_agg(distinct x),'{}') into subjects from unnest(subjects) x;
  if cardinality(objects)=0 and cardinality(topics)=0 then origin:='unknown'; end if;
 end if;
 return jsonb_build_object('objects',objects,'topics',topics,'subjects',subjects,'origin',origin);
end $$;

create or replace function public.ace_search_pattern_v2(value text) returns text
language sql immutable set search_path=public as $$ select '%'||replace(replace(replace(value,chr(92),chr(92)||chr(92)),'%',chr(92)||'%'),'_',chr(92)||'_')||'%' $$;

create or replace function public.ace_search_identifier_v2(value text) returns text
language sql immutable set search_path=public as $$
 select regexp_replace(regexp_replace(regexp_replace(regexp_replace(public.ace_search_normalize_v1(value),'\m(opinion|resolucion|directiva|ley|reglamento|decreto|supremo|acuerdo|pronunciamiento)\M','','g'),'\mn\s*[.°ºo]+\s*','','g'),'[^a-z0-9]','','g'),'(^|[^0-9])0+([0-9])','\1\2','g')
$$;

create table if not exists public.ace_search_documents_v2 (
 document_id uuid primary key references public.documents(id) on delete cascade,
 title text not null, document_type text not null, source_entity text, process_type text,
 metadata jsonb not null, classification jsonb not null,
 normalized_title text not null, normalized_body text not null, identifier text, family_key text,
 published date, sort_date date, registered_year integer, regime text not null, validity text not null,
 indexed_at timestamptz not null default now()
);
create table if not exists public.ace_search_chunks_v2 (
 chunk_id uuid primary key references public.document_chunks(id) on delete cascade,
 document_id uuid not null references public.documents(id) on delete cascade,
 chunk_index integer not null, normalized_content text not null, article text
);
alter table public.ace_search_documents_v2 enable row level security;
alter table public.ace_search_chunks_v2 enable row level security;
revoke all on public.ace_search_documents_v2,public.ace_search_chunks_v2 from public,anon,authenticated;
grant all on public.ace_search_documents_v2,public.ace_search_chunks_v2 to service_role;
create index if not exists ace_search_document_text_trgm_v2 on public.ace_search_documents_v2 using gin(normalized_body extensions.gin_trgm_ops);
create index if not exists ace_search_document_title_trgm_v2 on public.ace_search_documents_v2 using gin(normalized_title extensions.gin_trgm_ops);
create index if not exists ace_search_document_identifier_v2 on public.ace_search_documents_v2(identifier);
create index if not exists ace_search_document_publication_v2 on public.ace_search_documents_v2(published);
create index if not exists ace_search_document_family_v2 on public.ace_search_documents_v2(family_key);
create index if not exists ace_search_document_filters_v2 on public.ace_search_documents_v2(document_type,regime,sort_date,document_id);
create index if not exists ace_search_chunk_doc_v2 on public.ace_search_chunks_v2(document_id,article,chunk_index,chunk_id);
create index if not exists ace_search_chunk_text_trgm_v2 on public.ace_search_chunks_v2 using gin(normalized_content extensions.gin_trgm_ops);

create or replace function public.ace_refresh_search_document_v2(target uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.documents%rowtype; m jsonb; pub date; yr integer; entity text; r text; v text;
begin
 perform pg_advisory_xact_lock(hashtextextended(target::text,24001));
 select * into d from public.documents where id=target and es_institucional is true and status='indexed'
 and document_type in ('ley','reglamento','directiva','opinion','resolucion','acuerdo_sala_plena','pronunciamiento','informe_vicio_nulidad','bases_estandar','guia_instructivo');
 if not found then delete from public.ace_search_chunks_v2 where document_id=target; delete from public.ace_search_documents_v2 where document_id=target; return; end if;
 m:=coalesce(d.metadata,'{}');
 pub:=coalesce(public.ace_search_date_v2(m->>'publicationDate'),public.ace_search_date_v2(m->>'publishedAt'),public.ace_search_date_v2(m->>'datePublished'));
 if jsonb_typeof(m->'year')='number' and m->>'year' ~ '^\d{4}$' and (m->>'year')::integer between 1900 and 2200 then yr:=(m->>'year')::integer; end if;
 r:=case when m->'regimeReviewed'='true'::jsonb or m->>'regimeReviewStatus'='confirmed' then regexp_replace(lower(trim(coalesce(m->>'regime',''))),'^ley[ _-]*','') else 'no_determinado' end;
 if r not in ('32069','30225','especial') then r:='no_determinado'; end if;
 v:=public.ace_search_normalize_v1(m->>'vigencia');
 v:=case when v ~ 'derog|no vigente|sin vigencia|vencid' then 'not_current' when v ~ 'modific' or public.ace_search_normalize_v1(m->>'status') ~ 'revision pendiente|pending review|por revisar' then 'unknown' when v='vigente' then 'current' else 'unknown' end;
 entity:=d.source_entity;
 if public.ace_search_normalize_v1(entity) ~ '^congreso de la republica( del peru)?$' then entity:='Congreso de la República'; end if;
 if public.ace_search_normalize_v1(entity) in ('oece','organismo especializado para las contrataciones publicas eficientes') then entity:='OECE'; end if;
 if public.ace_search_normalize_v1(entity) in ('osce','organismo supervisor de las contrataciones del estado','organismo supervisor de las contrataciones del estado (osce)') then entity:='OSCE'; end if;
 insert into public.ace_search_chunks_v2 select id,document_id,chunk_index,public.ace_search_normalize_v1(content),metadata->>'article' from public.document_chunks where document_id=target
 on conflict(chunk_id) do update set normalized_content=excluded.normalized_content,article=excluded.article,chunk_index=excluded.chunk_index;
 delete from public.ace_search_chunks_v2 i where i.document_id=target and not exists(select 1 from public.document_chunks c where c.id=i.chunk_id);
 insert into public.ace_search_documents_v2 values(target,d.title,d.document_type,entity,d.process_type,m,public.ace_search_classification_v2(d.title,m),public.ace_search_normalize_v1(d.title),coalesce((select string_agg(normalized_content,' ' order by chunk_index,chunk_id) from public.ace_search_chunks_v2 where document_id=target),''),public.ace_search_identifier_v2(coalesce(m->>'documentNumber',m->>'number')),d.document_type||':'||public.ace_search_identifier_v2(coalesce(nullif(m->>'documentFamilyId',''),nullif(m->>'documentNumber',''),nullif(m->>'number',''),split_part((regexp_split_to_array(d.title,'texto actualizado|versi[oó]n','i'))[1],'—',1))),pub,coalesce(pub,case when yr is not null then make_date(yr,1,1) end),yr,r,v,now())
 on conflict(document_id) do update set title=excluded.title,document_type=excluded.document_type,source_entity=excluded.source_entity,process_type=excluded.process_type,metadata=excluded.metadata,classification=excluded.classification,normalized_title=excluded.normalized_title,normalized_body=excluded.normalized_body,identifier=excluded.identifier,family_key=excluded.family_key,published=excluded.published,sort_date=excluded.sort_date,registered_year=excluded.registered_year,regime=excluded.regime,validity=excluded.validity,indexed_at=excluded.indexed_at;
end $$;

create or replace function public.ace_search_documents_changed_v2() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin perform public.ace_refresh_search_document_v2(new.id); return new; end $$;
create or replace function public.ace_search_chunks_changed_v2() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare item uuid;
begin
 if TG_OP='INSERT' then for item in select distinct document_id from new_rows order by document_id loop perform public.ace_refresh_search_document_v2(item); end loop;
 elsif TG_OP='DELETE' then for item in select distinct document_id from old_rows order by document_id loop perform public.ace_refresh_search_document_v2(item); end loop;
 else for item in select document_id from new_rows union select document_id from old_rows order by document_id loop perform public.ace_refresh_search_document_v2(item); end loop; end if;
 return null;
end $$;
drop trigger if exists ace_search_documents_changed_v2 on public.documents;
create trigger ace_search_documents_changed_v2 after insert or update on public.documents for each row execute function public.ace_search_documents_changed_v2();
drop trigger if exists ace_search_chunks_inserted_v2 on public.document_chunks;
create trigger ace_search_chunks_inserted_v2 after insert on public.document_chunks referencing new table as new_rows for each statement execute function public.ace_search_chunks_changed_v2();
drop trigger if exists ace_search_chunks_updated_v2 on public.document_chunks;
create trigger ace_search_chunks_updated_v2 after update on public.document_chunks referencing old table as old_rows new table as new_rows for each statement execute function public.ace_search_chunks_changed_v2();
drop trigger if exists ace_search_chunks_deleted_v2 on public.document_chunks;
create trigger ace_search_chunks_deleted_v2 after delete on public.document_chunks referencing old table as old_rows for each statement execute function public.ace_search_chunks_changed_v2();

create or replace function public.ace_search_passage_rank_v2(body text,query text,article text) returns double precision
language sql immutable set search_path=public as $$
 select (case when position(public.ace_search_normalize_v1(query) in public.ace_search_normalize_v1(body))>0 then 6 else 0 end)
 + 12.0*(select count(*) from unnest(regexp_split_to_array(public.ace_search_normalize_v1(query),' ')) word where length(word)>2 and word not in ('del','las','los','para','con','una','por') and position(word in public.ace_search_normalize_v1(body))>0)
 / greatest(1,(select count(*) from unnest(regexp_split_to_array(public.ace_search_normalize_v1(query),' ')) word where length(word)>2 and word not in ('del','las','los','para','con','una','por')))
 + case when article is not null then 2 else 0 end
 - case when body ~* 'firmado digitalmente|validador.xhtml|integridad del documento|\.{5,}' then 8 else 0 end
$$;

create or replace function public.ace_search_document_matches_v2(p_query text,p_id uuid,p_offset integer default 0,p_article text default '') returns jsonb
language sql stable security invoker set search_path=public as $$
 with hits as (
 select c.*,public.ace_search_passage_rank_v2(c.content,p_query,c.metadata->>'article') as relevance
 from public.ace_search_chunks_v2 i join public.document_chunks c on c.id=i.chunk_id
 join public.ace_search_documents_v2 d on d.document_id=i.document_id
 where i.document_id=p_id and (coalesce(p_article,'')='' or i.article=p_article)
 and position(public.ace_search_normalize_v1(p_query) in i.normalized_content)>0
 ), page as(select * from hits order by relevance desc,chunk_index,id limit 10 offset greatest(0,least(p_offset,1000000)))
 select jsonb_build_object('totalMatches',(select count(*) from hits),'matches',coalesce((select jsonb_agg(jsonb_build_object('chunkId',id,'excerpt',substring(content,1,16000),'pageStart',page_start,'pageEnd',page_end,'article',metadata->>'article','score',null) order by relevance desc,chunk_index,id) from page),'[]'::jsonb))
$$;

create or replace function public.ace_search_documents_page_v2(p_query text,p_mode text,p_filters jsonb default '{}',p_sort text default 'relevance',p_page integer default 1,p_page_size integer default 10) returns jsonb
language plpgsql stable security invoker set search_path=public as $$
declare terms text[]; needle text:=public.ace_search_normalize_v1(p_query); a text:=coalesce(p_filters->>'article',''); answer jsonb;
begin
 if p_mode not in ('literal','all_words') or length(needle)<2 or length(needle)>500 or p_page<1 or p_page>10000 or p_page_size not in (5,10,20) or p_sort not in ('relevance','newest','oldest') then raise exception 'Invalid search bounds'; end if;
 terms:=case when p_mode='all_words' then regexp_split_to_array(needle,' ') else array[needle] end;
 if cardinality(terms)>10 or exists(select 1 from unnest(terms) t where length(t)<2) then raise exception 'Invalid terms'; end if;
 with filtered as (
 select d.* from public.ace_search_documents_v2 d
 where (d.normalized_body like public.ace_search_pattern_v2(terms[1]) or d.normalized_title like public.ace_search_pattern_v2(terms[1]) or (coalesce(p_filters->>'normalizedIdentifier','')<>'' and d.identifier=p_filters->>'normalizedIdentifier'))
 and (coalesce(p_filters->>'documentId','')='' or d.document_id::text=p_filters->>'documentId')
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
 ), hits as (
 select d.*, passage.matches,passage.match_count,
 (case when (coalesce(p_filters->>'normalizedIdentifier','')<>'' and d.identifier=p_filters->>'normalizedIdentifier') or not exists(select 1 from unnest(terms) t where position(t in d.normalized_title)=0) then 100 else 0 end)+coalesce(passage.best_rank,0) as relevance
 from filtered d
 left join lateral(
  select count(*) as match_count,max(c.relevance) as best_rank,
   (select coalesce(jsonb_agg(jsonb_build_object('chunkId',x.id,'excerpt',substring(x.content,1,16000),'pageStart',x.page_start,'pageEnd',x.page_end,'article',x.metadata->>'article','score',null) order by x.relevance desc,x.chunk_index,x.id),'[]'::jsonb) from
     (select c0.*,public.ace_search_passage_rank_v2(c0.content,p_query,c0.metadata->>'article') relevance from public.ace_search_chunks_v2 i0 join public.document_chunks c0 on c0.id=i0.chunk_id where i0.document_id=d.document_id and (a='' or i0.article=a) and exists(select 1 from unnest(terms) t where position(t in i0.normalized_content)>0) order by relevance desc,c0.chunk_index,c0.id limit 5) x) as matches
  from (select c1.*,public.ace_search_passage_rank_v2(c1.content,p_query,c1.metadata->>'article') relevance from public.ace_search_chunks_v2 i1 join public.document_chunks c1 on c1.id=i1.chunk_id where i1.document_id=d.document_id and (a='' or i1.article=a) and exists(select 1 from unnest(terms) t where position(t in i1.normalized_content)>0)) c
 ) passage on true
 where (a='' or exists(select 1 from public.ace_search_chunks_v2 i where i.document_id=d.document_id and i.article=a))
 and (coalesce(p_filters->>'normalizedIdentifier','')<>'' and d.identifier=p_filters->>'normalizedIdentifier' or not exists(select 1 from unnest(terms) t where position(t in d.normalized_title)=0 and position(t in case when a='' then d.normalized_body else coalesce((select string_agg(i.normalized_content,' ' order by i.chunk_index,i.chunk_id) from public.ace_search_chunks_v2 i where i.document_id=d.document_id and i.article=a),'') end)=0))
 ), totals as(select count(*)::integer n from hits), ordered as(
 select *,row_number() over(order by case when p_sort='newest' then sort_date end desc nulls last,case when p_sort='oldest' then sort_date end asc nulls last,relevance desc,document_id) as rn from hits
 ), bounds as(select n,greatest(1,ceil(n::numeric/p_page_size)::integer) pages,least(p_page,greatest(1,ceil(n::numeric/p_page_size)::integer)) page from totals)
 select jsonb_build_object('totalDocuments',b.n,'page',b.page,'pages',case when b.n=0 then 0 else b.pages end,'documents',coalesce((select jsonb_agg(jsonb_build_object('row',jsonb_build_object('id',o.document_id,'title',o.title,'document_type',o.document_type,'source_entity',o.source_entity,'process_type',o.process_type,'metadata',o.metadata),'rank',o.relevance,'matchCount',case when p_mode='all_words' then jsonb_array_length(o.matches) else o.match_count end,'titleMatch',(coalesce(p_filters->>'normalizedIdentifier','')<>'' and o.identifier=p_filters->>'normalizedIdentifier') or not exists(select 1 from unnest(terms) t where position(t in o.normalized_title)=0),'matches',o.matches) order by o.rn) from ordered o where o.rn>(b.page-1)*p_page_size and o.rn<=b.page*p_page_size),'[]'::jsonb)) into answer from bounds b;
 return answer;
end $$;

create or replace function public.ace_search_document_versions_v2(p_ids uuid[]) returns jsonb
language sql stable security invoker set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_build_object('parentId',a.document_id,'documentId',b.document_id,'title',b.title) order by a.document_id,b.sort_date,b.document_id),'[]'::jsonb)
 from public.ace_search_documents_v2 a join public.ace_search_documents_v2 b on a.family_key=b.family_key and a.document_id<>b.document_id
 where a.document_id=any(p_ids) and cardinality(p_ids)<=20
$$;
create or replace function public.ace_search_library_coverage_v2() returns jsonb
language sql stable security invoker set search_path=public as $$
 with docs as(select document_type,status,metadata from public.documents where es_institucional is true and document_type in ('ley','reglamento','directiva','opinion','resolucion','acuerdo_sala_plena','pronunciamiento','informe_vicio_nulidad','bases_estandar','guia_instructivo'))
 select jsonb_build_object('registered',count(*),'indexed',count(*) filter(where status='indexed'),'uploaded',count(*) filter(where status='uploaded'),'processing',count(*) filter(where status='processing'),'failed',count(*) filter(where status='error'),'publicationDatesKnown',(select count(*) from public.ace_search_documents_v2 where published is not null),'textIndexDocuments',(select count(*) from public.ace_search_documents_v2),'lastIndexUpdate',(select max(indexed_at) from public.ace_search_documents_v2)) from docs
$$;
revoke all on function public.ace_search_library_coverage_v2() from public,anon,authenticated;
grant execute on function public.ace_search_library_coverage_v2() to service_role;

revoke all on function public.ace_search_pattern_v2(text),public.ace_search_identifier_v2(text),public.ace_search_document_versions_v2(uuid[]) from public,anon,authenticated;
grant execute on function public.ace_search_pattern_v2(text),public.ace_search_identifier_v2(text),public.ace_search_document_versions_v2(uuid[]) to service_role;

revoke all on function public.ace_search_date_v2(text),public.ace_search_classification_v2(text,jsonb),public.ace_refresh_search_document_v2(uuid),public.ace_search_documents_changed_v2(),public.ace_search_chunks_changed_v2(),public.ace_search_passage_rank_v2(text,text,text),public.ace_search_document_matches_v2(text,uuid,integer,text),public.ace_search_documents_page_v2(text,text,jsonb,text,integer,integer) from public,anon,authenticated;
grant execute on function public.ace_search_date_v2(text),public.ace_search_classification_v2(text,jsonb),public.ace_refresh_search_document_v2(uuid),public.ace_search_passage_rank_v2(text,text,text),public.ace_search_document_matches_v2(text,uuid,integer,text),public.ace_search_documents_page_v2(text,text,jsonb,text,integer,integer) to service_role;
do $$ declare item uuid; begin for item in select id from public.documents where es_institucional is true and status='indexed' order by id loop perform public.ace_refresh_search_document_v2(item); end loop; end $$;
analyze public.ace_search_documents_v2;
analyze public.ace_search_chunks_v2;
notify pgrst,'reload schema';
commit;
