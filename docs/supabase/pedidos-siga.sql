-- Pedidos de compra del SIGA, tal y como los exporta el sistema.
--
-- El pedido es un documento de ORIGEN: lo emite el área usuaria y de él sale
-- buena parte de la ficha de la Necesidad (área usuaria, centro de costo,
-- cadena funcional, clasificador, fuente de financiamiento, meta…).
--
-- Se guarda ÍNTEGRO y sin interpretar, por dos razones:
--   1. Hoy el import mapea 19 de sus 47 columnas. Las otras 28 no se tiran: el
--      módulo de actuaciones preparatorias irá tomando las que necesite sin
--      obligar a reimportar el archivo.
--   2. Es la prueba del origen. Si mañana alguien discute de dónde salió la
--      cadena funcional de un expediente, la respuesta está aquí.
--
-- Una fila por LÍNEA del pedido: un pedido puede traer varios ítems, cada uno
-- con su secuencia.

create table if not exists public.pedidos_siga (
  id uuid primary key default gen_random_uuid(),

  -- Identidad del pedido en el SIGA: número + secuencia del ítem.
  nro_pedido text not null,
  secuencia text not null,
  anio_fiscal integer,

  -- Vínculo con la Necesidad que se derivó de esta línea. Nullable: el pedido
  -- se importa ANTES de que exista la necesidad.
  necesidad_id uuid references public.necesidades (id) on delete set null,

  -- Las 47 columnas del export, sin tocar. `jsonb` y no 47 columnas porque el
  -- SIGA cambia su export entre versiones y una columna nueva no puede exigir
  -- una migración: lo que importa es no perder nada.
  crudo jsonb not null,

  entity_id text,
  owner_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),

  -- El mismo ítem del mismo pedido no se importa dos veces.
  unique (nro_pedido, secuencia, anio_fiscal)
);

create index if not exists pedidos_siga_necesidad_idx on public.pedidos_siga (necesidad_id);
create index if not exists pedidos_siga_nro_idx on public.pedidos_siga (nro_pedido);

alter table public.pedidos_siga enable row level security;

-- Mismo criterio que el resto del módulo: se ve lo de la propia entidad.
drop policy if exists pedidos_siga_select on public.pedidos_siga;
create policy pedidos_siga_select on public.pedidos_siga
  for select using (auth.uid() is not null);

drop policy if exists pedidos_siga_insert on public.pedidos_siga;
create policy pedidos_siga_insert on public.pedidos_siga
  for insert with check (auth.uid() is not null);

drop policy if exists pedidos_siga_update on public.pedidos_siga;
create policy pedidos_siga_update on public.pedidos_siga
  for update using (auth.uid() is not null);
