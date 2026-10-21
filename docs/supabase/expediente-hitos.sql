-- ============================================================================
-- HITOS DEL EXPEDIENTE — Fases y sub-pasos de la Ley 32069 (Opción B)
-- ============================================================================
-- Persiste el estado por-expediente de cada hito del procedimiento (3 fases,
-- 25 sub-pasos). El catálogo de hitos vive en el código (lib/procurement-fases.ts);
-- aquí solo se guarda el estado mutable por expediente, como un objeto jsonb
-- indexado por el código del hito:
--
--   { "A1": { "status": "hecho", "doneAt": "2026-07-12", "responsible": "DEC",
--             "documentId": "<uuid>", "notes": "...", "updatedAt": "..." }, ... }
--
-- Ejecutar UNA VEZ en el SQL Editor de Supabase. Idempotente.
-- ============================================================================

alter table public.procurement_processes
  add column if not exists hitos jsonb not null default '{}'::jsonb;

-- Índice GIN para reportes de avance que filtren/agreguen por estado de hito.
create index if not exists procurement_processes_hitos_gin
  on public.procurement_processes using gin (hitos);

-- Verificación:
-- select id, nomenclature, hitos from public.procurement_processes limit 5;
