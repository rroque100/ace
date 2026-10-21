-- Experiencia del personal clave (Art. 72.3.b · capacidad técnica y profesional),
-- dentro de la «Experiencia del postor en la especialidad» (sección 3.5.1).
--
-- Es una LISTA de puestos —cada uno con su tiempo de experiencia mínimo, la
-- actividad en que se exige y el cargo—, así que se guarda serializada en UNA
-- columna de texto (lib/personal-clave.ts), como «otras penalidades». El editor
-- compone al escribir y vuelve a leer al abrir; en el Word sale como cuadro.
--
-- Ejecutar en el SQL Editor de Supabase. Hasta entonces la columna no existe y
-- la ficha fallará al guardarla.

alter table public.necesidades
  add column if not exists personal_clave_experiencia text,
  add column if not exists personal_clave_acreditacion text;

comment on column public.necesidades.personal_clave_experiencia is
  'Cuadro de experiencia del personal clave (Art. 72.3.b), serializado: una fila por puesto (tiempo, actividad, cargo).';
comment on column public.necesidades.personal_clave_acreditacion is
  'Texto estandar de como se acredita la experiencia del personal clave (Anexo N° 19).';
