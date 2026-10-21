-- Catálogo de instituciones arbitrales de la entidad (Configuración → Institución
-- Arbitral). Cada institución del convenio arbitral debe tener inscripción vigente
-- en el REGAJU (Art. 332.1 del Reglamento); este catálogo las deja registradas
-- para elegirlas en la solución de controversias del requerimiento (A3).
--
-- Se guarda como un array JSONB en la fila `default` de entity_settings, igual que
-- los feriados: es un catálogo pequeño y global, no particionado por año. Cada
-- elemento: { "id": number, "nombre": string, "ruc": string }.
--
-- Ejecutar a mano en el SQL Editor de Supabase (no hay migraciones automáticas).

alter table public.entity_settings
  add column if not exists instituciones_arbitrales jsonb not null default '[]'::jsonb;

-- Nota: entity_settings NO está particionada por año (su PK sigue siendo (id) y la
-- fila es `default`), así que esta columna es global para la entidad, como feriados.
