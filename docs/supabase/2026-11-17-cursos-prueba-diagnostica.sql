-- Prueba diagnóstica del curso de certificación OECE (lib/cursos/diagnostico.ts).
--
-- 15 preguntas del banco en modo examen y 25 minutos (el ritmo del simulacro: 72 en 120): 5 por competencia, cada una
-- de un tema distinto. Los temas se sortean ponderados por su cuota en el examen (muestreo de Efraimidis–Spirakis:
-- ordenar por -ln(u)/cuota), así que los que más pesan salen más a menudo sin que los pequeños desaparezcan. Se usan
-- solo preguntas que cumplen ace_exam_prepared, el mismo filtro que el simulacro OECE.
--
-- Por qué una función nueva y no ace_exam_start_competency: esa toma preguntas al azar de una competencia y podría dar
-- tres del mismo tema; el diagnóstico necesita temas distintos para poder recomendar clases.
--
-- Si hay otro intento activo, no se devuelve (como hacen las demás funciones de inicio): llevaría al alumno a un
-- simulacro de 72 preguntas cuando pidió el diagnóstico. Se avisa con 55000, que la API traduce a 409.
--
-- Ejecutar a mano en el SQL Editor de Supabase. Idempotente.
begin;

alter table public.exam_attempts drop constraint if exists exam_attempts_profile_check;
alter table public.exam_attempts add constraint exam_attempts_profile_check
  check (profile in ('custom', 'oece', 'review', 'balotario', 'diagnostico'));

create or replace function public.ace_exam_start_diagnostic(p_actor uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  activo exam_attempts;
  qs jsonb;
  k uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_actor::text, 947));
  update exam_attempts set state = 'submitted', finished_at = now(), revision = revision + 1, result = ace_exam_grade(id)
    where owner_id = p_actor and state = 'active' and deadline_at <= now();
  select * into activo from exam_attempts where owner_id = p_actor and state = 'active';
  if activo.id is not null then
    if activo.profile = 'diagnostico' then return activo.id; end if;
    raise exception 'Tienes otro intento en curso en el simulador. Termínalo o cancélalo antes de la prueba diagnóstica.'
      using errcode = '55000';
  end if;

  with temas as (
    select c.code, c.competency,
           row_number() over (partition by c.competency order by -ln(1 - random()) / c.quota) as turno
      from exam_curriculum c
     where c.version = 'oece-2025-04-25'
       and exists (select 1 from exam_questions q
                    where q.subcompetency_code = c.code and q.regime = '32069' and ace_exam_prepared(q))
  )
  select jsonb_agg(to_jsonb(x) order by random()) into qs
    from temas t
    cross join lateral (
      select q.* from exam_questions q
       where q.subcompetency_code = t.code and q.regime = '32069' and ace_exam_prepared(q)
       order by random() limit 1
    ) x
   where t.turno <= 5;

  if coalesce(jsonb_array_length(qs), 0) <> 15 then
    raise exception 'El banco aún no tiene preguntas preparadas en suficientes temas para la prueba diagnóstica.';
  end if;

  insert into exam_attempts(owner_id, mode, preview, regime, topic, question_count, duration_minutes, questions, deadline_at, profile)
  values (p_actor, 'exam', false, '32069', '', 15, 25, qs, now() + make_interval(mins => 25), 'diagnostico')
  returning id into k;
  return k;
end;
$$;

revoke all on function public.ace_exam_start_diagnostic(uuid) from public, anon, authenticated;
grant execute on function public.ace_exam_start_diagnostic(uuid) to service_role;

commit;
