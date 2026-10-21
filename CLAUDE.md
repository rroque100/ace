# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

ACE es una aplicación web de contratación pública peruana (Ley 32069 + su
Reglamento): gestión documental, RAG jurídico con citas verificables, y
generación de documentos oficiales (.docx/.xlsx) a partir de plantillas OECE.

**El código, los comentarios y los commits están en español.** Escribe en
español y respeta el vocabulario del dominio (necesidad, expediente, hito, DEC,
área usuaria, requerimiento). No traduzcas términos legales al inglés.

## Comandos

```bash
npm install --legacy-peer-deps   # obligatorio: hay conflictos de peer deps
npm run dev                      # localhost:3000
npm run lint                     # eslint app next.config.ts eslint.config.mjs
npm run typecheck                # tsc --noEmit
npm run test                     # vitest run
npx vitest run tests/x.test.ts   # un solo fichero
npx vitest run -t "nombre"       # un solo caso
npm run worker:indexing:once     # drenar la cola de indexación a mano
```

CI (`.github/workflows/ci.yml`) corre lint + typecheck + test + build. Los tres
primeros son rápidos; pásalos antes de dar algo por terminado.

Para levantar la app usa el preview del entorno (`.claude/launch.json`), no
`npm run dev` por Bash.

## Arquitectura

Next.js 16 (App Router) + React 19 + TypeScript estricto. Supabase
(PostgreSQL + Auth + Storage), Pinecone (vectorial), Cohere (reranking).
Despliegue en Netlify. `docs/ARQUITECTURA.md` está desactualizado (dice Vercel).

### Acceso a datos: dos caminos, y no son intercambiables

- `lib/supabase/server.ts` → `createClient()`: cliente `@supabase/ssr` atado a
  las cookies. Actúa con el JWT del usuario, **respeta RLS**. Para server
  components y para leer la sesión.
- `lib/supabase-server.ts` → `supabaseRest()` (service_role, **salta RLS**) y
  `supabaseUserRest()` (JWT del usuario, respeta RLS). PostgREST directo por
  `fetch`. Es lo que usan casi todas las rutas de `app/api/`.

Elegir mal el helper es el fallo de seguridad más fácil de cometer aquí: si los
datos son privados del usuario, `supabaseUserRest`. `supabaseRest` solo para
operaciones que legítimamente actúan como el sistema.

### Autorización

La sesión se refresca en el **proxy** (`proxy.ts` → `lib/supabase/middleware.ts`),
no en un `middleware.ts`. Ahí vive el allowlist `isPublicPath`: todo lo demás
exige sesión, así que cualquier QA visual sin credenciales acaba en el login.

Toda ruta de `app/api/` empieza por un guard de `lib/auth.ts`:
`requireUser` / `requireAdmin` / `requireDec` / `requireLegal` /
`requireCapability(cap)`. Devuelven `{ user }` o `{ error: NextResponse }`; el
patrón es `if ("error" in auth) return auth.error`.

Los roles y sus capacidades viven en **`lib/permisos-contratacion.ts`** (fuente
única). No redefinas permisos en la ruta.

El archivo de expedientes tiene además un scope jerárquico —
`getArchivoScopeLevel` → `all` (admin) / `oficina` (jefe) / `own` (resto) — con
`canAccessArchivoRow` como comprobación por fila. Está espejado en políticas RLS.

### Proveedor de IA: una sola indirección

Todo el código llama a `responses.create` de OpenAI. `lib/openai-server.ts`
envuelve el cliente en un Proxy que traduce `responses` → `chat.completions`
cuando el proveedor es Gemini o Z.ai. Precedencia por variable de entorno:
Gemini → Z.ai → OpenAI.

**No metas ramas por proveedor en los ~26 puntos de llamada.** Si algo no
funciona con un proveedor, se arregla en el shim.

### RAG y anti-alucinación

`lib/legal-chat.ts` orquesta recuperación → gating → generación → verificación.
La última capa es `lib/citation-faithfulness.ts`: determinista y sin red,
comprueba que todo dato numérico específico citado con `[F#]` aparezca de verdad
en el fragmento citado. Si tocas la generación de respuestas, no puentees esa
verificación: es lo que impide que una cifra inventada salga con aspecto de cita
legal.

### Indexación asíncrona de PDFs

Subida → Storage → extracción (OCR con `pdfjs-dist` + `@napi-rs/canvas` si el PDF
es escaneado) → chunking → embeddings → Pinecone. La cola vive en
`lib/indexing-queue.ts`; la drena `netlify/functions/indexing-drain.mjs` cada 5
minutos, con `scripts/indexing-worker.mjs` como respaldo manual.

### Año fiscal

Casi todas las tablas están particionadas por año. `lib/year-utils.ts`
(server-safe) y `lib/year-context.tsx` (cliente); las rutas leen el año con
`getYearFromRequest(request)` (`?year=2026`). `entity_settings` queda fuera a
propósito y su PK sigue siendo `(id)`.

## Migraciones SQL: manuales

No hay herramienta de migraciones. Los `.sql` de `docs/supabase/` se ejecutan a
mano en el SQL Editor de Supabase. Consecuencias:

- Una columna nueva **no existe hasta que alguien corre el SQL**. Si añades una,
  crea el fichero en `docs/supabase/` y dilo explícitamente al entregar.
- Hay fallbacks defensivos para cuando el SQL aún no se ha aplicado (ver el
  reintento por capas en `getSessionUser`). Al añadir uno, que sea acotado a esa
  situación: los fallbacks silenciosos genéricos ya escondieron fallos reales
  aquí. Un `catch` que se traga todo es un fallo, no una precaución.

## Tailwind: activación acotada, no global

`app/styles.css` son ~21 000 líneas de CSS propio del que dependen más de veinte
páginas. Encender Tailwind entero inyectaría Preflight y las rompería todas. Por
eso `app/tailwind.css`:

- Carga solo las capas `theme` y `utilities`. **Sin Preflight global.**
- El reset mínimo vive acotado al contenedor `.tw`.
- Los tokens `@theme` referencian las variables CSS de `styles.css`, no valores
  fijos, para que la identidad visual sea la misma.
- **No hay escaneo automático**: si migras un componente nuevo, añádelo a la
  lista de `@source` o sus clases no se generan y saldrá sin estilos.

Migrado hasta ahora: los primitivos de `app/components/ui/`, la lista de
Necesidades, y la ficha **a medias** (shell y núcleo del formulario sí; wizard,
modo lectura, columna lateral y subcomponentes todavía no, aunque ya figuren en
`@source`). Convive CSS viejo y nuevo dentro del mismo componente a propósito.

## Tests

Vitest, entorno `node`, `tests/**/*.test.ts`. Cubren **lógica de dominio
determinista** (reglas de procedencia, plazos, taxonomías, formato de
documentos). No tocan red ni BD: si algo necesita Supabase/Pinecone/OpenAI, se
mockea. `tests/_manual-eval.test.ts` está excluido del suite (usa servicios
reales); se corre a propósito.

Los tests suelen recorrer el catálogo entero (`for (const p of
PROCESOS_SELECCION)`) en vez de comprobar un caso suelto. Mantén ese estilo: es
lo que detecta que un proceso nuevo se quedó sin clasificar.

## Convenciones de escritura

**Commits** — Conventional Commits con scope, y el asunto describe el **síntoma
que veía el usuario**, en español y en minúscula:

```
fix(necesidades): el Word llevaba solo una cuarta parte de lo registrado
perf(configuracion): cargar cada seccion al abrirla
```

No `fix(necesidades): corregir mapeo de campos en requerimiento-docx.ts`.

**Comentarios** — explican *por qué*, no *qué*. Los ficheros de configuración
(`next.config.ts`, `eslint.config.mjs`, `app/tailwind.css`) llevan párrafos
justificando cada decisión no obvia, incluido el problema concreto que la
motivó. Si desvías de lo esperable, deja el motivo escrito.

## Documentación del proyecto

- `docs/SDD-ACE.md` — spec maestra (19 módulos, pipelines de IA, seguridad).
- `docs/SDD-EXPEDIENTES-ARCHIVO.md`, `docs/MODULO-EXPEDIENTES.md`.
- `docs/OPERACIONES.md`, `docs/DEPLOY-NETLIFY.md`.
- `docs/superpowers/plans` y `specs` — planes y especificaciones en curso.
- `CHANGELOG.md`.

La bóveda de Obsidian con el razonamiento de dominio está **fuera del repo**, en
`../vault` (git propio).
