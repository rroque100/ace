-- Consumo atómico del correlativo de documentos (expedientes_doc_counters).
--
-- Hasta ahora el contador SOLO se leía (el N° del informe era una sugerencia y el
-- `siguiente` nunca subía), así que dos informes podían llevar el mismo número. El
-- informe de aprobación (A8) ahora "emite" su número al descargarse: llama a esta
-- función, que incrementa `siguiente` y devuelve el número consumido (el valor
-- ANTES de incrementar) en la MISMA sentencia. Al ser atómico, dos emisiones
-- concurrentes nunca reciben el mismo número.
--
-- SECURITY DEFINER: el contador es configuración de la entidad (RLS de admin),
-- pero quien emite el informe es la DEC. La función corre con los permisos del
-- dueño para poder incrementar el contador sin abrir la tabla a todos.
--
-- Devuelve NULL si la oficina no tiene contador de ese tipo/año (el que llama lo
-- trata como "no se pudo numerar" y deja la sugerencia sin congelar).

create or replace function public.consumir_correlativo(p_oficina uuid, p_tipo text, p_year int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare v_consumido int;
begin
  update expedientes_doc_counters
     set siguiente = siguiente + 1
   where oficina_id = p_oficina and tipo = p_tipo and year = p_year
   returning siguiente - 1 into v_consumido;
  return v_consumido;
end;
$$;
