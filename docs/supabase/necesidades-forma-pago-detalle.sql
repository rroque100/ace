-- El detalle de los pagos a cuenta (Art. 67 de la Ley).
--
-- La base estandar pide las dos cosas en el mismo corchete: «CONSIGNAR SI SE
-- TRATA DE PAGO UNICO O PAGOS A CUENTA, ASI COMO EL DETALLE QUE CORRESPONDE EN
-- EL CASO DE PAGO A CUENTA».
--
-- En la ficha son dos campos porque son dos cosas distintas: el TIPO se elige de
-- una lista de dos y el DETALLE se escribe. Al cerrar el tipo en un desplegable,
-- el detalle se quedo sin sitio y el apartado salia sin decir cuantos pagos ni
-- contra que entregables.
--
-- Solo entra en el texto cuando el pago es a cuenta. En un pago unico no hay
-- nada que detallar.
--
-- Ejecutar en el SQL Editor de Supabase. Hasta entonces la columna no existe y
-- la ficha fallara al guardar ese campo.

alter table public.necesidades
  add column if not exists forma_pago_detalle text;

comment on column public.necesidades.forma_pago_detalle is
  'Detalle de los pagos a cuenta: cuantos, contra que entregables y en que proporcion (Art. 67). Vacio si el pago es unico.';
