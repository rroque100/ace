-- Feedback de redaccion de la pestaña Responder (like/dislike del borrador).
-- Alimenta al generador: los borradores marcados como CORRECTOS se usan como
-- ejemplos de estilo de la oficina en futuras generaciones; los INCORRECTOS
-- (con su comentario) se usan como defectos a evitar.
--
-- Ejecutar en el SQL Editor de Supabase (una sola vez).

create table if not exists public.respuesta_feedback (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid references public.expedientes_oficinas(id) on delete set null,
  tipo_documento text,
  rating text not null check (rating in ('like', 'dislike')),
  comentario text,
  cuerpo text not null,
  intencion text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists respuesta_feedback_oficina_idx
  on public.respuesta_feedback (oficina_id, tipo_documento, rating, created_at desc);

-- Acceso solo via API del servidor (service role); sin politicas para clientes.
alter table public.respuesta_feedback enable row level security;
