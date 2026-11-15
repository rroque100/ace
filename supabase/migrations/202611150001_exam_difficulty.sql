begin;

alter table public.exam_attempts
  add column difficulty_filter text not null default ''
  check (difficulty_filter in ('', 'basic', 'intermediate', 'advanced'));

-- Un grupo por dificultad. El catálogo anterior sigue disponible para otros consumidores.
create function public.ace_exam_availability_by_difficulty(p_admin boolean default false)
returns jsonb language sql stable security definer set search_path=public as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.regime,x.competency,x.topic,x.difficulty),'[]'::jsonb)
  from (
    select q.regime,q.topic,coalesce(q.competency_code,'') competency,q.difficulty,
      count(*) filter(where q.status='published') published,
      count(*) filter(where q.status='draft' and p_admin) drafts
    from exam_questions q
    where ace_exam_eligible(q,p_admin)
    group by q.regime,q.topic,q.competency_code,q.difficulty
  ) x;
$$;

-- Solo el perfil personalizado usa este selector; OECE conserva sus treinta cuotas.
create function public.ace_exam_start_filtered(
  p_actor uuid,p_mode text,p_count integer,p_minutes integer,p_regime text,
  p_topic text default '',p_preview boolean default false,
  p_competency text default '',p_difficulty text default ''
) returns uuid language plpgsql security definer set search_path=public as $$
declare
  active_id uuid;
  questions_json jsonb;
  new_id uuid;
begin
  if p_actor is null or p_mode is null or p_mode not in('practice','exam')
    or p_count is null or p_count not between 1 and 72
    or p_minutes is null or p_minutes not between 5 and 180
    or p_regime is null or p_regime not in('32069','30225')
    or p_competency is null or p_competency not in('','1','2','3')
    or p_difficulty is null or p_difficulty not in('','basic','intermediate','advanced')
    or p_topic is null or length(p_topic)>160 or p_preview is null
    or (p_preview and p_mode<>'practice') then
    raise exception 'Configuración de práctica inválida' using errcode='22023';
  end if;
  if p_preview and not exists(select 1 from profiles where id=p_actor and role='admin') then
    raise exception 'Solo administración puede probar borradores' using errcode='42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_actor::text,947));
  update exam_attempts set state='submitted',finished_at=now(),revision=revision+1,result=ace_exam_grade(id)
    where owner_id=p_actor and state='active' and deadline_at<=now();
  select id into active_id from exam_attempts where owner_id=p_actor and state='active';
  if active_id is not null then
    raise exception 'Tienes un intento en curso. Continúalo antes de iniciar otro.' using errcode='55000';
  end if;

  select jsonb_agg(to_jsonb(x)) into questions_json from (
    select q.* from exam_questions q
    where q.regime=p_regime and ace_exam_eligible(q,p_preview)
      and (p_topic='' or q.topic=p_topic)
      and (p_competency='' or q.competency_code=p_competency)
      and (p_difficulty='' or q.difficulty=p_difficulty)
    order by random() limit p_count
  ) x;
  if coalesce(jsonb_array_length(questions_json),0)<>p_count then
    raise exception 'No hay suficientes preguntas para esta dificultad y los filtros elegidos. Reduce la cantidad o amplía la selección.';
  end if;
  insert into exam_attempts(
    owner_id,mode,preview,regime,topic,question_count,duration_minutes,questions,deadline_at,profile,difficulty_filter
  ) values (
    p_actor,p_mode,p_preview,p_regime,p_topic,p_count,
    case when p_mode='practice' then 0 else p_minutes end,questions_json,
    case when p_mode='exam' then now()+make_interval(mins=>p_minutes) else null end,
    'custom',p_difficulty
  ) returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.ace_exam_availability_by_difficulty(boolean),
  public.ace_exam_start_filtered(uuid,text,integer,integer,text,text,boolean,text,text)
  from public,anon,authenticated;
grant execute on function public.ace_exam_availability_by_difficulty(boolean),
  public.ace_exam_start_filtered(uuid,text,integer,integer,text,text,boolean,text,text)
  to service_role;

commit;
