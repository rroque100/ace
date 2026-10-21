-- FORMA DE PAGO (Art. 67 de la Ley) y RECEPCION Y CONFORMIDAD (Art. 144 del
-- Reglamento) en la ficha de necesidad.
--
-- Apartado que la entidad exige y que NO está en los PDF-modelo cargados. Su
-- texto lo fija la Ley y solo tiene cinco huecos, así que se guardan los cinco
-- huecos por separado MÁS el texto ya compuesto:
--
--   * los huecos permiten rehacer el apartado cuando cambia un dato, sin que
--     nadie tenga que reescribir los párrafos legales a mano;
--   * el texto compuesto es lo que viaja al Word y lo que se firma, así que se
--     conserva tal cual se aprobó aunque la plantilla cambie después.
--
-- Ejecutar en el SQL Editor de Supabase. Hasta entonces los seis campos no
-- existen y la ficha fallará al guardarlos.

alter table public.necesidades
  add column if not exists forma_pago text,
  add column if not exists forma_pago_tipo text,
  add column if not exists forma_pago_area_conformidad text,
  add column if not exists forma_pago_documentacion text,
  add column if not exists forma_pago_lugar text,
  add column if not exists forma_pago_direccion text,
  -- Huecos del apartado del Art. 144. Cada objeto usa los suyos: en BIENES hay
  -- dos actos —recepcion de almacen y conformidad del area usuaria— y en
  -- SERVICIOS solo conformidad, con el plazo de subsanacion como hueco.
  add column if not exists recepcion_area text,
  add column if not exists conformidad_area text,
  add column if not exists conformidad_plazo text,
  add column if not exists conformidad_plazo_subsanacion text;

comment on column public.necesidades.forma_pago is
  'Texto completo del apartado FORMA DE PAGO que va al requerimiento (Art. 67 de la Ley). Se compone desde los cinco campos forma_pago_*.';
comment on column public.necesidades.forma_pago_tipo is
  'Pago único o pagos a cuenta, con su detalle.';
comment on column public.necesidades.forma_pago_area_conformidad is
  'Área responsable de otorgar la conformidad de la prestación.';
comment on column public.necesidades.forma_pago_documentacion is
  'Otra documentación exigible para el pago, además de la conformidad y el comprobante.';
comment on column public.necesidades.forma_pago_lugar is
  'Mesa de partes o dependencia donde el contratista presenta la documentación.';
comment on column public.necesidades.forma_pago_direccion is
  'Dirección exacta de esa dependencia.';

comment on column public.necesidades.recepcion_area is
  'Area o unidad de almacen que efectua la recepcion. Solo bienes (Art. 144).';
comment on column public.necesidades.conformidad_area is
  'Area que otorga la conformidad de la prestacion (Art. 144).';
comment on column public.necesidades.conformidad_plazo is
  'Plazo maximo para la conformidad: siete dias, o veinte si se requieren pruebas.';
comment on column public.necesidades.conformidad_plazo_subsanacion is
  'Plazo para subsanar observaciones, no mayor al 30% del plazo del entregable. Solo servicios: en bienes esa cifra va fija en el texto.';
