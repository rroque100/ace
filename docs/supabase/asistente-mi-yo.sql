-- ============================================================================
-- ASISTENTE "MI YO" — memoria persistente del asistente unico de ACE
-- ============================================================================
-- Hoy la app tiene varios copilotos sueltos (chat legal, copiloto de
-- necesidad, copiloto de expediente, "Preguntar a la IA" del archivo), cada
-- uno con su propio prompt y sin memoria entre sesiones. "Mi Yo" es el punto
-- de entrada UNICO: reutiliza esa misma logica como "herramientas" que un
-- orquestador (lib/mi-yo.ts) decide invocar segun la intencion del mensaje,
-- y persiste la conversacion para que el usuario pueda volver a ella desde
-- cualquier modulo.
--
-- No hay tabla de "actividad" propia: el resumen de "que hizo el usuario" se
-- lee de `audit_logs`, que ya registra casi todas las acciones del sistema
-- (ver lib/supabase-server.ts:writeAuditLog). Aqui solo se agrega la memoria
-- de la conversacion con el asistente.
--
-- Ejecutar UNA VEZ en el SQL Editor de Supabase. Idempotente.
-- ============================================================================

-- `set_updated_at()` ya vive en docs/supabase/schema.sql (la migracion base) y
-- la reusan varias tablas (expedientes_archivo, expedientes_archivo_legajos...).
-- Se redefine aqui tambien, IDEMPOTENTE (`create or replace`, mismo cuerpo), para
-- que este archivo no dependa de que schema.sql ya se haya corrido en este
-- proyecto — si ya existe, esto no cambia nada; si no existe (proyecto nuevo o
-- parcialmente migrado), evita el error 42883 "function ... does not exist".
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── 1) Conversaciones ────────────────────────────────────────────────────────
-- Una conversacion por usuario alcanza para la v1 (un solo hilo continuo, como
-- un asistente personal real); el modelo ya soporta varias por si mas adelante
-- se agrega "nueva conversacion" en la UI.

create table if not exists public.asistente_conversaciones (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  titulo      text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_asistente_conversaciones_user_id
  on public.asistente_conversaciones(user_id, updated_at desc);

drop trigger if exists set_asistente_conversaciones_updated_at on public.asistente_conversaciones;
create trigger set_asistente_conversaciones_updated_at
before update on public.asistente_conversaciones
for each row execute function public.set_updated_at();

-- ── 2) Mensajes ───────────────────────────────────────────────────────────────
-- `user_id` va denormalizado (no solo `conversacion_id`) para que la politica
-- RLS de esta tabla no dependa de un join contra `asistente_conversaciones`.

create table if not exists public.asistente_mensajes (
  id               uuid primary key default gen_random_uuid(),
  conversacion_id  uuid not null references public.asistente_conversaciones(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  role             text not null check (role in ('user','assistant')),
  content          text not null,
  -- Que "herramienta" resolvio la respuesta (legal/archivo/actividad/general).
  -- Solo aplica a mensajes del asistente; null en los del usuario.
  intent           text,
  created_at       timestamptz not null default now()
);

create index if not exists idx_asistente_mensajes_conversacion
  on public.asistente_mensajes(conversacion_id, created_at);
create index if not exists idx_asistente_mensajes_user_id
  on public.asistente_mensajes(user_id);

-- Cada mensaje nuevo mueve la conversacion al tope (para "la mas reciente").
create or replace function public.asistente_mensajes_touch_conversacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.asistente_conversaciones
  set updated_at = now()
  where id = new.conversacion_id;
  return new;
end;
$$;

drop trigger if exists asistente_mensajes_touch_conversacion_trg on public.asistente_mensajes;
create trigger asistente_mensajes_touch_conversacion_trg
after insert on public.asistente_mensajes
for each row execute function public.asistente_mensajes_touch_conversacion();

-- ── 3) RLS: cada usuario solo ve/escribe lo suyo (sin excepcion de admin: es
-- memoria PERSONAL del asistente, no un dato institucional a supervisar) ─────

alter table public.asistente_conversaciones enable row level security;
alter table public.asistente_mensajes enable row level security;

do $$
declare pol record;
begin
  for pol in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in ('asistente_conversaciones', 'asistente_mensajes')
  loop
    execute format('drop policy %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

create policy asistente_conversaciones_own on public.asistente_conversaciones
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy asistente_mensajes_own on public.asistente_mensajes
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── 4) Verificacion rapida ───────────────────────────────────────────────────
-- select count(*) from public.asistente_conversaciones;
-- select tablename, policyname from pg_policies where schemaname='public' and tablename like 'asistente_%';
