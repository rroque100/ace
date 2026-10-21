# Expediente como legajo multidocumento (Fase 1: fundamento de datos) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** separar, en el modelo de datos y en el backend, el concepto de **legajo**
(la carpeta física que se abre una vez y acumula documentos: ubicación,
SGD, serie, oficina, persona interesada) del concepto de **documento** (cada PDF
individual: tipo, folio correlativo, status de OCR/indexación) — hoy fusionados
en una sola fila de `expedientes_archivo`. Al terminar, el backend soporta subir
un documento a un legajo **nuevo** (comportamiento actual, ahora explícito) o a
uno **existente** (capacidad nueva), sin romper nada de lo que ya funciona.

**Architecture:** tabla nueva `expedientes_archivo_legajos` (el legajo) + FK
`expediente_id` en `expedientes_archivo` (que pasa a ser, conceptualmente, la
tabla de documentos, sin renombrarla — ver Global Constraints). El folio
correlativo y los contadores agregados del legajo los mantienen triggers de
Postgres, no la app. Retrocompatible: cada documento existente recibe su propio
legajo 1:1 vía backfill, reusando su mismo `id` (sin tabla de mapeo). Los chunks
de Pinecone ganan un `expediente_id` (legajo) además de su `documento_id`
(rename del `expediente_id` que ya tenían).

**Tech Stack:** Next.js 16 (App Router) + TypeScript estricto, Supabase
(PostgreSQL + RLS, vía PostgREST con `supabaseRest`), Vitest.

## Global Constraints

- Código, comentarios y commits en **español**; asunto del commit = lo que gana
  el usuario/la capacidad nueva, en minúscula (Conventional Commits con scope).
- Comentarios explican el **porqué**, no el qué.
- **Prerrequisito**: `docs/supabase/rls-archivo-por-usuario.sql` ya está aplicado
  en la base de datos (confirmado — memoria del proyecto). Este plan reutiliza
  sus funciones `public.is_admin()`, `public.is_editor()`,
  `public.archivo_es_jefe()`, `public.archivo_oficina_id()` y
  `public.archivo_norm()`. Si no estuviera aplicado, aplicarlo primero.
- **Migración SQL manual**: el fichero de la Tarea 1 se ejecuta a mano en
  Supabase Dashboard → SQL Editor. Avisar explícitamente al entregar esta fase
  que falta correrlo — sin eso, las tareas de backend fallan en tiempo de
  ejecución (aunque compilen).
- **No se trunca ni se borra ningún dato productivo.** La migración es
  retrocompatible con las filas que ya existen en `expedientes_archivo`.
- **Decisión deliberada de alcance**: `expedientes_archivo` NO se renombra en
  este plan (sigue siendo, técnicamente, la tabla de documentos; el legajo vive
  en la tabla nueva `expedientes_archivo_legajos`). Renombrarla tocaría los
  ~15 ficheros que hoy escriben literalmente `expedientes_archivo?...` en la
  query string — fuera de alcance de esta fase, es pulido opcional futuro.
- **Fuera de alcance de este plan** (fases de seguimiento, una vez esta base
  esté aplicada y estable): selector "legajo nuevo / legajo existente" en el
  wizard de Subir, slide-over multi-documento, re-scope de bulk/duplicados/
  búsqueda a nivel legajo, adjuntar la respuesta de Mesa de Partes como
  documento nuevo del mismo legajo. Este plan deja el backend listo para que
  esas fases lo consuman, pero no toca la UI.
- Verificación por tarea: `npx tsc --noEmit`, `npx eslint app lib`. El suite de
  Vitest de este módulo no toca red/DB (mockea todo); solo se añade test donde
  ya hay ese patrón (lógica pura), no a los wrappers `fetch` delgados —
  siguiendo el precedente real del repo (`detectDuplicates`,
  `fetchUbicacionSugerida` tampoco tienen test).

## File Structure

- `docs/supabase/expediente-legajo.sql` — **crear**. Migración completa: tabla
  `expedientes_archivo_legajos`, columnas nuevas en `expedientes_archivo` y
  `expedientes_archivo_chunks`, triggers de folio/estado agregado/oficina_id,
  backfill, políticas RLS del legajo.
- `lib/expedientes-archivo.ts` — **modificar**. `ExpedienteArchivo` gana
  `expediente_id`/`numero_folio`; tipo nuevo `ExpedienteLegajo`.
- `app/components/expedientes-archivo/types.ts` — **modificar**. `ExpedienteItem`
  gana los mismos dos campos; tipo cliente nuevo `ExpedienteLegajoItem`.
- `lib/expedientes-archivo-actions.ts` — **modificar**. Acción `searchLegajos`.
- `app/api/expedientes-archivo/legajos/route.ts` — **crear**. `GET` (buscar/listar legajos).
- `app/api/expedientes-archivo/legajos/[id]/route.ts` — **crear**. `GET` (detalle + documentos).
- `app/api/expedientes-archivo/route.ts` — **modificar**. `POST` acepta `expedienteId` opcional.
- `app/api/expedientes-archivo/[id]/route.ts` — **modificar**. Chunks vía `documento_id`; `SELECT` incluye `expediente_id`/`numero_folio`.
- `lib/expedientes-archivo-processing.ts` — **modificar**. Chunks vía `documento_id` + `expediente_id`.

---

### Task 1: Migración SQL — legajo, columnas, triggers, backfill, RLS

**Files:**
- Create: `docs/supabase/expediente-legajo.sql`

**Interfaces:**
- Produces: tabla `expedientes_archivo_legajos`; columnas `expedientes_archivo.expediente_id`
  (uuid, FK), `expedientes_archivo.numero_folio` (integer); columnas
  `expedientes_archivo_chunks.documento_id` (rename de `expediente_id`) y
  `expedientes_archivo_chunks.expediente_id` (uuid, FK al legajo, nuevo).

- [ ] **Step 1: Crear `docs/supabase/expediente-legajo.sql`**

```sql
-- ============================================================================
-- LEGAJO MULTIDOCUMENTO — expedientes_archivo_legajos + expediente_id en documentos
-- ============================================================================
-- Separa dos conceptos que hoy viven fusionados en `expedientes_archivo`:
--   * LEGAJO (`expedientes_archivo_legajos`, tabla nueva): la carpeta física que
--     se abre una vez y acumula documentos — ubicación física, SGD, serie,
--     oficina, persona interesada, asunto general.
--   * DOCUMENTO (`expedientes_archivo`, ya existe): cada PDF individual que
--     entra al legajo — tipo, fecha, folio correlativo DENTRO del legajo,
--     status de OCR/indexación, storage_path.
--
-- Retrocompatible: hay filas productivas en `expedientes_archivo`, así que esta
-- migración NO trunca nada. Cada documento sin `expediente_id` recibe su propio
-- legajo 1:1 (reusando el mismo id: mismo valor de PK en ambas tablas, sin tabla
-- de mapeo intermedia — son tablas distintas, no hay colisión). El id del
-- DOCUMENTO no cambia — todo lo que ya apunta a él (respuestas, vectores de
-- Pinecone, audit logs, enlaces guardados) sigue funcionando igual.
--
-- Prerrequisito: docs/supabase/rls-archivo-por-usuario.sql ya aplicado (provee
-- is_admin(), is_editor(), archivo_es_jefe(), archivo_oficina_id(), archivo_norm()).
--
-- Ejecutar UNA VEZ en el SQL Editor de Supabase. Idempotente.
-- ============================================================================

-- ── 1) Tabla `expedientes_archivo_legajos` ──────────────────────────────────

create table if not exists public.expedientes_archivo_legajos (
  id uuid primary key default gen_random_uuid(),
  -- Identificación del caso
  sgd_expediente        text,
  serie_documento       text,
  anio                  integer,
  asunto                text,
  materia               text,
  oficina               text,
  oficina_id            uuid references public.expedientes_oficinas(id) on delete set null,
  -- Persona interesada
  persona_tipo          text check (persona_tipo in ('natural','juridica')),
  persona_documento     text,
  persona_nombre        text,
  -- Almacenamiento físico (el legajo completo vive en un solo sitio)
  tipo_almacenamiento   text not null default 'folder' check (tipo_almacenamiento in
                          ('folder','archivador','caja','tomo','paquete','estante','otros')),
  nro_archivador        text,
  nro_paquete           text,
  empastado             boolean not null default false,
  color_archivador      text,
  nro_estante           text,
  nro_piso              text,
  nro_local             text,
  observaciones         text,
  -- Estado agregado: lo mantienen los triggers de la sección 4, nunca la app.
  documentos_count         integer not null default 0,
  documentos_error_count   integer not null default 0,
  documentos_pending_count integer not null default 0,
  -- Próximo folio a asignar dentro de este legajo (1, 2, 3...).
  next_folio             integer not null default 1,
  uploaded_by            uuid references auth.users(id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists idx_expedientes_archivo_legajos_sgd
  on public.expedientes_archivo_legajos(sgd_expediente);
create index if not exists idx_expedientes_archivo_legajos_serie
  on public.expedientes_archivo_legajos(serie_documento);
create index if not exists idx_expedientes_archivo_legajos_oficina_id
  on public.expedientes_archivo_legajos(oficina_id);
create index if not exists idx_expedientes_archivo_legajos_anio
  on public.expedientes_archivo_legajos(anio desc);
create index if not exists idx_expedientes_archivo_legajos_created_at
  on public.expedientes_archivo_legajos(created_at desc);

drop trigger if exists set_expedientes_archivo_legajos_updated_at on public.expedientes_archivo_legajos;
create trigger set_expedientes_archivo_legajos_updated_at
before update on public.expedientes_archivo_legajos
for each row execute function public.set_updated_at();

-- Resuelve oficina_id automáticamente desde el texto `oficina`, igual que ya
-- existe para expedientes_archivo (rls-archivo-por-usuario.sql).
create or replace function public.expedientes_archivo_legajos_resolve_oficina()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.oficina_id is null
     or (tg_op = 'UPDATE' and new.oficina is distinct from old.oficina) then
    select o.id into new.oficina_id
    from public.expedientes_oficinas o
    where public.archivo_norm(o.nombre) = public.archivo_norm(new.oficina)
    limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists expedientes_archivo_legajos_resolve_oficina_trg on public.expedientes_archivo_legajos;
create trigger expedientes_archivo_legajos_resolve_oficina_trg
  before insert or update of oficina on public.expedientes_archivo_legajos
  for each row execute function public.expedientes_archivo_legajos_resolve_oficina();

-- ── 2) `expediente_id` + `numero_folio` en el documento ─────────────────────

alter table public.expedientes_archivo
  add column if not exists expediente_id uuid references public.expedientes_archivo_legajos(id) on delete cascade;
alter table public.expedientes_archivo
  add column if not exists numero_folio integer;

create index if not exists idx_expedientes_archivo_expediente_id
  on public.expedientes_archivo(expediente_id);

-- ── 3) Chunks: `expediente_id` → `documento_id` (rename) + `expediente_id` nuevo (legajo) ──
-- El nombre viejo (apuntaba al PDF) queda ambiguo ahora que "expediente" pasa a
-- significar el legajo. Se renombra a `documento_id` (mismo FK, mismos datos;
-- ALTER ... RENAME actualiza sola la constraint unique(expediente_id,chunk_index)
-- a unique(documento_id,chunk_index), no hace falta tocarla) y se agrega un
-- `expediente_id` NUEVO que apunta al legajo, para que un resultado de búsqueda
-- pueda decir "este hit es del legajo X" sin un join extra.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'expedientes_archivo_chunks' and column_name = 'expediente_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_name = 'expedientes_archivo_chunks' and column_name = 'documento_id'
  ) then
    alter table public.expedientes_archivo_chunks rename column expediente_id to documento_id;
  end if;
end $$;

alter table public.expedientes_archivo_chunks
  add column if not exists expediente_id uuid references public.expedientes_archivo_legajos(id) on delete cascade;

create index if not exists idx_expedientes_archivo_chunks_expediente_id
  on public.expedientes_archivo_chunks(expediente_id);

-- ── 4) Triggers: folio correlativo + estado agregado ─────────────────────────

-- Asigna numero_folio al insertar un documento con expediente_id: toma
-- next_folio del legajo y lo incrementa en la misma sentencia (evita una
-- carrera entre dos subidas simultáneas al mismo legajo).
create or replace function public.archivo_legajo_assign_folio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.expediente_id is not null and new.numero_folio is null then
    update public.expedientes_archivo_legajos
    set next_folio = next_folio + 1
    where id = new.expediente_id
    returning next_folio - 1 into new.numero_folio;
  end if;
  return new;
end;
$$;

drop trigger if exists expedientes_archivo_assign_folio_trg on public.expedientes_archivo;
create trigger expedientes_archivo_assign_folio_trg
  before insert on public.expedientes_archivo
  for each row execute function public.archivo_legajo_assign_folio();

-- Recalcula los contadores agregados del legajo cuando cambian sus documentos
-- (alta, cambio de status, baja, o cambio de legajo). Evita referenciar NEW en
-- un DELETE (o OLD en un INSERT): PL/pgSQL no los tiene asignados y revienta.
create or replace function public.archivo_legajo_recompute_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
  previous_id uuid;
begin
  if tg_op = 'DELETE' then
    target_id := null;
    previous_id := old.expediente_id;
  elsif tg_op = 'INSERT' then
    target_id := new.expediente_id;
    previous_id := null;
  else
    target_id := new.expediente_id;
    previous_id := case
      when old.expediente_id is distinct from new.expediente_id then old.expediente_id
      else null
    end;
  end if;

  if target_id is not null then
    update public.expedientes_archivo_legajos e
    set
      documentos_count = (select count(*) from public.expedientes_archivo d where d.expediente_id = target_id),
      documentos_error_count = (select count(*) from public.expedientes_archivo d where d.expediente_id = target_id and d.status = 'error'),
      documentos_pending_count = (select count(*) from public.expedientes_archivo d where d.expediente_id = target_id and d.status in ('uploaded','processing')),
      updated_at = now()
    where e.id = target_id;
  end if;

  if previous_id is not null then
    update public.expedientes_archivo_legajos e
    set
      documentos_count = (select count(*) from public.expedientes_archivo d where d.expediente_id = previous_id),
      documentos_error_count = (select count(*) from public.expedientes_archivo d where d.expediente_id = previous_id and d.status = 'error'),
      documentos_pending_count = (select count(*) from public.expedientes_archivo d where d.expediente_id = previous_id and d.status in ('uploaded','processing')),
      updated_at = now()
    where e.id = previous_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists expedientes_archivo_recompute_status_trg on public.expedientes_archivo;
create trigger expedientes_archivo_recompute_status_trg
  after insert or update of status, expediente_id or delete on public.expedientes_archivo
  for each row execute function public.archivo_legajo_recompute_status();

-- ── 5) Backfill: cada documento sin legajo recibe uno propio (1:1) ──────────

insert into public.expedientes_archivo_legajos (
  id, sgd_expediente, serie_documento, anio, asunto, materia, oficina, oficina_id,
  persona_tipo, persona_documento, persona_nombre,
  tipo_almacenamiento, nro_archivador, nro_paquete, empastado, color_archivador,
  nro_estante, nro_piso, nro_local, observaciones,
  documentos_count, documentos_error_count, documentos_pending_count,
  next_folio, uploaded_by, created_at, updated_at
)
select
  d.id, d.sgd_expediente, d.serie_documento, d.anio, d.asunto, d.materia, d.oficina, d.oficina_id,
  d.persona_tipo, d.persona_documento, d.persona_nombre,
  coalesce(d.tipo_almacenamiento::text, 'folder'), d.nro_archivador, d.nro_paquete,
  coalesce(d.empastado, false), d.color_archivador,
  d.nro_estante, d.nro_piso, d.nro_local, d.observaciones,
  1,
  case when d.status = 'error' then 1 else 0 end,
  case when d.status in ('uploaded','processing') then 1 else 0 end,
  2, d.uploaded_by, d.created_at, d.updated_at
from public.expedientes_archivo d
where d.expediente_id is null
on conflict (id) do nothing;

update public.expedientes_archivo d
set expediente_id = d.id, numero_folio = 1
where d.expediente_id is null;

update public.expedientes_archivo_chunks c
set expediente_id = d.expediente_id
from public.expedientes_archivo d
where c.documento_id = d.id and c.expediente_id is null;

-- ── 6) RLS de `expedientes_archivo_legajos` (mismo patrón que expedientes_archivo) ──

alter table public.expedientes_archivo_legajos enable row level security;

do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'expedientes_archivo_legajos'
  loop
    execute format('drop policy %I on public.expedientes_archivo_legajos', pol.policyname);
  end loop;
end $$;

create policy expedientes_archivo_legajos_scoped_select on public.expedientes_archivo_legajos
  for select to authenticated
  using (
    public.is_admin()
    or uploaded_by = auth.uid()
    or (public.archivo_es_jefe() and oficina_id is not null and oficina_id = public.archivo_oficina_id())
  );

create policy expedientes_archivo_legajos_scoped_insert on public.expedientes_archivo_legajos
  for insert to authenticated
  with check (public.is_editor() and uploaded_by = auth.uid());

create policy expedientes_archivo_legajos_scoped_update on public.expedientes_archivo_legajos
  for update to authenticated
  using (
    public.is_editor()
    and (
      public.is_admin()
      or uploaded_by = auth.uid()
      or (public.archivo_es_jefe() and oficina_id is not null and oficina_id = public.archivo_oficina_id())
    )
  )
  with check (
    public.is_editor()
    and (
      public.is_admin()
      or uploaded_by = auth.uid()
      or (public.archivo_es_jefe() and oficina_id is not null and oficina_id = public.archivo_oficina_id())
    )
  );

create policy expedientes_archivo_legajos_scoped_delete on public.expedientes_archivo_legajos
  for delete to authenticated
  using (
    public.is_editor()
    and (
      public.is_admin()
      or uploaded_by = auth.uid()
      or (public.archivo_es_jefe() and oficina_id is not null and oficina_id = public.archivo_oficina_id())
    )
  );

-- ── 7) Verificación rápida ───────────────────────────────────────────────────
-- select count(*) from public.expedientes_archivo_legajos;
-- select id, expediente_id, numero_folio from public.expedientes_archivo limit 5;
-- select documento_id, expediente_id from public.expedientes_archivo_chunks limit 5;
-- select tablename, policyname from pg_policies where schemaname='public' and tablename='expedientes_archivo_legajos';
```

- [ ] **Step 2: Commit** (fichero de documentación/migración manual — no lo corre CI)

```bash
git add docs/supabase/expediente-legajo.sql
git commit -m "feat(expedientes-archivo): migracion sql del legajo multidocumento (manual, no aplicada aun)"
```

---

### Task 2: Tipos compartidos — `ExpedienteLegajo` / `ExpedienteLegajoItem`

**Files:**
- Modify: `lib/expedientes-archivo.ts`
- Modify: `app/components/expedientes-archivo/types.ts`

**Interfaces:**
- Produces: `ExpedienteArchivo.expediente_id: string | null`,
  `ExpedienteArchivo.numero_folio: number | null`, tipo `ExpedienteLegajo`
  (server); `ExpedienteItem.expediente_id`/`numero_folio`, tipo
  `ExpedienteLegajoItem` (cliente).

- [ ] **Step 1: `lib/expedientes-archivo.ts` — campos nuevos en `ExpedienteArchivo`.**
  Justo después de `oficina_id: string | null;` (dentro del tipo `ExpedienteArchivo`):

```ts
  // Legajo al que pertenece este documento (ver ExpedienteLegajo más abajo).
  // Null solo si el backfill de docs/supabase/expediente-legajo.sql no corrió
  // aún — no debería pasar en producción tras aplicar esa migración.
  expediente_id: string | null;
  // Folio correlativo DENTRO del legajo (1, 2, 3...), lo asigna un trigger al
  // insertar. No confundir con el campo `folio` (nº de páginas del PDF).
  numero_folio: number | null;
```

- [ ] **Step 2: `lib/expedientes-archivo.ts` — tipo `ExpedienteLegajo`.** Después
  del cierre del tipo `ExpedienteArchivo` (antes de `export function normalizePersonaTipo`):

```ts
// El legajo (expedientes_archivo_legajos): la carpeta física que agrupa uno o
// más documentos. Ver docs/supabase/expediente-legajo.sql para el porqué está
// separado de ExpedienteArchivo (el documento individual).
export type ExpedienteLegajo = {
  id: string;
  sgd_expediente: string | null;
  serie_documento: string | null;
  anio: number | null;
  asunto: string | null;
  materia: string | null;
  oficina: string | null;
  oficina_id: string | null;
  persona_tipo: PersonaTipo | null;
  persona_documento: string | null;
  persona_nombre: string | null;
  tipo_almacenamiento: ContenedorTipo | null;
  nro_archivador: string | null;
  nro_paquete: string | null;
  empastado: boolean | null;
  color_archivador: string | null;
  nro_estante: string | null;
  nro_piso: string | null;
  nro_local: string | null;
  observaciones: string | null;
  documentos_count: number;
  documentos_error_count: number;
  documentos_pending_count: number;
  next_folio: number;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
};
```

- [ ] **Step 3: `app/components/expedientes-archivo/types.ts` — campos nuevos
  en `ExpedienteItem`.** Justo después de `folio: string | null;`:

```ts
  // Legajo al que pertenece este documento + folio correlativo dentro de él
  // (ver lib/expedientes-archivo.ts -> ExpedienteArchivo para el porqué).
  expediente_id: string | null;
  numero_folio: number | null;
```

- [ ] **Step 4: `app/components/expedientes-archivo/types.ts` — tipo
  `ExpedienteLegajoItem`.** Después del cierre del tipo `DuplicateMatch`
  (antes de `/** Resultado de autocompletar PDF... */`):

```ts
/** Legajo (expedientes_archivo_legajos): agrupa uno o más documentos. Para el
 *  selector "añadir documento a legajo existente" (fase de UI, fuera de este plan). */
export type ExpedienteLegajoItem = {
  id: string;
  sgd_expediente: string | null;
  serie_documento: string | null;
  anio: number | null;
  asunto: string | null;
  materia: string | null;
  oficina: string | null;
  tipo_almacenamiento: string | null;
  nro_archivador: string | null;
  nro_paquete: string | null;
  nro_estante: string | null;
  nro_piso: string | null;
  nro_local: string | null;
  documentos_count: number;
  documentos_error_count: number;
  documentos_pending_count: number;
  created_at: string;
};
```

- [ ] **Step 5: Verificar** — `npx tsc --noEmit`. Expected: sin errores nuevos
  (los dos campos nuevos en `ExpedienteArchivo`/`ExpedienteItem` son opcionales
  en la práctica porque nada los usa todavía como requeridos en runtime — pero
  al no tener `?`, cualquier literal existente que construya un `ExpedienteArchivo`/
  `ExpedienteItem` a mano SIN esos campos daría error de tipos; si `tsc` señala
  alguno, añadir `expediente_id: null, numero_folio: null` a ese literal).

- [ ] **Step 6: Commit**

```bash
git add lib/expedientes-archivo.ts app/components/expedientes-archivo/types.ts
git commit -m "feat(expedientes-archivo): tipos del legajo (ExpedienteLegajo/ExpedienteLegajoItem)"
```

---

### Task 3: Acción cliente `searchLegajos`

**Files:**
- Modify: `lib/expedientes-archivo-actions.ts`

**Interfaces:**
- Consumes: de Task 2, `ExpedienteLegajoItem`.
- Produces: `searchLegajos(query: string, limit?: number): Promise<{ legajos: ExpedienteLegajoItem[] }>`.

- [ ] **Step 1: Import del tipo.** En la línea del import de tipos (línea 17),
  añadir `ExpedienteLegajoItem` a la lista:

```ts
import type { ChatAnswer, DuplicateMatch, ExpedienteLegajoItem, PdfInventory, SearchResult } from "@/app/components/expedientes-archivo/types";
```

- [ ] **Step 2: Función `searchLegajos`.** Después de `detectDuplicates`
  (tras su cierre, antes de `/** Llama al endpoint /extract... */`):

```ts
/** Busca legajos existentes (para el selector "añadir documento a legajo
 *  existente" del wizard de Subir). Query vacía = los más recientes. */
export async function searchLegajos(
  query: string,
  limit: number = 10,
): Promise<{ legajos: ExpedienteLegajoItem[] }> {
  const empty = { legajos: [] as ExpedienteLegajoItem[] };
  const q = query.trim();
  if (q.length > 0 && q.length < 2) return empty;
  try {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    qs.set("limit", String(limit));
    const res = await fetch(`/api/expedientes-archivo/legajos?${qs.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) return empty;
    const data = (await res.json().catch(() => ({}))) as { legajos?: ExpedienteLegajoItem[] };
    return { legajos: data.legajos ?? [] };
  } catch {
    return empty;
  }
}
```

- [ ] **Step 3: Verificar** — `npx tsc --noEmit && npx eslint lib/expedientes-archivo-actions.ts`.
  Expected: sin errores (el endpoint aún no existe — eso es la Tarea 4 — pero
  el tipo y la función compilan igual, es solo un `fetch` a una URL).

- [ ] **Step 4: Commit**

```bash
git add lib/expedientes-archivo-actions.ts
git commit -m "feat(expedientes-archivo): accion cliente para buscar legajos existentes"
```

---

### Task 4: `GET /api/expedientes-archivo/legajos` — buscar/listar legajos

**Files:**
- Create: `app/api/expedientes-archivo/legajos/route.ts`

**Interfaces:**
- Consumes: de Task 2, `ExpedienteLegajo`; de `lib/auth.ts`,
  `getArchivoScopeLevel`, `requireUser`; de `lib/entity-utils.ts`, `entitiesMatch`.
- Produces: `GET /api/expedientes-archivo/legajos?q=&limit=` → `{ legajos: ExpedienteLegajo[] }`.

- [ ] **Step 1: Crear el fichero**

```ts
import { NextResponse } from "next/server";
import { getArchivoScopeLevel, requireUser } from "@/lib/auth";
import { entitiesMatch } from "@/lib/entity-utils";
import type { ExpedienteLegajo } from "@/lib/expedientes-archivo";
import { getSupabaseServerConfig, supabaseRest } from "@/lib/supabase-server";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SELECT =
  "id,sgd_expediente,serie_documento,anio,asunto,materia,oficina,oficina_id,tipo_almacenamiento,nro_archivador,nro_paquete,nro_estante,nro_piso,nro_local,documentos_count,documentos_error_count,documentos_pending_count,uploaded_by,created_at";

// Busca/lista legajos: base del selector "añadir documento a legajo existente"
// del wizard de Subir (fase de UI, fuera de este plan). Mismo modelo de scope
// que GET /api/expedientes-archivo: admin todo; jefe su oficina; el resto solo
// lo que subió.
export async function GET(request: Request) {
  try {
    const auth = await requireUser();
    if ("error" in auth) {
      return auth.error;
    }

    const rl = checkRateLimit(getRateLimitKey(request, auth.user.id, "list"), RATE_LIMITS.search);
    if (!rl.allowed) {
      return rateLimitResponse(rl);
    }

    getSupabaseServerConfig();

    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim();
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") ?? "10", 10) || 10));

    const scope = getArchivoScopeLevel(auth.user);
    const useOficinaId = scope === "oficina" && Boolean(auth.user.oficinaId);
    const scopeClause = () => {
      if (scope === "oficina") {
        return useOficinaId
          ? `&oficina_id=eq.${encodeURIComponent(auth.user.oficinaId ?? "")}`
          : `&oficina=eq.${encodeURIComponent(auth.user.entity ?? "")}`;
      }
      if (scope === "own") {
        return `&uploaded_by=eq.${encodeURIComponent(auth.user.id)}`;
      }
      return "";
    };

    let query = `expedientes_archivo_legajos?select=${SELECT}&order=created_at.desc&limit=${limit}`;
    query += scopeClause();
    if (q) {
      // Dentro de un arbol logico or=(...) la sintaxis de PostgREST es
      // columna.operador.valor (con puntos); los valores con espacios/°/comas
      // van entrecomillados para que el parser no los confunda con delimitadores.
      const quote = (value: string) => `"${encodeURIComponent(value.replace(/"/g, '\\"'))}"`;
      const safe = q.replace(/[%_]/g, (m) => `\\${m}`);
      query += `&or=(sgd_expediente.ilike.${quote(`%${safe}%`)},serie_documento.ilike.${quote(`%${safe}%`)},asunto.ilike.${quote(`%${safe}%`)})`;
    }

    let legajos = await supabaseRest<ExpedienteLegajo[]>(query);

    // Post-filtro robusto: el filtro PostgREST por texto es case-sensitive, así
    // que re-verificamos con entitiesMatch (normaliza acentos/mayúsculas/espacios).
    if (scope === "oficina" && !useOficinaId) {
      legajos = legajos.filter((l) => entitiesMatch(l.oficina, auth.user.entity));
    }

    return NextResponse.json({ legajos });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo listar los legajos", legajos: [] },
      { status: 503 },
    );
  }
}
```

- [ ] **Step 2: Verificar** — `npx tsc --noEmit && npx eslint app/api/expedientes-archivo/legajos/route.ts`.
  Expected: sin errores. (No hay test dedicado: sigue el patrón real del repo,
  donde `duplicates/route.ts` — misma forma — tampoco tiene test de ruta; solo
  se prueba con el suite de tsc/eslint/build, per CLAUDE.md.)

- [ ] **Step 3: Commit**

```bash
git add app/api/expedientes-archivo/legajos/route.ts
git commit -m "feat(expedientes-archivo): endpoint para buscar legajos existentes"
```

---

### Task 5: `GET /api/expedientes-archivo/legajos/[id]` — detalle + documentos

**Files:**
- Create: `app/api/expedientes-archivo/legajos/[id]/route.ts`

**Interfaces:**
- Consumes: de Task 2, `ExpedienteLegajo`/`ExpedienteArchivo`; de `lib/auth.ts`, `canAccessArchivoRow`, `requireUser`.
- Produces: `GET /api/expedientes-archivo/legajos/[id]` → `{ legajo: ExpedienteLegajo, documentos: Documento[] }`.

- [ ] **Step 1: Crear el fichero**

```ts
import { NextResponse } from "next/server";
import { canAccessArchivoRow, requireUser } from "@/lib/auth";
import type { ExpedienteArchivo, ExpedienteLegajo } from "@/lib/expedientes-archivo";
import { getSupabaseServerConfig, supabaseRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LEGAJO_SELECT =
  "id,sgd_expediente,serie_documento,anio,asunto,materia,oficina,oficina_id,persona_tipo,persona_documento,persona_nombre,tipo_almacenamiento,nro_archivador,nro_paquete,empastado,color_archivador,nro_estante,nro_piso,nro_local,observaciones,documentos_count,documentos_error_count,documentos_pending_count,uploaded_by,created_at,updated_at";

const DOCUMENTO_SELECT =
  "id,numero_folio,tipo_documento,title,anio,status,error_message,file_name,file_size,created_at";

type DocumentoResumen = Pick<
  ExpedienteArchivo,
  "id" | "numero_folio" | "tipo_documento" | "title" | "anio" | "status" | "error_message" | "file_name" | "file_size" | "created_at"
>;

// Detalle de un legajo + la lista de sus documentos (folios), ordenados por
// numero_folio. Base del futuro slide-over multi-documento (fase de UI, fuera
// de este plan).
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUser();
    if ("error" in auth) {
      return auth.error;
    }
    getSupabaseServerConfig();
    const { id } = await context.params;

    const [legajo] = await supabaseRest<ExpedienteLegajo[]>(
      `expedientes_archivo_legajos?id=eq.${id}&select=${LEGAJO_SELECT}`,
    );
    if (!legajo) {
      return NextResponse.json({ error: "Legajo no encontrado" }, { status: 404 });
    }
    if (
      !canAccessArchivoRow(auth.user, {
        oficina: legajo.oficina,
        oficinaId: legajo.oficina_id,
        owner: legajo.uploaded_by,
      })
    ) {
      return NextResponse.json({ error: "Legajo no encontrado" }, { status: 404 });
    }

    const documentos = await supabaseRest<DocumentoResumen[]>(
      `expedientes_archivo?expediente_id=eq.${id}&select=${DOCUMENTO_SELECT}&order=numero_folio.asc`,
    );

    return NextResponse.json({ legajo, documentos });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo obtener el legajo" },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Verificar** — `npx tsc --noEmit && npx eslint app/api/expedientes-archivo/legajos/[id]/route.ts`.
  Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add "app/api/expedientes-archivo/legajos/[id]/route.ts"
git commit -m "feat(expedientes-archivo): endpoint de detalle de legajo con sus documentos"
```

---

### Task 6: `POST /api/expedientes-archivo` — adjuntar a legajo existente o crear uno nuevo

**Files:**
- Modify: `app/api/expedientes-archivo/route.ts`

**Interfaces:**
- Consumes: de Task 2, `ExpedienteLegajo`.
- Produces: el `POST` ahora acepta un campo de formulario opcional `expedienteId`;
  si viene, valida acceso y adjunta el documento a ese legajo; si no, crea un
  legajo nuevo primero (comportamiento actual, ahora explícito en dos pasos).

- [ ] **Step 1: Imports.** Añadir `canAccessArchivoRow` al import de `@/lib/auth`
  (línea 3) y `ExpedienteLegajo` al import de `@/lib/expedientes-archivo` (línea 5-11):

```ts
import { getArchivoScopeLevel, canAccessArchivoRow, requireDecOrAreaUsuaria, requireUser } from "@/lib/auth";
import {
  ARCHIVO_COLORES,
  type ExpedienteArchivo,
  type ExpedienteLegajo,
  normalizeCatalogValue,
  normalizeContenedorTipo,
  normalizePersonaTipo,
} from "@/lib/expedientes-archivo";
```

(`getArchivoScopeLevel` ya estaba importado en este fichero — se deja listado
completo para que el diff sea inequívoco; si el editor marca duplicado, es
porque ya estaba y solo hace falta añadir `canAccessArchivoRow`.)

- [ ] **Step 2: `SELECT` de la lista (GET) incluye los campos del legajo.**
  Línea 33, añadir al final de la lista de columnas:

```ts
const SELECT =
  "id,sgd_expediente,serie_documento,anio,tipo_documento,asunto,materia,resumen,title,oficina,tipo_almacenamiento,nro_archivador,nro_paquete,empastado,color_archivador,nro_estante,nro_piso,nro_local,folio,observaciones,persona_tipo,persona_documento,persona_nombre,file_name,file_size,mime_type,storage_bucket,storage_path,status,error_message,metadata,uploaded_by,created_at,updated_at,expediente_id,numero_folio";
```

- [ ] **Step 3: Resolver el legajo antes de armar el `payload` del documento.**
  En el handler `POST`, justo después de `const title = formText(formData, "title", 300) ?? file.name;`
  y **antes** de `const storagePath = ...` (para no subir el archivo si el
  `expedienteId` indicado no es válido), insertar:

```ts
    // Legajo: si viene `expedienteId`, se adjunta el documento a ese legajo
    // existente (debe existir y el usuario debe poder acceder a él); si no, se
    // crea un legajo nuevo con los campos de identificación del caso — mismo
    // comportamiento de siempre, ahora explícito en dos pasos.
    const expedienteIdInput = formText(formData, "expedienteId", 60);
    let legajoId: string;
    if (expedienteIdInput) {
      const [legajo] = await supabaseRest<ExpedienteLegajo[]>(
        `expedientes_archivo_legajos?id=eq.${expedienteIdInput}&select=id,oficina,oficina_id,uploaded_by`,
      );
      if (!legajo) {
        return NextResponse.json({ error: "El legajo indicado no existe" }, { status: 400 });
      }
      if (
        !canAccessArchivoRow(auth.user, {
          oficina: legajo.oficina,
          oficinaId: legajo.oficina_id,
          owner: legajo.uploaded_by,
        })
      ) {
        return NextResponse.json({ error: "El legajo indicado no existe" }, { status: 400 });
      }
      legajoId = legajo.id;
    } else {
      const legajoPayload: Record<string, unknown> = { uploaded_by: auth.user.id };
      const legajoFields: Array<[string, unknown]> = [
        ["sgd_expediente", formText(formData, "sgdExpediente", 120)],
        ["serie_documento", formText(formData, "serieDocumento", 120)],
        ["anio", formInt(formData, "anio")],
        ["asunto", formText(formData, "asunto")],
        ["materia", formText(formData, "materia", 200)],
        [
          "oficina",
          (() => {
            const fromForm = formText(formData, "oficina", 200);
            if (auth.user.isAdmin) return fromForm;
            if (fromForm && !entitiesMatch(fromForm, auth.user.entity)) return auth.user.entity;
            return fromForm || auth.user.entity;
          })(),
        ],
        ["persona_tipo", normalizePersonaTipo(formData.get("personaTipo"))],
        ["persona_documento", formText(formData, "personaDocumento", 20)],
        ["persona_nombre", formText(formData, "personaNombre", 200)],
        ["nro_archivador", formText(formData, "nroArchivador", 60)],
        ["nro_paquete", formText(formData, "nroPaquete", 60)],
        ["color_archivador", normalizeCatalogValue(formData.get("colorArchivador"), ARCHIVO_COLORES)],
        ["nro_estante", formText(formData, "nroEstante", 60)],
        ["nro_piso", formText(formData, "nroPiso", 60)],
        ["nro_local", formText(formData, "nroLocal", 60)],
        ["observaciones", formText(formData, "observaciones", 1000)],
      ];
      for (const [key, value] of legajoFields) {
        if (value !== null && value !== "" && value !== undefined) {
          legajoPayload[key] = value;
        }
      }
      const tipoAlmLegajo = formData.get("tipoAlmacenamiento");
      if (typeof tipoAlmLegajo === "string" && tipoAlmLegajo.trim()) {
        legajoPayload.tipo_almacenamiento = normalizeContenedorTipo(tipoAlmLegajo);
      }
      const empastadoLegajoRaw = formData.get("empastado");
      if (empastadoLegajoRaw === "si" || empastadoLegajoRaw === "true") legajoPayload.empastado = true;
      else if (empastadoLegajoRaw === "no" || empastadoLegajoRaw === "false") legajoPayload.empastado = false;

      const insertedLegajo = await supabaseRest<ExpedienteLegajo[]>(`expedientes_archivo_legajos?select=id`, {
        body: JSON.stringify(legajoPayload),
        method: "POST",
      });
      legajoId = insertedLegajo[0].id;
    }

```

- [ ] **Step 4: Incluir `expediente_id` en el `payload` del documento.** En el
  objeto `payload` que ya arma el documento (justo después de
  `metadata: { uploadSource: "web" },`), añadir la línea:

```ts
      metadata: { uploadSource: "web" },
      expediente_id: legajoId,
```

  (`numero_folio` NO se setea aquí: lo asigna el trigger `archivo_legajo_assign_folio()`.)

- [ ] **Step 5: Verificar** — `npx tsc --noEmit && npx eslint app/api/expedientes-archivo/route.ts`.
  Expected: sin errores. Confirmar que `formInt`/`entitiesMatch`/`normalizePersonaTipo`/
  `normalizeCatalogValue`/`normalizeContenedorTipo`/`ARCHIVO_COLORES` siguen
  resolviendo (ya estaban importados en este fichero antes de esta tarea).

- [ ] **Step 6: Commit**

```bash
git add app/api/expedientes-archivo/route.ts
git commit -m "feat(expedientes-archivo): subir un documento a un legajo nuevo o a uno existente"
```

---

### Task 7: Chunks vía `documento_id` + `expediente_id` (legajo) en el pipeline de indexación

**Files:**
- Modify: `app/api/expedientes-archivo/[id]/route.ts`
- Modify: `lib/expedientes-archivo-processing.ts`

**Interfaces:**
- Consumes: de Task 1, columna `expedientes_archivo_chunks.documento_id`
  (rename) y `expedientes_archivo_chunks.expediente_id` (nueva); de Task 2,
  `ExpedienteArchivo.expediente_id`.

- [ ] **Step 1: `[id]/route.ts` — `SELECT` incluye `expediente_id`/`numero_folio`.**
  Línea 38, añadir al final:

```ts
const SELECT =
  "id,sgd_expediente,serie_documento,anio,tipo_documento,asunto,materia,resumen,title,oficina,oficina_id,tipo_almacenamiento,nro_archivador,nro_paquete,empastado,color_archivador,nro_estante,nro_piso,nro_local,folio,observaciones,persona_tipo,persona_documento,persona_nombre,file_name,file_size,mime_type,storage_bucket,storage_path,status,error_message,metadata,uploaded_by,created_at,updated_at,expediente_id,numero_folio";
```

- [ ] **Step 2: `[id]/route.ts` — `getVectorIds` usa `documento_id`.** Línea 68-75:

```ts
async function getVectorIds(expedienteId: string) {
  const chunks = await supabaseRest<ChunkVector[]>(
    `expedientes_archivo_chunks?documento_id=eq.${expedienteId}&select=pinecone_vector_id`,
  );
  return chunks
    .map((chunk) => chunk.pinecone_vector_id)
    .filter((id): id is string => Boolean(id));
}
```

- [ ] **Step 3: `[id]/route.ts` — el `DELETE` de chunks en reindex (POST) usa
  `documento_id`.** Línea 155:

```ts
        await supabaseRest(`expedientes_archivo_chunks?documento_id=eq.${id}`, { method: "DELETE" });
```

- [ ] **Step 4: `[id]/route.ts` — el `DELETE` de chunks en reemplazo (PUT) usa
  `documento_id`.** Línea 370:

```ts
        await supabaseRest(`expedientes_archivo_chunks?documento_id=eq.${id}`, { method: "DELETE" });
```

- [ ] **Step 5: `expedientes-archivo-processing.ts` — tipo `ExpedienteChunkInsert`.**
  Línea 84-92:

```ts
type ExpedienteChunkInsert = {
  documento_id: string;
  expediente_id: string | null;
  chunk_index: number;
  page_start: number | null;
  page_end: number | null;
  content: string;
  pinecone_vector_id: string;
  metadata: Record<string, unknown>;
};
```

- [ ] **Step 6: `expedientes-archivo-processing.ts` — `chunkRows` incluye ambos ids.**
  Línea 335-350:

```ts
    const chunkRows: ExpedienteChunkInsert[] = chunks.map((chunk) => ({
      chunk_index: chunk.index,
      content: chunk.content,
      documento_id: expediente.id,
      expediente_id: expediente.expediente_id,
      metadata: {
        serieDocumento,
        anio: Number.isFinite(anio) ? anio : null,
        materia,
        tipoDocumento,
        pageEnd: chunk.pageEnd,
        pageStart: chunk.pageStart,
      },
      page_end: chunk.pageEnd,
      page_start: chunk.pageStart,
      pinecone_vector_id: `expediente::${expediente.id}::${chunk.index}`,
    }));
```

- [ ] **Step 7: `expedientes-archivo-processing.ts` — el `DELETE` de chunks en
  el `catch` usa `documento_id`.** Línea 448:

```ts
    await supabaseRest(`expedientes_archivo_chunks?documento_id=eq.${expediente.id}`, {
      method: "DELETE",
    }).catch(() => undefined);
```

- [ ] **Step 8: Verificar** —

```bash
npx tsc --noEmit
npx eslint app/api/expedientes-archivo/[id]/route.ts lib/expedientes-archivo-processing.ts
npx vitest run tests/expedientes-archivo.test.ts
```

  Expected: sin errores; los 24 tests existentes siguen en verde (ninguno toca
  chunks directamente — cubren `expedienteSearchSchema`, extractores, catálogo
  de ubicación física).

- [ ] **Step 9: Commit**

```bash
git add "app/api/expedientes-archivo/[id]/route.ts" lib/expedientes-archivo-processing.ts
git commit -m "refactor(expedientes-archivo): los chunks referencian documento_id, no expediente_id"
```

---

## Self-Review

- **Cobertura del spec:** tabla legajo + columnas + triggers + backfill + RLS
  → Task 1. Tipos compartidos → Task 2. Selector futuro de legajo (acción
  cliente) → Task 3. Endpoints de búsqueda/detalle de legajo → Tasks 4-5.
  Subir a legajo nuevo/existente → Task 6. Ambigüedad `expediente_id` en
  chunks (documento vs legajo) → Task 7. Explícitamente fuera de este plan:
  UI del wizard/slide-over, re-scope de bulk/duplicados/búsqueda, adjuntar
  respuesta como documento — quedan anotados en Global Constraints como
  fases de seguimiento.
- **Placeholders:** ninguno; cada paso de código tiene el contenido completo,
  incluida la migración SQL entera.
- **Consistencia de tipos:** `ExpedienteLegajo` (Task 2) lo consumen las
  Tasks 4, 5 y 6 con el mismo shape; `ExpedienteLegajoItem` (Task 2) lo
  consume Task 3; `ExpedienteArchivo.expediente_id`/`numero_folio` (Task 2)
  los consume Task 7 (`expediente.expediente_id` al armar `chunkRows`) y
  Task 6 (`payload.expediente_id`). `documento_id`/`expediente_id` en chunks
  (Task 1, SQL) coincide exactamente con los nombres usados en Task 7.

## Riesgos / a confirmar al ejecutar

- **La Tarea 1 es SQL manual.** Ninguna de las Tareas 2-7 funciona en
  producción hasta que alguien la corra en el SQL Editor de Supabase — avisar
  esto explícitamente al entregar la fase completa (por CLAUDE.md).
- **Duplicación de campos legajo/documento en el `POST` (Task 6):** al crear
  un legajo nuevo, sus campos de identificación (SGD, serie, oficina, persona,
  ubicación) se copian TAMBIÉN al documento individual (el `payload` original
  no se tocó). Es deliberado — evita restructurar el contrato completo del
  formulario en esta fase — pero es duplicación real que una fase de UI/limpieza
  futura debería resolver (dejar de pedir esos campos por cada documento
  cuando se adjunta a un legajo existente).
- **`getArchivoScopeLevel` importado pero no usado directamente en Task 6**
  fuera de lo que ya usaba el fichero — si `tsc`/`eslint` marcan import sin
  uso, es porque ya estaba importado antes de esta tarea (confirmar con
  `git diff` antes de tocarlo dos veces).
- **Carrera en `next_folio`:** el trigger de folio hace `UPDATE ... SET
  next_folio = next_folio + 1 ... RETURNING next_folio - 1`, que en Postgres
  toma el lock de fila del legajo antes de leer el valor — dos inserts
  concurrentes al mismo legajo se serializan correctamente sin duplicar folio,
  pero conviene confirmarlo con una prueba manual de dos subidas simultáneas
  al mismo legajo antes de dar la fase por cerrada en producción.
