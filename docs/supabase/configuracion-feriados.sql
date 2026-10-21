-- Calendario laboral de la entidad: lista de feriados para el cálculo de plazos.
--
-- Se registra en Configuración › Sistema › Feriados y lo consume la calculadora
-- de plazos administrativos (p. ej. subsanación de ofertas, consultas a la
-- DEC, presentación de requerimientos). Antes vivía solo en memoria del cliente
-- y se perdía entre sesiones.
--
-- Es un jsonb (no una tabla aparte) porque la lista es única para toda la
-- entidad, baja cardinalidad (decenas de filas al año) y se lee entera en cada
-- cálculo: normalizar como tabla would añadir joins sin aportar. El formato lo
-- normaliza `parseFeriados` de `lib/feriados.ts` (`{ fecha: 'YYYY-MM-DD', nombre }`).
--
-- Idempotente: se puede ejecutar varias veces sin efecto.

alter table public.entity_settings
  add column if not exists feriados jsonb default '[]'::jsonb;

comment on column public.entity_settings.feriados is
  'Calendario laboral de la entidad. Array de {fecha, nombre} en YYYY-MM-DD. Lo normaliza parseFeriados de lib/feriados.ts.';
