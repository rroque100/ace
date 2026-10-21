-- ============================================================================
-- RLS PARA respuesta_feedback — Defense-in-depth
-- ============================================================================
-- Modelo de acceso (mismo que expedientes_archivo y expedientes_respuestas):
--   * admin ............ ve todo.
--   * jefe de oficina .. ve lo de SU oficina.
--   * resto ............ SOLO lo que creo (created_by).
--
-- respuesta_feedback tiene RLS habilitado desde respuesta-feedback.sql pero
-- SIN politicas (deny-all para clientes directos). Estas politicas abren
-- acceso scoped para que, si en el futuro se migra de service_role a
-- supabaseUserRest, el RLS ya este listo.
--
-- Depende de las funciones helper de rls-archivo-por-usuario.sql:
--   public.is_admin(), public.archivo_es_jefe(), public.archivo_oficina_id()
--
-- Ejecutar DESPUES de rls-archivo-por-usuario.sql. Idempotente.
-- ============================================================================

-- Eliminar politicas previas (si existen) para que sea idempotente.
drop policy if exists respuesta_feedback_scoped_select on public.respuesta_feedback;
drop policy if exists respuesta_feedback_scoped_insert on public.respuesta_feedback;
drop policy if exists respuesta_feedback_scoped_delete on public.respuesta_feedback;

-- SELECT: autor, jefe de la misma oficina, o admin.
create policy respuesta_feedback_scoped_select on public.respuesta_feedback
  for select to authenticated
  using (
    public.is_admin()
    or created_by = auth.uid()
    or (
      public.archivo_es_jefe()
      and oficina_id is not null
      and oficina_id = public.archivo_oficina_id()
    )
  );

-- INSERT: cualquier editor/dec puede crear feedback propio.
create policy respuesta_feedback_scoped_insert on public.respuesta_feedback
  for insert to authenticated
  with check (
    public.is_editor()
    and created_by = auth.uid()
  );

-- DELETE: autor o admin (no jefes — el feedback es editable solo por quien
-- lo creo, para evitar que un jefe borre feedback util de otro miembro).
create policy respuesta_feedback_scoped_delete on public.respuesta_feedback
  for delete to authenticated
  using (
    public.is_admin()
    or created_by = auth.uid()
  );

-- ── Verificacion ────────────────────────────────────────────────────────────
-- select tablename, policyname from pg_policies
--  where schemaname='public' and tablename='respuesta_feedback'
--  order by 1, 2;
