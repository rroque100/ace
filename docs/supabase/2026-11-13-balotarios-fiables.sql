-- Ejecutar una vez en el SQL Editor. Transacción repetible y funciones solo para
-- service_role: la API autentica al actor, no acepta owner_id del cliente.
begin;
create table if not exists public.balotario_attempts (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 balotario integer not null check (balotario between 1 and 5),
 state text not null default 'active' check (state in ('active','submitted')),
 revision integer not null default 0, started_at timestamptz not null default now(),
 deadline_at timestamptz not null default (now() + interval '120 minutes'), finished_at timestamptz,
 questions jsonb not null check (jsonb_array_length(questions) = 72),
 answers jsonb not null default '{}', flagged jsonb not null default '[]',
 position integer not null default 0 check (position between 0 and 71), result jsonb
);
create unique index if not exists balotario_un_activo on public.balotario_attempts(owner_id) where state = 'active';
create index if not exists balotario_historial on public.balotario_attempts(owner_id, started_at desc);
alter table public.balotario_attempts enable row level security;
drop policy if exists balotario_lectura_propia on public.balotario_attempts;
create policy balotario_lectura_propia on public.balotario_attempts for select to authenticated using (owner_id = auth.uid());
-- Las instantáneas incluyen claves. Se leen solo por la API, que oculta claves
-- activas; no se habilita lectura REST directa ni siquiera al dueño.
revoke all on public.balotario_attempts from public, anon, authenticated;

create table if not exists public.balotario_reviews (
 question_id text primary key check(question_id ~ '^b[1-5]-q[0-9]+$'),
 prompt text not null check(length(prompt) >= 20), options jsonb not null check(jsonb_array_length(options)=4),
 competency text not null, correct text not null check(correct in ('A','B','C','D')),
 explanation text not null check(length(explanation) >= 40), sources jsonb not null check(jsonb_array_length(sources) > 0),
 reviewed_by uuid not null references auth.users(id), reviewed_at timestamptz not null default now()
);
alter table public.balotario_reviews enable row level security;
revoke all on public.balotario_reviews from anon, authenticated;
create table if not exists public.balotario_reports (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 question_id text not null, reason text not null check(length(reason) between 10 and 2000),
 created_at timestamptz not null default now()
);
alter table public.balotario_reports enable row level security;
revoke all on public.balotario_reports from anon, authenticated;
grant all on public.balotario_attempts, public.balotario_reviews, public.balotario_reports to service_role;

create or replace function public.ace_balotario_operar(p_actor uuid, p_action text, p_input jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare t public.balotario_attempts; q jsonb; correcto integer; respondidas integer; qid text; opcion text; competencias jsonb;
begin
 if p_actor is null then raise exception 'Requiere sesión'; end if;
 -- Serializa incluso dos inicios concurrentes de la misma cuenta.
 perform pg_advisory_xact_lock(hashtextextended(p_actor::text, 0));
 if p_action = 'dashboard' or p_action = 'start' then
  select * into t from public.balotario_attempts where owner_id=p_actor and state='active' for update;
 else
  select * into t from public.balotario_attempts where owner_id=p_actor and id=(p_input->>'id')::uuid for update;
  if not found then raise exception using errcode='P0002', message='Intento no encontrado'; end if;
 end if;
 -- Hora del servidor. Entrega automática sin aceptar respuestas posteriores.
 if t.id is not null and t.state='active' and (t.deadline_at <= now() or p_action='submit') then
  if p_action='submit' and t.deadline_at > now() and t.revision <> (p_input->>'revision')::integer then
   raise exception using errcode='40001', message='Revisión desactualizada';
  end if;
  select count(*) filter(where t.answers->>(x->>'id') = x->>'correcta'),
         count(*) filter(where t.answers ? (x->>'id')) into correcto, respondidas
   from jsonb_array_elements(t.questions) x;
  select coalesce(jsonb_agg(to_jsonb(g)),'[]'::jsonb) into competencias from (
   select coalesce(nullif(x->>'competencia',''),'Pendiente de clasificar') as competencia,
    count(*) as total,
    count(*) filter(where t.answers->>(x->>'id') = x->>'correcta') as correctas,
    count(*) filter(where t.answers ? (x->>'id') and t.answers->>(x->>'id') <> x->>'correcta') as incorrectas,
    count(*) filter(where not(t.answers ? (x->>'id'))) as omitidas
    from jsonb_array_elements(t.questions) x group by 1) g;
  update public.balotario_attempts set state='submitted', finished_at=least(now(),deadline_at), revision=revision+1,
   result=jsonb_build_object('correct',correcto,'incorrect',respondidas-correcto,'omitted',72-respondidas,'total',72,'competencies',competencias,
     'seconds',least(7200,greatest(0,floor(extract(epoch from least(now(),deadline_at)-started_at)))))
   where id=t.id returning * into t;
 end if;
 if p_action='dashboard' then
  return jsonb_build_object('active',(select to_jsonb(a) - 'owner_id' from public.balotario_attempts a where owner_id=p_actor and state='active'),
   'history',coalesce((select jsonb_agg((to_jsonb(h) - 'owner_id' - 'questions') || jsonb_build_object('questions','[]'::jsonb) order by h.finished_at desc) from
     (select * from public.balotario_attempts where owner_id=p_actor and state='submitted' order by finished_at desc limit 200) h),'[]'::jsonb));
 elsif p_action='start' then
  if t.id is not null and t.state='active' then return to_jsonb(t) - 'owner_id'; end if;
  if jsonb_array_length(p_input->'questions') <> 72 then raise exception 'Se requieren 72 preguntas'; end if;
  insert into public.balotario_attempts(owner_id,balotario,questions)
    values(p_actor,(p_input->>'balotario')::integer,p_input->'questions') returning * into t;
 elsif p_action='save' and t.state='active' then
  if t.revision <> (p_input->>'revision')::integer then raise exception using errcode='40001', message='Revisión desactualizada'; end if;
  qid:=p_input->>'questionId'; opcion:=p_input->>'option';
  select x into q from jsonb_array_elements(t.questions) x where x->>'id'=qid;
  if q is null then raise exception 'Pregunta inválida'; end if;
  if opcion is not null and not exists(select 1 from jsonb_array_elements(q->'opciones') o where o->>'letra'=opcion) then raise exception 'Opción inválida'; end if;
  update public.balotario_attempts set
   answers=case when opcion is null then answers-qid else jsonb_set(answers,array[qid],to_jsonb(opcion)) end,
   flagged=case when (p_input->>'flagged')::boolean then (select coalesce(jsonb_agg(distinct v),'[]') from jsonb_array_elements_text(flagged || jsonb_build_array(qid)) v) else flagged-qid end,
   position=(p_input->>'position')::integer,revision=revision+1
   where id=t.id returning * into t;
 elsif p_action='position' and t.state='active' then
  if t.revision <> (p_input->>'revision')::integer then raise exception using errcode='40001', message='Revisión desactualizada'; end if;
  update public.balotario_attempts set position=(p_input->>'position')::integer, revision=revision+1 where id=t.id returning * into t;
 elsif p_action not in ('submit','save','get','position') then raise exception 'Acción inválida';
 end if;
 return to_jsonb(t) - 'owner_id';
end $$;
revoke all on function public.ace_balotario_operar(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.ace_balotario_operar(uuid,text,jsonb) to service_role;
commit;
