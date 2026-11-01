begin;
alter table public.legal_update_candidates add column if not exists last_content_checked_at timestamptz;
create table if not exists public.legal_sync_settings(
 id boolean primary key default true check(id), enabled boolean not null default false,
 daily_limit integer not null default 100 check(daily_limit between 1 and 100),
 ai_blocked_until timestamptz, ai_error text, last_started_at timestamptz, last_finished_at timestamptz,
 run_token uuid,run_until timestamptz,updated_at timestamptz not null default now()
);
insert into public.legal_sync_settings(id) values(true) on conflict do nothing;
create table if not exists public.legal_sync_sources(
 source_id uuid primary key references public.legal_official_sources(id), enabled boolean not null default false,
 document_types text[] not null default '{}', regimes text[] not null default '{}', code_prefix text not null default '',
 last_checked_at timestamptz, last_complete_at timestamptz, last_error text, scan_cursor text,
 recent_cursor text,history_complete boolean not null default false,
 updated_at timestamptz not null default now()
);
alter table public.legal_sync_sources add column if not exists recent_cursor text;
alter table public.legal_sync_sources add column if not exists history_complete boolean not null default false;
create table if not exists public.legal_sync_jobs(
 id uuid primary key default gen_random_uuid(), candidate_id uuid unique references public.legal_update_candidates(id),
 document_id uuid unique references public.documents(id), source_id uuid references public.legal_official_sources(id),
 stage text not null default 'download' check(stage in('download','classify','index','done','review')),
 state text not null default 'queued' check(state in('queued','running','blocked','done','review')),
 attempts integer not null default 0, lease_token uuid, lease_until timestamptz,
 next_attempt_at timestamptz not null default now(), last_error text, evidence jsonb not null default '{}',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.legal_sync_daily_usage(day date primary key, reserved integer not null default 0);
create table if not exists public.legal_sync_events(
 id bigint generated always as identity primary key,job_id uuid references public.legal_sync_jobs(id),
 kind text not null, detail text not null, created_at timestamptz not null default now()
);
alter table public.legal_sync_settings enable row level security;
alter table public.legal_sync_sources enable row level security;
alter table public.legal_sync_jobs enable row level security;
alter table public.legal_sync_daily_usage enable row level security;
alter table public.legal_sync_events enable row level security;
grant all on public.legal_sync_settings,public.legal_sync_sources,public.legal_sync_jobs,public.legal_sync_daily_usage,public.legal_sync_events to service_role;
grant usage,select on sequence public.legal_sync_events_id_seq to service_role;
create index if not exists legal_sync_ready on public.legal_sync_jobs(state,next_attempt_at,created_at);
create or replace function public.ace_sync_claim_v1() returns jsonb language plpgsql security definer set search_path=public as $$
declare j legal_sync_jobs; cfg legal_sync_settings; used integer; today date:=(now() at time zone 'America/Lima')::date;
begin
 select * into cfg from legal_sync_settings where id=true for update;
 if not cfg.enabled then return null; end if;
 select job.* into j from legal_sync_jobs job where
 ((state in('queued','blocked') and next_attempt_at<=now()) or(state='running' and lease_until<now()))
 and attempts<5 and stage in('download','classify','index')
 and(job.source_id is null or exists(select 1 from legal_sync_sources s where s.source_id=job.source_id and s.enabled))
 and(stage='download' or cfg.ai_blocked_until is null or cfg.ai_blocked_until<=now())
 order by case when stage='download' then 1 else 0 end,created_at for update skip locked limit 1;
 if j.id is null then return null; end if;
 if j.stage='download' then
 insert into legal_sync_daily_usage(day)values(today)on conflict do nothing;
 select reserved into used from legal_sync_daily_usage where day=today for update;
 if used>=cfg.daily_limit then return null;end if;
 update legal_sync_daily_usage set reserved=reserved+1 where day=today;
 end if;
 update legal_sync_jobs set state='running',lease_token=gen_random_uuid(),lease_until=now()+interval '10 minutes',
 attempts=attempts+1,updated_at=now() where id=j.id returning * into j;
 return to_jsonb(j);
end;$$;
revoke all on function public.ace_sync_claim_v1() from public,anon,authenticated;
grant execute on function public.ace_sync_claim_v1() to service_role;
create or replace function public.ace_sync_begin_v1() returns uuid language plpgsql security definer set search_path=public as $$
declare token uuid:=gen_random_uuid();r legal_sync_settings;
begin
 select * into r from legal_sync_settings where id=true for update;
 if not r.enabled or r.run_until>now() then return null;end if;
 update legal_sync_settings set run_token=token,run_until=now()+interval '5 minutes',last_started_at=now() where id=true;
 return token;
end;$$;
revoke all on function public.ace_sync_begin_v1() from public,anon,authenticated;
grant execute on function public.ace_sync_begin_v1() to service_role;
create or replace function public.ace_sync_changed_file_v1(p_candidate uuid,p_sha text) returns boolean language plpgsql security definer set search_path=public as $$
declare c legal_update_candidates;j legal_sync_jobs;
begin
 select * into c from legal_update_candidates where id=p_candidate for update;
 if c.id is null or c.status<>'accepted' then return false;end if;
 select * into j from legal_sync_jobs where candidate_id=p_candidate for update;
 if j.id is not null and j.state='running' and j.lease_until>now() then return false;end if;
 update legal_update_candidates set status='pending',document_id=null,review=coalesce(review,'{}')||jsonb_build_object('previousDocumentId',c.document_id,'replacementSha256',p_sha,'replacementDetectedAt',now(),'previousReview',c.review) where id=p_candidate;
 insert into legal_sync_jobs(candidate_id,source_id,stage,state,evidence) values(p_candidate,c.source_id,'download','queued',jsonb_build_object('previousDocumentId',c.document_id,'replacementSha256',p_sha))
 on conflict(candidate_id) do update set document_id=null,stage='download',state='queued',attempts=0,lease_token=null,lease_until=null,next_attempt_at=now(),last_error=null,evidence=excluded.evidence,updated_at=now() returning * into j;
 insert into legal_sync_events(job_id,kind,detail)values(j.id,'file_changed','El enlace oficial cambió de contenido. Se conserva el original previo; la nueva versión queda pendiente de revisión.');
 return true;
end;$$;
revoke all on function public.ace_sync_changed_file_v1(uuid,text) from public,anon,authenticated;
grant execute on function public.ace_sync_changed_file_v1(uuid,text) to service_role;
create or replace function public.ace_sync_regime_matches_v1(m jsonb,r text) returns boolean language sql immutable as $$
 select case when r='no_determinado' then not coalesce((m->'regimeReviewed'='true'::jsonb or m->>'regimeReviewStatus'='confirmed'),false) or m->>'regime'='no_determinado'
 else coalesce((m->'regimeReviewed'='true'::jsonb or m->>'regimeReviewStatus'='confirmed'),false)
 and (m->>'regime'=r or coalesce(m->'declaredRegimes','[]'::jsonb)?r) end
$$;
-- Preserve all existing filters and grants; extend only their exact regime predicate.
do $$ declare p record;def text;changed text;
begin
 for p in select oid from pg_proc where pronamespace='public'::regnamespace and (proname like 'ace_search_%' or proname='ace_library_catalogue_v1') and prokind='f' loop
  def:=pg_get_functiondef(p.oid);
  changed:=replace(def,$old$d.regime=p_filters->>'regime'$old$,$new$public.ace_sync_regime_matches_v1(d.metadata,p_filters->>'regime')$new$);
  changed:=replace(changed,$old$(case when metadata->'regimeReviewed'='true'::jsonb or metadata->>'regimeReviewStatus'='confirmed' then metadata->>'regime' else 'no_determinado' end)=p_filters->>'regime'$old$,$new$((p_filters->>'regime'='no_determinado' and not coalesce((metadata->'regimeReviewed'='true'::jsonb or metadata->>'regimeReviewStatus'='confirmed'),false)) or public.ace_sync_regime_matches_v1(metadata,p_filters->>'regime'))$new$);
  if changed<>def then execute changed;end if;
 end loop;
end $$;
commit;
