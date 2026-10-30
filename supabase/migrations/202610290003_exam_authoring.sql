begin;
create or replace function public.ace_exam_authoring_claim(p_code text,p_count integer) returns jsonb language plpgsql security definer set search_path=public as $$
declare goal integer; existing_count integer;new_id uuid; amount integer;
begin
 if p_count not between 1 and 8 then raise exception 'Lote inválido';end if;
 select quota*5 into goal from exam_curriculum where version='oece-2025-04-25' and code=p_code;
 if goal is null then raise exception 'Subcompetencia inválida';end if;
 perform pg_advisory_xact_lock(904831);
 update exam_authoring_batches set state='failed',detail='Tiempo agotado antes de finalizar; revisa los borradores guardados antes de reintentar',finished_at=now() where state='running' and created_at<now()-interval '10 minutes';
 if exists(select 1 from exam_authoring_batches where state='running') then raise exception 'Ya hay un lote en preparación; espera su resultado antes de iniciar otro';end if;
 select count(*)into existing_count from exam_questions where curriculum_version='oece-2025-04-25' and subcompetency_code=p_code and status in('draft','published');
 amount=least(p_count,greatest(0,goal-existing_count));
 if amount=0 then return jsonb_build_object('id',null,'count',0);end if;
 insert into exam_authoring_batches(subcompetency_code,target,state)values(p_code,amount,'running')returning id into new_id;
 return jsonb_build_object('id',new_id,'count',amount);
end;$$;
revoke all on function public.ace_exam_authoring_claim(text,integer) from public,anon,authenticated;
grant execute on function public.ace_exam_authoring_claim(text,integer) to service_role;
create or replace function public.ace_exam_activity(p_actor uuid,p_id uuid,p_question uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from exam_attempts t where t.id=p_id and t.owner_id=p_actor and t.state='active' and (t.deadline_at is null or t.deadline_at>now()) and exists(select 1 from jsonb_array_elements(t.questions)q where q->>'id'=p_question::text)) then raise exception 'Intento activo no encontrado' using errcode='P0002';end if;
 insert into exam_activity(attempt_id,question_id)values(p_id,p_question)on conflict(attempt_id,question_id)do update set seconds=exam_activity.seconds+case when now()-exam_activity.last_at<=interval '20 seconds' then greatest(0,least(15,floor(extract(epoch from(now()-exam_activity.last_at)))::integer)) else 0 end,last_at=now();
end;$$;
commit;
