-- Apartado j) PLAZO PARA RESPUESTAS ENTRE LAS PARTES: el texto, aparte del plazo.
--
-- El plazo (`plazo_respuestas`) es un NUMERO de dias: con el se puede contar y
-- comparar. El apartado redactado es texto y va en su propia columna.
--
-- Meter las dos cosas en la misma columna obligaba a adivinar cual de las dos
-- habia dentro en cada momento, y ademas el plazo estaba declarado numero en la
-- ficha y validado como texto en el esquema: cada guardado respondia 400.
--
-- `plazo_respuestas` pasa de text a integer. Los valores existentes que no sean
-- un numero limpio se pierden, y por eso se copian antes al campo de texto.

alter table public.necesidades
  add column if not exists plazo_respuestas_texto text;

-- Lo que ya hubiera escrito como prosa se conserva en el campo de texto.
update public.necesidades
   set plazo_respuestas_texto = plazo_respuestas
 where plazo_respuestas is not null
   and plazo_respuestas !~ '^\s*\d+\s*$'
   and plazo_respuestas_texto is null;

-- Y la columna pasa a entero, quedandose solo con lo que era un numero.
alter table public.necesidades
  alter column plazo_respuestas type integer
  using nullif(regexp_replace(plazo_respuestas, '\D', '', 'g'), '')::integer;

comment on column public.necesidades.plazo_respuestas is
  'Plazo maximo de respuesta entre las partes, en dias calendario (apartado j).';
comment on column public.necesidades.plazo_respuestas_texto is
  'Texto del apartado j) ya redactado. Se compone desde plazo_respuestas.';
