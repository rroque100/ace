begin;
create table public.exam_curriculum(version text not null,code text not null,competency text not null,label text not null,quota integer not null check(quota>0),primary key(version,code));
insert into public.exam_curriculum(version,code,competency,label,quota) values
('oece-2025-04-25','1.1','1','Expediente de contratación',6),
('oece-2025-04-25','1.2','1','Requerimiento, estrategia y mercado',13),
('oece-2025-04-25','1.3','1','Tipos y perfiles de evaluadores',1),
('oece-2025-04-25','1.4','1','Documentos estandarizados',1),
('oece-2025-04-25','1.5','1','Modificación del Plan Anual',1),
('oece-2025-04-25','1.6','1','Plan Anual y necesidades',1),
('oece-2025-04-25','1.7','1','Actores de la contratación',1),
('oece-2025-04-25','1.8','1','PLADICOP en actuaciones preparatorias',1),
('oece-2025-04-25','2.1','2','Procedimientos y modalidades',5),
('oece-2025-04-25','2.2','2','Etapas, plazos y condiciones',8),
('oece-2025-04-25','2.3','2','Evaluación, principios y criterios',1),
('oece-2025-04-25','2.4','2','Consentimiento y firmeza de la buena pro',1),
('oece-2025-04-25','2.5','2','Pérdida de la buena pro',1),
('oece-2025-04-25','2.6','2','PLADICOP en selección',2),
('oece-2025-04-25','2.7','2','Interposición de apelaciones',1),
('oece-2025-04-25','2.8','2','Resolución de apelaciones',1),
('oece-2025-04-25','2.9','2','Condiciones para perfeccionar el contrato',1),
('oece-2025-04-25','2.10','2','Requisitos y plazos de perfeccionamiento',1),
('oece-2025-04-25','3.1','3','Contenido y vigencia del contrato',1),
('oece-2025-04-25','3.2','3','Modificaciones contractuales',6),
('oece-2025-04-25','3.3','3','Penalidades, garantías, resolución y nulidad',3),
('oece-2025-04-25','3.4','3','Entrega, conformidad y observaciones',1),
('oece-2025-04-25','3.5','3','Controversias y solución de conflictos',3),
('oece-2025-04-25','3.6','3','Requisitos de ejecución de obras',1),
('oece-2025-04-25','3.7','3','Expediente técnico de obra',1),
('oece-2025-04-25','3.8','3','Residente, supervisor y responsables',1),
('oece-2025-04-25','3.9','3','Adelantos y amortización',1),
('oece-2025-04-25','3.10','3','Modificaciones de obras',5),
('oece-2025-04-25','3.11','3','Valorización, recepción y liquidación',1),
('oece-2025-04-25','3.12','3','Contratos estandarizados',1);
alter table public.exam_questions add column curriculum_version text, add column competency_code text, add column subcompetency_code text, add column cognitive_level text not null default 'understand' check(cognitive_level in('understand','apply','analyze')), add column option_rationales jsonb not null default '{}'::jsonb, add column review_checks jsonb not null default '{}'::jsonb, add column source_cutoff date, add column origin text not null default 'manual';
alter table public.exam_questions add foreign key(curriculum_version,subcompetency_code) references public.exam_curriculum(version,code);
alter table public.exam_attempts add column profile text not null default 'custom' check(profile in('custom','oece','review','balotario')),add column balotario_id uuid;
create index exam_curriculum_status on public.exam_questions(curriculum_version,subcompetency_code,status);
create table public.exam_balotarios(id uuid primary key default gen_random_uuid(),edition text not null,slot integer not null check(slot between 1 and 5),created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),unique(edition,slot),unique(id,edition));
create table public.exam_balotario_questions(balotario_id uuid not null,edition text not null,question_id uuid not null references public.exam_questions(id),question_revision integer not null,primary key(balotario_id,question_id),unique(edition,question_id),foreign key(balotario_id,edition) references public.exam_balotarios(id,edition));
alter table public.exam_attempts add foreign key(balotario_id) references public.exam_balotarios(id);
create table public.exam_question_reports(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),attempt_id uuid not null references public.exam_attempts(id),question_id uuid not null references public.exam_questions(id),question_revision integer not null,reason text not null check(reason in('ambiguous','key','outdated','explanation')),comment text not null default '',state text not null default 'open' check(state in('open','resolved')),resolution text, resolved_by uuid references auth.users(id),resolved_at timestamptz,created_at timestamptz not null default now(),unique(owner_id,attempt_id,question_id,reason));
create table public.exam_activity(attempt_id uuid not null references public.exam_attempts(id),question_id uuid not null,seconds integer not null default 0,last_at timestamptz not null default now(),primary key(attempt_id,question_id));
create table public.exam_authoring_batches(id uuid primary key default gen_random_uuid(),subcompetency_code text not null,target integer not null,state text not null check(state in('running','completed','partial','failed')),created_count integer not null default 0,detail text,provider text,model text,created_at timestamptz not null default now(),finished_at timestamptz);
create or replace function public.ace_exam_prepared(q public.exam_questions) returns boolean language sql stable set search_path=public as $$
 select coalesce(ace_exam_eligible(q,false) and q.curriculum_version='oece-2025-04-25' and exists(select 1 from exam_curriculum c where c.version=q.curriculum_version and c.code=q.subcompetency_code and c.competency=q.competency_code) and q.source_cutoff is not null and not exists(select 1 from unnest(array['A','B','C','D']) k where length(coalesce(q.option_rationales->>k,''))<20) and not exists(select 1 from unnest(array['unambiguous','distractors','conditions','exceptions','sources']) k where q.review_checks->>k is distinct from 'true'),false)
$$;
create or replace function public.ace_exam_edit(p_actor uuid,p_input jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare q exam_questions;k uuid:=coalesce(nullif(p_input->>'id','')::uuid,gen_random_uuid());
begin
 if p_input->>'status' not in('draft','published','retired') then raise exception 'Estado inválido';end if;
 select * into q from exam_questions where id=k for update;
 if q.id is not null and q.revision<>(p_input->>'revision')::integer then raise exception 'La pregunta cambió; actualiza el banco.' using errcode='40001';end if;
 if nullif(p_input->>'subcompetencyCode','') is not null and not exists(select 1 from exam_curriculum c where c.version=p_input->>'curriculumVersion' and c.code=p_input->>'subcompetencyCode' and c.competency=p_input->>'competencyCode') then raise exception 'Clasificación incompatible con el temario';end if;
 if p_input->>'status'='published' then
  if coalesce((p_input->>'confirmReview')::boolean,false) is not true or length(coalesce(p_input->>'reviewBasis',''))<20 then raise exception 'Confirma y fundamenta la revisión';end if;
  if p_input->>'curriculumVersion'<>'oece-2025-04-25' or nullif(p_input->>'subcompetencyCode','') is null or nullif(p_input->>'sourceCutoff','') is null or exists(select 1 from unnest(array['A','B','C','D']) x where length(coalesce(p_input->'optionRationales'->>x,''))<20) or exists(select 1 from unnest(array['unambiguous','distractors','conditions','exceptions','sources']) x where p_input->'reviewChecks'->>x is distinct from 'true') then raise exception 'Completa clasificación, fecha, razones y comprobaciones de revisión';end if;
 end if;
 insert into exam_questions(id,prompt,options,correct_option,explanation,regime,topic,competency,difficulty,sources,status,created_by,reviewed_by,reviewed_at,review_basis,curriculum_version,competency_code,subcompetency_code,cognitive_level,option_rationales,review_checks,source_cutoff,origin)
 values(k,p_input->>'prompt',p_input->'options',p_input->>'correctOption',p_input->>'explanation',p_input->>'regime',p_input->>'topic',p_input->>'competency',p_input->>'difficulty',p_input->'sources',p_input->>'status',p_actor,case when p_input->>'status'='published' then p_actor end,case when p_input->>'status'='published' then now() end,p_input->>'reviewBasis',nullif(p_input->>'curriculumVersion',''),nullif(p_input->>'competencyCode',''),nullif(p_input->>'subcompetencyCode',''),coalesce(p_input->>'cognitiveLevel','understand'),coalesce(p_input->'optionRationales','{}'),coalesce(p_input->'reviewChecks','{}'),nullif(p_input->>'sourceCutoff','')::date,coalesce(p_input->>'origin','manual'))
 on conflict(id)do update set prompt=excluded.prompt,options=excluded.options,correct_option=excluded.correct_option,explanation=excluded.explanation,regime=excluded.regime,topic=excluded.topic,competency=excluded.competency,difficulty=excluded.difficulty,sources=excluded.sources,status=excluded.status,revision=exam_questions.revision+1,reviewed_by=excluded.reviewed_by,reviewed_at=excluded.reviewed_at,review_basis=excluded.review_basis,updated_at=now(),curriculum_version=excluded.curriculum_version,competency_code=excluded.competency_code,subcompetency_code=excluded.subcompetency_code,cognitive_level=excluded.cognitive_level,option_rationales=excluded.option_rationales,review_checks=excluded.review_checks,source_cutoff=excluded.source_cutoff,origin=excluded.origin;
 if p_input->>'status'='published' then
  select * into q from exam_questions where id=k;
  if not ace_exam_prepared(q) then raise exception 'La fuente o la revisión no cumplen el estándar de publicación';end if;
  insert into exam_question_reviews(question_id,actor_id,revision,basis,snapshot) values(k,p_actor,q.revision,p_input->>'reviewBasis',to_jsonb(q));
 end if;
 return k;
end;$$;
create or replace function public.ace_exam_start_prepared(p_actor uuid,p_profile text,p_mode text,p_count integer,p_minutes integer,p_regime text,p_topic text default '',p_preview boolean default false,p_balotario uuid default null) returns uuid language plpgsql security definer set search_path=public as $$
declare a exam_attempts; qs jsonb;new_id uuid; missing text;
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
  with errors as(select distinct j->>'id' id from exam_attempts t cross join jsonb_array_elements(t.questions)j left join exam_answers r on r.attempt_id=t.id and r.question_id::text=j->>'id' where t.owner_id=p_actor and t.state='submitted' and not t.preview and r.option is distinct from j->>'correct_option')
  select jsonb_agg(to_jsonb(x)) into qs from(select q.* from exam_questions q join errors e on e.id=q.id::text where q.regime=p_regime and ace_exam_eligible(q,false) and (p_topic='' or q.topic=p_topic) order by random() limit p_count)x;
  if coalesce(jsonb_array_length(qs),0)=0 then raise exception 'No hay errores propios con preguntas publicadas y fuentes actuales para repasar';end if;
 end if;
 insert into exam_attempts(owner_id,mode,preview,regime,topic,question_count,duration_minutes,questions,deadline_at,profile,balotario_id) values(p_actor,p_mode,false,p_regime,p_topic,jsonb_array_length(qs),case when p_mode='exam' then 120 else 0 end,qs,case when p_mode='exam' then now()+interval '120 minutes' else null end,p_profile,case when p_profile='balotario' then p_balotario end) returning id into new_id;
 return new_id;
end;$$;
create or replace function public.ace_exam_assemble(p_actor uuid,p_edition text) returns jsonb language plpgsql security definer set search_path=public as $$
declare missing text;s integer;
begin
 if length(p_edition) not between 5 and 100 then raise exception 'Edición inválida';end if;
 perform pg_advisory_xact_lock(904830);
 if exists(select 1 from exam_balotarios where edition=p_edition) then raise exception 'Esta edición ya existe; no se modifica una edición fijada';end if;
 select string_agg(c.code,', ') into missing from exam_curriculum c where c.version='oece-2025-04-25' and (select count(*) from exam_questions q where q.subcompetency_code=c.code and q.regime='32069' and ace_exam_prepared(q))<c.quota*5;
 if missing is not null then raise exception 'La edición necesita 360 preguntas revisadas; faltan cuotas en: %',missing;end if;
 for s in 1..5 loop insert into exam_balotarios(edition,slot,created_by) values(p_edition,s,p_actor);end loop;
 with ranked as(select q.id,q.revision,row_number()over(partition by q.subcompetency_code order by random()) rn,c.quota from exam_questions q join exam_curriculum c on c.version=q.curriculum_version and c.code=q.subcompetency_code where q.regime='32069' and ace_exam_prepared(q))
 insert into exam_balotario_questions(balotario_id,edition,question_id,question_revision) select b.id,b.edition,r.id,r.revision from ranked r join exam_balotarios b on b.edition=p_edition and b.slot=ceil(r.rn::numeric/r.quota) where r.rn<=r.quota*5;
 return jsonb_build_object('edition',p_edition,'balotarios',5,'questions',360);
end;$$;
create or replace function public.ace_exam_activity(p_actor uuid,p_id uuid,p_question uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from exam_attempts t where t.id=p_id and t.owner_id=p_actor and t.state='active' and (t.deadline_at is null or t.deadline_at>now()) and exists(select 1 from jsonb_array_elements(t.questions)q where q->>'id'=p_question::text)) then raise exception 'Intento activo no encontrado' using errcode='P0002';end if;
 insert into exam_activity(attempt_id,question_id)values(p_id,p_question)on conflict(attempt_id,question_id)do update set seconds=exam_activity.seconds+case when now()-exam_activity.last_at<=interval '20 seconds' then greatest(0,least(15,floor(extract(epoch from(now()-exam_activity.last_at)))::integer)) else 0 end,last_at=now();
end;$$;
create or replace function public.ace_exam_question_report(p_actor uuid,p_id uuid,p_question uuid,p_reason text,p_comment text) returns uuid language plpgsql security definer set search_path=public as $$
declare a exam_attempts;rev integer;new_id uuid;
begin
 select * into a from exam_attempts where id=p_id and owner_id=p_actor;
 if a.id is null then raise exception 'Intento no encontrado' using errcode='P0002';end if;
 select (q->>'revision')::integer into rev from jsonb_array_elements(a.questions)q where q->>'id'=p_question::text;
 if rev is null or p_reason not in('ambiguous','key','outdated','explanation') or length(p_comment)>2000 then raise exception 'Reporte inválido';end if;
 insert into exam_question_reports(owner_id,attempt_id,question_id,question_revision,reason,comment)values(p_actor,p_id,p_question,rev,p_reason,p_comment)on conflict(owner_id,attempt_id,question_id,reason)do update set comment=excluded.comment returning id into new_id;
 return new_id;
end;$$;
create or replace function public.ace_exam_preparation(p_actor uuid,p_admin boolean default false) returns jsonb language plpgsql security definer set search_path=public as $$
declare coverage jsonb;progress jsonb;sets jsonb;reports jsonb;metrics jsonb;
begin
 select jsonb_agg(to_jsonb(x) order by x.code)into coverage from(select c.version,c.code,c.competency,c.label,c.quota,c.quota*5 target,count(q.id)filter(where q.regime='32069' and ace_exam_prepared(q)) published,count(q.id)filter(where q.regime='32069' and q.status='draft' and ace_exam_eligible(q,true)) drafts from exam_curriculum c left join exam_questions q on q.curriculum_version=c.version and q.subcompetency_code=c.code where c.version='oece-2025-04-25' group by c.version,c.code,c.competency,c.label,c.quota)x;
 with exposures as(select j->>'id' question,j->>'revision' revision,j->>'subcompetency_code' code,r.option,j->>'correct_option' correct,row_number()over(partition by j->>'id',j->>'revision' order by t.started_at desc) rn from exam_attempts t cross join jsonb_array_elements(t.questions)j left join exam_answers r on r.attempt_id=t.id and r.question_id::text=j->>'id' where t.owner_id=p_actor and t.state='submitted' and not t.preview), g as(select code,count(*) total,count(*)filter(where option=correct) correct,count(*)filter(where option is null) omitted from exposures where rn=1 group by code)
 select coalesce(jsonb_agg(to_jsonb(g)),'[]')into progress from g;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]')into sets from(select b.id,b.edition,b.slot,b.created_at,count(q.id)filter(where q.revision=m.question_revision and ace_exam_prepared(q)) eligible from exam_balotarios b left join exam_balotario_questions m on m.balotario_id=b.id left join exam_questions q on q.id=m.question_id group by b.id order by b.created_at desc,b.slot limit 5)x;
 if p_admin then
  select coalesce(jsonb_agg(to_jsonb(x)),'[]')into reports from(select r.id,r.question_id,r.question_revision,r.reason,r.comment,r.state,r.created_at,r.resolution from exam_question_reports r order by (r.state='open') desc,r.created_at desc limit 100)x;
  with exposures as(select j->>'id' question_id,(j->>'revision')::integer revision,t.owner_id,t.started_at,case when r.option=j->>'correct_option' then 1 else 0 end answer,(t.result->>'correct')::integer-case when r.option=j->>'correct_option' then 1 else 0 end rest_score,r.option,coalesce(ac.seconds,0) seconds,row_number()over(partition by t.owner_id,j->>'id',j->>'revision' order by t.started_at) rn from exam_attempts t cross join jsonb_array_elements(t.questions)j left join exam_answers r on r.attempt_id=t.id and r.question_id::text=j->>'id' left join exam_activity ac on ac.attempt_id=t.id and ac.question_id::text=j->>'id' where t.state='submitted' and t.mode='exam' and not t.preview and t.profile in('oece','balotario')),
 g as(select question_id,revision,count(*) n,avg(answer::numeric) accuracy,count(*)filter(where option is null) omitted,avg(seconds) active_seconds,case when count(*)>=30 and count(distinct answer)>1 and count(distinct rest_score)>1 then corr(answer,rest_score) end discrimination from exposures where rn=1 group by question_id,revision)
 select coalesce(jsonb_agg(to_jsonb(g)),'[]')into metrics from g;
 end if;
 return jsonb_build_object('version','oece-2025-04-25','coverage',coalesce(coverage,'[]'),'progress',progress,'balotarios',sets,'reports',coalesce(reports,'[]'),'metrics',coalesce(metrics,'[]'),'authoring',case when p_admin then coalesce((select jsonb_agg(to_jsonb(z))from(select id,subcompetency_code,target,state,created_count,detail,provider,model,created_at from exam_authoring_batches order by created_at desc limit 30)z),'[]'::jsonb)else '[]'::jsonb end);
end;$$;
create or replace function public.ace_exam_resolve_report(p_actor uuid,p_id uuid,p_resolution text) returns void language plpgsql security definer set search_path=public as $$
begin
 if length(trim(p_resolution))<20 or length(p_resolution)>2000 then raise exception 'Explica la revisión del reporte';end if;
 update exam_question_reports set state='resolved',resolution=p_resolution,resolved_by=p_actor,resolved_at=now() where id=p_id and state='open';
 if not found then raise exception 'Reporte abierto no encontrado' using errcode='P0002';end if;
end;$$;
do $$declare t text;begin
 foreach t in array array['exam_curriculum','exam_balotarios','exam_balotario_questions','exam_question_reports','exam_activity','exam_authoring_batches']loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
end$$;
revoke all on function public.ace_exam_prepared(public.exam_questions),public.ace_exam_start_prepared(uuid,text,text,integer,integer,text,text,boolean,uuid),public.ace_exam_assemble(uuid,text),public.ace_exam_activity(uuid,uuid,uuid),public.ace_exam_question_report(uuid,uuid,uuid,text,text),public.ace_exam_preparation(uuid,boolean),public.ace_exam_resolve_report(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.ace_exam_prepared(public.exam_questions),public.ace_exam_start_prepared(uuid,text,text,integer,integer,text,text,boolean,uuid),public.ace_exam_assemble(uuid,text),public.ace_exam_activity(uuid,uuid,uuid),public.ace_exam_question_report(uuid,uuid,uuid,text,text),public.ace_exam_preparation(uuid,boolean),public.ace_exam_resolve_report(uuid,uuid,text) to service_role;
commit;
