-- Infraestructura estrategica (Art. 72.3.b, C.3) en los requisitos de calificacion.
--
-- Dos columnas de texto: el requisito (que infraestructura estrategica se exige)
-- y su acreditacion. Como el equipamiento estrategico: texto libre con su hueco.
--
-- La tabla esta particionada por anio; el ALTER TABLE sobre la tabla padre
-- alcanza las particiones, igual que las tandas anteriores.
alter table public.necesidades
  add column if not exists infraestructura_estrategica text,
  add column if not exists infraestructura_estrategica_acreditacion text;

comment on column public.necesidades.infraestructura_estrategica is
  'Requisito de infraestructura estrategica (Art. 72.3.b, C.3).';
comment on column public.necesidades.infraestructura_estrategica_acreditacion is
  'Texto estandar de como se acredita la infraestructura estrategica.';
