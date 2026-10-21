-- Los dos plazos del Art. 144 pasan de texto a numero de dias.
--
-- Se pedian como texto libre y cada ficha los escribia a su manera —«siete (7)»,
-- «cinco (5) dias habiles», «7 dias»—. Asi no se puede contar, ni comparar
-- contra el tope del Art. 144 (siete dias, o veinte si hacen falta pruebas), ni
-- calcular el 30% del plazo del entregable que limita la subsanacion.
--
-- El apartado redactado NO esta aqui: vive en `recepcion_conformidad`, que es
-- texto y no se toca. Estas dos columnas son solo el dato.
--
-- QUE SE PIERDE: un valor escrito sin ninguna cifra («siete dias») se queda en
-- null, porque no hay de donde sacar el numero. Un valor con varias cifras
-- («de 7 a 20 dias») se queda con la PRIMERA, que es la que el formato pide.
--
-- Ejecutar en el SQL Editor de Supabase. Hasta entonces la ficha seguira
-- enviando numeros a una columna de texto.

alter table public.necesidades
  alter column conformidad_plazo type integer
  using (regexp_match(conformidad_plazo, '\d{1,3}'))[1]::integer;

alter table public.necesidades
  alter column conformidad_plazo_subsanacion type integer
  using (regexp_match(conformidad_plazo_subsanacion, '\d{1,3}'))[1]::integer;

comment on column public.necesidades.conformidad_plazo is
  'Plazo maximo para otorgar la conformidad, en dias (Art. 144). Siete, o hasta veinte si se requieren pruebas.';
comment on column public.necesidades.conformidad_plazo_subsanacion is
  'Plazo para subsanar observaciones, en dias habiles. No mayor al 30% del plazo del entregable. Solo servicios.';
