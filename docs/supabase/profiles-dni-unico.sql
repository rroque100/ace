-- Indice unico parcial sobre DNI (salta null y vacio).
-- Previene que dos usuarios registren el mismo documento de identidad.
--
-- Ejecutar UNA VEZ en el SQL Editor de Supabase.
-- Si falla por duplicados existentes, localizarlos con:
--   select dni, count(*) from profiles
--   where dni is not null and dni <> ''
--   group by dni having count(*) > 1;
-- Limpiar los duplicados manualmente y reintentar.

create unique index if not exists profiles_dni_unique
  on public.profiles (dni)
  where dni is not null and dni <> '';
