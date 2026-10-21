-- ============================================================
-- MIGRACIÓN CANÓNICA: expedientes_archivo -> esquema único
-- ============================================================
-- Unifica la tabla en el esquema canónico usado por la UI y por los
-- endpoints bulk/duplicates/export. Reemplaza al esquema viejo
-- (numero_*, fecha, tipo_contenedor, nro_caja, color, ubicacion,
-- codigo_ubicacion, nro_folios, remitente, destinatario).
--
-- ⚠ Sin datos productivos: se TRUNCA la tabla y se eliminan las columnas
--   viejas en la misma migración (no requiere backfill).
--
-- Aplicar en Supabase Dashboard -> SQL Editor.
-- ============================================================

-- 0) Limpiar datos (no hay productivos). Cascade borra los chunks.
truncate table public.expedientes_archivo cascade;

-- 1) Crear columnas canónicas (idempotente)
do $$
begin
  -- Identificación documental
  if not exists (select 1 from information_schema.columns where table_name='expedientes_archivo' and column_name='sgd_expediente') then
    alter table public.expedientes_archivo add column sgd_expediente text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='expedientes_archivo' and column_name='serie_documento') then
    alter table public.expedientes_archivo add column serie_documento text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='expedientes_archivo' and column_name='tipo_documento') then
    alter table public.expedientes_archivo add column tipo_documento text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='expedientes_archivo' and column_name='oficina') then
    alter table public.expedientes_archivo add column oficina text;
  end if;

  -- Almacenamiento físico
  if not exists (select 1 from information_schema.columns where table_name='expedientes_archivo' and column_name='tipo_almacenamiento') then
    alter table public.expedientes_archivo add column tipo_almacenamiento text not null default 'folder'
      check (tipo_almacenamiento in ('folder','archivador','caja','tomo','paquete','estante','otros'));
  end if;
  if not exists (select 1 from information_schema.columns where table_name='expedientes_archivo' and column_name='nro_paquete') then
    alter table public.expedientes_archivo add column nro_paquete text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='expedientes_archivo' and column_name='empastado') then
    alter table public.expedientes_archivo add column empastado boolean not null default false;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='expedientes_archivo' and column_name='color_archivador') then
    alter table public.expedientes_archivo add column color_archivador text;
  end if;

  -- Ubicación física exacta
  if not exists (select 1 from information_schema.columns where table_name='expedientes_archivo' and column_name='nro_estante') then
    alter table public.expedientes_archivo add column nro_estante text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='expedientes_archivo' and column_name='nro_piso') then
    alter table public.expedientes_archivo add column nro_piso text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='expedientes_archivo' and column_name='nro_local') then
    alter table public.expedientes_archivo add column nro_local text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='expedientes_archivo' and column_name='folio') then
    alter table public.expedientes_archivo add column folio text;
  end if;

  -- Persona interesada
  if not exists (select 1 from information_schema.columns where table_name='expedientes_archivo' and column_name='persona_tipo') then
    alter table public.expedientes_archivo add column persona_tipo text check (persona_tipo in ('natural','juridica'));
  end if;
  if not exists (select 1 from information_schema.columns where table_name='expedientes_archivo' and column_name='persona_documento') then
    alter table public.expedientes_archivo add column persona_documento text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='expedientes_archivo' and column_name='persona_nombre') then
    alter table public.expedientes_archivo add column persona_nombre text;
  end if;

  -- Cache de texto extraído (si no existía)
  if not exists (select 1 from information_schema.columns where table_name='expedientes_archivo' and column_name='body_text') then
    alter table public.expedientes_archivo add column body_text text;
  end if;

  -- nro_archivador puede existir ya (compartido con esquema viejo)
  if not exists (select 1 from information_schema.columns where table_name='expedientes_archivo' and column_name='nro_archivador') then
    alter table public.expedientes_archivo add column nro_archivador text;
  end if;
end $$;

-- NOTA de diseño:
--   * tipo_documento: TEXT libre (la UI ofrece Resolución/Oficio/Decreto/Ordenanza/
--     Informe/Memorando/Carta/Otro+custom; un CHECK de 5 valores colapsaría datos).
--   * tipo_almacenamiento: CHECK contra el catálogo CONTENEDOR_TIPOS que usa la UI
--     (folder/archivador/caja/tomo/paquete/estante/otros), no el enum del SDD.

-- 2) Eliminar columnas del esquema viejo (sin datos -> seguro)
do $$
declare col text;
begin
  foreach col in array array[
    'numero_expediente','numero_documento','fecha','tipo_contenedor',
    'nro_caja','color','ubicacion','codigo_ubicacion','nro_folios',
    'remitente','destinatario'
  ] loop
    if exists (select 1 from information_schema.columns where table_name='expedientes_archivo' and column_name=col) then
      execute format('alter table public.expedientes_archivo drop column %I', col);
    end if;
  end loop;
end $$;

-- 3) Índices
create index if not exists idx_expedientes_archivo_status     on public.expedientes_archivo(status);
create index if not exists idx_expedientes_archivo_anio       on public.expedientes_archivo(anio desc);
create index if not exists idx_expedientes_archivo_serie      on public.expedientes_archivo(serie_documento);
create index if not exists idx_expedientes_archivo_oficina    on public.expedientes_archivo(oficina);
create index if not exists idx_expedientes_archivo_estante    on public.expedientes_archivo(nro_estante);
create index if not exists idx_expedientes_archivo_created_at on public.expedientes_archivo(created_at desc);

-- 4) Verificación
select column_name, data_type
from information_schema.columns
where table_name = 'expedientes_archivo'
order by ordinal_position;
