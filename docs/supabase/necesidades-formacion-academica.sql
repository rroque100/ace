-- Calificaciones del personal clave · FORMACIÓN ACADÉMICA (Art. 72.3.b, C.2.1),
-- dentro de la «Experiencia del postor en la especialidad» (sección 3.5.1).
--
-- Requisito con dos huecos —grado/título y puesto—; el texto se compone con
-- ellos (lib/formacion-academica.ts) y se guarda ya redactado en esta columna.
-- El editor relee los dos huecos del propio texto al reabrir.
--
-- Ejecutar en el SQL Editor de Supabase. Hasta entonces la columna no existe y
-- la ficha fallará al guardarla.

alter table public.necesidades
  add column if not exists formacion_academica text,
  add column if not exists formacion_academica_acreditacion text;

comment on column public.necesidades.formacion_academica is
  'Requisito de formacion academica del personal clave (Art. 72.3.b, C.2.1): grado/titulo + puesto, ya redactado.';
comment on column public.necesidades.formacion_academica_acreditacion is
  'Texto estandar de como se acredita la formacion academica (Anexo N° 19, SUNEDU/MINEDU).';
