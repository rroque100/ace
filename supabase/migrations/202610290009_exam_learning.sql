begin;
alter table public.exam_attempts add column if not exists last_question_id uuid;
create table public.exam_editorial_tasks (
 question_id uuid not null references public.exam_questions(id), question_revision integer not null,
 assigned_to uuid not null references auth.users(id), state text not null check(state in('reviewing','blocked','pending')),
 note text not null check(length(note) between 10 and 2000), history jsonb not null default '[]', updated_at timestamptz not null default now(),
 primary key(question_id,question_revision)
);
alter table public.exam_editorial_tasks enable row level security;
revoke all on public.exam_editorial_tasks from public,anon,authenticated;
grant all on public.exam_editorial_tasks to service_role;
create or replace function public.ace_exam_checkpoint(p_actor uuid,p_id uuid,p_question uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 update exam_attempts t set last_question_id=p_question where t.id=p_id and t.owner_id=p_actor and t.state='active' and exists(select 1 from jsonb_array_elements(t.questions)q where q->>'id'=p_question::text);
 if not found then raise exception 'Intento activo no encontrado' using errcode='P0002';end if;
end;$$;
create or replace function public.ace_exam_editorial_task(p_actor uuid,p_question uuid,p_revision integer,p_state text,p_note text) returns void language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from profiles where id=p_actor and role='admin') then raise exception 'Requiere administración';end if;
 if p_state not in('reviewing','blocked','pending') or length(trim(p_note)) not between 10 and 2000 then raise exception 'Estado u observación inválidos';end if;
 perform 1 from exam_questions where id=p_question and revision=p_revision for update;
 if not found then raise exception 'La pregunta cambió; recarga la revisión' using errcode='40001';end if;
 insert into exam_editorial_tasks(question_id,question_revision,assigned_to,state,note,history)values(p_question,p_revision,p_actor,p_state,trim(p_note),jsonb_build_array(jsonb_build_object('actor',p_actor,'state',p_state,'note',trim(p_note),'at',now())))
 on conflict(question_id,question_revision)do update set assigned_to=p_actor,state=p_state,note=trim(p_note),updated_at=now(),history=exam_editorial_tasks.history||excluded.history;
end;$$;
create or replace function public.ace_exam_learning_eligible(p_ids uuid[])returns table(id uuid,revision integer)language sql stable security definer set search_path=public as $$
 select q.id,q.revision from exam_questions q where q.id=any(p_ids) and ace_exam_eligible(q,false)
$$;
create or replace function public.ace_exam_start_scheduled(p_actor uuid,p_ids uuid[])returns uuid language plpgsql security definer set search_path=public as $$
declare active_id uuid;qs jsonb;k uuid;
begin
 if coalesce(array_length(p_ids,1),0) not between 1 and 10 then raise exception 'Elige hasta diez preguntas de repaso';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_actor::text,947));
 update exam_attempts set state='submitted',finished_at=now(),revision=revision+1,result=ace_exam_grade(id) where owner_id=p_actor and state='active' and deadline_at<=now();
 select id into active_id from exam_attempts where owner_id=p_actor and state='active';
 if active_id is not null then return active_id;end if;
 select jsonb_agg(to_jsonb(q))into qs from exam_questions q where q.id=any(p_ids) and ace_exam_eligible(q,false) and exists(
 select 1 from exam_attempts t cross join jsonb_array_elements(t.questions)j left join exam_answers a on a.attempt_id=t.id and a.question_id::text=j->>'id' where t.owner_id=p_actor and t.state='submitted' and not t.preview and j->>'id'=q.id::text and a.option is distinct from j->>'correct_option');
 if coalesce(jsonb_array_length(qs),0)=0 then raise exception 'No hay preguntas de repaso disponibles con fuentes actuales';end if;
 if (select count(distinct j->>'regime')from jsonb_array_elements(qs)j)>1 then raise exception 'Repasa un régimen por sesión';end if;
 insert into exam_attempts(owner_id,mode,preview,regime,topic,question_count,duration_minutes,questions,profile,review_context)values(p_actor,'practice',false,qs->0->>'regime','',jsonb_array_length(qs),0,qs,'review','{"scheduled":true,"updated":0,"unavailable":0}')returning id into k;
 return k;
end;$$;
revoke all on function public.ace_exam_checkpoint(uuid,uuid,uuid),public.ace_exam_editorial_task(uuid,uuid,integer,text,text),public.ace_exam_learning_eligible(uuid[]),public.ace_exam_start_scheduled(uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.ace_exam_checkpoint(uuid,uuid,uuid),public.ace_exam_editorial_task(uuid,uuid,integer,text,text),public.ace_exam_learning_eligible(uuid[]),public.ace_exam_start_scheduled(uuid,uuid[]) to service_role;
create or replace function public.ace_exam_availability(p_admin boolean) returns jsonb language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(to_jsonb(x)),'[]')from(select q.regime,q.topic,coalesce(q.competency_code,'') competency,count(*)filter(where q.status='published')published,count(*)filter(where q.status='draft' and p_admin)drafts from exam_questions q where ace_exam_eligible(q,p_admin)group by q.regime,q.topic,q.competency_code)x
$$;
create or replace function public.ace_exam_start_competency(p_actor uuid,p_code text,p_mode text,p_count integer,p_minutes integer,p_regime text,p_topic text,p_preview boolean)returns uuid language plpgsql security definer set search_path=public as $$
declare k uuid;qs jsonb;
begin
 if p_code not in('1','2','3') or p_mode not in('practice','exam') or p_count not between 1 and 72 or p_minutes not between 5 and 180 or p_regime not in('32069','30225') or (p_preview and p_mode<>'practice') then raise exception 'Configuración de práctica inválida';end if;
 if p_preview and not exists(select 1 from profiles where id=p_actor and role='admin')then raise exception 'Solo administración puede probar borradores';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_actor::text,947));
 update exam_attempts set state='submitted',finished_at=now(),revision=revision+1,result=ace_exam_grade(id) where owner_id=p_actor and state='active' and deadline_at<=now();
 select id into k from exam_attempts where owner_id=p_actor and state='active';if k is not null then return k;end if;
 select jsonb_agg(to_jsonb(x))into qs from(select q.* from exam_questions q where q.competency_code=p_code and q.regime=p_regime and (p_topic=''or q.topic=p_topic)and ace_exam_eligible(q,p_preview)order by random()limit p_count)x;
 if coalesce(jsonb_array_length(qs),0)<>p_count then raise exception 'No hay suficientes preguntas disponibles para esta competencia';end if;
 insert into exam_attempts(owner_id,mode,preview,regime,topic,question_count,duration_minutes,questions,deadline_at,profile)values(p_actor,p_mode,p_preview,p_regime,p_topic,p_count,case when p_mode='exam'then p_minutes else 0 end,qs,case when p_mode='exam'then now()+make_interval(mins=>p_minutes)else null end,'custom')returning id into k;return k;
end;$$;
revoke all on function public.ace_exam_availability(boolean),public.ace_exam_start_competency(uuid,text,text,integer,integer,text,text,boolean)from public,anon,authenticated;
grant execute on function public.ace_exam_availability(boolean),public.ace_exam_start_competency(uuid,text,text,integer,integer,text,text,boolean)to service_role;
commit;

