begin;
create table if not exists public.normative_structure_reviews (
 id uuid primary key default gen_random_uuid(),article_id uuid not null references public.norma_articulos(id),document_id uuid not null references public.documents(id),
 actor_id uuid not null references auth.users(id),reason text not null check(length(btrim(reason)) between 10 and 2000),before_state jsonb not null,after_state jsonb not null,created_at timestamptz not null default now()
);
alter table public.normative_structure_reviews enable row level security;
revoke all on public.normative_structure_reviews from anon,authenticated;
grant select,insert on public.normative_structure_reviews to service_role;
create or replace function public.ace_review_article_body_v1(p_article uuid,p_actor uuid,p_title text,p_reason text,p_revision integer)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare art public.norma_articulos; newmeta jsonb; rev integer; bodyid text;
begin
 if not exists(select 1 from public.profiles where id=p_actor and activo is not false and role in ('admin','dec','editor','legal'))then raise exception 'No autorizado' using errcode='42501';end if;
 if length(btrim(p_title))<3 or length(p_title)>160 or length(btrim(p_reason))<10 or length(p_reason)>2000 then raise exception 'Revisa título y motivo';end if;
 select * into art from public.norma_articulos where id=p_article for update;
 if not found or not exists(select 1 from public.documents where id=art.document_id and es_institucional=true and status='indexed')then raise exception 'Artículo institucional no disponible';end if;
 rev=coalesce((art.metadata->>'bodyRevision')::integer,0);
 if rev<>p_revision then raise exception 'El artículo cambió; vuelve a cargarlo' using errcode='40001';end if;
 bodyid='body:'||left(regexp_replace(public.ace_search_normalize_v1(btrim(p_title)),'[^a-z0-9]+','-','g'),150);
 newmeta=coalesce(art.metadata,'{}'::jsonb)||jsonb_build_object('bodyRevision',rev+1,'normativeBody',jsonb_build_object('id',bodyid,'title',btrim(p_title),'reviewed',true,'actor',p_actor,'at',now(),'reason',p_reason));
 update public.norma_articulos set metadata=newmeta where id=p_article;
 insert into public.normative_structure_reviews(article_id,document_id,actor_id,reason,before_state,after_state) values(p_article,art.document_id,p_actor,p_reason,coalesce(art.metadata,'{}'),newmeta);
 return jsonb_build_object('articleId',p_article,'bodyId',bodyid,'revision',rev+1);
end;$$;
revoke all on function public.ace_review_article_body_v1(uuid,uuid,text,text,integer) from public,anon,authenticated;
grant execute on function public.ace_review_article_body_v1(uuid,uuid,text,text,integer) to service_role;
notify pgrst,'reload schema';
commit;
