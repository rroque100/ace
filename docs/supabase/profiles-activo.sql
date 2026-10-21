-- ============================================================================
-- Inactivar usuarios (Configuracion -> Usuarios) sin borrarlos.
--
-- Antes la unica forma de quitarle acceso a alguien era eliminarlo por
-- completo (Auth + profiles): irreversible, y perdia su historial de
-- auditoria como actor. `activo` deja constancia en la ficha de que la cuenta
-- esta desactivada; el bloqueo real del inicio de sesion lo hace Supabase Auth
-- (`ban_duration`) desde el endpoint PATCH .../[id]/estado, no esta columna
-- por si sola.
--
-- Ejecucion MANUAL en el SQL Editor de Supabase.
-- ============================================================================

alter table public.profiles
  add column if not exists activo boolean not null default true;
