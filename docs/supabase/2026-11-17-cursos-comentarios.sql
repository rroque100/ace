-- Comentarios de las clases de /cursos, con respuestas de un nivel y «me gusta».
--
-- Quién escribe qué:
--   * LEER comentarios y «me gusta»: cualquier cuenta autenticada (RLS: true). Se lee con el JWT del usuario.
--   * CREAR un comentario: NO se concede a authenticated. Lo inserta la API con service_role después de validar el
--     texto, que el curso y la clase existan y que la respuesta cuelgue de un comentario raíz de la misma clase; el
--     user_id y el nombre del autor los pone el servidor a partir de la sesión. Si se concediera INSERT, cualquiera con
--     la clave anon pública y su JWT podría firmar como «Administración» o colgar respuestas de otra clase.
--   * BORRAR: el autor, con su JWT (RLS user_id = auth.uid()); la moderación de un administrador la hace la API.
--   * «Me gusta»: el propio usuario, con su JWT (RLS user_id = auth.uid()); uno por persona y comentario.
--
-- Supabase concede por defecto TODOS los privilegios a anon y authenticated en cada tabla nueva de public, y un grant
-- solo añade (se comprobó con curso_progreso el 2026-11-17): por eso se revoca todo antes de conceder lo justo.
--
-- Ejecutar a mano en el SQL Editor de Supabase. Hasta entonces la clase muestra «los comentarios aún no están
-- disponibles» en lugar de la sección.

create table if not exists public.curso_comentarios (
  id uuid primary key default gen_random_uuid(),
  curso text not null check (curso ~ '^[a-z0-9-]{1,80}$'),
  clase text not null check (clase ~ '^[a-z0-9-]{1,120}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  autor text not null check (char_length(autor) between 1 and 80),
  texto text not null check (char_length(btrim(texto)) between 1 and 2000),
  padre_id uuid references public.curso_comentarios(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists curso_comentarios_clase_idx on public.curso_comentarios (curso, clase, created_at desc);
create index if not exists curso_comentarios_padre_idx on public.curso_comentarios (padre_id);

create table if not exists public.curso_comentario_likes (
  comentario_id uuid not null references public.curso_comentarios(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comentario_id, user_id)
);

alter table public.curso_comentarios enable row level security;
alter table public.curso_comentario_likes enable row level security;

drop policy if exists curso_comentarios_leer on public.curso_comentarios;
create policy curso_comentarios_leer on public.curso_comentarios
  for select to authenticated using (true);

drop policy if exists curso_comentarios_borrar_propio on public.curso_comentarios;
create policy curso_comentarios_borrar_propio on public.curso_comentarios
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists curso_comentario_likes_leer on public.curso_comentario_likes;
create policy curso_comentario_likes_leer on public.curso_comentario_likes
  for select to authenticated using (true);

drop policy if exists curso_comentario_likes_propio on public.curso_comentario_likes;
create policy curso_comentario_likes_propio on public.curso_comentario_likes
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists curso_comentario_likes_quitar on public.curso_comentario_likes;
create policy curso_comentario_likes_quitar on public.curso_comentario_likes
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.curso_comentarios from anon, authenticated;
revoke all on public.curso_comentario_likes from anon, authenticated;
grant select, delete on public.curso_comentarios to authenticated;
grant select, insert, delete on public.curso_comentario_likes to authenticated;

notify pgrst, 'reload schema';
