-- ============================================================================
-- PERSONAL · Padrón de servidores de la entidad, cargado desde el .xls del SIGA
-- (personal.XLS: "empleado", apellidos, nombres, docum_ident, centro de costo…).
--
-- Es un DIRECTORIO de referencia, no cuentas de acceso: aquí están TODAS las
-- personas de la entidad —tengan o no login— para poder ELEGIRLAS al designar
-- evaluadores (A6), nombrar al responsable del área usuaria en la necesidad, o
-- firmar respuestas del archivo, sin teclear a mano nombre + DNI + cargo. Las
-- cuentas del sistema siguen viviendo en `profiles` (una por persona que entra);
-- este padrón es mucho más grande y no da acceso a nada.
--
-- Por eso NO se particiona por año: la plantilla no cambia de un ejercicio a
-- otro (a diferencia de expedientes/necesidades). Se recarga entero cuando RR.HH.
-- exporta un nuevo .xls.
--
-- Clave de negocio: `codigo` (el "empleado" del SIGA), único y presente en todas
-- las filas; el DNI (`documento`) puede faltar en algún registro, así que la
-- reconciliación al reimportar es por `codigo`, no por DNI.
--
-- RLS: lo LEE cualquier autenticado (hace falta para elegir personas desde
-- Necesidades/Expedientes); solo lo ESCRIBE un admin. La carga real la hace la
-- ruta de importación con service_role (salta RLS); la política de escritura es
-- el segundo cinturón por si algún día se escribe con el JWT del usuario.
--
-- Ejecución MANUAL en el SQL Editor de Supabase. Idempotente.
-- ============================================================================

create table if not exists public.personal (
  id uuid primary key default gen_random_uuid(),
  -- "empleado" del SIGA: la clave estable con la que se reconcilia al reimportar.
  codigo text not null,
  documento text,                       -- docum_ident (DNI, normalmente 8 dígitos)
  apellido_paterno text,
  apellido_materno text,
  nombres text,
  -- "NOMBRES PATERNO MATERNO" (orden natural): se precalcula al importar para
  -- buscar y firmar sin recomponerlo en cada consulta.
  nombre_completo text,
  tipo_empleado text,                   -- F/I/N/S/E (tipo de vínculo laboral)
  estado text,                          -- A = activo, I = inactivo
  estado_civil text,
  sexo text,
  grado_inst text,                      -- grado de instrucción (T/B/O…)
  centro_costo text,                    -- código del centro de costo
  unidad text,                          -- nombre_cc: sigla de la unidad (OSLIJ, OTI…)
  codigo_prof text,
  profesion text,                       -- nombre_prof
  colegiatura text,                     -- nro_colegiatura
  fecha_ingreso text,
  actualizado_en timestamptz not null default now()
);

-- `codigo` único: soporta el upsert por on_conflict=codigo de la reimportación.
create unique index if not exists idx_personal_codigo on public.personal(codigo);
create index if not exists idx_personal_documento on public.personal(documento);
-- Búsqueda por nombre desde el selector de personas.
create index if not exists idx_personal_nombre on public.personal(nombre_completo);

alter table public.personal enable row level security;

drop policy if exists personal_read on public.personal;
create policy personal_read on public.personal
  for select to authenticated using (true);

drop policy if exists personal_write on public.personal;
create policy personal_write on public.personal
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.personal to authenticated;
