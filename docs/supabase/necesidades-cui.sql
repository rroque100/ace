-- Código Único de Inversión (CUI) en la ficha de la Necesidad.
--
-- Viene de la columna `act_proy` del pedido de compra del SIGA (2661009). Es el
-- NÚMERO del proyecto de inversión, no su nombre: `proyecto_inversion` guarda
-- el nombre de la tarea ("186 MEJORAMIENTO Y AMPLIACION DE LOS SERVICIOS…") y
-- son dos datos distintos.
--
-- Sin esta columna, la variable c) del Formato de Estrategia sacaba el CUI del
-- texto de `proyecto_inversion` y escribía el NOMBRE donde el formato pide el
-- número. El Anexo firmado de la entidad dice "2661009".
alter table public.necesidades
  add column if not exists cui text;

comment on column public.necesidades.cui is
  'Código Único de Inversión (act_proy del SIGA). Número, no nombre: el nombre del proyecto va en proyecto_inversion.';
