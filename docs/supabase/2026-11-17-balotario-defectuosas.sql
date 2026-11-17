-- Corrige las 6 preguntas defectuosas detectadas por el análisis de coherencia
-- (docs/evaluaciones/2026-11-17-coherencia-simulador-curso.md, sección 4):
--   b1-q32  la clave hablaba de un «acta de inicio de obra» que no existe en el Reglamento.
--   b2-q71  la clave era un procedimiento inexistente («Adjudicación Simplificada»).
--   b4-q28  enunciado y clave se contradecían (preguntaba cuándo NO quedaba firme; clave = caso en que SÍ).
--   b4-q51  describía tarifas y la clave decía «precios unitarios».
--   b4-q68  describía tarifas y la clave decía «pago por consumo».
--   b4-q63  no daba la cuantía que exige la regla de las 50 UIT de la Ley, Art. 74.
-- Cada cita de «sources» se extrajo verbatim del chunk indicado y pasa la misma validación que
-- validateExamSources. Revisión a nombre de la cuenta Administradora. Ya aplicado; queda como respaldo.

begin;
-- b1-q32
insert into public.balotario_reviews (question_id, prompt, options, competency, correct, explanation, sources, reviewed_by, reviewed_at)
values (
  'b1-q32',
  'Sobre el inicio del plazo de ejecución contractual de una obra, indique la afirmación incorrecta:',
  '[{"id":"A","text":"En el sistema de solo construcción, la entrega total o parcial del terreno es condición para que empiece a correr el plazo."},{"id":"B","text":"La entrega del adelanto directo solicitado deja de ser condición de inicio cuando se garantiza mediante fideicomiso."},{"id":"C","text":"En diseño y construcción, la ejecución del componente obra se inicia en un plazo máximo de veinte días computados desde el día siguiente de la aprobación del expediente técnico."},{"id":"D","text":"El plazo de ejecución corre desde la suscripción del contrato, sin condiciones adicionales."}]'::jsonb,
  'COMPETENCIA 3',
  'D',
  'El artículo 176 del Reglamento sujeta el inicio del plazo de ejecución de la obra a condiciones expresas: la entrega de la actualización del expediente técnico o de la documentación técnica, la comunicación de quién supervisa, la entrega del adelanto directo solicitado (condición que no aplica si se garantiza con fideicomiso), la suscripción del contrato tripartito de la JPRD de corresponder y, en solo construcción, la entrega del terreno; además, en diseño y construcción el componente obra inicia como máximo veinte días después de aprobado el expediente técnico. Por eso la afirmación D es la incorrecta: el plazo no corre por la sola suscripción del contrato.',
  '[{"documentId":"8371bce1-f773-4ad8-8efa-1266276ae4ec","chunkId":"405c1773-78bf-4592-9155-7cbe8b5d3bf4","title":"Reglamento de la Ley N.° 32069 — texto actualizado al 09.01.2026","article":"176","pageStart":93,"pageEnd":93,"quote":"176.1. El inicio del plazo de ejecución contractual de obras rige desde que la entidad contratante cumpla con las siguientes condiciones: a) Entrega de la actualización del expediente técnico o de la documentación técnica necesaria para que realice el diseño correspondiente, según corresponda, en caso estos se hubiesen modificado con ocasión del procedimiento de selección.","version":"Texto actualizado al 09.01.2026","sha256":"0ebe95b3e05661b80f73c060d6e6ce8dd17621ce34af9277c688dd67e5d99830"},{"documentId":"8371bce1-f773-4ad8-8efa-1266276ae4ec","chunkId":"02861435-eeb7-58da-bb06-34a0f00399e6","title":"Reglamento de la Ley N.° 32069 — texto actualizado al 09.01.2026","article":"176","pageStart":93,"pageEnd":97,"quote":"Esta condición no aplica cuando el adelanto directo se garantiza mediante fideicomiso. d) La suscripción del contrato tripartito para la conformación de la JPRD, de corresponder. e) En el caso de obras bajo el sistema de entrega de solo construcción, la entrega total o parcial del terreno o lugar donde se ejecuta la obra, según corresponda.","version":"Texto actualizado al 09.01.2026","sha256":"0ebe95b3e05661b80f73c060d6e6ce8dd17621ce34af9277c688dd67e5d99830"},{"documentId":"8371bce1-f773-4ad8-8efa-1266276ae4ec","chunkId":"e054c427-a4a7-53bd-a201-07ffae443596","title":"Reglamento de la Ley N.° 32069 — texto actualizado al 09.01.2026","article":"176","pageStart":93,"pageEnd":97,"quote":"En un plazo máximo de veinte días computados desde el día siguiente de la aprob ación del expediente técnico, se inicia la ejecución del componente obra","version":"Texto actualizado al 09.01.2026","sha256":"0ebe95b3e05661b80f73c060d6e6ce8dd17621ce34af9277c688dd67e5d99830"}]'::jsonb,
  'c26b5e32-cde4-4ee9-ba00-302197162ba3',
  now()
) on conflict (question_id) do update set prompt = excluded.prompt, options = excluded.options, competency = excluded.competency, correct = excluded.correct, explanation = excluded.explanation, sources = excluded.sources, reviewed_by = excluded.reviewed_by, reviewed_at = now();

-- b2-q71
insert into public.balotario_reviews (question_id, prompt, options, competency, correct, explanation, sources, reviewed_by, reviewed_at)
values (
  'b2-q71',
  '¿En cuál de los siguientes procedimientos de selección NO puede perfeccionarse el contrato mediante la recepción de la orden de compra o de servicio?',
  '[{"id":"A","text":"Comparación de precios"},{"id":"B","text":"Concurso público abreviado"},{"id":"C","text":"Subasta inversa electrónica cuyo monto no supera el de una licitación pública abreviada para bienes o concurso público abreviado"},{"id":"D","text":"Licitación pública (no abreviada)"}]'::jsonb,
  'COMPETENCIA 2',
  'D',
  'El artículo 87 del Reglamento permite perfeccionar el contrato con la recepción de la orden de compra o de servicio en las licitaciones públicas abreviadas para bienes, los concursos públicos abreviados y la comparación de precios, si las bases lo prevén y la ejecución no supera el año fiscal; también en la subasta inversa electrónica y los procedimientos por relación de ítems, siempre que el monto no supere el de una licitación pública abreviada para bienes o concurso público abreviado. La licitación pública no abreviada no está en ninguno de esos supuestos: su contrato se perfecciona con la suscripción.',
  '[{"documentId":"8371bce1-f773-4ad8-8efa-1266276ae4ec","chunkId":"39a3edba-5c4a-4299-8eb0-6b0e44e0b096","title":"Reglamento de la Ley N.° 32069 — texto actualizado al 09.01.2026","article":"87","pageStart":48,"pageEnd":48,"quote":"salvo en los contratos derivados de licitaciones públicas abreviadas para bienes, concursos públicos abreviados o comparación de precios, en los que el contrato se puede per feccionar con la recepción de la orden de compra o de servicio, siempre que así haya sido previsto en las bases y que la ejecución contractual no supere el año fiscal.","version":"Texto actualizado al 09.01.2026","sha256":"0ebe95b3e05661b80f73c060d6e6ce8dd17621ce34af9277c688dd67e5d99830"}]'::jsonb,
  'c26b5e32-cde4-4ee9-ba00-302197162ba3',
  now()
) on conflict (question_id) do update set prompt = excluded.prompt, options = excluded.options, competency = excluded.competency, correct = excluded.correct, explanation = excluded.explanation, sources = excluded.sources, reviewed_by = excluded.reviewed_by, reviewed_at = now();

-- b4-q28
insert into public.balotario_reviews (question_id, prompt, options, competency, correct, explanation, sources, reviewed_by, reviewed_at)
values (
  'b4-q28',
  'Una vez que la buena pro ha quedado consentida o administrativamente firme, ¿qué obligación nace tanto para la entidad contratante como para el o los postores ganadores?',
  '[{"id":"A","text":"La de contratar; la entidad solo puede negarse por recorte presupuestal del objeto, norma expresa o desaparición de la necesidad."},{"id":"B","text":"Ninguna: las partes recién quedan obligadas al suscribirse el contrato."},{"id":"C","text":"Solo la del postor; la entidad puede negarse a contratar sin motivación alguna."},{"id":"D","text":"Solo la de la entidad; el postor ganador puede desistir sin consecuencia alguna."}]'::jsonb,
  'COMPETENCIA 2',
  'A',
  'El artículo 86 del Reglamento obliga a contratar tanto a la entidad contratante como al o los postores ganadores una vez consentida o administrativamente firme la buena pro. La entidad solo puede negarse por recorte presupuestal acreditado del objeto, norma expresa o desaparición de la necesidad; negarse por otros motivos genera responsabilidad funcional, y el postor que se niega a perfeccionar es pasible de sanción por el TCP.',
  '[{"documentId":"8371bce1-f773-4ad8-8efa-1266276ae4ec","chunkId":"300f00fd-2b53-49dc-9117-c18bd96983ca","title":"Reglamento de la Ley N.° 32069 — texto actualizado al 09.01.2026","article":"86","pageStart":48,"pageEnd":48,"quote":"86.1. Una vez que la buena pro ha quedado consentida o administrativamente firme, tanto la entidad contratante como el o los postores ganadores están obligados a contratar. 86.2. La entidad contratante no puede negarse a contratar, a excepción de que ocurra alguno de los siguientes supuestos: i) recorte presupuestal correspondiente al objeto materia del procedimiento de selección, debidamente acreditado, ii) por disposición d e norma expresa o, iii) por desaparición de la necesidad, debidamente acreditada. La negativa a contratar basada en el último supuesto implica la imposibilidad de convocar el mismo objeto contractual durante el mismo ejercicio presupuestal. 86.3. La negativa a perfeccionar el contrato basada en otros motivos, genera responsabilidad funcional en la autoridad de la gestión administrativa y en el servidor facultado para suscribir el contrato.","version":"Texto actualizado al 09.01.2026","sha256":"0ebe95b3e05661b80f73c060d6e6ce8dd17621ce34af9277c688dd67e5d99830"}]'::jsonb,
  'c26b5e32-cde4-4ee9-ba00-302197162ba3',
  now()
) on conflict (question_id) do update set prompt = excluded.prompt, options = excluded.options, competency = excluded.competency, correct = excluded.correct, explanation = excluded.explanation, sources = excluded.sources, reviewed_by = excluded.reviewed_by, reviewed_at = now();

-- b4-q51
insert into public.balotario_reviews (question_id, prompt, options, competency, correct, explanation, sources, reviewed_by, reviewed_at)
values (
  'b4-q51',
  'Según el Reglamento, ¿cuál de las siguientes NO es una modalidad de pago para bienes y servicios?',
  '[{"id":"A","text":"Tarifas"},{"id":"B","text":"Pago por consumo"},{"id":"C","text":"En base a un honorario fijo y una comisión de éxito"},{"id":"D","text":"Costo reembolsable"}]'::jsonb,
  'COMPETENCIA 1',
  'D',
  'El artículo 130 del Reglamento lista las modalidades de pago para bienes y servicios: suma alzada, precios unitarios, esquema mixto, tarifas, en base a porcentajes, honorario fijo con comisión de éxito y pago por consumo. El costo reembolsable no está en esa lista: es modalidad de pago de la obra bajo solo construcción o diseño y construcción y de las consultorías de obra (Art. 161.1).',
  '[{"documentId":"8371bce1-f773-4ad8-8efa-1266276ae4ec","chunkId":"a185bfc5-b142-46d0-83bf-7d318b3fbd0a","title":"Reglamento de la Ley N.° 32069 — texto actualizado al 09.01.2026","article":"130","pageStart":70,"pageEnd":71,"quote":"En el caso de bienes y servicios, la entidad contratante debe considerar alguna de las siguientes modalidades de pago, de acuerdo con el objeto contractual y lo determinado en la estrategia de contratación: a) Suma alzada b) Precios unitarios c) Esquema mixto d) Tarifas e) En base a porcentajes f) En base a un honorario fijo y una comisión de éxito g) Pago por consumo","version":"Texto actualizado al 09.01.2026","sha256":"0ebe95b3e05661b80f73c060d6e6ce8dd17621ce34af9277c688dd67e5d99830"},{"documentId":"8371bce1-f773-4ad8-8efa-1266276ae4ec","chunkId":"08d3a88d-9d58-4151-a361-822505386c2c","title":"Reglamento de la Ley N.° 32069 — texto actualizado al 09.01.2026","article":"161","pageStart":87,"pageEnd":87,"quote":"161.1. Las modalidades de pago que pueden ser empleadas para la contratación de obra bajo los sistemas de entrega de solo construcción, diseño y construcción y las consultorías de obras distintas a supervisión de obras son: a) Suma alzada b) Precios unitarios c) Esquema mixto d) Costo reembolsable 161.2. Para la supervisión de la elaboración del expediente técnico y la ejecución de obras se utiliza la modalidad de pago por tarifas o el esquema mixto.","version":"Texto actualizado al 09.01.2026","sha256":"0ebe95b3e05661b80f73c060d6e6ce8dd17621ce34af9277c688dd67e5d99830"}]'::jsonb,
  'c26b5e32-cde4-4ee9-ba00-302197162ba3',
  now()
) on conflict (question_id) do update set prompt = excluded.prompt, options = excluded.options, competency = excluded.competency, correct = excluded.correct, explanation = excluded.explanation, sources = excluded.sources, reviewed_by = excluded.reviewed_by, reviewed_at = now();

-- b4-q68
insert into public.balotario_reviews (question_id, prompt, options, competency, correct, explanation, sources, reviewed_by, reviewed_at)
values (
  'b4-q68',
  'En la contratación de obra bajo los sistemas de entrega de solo construcción o de diseño y construcción, ¿cuál de las siguientes NO es una modalidad de pago?',
  '[{"id":"A","text":"Suma alzada"},{"id":"B","text":"Precios unitarios"},{"id":"C","text":"Tarifas"},{"id":"D","text":"Esquema mixto"}]'::jsonb,
  'COMPETENCIA 1',
  'C',
  'El artículo 161.1 del Reglamento admite para la obra suma alzada, precios unitarios, esquema mixto y costo reembolsable. Las tarifas no son modalidad de pago de la obra en esos sistemas: se utilizan para la supervisión de la elaboración del expediente técnico y la supervisión de la ejecución de obra (Art. 161.2).',
  '[{"documentId":"8371bce1-f773-4ad8-8efa-1266276ae4ec","chunkId":"08d3a88d-9d58-4151-a361-822505386c2c","title":"Reglamento de la Ley N.° 32069 — texto actualizado al 09.01.2026","article":"161","pageStart":87,"pageEnd":87,"quote":"161.1. Las modalidades de pago que pueden ser empleadas para la contratación de obra bajo los sistemas de entrega de solo construcción, diseño y construcción y las consultorías de obras distintas a supervisión de obras son: a) Suma alzada b) Precios unitarios c) Esquema mixto d) Costo reembolsable 161.2. Para la supervisión de la elaboración del expediente técnico y la ejecución de obras se utiliza la modalidad de pago por tarifas o el esquema mixto.","version":"Texto actualizado al 09.01.2026","sha256":"0ebe95b3e05661b80f73c060d6e6ce8dd17621ce34af9277c688dd67e5d99830"}]'::jsonb,
  'c26b5e32-cde4-4ee9-ba00-302197162ba3',
  now()
) on conflict (question_id) do update set prompt = excluded.prompt, options = excluded.options, competency = excluded.competency, correct = excluded.correct, explanation = excluded.explanation, sources = excluded.sources, reviewed_by = excluded.reviewed_by, reviewed_at = now();

-- b4-q63
insert into public.balotario_reviews (question_id, prompt, options, competency, correct, explanation, sources, reviewed_by, reviewed_at)
values (
  'b4-q63',
  'El Ministerio de la Juventud convoca una licitación pública para bienes con una cuantía estimada de 300 UIT. Si un postor interpone recurso de apelación contra el otorgamiento de la buena pro, ¿quién lo resuelve?',
  '[{"id":"A","text":"El titular de la entidad"},{"id":"B","text":"La Presidencia Ejecutiva del OECE"},{"id":"C","text":"El Tribunal de Contrataciones Públicas"},{"id":"D","text":"La autoridad de gestión administrativa de la entidad"}]'::jsonb,
  'COMPETENCIA 2',
  'C',
  'El artículo 74.1 de la Ley asigna el recurso al Tribunal cuando la cuantía del procedimiento supera las cincuenta UIT; en los demás casos lo resuelve la autoridad de gestión administrativa de la entidad contratante. El TCP es el Tribunal de Contrataciones Públicas, órgano resolutivo del OECE (Art. 3.1 del Reglamento). Con una cuantía de 300 UIT, supera las cincuenta: conoce el Tribunal.',
  '[{"documentId":"dc721f35-138c-41b8-8dca-16289f74d9df","chunkId":"ed7be7b7-f471-4f13-a9e6-73a406b80746","title":"Ley N.° 32069 — texto actualizado al 19.07.2026","article":"74","pageStart":36,"pageEnd":36,"quote":"cuando se trate de procedimientos de selección cuya cuantía sea superior a cincuenta UIT y de procedimientos para implementar o extender la vigencia de los catálogos electrónicos de acuerdos marco. Los actos que declaren la nulidad de oficio u otros emitidos por la autoridad de la gestión administrativa o el titular de la entidad que afecten la continuidad del procedimiento de selección, distintos de aquellos que resuelven los recursos de apelación, solo pueden impugnarse ante el Tribunal de Contrataciones del Estado. b) La autoridad de la gestión administrativa de la entidad contratante, en los demás casos.","version":"Texto actualizado al 19.07.2026","sha256":"f14ffa37b824b8af03c0b97e0603839a786ed61c7ca07b1d300c9af928d133f7"},{"documentId":"8371bce1-f773-4ad8-8efa-1266276ae4ec","chunkId":"6c81a566-63a8-4dc0-a455-7441d13f4d11","title":"Reglamento de la Ley N.° 32069 — texto actualizado al 09.01.2026","article":"3","pageStart":3,"pageEnd":6,"quote":"kk) TCP: Tribunal de Contrataciones Públicas. ll) TUPA: Texto","version":"Texto actualizado al 09.01.2026","sha256":"0ebe95b3e05661b80f73c060d6e6ce8dd17621ce34af9277c688dd67e5d99830"}]'::jsonb,
  'c26b5e32-cde4-4ee9-ba00-302197162ba3',
  now()
) on conflict (question_id) do update set prompt = excluded.prompt, options = excluded.options, competency = excluded.competency, correct = excluded.correct, explanation = excluded.explanation, sources = excluded.sources, reviewed_by = excluded.reviewed_by, reviewed_at = now();
commit;
