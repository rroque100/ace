-- ============================================================================
-- Datos personales del usuario (perfil)
-- ============================================================================
-- Nombre completo, DNI, cargo y grado académico. Se usan en los documentos
-- oficiales que produce ACE: la designación de evaluadores (A6, Art. 54.2.e),
-- membretes, actas y otros formatos donde el firmante va identificado por su
-- nombre y cargo, no por su correo.
--
-- Columnas reales y no metadata: son datos estructurados que se consultan por
-- rol (p. ej. "todos los oficiales de compra") y se imprimen en documentos que
-- se firman, así que conviene que sean consultables y tipados.
--
-- Ejecutar UNA VEZ en el SQL Editor de Supabase. Idempotente.
-- ============================================================================

alter table public.profiles add column if not exists nombre_completo text;
alter table public.profiles add column if not exists dni text;
alter table public.profiles add column if not exists cargo text;
alter table public.profiles add column if not exists grado_academico text;
