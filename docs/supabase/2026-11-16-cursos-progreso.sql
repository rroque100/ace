-- Progreso de cada cuenta en los cursos de formación (/cursos).
--
-- El catálogo (cursos, secciones, clases y su contenido) vive en código, en lib/cursos/: cambia con despliegues
-- revisados y los tests lo recorren entero. Aquí solo se guarda qué clase marcó cada persona como completada.
--
-- Sin partición por año fiscal: el avance en un curso no es un dato del ejercicio presupuestal.
--
-- Se escribe con el JWT del usuario (supabaseUserRest), así que la política RLS es la que impide leer o marcar el
-- progreso de otra cuenta; la API toma además el user_id de la sesión, nunca del cuerpo de la petición.
--
-- Ejecutar a mano en el SQL Editor de Supabase. Hasta entonces la página de cursos funciona y avisa de que el avance
-- aún no se guarda.

create table if not exists public.curso_progreso (
  user_id uuid not null references auth.users(id) on delete cascade,
  curso text not null check (curso ~ '^[a-z0-9-]{1,80}$'),
  clase text not null check (clase ~ '^[a-z0-9-]{1,120}$'),
  completada_at timestamptz not null default now(),
  primary key (user_id, curso, clase)
);

alter table public.curso_progreso enable row level security;

drop policy if exists curso_progreso_propio on public.curso_progreso;
create policy curso_progreso_propio on public.curso_progreso
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Solo leer, marcar y desmarcar: no hay nada que actualizar en una fila.
-- El revoke de authenticated es necesario: Supabase concede por defecto TODOS los privilegios (UPDATE, TRUNCATE…) a
-- anon y authenticated en cada tabla nueva de public, y un grant solo añade. Comprobado al aplicarlo en producción el
-- 2026-11-17: sin este revoke, authenticated conservaba UPDATE, TRUNCATE, REFERENCES y TRIGGER.
revoke all on public.curso_progreso from anon, authenticated;
grant select, insert, delete on public.curso_progreso to authenticated;

-- PostgREST cachea el esquema: sin esto la tabla nueva puede tardar en verse (PGRST205).
notify pgrst, 'reload schema';
