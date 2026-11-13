-- Perfil de caso activo del Centro Jurídico, guardado EN LA CUENTA del usuario.
--
-- Antes el perfil vivía solo en localStorage (lib/case-profile.ts): al abrir ACE en otro
-- dispositivo o navegador, el régimen/objeto/fechas del caso activo no estaban y había que
-- reescribirlos. Esta tabla los sincroniza por cuenta; el localStorage queda como copia
-- local y respaldo cuando la sincronización no está disponible.
--
-- Migración MANUAL (ver CLAUDE.md): ejecutar en el SQL Editor de Supabase. Mientras no se
-- ejecute, la ruta /api/case-profile responde que la sincronización no está disponible y el
-- chat sigue funcionando con el perfil local: nada se rompe.
--
-- Datos guardados: solo lo común entre preguntas del caso (régimen, fechas, objeto). Los
-- HECHOS no se guardan nunca (ver lib/case-profile.ts). Una fila por usuario.
--
-- Acceso: RLS total, solo el dueño. Sin políticas públicas ni de servicio.

CREATE TABLE IF NOT EXISTS public.case_profiles (
  owner_id uuid PRIMARY KEY,
  regime text NOT NULL DEFAULT '',
  dates text NOT NULL DEFAULT '',
  object text NOT NULL DEFAULT '',
  -- Cuándo guardó el usuario el perfil por última vez (milisegundos epoch, igual que el
  -- localStorage): decide cuál prevalece al sincronizar dos dispositivos.
  saved_at bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.case_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS case_profiles_privado ON public.case_profiles;
CREATE POLICY case_profiles_privado ON public.case_profiles
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);
