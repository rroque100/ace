-- PIA y PAC del ejercicio fiscal en la configuración institucional.
--
-- Son datos ANUALES y únicos para toda la entidad: se registran una vez al año
-- en Configuración → Municipalidad y alimentan los informes exportados
-- (p. ej. el Informe de Segmentación del paso A2), donde se citan como
-- antecedentes y se usan para calcular la línea de corte por cuantía
-- (10% del PAC de bienes y servicios, Art. 125 del Reglamento).
--
-- Idempotente: se puede ejecutar varias veces sin efecto.

alter table public.entity_settings
  -- Resolución que aprueba el Presupuesto Institucional de Apertura.
  add column if not exists pia_resolucion_numero text,
  add column if not exists pia_resolucion_fecha text,
  -- Resolución que aprueba el Plan Anual de Contrataciones.
  add column if not exists pac_resolucion_numero text,
  add column if not exists pac_resolucion_fecha text,
  -- Ejercicio fiscal al que corresponden el PIA y el PAC (p. ej. 2026).
  add column if not exists pac_anio integer,
  -- Montos aprobados en el PAC. El de bienes y servicios es el que define la
  -- línea de corte por cuantía; el de obras se cita como antecedente.
  add column if not exists pac_monto_total numeric(14, 2),
  add column if not exists pac_monto_bienes_servicios numeric(14, 2),
  add column if not exists pac_monto_obras numeric(14, 2);

comment on column public.entity_settings.pac_monto_bienes_servicios is
  'PAC aprobado para bienes y servicios. Base de la linea de corte del 10% (Art. 125 del Reglamento).';
comment on column public.entity_settings.pac_anio is
  'Ejercicio fiscal del PIA/PAC registrados.';


-- Año fiscal de los datos anuales. Aplicado el 2026-07-16 vía MCP (migración
-- `entity_settings_year`): el código lo enviaba desde el inicio y la
-- tolerancia a columnas ausentes lo descartaba en silencio en cada guardado.
alter table public.entity_settings
  add column if not exists year integer;
