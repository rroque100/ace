begin;
create table if not exists public.exam_questions (
 id uuid primary key default gen_random_uuid(), revision integer not null default 0,
 prompt text not null, options jsonb not null check(jsonb_array_length(options)=4), correct_option text not null check(correct_option in ('A','B','C','D')),
 explanation text not null, regime text not null check(regime in('32069','30225')), topic text not null, competency text not null, difficulty text not null check(difficulty in('basic','intermediate','advanced')),
 sources jsonb not null check(jsonb_array_length(sources)>0), status text not null default 'draft' check(status in('draft','published','retired')),
 created_by uuid references auth.users(id), reviewed_by uuid references auth.users(id), reviewed_at timestamptz, review_basis text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.exam_question_reviews(id uuid primary key default gen_random_uuid(),question_id uuid not null references public.exam_questions(id),actor_id uuid not null references auth.users(id),revision integer not null,basis text not null,snapshot jsonb not null,created_at timestamptz not null default now());
create table if not exists public.exam_attempts (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),mode text not null check(mode in('practice','exam')),preview boolean not null default false,
 regime text not null,topic text,question_count integer not null check(question_count between 1 and 72),duration_minutes integer not null,revision integer not null default 0,
 result jsonb, state text not null default 'active' check(state in('active','submitted','cancelled')),questions jsonb not null,
 started_at timestamptz not null default now(),deadline_at timestamptz,finished_at timestamptz
);
create unique index if not exists exam_one_active_per_user on public.exam_attempts(owner_id) where state='active';
create index if not exists exam_user_history on public.exam_attempts(owner_id,started_at desc);
create table if not exists public.exam_answers(attempt_id uuid not null references public.exam_attempts(id),question_id uuid not null,option text check(option in('A','B','C','D')),flagged boolean not null default false,updated_at timestamptz not null default now(),primary key(attempt_id,question_id));
alter table public.exam_questions enable row level security;
alter table public.exam_question_reviews enable row level security;
alter table public.exam_attempts enable row level security;
alter table public.exam_answers enable row level security;
revoke all on public.exam_questions,public.exam_question_reviews,public.exam_attempts,public.exam_answers from anon,authenticated;
grant all on public.exam_questions,public.exam_question_reviews,public.exam_attempts,public.exam_answers to service_role;
create or replace function public.ace_exam_grade(p_id uuid) returns jsonb language sql stable set search_path=public as $$
 with rows as(select q->>'topic' topic,(a.option is not null) answered,(a.option=q->>'correct_option') correct from exam_attempts t cross join jsonb_array_elements(t.questions)q left join exam_answers a on a.attempt_id=t.id and a.question_id::text=q->>'id' where t.id=p_id),
 topics as(select topic,count(*) total,count(*)filter(where correct) correct from rows group by topic)
 select jsonb_build_object('total',count(*),'answered',count(*)filter(where answered),'correct',count(*)filter(where correct),'omitted',count(*)filter(where not answered),'incorrect',count(*)filter(where answered and not coalesce(correct,false)),'topics',coalesce((select jsonb_agg(to_jsonb(topics))from topics),'[]'::jsonb))from rows
$$;
create or replace function public.ace_exam_eligible(q public.exam_questions,p_preview boolean default false) returns boolean language sql stable set search_path=public as $$
 select ((q.status='published' and q.reviewed_by is not null and q.reviewed_at is not null and length(q.review_basis)>=20) or (p_preview and q.status='draft')) and jsonb_array_length(q.sources)>0 and not exists(
 select 1 from jsonb_array_elements(q.sources) s where not exists(select 1 from documents d where d.id::text=s->>'documentId' and d.es_institucional=true and d.status='indexed' and d.metadata->>'indexedTextComplete'='true' and d.metadata->>'sha256'=s->>'sha256'))
$$;
create or replace function public.ace_exam_start(p_actor uuid,p_mode text,p_count integer,p_minutes integer,p_regime text,p_topic text default '',p_preview boolean default false) returns uuid language plpgsql security definer set search_path=public as $$
declare a exam_attempts;questions_json jsonb;new_id uuid;
begin
 if p_mode not in('practice','exam') or p_count not between 1 and 72 or p_regime not in('32069','30225') or p_minutes not between 5 and 180 or (p_preview and p_mode<>'practice') then raise exception 'Configuración inválida';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_actor::text,947));
 update exam_attempts set state='submitted',finished_at=now(),revision=revision+1,result=ace_exam_grade(id) where owner_id=p_actor and state='active' and deadline_at<=now();
 select * into a from exam_attempts where owner_id=p_actor and state='active';
 if a.id is not null then return a.id;end if;
 select jsonb_agg(to_jsonb(x)) into questions_json from(select q.* from exam_questions q where ace_exam_eligible(q,p_preview) and q.regime=p_regime and (p_topic='' or q.topic=p_topic) order by random() limit p_count)x;
 if coalesce(jsonb_array_length(questions_json),0)<p_count then raise exception 'No hay suficientes preguntas revisadas para esta selección.';end if;
 insert into exam_attempts(owner_id,mode,preview,regime,topic,question_count,duration_minutes,questions,deadline_at) values(p_actor,p_mode,p_preview,p_regime,p_topic,p_count,case when p_mode='practice' then 0 else p_minutes end,questions_json,case when p_mode='exam' then now()+make_interval(mins=>p_minutes) else null end) returning id into new_id;
 return new_id;
end;$$;
create or replace function public.ace_exam_get(p_actor uuid,p_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare a exam_attempts;answers_json jsonb;
begin
 select * into a from exam_attempts where id=p_id and owner_id=p_actor for update;
 if a.id is null then raise exception 'Intento no encontrado' using errcode='P0002';end if;
 if a.state='active' and a.deadline_at<=now() then update exam_attempts set state='submitted',finished_at=now(),revision=revision+1,result=ace_exam_grade(id) where id=a.id returning * into a;end if;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into answers_json from exam_answers x where attempt_id=a.id;
 return jsonb_build_object('attempt',to_jsonb(a),'answers',answers_json,'serverNow',now());
end;$$;
create or replace function public.ace_exam_save(p_actor uuid,p_id uuid,p_revision integer,p_question uuid,p_option text,p_flagged boolean) returns jsonb language plpgsql security definer set search_path=public as $$
declare a exam_attempts;
begin
 select * into a from exam_attempts where id=p_id and owner_id=p_actor for update;
 if a.id is null then raise exception 'Intento no encontrado' using errcode='P0002';end if;
 if a.state<>'active' then raise exception 'El intento ya terminó';end if;
 if a.deadline_at<=now() then update exam_attempts set state='submitted',finished_at=now(),revision=revision+1,result=ace_exam_grade(id) where id=a.id;return ace_exam_get(p_actor,p_id);end if;
 if a.revision<>p_revision then raise exception 'El intento cambió en otra ventana; actualiza antes de guardar.' using errcode='40001';end if;
 if not exists(select 1 from jsonb_array_elements(a.questions) q where q->>'id'=p_question::text) or (p_option is not null and p_option not in('A','B','C','D')) then raise exception 'Respuesta inválida';end if;
 if a.mode='practice' and exists(select 1 from exam_answers where attempt_id=p_id and question_id=p_question and option is not null and option is distinct from p_option) then raise exception 'La práctica ya mostró la resolución de esta pregunta.';end if;
 insert into exam_answers(attempt_id,question_id,option,flagged)values(p_id,p_question,p_option,coalesce(p_flagged,false))on conflict(attempt_id,question_id)do update set option=excluded.option,flagged=excluded.flagged,updated_at=now();
 update exam_attempts set revision=revision+1 where id=a.id;
 return ace_exam_get(p_actor,p_id);
end;$$;
create or replace function public.ace_exam_finish(p_actor uuid,p_id uuid,p_action text) returns jsonb language plpgsql security definer set search_path=public as $$
declare a exam_attempts;
begin
 if p_action not in('submit','cancel') then raise exception 'Acción inválida';end if;
 select * into a from exam_attempts where id=p_id and owner_id=p_actor for update;
 if a.id is null then raise exception 'Intento no encontrado' using errcode='P0002';end if;
 if a.state='active' then update exam_attempts set state=case when p_action='cancel' and (a.deadline_at is null or a.deadline_at>now()) then 'cancelled' else 'submitted' end,finished_at=now(),revision=revision+1,result=case when p_action='submit' or a.deadline_at<=now() then ace_exam_grade(a.id) else null end where id=a.id;end if;
 return ace_exam_get(p_actor,p_id);
end;$$;
create or replace function public.ace_exam_edit(p_actor uuid,p_input jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare q exam_questions;k uuid:=coalesce(nullif(p_input->>'id','')::uuid,gen_random_uuid());
begin
 if p_input->>'status' not in('draft','published','retired') then raise exception 'Estado inválido';end if;
 select * into q from exam_questions where id=k for update;
 if q.id is not null and q.revision<>(p_input->>'revision')::integer then raise exception 'La pregunta cambió; actualiza el banco.' using errcode='40001';end if;
 if p_input->>'status'='published' and length(coalesce(p_input->>'reviewBasis',''))<20 then raise exception 'Registra el fundamento de revisión';end if;
 insert into exam_questions(id,prompt,options,correct_option,explanation,regime,topic,competency,difficulty,sources,status,created_by,reviewed_by,reviewed_at,review_basis)
 values(k,p_input->>'prompt',p_input->'options',p_input->>'correctOption',p_input->>'explanation',p_input->>'regime',p_input->>'topic',p_input->>'competency',p_input->>'difficulty',p_input->'sources',p_input->>'status',p_actor,case when p_input->>'status'='published' then p_actor end,case when p_input->>'status'='published' then now() end,p_input->>'reviewBasis')
 on conflict(id)do update set prompt=excluded.prompt,options=excluded.options,correct_option=excluded.correct_option,explanation=excluded.explanation,regime=excluded.regime,topic=excluded.topic,competency=excluded.competency,difficulty=excluded.difficulty,sources=excluded.sources,status=excluded.status,revision=exam_questions.revision+1,reviewed_by=excluded.reviewed_by,reviewed_at=excluded.reviewed_at,review_basis=excluded.review_basis,updated_at=now();
 if p_input->>'status'='published' then insert into exam_question_reviews(question_id,actor_id,revision,basis,snapshot) select id,p_actor,revision,p_input->>'reviewBasis',to_jsonb(x)from exam_questions x where id=k;end if;
 return k;
end;$$;
create or replace function public.ace_exam_dashboard(p_actor uuid,p_admin boolean default false) returns jsonb language plpgsql security definer set search_path=public as $$
begin
 update exam_attempts set state='submitted',finished_at=now(),revision=revision+1,result=ace_exam_grade(id) where owner_id=p_actor and state='active' and deadline_at<=now();
 return jsonb_build_object('available',coalesce((select jsonb_agg(to_jsonb(g))from(select regime,topic,count(*)filter(where ace_exam_eligible(q,false)) published,count(*)filter(where p_admin and ace_exam_eligible(q,true) and status='draft') drafts from exam_questions q where q.status='published' or p_admin group by regime,topic)g),'[]'::jsonb),
 'active',(select jsonb_build_object('id',id,'mode',mode,'preview',preview,'count',question_count,'startedAt',started_at,'deadlineAt',deadline_at)from exam_attempts where owner_id=p_actor and state='active'),
 'history',coalesce((select jsonb_agg(to_jsonb(h))from(select id,mode,preview,regime,topic,question_count,state,started_at,finished_at,result from exam_attempts where owner_id=p_actor and state<>'active' order by started_at desc limit 20)h),'[]'::jsonb));
end;$$;
revoke all on function public.ace_exam_grade(uuid),public.ace_exam_dashboard(uuid,boolean) from public,anon,authenticated;
grant execute on function public.ace_exam_grade(uuid),public.ace_exam_dashboard(uuid,boolean) to service_role;
revoke all on function public.ace_exam_eligible(public.exam_questions,boolean),public.ace_exam_start(uuid,text,integer,integer,text,text,boolean),public.ace_exam_get(uuid,uuid),public.ace_exam_save(uuid,uuid,integer,uuid,text,boolean),public.ace_exam_finish(uuid,uuid,text),public.ace_exam_edit(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.ace_exam_eligible(public.exam_questions,boolean),public.ace_exam_start(uuid,text,integer,integer,text,text,boolean),public.ace_exam_get(uuid,uuid),public.ace_exam_save(uuid,uuid,integer,uuid,text,boolean),public.ace_exam_finish(uuid,uuid,text),public.ace_exam_edit(uuid,jsonb) to service_role;
commit;
