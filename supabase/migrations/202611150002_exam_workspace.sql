begin;
-- La disponibilidad se consulta por separado, con dificultad. Evitar recalcular
-- el catálogo completo dos veces al cargar los intentos personales.
create function public.ace_exam_workspace(p_actor uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if p_actor is null then raise exception 'Requiere sesión' using errcode='42501';end if;
 update exam_attempts set state='submitted',finished_at=now(),revision=revision+1,result=ace_exam_grade(id)
 where owner_id=p_actor and state='active' and deadline_at<=now();
 return jsonb_build_object(
  'active',(select jsonb_build_object('id',id,'mode',mode,'preview',preview,'count',question_count,'startedAt',started_at,'deadlineAt',deadline_at)
    from exam_attempts where owner_id=p_actor and state='active'),
  'history',coalesce((select jsonb_agg(to_jsonb(h)) from (
    select id,mode,preview,regime,topic,question_count,state,started_at,finished_at,result,difficulty_filter
    from exam_attempts where owner_id=p_actor and state<>'active' order by started_at desc limit 20
  ) h),'[]'::jsonb)
 );
end;
$$;
revoke all on function public.ace_exam_workspace(uuid) from public,anon,authenticated;
grant execute on function public.ace_exam_workspace(uuid) to service_role;
commit;
