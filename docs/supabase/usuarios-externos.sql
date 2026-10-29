-- Usuarios externos: acceso por módulo, auditoría de uso y consumo de IA.
--
-- Una persona externa (un asesor, un alumno) entra solo a una parte de ACE —el Centro Jurídico, el simulacro de
-- examen o ambos— y su actividad queda registrada: desde qué IP entra, qué hace y cuánta IA consume en cada módulo.
--
-- Esto es una migración MANUAL: se ejecuta una vez en el SQL Editor de Supabase (ver CLAUDE.md). Mientras no se
-- ejecute, el sistema sigue funcionando: la lista y el alta de externos avisan de que falta este SQL, y el registro
-- de auditoría y de IA se omite en silencio con un aviso en el log del servidor (no se rompe ninguna página).
--
-- Quién puede qué:
--   · La fuente de verdad del acceso es `app_metadata` del token de Supabase Auth (tipo, modulos, vigente_hasta,
--     cuota_ia_mensual). Solo el servidor puede escribirla; la persona no puede cambiarla. Las columnas de
--     `profiles` de abajo son un ESPEJO para listar y filtrar sin llamar a la API de Auth.
--   · Las dos tablas nuevas se escriben y se leen SOLO con la clave de servicio (RLS activada y sin políticas: ni
--     siquiera el propio usuario ve su rastro).
--
-- Retención: la IP es un dato personal (Ley N.° 29733). Los eventos se conservan 12 meses; ver el final de este
-- fichero y scripts/purgar-auditoria-externos.mts.

-- 1. Espejo del acceso externo en el perfil ----------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'interno',
  ADD COLUMN IF NOT EXISTS modulos text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS vigente_hasta timestamptz,
  ADD COLUMN IF NOT EXISTS cuota_ia_mensual bigint;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_tipo_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_tipo_check CHECK (tipo IN ('interno', 'externo'));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_modulos_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_modulos_check CHECK (modulos <@ ARRAY['centro_juridico', 'simulacro']::text[]);

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_cuota_ia_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_cuota_ia_check CHECK (cuota_ia_mensual IS NULL OR cuota_ia_mensual >= 0);

CREATE INDEX IF NOT EXISTS profiles_tipo_idx ON public.profiles (tipo) WHERE tipo = 'externo';

-- 2. Qué hace cada cuenta externa ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.acceso_eventos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creado_en timestamptz NOT NULL DEFAULT now(),
  usuario_id uuid NOT NULL,
  -- El usuario de 8 dígitos (o el correo) en el momento del evento: sobrevive aunque se borre la cuenta.
  usuario text,
  modulo text,
  -- «ver /chat», «api POST /api/chat», «login», «logout», «acceso denegado /configuracion», «acceso vencido»…
  accion text NOT NULL,
  ruta text,
  metodo text,
  estado integer,
  ip text,
  user_agent text
);

CREATE INDEX IF NOT EXISTS acceso_eventos_usuario_idx ON public.acceso_eventos (usuario_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS acceso_eventos_creado_idx ON public.acceso_eventos (creado_en DESC);
CREATE INDEX IF NOT EXISTS acceso_eventos_ip_idx ON public.acceso_eventos (ip, creado_en DESC);

ALTER TABLE public.acceso_eventos ENABLE ROW LEVEL SECURITY;

-- 3. Cuánta IA consume cada cuenta, por módulo -----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.uso_ia (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creado_en timestamptz NOT NULL DEFAULT now(),
  usuario_id uuid,
  -- Se registra el consumo de TODAS las cuentas (el costo de IA es de la entidad), no solo el de las externas.
  tipo_usuario text,
  modulo text,
  -- chat | embedding | ocr | asistente | voz | otro
  operacion text NOT NULL,
  proveedor text,
  modelo text,
  tokens_entrada integer NOT NULL DEFAULT 0,
  tokens_salida integer NOT NULL DEFAULT 0,
  -- true cuando el proveedor no devolvió el uso y se estimó por la longitud del texto.
  estimado boolean NOT NULL DEFAULT false,
  -- Costo en dólares según la tarifa configurada (lib/uso-ia-precios.ts). Es una ESTIMACIÓN, no una factura.
  costo_estimado numeric(12, 6) NOT NULL DEFAULT 0
);

-- La cuota mensual suma por usuario y mes: este índice la hace barata.
CREATE INDEX IF NOT EXISTS uso_ia_usuario_idx ON public.uso_ia (usuario_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS uso_ia_creado_idx ON public.uso_ia (creado_en DESC);

ALTER TABLE public.uso_ia ENABLE ROW LEVEL SECURITY;

-- 3 bis. Cuentas que se registran por su cuenta quedan SIN acceso -----------------------------------------------
--
-- El formulario de entrada ofrecía «Registrarse» y Supabase tiene el registro abierto (disable_signup = false):
-- cualquiera con un correo podía crearse una cuenta con rol `consulta` y gastar IA. El formulario ya no ofrece
-- registrarse, pero la API de Auth sigue aceptándolo mientras el registro esté abierto. Este disparador lo neutraliza:
-- una cuenta que llega SIN `app_metadata.tipo` (las del administrador siempre lo llevan: interno o externo) se marca
-- como externa SIN módulos, y el proxy no le abre nada. Solo actúa en altas nuevas; no toca a nadie que ya exista.
--
-- Además, desactiva el registro abierto en el panel de Supabase: Authentication → Sign In / Providers → «Allow new
-- users to sign up» = desactivado. Las cuentas que crea el administrador con la clave de servicio no se ven afectadas.
--
-- OJO con el arranque: el primer usuario ya NO nace administrador por registrarse. Si alguna vez hay que crear al primer
-- administrador, hay que hacerlo desde el panel de Supabase (Authentication → Users → Add user) con `app_metadata`
-- {"tipo": "interno"} o con scripts/listar-usuarios.mts / la API de administración.

CREATE OR REPLACE FUNCTION public.marcar_alta_sin_acceso()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO public
AS $function$
begin
  if new.raw_app_meta_data is null or not (new.raw_app_meta_data ? tipo) then
    new.raw_app_meta_data := coalesce(new.raw_app_meta_data, {}::jsonb)
      || jsonb_build_object(tipo, externo, modulos, []::jsonb);
  end if;
  return new;
end;
$function$;

DROP TRIGGER IF EXISTS marcar_alta_sin_acceso ON auth.users;
CREATE TRIGGER marcar_alta_sin_acceso
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.marcar_alta_sin_acceso();

-- Comprobación: tras ejecutarlo, una alta sin app_metadata debe quedar como externa sin módulos:
--
--   SELECT raw_app_meta_data FROM auth.users ORDER BY created_at DESC LIMIT 3;

-- 4. Comprobación ------------------------------------------------------------------------------------------------
--
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'profiles' AND column_name IN ('tipo', 'modulos', 'vigente_hasta', 'cuota_ia_mensual');
--   -- debe devolver 4 filas
--
--   SELECT count(*) FROM public.acceso_eventos;   -- 0 al principio
--   SELECT count(*) FROM public.uso_ia;           -- 0 al principio
--
-- 5. Retención (12 meses) ----------------------------------------------------------------------------------------
--
-- Ejecutar a mano de vez en cuando, o programarlo con pg_cron si la extensión está activa:
--
--   DELETE FROM public.acceso_eventos WHERE creado_en < now() - interval '12 months';
--
-- El consumo de IA (uso_ia) no contiene IP y no se purga: es contabilidad de costos.
