-- Solicitudes de acceso de personas externas.
--
-- Una persona sin cuenta rellena el formulario público /acceso (módulo que necesita y para qué). Eso NO crea ninguna cuenta:
-- deja una fila «pendiente» aquí. El administrador la ve en Configuración → Usuarios externos y la aprueba (se crea la cuenta
-- con los módulos, la vigencia y la cuota que él decida) o la rechaza. El registro abierto de Supabase sigue desactivado.
--
-- Migración MANUAL (ver CLAUDE.md): se ejecuta una vez en el SQL Editor de Supabase. Mientras no se ejecute, el formulario
-- público responde que las solicitudes no están disponibles y el panel del administrador avisa de que falta este SQL; no
-- se rompe ninguna otra pantalla.
--
-- Quién puede qué: la tabla se lee y se escribe SOLO con la clave de servicio (RLS activada y sin políticas). El formulario
-- público no toca la base: lo hace la ruta del servidor tras validar, limitar por IP y descartar los envíos automáticos.
--
-- Retención: guarda datos personales (nombre, DNI, correo, celular) y la IP. Se conservan 12 meses desde que se resuelve
-- (Ley N.° 29733); ver el final de este fichero y scripts/purgar-auditoria-externos.mts.

CREATE TABLE IF NOT EXISTS public.solicitudes_acceso (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creado_en timestamptz NOT NULL DEFAULT now(),
  nombre text NOT NULL,
  dni text NOT NULL,
  correo text NOT NULL,
  celular text,
  institucion text,
  modulos text[] NOT NULL DEFAULT '{}',
  motivo text NOT NULL,
  estado text NOT NULL DEFAULT 'pendiente',
  -- Quién la resolvió y cuándo; la cuenta que salió de aprobarla; y por qué se rechazó (se le puede decir a la persona).
  resuelta_por uuid,
  resuelta_en timestamptz,
  usuario_id uuid,
  motivo_rechazo text,
  -- Para limitar el abuso del formulario público. La IP es un dato personal.
  ip text,
  user_agent text
);

ALTER TABLE public.solicitudes_acceso DROP CONSTRAINT IF EXISTS solicitudes_acceso_estado_check;
ALTER TABLE public.solicitudes_acceso
  ADD CONSTRAINT solicitudes_acceso_estado_check CHECK (estado IN ('pendiente', 'aprobada', 'rechazada'));

ALTER TABLE public.solicitudes_acceso DROP CONSTRAINT IF EXISTS solicitudes_acceso_modulos_check;
ALTER TABLE public.solicitudes_acceso
  ADD CONSTRAINT solicitudes_acceso_modulos_check CHECK (modulos <@ ARRAY['centro_juridico', 'simulacro']::text[]);

ALTER TABLE public.solicitudes_acceso DROP CONSTRAINT IF EXISTS solicitudes_acceso_dni_check;
ALTER TABLE public.solicitudes_acceso
  ADD CONSTRAINT solicitudes_acceso_dni_check CHECK (dni ~ '^[0-9]{8}$');

-- Una sola solicitud pendiente por DNI: reenviar el formulario no llena la bandeja.
CREATE UNIQUE INDEX IF NOT EXISTS solicitudes_acceso_dni_pendiente_idx
  ON public.solicitudes_acceso (dni) WHERE estado = 'pendiente';

CREATE INDEX IF NOT EXISTS solicitudes_acceso_estado_idx ON public.solicitudes_acceso (estado, creado_en DESC);
-- El límite por IP cuenta las solicitudes de la última hora.
CREATE INDEX IF NOT EXISTS solicitudes_acceso_ip_idx ON public.solicitudes_acceso (ip, creado_en DESC);

ALTER TABLE public.solicitudes_acceso ENABLE ROW LEVEL SECURITY;

-- Comprobación: debe devolver 0 al principio.
--
--   SELECT count(*) FROM public.solicitudes_acceso;

-- Retención (12 meses desde que se resolvió). A mano, o programado con pg_cron:
--
--   DELETE FROM public.solicitudes_acceso
--    WHERE estado <> 'pendiente' AND resuelta_en < now() - interval '12 months';
