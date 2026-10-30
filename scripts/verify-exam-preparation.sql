begin;
do $$
declare actor uuid;other_actor uuid:=gen_random_uuid();base exam_questions;c record;i integer;k uuid;t uuid;custom_t uuid;repaso uuid;data jsonb;sets jsonb;first_q uuid;bad text;bal uuid;wrong text;count_q integer; review_item jsonb; r integer; cleared_ids uuid[]; source_id uuid; source_metadata jsonb;
begin
 select u.id into actor from auth.users u where not exists(select 1 from exam_attempts a where a.owner_id=u.id and a.state='active') limit 1;
 if actor is null then raise exception 'No hay actor de prueba sin intento activo';end if;
 select * into base from exam_questions where status='draft' and ace_exam_eligible(exam_questions,true) limit 1;
 if base.id is null then raise exception 'Falta una fuente de prueba válida';end if;
 if (select sum(quota) from exam_curriculum)<>72 or (select count(*) from exam_curriculum)<>30 then raise exception 'Temario incorrecto';end if;
 if has_function_privilege('authenticated','public.ace_exam_start_prepared(uuid,text,text,integer,integer,text,text,boolean,uuid)','execute') then raise exception 'RPC expuesta';end if;
 update exam_questions set status='draft' where status='published';
 begin perform ace_exam_start_prepared(actor,'oece','exam',72,120,'32069');raise exception 'Se permitió un perfil incompleto';exception when others then if sqlerrm='Se permitió un perfil incompleto' then raise;end if;end;
 begin perform ace_exam_start_prepared(actor,'oece','exam',71,120,'32069');raise exception 'Se permitió alterar el perfil';exception when others then if sqlerrm='Se permitió alterar el perfil' then raise;end if;end;
 for c in select * from exam_curriculum order by code loop
 for i in 1..c.quota*5 loop
 insert into exam_questions(prompt,options,correct_option,explanation,regime,topic,competency,difficulty,sources,status,created_by,reviewed_by,reviewed_at,review_basis,curriculum_version,competency_code,subcompetency_code,cognitive_level,option_rationales,review_checks,source_cutoff,origin)
 values('Fixture transaccional de selección, no es una pregunta jurídica '||c.code||'/'||i,base.options,base.correct_option,base.explanation,'32069',c.label,c.competency,'basic',base.sources,'published',actor,actor,now(),'Fixture de prueba revertida, no es una revisión jurídica humana',c.version,c.competency,c.code,'understand','{"A":"Razón ficticia suficientemente extensa para probar selección A","B":"Razón ficticia suficientemente extensa para probar selección B","C":"Razón ficticia suficientemente extensa para probar selección C","D":"Razón ficticia suficientemente extensa para probar selección D"}','{"unambiguous":true,"distractors":true,"conditions":true,"exceptions":true,"sources":true}',current_date,'transaction-test');
 end loop;end loop;
 t:=ace_exam_start_prepared(actor,'oece','exam',72,120,'32069');
 -- now() permanece fijo durante esta transacción; las fechas simulan intentos sucesivos.
 update exam_attempts set started_at=now()-interval '3 minutes' where id=t;
 select to_jsonb(a) into data from exam_attempts a where id=t;
 if jsonb_array_length(data->'questions')<>72 or (data->>'duration_minutes')::integer<>120 then raise exception 'Perfil no fijado';end if;
 if exists(select 1 from exam_curriculum cc where (select count(*) from jsonb_array_elements(data->'questions') j where j->>'subcompetency_code'=cc.code)<>cc.quota) then raise exception 'Cuotas incorrectas';end if;
 if (select count(distinct j->>'id') from jsonb_array_elements(data->'questions')j)<>72 then raise exception 'Preguntas repetidas';end if;
 first_q:=(data->'questions'->0->>'id')::uuid;
 begin perform ace_exam_activity(other_actor,t,first_q);raise exception 'Actividad ajena permitida';exception when sqlstate 'P0002' then null;end;
 perform ace_exam_activity(actor,t,first_q);
 update exam_activity set last_at=now()-interval '4 minutes' where attempt_id=t and question_id=first_q;
 perform ace_exam_activity(actor,t,first_q);
 if (select seconds from exam_activity where attempt_id=t and question_id=first_q)>0 then raise exception 'Se contó inactividad';end if;
 perform ace_exam_question_report(actor,t,first_q,'ambiguous','Reporte ficticio de prueba transaccional');
 perform ace_exam_finish(actor,t,'submit');
 sets:=ace_exam_assemble(actor,'transaction-test-edition');
 if (sets->>'questions')::integer<>360 then raise exception 'No ensambló 360';end if;
 if (select count(distinct question_id) from exam_balotario_questions where edition='transaction-test-edition')<>360 then raise exception 'Repetidos entre balotarios';end if;
 if exists(select 1 from exam_balotarios b where b.edition='transaction-test-edition' and (select count(*) from exam_balotario_questions m where m.balotario_id=b.id)<>72) then raise exception 'Balotario incompleto';end if;
 select id into bal from exam_balotarios where edition='transaction-test-edition' and slot=1;
 custom_t:=ace_exam_start_prepared(actor,'balotario','exam',72,120,'32069','',false,bal);
 update exam_attempts set started_at=now()-interval '2 minutes' where id=custom_t;
 perform ace_exam_finish(actor,custom_t,'submit');
 select question_id into k from exam_balotario_questions where balotario_id=bal limit 1;
 update exam_questions set revision=revision+1 where id=k;
 begin perform ace_exam_start_prepared(actor,'balotario','exam',72,120,'32069','',false,bal);raise exception 'Balotario aceptó revisión distinta';exception when others then if sqlerrm='Balotario aceptó revisión distinta' then raise;end if;end;
 repaso:=ace_exam_start_prepared(actor,'review','practice',10,120,'32069');
 update exam_attempts set started_at=now()-interval '1 minute' where id=repaso;
 if (select question_count from exam_attempts where id=repaso)>10 then raise exception 'Repaso excedido';end if;
 select array_agg((item->>'id')::uuid)into cleared_ids from exam_attempts t cross join jsonb_array_elements(t.questions)item where t.id=repaso;
 for review_item in select item from exam_attempts t cross join jsonb_array_elements(t.questions)item where t.id=repaso loop
 select revision into r from exam_attempts where id=repaso;
 perform ace_exam_save(actor,repaso,r,(review_item->>'id')::uuid,review_item->>'correct_option',false);
 end loop;
 perform ace_exam_finish(actor,repaso,'submit');
 update exam_questions set status='retired' where origin='transaction-test' and id<>all(cleared_ids);
 begin perform ace_exam_start_prepared(actor,'review','practice',10,120,'32069');raise exception 'El repaso volvió a incluir errores ya corregidos';exception when others then if sqlerrm='El repaso volvió a incluir errores ya corregidos' then raise;end if;end;
 begin perform ace_exam_start_prepared(other_actor,'review','practice',10,120,'32069');raise exception 'El repaso permitió historial ajeno';exception when others then if sqlerrm='El repaso permitió historial ajeno' then raise;end if;end;
 update exam_questions set status='published' where origin='transaction-test';
 data:=ace_exam_preparation(actor,true);
 if jsonb_array_length(data->'reports')<1 then raise exception 'No aparece el reporte';end if;
 if exists(select 1 from jsonb_array_elements(data->'metrics')m where (m->>'n')::integer<30 and m->>'discrimination' is not null) then raise exception 'Discriminación con muestra insuficiente';end if;
 select (sources->0->>'documentId')::uuid into source_id from exam_questions where origin='transaction-test' limit 1;
 select metadata into source_metadata from documents where id=source_id;
 update documents set metadata=jsonb_set(metadata,'{officialVersion}',to_jsonb('Versión temporal de prueba'::text)) where id=source_id;
 if exists(select 1 from exam_questions q where q.origin='transaction-test' and ace_exam_eligible(q,false)) then raise exception 'Se aceptó una fuente cuya versión cambió';end if;
 update documents set metadata=source_metadata where id=source_id;
 raise notice 'PASS: cuotas, perfil, cinco balotarios, aislamiento, tiempo, revisión, repaso y métricas';
end$$;
rollback;
