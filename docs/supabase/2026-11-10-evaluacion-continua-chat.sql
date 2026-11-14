-- Evaluación continua automática de la calidad del chat jurídico.
--
-- Ya existían los CASOS de referencia revisados por personas (legal_quality_cases) y las
-- valoraciones humanas por respuesta (legal_quality_runs), pero nada VOLVÍA A CORRER los
-- casos revisados contra el pipeline real en producción: las regresiones (una consulta
-- que dejaba de recuperar su fuente, un proveedor que empezaba a inventar citas) solo
-- aparecían si alguien evaluaba a mano. Esta tabla guarda cada pasada automática.
--
-- La corre `POST /api/chat/quality/auto` (perfil jurídico/admin a mano, o el cron diario
-- netlify/functions/calidad-juridica.mjs con CRON_SECRET). Cada pasada usa
-- answerLegalQuestion con persist:false: no crea conversaciones ni mensajes de usuario,
-- solo lee el corpus y llama a los proveedores. Indicadores deterministas: cobertura de
-- fuentes esperadas, fidelidad de citas (lib/citation-faithfulness.ts), grounding y uso
-- del fallback. NO acredita corrección jurídica: la revisión humana sigue existiendo.
--
-- Migración MANUAL (ver CLAUDE.md). Sin ejecutar: la ruta responde que la evaluación
-- continua no está disponible y el panel lo indica; nada más se rompe.
--
-- Acceso: lectura y escritura para perfiles jurídico y administrador; el cron escribe
-- con la clave de servicio (RLS no la filtra, es el sistema actuando como tal).

CREATE TABLE IF NOT EXISTS public.legal_quality_auto_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamptz NOT NULL DEFAULT now(),
  -- Caso revisado que la disparó; suelto si el caso se borra (el registro de la pasada sobrevive).
  case_id uuid REFERENCES public.legal_quality_cases(id) ON DELETE SET NULL,
  question text NOT NULL,
  model text,
  provider text,
  confidence text,
  presentation text,
  source_count int NOT NULL DEFAULT 0,
  indicators jsonb NOT NULL DEFAULT '{}'::jsonb,
  failures jsonb NOT NULL DEFAULT '[]'::jsonb,
  response_excerpt text,
  regression boolean NOT NULL DEFAULT false,
  -- 'cron' cuando la disparó la programación; 'manual' cuando la corrió una persona.
  trigger text NOT NULL DEFAULT 'manual'
);

ALTER TABLE public.legal_quality_auto_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS legal_quality_auto_juridicos ON public.legal_quality_auto_runs;
CREATE POLICY legal_quality_auto_juridicos ON public.legal_quality_auto_runs
  FOR ALL TO authenticated
  USING (
    (select role from public.profiles where profiles.id = auth.uid()) in ('legal', 'admin')
  )
  WITH CHECK (
    (select role from public.profiles where profiles.id = auth.uid()) in ('legal', 'admin')
  );

CREATE INDEX IF NOT EXISTS legal_quality_auto_runs_ran_at ON public.legal_quality_auto_runs (ran_at DESC);
