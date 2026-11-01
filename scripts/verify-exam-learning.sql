begin;
do $$
declare actor uuid;admin_actor uuid;outsider uuid:=gen_random_uuid();base exam_questions;k uuid:=gen_random_uuid();t uuid;review_id uuid;data jsonb;n integer;
begin
 select id into actor from auth.users u where not exists(select 1 from exam_attempts a where a.owner_id=u.id and a.state='active')limit 1;
 select id into admin_actor from profiles where role='admin'limit 1;
 if actor is null or admin_actor is null then raise exception 'Faltan actores de prueba';end if;
 select *into base from exam_questions q where ace_exam_eligible(q,true)limit 1;
 if base.id is null then raise exception 'Falta una fuente disponible';end if;
 insert into exam_questions(id,prompt,options,correct_option,explanation,regime,topic,competency,difficulty,sources,status,created_by,reviewed_by,reviewed_at,review_basis,competency_code)
 values(k,'Fixture transaccional de aprendizaje, sin valor jurídico '||k,base.options,base.correct_option,base.explanation,base.regime,base.topic,base.competency,base.difficulty,base.sources,'published',admin_actor,admin_actor,now(),'Fixture temporal revertida; no constituye revisión humana','1');
 select to_jsonb(q)into data from exam_questions q where id=k;
 insert into exam_attempts(owner_id,mode,preview,regime,topic,question_count,duration_minutes,questions,state,started_at,finished_at)
 values(actor,'practice',false,base.regime,base.topic,1,0,jsonb_build_array(data),'submitted',now()-interval '2 days',now()-interval '2 days')returning id into t;
 review_id:=ace_exam_start_scheduled(actor,array[k]);
 if (select question_count from exam_attempts where id=review_id)<>1 then raise exception 'Repaso incorrecto';end if;
 perform ace_exam_checkpoint(actor,review_id,k);
 if (select last_question_id from exam_attempts where id=review_id)<>k then raise exception 'No guarda posición';end if;
 begin perform ace_exam_checkpoint(outsider,review_id,k);raise exception 'Posición ajena permitida';exception when sqlstate 'P0002'then null;end;
 perform ace_exam_finish(actor,review_id,'cancel');
 begin perform ace_exam_start_scheduled(outsider,array[k]);raise exception 'Repaso ajeno permitido';exception when others then if sqlerrm='Repaso ajeno permitido'then raise;end if;end;
 perform ace_exam_editorial_task(admin_actor,k,0,'reviewing','Fixture de seguimiento transaccional');
 perform ace_exam_editorial_task(admin_actor,k,0,'blocked','Otra observación de prueba transaccional');
 if (select jsonb_array_length(history)from exam_editorial_tasks where question_id=k)<>2 then raise exception 'Se perdió trazabilidad';end if;
 begin perform ace_exam_editorial_task(admin_actor,k,99,'reviewing','Fixture de revisión antigua');raise exception 'Se aceptó revisión antigua';exception when sqlstate '40001'then null;end;
 if (select status from exam_questions where id=k)<>'published'then raise exception 'Seguimiento cambió publicación';end if;
 if has_function_privilege('authenticated','public.ace_exam_checkpoint(uuid,uuid,uuid)','execute')or has_table_privilege('authenticated','public.exam_editorial_tasks','select')then raise exception 'Tablas o funciones expuestas';end if;
 review_id:=ace_exam_start_competency(actor,'1','practice',1,120,base.regime,base.topic,false);
 if (select questions->0->>'competency_code'from exam_attempts where id=review_id)<>'1'then raise exception 'Filtro de competencia omitido';end if;
 perform ace_exam_finish(actor,review_id,'cancel');
 raise notice 'PASS: repaso privado, posición, revisión editorial, trazabilidad, permisos y competencia';
end$$;
rollback;
