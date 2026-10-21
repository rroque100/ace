-- ════════════════════════════════════════════════════════════════════════════
-- schema-completo.sql — esquema íntegro de ACE para un proyecto Supabase NUEVO
-- ────────────────────────────────────────────────────────────────────────────
-- Generado el 2026-08-09 DESDE LA BASE VIVA (uxpitcawohjnpkzeexiz), no desde los
-- .sql sueltos, así que refleja el estado real: 53 tablas, 19 funciones, 15
-- triggers, 123 políticas RLS, índices y CHECK constraints del esquema public.
--
-- CÓMO USARLO: pégalo ENTERO en el SQL Editor del proyecto nuevo y ejecútalo una
-- vez. Es idempotente en lo posible (create ... if not exists) — puede reejecutarse.
--
-- QUÉ INCLUYE: extensiones (pg_trgm…), secuencia, tablas (con la columna generada
-- fts), PK/únicas, FKs (incluidas las que apuntan a auth.users), CHECK, índices,
-- funciones, triggers (incl. on_auth_user_created en auth.users), RLS y políticas.
--
-- QUÉ NO INCLUYE (y hay que hacer aparte en el proyecto nuevo):
--   · DATOS (filas), Storage (bucket 'documents' + PDFs) y usuarios de Auth.
--   · El bucket de Storage: créalo en el panel (Storage) con el mismo nombre que
--     pongas en SUPABASE_STORAGE_BUCKET, privado.
--   · Re-indexar Pinecone si empiezas con datos nuevos.
--   · Cambiar en el .env / Vercel: NEXT_PUBLIC_SUPABASE_URL, ANON_KEY,
--     SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET al proyecto nuevo.
--
-- NOTA: el esquema 'auth' lo gestiona Supabase (ya existe en un proyecto nuevo);
-- este script solo toca 'public' y crea el trigger sobre auth.users.
-- ════════════════════════════════════════════════════════════════════════════

-- Extensiones
create extension if not exists pg_trgm;
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

-- Secuencias
create sequence if not exists public.necesidad_codigo_seq;

-- ══ Tablas ══
create table if not exists public.ai_feedback_examples (
  id uuid not null default gen_random_uuid(),
  message_id uuid,
  question text not null,
  answer text,
  feedback text not null,
  expected_sources jsonb not null default '[]'::jsonb,
  recovered_sources jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.archivo_chunks (
  id uuid not null default gen_random_uuid(),
  documento_id uuid not null,
  chunk_index integer not null,
  page_start integer,
  page_end integer,
  content text not null,
  pinecone_vector_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.archivo_documentos (
  id uuid not null default gen_random_uuid(),
  document_number text,
  fecha date,
  asunto text,
  title text not null,
  doc_kind text not null default 'otros'::text,
  file_name text not null,
  file_size bigint not null,
  mime_type text not null default 'application/pdf'::text,
  storage_bucket text not null,
  storage_path text not null,
  status text not null default 'uploaded'::text,
  error_message text,
  body_text text,
  metadata jsonb not null default '{}'::jsonb,
  uploaded_by uuid,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.audit_logs (
  id uuid not null default gen_random_uuid(),
  actor_reference text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  year integer
);

create table if not exists public.boletin_eventos (
  id uuid not null default gen_random_uuid(),
  event_type text not null,
  document_id uuid,
  document_type text,
  process_type text,
  source_entity text,
  topic text,
  title text not null,
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.carpetas (
  id uuid not null default gen_random_uuid(),
  owner_id uuid not null,
  name text not null,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.chat_messages (
  id uuid not null default gen_random_uuid(),
  session_id uuid not null,
  role text not null,
  content text not null,
  sources jsonb not null default '[]'::jsonb,
  model text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.chat_response_notes (
  id uuid not null default gen_random_uuid(),
  message_id uuid not null,
  note text not null,
  feedback text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.chat_sessions (
  id uuid not null default gen_random_uuid(),
  title text,
  user_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  owner_id uuid
);

create table if not exists public.chat_sources (
  id uuid not null default gen_random_uuid(),
  message_id uuid not null,
  document_id uuid,
  chunk_id uuid,
  document_title text not null,
  page integer,
  page_end integer,
  article text,
  quote text not null,
  score numeric,
  semantic_score numeric,
  lexical_score numeric,
  evidence_quality numeric,
  match_type text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.contratos_cp (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  user_id uuid not null,
  numero_contrato text not null default ''::text,
  nomenclatura text not null default ''::text,
  denominacion text not null default ''::text,
  contratista text not null default ''::text,
  estado text not null default 'borrador'::text,
  data jsonb not null default '{}'::jsonb
);

create table if not exists public.contratos_sie (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  user_id uuid not null,
  numero_contrato text not null default ''::text,
  nomenclatura text not null default ''::text,
  denominacion text not null default ''::text,
  contratista text not null default ''::text,
  estado text not null default 'borrador'::text,
  data jsonb not null default '{}'::jsonb
);

create table if not exists public.document_analyses (
  id uuid not null default gen_random_uuid(),
  owner_id uuid not null,
  source text not null,
  document_id uuid,
  title text,
  result jsonb not null default '{}'::jsonb,
  model text,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.document_chunks (
  id uuid not null default gen_random_uuid(),
  document_id uuid not null,
  chunk_index integer not null,
  page_start integer,
  page_end integer,
  content text not null,
  token_count integer,
  pinecone_vector_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.document_summaries (
  id uuid not null default gen_random_uuid(),
  document_id uuid not null,
  summary_type text not null default 'executive'::text,
  content text not null,
  model text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.documents (
  id uuid not null default gen_random_uuid(),
  title text not null,
  file_name text not null,
  file_size bigint not null,
  mime_type text not null default 'application/pdf'::text,
  storage_bucket text not null,
  storage_path text not null,
  document_type text not null default 'otros'::text,
  source_entity text,
  status text not null default 'uploaded'::text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  process_type text
);

create table if not exists public.entity_settings (
  id text not null default 'default'::text,
  name text not null default ''::text,
  ruc text not null default ''::text,
  executing_unit text not null default ''::text,
  address text not null default ''::text,
  government_level text not null default ''::text,
  metadata jsonb not null default '{}'::jsonb,
  updated_by uuid,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  city text,
  manager_degree text,
  manager_dni text,
  manager_full_name text,
  manager_position text,
  manager_resolution_date text,
  manager_resolution_number text,
  pia_resolucion_numero text,
  pia_resolucion_fecha text,
  pac_resolucion_numero text,
  pac_resolucion_fecha text,
  pac_anio integer,
  pac_monto_total numeric(14,2),
  pac_monto_bienes_servicios numeric(14,2),
  pac_monto_obras numeric(14,2),
  year integer,
  feriados jsonb not null default '[]'::jsonb,
  department text,
  province text,
  uit_valor numeric(12,2),
  uit_anio integer,
  lp_abreviada_bienes_min numeric(14,2),
  lp_abreviada_bienes_max numeric(14,2),
  lp_abreviada_bienes_anio integer,
  tope_anio integer,
  tope_piso numeric(14,2),
  tope_licitacion_concurso numeric(14,2),
  tope_licitacion_obras numeric(14,2),
  tope_comparacion_precios numeric(14,2),
  cronograma_anio integer,
  cronograma_dias jsonb,
  aga_degree text,
  aga_dni text,
  aga_full_name text,
  aga_position text,
  aga_resolution_number text,
  aga_resolution_date text,
  instituciones_arbitrales jsonb not null default '[]'::jsonb
);

create table if not exists public.eval_corridas (
  id uuid not null default gen_random_uuid(),
  run_at timestamp with time zone not null default now(),
  summary jsonb not null default '{}'::jsonb
);

create table if not exists public.eval_preguntas (
  id uuid not null default gen_random_uuid(),
  question text not null,
  expected_keywords text[] not null default '{}'::text[],
  document_type text,
  process_type text,
  created_at timestamp with time zone not null default now(),
  expected_must_not_contain text[] not null default '{}'::text[],
  expected_sources jsonb not null default '[]'::jsonb
);

create table if not exists public.eval_resultados (
  id uuid not null default gen_random_uuid(),
  corrida_id uuid not null,
  pregunta_id uuid,
  question text,
  confidence text,
  sufficient boolean,
  sources_count integer,
  keyword_hit numeric,
  score numeric,
  feedback text,
  created_at timestamp with time zone not null default now(),
  source_hit numeric,
  source_feedback jsonb not null default '{}'::jsonb
);

create table if not exists public.expedientes_archivo (
  id uuid not null default gen_random_uuid(),
  anio integer,
  asunto text,
  materia text,
  resumen text,
  title text not null,
  nro_archivador text,
  observaciones text,
  file_name text not null,
  file_size bigint not null,
  mime_type text not null default 'application/pdf'::text,
  storage_bucket text not null,
  storage_path text not null,
  status text not null default 'uploaded'::text,
  error_message text,
  body_text text,
  metadata jsonb not null default '{}'::jsonb,
  uploaded_by uuid,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  sgd_expediente text,
  serie_documento text,
  oficina text,
  tipo_almacenamiento text not null default 'folder'::text,
  nro_paquete text,
  empastado boolean not null default false,
  color_archivador text,
  nro_estante text,
  nro_piso text,
  nro_local text,
  folio text,
  persona_tipo text,
  persona_documento text,
  persona_nombre text,
  tipo_documento text default 'otros'::text,
  oficina_id uuid,
  year integer not null default (EXTRACT(year FROM now()))::integer
);

create table if not exists public.expedientes_archivo_chunks (
  id uuid not null default gen_random_uuid(),
  expediente_id uuid not null,
  chunk_index integer not null,
  page_start integer,
  page_end integer,
  content text not null,
  pinecone_vector_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  year integer not null default (EXTRACT(year FROM now()))::integer
);

create table if not exists public.expedientes_doc_counters (
  oficina_id uuid not null,
  tipo text not null,
  siguiente integer not null default 1,
  updated_at timestamp with time zone not null default now(),
  sufijo text,
  year integer not null default (EXTRACT(year FROM now()))::integer
);

create table if not exists public.expedientes_ocr_cache (
  file_hash text not null,
  page_count integer not null default 0,
  extraction_method text,
  extracted jsonb not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  model text,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.expedientes_oficinas (
  id uuid not null default gen_random_uuid(),
  nombre text not null,
  entidad text,
  ruc text,
  responsable_nombre text,
  responsable_cargo text,
  sufijo text,
  ancho integer not null default 3,
  membrete_path text,
  membrete_bucket text,
  activo boolean not null default true,
  created_by uuid,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  gestiona_contrataciones boolean not null default false,
  year integer not null default (EXTRACT(year FROM now()))::integer
);

create table if not exists public.expedientes_respuestas (
  id uuid not null default gen_random_uuid(),
  nro_oficio text,
  anio integer,
  asunto text,
  destinatario text,
  cargo_destinatario text,
  remitente text,
  documento_texto text,
  cuerpo text not null,
  base_legal jsonb not null default '[]'::jsonb,
  antecedentes jsonb not null default '[]'::jsonb,
  entity jsonb not null default '{}'::jsonb,
  expediente_id uuid,
  tone text,
  length text,
  token_usage jsonb,
  created_by uuid,
  created_at timestamp with time zone not null default now(),
  tipo_documento text,
  oficina_id uuid,
  antecedente_id uuid,
  version integer not null default 1,
  parent_version_id uuid,
  fts tsvector generated always as ((((setweight(to_tsvector('spanish'::regconfig, COALESCE(asunto, ''::text)), 'A'::"char") || setweight(to_tsvector('spanish'::regconfig, COALESCE(cuerpo, ''::text)), 'B'::"char")) || setweight(to_tsvector('spanish'::regconfig, COALESCE(nro_oficio, ''::text)), 'A'::"char")) || setweight(to_tsvector('spanish'::regconfig, COALESCE(destinatario, ''::text)), 'C'::"char"))) stored,
  year integer not null default (EXTRACT(year FROM now()))::integer
);

create table if not exists public.guardados (
  id uuid not null default gen_random_uuid(),
  owner_id uuid not null,
  carpeta_id uuid,
  item_type text not null,
  document_id uuid,
  article_id uuid,
  message_id uuid,
  title text not null,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.necesidad_admisibilidad (
  necesidad_id uuid not null,
  items jsonb not null default '{}'::jsonb,
  actualizado_por text,
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.necesidad_documentos (
  id uuid not null default gen_random_uuid(),
  necesidad_id uuid not null,
  kind text not null default 'otros'::text,
  title text not null,
  file_name text,
  storage_bucket text,
  storage_path text,
  mime_type text,
  status text not null default 'uploaded'::text,
  error_message text,
  owner_id uuid not null,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.necesidad_items (
  id uuid not null default gen_random_uuid(),
  necesidad_id uuid not null,
  nro integer not null,
  descripcion text not null,
  codigo_catalogo text,
  unidad_medida text,
  cantidad numeric(14,4),
  costo_unitario numeric(14,2),
  costo_total numeric(14,2),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  tipo_objeto text,
  nro_paquete integer,
  descripcion_paquete text
);

create table if not exists public.necesidad_observaciones (
  id uuid not null default gen_random_uuid(),
  necesidad_id uuid not null,
  campo text not null,
  comentario text not null,
  autor_referencia text,
  autor_rol text,
  resuelto boolean not null default false,
  resuelto_por text,
  created_at timestamp with time zone not null default now(),
  resuelto_at timestamp with time zone
);

create table if not exists public.necesidad_versiones (
  id uuid not null default gen_random_uuid(),
  necesidad_id uuid not null,
  snapshot jsonb not null,
  transicion text,
  etiqueta text,
  autor_referencia text,
  autor_rol text,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.necesidades (
  id uuid not null default gen_random_uuid(),
  codigo text,
  anio_fiscal integer,
  periodo_programacion text,
  version_cmn text,
  entidad text,
  unidad_ejecutora text,
  area_usuaria text,
  centro_costo text,
  responsable text,
  nombre text not null,
  finalidad_publica text,
  pei_objetivo text,
  pei_accion text,
  poi_actividad text,
  meta_presupuestal text,
  proyecto_inversion text,
  ioarr text,
  tipo_objeto text not null default 'bienes'::text,
  especialidad text,
  subespecialidad text,
  codigo_catalogo text,
  descripcion_catalogo text,
  descripcion_detallada text,
  cantidad numeric,
  unidad_medida text,
  frecuencia text,
  fecha_requerida date,
  trimestre integer,
  mes_programado integer,
  fuente_financiamiento text,
  rubro text,
  cadena_funcional text,
  clasificador_gasto text,
  monto_estimado numeric,
  costo_unitario numeric,
  costo_total numeric,
  anio_referencia integer,
  departamento text,
  provincia text,
  distrito text,
  lugar_entrega text,
  alcance text,
  condiciones_ejecucion text,
  modalidad_pago text,
  sistema_entrega text,
  plazo_ejecucion integer,
  equipamiento_minimo text,
  habilitaciones text,
  status text not null default 'borrador'::text,
  summary text,
  process_id uuid,
  owner_id uuid not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  tipo_area text not null default 'area_usuaria'::text,
  cmn_verificado boolean not null default false,
  no_objecion text not null default 'no_aplica'::text,
  no_objecion_sustento text,
  no_objecion_mecanismo text,
  formula_reajuste text,
  requisitos_calificacion text,
  verificacion_ficha_tecnica boolean not null default false,
  verificacion_almacen boolean not null default false,
  certificacion_presupuestal text,
  fecha_remision_dec date,
  moneda text not null default 'PEN'::text,
  cui text,
  fecha_version_dos date,
  fecha_version_n date,
  tipo_proceso_seleccion text,
  adelanto_directo text,
  penalidad_mora text,
  garantias text,
  recepcion_conformidad text,
  subcontratacion text,
  gestion_riesgos text,
  metas_fisicas text,
  disponibilidad_terreno text,
  seguros text,
  metodologia_bim text,
  gestion_calidad text,
  anexos_tecnicos text,
  solucion_controversias text,
  plazo_respuestas integer,
  requisitos_adicionales text,
  otras_penalidades text,
  ficha_tecnica_identificacion text,
  compatibilizacion text,
  normas_tecnicas text,
  prestaciones_accesorias text,
  descripcion_general text,
  plazo_ejecucion_unidad text not null default 'calendario'::text,
  forma_pago text,
  forma_pago_tipo text,
  forma_pago_area_conformidad text,
  forma_pago_documentacion text,
  forma_pago_lugar text,
  forma_pago_direccion text,
  recepcion_area text,
  conformidad_area text,
  conformidad_plazo integer,
  conformidad_plazo_subsanacion integer,
  plazo_respuestas_texto text,
  forma_pago_detalle text,
  personal_clave_experiencia text,
  personal_clave_acreditacion text,
  formacion_academica text,
  formacion_academica_acreditacion text,
  capacitacion_personal_clave text,
  capacitacion_personal_clave_acreditacion text,
  equipamiento_estrategico text,
  equipamiento_estrategico_acreditacion text,
  infraestructura_estrategica text,
  infraestructura_estrategica_acreditacion text
);

create table if not exists public.necesidades_requisitos_legacy_backup (
  necesidad_id uuid not null,
  experiencia_requerida text,
  personal_clave text,
  respaldado_en timestamp with time zone not null default now()
);

create table if not exists public.necesidades_sustento_legacy_backup (
  necesidad_id uuid not null,
  problema_identificado text,
  objetivo_contratacion text,
  beneficio_esperado text,
  poblacion_beneficiaria text,
  respaldado_en timestamp with time zone not null default now()
);

create table if not exists public.norma_articulos (
  id uuid not null default gen_random_uuid(),
  document_id uuid not null,
  article_number text not null,
  article_label text,
  section_title text,
  ordinal integer not null,
  content text not null,
  page_start integer,
  page_end integer,
  document_type text,
  document_number text,
  hierarchy_rank integer,
  process_type text,
  status text,
  vigencia text,
  year integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.norma_concordancias (
  id uuid not null default gen_random_uuid(),
  source_document_id uuid not null,
  source_article_id uuid,
  source_article_number text,
  ref_type text,
  ref_document_number text,
  ref_article_number text,
  target_document_id uuid,
  target_article_id uuid,
  raw_text text not null,
  resolved boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  relation_type text not null default 'concordancia'::text
);

create table if not exists public.normativa_adjuntos (
  id uuid not null default gen_random_uuid(),
  created_by uuid,
  document_id text not null,
  file_name text not null,
  file_size integer not null,
  namespace text not null default 'respuesta-adjuntos'::text,
  title text,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.normative_comparisons (
  id uuid not null default gen_random_uuid(),
  topic text not null,
  side_a jsonb not null default '{}'::jsonb,
  side_b jsonb not null default '{}'::jsonb,
  result text not null,
  sources_a jsonb not null default '[]'::jsonb,
  sources_b jsonb not null default '[]'::jsonb,
  assessment jsonb not null default '{}'::jsonb,
  model text,
  owner_id uuid,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.pedidos_siga (
  id uuid not null default gen_random_uuid(),
  nro_pedido text not null,
  secuencia text not null,
  anio_fiscal integer,
  necesidad_id uuid,
  crudo jsonb not null,
  entity_id text,
  owner_id uuid,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.personal (
  id uuid not null default gen_random_uuid(),
  codigo text not null,
  documento text,
  apellido_paterno text,
  apellido_materno text,
  nombres text,
  nombre_completo text,
  tipo_empleado text,
  estado text,
  estado_civil text,
  sexo text,
  grado_inst text,
  centro_costo text,
  unidad text,
  codigo_prof text,
  profesion text,
  colegiatura text,
  fecha_ingreso text,
  actualizado_en timestamp with time zone not null default now()
);

create table if not exists public.process_cotizaciones (
  id uuid not null default gen_random_uuid(),
  process_id uuid not null,
  proveedor_nombre text not null,
  proveedor_ruc text,
  fecha_cotizacion date,
  monto numeric not null,
  moneda text default 'PEN'::text,
  cumple_condiciones boolean default true,
  observaciones text,
  documento_id uuid,
  owner_id uuid not null,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.process_documents (
  id uuid not null default gen_random_uuid(),
  process_id uuid not null,
  library_document_id uuid,
  kind text not null default 'otros'::text,
  bidder_name text,
  title text not null,
  file_name text,
  storage_bucket text,
  storage_path text,
  mime_type text,
  extracted_text text,
  status text not null default 'uploaded'::text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  owner_id uuid not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.process_evaluations (
  id uuid not null default gen_random_uuid(),
  process_id uuid not null,
  bidder_name text,
  result text,
  matrix jsonb not null default '[]'::jsonb,
  observations jsonb not null default '[]'::jsonb,
  model text,
  owner_id uuid not null,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.process_risks (
  id uuid not null default gen_random_uuid(),
  process_id uuid not null,
  items jsonb not null default '[]'::jsonb,
  model text,
  owner_id uuid not null,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.process_type_settings (
  code text not null,
  label text not null,
  description text,
  category text not null default 'competitivo'::text,
  object text,
  legal_basis text,
  frequent_municipality boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  updated_by uuid,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  year integer not null default (EXTRACT(year FROM now()))::integer
);

create table if not exists public.processing_jobs (
  id uuid not null default gen_random_uuid(),
  document_id uuid,
  job_type text not null default 'index_document'::text,
  status text not null default 'queued'::text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.procurement_processes (
  id uuid not null default gen_random_uuid(),
  nomenclature text not null,
  object_type text not null default 'servicios'::text,
  procedure_type text,
  amount numeric,
  entity text,
  status text not null default 'necesidad'::text,
  summary text,
  owner_id uuid not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  necesidad_id uuid,
  valor_estimado numeric,
  moneda text default 'PEN'::text,
  tipo_cambio numeric,
  certificacion_presupuestal text,
  sistema_contratacion text,
  modalidad_ejecucion text,
  formula_reajuste text,
  pluralidad_marcas boolean default true,
  resumen_ejecutivo text,
  autoridad_aprobacion text,
  delegacion_facultades boolean default false,
  doc_aprobacion_expediente text,
  hitos jsonb not null default '{}'::jsonb,
  requisitos_calificacion text,
  requisitos_precalificacion text,
  tipo_evaluador_perfil text,
  factores_evaluacion text,
  garantias_adelantos text,
  cronograma_contratacion text,
  tipo_interaccion_mercado text,
  tipo_procedimiento text
);

create table if not exists public.profiles (
  id uuid not null,
  email text,
  role text not null default 'consulta'::text,
  created_at timestamp with time zone not null default now(),
  entity text,
  metadata jsonb not null default '{}'::jsonb,
  oficina text,
  oficina_id uuid,
  es_jefe boolean not null default false,
  nombre_completo text,
  dni text,
  cargo text,
  grado_academico text
);

create table if not exists public.respuesta_antecedentes (
  id uuid not null default gen_random_uuid(),
  created_by uuid,
  entity text,
  file_name text not null,
  file_size integer not null,
  storage_bucket text not null,
  storage_path text not null,
  pinecone_namespace text not null default 'respuesta-antecedentes'::text,
  pinecone_document_id text not null,
  page_count integer,
  text_length integer not null,
  char_count integer not null,
  chunk_count integer not null default 0,
  extraction_method text not null default 'pdf-text'::text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  year integer not null default (EXTRACT(year FROM now()))::integer
);

create table if not exists public.respuesta_feedback (
  id uuid not null default gen_random_uuid(),
  oficina_id uuid,
  tipo_documento text,
  rating text not null,
  comentario text,
  cuerpo text not null,
  intencion text,
  created_by uuid,
  created_at timestamp with time zone not null default now(),
  year integer not null default (EXTRACT(year FROM now()))::integer
);

create table if not exists public.riesgo_necesidad (
  id uuid not null default gen_random_uuid(),
  necesidad_id uuid not null,
  riesgo text not null,
  probabilidad text,
  impacto text,
  mitigacion text,
  responsable text,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.seguimientos (
  id uuid not null default gen_random_uuid(),
  owner_id uuid not null,
  kind text not null,
  value text not null,
  created_at timestamp with time zone not null default now()
);

-- ══ Claves primarias y únicas ══
alter table public.ai_feedback_examples add constraint ai_feedback_examples_pkey PRIMARY KEY (id);
alter table public.archivo_chunks add constraint archivo_chunks_pkey PRIMARY KEY (id);
alter table public.archivo_chunks add constraint archivo_chunks_pinecone_vector_id_key UNIQUE (pinecone_vector_id);
alter table public.archivo_chunks add constraint archivo_chunks_documento_id_chunk_index_key UNIQUE (documento_id, chunk_index);
alter table public.archivo_documentos add constraint archivo_documentos_storage_path_key UNIQUE (storage_path);
alter table public.archivo_documentos add constraint archivo_documentos_pkey PRIMARY KEY (id);
alter table public.audit_logs add constraint audit_logs_pkey PRIMARY KEY (id);
alter table public.boletin_eventos add constraint boletin_eventos_pkey PRIMARY KEY (id);
alter table public.carpetas add constraint carpetas_pkey PRIMARY KEY (id);
alter table public.chat_messages add constraint chat_messages_pkey PRIMARY KEY (id);
alter table public.chat_response_notes add constraint chat_response_notes_pkey PRIMARY KEY (id);
alter table public.chat_sessions add constraint chat_sessions_pkey PRIMARY KEY (id);
alter table public.chat_sources add constraint chat_sources_pkey PRIMARY KEY (id);
alter table public.contratos_cp add constraint contratos_cp_pkey PRIMARY KEY (id);
alter table public.contratos_sie add constraint contratos_sie_pkey PRIMARY KEY (id);
alter table public.document_analyses add constraint document_analyses_pkey PRIMARY KEY (id);
alter table public.document_chunks add constraint document_chunks_document_id_chunk_index_key UNIQUE (document_id, chunk_index);
alter table public.document_chunks add constraint document_chunks_pkey PRIMARY KEY (id);
alter table public.document_chunks add constraint document_chunks_pinecone_vector_id_key UNIQUE (pinecone_vector_id);
alter table public.document_summaries add constraint document_summaries_pkey PRIMARY KEY (id);
alter table public.documents add constraint documents_pkey PRIMARY KEY (id);
alter table public.documents add constraint documents_storage_path_key UNIQUE (storage_path);
alter table public.entity_settings add constraint entity_settings_pkey PRIMARY KEY (id);
alter table public.eval_corridas add constraint eval_corridas_pkey PRIMARY KEY (id);
alter table public.eval_preguntas add constraint eval_preguntas_pkey PRIMARY KEY (id);
alter table public.eval_resultados add constraint eval_resultados_pkey PRIMARY KEY (id);
alter table public.expedientes_archivo add constraint expedientes_archivo_pkey PRIMARY KEY (id);
alter table public.expedientes_archivo add constraint expedientes_archivo_storage_path_key UNIQUE (storage_path);
alter table public.expedientes_archivo_chunks add constraint expedientes_archivo_chunks_pinecone_vector_id_key UNIQUE (pinecone_vector_id);
alter table public.expedientes_archivo_chunks add constraint expedientes_archivo_chunks_expediente_id_chunk_index_key UNIQUE (expediente_id, chunk_index);
alter table public.expedientes_archivo_chunks add constraint expedientes_archivo_chunks_pkey PRIMARY KEY (id);
alter table public.expedientes_doc_counters add constraint expedientes_doc_counters_pkey PRIMARY KEY (oficina_id, tipo, year);
alter table public.expedientes_ocr_cache add constraint expedientes_ocr_cache_pkey PRIMARY KEY (file_hash);
alter table public.expedientes_oficinas add constraint expedientes_oficinas_pkey PRIMARY KEY (id);
alter table public.expedientes_respuestas add constraint expedientes_respuestas_pkey PRIMARY KEY (id);
alter table public.guardados add constraint guardados_pkey PRIMARY KEY (id);
alter table public.necesidad_admisibilidad add constraint necesidad_admisibilidad_pkey PRIMARY KEY (necesidad_id);
alter table public.necesidad_documentos add constraint necesidad_documentos_pkey PRIMARY KEY (id);
alter table public.necesidad_items add constraint necesidad_items_pkey PRIMARY KEY (id);
alter table public.necesidad_observaciones add constraint necesidad_observaciones_pkey PRIMARY KEY (id);
alter table public.necesidad_versiones add constraint necesidad_versiones_pkey PRIMARY KEY (id);
alter table public.necesidades add constraint necesidades_codigo_key UNIQUE (codigo);
alter table public.necesidades add constraint necesidades_pkey PRIMARY KEY (id);
alter table public.necesidades_requisitos_legacy_backup add constraint necesidades_requisitos_legacy_backup_pkey PRIMARY KEY (necesidad_id);
alter table public.necesidades_sustento_legacy_backup add constraint necesidades_sustento_legacy_backup_pkey PRIMARY KEY (necesidad_id);
alter table public.norma_articulos add constraint norma_articulos_pkey PRIMARY KEY (id);
alter table public.norma_articulos add constraint norma_articulos_document_id_ordinal_key UNIQUE (document_id, ordinal);
alter table public.norma_concordancias add constraint norma_concordancias_pkey PRIMARY KEY (id);
alter table public.normativa_adjuntos add constraint normativa_adjuntos_pkey PRIMARY KEY (id);
alter table public.normative_comparisons add constraint normative_comparisons_pkey PRIMARY KEY (id);
alter table public.pedidos_siga add constraint pedidos_siga_nro_pedido_secuencia_anio_fiscal_key UNIQUE (nro_pedido, secuencia, anio_fiscal);
alter table public.pedidos_siga add constraint pedidos_siga_pkey PRIMARY KEY (id);
alter table public.personal add constraint personal_pkey PRIMARY KEY (id);
alter table public.process_cotizaciones add constraint process_cotizaciones_pkey PRIMARY KEY (id);
alter table public.process_documents add constraint process_documents_pkey PRIMARY KEY (id);
alter table public.process_evaluations add constraint process_evaluations_pkey PRIMARY KEY (id);
alter table public.process_risks add constraint process_risks_pkey PRIMARY KEY (id);
alter table public.process_type_settings add constraint process_type_settings_pkey PRIMARY KEY (code, year);
alter table public.processing_jobs add constraint processing_jobs_pkey PRIMARY KEY (id);
alter table public.procurement_processes add constraint procurement_processes_pkey PRIMARY KEY (id);
alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id);
alter table public.respuesta_antecedentes add constraint respuesta_antecedentes_pkey PRIMARY KEY (id);
alter table public.respuesta_feedback add constraint respuesta_feedback_pkey PRIMARY KEY (id);
alter table public.riesgo_necesidad add constraint riesgo_necesidad_pkey PRIMARY KEY (id);
alter table public.seguimientos add constraint seguimientos_owner_id_kind_value_key UNIQUE (owner_id, kind, value);
alter table public.seguimientos add constraint seguimientos_pkey PRIMARY KEY (id);

-- ══ Claves foráneas ══
alter table public.ai_feedback_examples add constraint ai_feedback_examples_message_id_fkey FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE SET NULL;
alter table public.archivo_chunks add constraint archivo_chunks_documento_id_fkey FOREIGN KEY (documento_id) REFERENCES archivo_documentos(id) ON DELETE CASCADE;
alter table public.archivo_documentos add constraint archivo_documentos_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.boletin_eventos add constraint boletin_eventos_document_id_fkey FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE;
alter table public.carpetas add constraint carpetas_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.chat_messages add constraint chat_messages_session_id_fkey FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE;
alter table public.chat_response_notes add constraint chat_response_notes_message_id_fkey FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE;
alter table public.chat_sessions add constraint chat_sessions_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.chat_sources add constraint chat_sources_message_id_fkey FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE;
alter table public.chat_sources add constraint chat_sources_document_id_fkey FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL;
alter table public.chat_sources add constraint chat_sources_chunk_id_fkey FOREIGN KEY (chunk_id) REFERENCES document_chunks(id) ON DELETE SET NULL;
alter table public.contratos_cp add constraint contratos_cp_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.contratos_sie add constraint contratos_sie_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.document_analyses add constraint document_analyses_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.document_analyses add constraint document_analyses_document_id_fkey FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL;
alter table public.document_chunks add constraint document_chunks_document_id_fkey FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE;
alter table public.document_summaries add constraint document_summaries_document_id_fkey FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE;
alter table public.entity_settings add constraint entity_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.eval_resultados add constraint eval_resultados_pregunta_id_fkey FOREIGN KEY (pregunta_id) REFERENCES eval_preguntas(id) ON DELETE SET NULL;
alter table public.eval_resultados add constraint eval_resultados_corrida_id_fkey FOREIGN KEY (corrida_id) REFERENCES eval_corridas(id) ON DELETE CASCADE;
alter table public.expedientes_archivo add constraint expedientes_archivo_oficina_id_fkey FOREIGN KEY (oficina_id) REFERENCES expedientes_oficinas(id) ON DELETE SET NULL;
alter table public.expedientes_archivo add constraint expedientes_archivo_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.expedientes_archivo_chunks add constraint expedientes_archivo_chunks_expediente_id_fkey FOREIGN KEY (expediente_id) REFERENCES expedientes_archivo(id) ON DELETE CASCADE;
alter table public.expedientes_doc_counters add constraint expedientes_doc_counters_oficina_id_fkey FOREIGN KEY (oficina_id) REFERENCES expedientes_oficinas(id) ON DELETE CASCADE;
alter table public.expedientes_oficinas add constraint expedientes_oficinas_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.expedientes_respuestas add constraint expedientes_respuestas_expediente_id_fkey FOREIGN KEY (expediente_id) REFERENCES expedientes_archivo(id) ON DELETE SET NULL;
alter table public.expedientes_respuestas add constraint expedientes_respuestas_parent_version_id_fkey FOREIGN KEY (parent_version_id) REFERENCES expedientes_respuestas(id) ON DELETE SET NULL;
alter table public.expedientes_respuestas add constraint expedientes_respuestas_antecedente_id_fkey FOREIGN KEY (antecedente_id) REFERENCES respuesta_antecedentes(id) ON DELETE SET NULL;
alter table public.expedientes_respuestas add constraint expedientes_respuestas_oficina_id_fkey FOREIGN KEY (oficina_id) REFERENCES expedientes_oficinas(id) ON DELETE SET NULL;
alter table public.expedientes_respuestas add constraint expedientes_respuestas_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.guardados add constraint guardados_message_id_fkey FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE SET NULL;
alter table public.guardados add constraint guardados_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.guardados add constraint guardados_carpeta_id_fkey FOREIGN KEY (carpeta_id) REFERENCES carpetas(id) ON DELETE SET NULL;
alter table public.guardados add constraint guardados_document_id_fkey FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL;
alter table public.guardados add constraint guardados_article_id_fkey FOREIGN KEY (article_id) REFERENCES norma_articulos(id) ON DELETE SET NULL;
alter table public.necesidad_admisibilidad add constraint necesidad_admisibilidad_necesidad_id_fkey FOREIGN KEY (necesidad_id) REFERENCES necesidades(id) ON DELETE CASCADE;
alter table public.necesidad_documentos add constraint necesidad_documentos_necesidad_id_fkey FOREIGN KEY (necesidad_id) REFERENCES necesidades(id) ON DELETE CASCADE;
alter table public.necesidad_documentos add constraint necesidad_documentos_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.necesidad_items add constraint necesidad_items_necesidad_id_fkey FOREIGN KEY (necesidad_id) REFERENCES necesidades(id) ON DELETE CASCADE;
alter table public.necesidad_observaciones add constraint necesidad_observaciones_necesidad_id_fkey FOREIGN KEY (necesidad_id) REFERENCES necesidades(id) ON DELETE CASCADE;
alter table public.necesidad_versiones add constraint necesidad_versiones_necesidad_id_fkey FOREIGN KEY (necesidad_id) REFERENCES necesidades(id) ON DELETE CASCADE;
alter table public.necesidades add constraint necesidades_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.necesidades add constraint necesidades_process_id_fkey FOREIGN KEY (process_id) REFERENCES procurement_processes(id) ON DELETE SET NULL;
alter table public.necesidades_requisitos_legacy_backup add constraint necesidades_requisitos_legacy_backup_necesidad_id_fkey FOREIGN KEY (necesidad_id) REFERENCES necesidades(id) ON DELETE CASCADE;
alter table public.necesidades_sustento_legacy_backup add constraint necesidades_sustento_legacy_backup_necesidad_id_fkey FOREIGN KEY (necesidad_id) REFERENCES necesidades(id) ON DELETE CASCADE;
alter table public.norma_articulos add constraint norma_articulos_document_id_fkey FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE;
alter table public.norma_concordancias add constraint norma_concordancias_source_document_id_fkey FOREIGN KEY (source_document_id) REFERENCES documents(id) ON DELETE CASCADE;
alter table public.norma_concordancias add constraint norma_concordancias_target_article_id_fkey FOREIGN KEY (target_article_id) REFERENCES norma_articulos(id) ON DELETE SET NULL;
alter table public.norma_concordancias add constraint norma_concordancias_target_document_id_fkey FOREIGN KEY (target_document_id) REFERENCES documents(id) ON DELETE SET NULL;
alter table public.norma_concordancias add constraint norma_concordancias_source_article_id_fkey FOREIGN KEY (source_article_id) REFERENCES norma_articulos(id) ON DELETE CASCADE;
alter table public.normativa_adjuntos add constraint normativa_adjuntos_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.normative_comparisons add constraint normative_comparisons_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.pedidos_siga add constraint pedidos_siga_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.pedidos_siga add constraint pedidos_siga_necesidad_id_fkey FOREIGN KEY (necesidad_id) REFERENCES necesidades(id) ON DELETE SET NULL;
alter table public.process_cotizaciones add constraint process_cotizaciones_process_id_fkey FOREIGN KEY (process_id) REFERENCES procurement_processes(id) ON DELETE CASCADE;
alter table public.process_cotizaciones add constraint process_cotizaciones_documento_id_fkey FOREIGN KEY (documento_id) REFERENCES process_documents(id) ON DELETE SET NULL;
alter table public.process_cotizaciones add constraint process_cotizaciones_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.process_documents add constraint process_documents_library_document_id_fkey FOREIGN KEY (library_document_id) REFERENCES documents(id) ON DELETE SET NULL;
alter table public.process_documents add constraint process_documents_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.process_documents add constraint process_documents_process_id_fkey FOREIGN KEY (process_id) REFERENCES procurement_processes(id) ON DELETE CASCADE;
alter table public.process_evaluations add constraint process_evaluations_process_id_fkey FOREIGN KEY (process_id) REFERENCES procurement_processes(id) ON DELETE CASCADE;
alter table public.process_evaluations add constraint process_evaluations_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.process_risks add constraint process_risks_process_id_fkey FOREIGN KEY (process_id) REFERENCES procurement_processes(id) ON DELETE CASCADE;
alter table public.process_risks add constraint process_risks_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.process_type_settings add constraint process_type_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.processing_jobs add constraint processing_jobs_document_id_fkey FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE;
alter table public.procurement_processes add constraint procurement_processes_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.profiles add constraint profiles_oficina_id_fkey FOREIGN KEY (oficina_id) REFERENCES expedientes_oficinas(id) ON DELETE SET NULL;
alter table public.respuesta_antecedentes add constraint respuesta_antecedentes_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.respuesta_feedback add constraint respuesta_feedback_oficina_id_fkey FOREIGN KEY (oficina_id) REFERENCES expedientes_oficinas(id) ON DELETE SET NULL;
alter table public.riesgo_necesidad add constraint riesgo_necesidad_necesidad_id_fkey FOREIGN KEY (necesidad_id) REFERENCES necesidades(id) ON DELETE CASCADE;
alter table public.seguimientos add constraint seguimientos_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ══ CHECK constraints ══
alter table public.ai_feedback_examples add constraint ai_feedback_examples_feedback_check CHECK ((feedback = ANY (ARRAY['correct'::text, 'incorrect'::text])));
alter table public.archivo_documentos add constraint archivo_documentos_doc_kind_check CHECK ((doc_kind = ANY (ARRAY['resolucion_alcaldia'::text, 'resolucion_gerencia'::text, 'acuerdo_concejo'::text, 'ordenanza'::text, 'decreto_alcaldia'::text, 'oficio'::text, 'informe'::text, 'otros'::text])));
alter table public.archivo_documentos add constraint archivo_documentos_status_check CHECK ((status = ANY (ARRAY['uploaded'::text, 'processing'::text, 'indexed'::text, 'error'::text])));
alter table public.archivo_documentos add constraint archivo_documentos_file_size_check CHECK ((file_size > 0));
alter table public.chat_messages add constraint chat_messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text, 'system'::text])));
alter table public.chat_response_notes add constraint chat_response_notes_feedback_check CHECK ((feedback = ANY (ARRAY['correct'::text, 'incorrect'::text])));
alter table public.contratos_cp add constraint contratos_cp_estado_check CHECK ((estado = ANY (ARRAY['borrador'::text, 'generado'::text])));
alter table public.contratos_sie add constraint contratos_sie_estado_check CHECK ((estado = ANY (ARRAY['borrador'::text, 'generado'::text])));
alter table public.documents add constraint documents_document_type_check CHECK ((document_type = ANY (ARRAY['ley'::text, 'reglamento'::text, 'opinion'::text, 'directiva'::text, 'bases_integradas'::text, 'resolucion'::text, 'contrato'::text, 'expediente'::text, 'otros'::text])));
alter table public.documents add constraint documents_status_check CHECK ((status = ANY (ARRAY['uploaded'::text, 'processing'::text, 'indexed'::text, 'error'::text])));
alter table public.documents add constraint documents_file_size_check CHECK ((file_size > 0));
alter table public.entity_settings add constraint entity_settings_government_level_check CHECK (((government_level = ''::text) OR (government_level = ANY (ARRAY['gobierno_nacional'::text, 'gobierno_regional'::text, 'gobierno_local'::text]))));
alter table public.entity_settings add constraint entity_settings_manager_dni_check CHECK (((manager_dni = ''::text) OR (manager_dni ~ '^[0-9]{8}$'::text)));
alter table public.entity_settings add constraint entity_settings_ruc_check CHECK (((ruc = ''::text) OR (ruc ~ '^[0-9]{11}$'::text)));
alter table public.entity_settings add constraint entity_settings_executing_unit_check CHECK (((executing_unit = ''::text) OR (executing_unit ~ '^[0-9]{6}$'::text)));
alter table public.expedientes_archivo add constraint expedientes_archivo_status_check CHECK ((status = ANY (ARRAY['uploaded'::text, 'processing'::text, 'indexed'::text, 'error'::text])));
alter table public.expedientes_archivo add constraint expedientes_archivo_file_size_check CHECK ((file_size > 0));
alter table public.expedientes_doc_counters add constraint expedientes_doc_counters_siguiente_check CHECK ((siguiente >= 1));
alter table public.expedientes_doc_counters add constraint expedientes_doc_counters_tipo_check CHECK ((tipo = ANY (ARRAY['OFICIO'::text, 'OFICIO MULTIPLE'::text, 'INFORME'::text, 'CARTA'::text, 'MEMORANDUM'::text, 'MEMORANDUM MULTIPLE'::text, 'CONTRATO'::text])));
alter table public.expedientes_oficinas add constraint expedientes_oficinas_ancho_check CHECK (((ancho >= 1) AND (ancho <= 6)));
alter table public.expedientes_respuestas add constraint expedientes_respuestas_tipo_documento_check CHECK (((tipo_documento IS NULL) OR (tipo_documento = ANY (ARRAY['OFICIO'::text, 'OFICIO MULTIPLE'::text, 'INFORME'::text, 'CARTA'::text, 'MEMORANDUM'::text, 'MEMORANDUM MULTIPLE'::text, 'CONTRATO'::text]))));
alter table public.necesidad_documentos add constraint necesidad_documentos_status_check CHECK ((status = ANY (ARRAY['uploaded'::text, 'processing'::text, 'ready'::text, 'error'::text])));
alter table public.necesidad_documentos add constraint necesidad_documentos_kind_check CHECK ((kind = ANY (ARRAY['requerimiento'::text, 'tdr'::text, 'ee_tt'::text, 'expediente_tecnico'::text, 'memoria_descriptiva'::text, 'informe_necesidad'::text, 'cotizacion'::text, 'otros'::text])));
alter table public.necesidades add constraint necesidades_no_objecion_check CHECK ((no_objecion = ANY (ARRAY['no_aplica'::text, 'solicitada'::text, 'otorgada'::text, 'objetada'::text])));
alter table public.necesidades add constraint necesidades_tipo_area_check CHECK ((tipo_area = ANY (ARRAY['area_usuaria'::text, 'ate'::text])));
alter table public.necesidades add constraint necesidades_plazo_ejecucion_unidad_check CHECK ((plazo_ejecucion_unidad = ANY (ARRAY['calendario'::text, 'habiles'::text])));
alter table public.necesidades add constraint necesidades_tipo_objeto_check CHECK ((tipo_objeto = ANY (ARRAY['bienes'::text, 'servicios'::text, 'obras'::text, 'consultoria_obra'::text])));
alter table public.necesidades add constraint necesidades_status_check CHECK ((status = ANY (ARRAY['borrador'::text, 'remitido_dec'::text, 'en_revision_dec'::text, 'observado'::text, 'no_objecion_pendiente'::text, 'conforme'::text, 'incorporado_cmn'::text, 'anulada'::text])));
alter table public.norma_concordancias add constraint norma_concordancias_relation_type_check CHECK ((relation_type = ANY (ARRAY['modifica'::text, 'deroga'::text, 'reglamenta'::text, 'complementa'::text, 'remite'::text, 'concordancia'::text])));
alter table public.process_documents add constraint process_documents_status_check CHECK ((status = ANY (ARRAY['uploaded'::text, 'processing'::text, 'ready'::text, 'error'::text])));
alter table public.process_documents add constraint process_documents_kind_check CHECK ((kind = ANY (ARRAY['bases'::text, 'bases_integradas'::text, 'oferta'::text, 'contrato'::text, 'acta'::text, 'requerimiento'::text, 'tdr'::text, 'ee_tt'::text, 'informe'::text, 'carta'::text, 'generado'::text, 'otros'::text])));
alter table public.process_evaluations add constraint process_evaluations_result_check CHECK ((result = ANY (ARRAY['cumple'::text, 'no_cumple'::text, 'subsanable'::text, 'riesgo'::text])));
alter table public.process_type_settings add constraint process_type_settings_category_check CHECK ((category = ANY (ARRAY['competitivo'::text, 'no_competitivo'::text, 'contrato_menor'::text])));
alter table public.process_type_settings add constraint process_type_settings_code_check CHECK ((code ~ '^[a-z0-9_]+$'::text));
alter table public.processing_jobs add constraint processing_jobs_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'processing'::text, 'completed'::text, 'error'::text])));
alter table public.procurement_processes add constraint procurement_processes_status_check CHECK ((status = ANY (ARRAY['necesidad'::text, 'actuaciones_preparatorias'::text, 'expediente'::text, 'aprobacion_aga'::text, 'seleccion'::text, 'buena_pro'::text, 'desierto'::text, 'contrato'::text, 'ejecucion'::text, 'conformidad'::text, 'liquidacion'::text, 'archivo'::text])));
alter table public.procurement_processes add constraint procurement_processes_autoridad_aprobacion_check CHECK ((autoridad_aprobacion = ANY (ARRAY['titular'::text, 'aga'::text])));
alter table public.procurement_processes add constraint procurement_processes_object_type_check CHECK ((object_type = ANY (ARRAY['bienes'::text, 'servicios'::text, 'obras'::text, 'consultoria'::text])));
alter table public.procurement_processes add constraint procurement_processes_modalidad_ejecucion_check CHECK ((modalidad_ejecucion = ANY (ARRAY['llave_en_mano'::text, 'concurso_oferta'::text])));
alter table public.procurement_processes add constraint procurement_processes_sistema_contratacion_check CHECK ((sistema_contratacion = ANY (ARRAY['suma_alzada'::text, 'precios_unitarios'::text, 'esquema_mixto'::text, 'tarifas'::text, 'porcentajes'::text, 'honorario_fijo'::text])));
alter table public.profiles add constraint profiles_role_check CHECK ((role = ANY (ARRAY['consulta'::text, 'area_usuaria'::text, 'ate'::text, 'dec'::text, 'oficial_compra'::text, 'comite'::text, 'jurado'::text, 'legal'::text, 'titular'::text, 'aga'::text, 'admin'::text])));
alter table public.respuesta_feedback add constraint respuesta_feedback_rating_check CHECK ((rating = ANY (ARRAY['like'::text, 'dislike'::text])));
alter table public.riesgo_necesidad add constraint riesgo_necesidad_probabilidad_check CHECK ((probabilidad = ANY (ARRAY['baja'::text, 'media'::text, 'alta'::text])));
alter table public.riesgo_necesidad add constraint riesgo_necesidad_impacto_check CHECK ((impacto = ANY (ARRAY['bajo'::text, 'medio'::text, 'alto'::text])));

-- ══ Índices ══
CREATE INDEX idx_ai_feedback_examples_message ON public.ai_feedback_examples USING btree (message_id);
CREATE INDEX idx_archivo_chunks_content_trgm ON public.archivo_chunks USING gin (content gin_trgm_ops);
CREATE INDEX idx_archivo_chunks_documento_id ON public.archivo_chunks USING btree (documento_id);
CREATE INDEX idx_archivo_documentos_created_at ON public.archivo_documentos USING btree (created_at DESC);
CREATE INDEX idx_archivo_documentos_fecha ON public.archivo_documentos USING btree (fecha DESC);
CREATE INDEX idx_archivo_documentos_kind ON public.archivo_documentos USING btree (doc_kind);
CREATE INDEX idx_archivo_documentos_status ON public.archivo_documentos USING btree (status);
CREATE INDEX audit_logs_entity_id_created_at_idx ON public.audit_logs USING btree (entity_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs USING btree (entity_type, entity_id);
CREATE INDEX idx_audit_logs_year ON public.audit_logs USING btree (year);
CREATE INDEX idx_boletin_created ON public.boletin_eventos USING btree (created_at DESC);
CREATE INDEX idx_boletin_eventos_document ON public.boletin_eventos USING btree (document_id);
CREATE INDEX idx_carpetas_owner ON public.carpetas USING btree (owner_id);
CREATE INDEX idx_chat_messages_session_id ON public.chat_messages USING btree (session_id);
CREATE INDEX idx_chat_response_notes_message_id ON public.chat_response_notes USING btree (message_id);
CREATE INDEX idx_chat_sessions_owner ON public.chat_sessions USING btree (owner_id);
CREATE INDEX idx_chat_sources_chunk ON public.chat_sources USING btree (chunk_id);
CREATE INDEX idx_chat_sources_document_id ON public.chat_sources USING btree (document_id);
CREATE INDEX idx_chat_sources_message_id ON public.chat_sources USING btree (message_id);
CREATE INDEX idx_document_analyses_document ON public.document_analyses USING btree (document_id);
CREATE INDEX idx_document_analyses_owner ON public.document_analyses USING btree (owner_id);
CREATE INDEX idx_document_chunks_content_trgm ON public.document_chunks USING gin (content gin_trgm_ops);
CREATE INDEX idx_document_chunks_document_id ON public.document_chunks USING btree (document_id);
CREATE INDEX idx_document_summaries_document ON public.document_summaries USING btree (document_id);
CREATE INDEX idx_documents_created_at ON public.documents USING btree (created_at DESC);
CREATE INDEX idx_documents_process_type ON public.documents USING btree (process_type);
CREATE INDEX idx_documents_status ON public.documents USING btree (status);
CREATE INDEX idx_documents_type ON public.documents USING btree (document_type);
CREATE INDEX idx_entity_settings_updated_by ON public.entity_settings USING btree (updated_by);
CREATE INDEX idx_eval_resultados_corrida ON public.eval_resultados USING btree (corrida_id);
CREATE INDEX idx_eval_resultados_pregunta ON public.eval_resultados USING btree (pregunta_id);
CREATE INDEX expedientes_archivo_oficina_id_idx ON public.expedientes_archivo USING btree (oficina_id);
CREATE INDEX expedientes_archivo_uploaded_by_idx ON public.expedientes_archivo USING btree (uploaded_by);
CREATE INDEX idx_expedientes_archivo_anio ON public.expedientes_archivo USING btree (anio DESC);
CREATE INDEX idx_expedientes_archivo_created_at ON public.expedientes_archivo USING btree (created_at DESC);
CREATE INDEX idx_expedientes_archivo_estante ON public.expedientes_archivo USING btree (nro_estante);
CREATE INDEX idx_expedientes_archivo_oficina ON public.expedientes_archivo USING btree (oficina);
CREATE INDEX idx_expedientes_archivo_serie ON public.expedientes_archivo USING btree (serie_documento);
CREATE INDEX idx_expedientes_archivo_status ON public.expedientes_archivo USING btree (status);
CREATE INDEX idx_expedientes_archivo_year ON public.expedientes_archivo USING btree (year);
CREATE INDEX idx_expedientes_archivo_chunks_exp ON public.expedientes_archivo_chunks USING btree (expediente_id);
CREATE INDEX idx_expedientes_archivo_chunks_trgm ON public.expedientes_archivo_chunks USING gin (content gin_trgm_ops);
CREATE INDEX idx_expedientes_archivo_chunks_year ON public.expedientes_archivo_chunks USING btree (year);
CREATE INDEX idx_expedientes_oficinas_activo ON public.expedientes_oficinas USING btree (activo);
CREATE INDEX idx_expedientes_oficinas_year ON public.expedientes_oficinas USING btree (year);
CREATE INDEX expedientes_respuestas_antecedente_idx ON public.expedientes_respuestas USING btree (antecedente_id);
CREATE INDEX expedientes_respuestas_created_by_idx ON public.expedientes_respuestas USING btree (created_by);
CREATE INDEX expedientes_respuestas_fts_gin ON public.expedientes_respuestas USING gin (fts);
CREATE INDEX expedientes_respuestas_parent_idx ON public.expedientes_respuestas USING btree (parent_version_id, version DESC);
CREATE INDEX idx_expedientes_respuestas_anio ON public.expedientes_respuestas USING btree (anio DESC);
CREATE INDEX idx_expedientes_respuestas_created_at ON public.expedientes_respuestas USING btree (created_at DESC);
CREATE INDEX idx_expedientes_respuestas_year ON public.expedientes_respuestas USING btree (year);
CREATE INDEX idx_guardados_article ON public.guardados USING btree (article_id);
CREATE INDEX idx_guardados_carpeta ON public.guardados USING btree (carpeta_id);
CREATE INDEX idx_guardados_document ON public.guardados USING btree (document_id);
CREATE INDEX idx_guardados_message ON public.guardados USING btree (message_id);
CREATE INDEX idx_guardados_owner ON public.guardados USING btree (owner_id);
CREATE INDEX idx_necesidad_documentos_necesidad ON public.necesidad_documentos USING btree (necesidad_id);
CREATE INDEX idx_necesidad_items_necesidad ON public.necesidad_items USING btree (necesidad_id);
CREATE INDEX idx_necesidad_items_paquete ON public.necesidad_items USING btree (necesidad_id, nro_paquete);
CREATE UNIQUE INDEX necesidad_items_nro_unico ON public.necesidad_items USING btree (necesidad_id, nro);
CREATE INDEX idx_necesidad_observaciones_necesidad ON public.necesidad_observaciones USING btree (necesidad_id);
CREATE INDEX idx_necesidad_versiones_necesidad ON public.necesidad_versiones USING btree (necesidad_id);
CREATE INDEX idx_necesidades_owner ON public.necesidades USING btree (owner_id);
CREATE INDEX idx_necesidades_process ON public.necesidades USING btree (process_id);
CREATE INDEX idx_norma_articulos_content_trgm ON public.norma_articulos USING gin (content gin_trgm_ops);
CREATE INDEX idx_norma_articulos_document ON public.norma_articulos USING btree (document_id);
CREATE INDEX idx_norma_articulos_number ON public.norma_articulos USING btree (article_number);
CREATE INDEX idx_concordancias_source_article ON public.norma_concordancias USING btree (source_article_id);
CREATE INDEX idx_concordancias_source_document ON public.norma_concordancias USING btree (source_document_id);
CREATE INDEX idx_concordancias_target_article ON public.norma_concordancias USING btree (target_article_id);
CREATE INDEX idx_concordancias_target_document ON public.norma_concordancias USING btree (target_document_id);
CREATE INDEX normativa_adjuntos_created_by_idx ON public.normativa_adjuntos USING btree (created_by, created_at DESC);
CREATE INDEX idx_normative_comparisons_created_at ON public.normative_comparisons USING btree (created_at DESC);
CREATE INDEX idx_normative_comparisons_owner ON public.normative_comparisons USING btree (owner_id);
CREATE INDEX pedidos_siga_necesidad_idx ON public.pedidos_siga USING btree (necesidad_id);
CREATE INDEX pedidos_siga_nro_idx ON public.pedidos_siga USING btree (nro_pedido);
CREATE UNIQUE INDEX idx_personal_codigo ON public.personal USING btree (codigo);
CREATE INDEX idx_personal_documento ON public.personal USING btree (documento);
CREATE INDEX idx_personal_nombre ON public.personal USING btree (nombre_completo);
CREATE INDEX idx_process_documents_library_document ON public.process_documents USING btree (library_document_id);
CREATE INDEX idx_process_documents_owner ON public.process_documents USING btree (owner_id);
CREATE INDEX idx_process_documents_process ON public.process_documents USING btree (process_id);
CREATE INDEX idx_process_evaluations_owner ON public.process_evaluations USING btree (owner_id);
CREATE INDEX idx_process_evaluations_process ON public.process_evaluations USING btree (process_id);
CREATE INDEX idx_process_risks_owner ON public.process_risks USING btree (owner_id);
CREATE INDEX idx_process_risks_process ON public.process_risks USING btree (process_id);
CREATE INDEX idx_process_type_settings_updated_by ON public.process_type_settings USING btree (updated_by);
CREATE INDEX idx_processing_jobs_document_id ON public.processing_jobs USING btree (document_id);
CREATE INDEX idx_processing_jobs_status ON public.processing_jobs USING btree (status);
CREATE INDEX idx_procurement_processes_necesidad ON public.procurement_processes USING btree (necesidad_id);
CREATE INDEX idx_procurement_processes_owner ON public.procurement_processes USING btree (owner_id);
CREATE INDEX procurement_processes_hitos_gin ON public.procurement_processes USING gin (hitos);
CREATE INDEX idx_respuesta_antecedentes_year ON public.respuesta_antecedentes USING btree (year);
CREATE INDEX respuesta_antecedentes_created_by_idx ON public.respuesta_antecedentes USING btree (created_by, created_at DESC);
CREATE INDEX respuesta_antecedentes_pinecone_idx ON public.respuesta_antecedentes USING btree (pinecone_document_id);
CREATE INDEX idx_respuesta_feedback_year ON public.respuesta_feedback USING btree (year);
CREATE INDEX respuesta_feedback_oficina_idx ON public.respuesta_feedback USING btree (oficina_id, tipo_documento, rating, created_at DESC);
CREATE INDEX idx_riesgo_necesidad_necesidad ON public.riesgo_necesidad USING btree (necesidad_id);
CREATE INDEX idx_seguimientos_owner ON public.seguimientos USING btree (owner_id);

-- ══ Funciones ══
CREATE OR REPLACE FUNCTION public.admin_metrics()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'documents', jsonb_build_object(
      'total', (select count(*) from public.documents),
      'uploaded', (select count(*) from public.documents where status = 'uploaded'),
      'processing', (select count(*) from public.documents where status = 'processing'),
      'indexed', (select count(*) from public.documents where status = 'indexed'),
      'error', (select count(*) from public.documents where status = 'error')
    ),
    'stuck', (
      select count(*) from public.documents
      where status = 'uploaded'
         or (status = 'processing' and updated_at < now() - interval '10 minutes')
    ),
    'chunks', (select count(*) from public.document_chunks),
    'articulos', (select count(*) from public.norma_articulos),
    'summaries', (select count(*) from public.document_summaries),
    'concordancias', (select count(*) from public.norma_concordancias),
    'chat_sessions', (select count(*) from public.chat_sessions),
    'chat_messages', (select count(*) from public.chat_messages),
    'boletin', (select count(*) from public.boletin_eventos),
    'seguimientos', (select count(*) from public.seguimientos),
    'guardados', (select count(*) from public.guardados),
    'eval_preguntas', (select count(*) from public.eval_preguntas),
    'eval_corridas', (select count(*) from public.eval_corridas),
    'users', jsonb_build_object(
      'total', (select count(*) from public.profiles),
      'admins', (select count(*) from public.profiles where role = 'admin'),
      'editors', (select count(*) from public.profiles where role = 'editor'),
      'users', (select count(*) from public.profiles where role = 'user')
    )
  ) into result;

  return result;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.archivo_es_jefe()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(
    (select es_jefe from public.profiles where id = auth.uid()),
    false
  );
$function$
;

CREATE OR REPLACE FUNCTION public.archivo_norm(t text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select nullif(
    trim(regexp_replace(
      translate(lower(coalesce(t, '')), 'áéíóúüñàèìòù', 'aeiouunaeiou'),
      '\s+', ' ', 'g'
    )),
    ''
  );
$function$
;

CREATE OR REPLACE FUNCTION public.archivo_oficina_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select oficina_id from public.profiles where id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.consumir_correlativo(p_oficina uuid, p_tipo text, p_year integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_consumido int;
begin
  update expedientes_doc_counters
     set siguiente = siguiente + 1
   where oficina_id = p_oficina and tipo = p_tipo and year = p_year
   returning siguiente - 1 into v_consumido;
  return v_consumido;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.corpus_facets()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with idx as (
    select document_type, source_entity, process_type, metadata
    from public.documents
    where status = 'indexed'
  )
  select jsonb_build_object(
    'total', (select count(*) from idx),
    'documentType', (
      select coalesce(jsonb_agg(jsonb_build_object('value', document_type, 'count', c) order by c desc), '[]'::jsonb)
      from (select document_type, count(*) c from idx where document_type is not null group by document_type) t
    ),
    'sourceEntity', (
      select coalesce(jsonb_agg(jsonb_build_object('value', source_entity, 'count', c) order by c desc), '[]'::jsonb)
      from (select source_entity, count(*) c from idx where source_entity is not null group by source_entity) t
    ),
    'processType', (
      select coalesce(jsonb_agg(jsonb_build_object('value', process_type, 'count', c) order by c desc), '[]'::jsonb)
      from (select process_type, count(*) c from idx where process_type is not null group by process_type) t
    ),
    'year', (
      select coalesce(jsonb_agg(jsonb_build_object('value', y, 'count', c) order by y desc), '[]'::jsonb)
      from (select metadata->>'year' y, count(*) c from idx where metadata->>'year' is not null group by metadata->>'year') t
    ),
    'vigencia', (
      select coalesce(jsonb_agg(jsonb_build_object('value', v, 'count', c) order by c desc), '[]'::jsonb)
      from (select metadata->>'vigencia' v, count(*) c from idx where metadata->>'vigencia' is not null group by metadata->>'vigencia') t
    )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.distinct_audit_actions()
 RETURNS text[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(array_agg(distinct action order by action), '{}')
  from public.audit_logs;
$function$
;

CREATE OR REPLACE FUNCTION public.expedientes_archivo_resolve_oficina()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.oficina_id is null
     or (tg_op = 'UPDATE' and new.oficina is distinct from old.oficina) then
    select o.id into new.oficina_id
    from public.expedientes_oficinas o
    where public.archivo_norm(o.nombre) = public.archivo_norm(new.oficina)
    limit 1;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.expedientes_next_doc_number(p_oficina uuid, p_tipo text, p_year integer DEFAULT (EXTRACT(year FROM now()))::integer)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_num integer;
  v_ancho integer;
  v_sufijo text;
  v_segs text;
begin
  -- Toma y avanza el correlativo de forma atomica (crea la fila si no existe).
  insert into public.expedientes_doc_counters (oficina_id, tipo, siguiente, year)
  values (p_oficina, p_tipo, 2, p_year)
  on conflict (oficina_id, tipo, year)
  do update set siguiente = public.expedientes_doc_counters.siguiente + 1
  returning siguiente - 1 into v_num;

  -- El sufijo propio del tipo manda sobre el de la oficina; la fila del contador
  -- se busca por el MISMO año que se acaba de consumir.
  select o.ancho, coalesce(c.sufijo, o.sufijo)
    into v_ancho, v_sufijo
  from public.expedientes_oficinas o
  left join public.expedientes_doc_counters c
    on c.oficina_id = o.id and c.tipo = p_tipo and c.year = p_year
  where o.id = p_oficina;

  v_ancho := least(8, greatest(1, coalesce(v_ancho, 3)));

  -- Normaliza el sufijo: segmentos separados por "/" o "-", unidos con "/".
  -- Espejo de splitSufijo/joinSufijo en lib/document-number.ts, para que la
  -- sugerencia de la vista previa y el numero asignado no discrepen.
  if v_sufijo is not null and btrim(v_sufijo) <> '' then
    select string_agg(seg, '/')
      into v_segs
    from (
      select btrim(x) as seg
      from unnest(regexp_split_to_array(v_sufijo, '[/\-]')) as x
      where btrim(x) <> ''
    ) s;
  end if;

  if v_segs is not null and v_segs <> '' then
    return p_tipo || ' N° ' || lpad(v_num::text, v_ancho, '0') || '-' ||
           p_year || '-' || v_segs;
  end if;
  return p_tipo || ' N° ' || lpad(v_num::text, v_ancho, '0') || '-' || p_year;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  admin_count int;
begin
  -- El primer usuario registrado nace admin (bootstrap); el resto, consulta.
  select count(*) into admin_count from public.profiles where role = 'admin';
  insert into public.profiles (id, email, role, metadata)
  values (
    new.id,
    new.email,
    case when admin_count = 0 then 'admin' else 'consulta' end,
    jsonb_build_object(
      'role',
      case when admin_count = 0 then 'admin' else 'consulta' end,
      'permissionVersion',
      'ace-role-matrix-v1'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_editor()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role in ('dec', 'admin')
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_expediente_colaborador()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('area_usuaria','ate','dec','oficial_compra','comite','jurado','legal','titular','aga','admin')
  );
$function$
;

CREATE OR REPLACE FUNCTION public.merge_document_metadata(p_id uuid, p_necesidad_id text, p_patch jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  k text;
  v jsonb;
  merged jsonb;
begin
  select coalesce(metadata, '{}'::jsonb) into merged
  from public.documents
  where id = p_id
    and metadata->>'kind' = 'eett_tdr'
    and metadata->>'necesidadId' = p_necesidad_id
  for update;

  if not found then
    return;
  end if;

  for k, v in select key, value from jsonb_each(p_patch) loop
    if jsonb_typeof(merged -> k) = 'object' and jsonb_typeof(v) = 'object' then
      merged := jsonb_set(merged, array[k], (merged -> k) || v);
    else
      merged := jsonb_set(merged, array[k], v);
    end if;
  end loop;

  update public.documents set metadata = merged where id = p_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_contratos_cp_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_contratos_sie_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_necesidad_codigo()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.codigo is null then
    new.codigo := 'REQ-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.necesidad_codigo_seq')::text, 4, '0');
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_necesidad_items_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

-- ══ Triggers ══
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
CREATE TRIGGER set_archivo_documentos_updated_at BEFORE UPDATE ON public.archivo_documentos FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_chat_sessions_updated_at BEFORE UPDATE ON public.chat_sessions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_contratos_cp_updated_at BEFORE UPDATE ON public.contratos_cp FOR EACH ROW EXECUTE FUNCTION set_contratos_cp_updated_at();
CREATE TRIGGER trg_contratos_sie_updated_at BEFORE UPDATE ON public.contratos_sie FOR EACH ROW EXECUTE FUNCTION set_contratos_sie_updated_at();
CREATE TRIGGER set_documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_entity_settings_updated_at BEFORE UPDATE ON public.entity_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER expedientes_archivo_resolve_oficina_trg BEFORE INSERT OR UPDATE OF oficina ON public.expedientes_archivo FOR EACH ROW EXECUTE FUNCTION expedientes_archivo_resolve_oficina();
CREATE TRIGGER set_expedientes_archivo_updated_at BEFORE UPDATE ON public.expedientes_archivo FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_necesidad_items_updated_at BEFORE UPDATE ON public.necesidad_items FOR EACH ROW EXECUTE FUNCTION set_necesidad_items_updated_at();
CREATE TRIGGER set_necesidades_codigo BEFORE INSERT ON public.necesidades FOR EACH ROW EXECUTE FUNCTION set_necesidad_codigo();
CREATE TRIGGER set_necesidades_updated_at BEFORE UPDATE ON public.necesidades FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_process_documents_updated_at BEFORE UPDATE ON public.process_documents FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_process_type_settings_updated_at BEFORE UPDATE ON public.process_type_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_procurement_processes_updated_at BEFORE UPDATE ON public.procurement_processes FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ══ RLS (activar) ══
alter table public.ai_feedback_examples enable row level security;
alter table public.archivo_chunks enable row level security;
alter table public.archivo_documentos enable row level security;
alter table public.audit_logs enable row level security;
alter table public.boletin_eventos enable row level security;
alter table public.carpetas enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_response_notes enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_sources enable row level security;
alter table public.contratos_cp enable row level security;
alter table public.contratos_sie enable row level security;
alter table public.document_analyses enable row level security;
alter table public.document_chunks enable row level security;
alter table public.document_summaries enable row level security;
alter table public.documents enable row level security;
alter table public.entity_settings enable row level security;
alter table public.eval_corridas enable row level security;
alter table public.eval_preguntas enable row level security;
alter table public.eval_resultados enable row level security;
alter table public.expedientes_archivo enable row level security;
alter table public.expedientes_archivo_chunks enable row level security;
alter table public.expedientes_doc_counters enable row level security;
alter table public.expedientes_ocr_cache enable row level security;
alter table public.expedientes_oficinas enable row level security;
alter table public.expedientes_respuestas enable row level security;
alter table public.guardados enable row level security;
alter table public.necesidad_admisibilidad enable row level security;
alter table public.necesidad_documentos enable row level security;
alter table public.necesidad_items enable row level security;
alter table public.necesidad_observaciones enable row level security;
alter table public.necesidad_versiones enable row level security;
alter table public.necesidades enable row level security;
alter table public.necesidades_requisitos_legacy_backup enable row level security;
alter table public.necesidades_sustento_legacy_backup enable row level security;
alter table public.norma_articulos enable row level security;
alter table public.norma_concordancias enable row level security;
alter table public.normativa_adjuntos enable row level security;
alter table public.normative_comparisons enable row level security;
alter table public.pedidos_siga enable row level security;
alter table public.personal enable row level security;
alter table public.process_cotizaciones enable row level security;
alter table public.process_documents enable row level security;
alter table public.process_evaluations enable row level security;
alter table public.process_risks enable row level security;
alter table public.process_type_settings enable row level security;
alter table public.processing_jobs enable row level security;
alter table public.procurement_processes enable row level security;
alter table public.profiles enable row level security;
alter table public.respuesta_antecedentes enable row level security;
alter table public.respuesta_feedback enable row level security;
alter table public.riesgo_necesidad enable row level security;
alter table public.seguimientos enable row level security;

-- ══ Políticas RLS ══
create policy ai_feedback_examples_admin_select on public.ai_feedback_examples as permissive for select to authenticated using (( SELECT is_admin() AS is_admin));
create policy ai_feedback_examples_owner_insert on public.ai_feedback_examples as permissive for insert to authenticated with check ((EXISTS ( SELECT 1
   FROM (chat_messages m
     JOIN chat_sessions s ON ((s.id = m.session_id)))
  WHERE ((m.id = ai_feedback_examples.message_id) AND (s.owner_id = ( SELECT auth.uid() AS uid))))));
create policy archivo_chunks_admin_delete on public.archivo_chunks as permissive for delete to authenticated using (is_editor());
create policy archivo_chunks_admin_insert on public.archivo_chunks as permissive for insert to authenticated with check (is_editor());
create policy archivo_chunks_admin_update on public.archivo_chunks as permissive for update to authenticated using (is_editor()) with check (is_editor());
create policy archivo_chunks_select on public.archivo_chunks as permissive for select to authenticated using (true);
create policy archivo_documentos_admin_delete on public.archivo_documentos as permissive for delete to authenticated using (is_editor());
create policy archivo_documentos_admin_insert on public.archivo_documentos as permissive for insert to authenticated with check (is_editor());
create policy archivo_documentos_admin_update on public.archivo_documentos as permissive for update to authenticated using (is_editor()) with check (is_editor());
create policy archivo_documentos_select on public.archivo_documentos as permissive for select to authenticated using (true);
create policy audit_logs_admin_select on public.audit_logs as permissive for select to authenticated using (( SELECT is_admin() AS is_admin));
create policy boletin_admin_delete on public.boletin_eventos as permissive for delete to authenticated using (( SELECT is_admin() AS is_admin));
create policy boletin_admin_insert on public.boletin_eventos as permissive for insert to authenticated with check (( SELECT is_admin() AS is_admin));
create policy boletin_admin_update on public.boletin_eventos as permissive for update to authenticated using (( SELECT is_admin() AS is_admin)) with check (( SELECT is_admin() AS is_admin));
create policy boletin_select on public.boletin_eventos as permissive for select to authenticated using (true);
create policy carpetas_owner on public.carpetas as permissive for all to authenticated using ((owner_id = ( SELECT auth.uid() AS uid))) with check ((owner_id = ( SELECT auth.uid() AS uid)));
create policy chat_messages_owner on public.chat_messages as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM chat_sessions s
  WHERE ((s.id = chat_messages.session_id) AND (s.owner_id = ( SELECT auth.uid() AS uid)))))) with check ((EXISTS ( SELECT 1
   FROM chat_sessions s
  WHERE ((s.id = chat_messages.session_id) AND (s.owner_id = ( SELECT auth.uid() AS uid))))));
create policy chat_response_notes_owner on public.chat_response_notes as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM (chat_messages m
     JOIN chat_sessions s ON ((s.id = m.session_id)))
  WHERE ((m.id = chat_response_notes.message_id) AND (s.owner_id = ( SELECT auth.uid() AS uid)))))) with check ((EXISTS ( SELECT 1
   FROM (chat_messages m
     JOIN chat_sessions s ON ((s.id = m.session_id)))
  WHERE ((m.id = chat_response_notes.message_id) AND (s.owner_id = ( SELECT auth.uid() AS uid))))));
create policy chat_sessions_owner on public.chat_sessions as permissive for all to authenticated using ((owner_id = ( SELECT auth.uid() AS uid))) with check ((owner_id = ( SELECT auth.uid() AS uid)));
create policy chat_sources_owner on public.chat_sources as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM (chat_messages m
     JOIN chat_sessions s ON ((s.id = m.session_id)))
  WHERE ((m.id = chat_sources.message_id) AND (s.owner_id = ( SELECT auth.uid() AS uid)))))) with check ((EXISTS ( SELECT 1
   FROM (chat_messages m
     JOIN chat_sessions s ON ((s.id = m.session_id)))
  WHERE ((m.id = chat_sources.message_id) AND (s.owner_id = ( SELECT auth.uid() AS uid))))));
create policy "Usuarios pueden actualizar sus contratos CP" on public.contratos_cp as permissive for update to public using ((auth.uid() = user_id));
create policy "Usuarios pueden eliminar sus contratos CP" on public.contratos_cp as permissive for delete to public using ((auth.uid() = user_id));
create policy "Usuarios pueden insertar sus contratos CP" on public.contratos_cp as permissive for insert to public with check ((auth.uid() = user_id));
create policy "Usuarios pueden ver sus contratos CP" on public.contratos_cp as permissive for select to public using ((auth.uid() = user_id));
create policy "Usuarios pueden actualizar sus contratos" on public.contratos_sie as permissive for update to public using ((auth.uid() = user_id));
create policy "Usuarios pueden eliminar sus contratos" on public.contratos_sie as permissive for delete to public using ((auth.uid() = user_id));
create policy "Usuarios pueden insertar sus contratos" on public.contratos_sie as permissive for insert to public with check ((auth.uid() = user_id));
create policy "Usuarios pueden ver sus contratos" on public.contratos_sie as permissive for select to public using ((auth.uid() = user_id));
create policy document_analyses_owner on public.document_analyses as permissive for all to authenticated using ((owner_id = ( SELECT auth.uid() AS uid))) with check ((owner_id = ( SELECT auth.uid() AS uid)));
create policy document_chunks_admin_delete on public.document_chunks as permissive for delete to authenticated using (( SELECT is_editor() AS is_editor));
create policy document_chunks_admin_insert on public.document_chunks as permissive for insert to authenticated with check (( SELECT is_editor() AS is_editor));
create policy document_chunks_admin_update on public.document_chunks as permissive for update to authenticated using (( SELECT is_editor() AS is_editor)) with check (( SELECT is_editor() AS is_editor));
create policy document_chunks_select on public.document_chunks as permissive for select to authenticated using (true);
create policy document_summaries_admin_delete on public.document_summaries as permissive for delete to authenticated using (( SELECT is_editor() AS is_editor));
create policy document_summaries_admin_insert on public.document_summaries as permissive for insert to authenticated with check (( SELECT is_editor() AS is_editor));
create policy document_summaries_admin_update on public.document_summaries as permissive for update to authenticated using (( SELECT is_editor() AS is_editor)) with check (( SELECT is_editor() AS is_editor));
create policy document_summaries_select on public.document_summaries as permissive for select to authenticated using (true);
create policy documents_admin_delete on public.documents as permissive for delete to authenticated using (( SELECT is_editor() AS is_editor));
create policy documents_admin_insert on public.documents as permissive for insert to authenticated with check (( SELECT is_editor() AS is_editor));
create policy documents_admin_update on public.documents as permissive for update to authenticated using (( SELECT is_editor() AS is_editor)) with check (( SELECT is_editor() AS is_editor));
create policy documents_select on public.documents as permissive for select to authenticated using (true);
create policy entity_settings_admin on public.entity_settings as permissive for all to authenticated using (( SELECT is_admin() AS is_admin)) with check (( SELECT is_admin() AS is_admin));
create policy eval_corridas_admin_delete on public.eval_corridas as permissive for delete to authenticated using (( SELECT is_admin() AS is_admin));
create policy eval_corridas_admin_insert on public.eval_corridas as permissive for insert to authenticated with check (( SELECT is_admin() AS is_admin));
create policy eval_corridas_admin_update on public.eval_corridas as permissive for update to authenticated using (( SELECT is_admin() AS is_admin)) with check (( SELECT is_admin() AS is_admin));
create policy eval_corridas_select on public.eval_corridas as permissive for select to authenticated using (true);
create policy eval_preguntas_admin_delete on public.eval_preguntas as permissive for delete to authenticated using (( SELECT is_admin() AS is_admin));
create policy eval_preguntas_admin_insert on public.eval_preguntas as permissive for insert to authenticated with check (( SELECT is_admin() AS is_admin));
create policy eval_preguntas_admin_update on public.eval_preguntas as permissive for update to authenticated using (( SELECT is_admin() AS is_admin)) with check (( SELECT is_admin() AS is_admin));
create policy eval_preguntas_select on public.eval_preguntas as permissive for select to authenticated using (true);
create policy eval_resultados_admin_delete on public.eval_resultados as permissive for delete to authenticated using (( SELECT is_admin() AS is_admin));
create policy eval_resultados_admin_insert on public.eval_resultados as permissive for insert to authenticated with check (( SELECT is_admin() AS is_admin));
create policy eval_resultados_admin_update on public.eval_resultados as permissive for update to authenticated using (( SELECT is_admin() AS is_admin)) with check (( SELECT is_admin() AS is_admin));
create policy eval_resultados_select on public.eval_resultados as permissive for select to authenticated using (true);
create policy expedientes_archivo_scoped_delete on public.expedientes_archivo as permissive for delete to authenticated using ((is_editor() AND (is_admin() OR (uploaded_by = auth.uid()) OR (archivo_es_jefe() AND (oficina_id IS NOT NULL) AND (oficina_id = archivo_oficina_id())))));
create policy expedientes_archivo_scoped_insert on public.expedientes_archivo as permissive for insert to authenticated with check ((is_editor() AND (uploaded_by = auth.uid())));
create policy expedientes_archivo_scoped_select on public.expedientes_archivo as permissive for select to authenticated using ((is_admin() OR (uploaded_by = auth.uid()) OR (archivo_es_jefe() AND (oficina_id IS NOT NULL) AND (oficina_id = archivo_oficina_id()))));
create policy expedientes_archivo_scoped_update on public.expedientes_archivo as permissive for update to authenticated using ((is_editor() AND (is_admin() OR (uploaded_by = auth.uid()) OR (archivo_es_jefe() AND (oficina_id IS NOT NULL) AND (oficina_id = archivo_oficina_id()))))) with check ((is_editor() AND (is_admin() OR (uploaded_by = auth.uid()) OR (archivo_es_jefe() AND (oficina_id IS NOT NULL) AND (oficina_id = archivo_oficina_id())))));
create policy expedientes_archivo_chunks_scoped_select on public.expedientes_archivo_chunks as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM expedientes_archivo e
  WHERE ((e.id = expedientes_archivo_chunks.expediente_id) AND (is_admin() OR (e.uploaded_by = auth.uid()) OR (archivo_es_jefe() AND (e.oficina_id IS NOT NULL) AND (e.oficina_id = archivo_oficina_id())))))));
create policy expedientes_archivo_chunks_scoped_write on public.expedientes_archivo_chunks as permissive for all to authenticated using ((is_editor() AND (EXISTS ( SELECT 1
   FROM expedientes_archivo e
  WHERE ((e.id = expedientes_archivo_chunks.expediente_id) AND (is_admin() OR (e.uploaded_by = auth.uid()) OR (archivo_es_jefe() AND (e.oficina_id IS NOT NULL) AND (e.oficina_id = archivo_oficina_id())))))))) with check ((is_editor() AND (EXISTS ( SELECT 1
   FROM expedientes_archivo e
  WHERE ((e.id = expedientes_archivo_chunks.expediente_id) AND (is_admin() OR (e.uploaded_by = auth.uid()) OR (archivo_es_jefe() AND (e.oficina_id IS NOT NULL) AND (e.oficina_id = archivo_oficina_id()))))))));
create policy expedientes_doc_counters_editor_write on public.expedientes_doc_counters as permissive for all to authenticated using (is_editor()) with check (is_editor());
create policy expedientes_doc_counters_select on public.expedientes_doc_counters as permissive for select to authenticated using (true);
create policy expedientes_oficinas_editor_write on public.expedientes_oficinas as permissive for all to authenticated using (is_editor()) with check (is_editor());
create policy expedientes_oficinas_select on public.expedientes_oficinas as permissive for select to authenticated using (true);
create policy expedientes_respuestas_scoped_delete on public.expedientes_respuestas as permissive for delete to authenticated using ((is_editor() AND (is_admin() OR (created_by = auth.uid()) OR (archivo_es_jefe() AND (oficina_id IS NOT NULL) AND (oficina_id = archivo_oficina_id())))));
create policy expedientes_respuestas_scoped_insert on public.expedientes_respuestas as permissive for insert to authenticated with check ((is_editor() AND (created_by = auth.uid())));
create policy expedientes_respuestas_scoped_select on public.expedientes_respuestas as permissive for select to authenticated using ((is_admin() OR (created_by = auth.uid()) OR (archivo_es_jefe() AND (oficina_id IS NOT NULL) AND (oficina_id = archivo_oficina_id()))));
create policy expedientes_respuestas_scoped_update on public.expedientes_respuestas as permissive for update to authenticated using ((is_editor() AND (is_admin() OR (created_by = auth.uid()) OR (archivo_es_jefe() AND (oficina_id IS NOT NULL) AND (oficina_id = archivo_oficina_id()))))) with check ((is_editor() AND (is_admin() OR (created_by = auth.uid()) OR (archivo_es_jefe() AND (oficina_id IS NOT NULL) AND (oficina_id = archivo_oficina_id())))));
create policy guardados_owner on public.guardados as permissive for all to authenticated using ((owner_id = ( SELECT auth.uid() AS uid))) with check ((owner_id = ( SELECT auth.uid() AS uid)));
create policy necesidad_admisibilidad_read on public.necesidad_admisibilidad as permissive for select to authenticated using (true);
create policy necesidad_documentos_read on public.necesidad_documentos as permissive for select to authenticated using (true);
create policy necesidad_documentos_write on public.necesidad_documentos as permissive for all to authenticated using (((owner_id = auth.uid()) OR is_expediente_colaborador())) with check (((owner_id = auth.uid()) OR is_expediente_colaborador()));
create policy necesidad_items_read on public.necesidad_items as permissive for select to authenticated using (true);
create policy necesidad_items_write on public.necesidad_items as permissive for all to authenticated using ((is_expediente_colaborador() OR (EXISTS ( SELECT 1
   FROM necesidades n
  WHERE ((n.id = necesidad_items.necesidad_id) AND (n.owner_id = auth.uid())))))) with check ((is_expediente_colaborador() OR (EXISTS ( SELECT 1
   FROM necesidades n
  WHERE ((n.id = necesidad_items.necesidad_id) AND (n.owner_id = auth.uid()))))));
create policy necesidad_observaciones_read on public.necesidad_observaciones as permissive for select to authenticated using (true);
create policy necesidad_observaciones_write on public.necesidad_observaciones as permissive for all to authenticated using ((is_expediente_colaborador() OR (EXISTS ( SELECT 1
   FROM necesidades n
  WHERE ((n.id = necesidad_observaciones.necesidad_id) AND (n.owner_id = auth.uid())))))) with check ((is_expediente_colaborador() OR (EXISTS ( SELECT 1
   FROM necesidades n
  WHERE ((n.id = necesidad_observaciones.necesidad_id) AND (n.owner_id = auth.uid()))))));
create policy necesidad_versiones_read on public.necesidad_versiones as permissive for select to authenticated using (true);
create policy necesidad_versiones_write on public.necesidad_versiones as permissive for all to authenticated using ((is_expediente_colaborador() OR (EXISTS ( SELECT 1
   FROM necesidades n
  WHERE ((n.id = necesidad_versiones.necesidad_id) AND (n.owner_id = auth.uid())))))) with check ((is_expediente_colaborador() OR (EXISTS ( SELECT 1
   FROM necesidades n
  WHERE ((n.id = necesidad_versiones.necesidad_id) AND (n.owner_id = auth.uid()))))));
create policy necesidades_read on public.necesidades as permissive for select to authenticated using (true);
create policy necesidades_write on public.necesidades as permissive for all to authenticated using (((owner_id = auth.uid()) OR is_expediente_colaborador())) with check (((owner_id = auth.uid()) OR is_expediente_colaborador()));
create policy norma_articulos_admin_delete on public.norma_articulos as permissive for delete to authenticated using (( SELECT is_editor() AS is_editor));
create policy norma_articulos_admin_insert on public.norma_articulos as permissive for insert to authenticated with check (( SELECT is_editor() AS is_editor));
create policy norma_articulos_admin_update on public.norma_articulos as permissive for update to authenticated using (( SELECT is_editor() AS is_editor)) with check (( SELECT is_editor() AS is_editor));
create policy norma_articulos_select on public.norma_articulos as permissive for select to authenticated using (true);
create policy norma_concordancias_admin_delete on public.norma_concordancias as permissive for delete to authenticated using (( SELECT is_editor() AS is_editor));
create policy norma_concordancias_admin_insert on public.norma_concordancias as permissive for insert to authenticated with check (( SELECT is_editor() AS is_editor));
create policy norma_concordancias_admin_update on public.norma_concordancias as permissive for update to authenticated using (( SELECT is_editor() AS is_editor)) with check (( SELECT is_editor() AS is_editor));
create policy norma_concordancias_select on public.norma_concordancias as permissive for select to authenticated using (true);
create policy nat_delete on public.normativa_adjuntos as permissive for delete to authenticated using (((created_by = auth.uid()) OR ((auth.jwt() ->> 'role'::text) = 'admin'::text)));
create policy nat_insert on public.normativa_adjuntos as permissive for insert to authenticated with check ((created_by = auth.uid()));
create policy nat_select on public.normativa_adjuntos as permissive for select to authenticated using (true);
create policy normative_comparisons_owner on public.normative_comparisons as permissive for all to authenticated using ((owner_id = ( SELECT auth.uid() AS uid))) with check ((owner_id = ( SELECT auth.uid() AS uid)));
create policy pedidos_siga_insert on public.pedidos_siga as permissive for insert to public with check ((auth.uid() IS NOT NULL));
create policy pedidos_siga_select on public.pedidos_siga as permissive for select to public using ((auth.uid() IS NOT NULL));
create policy pedidos_siga_update on public.pedidos_siga as permissive for update to public using ((auth.uid() IS NOT NULL));
create policy personal_read on public.personal as permissive for select to authenticated using (true);
create policy personal_write on public.personal as permissive for all to authenticated using (is_admin()) with check (is_admin());
create policy process_cotizaciones_read on public.process_cotizaciones as permissive for select to authenticated using (true);
create policy process_cotizaciones_write on public.process_cotizaciones as permissive for all to authenticated using (((owner_id = auth.uid()) OR is_expediente_colaborador())) with check (((owner_id = auth.uid()) OR is_expediente_colaborador()));
create policy process_documents_read on public.process_documents as permissive for select to authenticated using (true);
create policy process_documents_write on public.process_documents as permissive for all to authenticated using (((owner_id = auth.uid()) OR is_expediente_colaborador())) with check (((owner_id = auth.uid()) OR is_expediente_colaborador()));
create policy process_evaluations_read on public.process_evaluations as permissive for select to authenticated using (true);
create policy process_evaluations_write on public.process_evaluations as permissive for all to authenticated using (((owner_id = auth.uid()) OR is_expediente_colaborador())) with check (((owner_id = auth.uid()) OR is_expediente_colaborador()));
create policy process_risks_read on public.process_risks as permissive for select to authenticated using (true);
create policy process_risks_write on public.process_risks as permissive for all to authenticated using (((owner_id = auth.uid()) OR is_expediente_colaborador())) with check (((owner_id = auth.uid()) OR is_expediente_colaborador()));
create policy process_type_settings_admin on public.process_type_settings as permissive for all to authenticated using (( SELECT is_admin() AS is_admin)) with check (( SELECT is_admin() AS is_admin));
create policy processing_jobs_admin_delete on public.processing_jobs as permissive for delete to authenticated using (( SELECT is_editor() AS is_editor));
create policy processing_jobs_admin_insert on public.processing_jobs as permissive for insert to authenticated with check (( SELECT is_editor() AS is_editor));
create policy processing_jobs_admin_update on public.processing_jobs as permissive for update to authenticated using (( SELECT is_editor() AS is_editor)) with check (( SELECT is_editor() AS is_editor));
create policy processing_jobs_select on public.processing_jobs as permissive for select to authenticated using (true);
create policy procurement_processes_read on public.procurement_processes as permissive for select to authenticated using (true);
create policy procurement_processes_write on public.procurement_processes as permissive for all to authenticated using (((owner_id = auth.uid()) OR is_expediente_colaborador())) with check (((owner_id = auth.uid()) OR is_expediente_colaborador()));
create policy profiles_admin_update on public.profiles as permissive for update to authenticated using (( SELECT is_admin() AS is_admin)) with check (( SELECT is_admin() AS is_admin));
create policy profiles_select on public.profiles as permissive for select to authenticated using (((id = ( SELECT auth.uid() AS uid)) OR ( SELECT is_admin() AS is_admin)));
create policy ant_usuario_delete on public.respuesta_antecedentes as permissive for delete to authenticated using (((created_by = auth.uid()) OR ((auth.jwt() ->> 'role'::text) = 'admin'::text)));
create policy ant_usuario_insert on public.respuesta_antecedentes as permissive for insert to authenticated with check ((created_by = auth.uid()));
create policy ant_usuario_select on public.respuesta_antecedentes as permissive for select to authenticated using (((created_by = auth.uid()) OR ((auth.jwt() ->> 'role'::text) = 'admin'::text) OR ((auth.jwt() ->> 'role'::text) = 'dec'::text)));
create policy respuesta_feedback_scoped_delete on public.respuesta_feedback as permissive for delete to authenticated using ((is_admin() OR (created_by = auth.uid())));
create policy respuesta_feedback_scoped_insert on public.respuesta_feedback as permissive for insert to authenticated with check ((is_editor() AND (created_by = auth.uid())));
create policy respuesta_feedback_scoped_select on public.respuesta_feedback as permissive for select to authenticated using ((is_admin() OR (created_by = auth.uid()) OR (archivo_es_jefe() AND (oficina_id IS NOT NULL) AND (oficina_id = archivo_oficina_id()))));
create policy riesgo_necesidad_read on public.riesgo_necesidad as permissive for select to authenticated using (true);
create policy riesgo_necesidad_write on public.riesgo_necesidad as permissive for all to authenticated using ((is_expediente_colaborador() OR (EXISTS ( SELECT 1
   FROM necesidades n
  WHERE ((n.id = riesgo_necesidad.necesidad_id) AND (n.owner_id = auth.uid())))))) with check ((is_expediente_colaborador() OR (EXISTS ( SELECT 1
   FROM necesidades n
  WHERE ((n.id = riesgo_necesidad.necesidad_id) AND (n.owner_id = auth.uid()))))));
create policy seguimientos_owner on public.seguimientos as permissive for all to authenticated using ((owner_id = ( SELECT auth.uid() AS uid))) with check ((owner_id = ( SELECT auth.uid() AS uid)));

-- ── Índice único de DNI (el que faltaba por aplicar en el proyecto viejo) ──────
create unique index if not exists profiles_dni_unique
  on public.profiles (dni)
  where dni is not null and dni <> '';

-- ══ Storage ══
-- El bucket de PDFs. La app accede SIEMPRE con la service_role (salta RLS), así
-- que NO hay políticas de storage.objects que replicar (el proyecto viejo tiene
-- cero). Privado, tope 100 MB, solo application/pdf. Debe coincidir con la
-- variable de entorno SUPABASE_STORAGE_BUCKET.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 104857600, array['application/pdf'])
on conflict (id) do nothing;
