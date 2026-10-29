begin;
do $$
declare actor uuid;other_actor uuid:=gen_random_uuid();q exam_questions;a uuid;b uuid;r jsonb;ok boolean;
begin
 if has_function_privilege('anon','public.ace_exam_start(uuid,text,integer,integer,text,text,boolean)','execute') then raise exception 'Anon puede iniciar';end if;
 if has_table_privilege('authenticated','public.exam_questions','select') then raise exception 'Claves expuestas por tabla';end if;
 select created_by into actor from legal_official_sources where created_by is not null limit 1;
 if exists(select 1 from exam_attempts where owner_id=actor and state='active') then raise exception 'El usuario de prueba tiene un intento activo; no interferir';end if;
 select * into q from exam_questions where ace_exam_eligible(exam_questions,true) limit 1;
 if q.id is null then raise exception 'Faltan borradores con fuente comprobada';end if;
 update exam_questions set status='draft' where status in('draft','published','retired');update exam_questions set status='published',reviewed_by=actor,reviewed_at=now(),review_basis='Revisión transaccional de prueba; no se conserva.' where id=q.id;
 ok:=false;begin perform ace_exam_start(actor,'exam',2,10,'32069');exception when raise_exception then if SQLERRM like 'No hay suficientes%' then ok:=true;else raise;end if;end;if not ok then raise exception 'Se repitieron preguntas para completar cupo';end if;
 a:=ace_exam_start(actor,'exam',1,10,'32069');b:=ace_exam_start(actor,'exam',1,10,'32069');if a<>b then raise exception 'Doble intento activo';end if;
 ok:=false;begin perform ace_exam_get(other_actor,a);exception when no_data_found then ok:=true;end;if not ok then raise exception 'Acceso cruzado permitido';end if;
 r:=ace_exam_save(actor,a,0,q.id,q.correct_option,true);if r->'attempt'->>'revision'<>'1' then raise exception 'No guardó revisión';end if;
 ok:=false;begin perform ace_exam_save(actor,a,0,q.id,'A',false);exception when serialization_failure then ok:=true;end;if not ok then raise exception 'Conflicto no detectado';end if;
 update exam_questions set correct_option=case when correct_option='A' then 'B' else 'A' end where id=q.id;
 r:=ace_exam_finish(actor,a,'submit');if r->'attempt'->'result'->>'correct'<>'1' then raise exception 'Cambió la clave histórica';end if;
 r:=ace_exam_finish(actor,a,'submit');if r->'attempt'->'result'->>'correct'<>'1' then raise exception 'Entrega no idempotente';end if;
 a:=ace_exam_start(actor,'exam',1,10,'32069');update exam_attempts set deadline_at=now()-interval '1 second' where id=a;r:=ace_exam_get(actor,a);if r->'attempt'->>'state'<>'submitted' or r->'attempt'->'result'->>'omitted'<>'1' then raise exception 'No cerró al vencer';end if;
 a:=ace_exam_start(actor,'practice',1,10,'32069','',true);r:=ace_exam_finish(actor,a,'cancel');if r->'attempt'->>'state'<>'cancelled' or r->'attempt'->'result'<>'null'::jsonb then raise exception 'Cancelación alteró nota';end if;
 update exam_questions set status='draft' where status in('draft','published','retired');update exam_questions set status='published',sources=jsonb_set(sources,'{0,sha256}',to_jsonb(repeat('a',64))) where id=q.id;
 ok:=false;begin perform ace_exam_start(actor,'exam',1,10,'32069');exception when raise_exception then if SQLERRM like 'No hay suficientes%' then ok:=true;else raise;end if;end;if not ok then raise exception 'No retiró una fuente cambiada';end if;
 raise notice 'PASS: permisos, cupo, exclusión, propiedad, guardado, conflictos, snapshot, entrega, vencimiento y cambio de fuente';
end $$;
rollback;
