-- Tabla de contratos CP guardados (CRUD completo).
-- Ejecutar una sola vez en el SQL Editor de Supabase.

create table if not exists public.contratos_cp (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  numero_contrato text not null default '',
  nomenclatura  text not null default '',
  denominacion text not null default '',
  contratista   text not null default '',
  estado        text not null default 'borrador' check (estado in ('borrador','generado')),
  data          jsonb not null default '{}'::jsonb
);

-- Auto-actualizar updated_at
create or replace function public.set_contratos_cp_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_contratos_cp_updated_at on public.contratos_cp;
create trigger trg_contratos_cp_updated_at
  before update on public.contratos_cp
  for each row execute function public.set_contratos_cp_updated_at();

-- RLS: cada usuario solo ve sus propios contratos
alter table public.contratos_cp enable row level security;

drop policy if exists "Usuarios pueden ver sus contratos CP" on public.contratos_cp;
create policy "Usuarios pueden ver sus contratos CP"
  on public.contratos_cp for select
  using (auth.uid() = user_id);

drop policy if exists "Usuarios pueden insertar sus contratos CP" on public.contratos_cp;
create policy "Usuarios pueden insertar sus contratos CP"
  on public.contratos_cp for insert
  with check (auth.uid() = user_id);

drop policy if exists "Usuarios pueden actualizar sus contratos CP" on public.contratos_cp;
create policy "Usuarios pueden actualizar sus contratos CP"
  on public.contratos_cp for update
  using (auth.uid() = user_id);

drop policy if exists "Usuarios pueden eliminar sus contratos CP" on public.contratos_cp;
create policy "Usuarios pueden eliminar sus contratos CP"
  on public.contratos_cp for delete
  using (auth.uid() = user_id);
