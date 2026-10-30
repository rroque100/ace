begin;
create table if not exists public.legal_entities(
 id uuid primary key default gen_random_uuid(),name text not null,aliases text[] not null default '{}',ruc text check(ruc is null or ruc ~ '^[0-9]{11}$'),status text not null default 'detected' check(status in('detected','verified','rejected')),ruc_verified boolean not null default false,source_url text,evidence text not null default '',revision integer not null default 0,reviewed_by uuid references auth.users(id),reviewed_at timestamptz,created_at timestamptz not null default now(),check(not ruc_verified or ruc is not null));
create unique index if not exists legal_entities_name_unique on public.legal_entities(lower(name));
create unique index if not exists legal_entities_ruc_unique on public.legal_entities(ruc) where ruc is not null;
create table if not exists public.legal_entity_documents(entity_id uuid references public.legal_entities(id),document_id uuid references public.documents(id),role text not null check(role in('issuer','requester','contracting')),evidence text not null,primary key(entity_id,document_id,role));
create table if not exists public.legal_entity_reviews(id uuid primary key default gen_random_uuid(),entity_id uuid references public.legal_entities(id),actor_id uuid not null references auth.users(id),before_record jsonb not null,after_record jsonb not null,reason text not null,created_at timestamptz not null default now());
alter table public.legal_entities enable row level security;
alter table public.legal_entity_documents enable row level security;
alter table public.legal_entity_reviews enable row level security;
grant all on public.legal_entities,public.legal_entity_documents,public.legal_entity_reviews to service_role;
create or replace function public.ace_entity_directory_v1(p_query text default '',p_page integer default 1) returns jsonb language sql stable security definer set search_path=public as $$
with matched as(select e.*,(select count(distinct x.document_id) from legal_entity_documents x join documents d on d.id=x.document_id where x.entity_id=e.id and d.es_institucional=true and d.status='indexed') document_count from legal_entities e where e.status<>'rejected' and (p_query='' or to_tsvector('simple',e.name||' '||array_to_string(e.aliases,' ')||' '||coalesce(e.ruc,'')) @@ plainto_tsquery('simple',p_query) or e.name ilike '%'||replace(replace(replace(p_query,'\','\\'),'%','\%'),'_','\_')||'%')),
rows as(select * from matched order by (status='verified') desc,name,id limit 10 offset (greatest(1,p_page)-1)*10)
select jsonb_build_object('entities',coalesce((select jsonb_agg(to_jsonb(rows)) from rows),'[]'::jsonb),'total',(select count(*) from matched),'directoryTotal',(select count(*) from legal_entities where status<>'rejected'),'documentTotal',(select count(distinct x.document_id) from legal_entity_documents x join documents d on d.id=x.document_id where d.es_institucional=true and d.status='indexed'),'page',greatest(1,p_page));
$$;
revoke all on function public.ace_entity_directory_v1(text,integer) from public,anon,authenticated;
grant execute on function public.ace_entity_directory_v1(text,integer) to service_role;
create or replace function public.ace_review_entity_v1(p_actor uuid,p_input jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare oldrow legal_entities; newrow legal_entities;
begin
 select * into oldrow from legal_entities where id=(p_input->>'id')::uuid for update;
 if not found then raise exception 'Entidad ausente' using errcode='P0002';end if;
 if oldrow.revision<>(p_input->>'revision')::integer then raise exception 'Revisión desactualizada' using errcode='40001';end if;
 update legal_entities set name=p_input->>'name',aliases=array(select jsonb_array_elements_text(p_input->'aliases')),ruc=nullif(p_input->>'ruc',''),status=p_input->>'status',ruc_verified=(p_input->>'rucVerified')::boolean,source_url=p_input->>'sourceUrl',evidence=p_input->>'evidence',reviewed_by=p_actor,reviewed_at=now(),revision=revision+1 where id=oldrow.id returning * into newrow;
 insert into legal_entity_reviews(entity_id,actor_id,before_record,after_record,reason)values(oldrow.id,p_actor,to_jsonb(oldrow),to_jsonb(newrow),p_input->>'reason');
 return to_jsonb(newrow);
end;$$;
revoke all on function public.ace_review_entity_v1(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.ace_review_entity_v1(uuid,jsonb) to service_role;
alter table public.carpetas add column if not exists research_question text not null default '';
alter table public.carpetas add column if not exists research_objective text not null default '';
alter table public.carpetas add column if not exists research_notes text not null default '';
alter table public.carpetas add column if not exists research_status text not null default 'draft' check(research_status in('draft','review','closed'));
commit;
