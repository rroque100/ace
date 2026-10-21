-- Tabla de contratos SIE guardados (CRUD completo).
-- Ejecutar una sola vez en el SQL Editor de Supabase.

create table if not exists public.contratos_sie (
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
create or replace function public.set_contratos_sie_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_contratos_sie_updated_at on public.contratos_sie;
create trigger trg_contratos_sie_updated_at
  before update on public.contratos_sie
  for each row execute function public.set_contratos_sie_updated_at();

-- RLS: cada usuario solo ve sus propios contratos
alter table public.contratos_sie enable row level security;

drop policy if exists "Usuarios pueden ver sus contratos" on public.contratos_sie;
create policy "Usuarios pueden ver sus contratos"
  on public.contratos_sie for select
  using (auth.uid() = user_id);

drop policy if exists "Usuarios pueden insertar sus contratos" on public.contratos_sie;
create policy "Usuarios pueden insertar sus contratos"
  on public.contratos_sie for insert
  with check (auth.uid() = user_id);

drop policy if exists "Usuarios pueden actualizar sus contratos" on public.contratos_sie;
create policy "Usuarios pueden actualizar sus contratos"
  on public.contratos_sie for update
  using (auth.uid() = user_id);

drop policy if exists "Usuarios pueden eliminar sus contratos" on public.contratos_sie;
create policy "Usuarios pueden eliminar sus contratos"
  on public.contratos_sie for delete
  using (auth.uid() = user_id);
