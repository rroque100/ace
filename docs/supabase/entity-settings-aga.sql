-- Autoridad de Gestión Administrativa (AGA) en la ficha de la entidad.
--
-- El AGA (Ley 32069, Art. 25.1.b y Reglamento Art. 19) es la más alta autoridad
-- de la gestión administrativa de la entidad: APRUEBA, autoriza y supervisa las
-- contrataciones (aprueba el expediente, Art. 54.2). En gobiernos locales la Ley
-- lo identifica con la gerencia municipal, pero se guarda en su PROPIA sección
-- para las entidades donde el AGA no coincide con el "Gerente de la entidad" ya
-- registrado, o cuando la facultad se ejerce por delegación (Art. 25.2).
--
-- Mismos campos que el gerente (es una autoridad designada por resolución):
-- grado, DNI, nombre, cargo y la resolución que lo designa.
--
-- La app tolera que estas columnas aún no existan (lee y guarda sin ellas).

alter table public.entity_settings
  add column if not exists aga_degree text,
  add column if not exists aga_dni text,
  add column if not exists aga_full_name text,
  add column if not exists aga_position text,
  add column if not exists aga_resolution_number text,
  add column if not exists aga_resolution_date text;
