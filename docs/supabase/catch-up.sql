-- ════════════════════════════════════════════════════════════════════════════
-- catch-up.sql — migraciones detectadas SIN aplicar
-- ────────────────────────────────────────────────────────────────────────────
-- Auditoría del 2026-08-09: se contrastaron los 46 .sql de docs/supabase/ (348
-- objetos: tablas, columnas, funciones, índices y CHECK) contra la base en vivo.
-- El esquema está aplicado casi por completo; lo único con impacto real que
-- faltaba es el índice único del DNI en `profiles`.
--
-- Se dejaron FUERA a propósito:
--   · is_dec() / is_legal()  → funciones obsoletas de schema.sql; ninguna política
--     RLS las usa (el rol se comprueba en la app, lib/auth.ts). No hacen falta.
--   · expedientes_respuestas_version_idx e idx_concordancias_relation_type →
--     índices de rendimiento sobre tablas diminutas; irrelevantes.
--
-- Ejecutar UNA VEZ en el SQL Editor de Supabase.
-- ════════════════════════════════════════════════════════════════════════════

-- Índice único parcial sobre el DNI de `profiles` (salta null y vacío).
-- Impide que dos usuarios registren el mismo documento de identidad.
-- A 2026-08-09 no hay DNIs duplicados, así que corre limpio. Si en el futuro
-- fallara por duplicados, localizarlos con:
--   select dni, count(*) from profiles
--   where dni is not null and dni <> ''
--   group by dni having count(*) > 1;
-- limpiarlos a mano y reintentar.
create unique index if not exists profiles_dni_unique
  on public.profiles (dni)
  where dni is not null and dni <> '';
