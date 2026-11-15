-- Correcciones autorizadas: 1 UUID; publicación de las aptas y borrador motivado para las pendientes.
-- Revisión asistida autorizada por el administrador del banco; no acredita revisión humana independiente.
begin;
do $operation$
declare
 payload jsonb := $correcciones36${"patches": [{"numero": "Q073", "id": "83158864-0829-4535-a7ee-2da4ee3aed17", "decision": "approve", "motivo": "Reescrita una pregunta complementaria para evaluar inclusión de un ítem desierto en PAC, con necesidad y presupuesto explícitos, conforme al7.1.c modificado. Fuente oficial incorporada con autorización expresa y verificada mediante el importador normal.", "evidencia": [{"chunkId": "c56b45bb-2f8d-43f5-9407-5af2b95fd63a", "chunk_index": 7, "article": "7", "quote": "Artículo 7.- Del contenido del PAC a aprobar 7.1. En el PAC se incluyen todas las contrataciones que realiza la entidad contratante bajo el ámbito de aplicación de la Ley y el Reglamento, con excepción de los contratos menores, según el siguiente detalle: (...) c) Los procedimientos de selección convocados bajo la Ley, que fueron declarados desiertos o nulos y siempre que persista la necesidad y se cuente con el presupuesto respectivo. En los casos de procedimientos de selección según relación de ítems o paquetes, la inclusión en el PAC solo aplicará para los ítems o paquetes declarados desiertos o nulos, según corresponda. (...) 7.2. Adicionalmente, incluye las contrataciones previstas en los literales f), j), k), I), n), o) y q) del numeral 7.1 del artículo 7 de la Ley. En el caso de las contrataciones previstas en el literal q), éstas se incluyen en el PAC, de corresponder. (....)”. “"}], "input": {"id": "83158864-0829-4535-a7ee-2da4ee3aed17", "revision": 1, "prompt": "En un procedimiento por relación de ítems convocado bajo la Ley 32069, solo el ítem 2 fue declarado desierto. Su necesidad persiste y cuenta con presupuesto. Según el numeral 7.1.c de la Directiva 0002-2025-EF/54.01, modificado por el artículo 2 de la RD0041-2025-EF/54.01, ¿qué corresponde incluir en el PAC?", "options": [{"id": "A", "text": "Todos los ítems del procedimiento, incluidos los ya adjudicados."}, {"id": "B", "text": "Solo el ítem declarado desierto, al persistir su necesidad y contar con presupuesto."}, {"id": "C", "text": "Ningún ítem, porque la declaración de desierto impide incluirlo en el PAC."}, {"id": "D", "text": "Todos los contratos de la entidad, incluidos los menores, por el solo hecho del desierto."}], "correctOption": "B", "explanation": "El numeral 7.1.c modificado incluye procedimientos declarados desiertos o nulos cuando persiste la necesidad y existe presupuesto. En relación de ítems o paquetes, la inclusión se limita a los declarados desiertos o nulos; no se extiende a los ya adjudicados. El encabezado 7.1 exceptúa los contratos menores.", "regime": "32069", "topic": "Plan Anual y necesidades", "competency": "Actuaciones preparatorias", "difficulty": "intermediate", "curriculumVersion": "oece-2025-04-25", "competencyCode": "1", "subcompetencyCode": "1.6", "cognitiveLevel": "apply", "optionRationales": {"A": "El numeral 7.1.c limita la inclusión a los ítems o paquetes declarados desiertos o nulos, sin extenderla a los adjudicados.", "B": "El caso cumple persistencia de necesidad y presupuesto; solo corresponde incluir el ítem declarado desierto.", "C": "La declaración de desierto es un supuesto expreso de inclusión cuando se cumplen necesidad y presupuesto.", "D": "El encabezado 7.1 excluye contratos menores; el desierto de un ítem no incorpora todos los contratos de la entidad."}, "reviewChecks": {"unambiguous": true, "distractors": true, "conditions": true, "exceptions": true, "sources": true}, "sourceCutoff": "2026-10-29", "origin": "IA:gemini:gemini-2.5-flash:lote:3d3be616-8201-4a98-8709-9fa6e15e7d85", "sources": [{"documentId": "e638f467-b991-445b-8f26-eb198ee1cc64", "chunkId": "c56b45bb-2f8d-43f5-9407-5af2b95fd63a", "title": "Resolución Directoral N.° 0041-2025-EF/54.01 — modificatoria de la Directiva del PAC", "article": "7", "pageStart": 2, "pageEnd": 2, "quote": "Artículo 7.- Del contenido del PAC a aprobar 7.1. En el PAC se incluyen todas las contrataciones que realiza la entidad contratante bajo el ámbito de aplicación de la Ley y el Reglamento, con excepción de los contratos menores, según el siguiente detalle: (...) c) Los procedimientos de selección convocados bajo la Ley, que fueron declarados desiertos o nulos y siempre que persista la necesidad y se cuente con el presupuesto respectivo. En los casos de procedimientos de selección según relación de ítems o paquetes, la inclusión en el PAC solo aplicará para los ítems o paquetes declarados desiertos o nulos, según corresponda. (...) 7.2. Adicionalmente, incluye las contrataciones previstas en los literales f), j), k), I), n), o) y q) del numeral 7.1 del artículo 7 de la Ley. En el caso de las contrataciones previstas en el literal q), éstas se incluyen en el PAC, de corresponder. (....)”. “", "version": "Texto publicado el 25.12.2025", "sha256": "0962d2b62f3a0d28ed8ecb84319ca4bbfc5f34e0057ce328f78fca8a26c6c914"}], "status": "published", "confirmReview": true, "reviewBasis": "Reescritura y revisión asistida por IA el 15/11/2026, por encargo y autorización expresa del administrador para incorporar la norma PAC y completar el simulacro. Caso de inclusión por ítem desierto, con necesidad y presupuesto. Fuente: numeral 7.1.c de la Directiva 0002-2025-EF/54.01 reproducido en su modificatoria RD0041-2025-EF/54.01, PDF oficial página 2, chunk 7. La fe de erratas 07.01.2026 corrige la sumilla, no el pasaje. No constituye aprobación oficial del OECE ni revisión humana independiente."}, "estadoAnterior": "draft"}], "newSources": []}$correcciones36$::jsonb;
 item jsonb; entry jsonb; s jsonb; ch public.document_chunks; d public.documents;
 actor uuid; approved integer; expected_reviews integer; before_attempts text; after_attempts text; existing public.exam_questions; before_others text; after_others text;
 before_reviews bigint; after_reviews bigint; changed integer := 0;
begin
 if jsonb_array_length(payload->'patches') <> 1 then raise exception 'Alcance distinto de 1'; end if;
 if (select count(distinct x->'input'->>'id') from jsonb_array_elements(payload->'patches') x) <> 1 then raise exception 'UUID repetido'; end if;
 -- Bloquear únicamente las preguntas del lote en orden determinista.
 perform q.id from public.exam_questions q
 where q.id in (select (x->'input'->>'id')::uuid from jsonb_array_elements(payload->'patches') x)
 order by q.id for update;
 if (select count(*) from public.exam_questions q where q.id in
   (select (x->'input'->>'id')::uuid from jsonb_array_elements(payload->'patches') x)) <> 1 then
  raise exception 'No se encontraron todos los UUID';
 end if;
 select md5(coalesce(jsonb_agg(to_jsonb(q) order by q.id),'[]'::jsonb)::text) into before_others
 from public.exam_questions q where q.id not in
 (select (x->'input'->>'id')::uuid from jsonb_array_elements(payload->'patches') x);
 select count(*) into before_reviews from public.exam_question_reviews;
 select count(*) into expected_reviews from jsonb_array_elements(payload->'patches') j where j->'input'->>'status'='published';
 if (select count(distinct created_by) from public.exam_questions where id in (select (j->'input'->>'id')::uuid from jsonb_array_elements(payload->'patches') j))<>1 then raise exception 'Identidad administrativa ambigua';end if;
 select distinct created_by into actor from public.exam_questions where created_by is not null and id in (select (j->'input'->>'id')::uuid from jsonb_array_elements(payload->'patches') j);
 if not exists(select 1 from public.profiles where id=actor and role='admin') then raise exception 'El autor del banco no es administrador';end if;
 select md5(coalesce(jsonb_agg(to_jsonb(t) order by id),'[]'::jsonb)::text) into before_attempts from public.exam_attempts t;

 for item in select value from jsonb_array_elements(payload->'patches') loop
  entry:=item->'input';
  select * into existing from public.exam_questions where id=(entry->>'id')::uuid;
  if existing.revision <> (entry->>'revision')::integer or existing.status <> item->>'estadoAnterior' then
   raise exception 'La pregunta % cambió; no se aplicó el lote',item->>'numero' using errcode='40001';
  end if;
  if entry->>'status' not in ('draft','published') then raise exception 'Estado no autorizado'; end if;
  if entry->>'status'='published' and (entry->>'confirmReview'<>'true' or
   exists(select 1 from jsonb_each_text(entry->'reviewChecks') j where j.value<>'true')) then
   raise exception 'Publicación sin comprobaciones';
  end if;
 end loop;
 -- Referencias editoriales exactas para corregir etiquetas de artículos; no se modifica el corpus original.
 for s in select value from jsonb_array_elements(payload->'newSources') loop
  select * into ch from public.document_chunks where id=(s->>'id')::uuid;
  if found then
   if ch.content<>s->>'content' or ch.metadata->>'article'<>s->'metadata'->>'article' then raise exception 'Referencia derivada diferente';end if;
  else
   select * into ch from public.document_chunks where id=(s->'metadata'->>'derivedFromChunkId')::uuid;
   if not found or ch.document_id<>(s->>'document_id')::uuid or strpos(ch.content,s->>'content')=0 then raise exception 'Extracto no literal';end if;
   perform pg_advisory_xact_lock(hashtextextended(s->>'document_id',0));
   if (select coalesce(max(chunk_index),-1)+1 from public.document_chunks where document_id=(s->>'document_id')::uuid)<>(s->>'chunk_index')::integer then raise exception 'Cambió la secuencia del corpus; revisar';end if;
   insert into public.document_chunks(id,document_id,chunk_index,page_start,page_end,content,metadata)
   values((s->>'id')::uuid,(s->>'document_id')::uuid,(s->>'chunk_index')::integer,(s->>'page_start')::integer,(s->>'page_end')::integer,s->>'content',s->'metadata');
  end if;
 end loop;
 for item in select value from jsonb_array_elements(payload->'patches') loop
  entry:=item->'input';
  for s in select value from jsonb_array_elements(entry->'sources') loop
   select * into ch from public.document_chunks where id=(s->>'chunkId')::uuid;
   if not found or ch.document_id<>(s->>'documentId')::uuid then raise exception 'Fragmento inexistente'; end if;
   select * into d from public.documents where id=ch.document_id;
   if d.status<>'indexed' or d.es_institucional is distinct from true or
    d.metadata->>'indexedTextComplete' is distinct from 'true' or
    d.metadata->>'sha256' is distinct from s->>'sha256' or
    d.metadata->>'officialVersion' is distinct from s->>'version' or d.title<>s->>'title' or
    ch.metadata->>'article' is distinct from s->>'article' or
    ch.page_start is distinct from (s->>'pageStart')::integer or ch.page_end is distinct from (s->>'pageEnd')::integer or
    coalesce((ch.metadata->>'ocrPartial')::boolean,false) or
    strpos(regexp_replace(ch.content,'\s+',' ','g'),regexp_replace(s->>'quote','\s+',' ','g'))=0 then
    raise exception 'La fuente de % requiere revisión; no se aplicó el lote',item->>'numero';
   end if;
   if coalesce(d.metadata->>'regime'<>entry->>'regime',true) and
      not coalesce(d.metadata->'declaredRegimes' ? (entry->>'regime'),false) then
    raise exception 'Régimen de fuente incompatible';
   end if;
  end loop;
  -- Publicación asistida por encargo explícito del administrador, con evidencia individual.
  perform public.ace_exam_edit(actor,entry);
  select * into existing from public.exam_questions where id=(entry->>'id')::uuid;
  if existing.status<>entry->>'status' or existing.revision<>(entry->>'revision')::integer+1 or
    (entry->>'status'='published' and (existing.reviewed_by is distinct from actor or existing.reviewed_at is null or not public.ace_exam_prepared(existing))) or
    (entry->>'status'='draft' and (existing.reviewed_by is not null or existing.reviewed_at is not null)) or
    existing.prompt<>entry->>'prompt' or existing.options<>entry->'options' or
    existing.correct_option<>entry->>'correctOption' or existing.sources<>entry->'sources' then
   raise exception 'Verificación posterior fallida';
  end if;
  changed:=changed+1;
 end loop;
 select md5(coalesce(jsonb_agg(to_jsonb(q) order by q.id),'[]'::jsonb)::text) into after_others
 from public.exam_questions q where q.id not in
 (select (x->'input'->>'id')::uuid from jsonb_array_elements(payload->'patches') x);
 select count(*) into after_reviews from public.exam_question_reviews;
 select md5(coalesce(jsonb_agg(to_jsonb(t) order by id),'[]'::jsonb)::text) into after_attempts from public.exam_attempts t;

 if changed<>1 or before_others<>after_others or before_reviews+expected_reviews<>after_reviews or before_attempts<>after_attempts then
  raise exception 'Se alteraron registros fuera del alcance';
 end if;
end $operation$;
commit;
select status,count(*) as total from public.exam_questions group by status order by status;
