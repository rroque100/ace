begin;
alter table public.exam_attempts add column review_context jsonb;
create or replace function public.ace_exam_start_prepared(p_actor uuid,p_profile text,p_mode text,p_count integer,p_minutes integer,p_regime text,p_topic text default '',p_preview boolean default false,p_balotario uuid default null) returns uuid language plpgsql security definer set search_path=public as $$
declare a exam_attempts; qs jsonb;new_id uuid; missing text; errors_json jsonb; context_json jsonb; unavailable integer;
begin
 if p_profile not in('custom','oece','review','balotario') then raise exception 'Perfil inválido';end if;
 if p_profile='custom' then return ace_exam_start(p_actor,p_mode,p_count,p_minutes,p_regime,p_topic,p_preview);end if;
 if p_profile in('oece','balotario') and (p_mode<>'exam' or p_count<>72 or p_minutes<>120 or p_regime<>'32069' or p_topic<>'' or p_preview) then raise exception 'El perfil OECE exige 72 preguntas, 120 minutos y banco publicado';end if;
 if p_profile='review' and (p_mode<>'practice' or p_preview or p_count not between 1 and 72 or p_regime not in('32069','30225')) then raise exception 'Repaso inválido';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_actor::text,947));
 update exam_attempts set state='submitted',finished_at=now(),revision=revision+1,result=ace_exam_grade(id) where owner_id=p_actor and state='active' and deadline_at<=now();
 select * into a from exam_attempts where owner_id=p_actor and state='active';
 if a.id is not null then return a.id;end if;
 if p_profile='oece' then
  select string_agg(c.code||' ('||greatest(0,c.quota-(select count(*) from exam_questions q where q.subcompetency_code=c.code and q.regime='32069' and ace_exam_prepared(q)))||' pendientes)',', ') into missing from exam_curriculum c where c.version='oece-2025-04-25' and (select count(*) from exam_questions q where q.subcompetency_code=c.code and q.regime='32069' and ace_exam_prepared(q))<c.quota;
  if missing is not null then raise exception 'Faltan preguntas revisadas por subcompetencia: %',missing;end if;
  select jsonb_agg(to_jsonb(x) order by random()) into qs from exam_curriculum c cross join lateral(select q.* from exam_questions q where q.subcompetency_code=c.code and q.regime='32069' and ace_exam_prepared(q) order by random() limit c.quota)x where c.version='oece-2025-04-25';
 elsif p_profile='balotario' then
  if not exists(select 1 from exam_balotarios where id=p_balotario) then raise exception 'Balotario no encontrado';end if;
  select jsonb_agg(to_jsonb(q) order by random()) into qs from exam_balotario_questions b join exam_questions q on q.id=b.question_id and q.revision=b.question_revision where b.balotario_id=p_balotario and ace_exam_prepared(q);
  if coalesce(jsonb_array_length(qs),0)<>72 or exists(select 1 from exam_curriculum c where c.version='oece-2025-04-25' and (select count(*) from jsonb_array_elements(qs) j where j->>'subcompetency_code'=c.code)<>c.quota) then raise exception 'Este balotario requiere revisión: cambió una pregunta o su fuente';end if;
 else
  with ranked as(select j->>'id' id,j->>'revision' revision,r.option,j->>'correct_option' correct,row_number()over(partition by j->>'id' order by t.started_at desc) rn from exam_attempts t cross join jsonb_array_elements(t.questions)j left join exam_answers r on r.attempt_id=t.id and r.question_id::text=j->>'id' where t.owner_id=p_actor and t.regime=p_regime and t.state='submitted' and not t.preview)
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'revision',revision)),'[]') into errors_json from ranked where rn=1 and option is distinct from correct;
  select count(*)into unavailable from jsonb_array_elements(errors_json)e where not exists(select 1 from exam_questions q where q.id::text=e->>'id' and q.regime=p_regime and ace_exam_eligible(q,false));
  select jsonb_agg(to_jsonb(x)) into qs from(select q.* from exam_questions q join jsonb_array_elements(errors_json)e on e->>'id'=q.id::text where q.regime=p_regime and ace_exam_eligible(q,false) and (p_topic='' or q.topic=p_topic) order by random() limit p_count)x;
  if coalesce(jsonb_array_length(qs),0)=0 then raise exception 'No hay errores propios con preguntas publicadas y fuentes actuales para repasar. % preguntas anteriores no están disponibles.',unavailable;end if;
  context_json:=jsonb_build_object('unavailable',unavailable,'updated',(select count(*)from jsonb_array_elements(qs)q join jsonb_array_elements(errors_json)e on e->>'id'=q->>'id' where e->>'revision' is distinct from q->>'revision'));
 end if;
 insert into exam_attempts(owner_id,mode,preview,regime,topic,question_count,duration_minutes,questions,deadline_at,profile,balotario_id,review_context) values(p_actor,p_mode,false,p_regime,p_topic,jsonb_array_length(qs),case when p_mode='exam' then 120 else 0 end,qs,case when p_mode='exam' then now()+interval '120 minutes' else null end,p_profile,case when p_profile='balotario' then p_balotario end,context_json) returning id into new_id;
 return new_id;
end;$$;
commit;
