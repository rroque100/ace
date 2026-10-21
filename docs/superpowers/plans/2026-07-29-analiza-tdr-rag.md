# Analiza TDR — gestión del RAG + saneo de «Revisat TDR» — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir un botón «Analiza» dentro del modal de gestión «Revisar TDR» que abre una ventana modal nueva y grande para inspeccionar y gestionar el RAG del PDF de EETT/TDR subido (estado, metadatos, fragmentos, consulta de prueba, reindexado), y de paso sanear el botón «Revisar TDR» actual (permisos, formatos y solapamiento de modales).

**Architecture:** Cuatro rutas API nuevas bajo `app/api/necesidades/[id]/eett-tdr/[docId]/` (`rag`, `chunks`, `consulta`, `reindex`) reutilizan los helpers existentes (`searchTextRecords`, `deleteRecords`, `processPdfForSearch`) y comparten una lib de lógica pura `lib/eett-tdr-analiza.ts`. El modal `necesidad-eett-analiza-modal.tsx` consume esas rutas. El botón que lo abre vive en el `Dialog` de gestión ya existente en `necesidad-detail.tsx`. El saneo toca `ficha-editable.tsx` (permisos) y `necesidad-detail.tsx` (formatos + cerrar modal al subir).

**Tech Stack:** Next.js 16 (App Router, route handlers), React 19, TypeScript estricto, Radix Dialog (`app/components/ui/dialog.tsx`), Supabase PostgREST (`supabaseRest`), Pinecone (`searchTextRecords`/`deleteRecords`), Vitest.

## Global Constraints

- **Idioma:** código, comentarios, copy y commits en **español**, vocabulario de dominio (necesidad, EETT, TDR, RAG, chunk). Sin traducir términos legales.
- **Commits:** Conventional Commits con scope, asunto = **síntoma que ve el usuario**, minúsculas. Ej.: `feat(necesidades): el analiza del tdr deja gestionar el rag indexado`. **Solo commitear cuando el usuario lo autorice** (regla del repo).
- **Acceso a datos:** las rutas usan `supabaseRest` (service_role) de `lib/supabase-server.ts`. Cada ruta nueva valida que el documento pertenece a la necesidad (`metadata.necesidadId`) antes de devolver nada.
- **Autorización:** `requireUser` para lectura; `requireCapability("necesidad.manage")` para `reindex` (mismo guard que la subida, `app/api/necesidades/[id]/eett-tdr/route.ts:65`).
- **Tailwind:** el modal usa clases utilitarias dentro del `Dialog` (que ya porta la clase `.tw` en su portal). No tocar `app/styles.css`.
- **Sin comentarios «qué»:** solo comentarios «por qué», y solo si la decisión no es obvia.
- **Verificación por tarea:** `npm run typecheck` y `npm run lint` siempre; `npm run test` cuando haya tests nuevos.

---

## File Structure

**Crear:**
- `lib/eett-tdr-analiza.ts` — funciones puras (server-safe): etiquetas de estado, validación de pertenencia, builders de query PostgREST, filtro de consulta, normalización de metadatos. Sin red ni BD.
- `tests/eett-tdr-analiza.test.ts` — tests de la lógica pura (Vitest, sin red).
- `app/api/necesidades/[id]/eett-tdr/[docId]/rag/route.ts` — `GET` estado RAG + metadatos + último job + resumen.
- `app/api/necesidades/[id]/eett-tdr/[docId]/chunks/route.ts` — `GET` fragmentos paginados.
- `app/api/necesidades/[id]/eett-tdr/[docId]/consulta/route.ts` — `POST` consulta de prueba (recupera con `searchTextRecords`).
- `app/api/necesidades/[id]/eett-tdr/[docId]/reindex/route.ts` — `POST` reindexado (repite el patrón de `app/api/documents/[id]/route.ts`).
- `app/components/necesidad-eett-analiza-modal.tsx` — modal cliente «Analiza».

**Modificar:**
- `app/components/necesidad/ficha-editable.tsx` — punto 1 (ocultar botón «Revisar TDR» sin `permisos.manage`).
- `app/components/necesidad-detail.tsx` — puntos 3 y 5 (formatos PDF/.docx, cerrar modal al subir) + integración del botón «Analiza» y render del modal.

---

## Task 1: Lib de lógica pura `lib/eett-tdr-analiza.ts` + tests

**Files:**
- Create: `lib/eett-tdr-analiza.ts`
- Test: `tests/eett-tdr-analiza.test.ts`

**Interfaces:**
- Produce (firmas exactas que las rutas y el modal consumirán):
  - `export type EstadoIndexacion = { label: string; tone: "ok" | "error" | "info" | "pending" | "muted"; razon?: string }`
  - `export function estadoIndexacion(status: string, esDocx: boolean): EstadoIndexacion`
  - `export function esDocxEett(fileName: string): boolean`
  - `export function validarPertenenciaEett(doc: { metadata?: Record<string, unknown> | null }, necesidadId: string): boolean`
  - `export function queryChunks(docId: string, opts: { q?: string; page: number; limit: number }): string`
  - `export function queryChunksTotal(docId: string): string`
  - `export function filtroConsultaDoc(docId: string): { documentId: string }`
  - `export type MetadatosRag = { extractionMethod?: string; ocrParcial: boolean; indexedTextComplete: boolean; pageCount?: number; chunkCount?: number; recordCount?: number; namespace?: string; contentHash?: string; pipelineVersion?: string }`
  - `export function normalizarMetadatosRag(metadata: Record<string, unknown> | null | undefined): MetadatosRag`

- [ ] **Step 1: Write the failing tests**

Crear `tests/eett-tdr-analiza.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  estadoIndexacion,
  esDocxEett,
  filtroConsultaDoc,
  normalizarMetadatosRag,
  queryChunks,
  queryChunksTotal,
  validarPertenenciaEett,
} from "@/lib/eett-tdr-analiza";

describe("estadoIndexacion", () => {
  it("un .docx nunca se indexa", () => {
    expect(estadoIndexacion("uploaded", true)).toEqual({
      label: "No indexado",
      tone: "muted",
      razon: "Los .docx no entran en el RAG; solo se indexan los PDF.",
    });
    // aunque el estado sea indexed por error, un .docx no se indexa
    expect(estadoIndexacion("indexed", true).tone).toBe("muted");
  });

  it.each([
    ["uploaded", "Subido", "pending"],
    ["processing", "Procesando", "info"],
    ["indexed", "Indexado", "ok"],
    ["error", "Error", "error"],
  ] as const)("status %s -> %s / %s", (status, label, tone) => {
    const r = estadoIndexacion(status, false);
    expect(r.label).toBe(label);
    expect(r.tone).toBe(tone);
  });
});

describe("esDocxEett", () => {
  it("cierra por extensión sin importar mayúsculas", () => {
    expect(esDocxEett("tdr.docx")).toBe(true);
    expect(esDocxEett("tdr.DOCX")).toBe(true);
    expect(esDocxEett("tdr.pdf")).toBe(false);
  });
});

describe("validarPertenenciaEett", () => {
  const doc = (necesidadId: string, kind: string) => ({ metadata: { necesidadId, kind } });
  it("pertenece cuando coincide necesidadId y kind", () => {
    expect(validarPertenenciaEett(doc("N1", "eett_tdr"), "N1")).toBe(true);
  });
  it("no pertenece si la necesidad es otra", () => {
    expect(validarPertenenciaEett(doc("N1", "eett_tdr"), "N2")).toBe(false);
  });
  it("no pertenece si no es EETT/TDR", () => {
    expect(validarPertenenciaEett(doc("N1", "ley"), "N1")).toBe(false);
  });
  it("no pertenece si falta metadata", () => {
    expect(validarPertenenciaEett({ metadata: null }, "N1")).toBe(false);
    expect(validarPertenenciaEett({}, "N1")).toBe(false);
  });
});

describe("queryChunks", () => {
  it("pagina por chunk_index y respeta limit/offset", () => {
    expect(queryChunks("D1", { page: 1, limit: 20 })).toBe(
      "document_chunks?document_id=eq.D1&select=id,chunk_index,page_start,page_end,content,token_count,metadata&order=chunk_index.asc&limit=20&offset=0",
    );
    expect(queryChunks("D1", { page: 2, limit: 10 })).toMatch(/&limit=10&offset=10$/);
  });
  it("filtra por contenido cuando llega q", () => {
    expect(queryChunks("D1", { q: "plazo", page: 1, limit: 20 })).toMatch(
      /&content=ilike\.\*plazo\*/,
    );
  });
  it("no filtra por q vacío", () => {
    expect(queryChunks("D1", { q: "  ", page: 1, limit: 20 })).not.toContain("content=ilike");
  });
});

describe("queryChunksTotal", () => {
  it("cuenta con limit=0 sobre la misma raíz", () => {
    expect(queryChunksTotal("D1")).toBe(
      "document_chunks?document_id=eq.D1&select=id&limit=0",
    );
  });
});

describe("filtroConsultaDoc", () => {
  it("ancla la recuperación a un solo documento", () => {
    expect(filtroConsultaDoc("D1")).toEqual({ documentId: "D1" });
  });
});

describe("normalizarMetadatosRag", () => {
  it("aplana pinecone y normaliza flags", () => {
    const m = normalizarMetadatosRag({
      extractionMethod: "openai-ocr",
      ocrPartial: true,
      indexedTextComplete: false,
      pageCount: 30,
      chunkCount: 42,
      pinecone: { namespace: "legal-documents", recordCount: 42 },
      contentHash: "abc",
      indexingPipelineVersion: "legal-page-aware-v2",
    });
    expect(m).toEqual({
      extractionMethod: "openai-ocr",
      ocrParcial: true,
      indexedTextComplete: false,
      pageCount: 30,
      chunkCount: 42,
      recordCount: 42,
      namespace: "legal-documents",
      contentHash: "abc",
      pipelineVersion: "legal-page-aware-v2",
    });
  });
  it("metadata ausente -> valores por defecto seguros", () => {
    const m = normalizarMetadatosRag(null);
    expect(m.ocrParcial).toBe(false);
    expect(m.indexedTextComplete).toBe(true);
    expect(m.recordCount).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/eett-tdr-analiza.test.ts`
Expected: FAIL — no se resuelve `@/lib/eett-tdr-analiza`.

- [ ] **Step 3: Write the implementation**

Crear `lib/eett-tdr-analiza.ts`:

```ts
// Lógica pura del modal «Analiza» para EETT/TDR: cómo se etiqueta el estado de
// indexación, cómo se valida que un documento pertenece a la necesidad, y cómo
// se arman las queries PostgREST y el filtro de recuperación. Sin red ni BD:
// vive aquí para que las rutas y el modal compartan exactamente las mismas
// reglas y se pueda testear sin mocks pesados.

export type EstadoIndexacion = {
  label: string;
  tone: "ok" | "error" | "info" | "pending" | "muted";
  razon?: string;
};

export function esDocxEett(fileName: string): boolean {
  return /\.docx$/i.test(fileName);
}

// El indexado RAG solo aplica a PDF (`eett-tdr/route.ts:170-175`). Un .docx se
// acepta como adjunto y se lee para el editor, pero nunca llega a Pinecone:
// su estado real es "no indexado", y conviene mostrarlo así por encima del
// `status` que traiga la fila.
export function estadoIndexacion(status: string, esDocx: boolean): EstadoIndexacion {
  if (esDocx) {
    return {
      label: "No indexado",
      tone: "muted",
      razon: "Los .docx no entran en el RAG; solo se indexan los PDF.",
    };
  }
  switch (status) {
    case "processing":
      return { label: "Procesando", tone: "info" };
    case "indexed":
      return { label: "Indexado", tone: "ok" };
    case "error":
      return { label: "Error", tone: "error" };
    case "uploaded":
    default:
      return { label: "Subido", tone: "pending" };
  }
}

export function validarPertenenciaEett(
  doc: { metadata?: Record<string, unknown> | null },
  necesidadId: string,
): boolean {
  const md = doc.metadata;
  if (!md) return false;
  return md.necesidadId === necesidadId && md.kind === "eett_tdr";
}

export function queryChunks(
  docId: string,
  opts: { q?: string; page: number; limit: number },
): string {
  const offset = Math.max(0, (opts.page - 1) * opts.limit);
  const base = `document_chunks?document_id=eq.${docId}&select=id,chunk_index,page_start,page_end,content,token_count,metadata&order=chunk_index.asc&limit=${opts.limit}&offset=${offset}`;
  const q = opts.q?.trim();
  if (!q) return base;
  return `${base}&content=ilike.*${encodeURIComponent(q)}*`;
}

export function queryChunksTotal(docId: string): string {
  return `document_chunks?document_id=eq.${docId}&select=id&limit=0`;
}

// Filtro de Pinecone: ancla la consulta de prueba al documento, no al corpus.
// `compactFilter` (`lib/pinecone.ts:114`) lo traduce a `{ document_id: { $eq } }`.
export function filtroConsultaDoc(docId: string): { documentId: string } {
  return { documentId: docId };
}

export type MetadatosRag = {
  extractionMethod?: string;
  ocrParcial: boolean;
  indexedTextComplete: boolean;
  pageCount?: number;
  chunkCount?: number;
  recordCount?: number;
  namespace?: string;
  contentHash?: string;
  pipelineVersion?: string;
};

// Aplana `metadata.pinecone` y fija defaults: si el documento no dice nada sobre
// `indexedTextComplete`, asumimos que SÍ está completo (el caso normal). Lo mismo
// con `ocrParcial`: ausente => false.
export function normalizarMetadatosRag(
  metadata: Record<string, unknown> | null | undefined,
): MetadatosRag {
  const md = metadata ?? {};
  const pine = (md.pinecone ?? {}) as Record<string, unknown>;
  return {
    extractionMethod: md.extractionMethod as string | undefined,
    ocrParcial: Boolean(md.ocrPartial),
    indexedTextComplete:
      typeof md.indexedTextComplete === "boolean" ? md.indexedTextComplete : true,
    pageCount: md.pageCount as number | undefined,
    chunkCount: md.chunkCount as number | undefined,
    recordCount: pine.recordCount as number | undefined,
    namespace: pine.namespace as string | undefined,
    contentHash: md.contentHash as string | undefined,
    pipelineVersion: md.indexingPipelineVersion as string | undefined,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/eett-tdr-analiza.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add lib/eett-tdr-analiza.ts tests/eett-tdr-analiza.test.ts
git commit -m "feat(necesidades): anade la logica de estado y filtros del analiza del tdr"
```

---

## Task 2: Ruta `GET rag` (estado RAG + metadatos + job + resumen)

**Files:**
- Create: `app/api/necesidades/[id]/eett-tdr/[docId]/rag/route.ts`

**Interfaces:**
- Consumes: `validarPertenenciaEett`, `normalizarMetadatosRag` (Task 1).
- Produce: `GET` → `200 { documento: { id, status, error_message, file_name, metadatos } , job: ProcessingJobResumen | null, resumen: DocumentSummaryResumen | null } | 404`.

- [ ] **Step 1: Write the route**

Crear `app/api/necesidades/[id]/eett-tdr/[docId]/rag/route.ts`:

```ts
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { normalizarMetadatosRag, validarPertenenciaEett } from "@/lib/eett-tdr-analiza";
import { type DocumentRecord, getSupabaseServerConfig, supabaseRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET → estado de indexación del EETT/TDR + metadatos del pipeline + último job
// + resumen ejecutivo. Es la columna izquierda del modal «Analiza».
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; docId: string }> },
) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  try {
    getSupabaseServerConfig();
    const { id, docId } = await context.params;

    const docs = await supabaseRest<DocumentRecord[]>(
      `documents?id=eq.${docId}&select=id,file_name,status,error_message,metadata`,
    );
    const doc = docs[0];
    if (!doc || !validarPertenenciaEett(doc, id)) {
      return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    }

    const [jobs, summaries] = await Promise.all([
      supabaseRest<Array<{ status: string; error_message: string | null; started_at: string | null; completed_at: string | null; metadata: Record<string, unknown> }>>(
        `processing_jobs?document_id=eq.${docId}&select=status,error_message,started_at,completed_at,metadata&order=created_at.desc&limit=1`,
      ).catch(() => []),
      supabaseRest<Array<{ content: string; model: string | null; metadata: Record<string, unknown> }>>(
        `document_summaries?document_id=eq.${docId}&summary_type=eq.executive&select=content,model,metadata&order=created_at.desc&limit=1`,
      ).catch(() => []),
    ]);

    return NextResponse.json({
      documento: {
        id: doc.id,
        file_name: doc.file_name,
        status: doc.status,
        error_message: doc.error_message ?? null,
        metadatos: normalizarMetadatosRag(doc.metadata),
      },
      job: jobs[0] ?? null,
      resumen: summaries[0] ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo leer el estado del RAG" },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: sin errores. Si `DocumentRecord.metadata` no admite `null`, ajustar el cast según el tipo real en `lib/supabase-server.ts:16`.

- [ ] **Step 3: Commit**

```bash
git add app/api/necesidades/[id]/eett-tdr/[docId]/rag/route.ts
git commit -m "feat(necesidades): el analiza del tdr expone el estado del rag indexado"
```

---

## Task 3: Ruta `GET chunks` (fragmentos paginados)

**Files:**
- Create: `app/api/necesidades/[id]/eett-tdr/[docId]/chunks/route.ts`

**Interfaces:**
- Consumes: `validarPertenenciaEett`, `queryChunks`, `queryChunksTotal` (Task 1).
- Produce: `GET ?q=&page=&limit=` → `200 { items: ChunkResumen[], total, page, limit } | 404`.

- [ ] **Step 1: Write the route**

Crear `app/api/necesidades/[id]/eett-tdr/[docId]/chunks/route.ts`:

```ts
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { queryChunks, queryChunksTotal, validarPertenenciaEett } from "@/lib/eett-tdr-analiza";
import {
  type DocumentRecord,
  getSupabaseHeaders,
  getSupabaseServerConfig,
  supabaseRest,
} from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ChunkResumen = {
  id: string;
  chunk_index: number;
  page_start: number | null;
  page_end: number | null;
  content: string;
  token_count: number | null;
};

// PostgREST cuenta con `Prefer: count=exact` + `limit=0` y devuelve el total en
// el header `content-range` (formato `*/<total>`). `supabaseRest` no expone
// headers, así que el conteo se hace con un fetch aparte que sí los lee.
async function contarChunks(docId: string): Promise<number> {
  const { supabaseUrl } = getSupabaseServerConfig();
  const res = await fetch(`${supabaseUrl}/rest/v1/${queryChunksTotal(docId)}`, {
    headers: { ...getSupabaseHeaders("count=exact") },
    cache: "no-store",
  });
  const range = res.headers.get("content-range");
  const total = range ? Number(range.split("/").pop()) : NaN;
  return Number.isFinite(total) ? total : 0;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; docId: string }> },
) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  try {
    getSupabaseServerConfig();
    const { id, docId } = await context.params;

    const docs = await supabaseRest<DocumentRecord[]>(
      `documents?id=eq.${docId}&select=id,file_name,metadata`,
    );
    const doc = docs[0];
    if (!doc || !validarPertenenciaEett(doc, id)) {
      return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    }

    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
    const rawLimit = Number(url.searchParams.get("limit") ?? "20") || 20;
    const limit = Math.min(50, Math.max(1, rawLimit));
    const q = url.searchParams.get("q") ?? undefined;

    const [items, total] = await Promise.all([
      supabaseRest<ChunkResumen[]>(queryChunks(docId, { q, page, limit })),
      contarChunks(docId),
    ]);

    return NextResponse.json({ items: items ?? [], total, page, limit });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron listar los fragmentos" },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: sin errores. `getSupabaseHeaders` y `getSupabaseServerConfig` ya se exportan de `lib/supabase-server.ts`.

- [ ] **Step 3: Commit**

```bash
git add app/api/necesidades/[id]/eett-tdr/[docId]/chunks/route.ts
git commit -m "feat(necesidades): el analiza del tdr lista los fragmentos indexados"
```

---

## Task 4: Ruta `POST consulta` (recuperación de prueba)

**Files:**
- Create: `app/api/necesidades/[id]/eett-tdr/[docId]/consulta/route.ts`

**Interfaces:**
- Consumes: `validarPertenenciaEett`, `filtroConsultaDoc` (Task 1), `searchTextRecords` (`lib/pinecone.ts:464`).
- Produce: `POST { query }` → `200 { resultados: [{ chunk_index, page_start, score, extracto }] } | 400 (query vacío) | 404`.

- [ ] **Step 1: Write the route**

Crear `app/api/necesidades/[id]/eett-tdr/[docId]/consulta/route.ts`:

```ts
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { filtroConsultaDoc, validarPertenenciaEett } from "@/lib/eett-tdr-analiza";
import { searchTextRecords } from "@/lib/pinecone";
import { type DocumentRecord, getSupabaseServerConfig, supabaseRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST → recupera fragmentos del propio documento para una consulta de prueba.
// Sirve para verificar que el RAG «sabe» responder sobre ese TDR. topK fijo en 8.
const TOP_K = 8;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; docId: string }> },
) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  try {
    getSupabaseServerConfig();
    const { id, docId } = await context.params;

    const body = (await request.json().catch(() => ({}))) as { query?: string };
    const query = body.query?.trim();
    if (!query) {
      return NextResponse.json({ error: "Escribe una consulta." }, { status: 400 });
    }

    const docs = await supabaseRest<DocumentRecord[]>(
      `documents?id=eq.${docId}&select=id,file_name,metadata`,
    );
    const doc = docs[0];
    if (!doc || !validarPertenenciaEett(doc, id)) {
      return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    }

    const hits = await searchTextRecords(query, TOP_K, filtroConsultaDoc(docId));
    const resultados = hits.map((h) => {
      const md = (h as Record<string, unknown>).metadata as Record<string, unknown> | undefined;
      const content = String((h as Record<string, unknown>).content ?? md?.content ?? "");
      return {
        chunk_index: Number((h as Record<string, unknown>).chunk_index ?? md?.chunk_index ?? -1),
        page_start: (() => {
          const v = (h as Record<string, unknown>).page_start ?? md?.page_start;
          return v === undefined ? null : Number(v);
        })(),
        score: Number((h as Record<string, unknown>)._score ?? 0),
        extracto: content.slice(0, 320),
      };
    });

    return NextResponse.json({ resultados });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo consultar el RAG" },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: sin errores. Ajustar el acceso a campos del hit según el tipo `PineconeSearchHit` si TS reclama; los `as Record<string, unknown>` ya son defensivos.

- [ ] **Step 3: Commit**

```bash
git add app/api/necesidades/[id]/eett-tdr/[docId]/consulta/route.ts
git commit -m "feat(necesidades): el analiza del tdr deja probar la recuperacion del rag"
```

---

## Task 5: Ruta `POST reindex` (reindexado asíncrono)

**Files:**
- Create: `app/api/necesidades/[id]/eett-tdr/[docId]/reindex/route.ts`

**Interfaces:**
- Consumes: `validarPertenenciaEett` (Task 1), `requireCapability` (`lib/auth.ts:258`), `processPdfForSearch`, `deleteRecords`, `downloadStorageObject`, rate-limit (`lib/rate-limit`).
- Produce: `POST` → `202 { reindexando: true } | 404 | 429`.

Patrón a replicar: `app/api/documents/[id]/route.ts` (POST, líneas 87-172).

- [ ] **Step 1: Write the route**

Crear `app/api/necesidades/[id]/eett-tdr/[docId]/reindex/route.ts`:

```ts
import { after, NextResponse } from "next/server";
import { requireCapability } from "@/lib/auth";
import { validarPertenenciaEett } from "@/lib/eett-tdr-analiza";
import { deleteRecords } from "@/lib/pinecone";
import { processPdfForSearch } from "@/lib/pdf-processing";
import { checkRateLimit, getRateLimitKey, rateLimitResponse, RATE_LIMITS } from "@/lib/rate-limit";
import {
  type DocumentRecord,
  downloadStorageObject,
  getSupabaseServerConfig,
  supabaseRest,
  writeAuditLog,
} from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ChunkVector = { pinecone_vector_id: string | null };

async function getDocumentVectors(documentId: string) {
  const chunks = await supabaseRest<ChunkVector[]>(
    `document_chunks?document_id=eq.${documentId}&select=pinecone_vector_id`,
  );
  const vectorIds = chunks
    .map((c) => c.pinecone_vector_id)
    .filter((v): v is string => Boolean(v));
  return { chunks, vectorIds };
}

// POST → reindexa el EETT/TDR. Mismo guard que la subida (necesidad.manage) y
// mismo patrón que /api/documents/[id]: marca `processing`, borra vectores/chunks
// viejos y reprocesa en `after()`. El modal hace polling de GET rag.
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; docId: string }> },
) {
  const auth = await requireCapability("necesidad.manage");
  if ("error" in auth) return auth.error;

  const rl = checkRateLimit(
    getRateLimitKey(request, auth.user.id, "eett-tdr-reindex"),
    RATE_LIMITS.reindex,
  );
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    getSupabaseServerConfig();
    const { id, docId } = await context.params;

    const docs = await supabaseRest<DocumentRecord[]>(
      `documents?id=eq.${docId}&select=id,title,file_name,file_size,mime_type,storage_bucket,storage_path,document_type,process_type,source_entity,status,error_message,metadata,created_at,updated_at`,
    );
    const doc = docs[0];
    if (!doc || !validarPertenenciaEett(doc, id)) {
      return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    }

    // Feedback inmediato en la UI: el polling del modal detecta el `processing`.
    await supabaseRest(`documents?id=eq.${docId}`, {
      body: JSON.stringify({ error_message: null, status: "processing" }),
      method: "PATCH",
    }).catch(() => undefined);

    after(async () => {
      try {
        const { chunks, vectorIds } = await getDocumentVectors(docId);
        await deleteRecords(vectorIds);
        await supabaseRest(`document_chunks?document_id=eq.${docId}`, { method: "DELETE" });

        const blob = await downloadStorageObject(doc.storage_bucket, doc.storage_path);
        const file = new File([blob], doc.file_name, { type: doc.mime_type || "application/pdf" });
        const indexing = await processPdfForSearch(doc, file);

        await writeAuditLog({
          action: "necesidad.eett_tdr.reindex",
          details: {
            deletedChunks: chunks.length,
            deletedVectors: vectorIds.length,
            newChunks: indexing.chunkCount,
            pageCount: indexing.pageCount,
            textLength: indexing.textLength,
          },
          entityId: docId,
          entityType: "document",
        });
      } catch {
        // processPdfForSearch ya persiste el error en el documento y el job.
      }
    });

    return NextResponse.json({ reindexando: true }, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo reindexar el EETT/TDR" },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: sin errores. `RATE_LIMITS.reindex` ya existe (lo usa `app/api/documents/[id]/route.ts:102`).

- [ ] **Step 3: Commit**

```bash
git add app/api/necesidades/[id]/eett-tdr/[docId]/reindex/route.ts
git commit -m "feat(necesidades): el analiza del tdr permite reindexar el documento"
```

---

## Task 6: Saneo del botón «Revisar TDR» (puntos 1, 3 y 5)

**Files:**
- Modify: `app/components/necesidad/ficha-editable.tsx:567-576` (punto 1)
- Modify: `app/components/necesidad-detail.tsx:1903,1915,1928` (punto 3), `:898` (punto 5)

**Interfaces:**
- Consumes: `permisos.manage` ya en scope en `ficha-editable.tsx:141`.

- [ ] **Step 1: Punto 1 — ocultar el botón sin permisos**

En `app/components/necesidad/ficha-editable.tsx`, el bloque `section.title.startsWith("3.4")` (líneas 567-576) envolverlo en `{permisos.manage ? ( … ) : null}`. Queda:

```tsx
{section.title.startsWith("3.4") && permisos.manage ? (
  <button
    type="button"
    onClick={eett.gestionar}
    className="inline-flex w-fit items-center gap-2 rounded-[10px] border border-brand/30 bg-brand-soft px-3 py-2 text-[13px] font-semibold text-brand transition hover:border-brand/50 hover:bg-brand-soft"
  >
    <FileText size={15} /> Revisar TDR
    <span className="font-normal text-brand/80">— subir y gestionar el PDF (se indexa en el buscador con IA)</span>
  </button>
) : null}
```

- [ ] **Step 2: Punto 3 — aceptar PDF y .docx en el modal de gestión**

En `app/components/necesidad-detail.tsx`:
- Línea `:1915` `accept="application/pdf,.pdf"` → `accept="application/pdf,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"`.
- Línea `:1928` etiqueta `Subir {eettTipo === "eett" ? "EETT" : "TDR"} (PDF)` → `Subir {eettTipo === "eett" ? "EETT" : "TDR"} (PDF o .docx)`.
- Línea `:1903` `description="Sube el PDF del EETT (bienes) o TDR (servicios): …"` → reemplazar «Sube el PDF» por «Sube el PDF (o .docx)» manteniendo el resto del texto.

- [ ] **Step 3: Punto 5 — cerrar el modal de gestión al subir**

En `app/components/necesidad-detail.tsx`, dentro de `subirEett` (alrededor de `:898`, donde se hace `setEettModal({ … })`), añadir justo antes `setGestionTdrAbierta(false);`. Así la subida no deja dos modales apilados. Es idempotente si la subida viene del campo inline (`gestionTdrAbierta` ya es `false`).

- [ ] **Step 4: Punto 4 — verificar selectores de tipo (de paso)**

Confirmar que `subirEett` (`necesidad-detail.tsx:883`) recibe `tipo` explícito en **todas** las llamadas (campo inline y modal de gestión), de modo que el selector del modal de gestión (`eettTipo`) y el del campo inline (`tipo` local) no se pisen. Hoy ya es así por el cambio documentado en `:880-882`; este paso es solo verificación —si se detecta un sitio que derive el tipo del estado global, corregirlo para que lo pase explícito.

- [ ] **Step 5: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add app/components/necesidad/ficha-editable.tsx app/components/necesidad-detail.tsx
git commit -m "fix(necesidades): el boton revisar tdr fallaba sin permisos y solo aceptaba pdf"
```

---

## Task 7: Modal `necesidad-eett-analiza-modal.tsx`

**Files:**
- Create: `app/components/necesidad-eett-analiza-modal.tsx`

**Interfaces:**
- Consumes: las 4 rutas de Tasks 2-5; `Dialog`/`DialogContent` (`app/components/ui/dialog.tsx`); `estadoIndexacion`, `esDocxEett` (Task 1).
- Produce: componente por defecto `NecesidadEettAnalizaModal({ necesidadId, docId, onClose })`.

- [ ] **Step 1: Write the component**

Crear `app/components/necesidad-eett-analiza-modal.tsx` (cliente):

```tsx
"use client";

import { FileSearch, FileText, Loader, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { estadoIndexacion, esDocxEett } from "@/lib/eett-tdr-analiza";

type MetadatosRag = {
  extractionMethod?: string;
  ocrParcial: boolean;
  indexedTextComplete: boolean;
  pageCount?: number;
  chunkCount?: number;
  recordCount?: number;
  namespace?: string;
  contentHash?: string;
  pipelineVersion?: string;
};
type RagState = {
  documento: {
    id: string;
    file_name: string;
    status: string;
    error_message: string | null;
    metadatos: MetadatosRag;
  };
  job: { status: string; error_message: string | null; started_at: string | null; completed_at: string | null } | null;
  resumen: { content: string } | null;
};
type Chunk = {
  id: string;
  chunk_index: number;
  page_start: number | null;
  page_end: number | null;
  content: string;
  token_count: number | null;
};
type Resultado = { chunk_index: number; page_start: number | null; score: number; extracto: string };

const TONE_BADGE: Record<string, string> = {
  ok: "bg-emerald-100 text-emerald-700",
  error: "bg-red-100 text-red-700",
  info: "bg-blue-100 text-blue-700",
  pending: "bg-amber-100 text-amber-700",
  muted: "bg-gray-100 text-gray-500",
};

export function NecesidadEettAnalizaModal({
  necesidadId,
  docId,
  fileName,
  onClose,
}: {
  necesidadId: string;
  docId: string;
  fileName: string;
  onClose: () => void;
}) {
  const docx = esDocxEett(fileName);
  const [pestana, setPestana] = useState<"fragmentos" | "consulta" | "resumen">("fragmentos");
  const [rag, setRag] = useState<RagState | null>(null);
  const [cargandoRag, setCargandoRag] = useState(true);
  const [reindexando, setReindexando] = useState(false);

  const cargarRag = useCallback(async () => {
    try {
      const r = await fetch(`/api/necesidades/${necesidadId}/eett-tdr/${docId}/rag`, { cache: "no-store" });
      if (r.ok) setRag((await r.json()) as RagState);
    } catch {
      /* el estado se queda como estaba */
    } finally {
      setCargandoRag(false);
    }
  }, [necesidadId, docId]);

  useEffect(() => {
    void cargarRag();
  }, [cargarRag]);

  // Polling mientras el documento esté procesando.
  const procesando = rag?.documento.status === "processing";
  useEffect(() => {
    if (!procesando) return;
    const t = setInterval(() => void cargarRag(), 4000);
    return () => clearInterval(t);
  }, [procesando, cargarRag]);

  const status = rag?.documento.status ?? "uploaded";
  const est = estadoIndexacion(status, docx);

  async function reindexar() {
    if (!confirm("Se borrarán los vectores y fragmentos actuales y se reindexará el PDF. Continuar?")) return;
    setReindexando(true);
    try {
      const r = await fetch(`/api/necesidades/${necesidadId}/eett-tdr/${docId}/reindex`, { method: "POST" });
      if (r.ok) await cargarRag();
    } finally {
      setReindexando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        size="xl"
        className="max-w-[1100px]"
        title={
          <span className="flex items-center gap-2">
            <FileSearch size={18} /> Analiza — {fileName}
          </span>
        }
        description="Inspecciona y gestiona el RAG del EETT/TDR: estado de indexación, fragmentos, consulta de prueba y reindexado."
      >
        {cargandoRag ? (
          <p className="flex items-center gap-2 text-[13px] text-muted">
            <Loader size={14} className="spinIcon" /> Cargando estado del RAG…
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[300px_1fr]">
            {/* Columna izquierda: estado + metadatos + reindexar */}
            <aside className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${TONE_BADGE[est.tone]}`}>
                  {est.label}
                </span>
                {procesando ? <Loader size={14} className="spinIcon text-muted" /> : null}
              </div>
              {est.razon ? <p className="text-[12px] text-muted">{est.razon}</p> : null}
              {rag?.documento.error_message ? (
                <p className="rounded-md bg-red-50 p-2 text-[12px] text-red-700">{rag.documento.error_message}</p>
              ) : null}

              <dl className="grid grid-cols-2 gap-y-1.5 text-[12px]">
                <Meta k="Extracción" v={rag?.documento.metadatos.extractionMethod ?? "—"} />
                <Meta k="Páginas" v={fmtNum(rag?.documento.metadatos.pageCount)} />
                <Meta k="Fragmentos" v={fmtNum(rag?.documento.metadatos.chunkCount)} />
                <Meta k="Vectores" v={fmtNum(rag?.documento.metadatos.recordCount)} />
                <Meta k="Namespace" v={rag?.documento.metadatos.namespace ?? "—"} />
                <Meta k="Pipeline" v={rag?.documento.metadatos.pipelineVersion ?? "—"} />
              </dl>

              {rag?.documento.metadatos.ocrParcial ? (
                <p className="rounded-md bg-amber-50 p-2 text-[12px] text-amber-700">
                  OCR parcial: el PDF excedió el tope de páginas y el RAG puede estar incompleto.
                </p>
              ) : null}
              {rag && !rag.documento.metadatos.indexedTextComplete ? (
                <p className="rounded-md bg-amber-50 p-2 text-[12px] text-amber-700">
                  Indexación incompleta según el pipeline.
                </p>
              ) : null}

              {docx ? null : (
                <button
                  type="button"
                  onClick={() => void reindexar()}
                  disabled={reindexando || procesando}
                  className="inline-flex w-fit items-center gap-2 rounded-[10px] border border-brand/30 bg-brand-soft px-3 py-2 text-[13px] font-semibold text-brand hover:border-brand/50 disabled:opacity-50"
                >
                  {reindexando ? <Loader size={14} className="spinIcon" /> : <RefreshCw size={14} />}
                  Reindexar
                </button>
              )}
            </aside>

            {/* Columna derecha: explorador */}
            <section className="flex min-h-[320px] flex-col">
              <div className="mb-3 flex gap-1 border-b border-line">
                {(["fragmentos", "consulta", "resumen"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPestana(p)}
                    className={`-mb-px border-b-2 px-3 py-1.5 text-[13px] font-semibold ${
                      pestana === p ? "border-brand text-brand" : "border-transparent text-muted"
                    }`}
                  >
                    {p === "fragmentos" ? "Fragmentos" : p === "consulta" ? "Consulta" : "Resumen IA"}
                  </button>
                ))}
              </div>

              {docx ? (
                <p className="text-[13px] text-muted">
                  Los .docx no se indexan: no hay fragmentos ni consulta de prueba disponibles.
                </p>
              ) : pestana === "fragmentos" ? (
                <Fragmentos necesidadId={necesidadId} docId={docId} />
              ) : pestana === "consulta" ? (
                <Consulta necesidadId={necesidadId} docId={docId} />
              ) : (
                <ResumenIa resumen={rag?.resumen ?? null} />
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-muted">{k}</dt>
      <dd className="font-semibold text-ink">{v}</dd>
    </>
  );
}
function fmtNum(n: number | undefined): string {
  return n === undefined ? "—" : String(n);
}

function Fragmentos({ necesidadId, docId }: { necesidadId: string; docId: string }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: Chunk[]; total: number } | null>(null);
  const [cargando, setCargando] = useState(true);
  const limit = 20;

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    const url = `/api/necesidades/${necesidadId}/eett-tdr/${docId}/chunks?page=${page}&limit=${limit}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
    void (async () => {
      try {
        const r = await fetch(url, { cache: "no-store" });
        if (r.ok && vivo) setData(await r.json());
      } catch {
        /* lista vacía */
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [necesidadId, docId, page, q]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Search size={14} className="text-muted" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          placeholder="Buscar dentro del documento…"
          className="w-full rounded-md border border-line px-2.5 py-1.5 text-[13px]"
        />
      </div>
      {cargando ? (
        <p className="flex items-center gap-2 text-[13px] text-muted"><Loader size={14} className="spinIcon" /> Cargando fragmentos…</p>
      ) : data && data.items.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {data.items.map((c) => (
            <li key={c.id} className="rounded-md border border-line bg-surface p-2.5 text-[12.5px]">
              <div className="mb-1 flex justify-between text-muted">
                <span>#{c.chunk_index}{c.page_start != null ? ` · pág. ${c.page_start}` : ""}</span>
                <span>{c.token_count ?? 0} tokens</span>
              </div>
              <p className="whitespace-pre-wrap text-ink">{c.content}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-muted">Sin fragmentos.</p>
      )}
      {data && data.total > limit ? (
        <div className="flex items-center gap-2 text-[12px] text-muted">
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded border border-line px-2 py-0.5 disabled:opacity-40">‹</button>
          Pág. {page} de {Math.ceil(data.total / limit)}
          <button type="button" onClick={() => setPage((p) => p + 1)} disabled={page * limit >= data.total} className="rounded border border-line px-2 py-0.5 disabled:opacity-40">›</button>
        </div>
      ) : null}
    </div>
  );
}

function Consulta({ necesidadId, docId }: { necesidadId: string; docId: string }) {
  const [query, setQuery] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<Resultado[] | null>(null);
  const [error, setError] = useState("");

  async function buscar() {
    setError("");
    setBuscando(true);
    try {
      const r = await fetch(`/api/necesidades/${necesidadId}/eett-tdr/${docId}/consulta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const d = await r.json();
      if (!r.ok) setError(d.error ?? "No se pudo consultar.");
      else setResultados(d.resultados ?? []);
    } catch {
      setError("No se pudo conectar.");
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Escribe una consulta para ver qué fragmentos recupera el RAG…"
          rows={2}
          className="w-full rounded-md border border-line px-2.5 py-1.5 text-[13px]"
        />
        <button
          type="button"
          onClick={() => void buscar()}
          disabled={buscando || !query.trim()}
          className="inline-flex items-center gap-1.5 self-end rounded-md bg-brand px-3 py-1.5 text-[13px] font-semibold text-white disabled:opacity-50"
        >
          {buscando ? <Loader size={14} className="spinIcon" /> : <Search size={14} />} Probar
        </button>
      </div>
      {error ? <p className="text-[12px] text-red-600">{error}</p> : null}
      {resultados && resultados.length === 0 ? (
        <p className="text-[13px] text-muted">Sin resultados para este documento.</p>
      ) : null}
      {resultados && resultados.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {resultados.map((r, i) => (
            <li key={i} className="rounded-md border border-line bg-surface p-2.5 text-[12.5px]">
              <div className="mb-1 flex justify-between text-muted">
                <span>#{r.chunk_index}{r.page_start != null ? ` · pág. ${r.page_start}` : ""}</span>
                <span>score {r.score.toFixed(3)}</span>
              </div>
              <p className="text-ink">{r.extracto}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ResumenIa({ resumen }: { resumen: { content: string } | null }) {
  if (!resumen) return <p className="text-[13px] text-muted">Este documento aún no tiene resumen ejecutivo.</p>;
  return (
    <div className="flex items-start gap-2 rounded-md border border-line bg-surface p-3 text-[13px] text-ink">
      <FileText size={15} className="mt-0.5 shrink-0 text-muted" />
      <p className="whitespace-pre-wrap">{resumen.content}</p>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: sin errores. `FileSearch` ya se usa en el repo (`app/components/legal-activity.tsx`, `app/components/pdf-cite-viewer.tsx`).

- [ ] **Step 3: Añadir el componente a `@source` de Tailwind**

`app/tailwind.css` lista los componentes migrados uno a uno (no hay `@source` global para `app/components/**`). Añadir una línea junto a `@source "./components/necesidad-eett-campo.tsx";` (línea `:35`):

```css
@source "./components/necesidad-eett-analiza-modal.tsx";
```

Sin esa línea, las clases utilitarias del modal no se generan y se vería sin estilos.

- [ ] **Step 4: Commit**

```bash
git add app/components/necesidad-eett-analiza-modal.tsx app/tailwind.css
git commit -m "feat(necesidades): anade el modal analiza para gestionar el rag del tdr"
```

---

## Task 8: Integración del botón «Analiza» + render del modal

**Files:**
- Modify: `app/components/necesidad-detail.tsx`

**Interfaces:**
- Consumes: `NecesidadEettAnalizaModal` (Task 7), `EettDocRow` (local, `:258`).

- [ ] **Step 1: State + handler**

En `app/components/necesidad-detail.tsx`, junto al estado de EETT (alrededor de `:278`, donde vive `eettModal`), añadir:

```tsx
const [analizaTdrAbierta, setAnalizaTdrAbierta] = useState<{ doc: EettDocRow } | null>(null);
```

Junto a `abrirEett`/`gestionarTdr` (alrededor de `:575`), añadir el handler:

```tsx
const analizarEett = useCallbackEstable((d: EettDocRow) => {
  setGestionTdrAbierta(false);
  setAnalizaTdrAbierta({ doc: d });
});
```

- [ ] **Step 2: Botón «Analiza» en la lista del modal de gestión**

En el `Dialog` `gestionTdrAbierta` (la lista de `eettDocs.map`, alrededor de `:1933-1949`), cada `<li>` ya tiene un botón «Revisar / editar» (`:1942`) y uno de borrado (`:1945`). Añadir entre ellos un botón «Analiza»:

```tsx
<Button type="button" onClick={() => analizarEett(d)}>
  <FileSearch size={13} /> Analiza
</Button>
```

`FileSearch` debe añadirse al import de `lucide-react` en `necesidad-detail.tsx:6-23` (junto a `FileText`).

- [ ] **Step 3: Render del modal «Analiza»**

Al final del componente, junto al render de `eettModal` (alrededor de `:1959`), añadir:

```tsx
{analizaTdrAbierta ? (
  <NecesidadEettAnalizaModal
    necesidadId={necesidadId}
    docId={analizaTdrAbierta.doc.id}
    fileName={analizaTdrAbierta.doc.file_name}
    onClose={() => setAnalizaTdrAbierta(null)}
  />
) : null}
```

Añadir el import arriba del todo: `import { NecesidadEettAnalizaModal } from "@/components/necesidad-eett-analiza-modal";` (respetar el orden de imports existente; si el archivo usa alias `@/app/components/...`, calcarlo).

- [ ] **Step 4: Typecheck + lint + build**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: sin errores. El build confirma que el route handler y el componente cliente compilan juntos.

- [ ] **Step 5: Run full test suite**

Run: `npm run test`
Expected: PASS (incluye `tests/eett-tdr-analiza.test.ts` y los existentes).

- [ ] **Step 6: Commit**

```bash
git add app/components/necesidad-detail.tsx
git commit -m "feat(necesidades): el boton analiza abre la gestion del rag del tdr"
```

---

## Verificación final

- `npm run lint && npm run typecheck && npm run test && npm run build` — los cuatro en verde (CI).
- Revisión visual con el entorno de preview (`.claude/launch.json`): abrir una necesidad con un EETT/TDR PDF subido → sección 3.4 → «Revisar TDR» → «Analiza» → comprobar estado, fragmentos, consulta de prueba y reindexado; repetir con un `.docx` (debe mostrar «No indexado» y ocultar Reindexar); comprobar que sin `permisos.manage` el botón «Revisar TDR» no aparece y que subir desde el modal ya no apila ventanas.
