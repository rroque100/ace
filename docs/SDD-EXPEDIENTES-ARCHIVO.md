# SDD — Módulo `/expedientes-archivo`

> **Spec-Driven Development** · Documento vivo de la especificación funcional,
> técnica y de UX/UI del módulo **Biblioteca de Expedientes Archivados** y
> **Mesa de Partes con Respuesta Asistida**.
>
> **Estado:** ✅ **Implementado y en producción** (junio 2026).
> **Mantenedor:** Equipo ACE. Cualquier cambio en la implementación debe
> reflejarse en este documento en el mismo PR.

---

## Tabla de contenidos

1. [Visión y objetivos](#1-visión-y-objetivos)
2. [Personas y casos de uso](#2-personas-y-casos-de-uso)
3. [Alcance funcional](#3-alcance-funcional)
4. [Modelo de datos](#4-modelo-de-datos)
5. [Arquitectura técnica](#5-arquitectura-técnica)
6. [Sub-pestaña BUSCAR expediente](#6-sub-pestaña-buscar-expediente)
7. [Sub-pestaña SUBIR expediente](#7-sub-pestaña-subir-expediente)
8. [Sub-módulo Mesa de Partes — Respuesta asistida](#8-sub-módulo-mesa-de-partes--respuesta-asistida)
9. [API REST — especificación](#9-api-rest--especificación)
10. [UX/UI — diseño detallado](#10-uxui--diseño-detallado)
11. [Búsqueda y RAG](#11-búsqueda-y-rag)
12. [Pipeline OCR e indexación](#12-pipeline-ocr-e-indexación)
13. [Persistencia de estado](#13-persistencia-de-estado)
14. [Atajos de teclado y command palette](#14-atajos-de-teclado-y-command-palette)
15. [Accesibilidad](#15-accesibilidad)
16. [Seguridad y permisos](#16-seguridad-y-permisos)
17. [Auditoría](#17-auditoría)
18. [Errores y mensajes](#18-errores-y-mensajes)
19. [Rendimiento y cuotas](#19-rendimiento-y-cuotas)
20. [Migración SQL](#20-migración-sql)
21. [Configuración (env vars)](#21-configuración-env-vars)
22. [Testing](#22-testing)
23. [Pendientes / roadmap](#23-pendientes--roadmap)

---

## 1. Visión y objetivos

### 1.1 Propósito

El módulo `/expedientes-archivo` cubre **dos capacidades relacionadas** dentro de la
plataforma municipal (ver `docs/ARQUITECTURA.md` → arquitectura de **monolito
modular**):

1. **Biblioteca de Expedientes Archivados** — subir expedientes y documentos
   escaneados (PDF), indexarlos en Pinecone y buscarlos con IA, registrando la
   **ubicación física exacta** (archivo, caja, folder, color, etc.).
2. **Mesa de Partes con Respuesta Asistida** — subir documentos entrantes, pasarlos
   por **OCR**, y **redactar automáticamente la respuesta** (oficio/carta) fundamentada
   en la biblioteca normativa, generando un **`.docx`** que se guarda dentro del
   expediente.

Ambos comparten el corpus de expedientes y se conectan: la respuesta generada por el
sub-módulo 2 se archiva en el expediente del sub-módulo 1.

### 1.2 Objetivos de negocio

- **Digitalizar y localizar** el archivo físico de expedientes terminados: que
  cualquier funcionario pregunte *«¿dónde está el expediente X?»* y obtenga tanto el
  **contenido** (qué contiene, nro, fecha, asunto) como su **ubicación física**
  (caja, archivador, color, estante, piso, local).
- **Automatizar la respuesta** a documentos entrantes con una redacción
  **fundamentada, trazable y de calidad profesional**, que no invente y que cite
  la normativa aplicable.
- **Principio rector (mismo del resto de ACE):** la IA propone, el funcionario
  valida. La respuesta se genera, se revisa y se aprueba antes de emitirse.
  *"No debe fallar"* se traduce en: el sistema cita fuentes y nunca alucina
  números ni fechas.

### 1.3 Objetivos técnicos

- **Cero alucinaciones en metadata**: la extracción de `número`, `año`, `tipo`,
  `materia`, `asunto`, `resumen` se hace con **regex determinísticos + OpenAI Vision**
  en cadena; los resultados se validan contra catálogos cerrados antes de
  persistirse.
- **OCR con fallback**: PDFs con texto seleccionable se procesan con `pdf-parse`;
  los escaneados se procesan con **OpenAI Vision** (`gpt-4o` o `gpt-4o-mini`) con
  fallback automático a `chat.completions + base64` para PDFs problemáticos.
- **Aislamiento del corpus**: el namespace de Pinecone
  (`PINECONE_EXPEDIENTES_NAMESPACE`) está separado del corpus normativo
  (`PINECONE_NAMESPACE`) y del archivo (`PINECONE_ARCHIVO_NAMESPACE`).
- **UX para funcionarios no técnicos**: la UI sigue el principio *"la IA propone,
  el humano confirma"*. Cero campos técnicos crudos; todos tienen placeholders,
  hints, autocompletar y validación inline.

### 1.4 No-objetivos (explícitos)

- ❌ No es un sistema de gestión documental (DMS) corporativo tipo Alfresco.
- ❌ No maneja firma digital ni certificado de Sello de Tiempo.
- ❌ No hace OCR de imágenes sueltas (JPG, PNG, TIFF) — solo PDF.
- ❌ No reemplaza al expediente de contratación de la Ley 32069 (módulo separado).

---

## 2. Personas y casos de uso

### 2.1 Personas

| Persona | Rol | Necesidades |
|---|---|---|
| **Funcionario de archivo** | `dec`, `editor`, `admin` | Sube, cataloga, reubica y elimina expedientes. Conoce los tipos documentales. |
| **Funcionario de mesa de partes** | `area_usuaria`, `dec`, `editor` | Recibe documentos, los digitaliza, redacta respuestas oficiales. |
| **Ciudadano / abogado externo** | `consulta` | Solo búsqueda (read-only). |
| **Auditor** | `admin` | Solo ve `audit_log` y estadísticas agregadas. |

### 2.2 Casos de uso

| # | Actor | Caso de uso | Resultado |
|---|---|---|---|
| CU-01 | Funcionario archivo | Subir un nuevo expediente con PDF + metadata | Expediente catalogado, OCR-eado, indexado en Pinecone y físicamente localizado |
| CU-02 | Funcionario archivo | Reemplazar el PDF de un expediente (versión actualizada) | PDF viejo borrado, nuevo reprocesado, metadata preservada |
| CU-03 | Funcionario archivo | Reindexar un expediente (status `error`) | Vuelve a procesarse OCR + embeddings |
| CU-04 | Funcionario archivo | Marcar expedientes para baja (purga) | Se marcan con `pendingDisposal=true` para revisión manual |
| CU-05 | Funcionario archivo | Detectar duplicados antes de subir | Banner amarillo con matches indexados |
| CU-06 | Cualquier usuario | Buscar por palabra clave | Lista de chunks relevantes con ubicación física del expediente |
| CU-07 | Cualquier usuario | Buscar por lenguaje natural (filtro) | Lista de expedientes filtrados por IA según intención |
| CU-08 | Cualquier usuario | Chat con IA sobre el contenido | Respuesta conversacional con citas [E#] y enlaces a expedientes |
| CU-09 | Funcionario | Abrir command palette con ⌘K | Búsqueda rápida de expedientes + acciones |
| CU-10 | Mesa de partes | Generar respuesta oficial a un documento entrante | Proyecto de respuesta fundamentada + DOCX descargable |
| CU-11 | Cualquier usuario | Exportar inventario a CSV/JSON | Descarga del catálogo filtrado |

---

## 3. Alcance funcional

### 3.1 En alcance (implementado)

#### Sub-pestaña BUSCAR expediente
- 3 modos: palabra clave / chat con IA / IA en archivo
- Tabs horizontales compactos (1 línea)
- Filtros: status, oficina, estante, tipo de documento
- 3 vistas: lista, tabla, tarjetas
- 5 stats cards (al final): total, indexados, en proceso, con error, total bytes
- Dashboard duplicados (pill de filtro)
- Slide-over de detalle con preview del PDF iframe + acciones
- Polling cada 4s para expedientes pendientes
- Búsqueda con `useDeferredValue` (input no se laguea)
- 12 atajos de teclado + command palette ⌘K

#### Sub-pestaña SUBIR expediente
- Wizard de 4 pasos: Documento → Contenido → Persona → Ubicación
- File picker con drag-and-drop
- Autocompletar desde PDF (IA + OCR)
- Detección de duplicados con debounce 800ms
- Panel de "Datos detectados" con chips clickeables
- 3 campos mínimos obligatorios (PDF, título, año); el resto opcional
- Validación onBlur con feedback positivo (verde) y negativo (rojo)
- Stepper compacto sticky con check de completitud
- Sticky nav footer (Anterior / Siguiente / Subir)
- Auto-guardado en localStorage (debounce 1.5s)
- Recuperación de borrador al volver
- XHR upload con barra de progreso real

#### Sub-módulo Mesa de Partes (Respuesta asistida)
- Upload de documento entrante (PDF)
- OCR + análisis del documento
- RAG sobre corpus normativo (`searchLegalSources`)
- Generación de respuesta con 3 tonos (cercano/formal/técnico) y 3 longitudes
- Asistente de assessment (qué responder / qué falta)
- Exportación a DOCX con membrete institucional

### 3.2 Fuera de alcance (futuro)

- Firma digital integrada
- OCR de imágenes JPG/PNG/TIFF sueltas
- Workflow de aprobación multi-usuario
- Sincronización con sistema externo de archivo físico
- Búsqueda fuzzy con tolerancia a typos
- Historial de versiones del PDF (mantener todas las versiones)
- Notificaciones por email cuando un expediente se marca para baja

---

## 4. Modelo de datos

### 4.1 Tabla `expedientes_archivo` (PostgreSQL / Supabase)

```sql
create table public.expedientes_archivo (
  id uuid primary key default gen_random_uuid(),
  -- Identificación documental
  sgd_expediente        text,                                       -- Nº SGD
  serie_documento       text,                                       -- Serie documental (cuadro clasificación)
  anio                  integer,                                    -- Año (1900..2100)
  tipo_documento        text default 'otros' check (tipo_documento in
                          ('resolucion','oficio','decreto','ordenanza','otros')),
  asunto                text,
  materia               text,
  resumen               text,
  title                 text not null,
  -- Oficina
  oficina               text,
  -- Almacenamiento físico
  tipo_almacenamiento   text not null default 'folder' check (tipo_almacenamiento in
                          ('empastado','folder','anillado','archivador','caja_archivistica')),
  nro_archivador        text,
  nro_paquete           text,
  empastado             boolean not null default false,
  color_archivador      text,
  -- Ubicación física exacta
  nro_estante           text,
  nro_piso              text,
  nro_local             text,
  folio                 text,
  -- Observaciones
  observaciones         text,
  -- Persona interesada
  persona_tipo          text check (persona_tipo in ('natural','juridica')),
  persona_documento     text,
  persona_nombre        text,
  -- Archivo digital
  file_name             text not null,
  file_size             bigint not null check (file_size > 0),
  mime_type             text not null default 'application/pdf',
  storage_bucket        text not null,
  storage_path          text not null unique,
  status                text not null default 'uploaded' check (status in
                          ('uploaded','processing','indexed','error')),
  error_message         text,
  body_text             text,                                       -- Cache del texto extraído
  metadata              jsonb not null default '{}'::jsonb,
  uploaded_by           uuid references auth.users(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index idx_expedientes_archivo_status      on public.expedientes_archivo(status);
create index idx_expedientes_archivo_anio        on public.expedientes_archivo(anio desc);
create index idx_expedientes_archivo_numero      on public.expedientes_archivo(serie_documento);
create index idx_expedientes_archivo_created_at  on public.expedientes_archivo(created_at desc);
```

### 4.2 Tabla `expedientes_archivo_chunks`

```sql
create table public.expedientes_archivo_chunks (
  id                  uuid primary key default gen_random_uuid(),
  expediente_id       uuid not null references public.expedientes_archivo(id) on delete cascade,
  chunk_index         integer not null,
  page_start          integer,
  page_end            integer,
  content             text not null,
  pinecone_vector_id  text unique,
  metadata            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  unique (expediente_id, chunk_index)
);

create index idx_expedientes_archivo_chunks_exp  on public.expedientes_archivo_chunks(expediente_id);
create index idx_expedientes_archivo_chunks_trgm
  on public.expedientes_archivo_chunks using gin (content gin_trgm_ops);
```

### 4.3 Ciclo de vida del status

```
┌──────────┐    ┌─────────────┐    ┌─────────┐
│ uploaded │───▶│ processing  │───▶│ indexed │
└──────────┘    └─────────────┘    └─────────┘
      │                │                 
      │                │ (catch)          
      │                ▼                 
      │          ┌────────┐
      └─────────▶│ error  │  ◀── markForDisposal
                 └────────┘
```

- `uploaded`: row insertado por POST `/api/expedientes-archivo`
- `processing`: `processExpedienteDocument` o reindex
- `indexed`: éxito en Pinecone + chunks
- `error`: catch en `processExpedienteDocument` o bulk markForDisposal

### 4.4 Estado de Pinecone (namespace aislado)

Cada expediente se almacena en el namespace `PINECONE_EXPEDIENTES_NAMESPACE` con
metadata `{ serieDocumento, anio, materia, tipoDocumento, pageStart, pageEnd }` por
chunk. El texto embebido incluye:
- Header: `Expediente: <title>`, `Serie documento: <x>`, `Año: <y>`, `Tipo: <z>`, `Materia: <m>`, `Asunto: <a>`
- Cuerpo: texto del chunk (2600 chars con 350 de overlap)

---

## 5. Arquitectura técnica

### 5.1 Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 15 (App Router) + React 19 + TypeScript estricto |
| Estilos | CSS modules en `app/styles.css` (un solo archivo, ~14k líneas) |
| Estado cliente | React `useState` + `useDeferredValue` (búsqueda) |
| Persistencia cliente | `localStorage` (borrador + autocomplete) + URL params |
| Backend | Next.js API routes (runtime `nodejs`) + Zod validation |
| DB | Supabase (PostgreSQL + Storage + RLS) |
| Vector DB | Pinecone (namespace aislado) |
| LLM | OpenAI (`gpt-4o` para OCR vision, `legalAnswerModel` para chat) |
| PDF text | `pdf-parse` (texto seleccionable) + OpenAI Vision (escaneados) |
| Tests | Vitest + Testing Library |

### 5.2 Diagrama de capas

```
┌──────────────────────────────────────────────────────────────────┐
│  UI (Client Components)                                           │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  app/components/expedientes-archivo-workspace.tsx (master) │    │
│  │  ├─ ./* sub-componentes:                                   │    │
│  │  │   ├─ chat-panel.tsx                                      │    │
│  │  │   ├─ bulk-move-modal.tsx                                 │    │
│  │  │   ├─ replace-file-modal.tsx                              │    │
│  │  │   ├─ tabla-expedientes.tsx                               │    │
│  │  │   ├─ tarjetas-expedientes.tsx                            │    │
│  │  │   └─ command-palette.tsx                                 │    │
│  │  └─ ./types.ts (tipos compartidos)                          │    │
│  └──────────────────────────────────────────────────────────┘    │
└────────────────────────┬─────────────────────────────────────────┘
                         │ fetch (HTTP)
┌────────────────────────▼─────────────────────────────────────────┐
│  HTTP layer (lib/expedientes-archivo-actions.ts — Zod validated) │
└────────────────────────┬─────────────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────────────┐
│  API routes (app/api/expedientes-archivo/**/route.ts)             │
│  runtime: nodejs · dynamic: force-dynamic · maxDuration: 60-300s  │
└────┬────────────┬─────────────┬─────────────┬─────────────────────┘
     │            │             │             │
     ▼            ▼             ▼             ▼
┌────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐
│ Supa- │  │ Pinecone │  │  OpenAI  │  │ lib/         │
│ base  │  │ (vec DB) │  │ Vision + │  │ - exp-archivo│
│(DB +  │  │ (isolated│  │ LLM      │  │   -search    │
│Store) │  │ namespc) │  │          │  │   -processing│
└───────┘  └──────────┘  └──────────┘  │   -actions   │
                                         └──────────────┘
```

### 5.3 Estructura de archivos

```
app/
  api/expedientes-archivo/
    route.ts                      # GET (lista) · POST (upload)
    [id]/route.ts                 # GET (PDF) · POST (reindex) · PUT (replace) · PATCH (update) · DELETE
    search/route.ts               # POST (keyword search)
    chat/route.ts                 # POST (RAG chat)
    ai-search/route.ts            # POST (IA en archivo)
    duplicates/route.ts           # GET (deduplicación)
    bulk/route.ts                 # POST (update + markForDisposal)
    extract/route.ts              # POST (autocompletar desde PDF)
    export/route.ts               # GET (CSV/JSON)
    respuesta/generate/route.ts   # POST (generar respuesta)
    respuesta/export/route.ts     # POST (DOCX)
  components/
    expedientes-archivo-workspace.tsx
    expedientes-archivo/
      types.ts
      chat-panel.tsx
      bulk-move-modal.tsx
      replace-file-modal.tsx
      tabla-expedientes.tsx
      tarjetas-expedientes.tsx
      command-palette.tsx
      README.md
  styles.css                      # 14k líneas, contiene TODO el CSS del módulo
lib/
  expedientes-archivo.ts                 # Catálogos, Zod schemas, extractores
  expedientes-archivo-search.ts          # RAG con OpenAI
  expedientes-archivo-processing.ts      # OCR + chunking + embedding
  expedientes-archivo-actions.ts         # HTTP client con Zod (Zod en cliente)
  pdf-processing.ts                       # pdf-parse + OpenAI Vision OCR
  pinecone.ts                             # upsert/delete/search genérico
docs/
  supabase/expedientes-archivo.sql        # Migración (DDL + RLS + DROP COLUMN)
  SDD-EXPEDIENTES-ARCHIVO.md             # ← este documento
  MODULO-EXPEDIENTES.md                   # Intención original (alto nivel)
tests/
  expedientes-archivo.test.ts            # 24 tests (actions + processing)
```

---

## 6. Sub-pestaña BUSCAR expediente

Renderizada en `expedientes-archivo-workspace.tsx:1063-1280` cuando
`activeTab === "buscar"`.

### 6.1 Tres modos de búsqueda

Variable: `mode: "buscar" | "preguntar" | "ia"` (línea 105). Se elige con tabs
horizontales compactos (`.subirSearchTabs` con `role="tablist"`).

| Modo | Endpoint | Función | Mín. chars | Filtro `anio` |
|---|---|---|---|---|
| Por palabra clave | `POST /api/expedientes-archivo/search` | Búsqueda vectorial + lexical sobre chunks | 2 | sí |
| Chat con IA | `POST /api/expedientes-archivo/chat` | RAG: 8 hits + respuesta OpenAI | 2 | no |
| IA en archivo | `POST /api/expedientes-archivo/ai-search` | IA filtra lista de 200 expedientes por intención | 3 | no |

### 6.2 Estructura del form

```jsx
<form onSubmit={mode === "ia" ? runAiSearch : runSearch}>
  <subirSearchTabs role="tablist">          {/* 3 tabs compactos */}
  <subirSearchModeDesc>                     {/* 1 línea de ayuda contextual */}
  <input query />                            {/* input principal */}
  {modo !== "preguntar" && (
    <input filterAnio type="number" />      {/* filtro de año opcional */}
  )}
  <primaryButton>Buscar / Preguntar</primaryButton>
  <subirLinkBtn>Abrir chat lateral (Ctrl+I)</subirLinkBtn>
</form>
```

### 6.3 Resultados

Sección condicional según `mode`:

- **Keyword results** (`archivoResults`): lista de `SearchResult` con:
  - Icono, título, año, oficina
  - Chip de ubicación física (estante/piso/local)
  - Excerpt del chunk (700 chars)
  - Citation `[E#] · pág. X`
  - Click → abre slide-over

- **Chat answer** (`archivoAnswer`): texto de OpenAI + sources como chips
  clickeables

- **IA results** (`aiSearchResults`): lista de matches con `razonamiento` de la IA

### 6.4 Lista de expedientes (sub-sección)

Renderizada en `expedientes-archivo-workspace.tsx:2019-2280`. Componentes:

| Elemento | Líneas | Notas |
|---|---|---|
| Search bar | 2031-2062 | `useDeferredValue` + botón ⌘K |
| View toggle | 2063-2096 | 3 tabs: lista / tabla / tarjetas |
| Export CSV | 2098-2103 | Abre `window.open(/api/expedientes-archivo/export?formato=csv)` |
| Advanced filters (details) | 2111-2126 | Oficina, estante, tipo de documento |
| Pills de status | 2127-2150 | Clickeables, aplican filtro |
| Pill de duplicados | 2151-2175 | Si hay grupos, muestra resumen |
| Lista | 2177-2244 | Render condicional según `viewMode` |
| Bulk bar | 2246-2278 | Aparece con `selectedIds.size > 0` |
| Stats dashboard | 2280-2338 | Al final, solo si `>= 5` expedientes |

### 6.5 Bulk actions

Cuando `selectedIds.size > 0` y `canManage`:

- **Reindexar** (`bulkReindex`): itera `reindexExpedienteAction(id)` por cada ID.
- **Mover / reasignar** (`bulkUpdate`): abre `BulkMoveModal` con 6 inputs. Solo aplica
  los campos con valor. Validación: el botón Aplicar está deshabilitado si `filledCount === 0`.
- **Eliminar** (`bulkDelete`): itera `performDeleteWithUndo` con barra de undo 10s.
- **Marcar para baja** (`bulkMarkForDisposalAction`): `confirm()` del navegador +
  `action: "markForDisposal"`.

### 6.6 Slide-over de detalle

Componente no extraído (en workspace, ~100 líneas). Se abre con
`setSlideOverExp(exp)` o click en un resultado de búsqueda.

| Sección | Contenido |
|---|---|
| Header | Título, año · oficina, botón cerrar |
| Iframe | `src={"/api/expedientes-archivo/${id}"}` (preview del PDF) |
| Acciones | Descargar PDF, Reemplazar PDF, Duplicar expediente |
| Metadata | Status, materia, asunto, año, oficina, almacenamiento, estante, piso, error_message |

---

## 7. Sub-pestaña SUBIR expediente

Renderizada en `expedientes-archivo-workspace.tsx:1363-2080` cuando
`activeTab === "subir" && canManage`.

### 7.1 Wizard de 4 pasos

```
┌─────────────────────────────────────────────────────────────┐
│  [Progress bar 25% ─ 50% ─ 75% ─ 100%]                     │
│  [Stepper 1:Documento] [2:Contenido] [3:Persona] [4:Ubicación]│
│                                                              │
│  [Header del paso actual sticky]                             │
│                                                              │
│  [Body scrolleable]                                          │
│                                                              │
│  [Footer sticky: ◀ Anterior | Siguiente / Subir al archivo] │
└─────────────────────────────────────────────────────────────┘
```

**Stepper** (`subirStepper`):
- Sticky top, con `backdrop-filter: blur(6px)`
- Items con check ✓ si `stepCompletion(idx) >= 1`
- Click en un item no activo: navega sin validar
- Click en el item activo: no hace nada

**Progreso** (`subirProgress`): `width: ((subirStep + 1) / 4) * 100%`

### 7.2 Paso 1: Documento (líneas 1413-1557)

**Campos:**

| # | Campo | Tipo | Requerido | Validación |
|---|---|---|---|---|
| 1 | file | `File` (PDF) | ✅ | tipo=application/pdf, size ≤ `maxPdfSizeBytes` |
| 2 | title | `string` | ✅ | `length > 0` |
| 3 | sgdExpediente | `string` | — | — |
| 4 | anio | `string` | ✅ | número entre 1900-2100 |
| 5 | tipoDocumento | `string` | ✅ | ∈ DOCUMENTO_TIPOS |
| 6 | folio | `string` | — | — |
| 7 | serieDocumento | `string` | — | — |
| 8 | oficina | `string` | — | autocompletar con historial |

**File picker con drag-and-drop:**
- Zona visible con icono + texto "Arrastra un PDF aquí o haz clic para seleccionar"
- `onDragOver` / `onDragLeave` / `onDrop` handlers
- Al hacer drop: `acceptFile(file)` valida tipo + tamaño

**Panel de datos detectados del PDF:**
- Solo aparece cuando hay PDF + `autocompleteDone.expediente`
- Chips clickeables: cada uno llama `focusField(id)` que hace `scrollIntoView + focus()`
- IDs de campo: `subir-field-{sgd,anio,tipo,folio,serie,materia,asunto}`

**Detección de duplicados:**
- Debounce 800ms cuando `title.length >= 3`
- Llama `detectDuplicates({title, sgd, serie})` → si hay matches, banner amarillo
- Botón "Continuar de todos modos" → cierra el banner

### 7.3 Paso 2: Contenido (líneas 1659-1738)

| Campo | Tipo | Notas |
|---|---|---|
| materia | `string` | Autocompletar con historial (`<datalist>`) |
| asunto | `string` | Sumilla |
| resumen | `string` (textarea, 3 filas) | Resumen ejecutivo |
| observaciones | `string` (textarea) | Notas libres |

### 7.4 Paso 3: Persona (líneas 1741-1898)

**Tipo de persona** (cards radio):
- Natural (icono User)
- Jurídica (icono Building)
- Sin persona (icono UserX)

**Si es persona**, se muestra:
- DNI/RUC según `personaTipo` (8 vs 11 dígitos, validación con regex)
- Nombre completo / Razón social

**Validación:** onBlur → verde si OK, rojo si no.

### 7.5 Paso 4: Ubicación (líneas 1901-1909)

| Campo | Tipo | Default | Notas |
|---|---|---|---|
| tipoAlmacenamiento | `select` | `folder` | Catálogo cerrado |
| empastado | `toggle` | `no` | Switch on/off |
| nroEstante | `string` | — | — |
| nroPiso | `string` | — | — |
| nroLocal | `string` | — | — |
| (código) | `string` (readonly) | auto | `local-PnroPiso-EnroEstante` |

**Avanzado (collapsed en `<details>`):**
- nroArchivador, nroPaquete, colorArchivador

### 7.6 Botón "Subir al archivo"

- Solo visible en paso 3 (`subirStep === 3`)
- `primaryButton` con icono `UploadCloud`
- `disabled={uploading}`
- Llama a `uploadExpedienteAction(formData, onProgress)`

**XHR upload con progreso:**
- `xhr.upload.addEventListener("progress", ...)` actualiza `uploadProgress` (live)
- Barra visual + porcentaje
- Mensaje de éxito: "PDF subido. Procesando, OCR e indexando en segundo plano..."

### 7.7 Auto-guardado (borrador)

- Key: `expedientes-archivo-borrador`
- Trigger: debounce 1500ms al cambiar `form`, `file`, `subirStep`
- Payload: `{ form, fileName, fileSize, subirStep, savedAt }`
- Banner "Tienes un borrador sin terminar" al montar
- Indicador "💾 Borrador guardado a las HH:MM" en el nav footer

### 7.8 Validación por paso

`validateStep(step)`:
- Paso 0: `file + title + anio + tipoDocumento`
- Pasos 1-3: pasan sin validación (el usuario puede saltar atrás con el stepper)

---

## 8. Sub-módulo Mesa de Partes — Respuesta asistida

> **Nota:** la UI de este sub-módulo no está integrada en el workspace actual
> (no se importan los endpoints `/respuesta/*`). Los endpoints existen y funcionan,
> pero la integración UI es un pendiente (ver §23).

### 8.1 Flujo

```
Upload PDF entrante
       │
       ▼
[OCR + análisis]  ──────────────┐
       │                       │
       ▼                       │
[RAG: searchLegalSources]      │  (topK configurable)
       │                       │
       ▼                       │
[OpenAI: genera respuesta] ◀───┘
       │
       ▼
[Asistente de assessment]  ────  ¿qué falta? ¿qué responder?
       │
       ▼
[Exportar a DOCX]
```

### 8.2 Endpoints

- `POST /api/expedientes-archivo/respuesta/generate`
  - Body: `{ documentoTexto, remitente, asunto, tone, length, selectedSources? }`
  - Tone: `"cercano" | "formal" | "tecnico"`
  - Length: `"concisa" | "media" | "detallada"`
  - Devuelve: `{ respuesta, sources, assessment }`

- `POST /api/expedientes-archivo/respuesta/export`
  - Body: `{ entity, nroOficio, destinatario, cargoDestinatario, asunto, cuerpo, baseLegal, remitente, cargoRemitente }`
  - Devuelve: DOCX binario con `Content-Disposition: attachment`

### 8.3 Anti-alucinación

- La respuesta generada **siempre** cita las fuentes (`[E#]`).
- El assessment marca los puntos débiles del documento (qué falta, qué contradice).
- El funcionario edita antes de aprobar; la versión final no se autosella.

---

## 9. API REST — especificación

Todas las rutas: `runtime = "nodejs"`, `dynamic = "force-dynamic"`.
Auditoría: todas las acciones (excepto GET) llaman a `writeAuditLog` con
`module: "expedientes-archivo"`.

### 9.1 Endpoints CRUD

| Método | Ruta | Auth | Body / Query | Devuelve | Status |
|---|---|---|---|---|---|
| `GET` | `/api/expedientes-archivo` | `requireUser` | `?status&anio` | `{expedientes: ExpedienteArchivo[]}` (limit 100) | 200 |
| `POST` | `/api/expedientes-archivo` | `requireEditor` | multipart: `file` + 22 campos | `{expediente, processing: true}` | 202 |
| `GET` | `/api/expedientes-archivo/[id]` | `requireUser` | — | Blob PDF (`?download=1` → attachment) | 200 |
| `POST` | `/api/expedientes-archivo/[id]` | `requireEditor` | — | `{expedienteId, reindexing: true}` | 202 |
| `PUT` | `/api/expedientes-archivo/[id]` | `requireEditor` | multipart: `file` | `{replaced: true, processing: true}` | 202 |
| `PATCH` | `/api/expedientes-archivo/[id]` | `requireEditor` | JSON con whitelist | `{updated: string[]}` | 200 |
| `DELETE` | `/api/expedientes-archivo/[id]` | `requireEditor` | — | `{deleted: {expedienteId, vectors}}` | 200 |

### 9.2 Endpoints de búsqueda y AI

| Método | Ruta | Auth | Body | Devuelve | Zod schema |
|---|---|---|---|---|---|
| `POST` | `/api/expedientes-archivo/search` | `requireUser` | `{query, anio?}` | `{query, results: SearchResult[]}` | `expedienteSearchSchema` |
| `POST` | `/api/expedientes-archivo/chat` | `requireUser` | `{query, anio?}` | `{answer, sufficient, sources}` | `expedienteChatSchema` |
| `POST` | `/api/expedientes-archivo/ai-search` | `requireUser` | `{query, limit?}` | `{matches, reasoning}` | (inline) |
| `GET` | `/api/expedientes-archivo/duplicates` | `requireUser` | `?title&sgd&serie&excludeId` | `{duplicates, matchType}` | — |
| `POST` | `/api/expedientes-archivo/bulk` | `requireEditor` | `{ids, action, updates?}` | `{updated, fields}` | (inline) |
| `POST` | `/api/expedientes-archivo/extract` | `requireEditor` | multipart: `file` + `title` | `{inventory}` | — |
| `GET` | `/api/expedientes-archivo/export` | `requireUser` | `?formato=csv\|json&status&anio&oficina&estante` | CSV/JSON (limit 1000) | — |

### 9.3 Códigos de error

| Status | Cuándo |
|---|---|
| 400 | Zod validation fail · tipo de archivo incorrecto · tamaño > límite · ID > 200 en bulk |
| 401/403 | No sesión · sin rol editor para acciones de escritura |
| 404 | expediente no existe |
| 422 | PDF no procesable por OCR (PDF escaneado de baja calidad) |
| 500 | Error interno del servidor |
| 503 | Supabase no configurado (`setupRequired: true`) |

### 9.4 Ejemplos curl

```bash
# Buscar
curl -X POST https://ace.local/api/expedientes-archivo/search \
  -H "Content-Type: application/json" \
  -H "Cookie: ..." \
  -d '{"query":"licencia 2024", "anio":2024}'

# Subir
curl -X POST https://ace.local/api/expedientes-archivo \
  -H "Cookie: ..." \
  -F "file=@/path/expediente.pdf" \
  -F "title=Licencia 2024-0345" \
  -F "anio=2024" \
  -F "tipoDocumento=resolucion"

# Generar respuesta oficial
curl -X POST https://ace.local/api/expedientes-archivo/respuesta/generate \
  -H "Content-Type: application/json" \
  -H "Cookie: ..." \
  -d '{"documentoTexto":"Solicito información sobre...","remitente":"Juan Pérez","tone":"formal","length":"media"}'
```

---

## 10. UX/UI — diseño detallado

### 10.1 Sistema de diseño

| Token | Valor | Uso |
|---|---|---|
| `--brand` | `#0f766e` (teal) | Acento principal, focus, hover |
| `--ink` | `#0f172a` (slate-900) | Texto principal |
| `--muted` | `#64748b` (slate-500) | Texto secundario, labels, placeholders |
| `--line` | `#e2e8f0` (slate-200) | Bordes, separadores |
| `--soft` | `#f0fdfa` (teal-50) | Fondo hover, fondo activo |
| `--bg` | `#f8fafc` (slate-50) | Fondo de inputs, chips |
| `--surface` | `#ffffff` | Fondo de cards, paneles |
| `--danger` | `#b42318` | Errores, validación negativa |
| `--warning` | `#ca8a04` (yellow-600) | Banner duplicados |
| `--focus` | `0 0 0 3px rgba(15,118,110,0.12)` | Anillo de focus |
| `--shadow-soft` | `0 4px 12px rgba(15,23,42,0.04)` | Sombras de cards |

### 10.2 Tipografía

- **Labels**: 11px, uppercase, letter-spacing 0.05em, weight 700, color `ink`
- **Inputs**: 14px, weight 500
- **Botones primarios**: 13px, weight 600
- **Placeholders**: color `muted`, opacity 0.7, weight 400
- **Help text** (hints): 11px, color `muted`, no italic
- **Errores**: 11px, color `danger`, weight 600
- **Stepper**: número 12px, label 13px

### 10.3 Patrones de feedback

- **Éxito** (verde con ✓): mensajes de autocompletar, upload OK
- **Advertencia** (amarillo con ⚠): duplicados detectados, markForDisposal
- **Error** (rojo): validación fallida, OCR falló, servidor caído
- **Info** (brand con icono): autocompletar con IA, razonamiento de búsqueda

### 10.4 Modo "default" vs "active"

- **Inputs**: border `var(--line)` → hover `var(--muted)` → focus `var(--brand)` + ring
- **Tabs**: background `transparent` → hover `var(--surface)` → active `var(--brand)` border + bg
- **Pill de filtro**: border `var(--line)` → active `var(--brand)` border + bg
- **Stat card**: default `var(--surface)` → active `var(--soft)` + ring

### 10.5 Animaciones

- `cmdPaletteFadeIn` 0.15s ease (overlay)
- `cmdPaletteSlideIn` 0.18s ease (modal)
- `subirFilePicker.dragging` scale 1.01 + box-shadow ring brand
- `fieldOk`/`fieldError` border transition 0.15s
- `subirDetectedChip` active scale 0.98 (click feedback)
- Stepper ✓ aparece instantáneo

### 10.6 Responsive

- **Desktop ≥ 720px**: formGrid 2 columnas
- **Tablet 480-720px**: formGrid 1 columna
- **Mobile < 480px**: tabs scroll horizontal, chips wrap, file picker full-width
- Sidebar colapsable con `Ctrl+\` (ancho 72px vs 280px)

---

## 11. Búsqueda y RAG

### 11.1 Búsqueda por palabra clave (`/search`)

1. Llama a `searchExpedientesAction({query, anio})`
2. Valida con Zod (query 2-500 chars, anio opcional 1900-2200)
3. POST a `/api/expedientes-archivo/search`
4. Server: `searchExpedientes()` en `lib/expedientes-archivo-search.ts`:
   - `searchTextRecords(query, topK=8, {year}, namespace)` en Pinecone
   - Recupera chunks por ID y expedientes por ID
   - Filtra por `serieDocumento` (post-filter, no nativo en Pinecone)
   - Construye `ExpedienteSearchResult` con ubicación física y citation
5. Devuelve `{query, results}` con score, excerpt (700 chars), pageStart/End

### 11.2 Chat con IA (`/chat`)

1. Llama a `chatWithExpedientesAction(query)`
2. Server: `answerExpedienteQuestion()`:
   - `searchExpedientes({query, topK: 8})` (sin filtro de año)
   - Construye contexto con 8 fuentes, formato `[E#] · Nº X · pág. Y`
   - OpenAI (`legalAnswerModel`, `temperature: 0.2`, `max_output_tokens: 900`)
   - System prompt: cita fuentes con [E#], no inventa, menciona número/año
3. Devuelve `{answer, sufficient, sources}`

### 11.3 Búsqueda IA (`/ai-search`)

1. Carga hasta 200 expedientes (`expedientes_archivo?order=created_at.desc&limit=200`)
2. Compacta a `{id, title, anio, oficina, materia, asunto}`
3. OpenAI (`temperature: 0`) decide matches con JSON estructurado
4. Filtra IDs inexistentes, limita a `limit` (default 20)
5. Devuelve `{matches, reasoning}`

---

## 12. Pipeline OCR e indexación

### 12.1 `extractPdfText(file)` en `lib/pdf-processing.ts`

```
file (PDF)
    │
    ▼
pdf-parse(file)
    │
    ├── texto >= 120 chars ────▶ devolver texto (extracciónMethod: "pdf-text")
    │
    └── texto < 120 chars (escaneado) ──▶ OpenAI OCR
                                              │
                                              ├── 1º intento: openai.files.create + responses.create + file_id
                                              │       │
                                              │       └── si texto usable ──▶ devolver (extracciónMethod: "openai-ocr")
                                              │
                                              └── 2º intento (si 1º falla o texto inutilizable):
                                                      openai.chat.completions + base64
```

### 12.2 `extractExpedienteInventory(file, title)` en `lib/expedientes-archivo-processing.ts`

1. `extractPdfText(file)` → texto + método
2. Si texto no usable (≤ 120 chars), tira error 422
3. `analyzeExpedienteWithAi(text)` → OpenAI extrae `{asunto, materia, resumen, tipoDocumento}` (max 700 tokens, temp 0)
4. `extractExpedienteNumber(title, text)` → regex `N° X` o fallback genérico
5. `extractAnioFromText(text)` → primer año plausible 1990-2100
6. Devuelve `ExpedienteInventory`

### 12.3 `processExpedienteDocument(exp, file)` en background (`after()`)

1. `extractPdfText(file)` → texto + páginas
2. `chunkPages(pages)` → array de `{index, content, pageStart, pageEnd}` (2600 chars + 350 overlap)
3. `analyzeExpedienteWithAi(text)` → insights
4. Construye `chunkRows` con metadata `{serieDocumento, anio, materia, tipoDocumento, pageStart, pageEnd}`
5. `insertChunksInBatches(chunkRows)` → inserta en `expedientes_archivo_chunks`
6. Para cada chunk:
   - `buildExpedienteEmbeddingText()` → header + content
   - Construye `PineconeRecord` con `_id: expediente::{id}::{idx}`
7. `upsertTextRecords(records, namespace)` → indexa en Pinecone
7. `verifyDocumentIndexedInPinecone()` → confirma que se indexaron
8. PATCH al row: `status: "indexed"` + metadata completa

Si algo falla: catch → `deleteRecords(vectorIds, namespace)` + PATCH `status: "error"`.

---

## 13. Persistencia de estado

### 13.1 localStorage

| Key | Payload | Línea | Trigger |
|---|---|---|---|
| `expedientes-archivo-borrador` | `{form, fileName, fileSize, subirStep, savedAt}` | 689-708 | debounce 1500ms al cambiar form |
| `expedientes-archivo-autocomplete` | `Record<field, string[]>` (8 por campo) | 636 | cada vez que `saveAutocomplete` se llama |

### 13.2 URL params (solo en `activeTab === "buscar"`)

| Param | Source | Sincroniza |
|---|---|---|
| `?q=` | `listSearch` | debounce via `useDeferredValue` |
| `?status=` | `statusFilter` (si !== "todos") | inmediato |
| `?view=` | `viewMode` (si !== "lista") | inmediato |

`replaceState` (no `pushState`) — no agrega al historial del navegador.

### 13.3 URL state deliberadamente NO sincronizado

- `activeTab` (Buscar/Subir) — el usuario elige explícitamente cada vez
- `mode` (3 modos de búsqueda) — se resetea al cambiar de tab
- `subirStep` (0-3) — el borrador en localStorage lo cubre
- `filters` (oficina, estante, tipoDocumento) — filtros avanzados efímeros

---

## 14. Atajos de teclado y command palette

### 14.1 Atajos globales

| Atajo | Acción | Línea |
|---|---|---|
| `/` | Enfoca buscador de la lista | 776-781 |
| `?` | Muestra/oculta modal de ayuda | 782-786 |
| `Esc` | Cierra slide-over, modal, ayuda, command palette | múltiples |
| `Ctrl+I` | Abre panel de chat lateral | 787-790 |
| `Ctrl+U` | Va a pestaña Subir | 791-794 |
| `Ctrl+B` | Va a pestaña Buscar | 795-798 |
| `Ctrl+\` | Colapsa/expande sidebar | 728-731 |
| `Ctrl+K` / `⌘K` | Abre command palette | 813-816 |
| `Ctrl+→` | Siguiente paso del wizard (solo Subir) | 738-756 |
| `Ctrl+←` | Paso anterior del wizard (solo Subir) | 738-756 |

### 14.2 Command palette (`⌘K`)

- **Apertura:** `Ctrl+K` (Mac/Windows/Linux) o click en botón `⌘K` al lado del search
- **Búsqueda fuzzy** sobre: títulos, materia, oficina, asunto, serie, año
- **Acciones rápidas** (siempre disponibles, sin query):
  - "Ir a Subir expediente" (Ctrl+U)
  - "Abrir chat con IA" (Ctrl+I)
  - "Exportar inventario CSV"
  - "Ver atajos de teclado" (?)
- **Atajos en el palette:**
  - `↑` / `↓` navegar entre resultados
  - `Enter` seleccionar
  - `Esc` cerrar
- **Visual:**
  - Overlay con `backdrop-filter: blur`
  - Modal animado (fadeIn + slideIn)
  - Items agrupados (Expedientes / Acciones)
  - Item activo: border-left brand + bg soft
  - Footer con leyenda de atajos

---

## 15. Accesibilidad

### 15.1 Cumplimiento WCAG 2.1 AA

| Criterio | Implementación |
|---|---|
| 1.1.1 Non-text content | Iconos Lucide con `aria-hidden`; sin imágenes sin alt |
| 1.3.1 Info and relationships | `<nav>`, `<aside>`, `<table>`, `<label>`, `<form>` semánticos |
| 1.4.3 Contrast | `--ink` sobre `--surface`: ratio 17:1. `--muted` sobre `--surface`: 4.6:1 |
| 1.4.11 Non-text contrast | Bordes `var(--line)` 1.5px: ratio 3:1 |
| 2.1.1 Keyboard | Todos los botones accesibles con Tab; atajos globales |
| 2.4.3 Focus order | DOM order coherente con visual order |
| 2.4.7 Focus visible | `outline: 2px solid var(--focus)` en todos los interactivos |
| 2.5.3 Label in name | Labels visibles = `aria-label` cuando difieren |
| 3.3.1 Error identification | `.fieldErrorMsg` + `aria-invalid` (futuro) |
| 3.3.2 Labels | `<label>` envuelve input o usa `for`+`id` |
| 4.1.2 Name, role, value | `aria-pressed` (tabs), `aria-selected` (view toggle), `role="dialog"`, `role="tablist"`, `role="tab"`, `aria-current="step"` (stepper) |

### 15.2 Áreas de mejora

- ❌ Falta `aria-invalid` en inputs con error (no se setea explícitamente)
- ❌ Falta `aria-describedby` apuntando al hint/error
- ⚠️ Tooltips `subirHelp` (icono `(?)`) no son focusables con teclado por defecto

---

## 16. Seguridad y permisos

### 16.1 Roles (Supabase auth + JWT)

```typescript
// lib/auth.ts
type User = {
  id: string;
  email: string;
  role: "consulta" | "area_usuaria" | "dec" | "editor" | "admin";
  oficina: string | null;
  // ...
};

requireUser()    // Cualquier usuario autenticado
requireEditor()  // dec, editor, admin
isEditor()       // función SQL en PostgreSQL
```

### 16.2 RLS (Row Level Security)

```sql
-- Lectura: cualquier autenticado
create policy "expedientes_archivo_select" on public.expedientes_archivo
  for select to authenticated using (true);

-- Escritura: solo editores
create policy "expedientes_archivo_editor_insert" on public.expedientes_archivo
  for insert to authenticated with check (public.is_editor());

create policy "expedientes_archivo_editor_update" on public.expedientes_archivo
  for update to authenticated using (public.is_editor()) with check (public.is_editor());

create policy "expedientes_archivo_editor_delete" on public.expedientes_archivo
  for delete to authenticated using (public.is_editor());
```

### 16.3 Storage

- Bucket: `documents` (configurable con `SUPABASE_STORAGE_BUCKET`)
- Path: `expedientes/{uuid}-{safeName(file.name)}`
- `safeName`: normaliza acentos, reemplaza chars no-alfanuméricos, slice 80 chars
- Service role key solo en el server (nunca expuesto al cliente)

### 16.4 Validación de input

- **Cliente** (`lib/expedientes-archivo-actions.ts`): Zod schemas (SearchQuerySchema, ChatQuerySchema, AiQuerySchema, BulkUpdateSchema, LimitSchema)
- **Server** (`app/api/expedientes-archivo/**`): Zod en cada endpoint, validación de tamaño con `maxPdfSizeBytes`, validación de tipo MIME `application/pdf`

---

## 17. Auditoría

### 17.1 Eventos auditados (`writeAuditLog`)

| Acción | Trigger | Datos |
|---|---|---|
| `expedientes.archivo.upload` | POST `/api/expedientes-archivo` | `{fileName, title}` |
| `expedientes-archivo.upload` | POST (legacy) | idem |
| `expedientes-archivo.update` | PATCH `/api/expedientes-archivo/[id]` | `{fields: [keys]}` |
| `expedientes.delete` | DELETE `/api/expedientes-archivo/[id]` | `{title, vectors}` |
| `expedientes.bulkUpdate` | POST `/api/expedientes-archivo/bulk` (action=update) | `{count, fields}` |
| `expedientes.bulkDisposal` | POST `/api/expedientes-archivo/bulk` (action=markForDisposal) | `{count}` |
| `expedientes.replaceFile` | PUT `/api/expedientes-archivo/[id]` | `{newFileName, newSize}` |
| `expedientes.reindex` | POST `/api/expedientes-archivo/[id]` (reindex) | `{chunkCount, pageCount}` |
| `expedientes.aiSearch` | POST `/api/expedientes-archivo/ai-search` | `{query, matches}` |
| `expedientes.extract` | POST `/api/expedientes-archivo/extract` | `{fileName, extractionMethod}` |

---

## 18. Errores y mensajes

### 18.1 Mensajes al usuario (español)

| Situación | Mensaje | Tipo |
|---|---|---|
| PDF muy grande | `El PDF supera el límite de {maxPdfSizeLabel}.` | error |
| Tipo incorrecto | `Solo se permiten archivos PDF` | error |
| Sin título | `El título es obligatorio para identificar el expediente` | error |
| Año inválido | `El año debe estar entre 1900 y 2100` | error |
| DNI/RUC mal | `DNI debe tener 8 dígitos` / `RUC debe tener 11 dígitos` | error |
| Búsqueda muy corta | `Escribe al menos 2 caracteres.` | info |
| Búsqueda IA muy corta | `Escribe al menos 3 caracteres para buscar con IA.` | info |
| Sin resultados keyword | `Sin resultados en la biblioteca de expedientes.` | info |
| Sin matches IA | `Sin coincidencias. Prueba con otros términos o sube un nuevo expediente.` | info |
| Sin matches chat | `No encontré expedientes relacionados en la biblioteca de expedientes archivados.` | info |
| Error servidor | `No se pudo conectar con el servidor.` | error |
| OCR falla | `El PDF no contiene texto legible para OCR...` | error |
| AutoFill OK | `✓ Datos autocompletados. Revisa los chips y corrige si es necesario.` | success (5s) |
| Bulk OK | `✓ {n} expediente(s) actualizados` | success (5s) |
| Borrador | `💾 Borrador guardado a las {HH:MM}` | info |
| Borrador recuperado | `📝 Tienes un borrador sin terminar.` | warning |

### 18.2 Manejo de errores

- **Cliente** (`lib/expedientes-archivo-actions.ts`): `parseError(res, fallback)` extrae `data.error` o devuelve `Error(fallback + " (HTTP {status})")`
- **Servidor**: `NextResponse.json({error: "..."}, {status: 4xx|5xx})`
- **UI**: cada `setXMessage(...)` muestra el error en una `<p className="formMessage">` arriba del form
- **Auto-clear**: mensajes de éxito/advertencia se limpian a los 5s (§10)

---

## 19. Rendimiento y cuotas

### 19.1 Límites

| Concepto | Límite | Config |
|---|---|---|
| PDF | 50 MB | `maxPdfSizeBytes` (`lib/upload-limits.ts`) |
| OCR páginas | 25 | `OPENAI_OCR_MAX_PAGES` |
| Bulk operation | 200 IDs por request | hardcoded en `bulk/route.ts` |
| Lista | 100 expedientes (default) | hardcoded en `route.ts` |
| Export | 1000 expedientes | hardcoded en `export/route.ts` |
| Search topK | 8 | hardcoded en `searchExpedientes` |
| AI search load | 200 expedientes | hardcoded en `ai-search/route.ts` |
| AI search results | 20 (default) | hardcoded en `aiSearchExpedientes` |
| Polling pending | 75 intentos × 4s = 5 min | `useEffect(hasPending)` |
| Chunks per page | chunkSize=2600, overlap=350 | `pdf-processing.ts` |
| Recursive OCR fallback | 1 nivel (gpt-4o → gpt-4o) | `extractPdfTextWithOpenAI` |
| Chat completions | max 900 tokens | `legalAnswerModel` |

### 19.2 Optimizaciones cliente

- `useDeferredValue(listSearch)` (línea 248) — input fluido mientras se filtra
- `useMemo` para `filteredExpedientes`, `stats`, `duplicateGroups`, `duplicates`, `uniqueOficinas`, `uniqueEstantes`
- `useCallback` para `loadExpedientes`, `saveBorrador`, `loadBorrador`, `clearBorrador`
- Polling solo si `hasPending` (no se ejecuta si todos los expedientes están indexados)
- Render condicional del slide-over, chat panel, modales (solo cuando están activos)

### 19.3 Optimizaciones servidor

- `dynamic = "force-dynamic"` evita cache estático
- `runtime = "nodejs"` para todas las rutas (no Edge)
- `maxDuration: 60s` para endpoints normales, `300s` para reindex
- Streaming de PDF (no carga en memoria)
- Insertar chunks en batches de 100
- Liberar el PDF del background `after()` con `downloadStorageObject` (no usa el `File` del request)

---

## 20. Migración SQL

Archivo: `docs/supabase/expedientes-archivo.sql`

### 20.1 Comandos principales

```sql
-- 1. Crear tablas (idempotente)
create table if not exists public.expedientes_archivo (...);
create table if not exists public.expedientes_archivo_chunks (...);

-- 2. Agregar columnas nuevas (idempotente, ejecutado en migración previa)
alter table public.expedientes_archivo add column if not exists sgd_expediente text;
-- ... (15 columnas agregadas)

-- 3. Renombrar columnas viejas (idempotente)
do $$
begin
  if exists (...) then
    alter table public.expedientes_archivo rename column numero_documento to serie_documento;
  end if;
  -- ...
end $$;

-- 4. DROP COLUMN de campos obsoletos (NUEVO en esta versión)
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_name = 'expedientes_archivo' and column_name = 'numero_expediente') then
    alter table public.expedientes_archivo drop column numero_expediente;
  end if;
  if exists (select 1 from information_schema.columns
             where table_name = 'expedientes_archivo' and column_name = 'fecha') then
    alter table public.expedientes_archivo drop column fecha;
  end if;
end $$;

-- 5. Crear índices
create index if not exists idx_expedientes_archivo_status on public.expedientes_archivo(status);
-- ... (5 índices)

-- 6. Trigger updated_at
drop trigger if exists set_expedientes_archivo_updated_at on public.expedientes_archivo;
create trigger set_expedientes_archivo_updated_at
before update on public.expedientes_archivo
for each row execute function public.set_updated_at();

-- 7. Habilitar RLS
alter table public.expedientes_archivo enable row level security;
-- ... (5 políticas)
```

### 20.2 Pre-requisitos

- Extensión `pg_trgm` para índice GIN de búsqueda
- Función `public.set_updated_at()` (trigger genérico)
- Función `public.is_editor()` (chequea `auth.jwt() -> 'app_metadata' -> 'role'`)

### 20.3 ⚠️ Acción manual requerida

Antes de mergear a producción, ejecutar este SQL en **Supabase Dashboard → SQL Editor**.
Sin esto, las queries PostgREST devolverán 400 o faltarán columnas.

---

## 21. Configuración (env vars)

Archivo: `.env.example` (documentado, no versionado en `.env.local`)

### 21.1 Variables requeridas

| Variable | Default | Descripción |
|---|---|---|
| `OPENAI_API_KEY` | — | API key de OpenAI |
| `OPENAI_LEGAL_MODEL` | `gpt-4.1-mini` | Modelo para chat/legal |
| `OPENAI_PDF_OCR_MODEL` | `gpt-4o` | Modelo para OCR de PDFs escaneados |
| `OPENAI_PDF_OCR_ENABLED` | `true` | Activar OCR con Vision |
| `OPENAI_OCR_MAX_PAGES` | `25` | Máximo de páginas a OCR |
| `PINECONE_API_KEY` | — | API key de Pinecone |
| `PINECONE_INDEX_NAME` | `ace-openai` | Nombre del índice |
| `PINECONE_NAMESPACE` | `legal-documents` | Namespace del corpus normativo |
| `PINECONE_ARCHIVO_NAMESPACE` | `archivo-municipal` | Namespace del archivo administrativo |
| `PINECONE_EXPEDIENTES_NAMESPACE` | `expedientes-archivo` | **Namespace de este módulo** (aislado) |
| `NEXT_PUBLIC_SUPABASE_URL` | — | URL del proyecto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | — | Anon key (cliente) |
| `SUPABASE_SERVICE_ROLE_KEY` | — | Service role key (server) |
| `SUPABASE_STORAGE_BUCKET` | `documents` | Bucket para PDFs |
| `CRON_SECRET` | — | Secreto para el drainer de indexación |

### 21.2 Variables opcionales

| Variable | Default | Descripción |
|---|---|---|
| `RERANK_ENABLED` | `true` | Re-ranking con Cohere |
| `COHERE_API_KEY` | — | Requerido si RERANK_ENABLED=true |
| `COHERE_RERANK_MODEL` | `rerank-v3.5` | Modelo de Cohere |
| `INDEXING_STALE_MINUTES` | `10` | Minutos tras los que un `processing` se considera muerto |
| `INDEXING_DRAIN_BATCH` | `3` | Documentos atascados por corrida del drainer |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | URL pública de la app |

---

## 22. Testing

### 22.1 Suite actual

- **12 archivos de test**, **123 tests passing**
- `tests/expedientes-archivo.test.ts` (24 tests específicos del módulo)

### 22.2 Cobertura

| Capa | Tests |
|---|---|
| Zod schemas en `lib/expedientes-archivo-actions.ts` | ✅ Validación de query muy corta, anio fuera de rango, limit fuera de rango, IDs > 200 |
| `parseError` helper | ✅ JSON error, fallback, HTTP status |
| `autoFillFromPdfAction` | ✅ Tipo incorrecto, tamaño > límite, URL correcta |
| `searchExpedientes` | ✅ Mock fetch, payload correcto |
| `chatWithExpedientes` | ✅ Mock fetch |
| `aiSearchExpedientes` | ✅ Mock fetch con limit default 20 |
| `detectDuplicates` | ✅ Sin params, con params, response shape |
| `bulkUpdateExpedientes` | ✅ Zod parse, max 200 |
| `bulkMarkForDisposal` | ✅ Mock fetch |

### 22.3 Pendientes de testing

- ❌ Componentes React (no hay React Testing Library en el proyecto)
- ❌ End-to-end (no hay Playwright/Cypress)
- ❌ Visual regression (no hay Chromatic/Percy)

---

## 23. Pendientes / roadmap

### 23.1 Alta prioridad

- [ ] **Integrar UI del sub-módulo Mesa de Partes** (los endpoints existen pero no
      hay UI en el workspace). Nueva pestaña "Mesa de Partes" o wizard desde el
      slide-over.
- [ ] **Accesibilidad**: agregar `aria-invalid` + `aria-describedby` a los inputs
      con error.
- [ ] **Tests de componentes** con React Testing Library.

### 23.2 Media prioridad

- [ ] **SSE/WebSockets** en lugar de polling cada 4s.
- [ ] **Recientes / favoritos** en la pestaña Buscar.
- [ ] **Firma digital** en DOCX de respuesta.
- [ ] **Workflow de aprobación** multi-usuario para respuesta oficial.
- [ ] **Historial de versiones** del PDF.
- [ ] **Búsqueda fuzzy** con tolerancia a typos.
- [ ] **OCR de imágenes** JPG/PNG/TIFF sueltas.

### 23.3 Baja prioridad

- [ ] **Sincronización con sistema externo** de archivo físico.
- [ ] **Notificaciones por email** cuando se marca un expediente para baja.
- [ ] **Reindex masivo** desde la UI (no solo individual).
- [ ] **Bulk export** de múltiples expedientes a ZIP.
- [ ] **Vista de calendario** de expedientes por fecha.
- [ ] **Métricas de uso** (expedientes más consultados, etc.).

---

## Apéndice A — Glosario

| Término | Definición |
|---|---|
| **SGD** | Sistema de Gestión Documental (municipal) |
| **Pinecone** | Vector DB para búsqueda semántica |
| **RAG** | Retrieval Augmented Generation (búsqueda + LLM) |
| **OCR** | Optical Character Recognition |
| **Namespace** | Aislamiento lógico en Pinecone |
| **Chunk** | Fragmento de texto (2600 chars) para embeddings |
| **TopK** | Número de resultados a recuperar |
| **Status pipeline** | uploaded → processing → indexed / error |
| **markForDisposal** | Marcado para baja (purga posterior) |
| **Wizard** | Flujo de 4 pasos para subir un expediente |
| **Slide-over** | Panel lateral deslizante de detalle |
| **Command palette** | Modal de búsqueda rápida (⌘K) |
| **Stepper** | Indicador de pasos con check de completitud |
| **Bulk operation** | Acción sobre múltiples expedientes seleccionados |
| **Wizard borrador** | Estado del form guardado en localStorage |

## Apéndice B — Historial de cambios del documento

| Fecha | Cambio | Autor |
|---|---|---|
| 2026-06-24 | Versión inicial. Documento vivo creado tras la implementación completa. | (auto-generado) |

---

> **Mantenimiento:** cualquier cambio en la implementación del módulo debe venir
> acompañado de un PR que actualice este documento en la misma sección. Si añades
> un nuevo endpoint, complétalo en §9. Si cambias un componente, actualiza §5.3.
> Si modificas el modelo de datos, refleja el cambio en §4.
