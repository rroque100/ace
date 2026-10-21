-- ============================================================================
-- Mejoras alineadas a la Ley 32069 y su Reglamento
-- Nuevas columnas para necesidades y procurement_processes
-- Ejecutar UNA VEZ en el SQL Editor de Supabase. Idempotente.
-- ============================================================================

-- 1) Necesidades ------------------------------------------------------------

-- Fórmula de reajuste (Art. 44.2.e Reglamento)
alter table public.necesidades
  add column if not exists formula_reajuste text;

-- Requisitos de calificación / precalificación (Art. 44.2.b Reglamento)
alter table public.necesidades
  add column if not exists requisitos_calificacion text;

-- DEC verifica si la necesidad está en ficha técnica / homologación (Art. 14.2.d)
alter table public.necesidades
  add column if not exists verificacion_ficha_tecnica boolean not null default false;

-- DEC verifica si la necesidad se cubre con existencias de almacén (Art. 14.2.e)
alter table public.necesidades
  add column if not exists verificacion_almacen boolean not null default false;

-- Certificación / previsión presupuestal (Art. 14.2.j)
alter table public.necesidades
  add column if not exists certificacion_presupuestal text;

-- Fecha de remisión a la DEC
alter table public.necesidades
  add column if not exists fecha_remision_dec date;

-- Moneda del monto estimado
alter table public.necesidades
  add column if not exists moneda text not null default 'PEN';

-- 2) Procurement processes ---------------------------------------------------

-- Requisitos de calificación (Art. 46.1.f Reglamento)
alter table public.procurement_processes
  add column if not exists requisitos_calificacion text;

-- Requisitos de precalificación
alter table public.procurement_processes
  add column if not exists requisitos_precalificacion text;

-- Tipo de evaluador y perfil (Art. 46.1.e)
alter table public.procurement_processes
  add column if not exists tipo_evaluador_perfil text;

-- Factores de evaluación (Art. 46.1.g)
alter table public.procurement_processes
  add column if not exists factores_evaluacion text;

-- Garantías y adelantos (Art. 46.1.l)
alter table public.procurement_processes
  add column if not exists garantias_adelantos text;

-- Cronograma estimado del proceso (Art. 46.1.o)
alter table public.procurement_processes
  add column if not exists cronograma_contratacion text;

-- Tipo de interacción con el mercado (Art. 47)
alter table public.procurement_processes
  add column if not exists tipo_interaccion_mercado text;

-- Tipo de procedimiento de selección
alter table public.procurement_processes
  add column if not exists tipo_procedimiento text;

-- ============================================================================
