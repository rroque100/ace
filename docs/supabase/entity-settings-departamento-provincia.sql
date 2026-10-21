-- Departamento y provincia de la entidad (pestaña Configuración → Municipalidad).
-- Van antes de la ciudad en el formulario; la dirección queda después de la ciudad.
--
-- El endpoint /api/configuracion/settings tolera la ausencia de estas columnas
-- (COLUMNAS_OPCIONALES + fallback progresivo en getSettings): la app funciona
-- sin ejecutar esto, solo que department/province no se persisten hasta hacerlo.
--
-- Ya aplicado en el proyecto Supabase vía apply_migration
-- (add_department_province_to_entity_settings). Se deja aquí como registro.

alter table public.entity_settings
  add column if not exists department text,
  add column if not exists province text;
