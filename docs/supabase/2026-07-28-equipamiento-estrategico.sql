-- Equipamiento estrategico (Art. 72.3.b, C.3) en los requisitos de calificacion.
--
-- Dos columnas de texto: el requisito (que equipamiento estrategico se exige) y
-- su acreditacion. No es cuadro: es texto libre, con su hueco entre corchetes.
--
-- La tabla esta particionada por anio; el ALTER TABLE sobre la tabla padre
-- alcanza las particiones, igual que las tandas anteriores.
alter table public.necesidades
  add column if not exists equipamiento_estrategico text,
  add column if not exists equipamiento_estrategico_acreditacion text;

comment on column public.necesidades.equipamiento_estrategico is
  'Requisito de equipamiento estrategico (Art. 72.3.b, C.3).';
comment on column public.necesidades.equipamiento_estrategico_acreditacion is
  'Texto estandar de como se acredita el equipamiento estrategico.';
