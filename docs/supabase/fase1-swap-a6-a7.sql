-- Swap A6 <-> A7 en procurement_processes.hitos (Fase 1).
--
-- Motivo: para calcar el orden del Anexo N° 2 de la Guía de Actuaciones
-- Preparatorias, A6 pasa a ser "Designación de Evaluadores" y A7 "CCP"
-- (antes era al revés). Como A6/A7 son claves de persistencia del jsonb,
-- los expedientes que YA tenían datos guardados necesitan mover su contenido.
--
-- IDEMPOTENTE POR CONTENIDO: solo mueve un slot si detecta que contiene el
-- formulario "equivocado" para su nueva etiqueta. Re-ejecutarlo no hace daño:
--   - A6 debe contener el formulario de evaluadores (clave 'tipo_evaluador').
--   - A7 debe contener el formulario de CCP (clave 'tipo' o 'meta_presupuestal').
-- Si un expediente ya está en el orden correcto (o no tiene A6/A7), no se toca.

update public.procurement_processes p
set hitos = (p.hitos - 'A6' - 'A7')
  || jsonb_build_object('A6', p.hitos->'A7')
  || jsonb_build_object('A7', p.hitos->'A6')
where p.hitos is not null
  -- A6 actual tiene datos de CCP (formulario que ahora corresponde a A7)...
  and (
    (p.hitos->'A6'->'data') ? 'meta_presupuestal'
    or (p.hitos->'A6'->'data') ? 'tipo'
  )
  -- ...y A7 actual tiene datos de evaluadores (formulario que ahora es A6).
  and (p.hitos->'A7'->'data') ? 'tipo_evaluador';
