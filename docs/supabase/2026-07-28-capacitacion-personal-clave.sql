-- Capacitacion del personal clave (Art. 72.3.b) en los requisitos de calificacion.
--
-- Dos columnas nuevas en `necesidades`: el cuadro serializado (una fila por
-- puesto: horas + materia + puesto) y su texto de acreditacion. Espeja lo que ya
-- existe para `formacion_academica`.
--
-- La tabla esta particionada por anio; el ALTER TABLE sobre la tabla padre
-- alcanza las particiones, igual que hizo la tanda de formacion academica.
alter table public.necesidades
  add column if not exists capacitacion_personal_clave text,
  add column if not exists capacitacion_personal_clave_acreditacion text;
