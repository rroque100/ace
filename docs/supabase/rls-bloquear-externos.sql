-- Cierra en la BASE DE DATOS lo que el proxy de la app solo cierra en las rutas: que una cuenta EXTERNA lea o escriba los
-- datos del personal de la entidad.
--
-- ── El problema ──────────────────────────────────────────────────────────────────────────────────────────────────────
-- Una cuenta externa es un usuario autenticado de Supabase con su propio token, y la clave `anon` y la sesión viajan al
-- navegador. Con ellas puede llamar a `https://<proyecto>.supabase.co/rest/v1/<tabla>` SIN pasar por la app, y el proxy
-- (lib/supabase/middleware.ts) no ve esas llamadas. Lo único que la frena es la RLS, y estas tablas tienen una política de
-- lectura `to authenticated using (true)` (comprobado en producción con pg_policies el 2026-10-30):
--
--   necesidades y sus 5 tablas hijas · procurement_processes · process_documents/evaluations/risks/cotizaciones ·
--   riesgo_necesidad · personal (DNI, estado civil, sexo, colegiatura, ingreso de ~800 trabajadores) ·
--   expedientes_oficinas · expedientes_doc_counters · archivo_documentos/chunks · boletin_eventos · eval_* ·
--   processing_jobs · cmn_pia_2027 (esta, además, legible SIN sesión: `anon`).
--
-- Antes de cerrar el registro abierto de Supabase, cualquier persona con un correo podía registrarse y llegar a lo mismo.
--
-- ── La corrección ────────────────────────────────────────────────────────────────────────────────────────────────────
-- Políticas RESTRICTIVAS: se suman (AND) a las que ya existen, así que no hace falta conocer ni tocar sus nombres, y no
-- abren nada que no estuviera abierto. Solo añaden «y no es una cuenta externa». Las cuentas se identifican por
-- `app_metadata.tipo = 'externo'` del token, que solo escribe el servidor (la persona no puede cambiarlo).
--
-- Quedan FUERA a propósito las tablas que las cuentas externas necesitan para el Centro Jurídico y el simulador: el corpus
-- (documents, document_chunks, document_summaries, norma_articulos, norma_concordancias, normativa_adjuntos), el chat
-- (chat_*, ai_feedback_examples) y los exámenes (exam_*). tests/rls-externos.test.ts impide que se cuelen aquí por error.
--
-- El servidor con la clave de servicio (supabaseRest) no pasa por RLS: nada de lo que hace la app cambia.
--
-- Migración MANUAL (ver CLAUDE.md): ejecutar UNA vez en el SQL Editor de Supabase de producción. Es idempotente: se puede
-- volver a ejecutar. Al final hay una comprobación que simula una cuenta externa y el modo de deshacerlo.
--
-- Efecto: una cuenta externa ya con sesión abierta lo nota en su próxima renovación de token (hasta 1 h). Para el personal
-- de la entidad no cambia nada.

-- 1. ¿Es una cuenta externa? ---------------------------------------------------------------------------------------------

create or replace function public.es_cuenta_externa()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'tipo', '') = 'externo';
$$;

grant execute on function public.es_cuenta_externa() to anon, authenticated;

-- 2. Una política restrictiva por tabla del personal de la entidad ------------------------------------------------------

do $$
declare
  tabla text;
  tablas text[] := array[
    -- Necesidades
    'necesidades', 'necesidad_admisibilidad', 'necesidad_documentos', 'necesidad_items', 'necesidad_observaciones',
    'necesidad_versiones', 'riesgo_necesidad', 'necesidades_requisitos_legacy_backup', 'necesidades_sustento_legacy_backup',
    -- Expedientes
    'procurement_processes', 'process_documents', 'process_evaluations', 'process_risks', 'process_cotizaciones',
    'process_type_settings', 'pedidos_siga',
    -- Contratos y archivo de expedientes
    'contratos_cp', 'contratos_sie', 'expedientes_oficinas', 'expedientes_doc_counters', 'expedientes_archivo',
    'expedientes_archivo_chunks', 'expedientes_ocr_cache', 'expedientes_respuestas', 'respuesta_antecedentes',
    'respuesta_feedback',
    -- Archivo municipal, padrón y operación interna
    'archivo_documentos', 'archivo_chunks', 'personal', 'boletin_eventos', 'processing_jobs', 'entity_settings',
    'audit_logs', 'eval_corridas', 'eval_preguntas', 'eval_resultados', 'document_analyses', 'normative_comparisons',
    'carpetas', 'guardados', 'seguimientos'
  ];
begin
  foreach tabla in array tablas loop
    if to_regclass('public.' || tabla) is null then
      raise notice 'Se omite %: la tabla no existe en este proyecto.', tabla;
      continue;
    end if;
    execute format('alter table public.%I enable row level security', tabla);
    execute format('drop policy if exists bloquear_externos on public.%I', tabla);
    execute format(
      'create policy bloquear_externos on public.%I as restrictive for all to authenticated '
      || 'using (not public.es_cuenta_externa()) with check (not public.es_cuenta_externa())',
      tabla
    );
  end loop;
end
$$;

-- 3. cmn_pia_2027: legible por cualquiera, hasta sin sesión --------------------------------------------------------------
-- Tiene una política `to anon, authenticated using (true)`. Hoy está vacía y ningún código la usa; se cierra igual para que
-- no quede pública el día que se llene. Si alguna vez debe ser pública, borrar esta política.

do $$
begin
  if to_regclass('public.cmn_pia_2027') is null then
    raise notice 'Se omite cmn_pia_2027: la tabla no existe en este proyecto.';
    return;
  end if;
  alter table public.cmn_pia_2027 enable row level security;
  drop policy if exists solo_personal_autenticado on public.cmn_pia_2027;
  create policy solo_personal_autenticado on public.cmn_pia_2027 as restrictive for all to anon, authenticated
    using (auth.uid() is not null and not public.es_cuenta_externa())
    with check (auth.uid() is not null and not public.es_cuenta_externa());
end
$$;

-- 4. personal: solo quien lo usa -----------------------------------------------------------------------------------------
-- El padrón (DNI, estado civil, sexo, colegiatura…) lo consultan el buscador de personas de Necesidades y Expedientes y la
-- pantalla de Configuración. Las cuentas internas con rol `consulta` (solo chat y búsqueda) no lo necesitan y hoy podían
-- leerlo entero. Colaboradores y administradores siguen igual.

do $$
begin
  if to_regclass('public.personal') is null then
    raise notice 'Se omite personal: la tabla no existe en este proyecto.';
    return;
  end if;
  drop policy if exists personal_solo_colaboradores on public.personal;
  create policy personal_solo_colaboradores on public.personal as restrictive for select to authenticated
    using (public.is_expediente_colaborador() or public.is_admin());
end
$$;

-- 5. Comprobación ---------------------------------------------------------------------------------------------------------
-- Simula una cuenta externa (sin salir del editor, y sin dejar nada: termina en rollback). Cada línea debe dar 0.
--
--   begin;
--   set local role authenticated;
--   select set_config('request.jwt.claims',
--     '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"tipo":"externo"}}', true);
--   select 'necesidades' as tabla, count(*) from public.necesidades
--   union all select 'procurement_processes', count(*) from public.procurement_processes
--   union all select 'personal', count(*) from public.personal
--   union all select 'expedientes_oficinas', count(*) from public.expedientes_oficinas
--   union all select 'cmn_pia_2027', count(*) from public.cmn_pia_2027;
--   -- ...y lo que SÍ necesita debe seguir leyéndose (debe dar más de 0):
--   select 'documents' as tabla, count(*) from public.documents
--   union all select 'norma_articulos', count(*) from public.norma_articulos;
--   rollback;
--
-- Control con una cuenta del personal (cambiar el sub por el id de un administrador de `profiles`): necesidades y personal
-- deben dar más de 0.
--
--   begin;
--   set local role authenticated;
--   select set_config('request.jwt.claims',
--     '{"sub":"<ID-DE-UN-ADMIN>","role":"authenticated","app_metadata":{"tipo":"interno"}}', true);
--   select count(*) from public.necesidades;
--   select count(*) from public.personal;
--   rollback;
--
-- Estado de las políticas después de aplicar:
--
--   select tablename, policyname, permissive, cmd from pg_policies
--    where policyname in ('bloquear_externos', 'solo_personal_autenticado', 'personal_solo_colaboradores')
--    order by tablename;

-- 6. Para deshacerlo ---------------------------------------------------------------------------------------------------------
--
--   do $$ declare p record; begin
--     for p in select schemaname, tablename, policyname from pg_policies
--              where policyname in ('bloquear_externos', 'solo_personal_autenticado', 'personal_solo_colaboradores')
--     loop execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename); end loop;
--   end $$;
--   drop function if exists public.es_cuenta_externa();
