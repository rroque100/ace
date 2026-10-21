# TDR adjunto anclado al 3.4 + anexo en el .docx — Implementation Plan

> **For agentic workers:** los pasos usan casillas (`- [ ]`). Cada tarea termina en algo probado y
> commiteable por separado. TDD donde el suite lo permite (Node); las tareas de UI/ruta llevan
> verificación manual (typecheck/lint/build) porque la página está tras login.

**Goal:** que el PDF de EETT/TDR (ya subido e indexado en RAG por el módulo existente) quede anclado
a la sección 3.4 y aparezca como lista de anexos en el .docx del requerimiento, justo antes del 3.5.1.

**Architecture:** se REUTILIZA el módulo EETT/TDR (subida/RAG/registro sin cambios). Se extraen sus
marcadores de documento a una lib compartida, la ruta del .docx consulta esos adjuntos y el
constructor añade un bloque «Anexos» al cerrar el 3.4. La UI se ancla con un retítulo + nota.

**Tech Stack:** Next.js 16 / TypeScript, `docx`, Vitest (`environment: "node"`), Supabase PostgREST.

## Global Constraints

- Código, comentarios y commits en **español**; asunto del commit = síntoma del usuario, minúscula,
  **sin acentos** (Conventional Commits con scope).
- Comentarios explican el **porqué**, no el qué.
- El suite **no renderiza React** (`tests/**/*.test.ts`, solo `.ts`): UI y rutas se verifican con
  `tsc`/`eslint`/`build`, no con test automático.
- Verificación por tarea: `npx tsc --noEmit`, `npx eslint app lib`, `npx vitest run`.
- El PDF **no se incrusta** en el Word: solo se referencia por nombre.
- Detección del 3.4 por presencia del campo `descripcionDetallada`, no por el título.

## File Structure

- `lib/eett-tdr-documento.ts` — **crear**. Marcadores del documento EETT/TDR (`DOC_TYPE_EETT`,
  `KIND_EETT`) y el fragmento de consulta `filtroEettTdr(necesidadId)`.
- `app/api/necesidades/[id]/eett-tdr/route.ts` — **modificar**. Importa la lib nueva en vez de sus
  constantes locales.
- `lib/requerimiento-docx.ts` — **modificar**. `anexosTdr?: string[]` en el input, `lineasAnexoTdr`
  (puro) + `bloqueAnexosTdr` (Paragraphs), e inyección tras el 3.4.
- `app/api/necesidades/[id]/requerimiento-docx/route.ts` — **modificar**. Consulta los adjuntos y los
  pasa como `anexosTdr`.
- `app/components/necesidad-detail.tsx` — **modificar**. Retítulo del panel `sec-eett` + nota-puente.
- `tests/requerimiento-anexos-tdr.test.ts` — **crear**. Cubre `lineasAnexoTdr` y el orden 3.4 → 3.5.1.

---

### Task 1: Marcadores EETT/TDR compartidos

**Files:**
- Create: `lib/eett-tdr-documento.ts`
- Modify: `app/api/necesidades/[id]/eett-tdr/route.ts` (constantes locales `KIND`/`DOC_TYPE`/`marca`)

**Interfaces:**
- Produces: `DOC_TYPE_EETT: "bases_integradas"`, `KIND_EETT: "eett_tdr"`,
  `filtroEettTdr(necesidadId: string): string` (fragmento PostgREST).

- [ ] **Step 1: Crear la lib** — `lib/eett-tdr-documento.ts`

```ts
// Marcadores del documento EETT/TDR de una necesidad en la tabla `documents`.
// FUENTE ÚNICA: los usa la ruta del módulo EETT/TDR (listar/subir/borrar) y la
// ruta del requerimiento .docx (listar los adjuntos para el anexo). Copiados a
// mano en dos sitios, una consulta y la otra dejarían de mirar los mismos docs.

/** Tipo de documento con el que se guarda el EETT/TDR (capaz de RAG). */
export const DOC_TYPE_EETT = "bases_integradas";
/** Discriminador dentro de `metadata` para no tocar el resto del corpus. */
export const KIND_EETT = "eett_tdr";

/** Fragmento PostgREST que selecciona los EETT/TDR de UNA necesidad. */
export function filtroEettTdr(necesidadId: string): string {
  return `document_type=eq.${DOC_TYPE_EETT}&metadata->>kind=eq.${KIND_EETT}&metadata->>necesidadId=eq.${necesidadId}`;
}
```

- [ ] **Step 2: Usar la lib en el route de eett-tdr** — `app/api/necesidades/[id]/eett-tdr/route.ts`.
  Reemplazar las constantes y `marca` locales:

Borrar:
```ts
const KIND = "eett_tdr";
const DOC_TYPE = "bases_integradas";

type EettTdrDoc = DocumentRecord & { metadata?: Record<string, unknown> };

function marca(necesidadId: string) {
  return `document_type=eq.${DOC_TYPE}&metadata->>kind=eq.${KIND}&metadata->>necesidadId=eq.${necesidadId}`;
}
```

Poner (el `type` se conserva; `marca` pasa a delegar en la lib):
```ts
import { DOC_TYPE_EETT, KIND_EETT, filtroEettTdr } from "@/lib/eett-tdr-documento";

type EettTdrDoc = DocumentRecord & { metadata?: Record<string, unknown> };

// Alias locales para no reescribir los ~diez usos de `marca`/`KIND`/`DOC_TYPE`
// repartidos por el fichero.
const KIND = KIND_EETT;
const DOC_TYPE = DOC_TYPE_EETT;
const marca = filtroEettTdr;
```

(El `import` va con el resto de imports de la cabecera; el bloque de constantes se sustituye donde
estaba.)

- [ ] **Step 3: Verificar** — `npx tsc --noEmit && npx eslint app lib`. Expected: sin errores (los
  usos de `KIND`/`DOC_TYPE`/`marca(id)` siguen resolviendo por los alias).

- [ ] **Step 4: Commit**

```bash
git add lib/eett-tdr-documento.ts "app/api/necesidades/[id]/eett-tdr/route.ts"
git commit -m "refactor(necesidades): los marcadores del EETT/TDR salen a una lib compartida"
```

---

### Task 2: Bloque «Anexos» en el constructor del .docx

**Files:**
- Modify: `lib/requerimiento-docx.ts` (`RequerimientoDocInput`, helper nuevo, bucle de secciones)
- Test: `tests/requerimiento-anexos-tdr.test.ts`

**Interfaces:**
- Produces: `lineasAnexoTdr(nombres: string[]): string[]` (exportada, pura),
  `RequerimientoDocInput.anexosTdr?: string[]`.

- [ ] **Step 1: Test que falla** — `tests/requerimiento-anexos-tdr.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { lineasAnexoTdr } from "@/lib/requerimiento-docx";
import { FICHA_SECCIONES } from "@/lib/necesidad-ficha-secciones";

describe("lineasAnexoTdr", () => {
  it("sin adjuntos no produce ninguna línea", () => {
    expect(lineasAnexoTdr([])).toEqual([]);
  });

  it("con adjuntos: encabezado, intro y un nombre por línea", () => {
    expect(lineasAnexoTdr(["TDR_techo.pdf", "EETT_cobertura.pdf"])).toEqual([
      "Anexos",
      "Se adjuntan como anexo los siguientes términos de referencia / especificaciones técnicas:",
      "TDR_techo.pdf",
      "EETT_cobertura.pdf",
    ]);
  });

  it("descarta nombres vacíos", () => {
    expect(lineasAnexoTdr(["", "  ", "TDR.pdf"])).toEqual([
      "Anexos",
      "Se adjuntan como anexo los siguientes términos de referencia / especificaciones técnicas:",
      "TDR.pdf",
    ]);
  });
});

describe("orden de secciones del requerimiento", () => {
  it("el 3.4 (Términos de referencia) precede al 3.5.1 (Requisitos de calificación)", () => {
    const titulos = FICHA_SECCIONES.map((s) => s.title);
    const i34 = titulos.findIndex((t) => t.startsWith("3.4"));
    const i351 = titulos.findIndex((t) => t.startsWith("3.5.1"));
    expect(i34).toBeGreaterThanOrEqual(0);
    expect(i351).toBeGreaterThan(i34);
  });
});
```

- [ ] **Step 2: Correr y ver fallar** — `npx vitest run tests/requerimiento-anexos-tdr.test.ts`
  → FAIL (`lineasAnexoTdr` no existe).

- [ ] **Step 3: Añadir `anexosTdr` al input** — `lib/requerimiento-docx.ts`, en `RequerimientoDocInput`
  (tras `items?: NecesidadItem[];`):

```ts
  /**
   * Nombres de los EETT/TDR adjuntos a la necesidad. Se listan como anexo al
   * cerrar el 3.4; el PDF no se incrusta (es un documento que se firma, el
   * archivo va aparte). Vacío/ausente ⇒ no se añade nada.
   */
  anexosTdr?: string[];
```

- [ ] **Step 4: Añadir los helpers** — `lib/requerimiento-docx.ts`, junto a `tablaItems`
  (function-level, antes de `generarRequerimientoDocx`):

```ts
/**
 * Las líneas del anexo de EETT/TDR: encabezado + intro + un nombre por línea.
 * Pura (sin `docx`) para poder probarla; `bloqueAnexosTdr` la envuelve en párrafos.
 */
export function lineasAnexoTdr(nombres: string[]): string[] {
  const utiles = nombres.map((n) => n.trim()).filter(Boolean);
  if (utiles.length === 0) return [];
  return [
    "Anexos",
    "Se adjuntan como anexo los siguientes términos de referencia / especificaciones técnicas:",
    ...utiles,
  ];
}

/** El bloque de anexos como párrafos del Word (encabezado en negrita + viñetas). */
function bloqueAnexosTdr(nombres: string[]): Paragraph[] {
  const [titulo, intro, ...archivos] = lineasAnexoTdr(nombres);
  if (!titulo) return [];
  return [
    new Paragraph({ spacing: { before: 120, after: 40 }, children: [run(titulo, { bold: true })] }),
    new Paragraph({ spacing: { after: 40 }, children: [run(intro)] }),
    ...archivos.map((nombre) => new Paragraph({ bullet: { level: 0 }, children: [run(nombre)] })),
  ];
}
```

- [ ] **Step 5: Inyectar tras el 3.4** — `lib/requerimiento-docx.ts`, en el bucle de secciones, justo
  DESPUÉS del `for (const c of s.campos) { … }` interno y antes de cerrar el `for (const s of …)`:

```ts
    }
    // Anexos EETT/TDR: al cerrar el 3.4 (la sección del TDR, detectada por su
    // campo `descripcionDetallada`) y antes del 3.5.1, se listan los documentos
    // adjuntos por nombre. Solo si hay.
    if ((input.anexosTdr ?? []).length > 0 && s.campos.some((c) => c.api === "descripcionDetallada")) {
      children.push(...bloqueAnexosTdr(input.anexosTdr ?? []));
    }
  }
```

(El primer `}` es el cierre existente del `for (const c of s.campos)`; el bloque nuevo va entre ese
cierre y el `}` del `for (const s of …)`.)

- [ ] **Step 6: Correr y ver pasar** — `npx vitest run tests/requerimiento-anexos-tdr.test.ts` → PASS.
  Luego `npx tsc --noEmit` → sin errores.

- [ ] **Step 7: Commit**

```bash
git add lib/requerimiento-docx.ts tests/requerimiento-anexos-tdr.test.ts
git commit -m "feat(necesidades): el Word del requerimiento lista los TDR adjuntos como anexo tras el 3.4"
```

---

### Task 3: La ruta del .docx pasa los adjuntos

**Files:**
- Modify: `app/api/necesidades/[id]/requerimiento-docx/route.ts`

**Interfaces:**
- Consumes: de Task 1 `filtroEettTdr`; de Task 2 `RequerimientoDocInput.anexosTdr`.

- [ ] **Step 1: Import** — junto a los demás imports de la ruta:

```ts
import { filtroEettTdr } from "@/lib/eett-tdr-documento";
```

- [ ] **Step 2: Consultar los adjuntos** — tras leer `itemRows` (antes de `apartados`), añadir:

```ts
    // EETT/TDR adjuntos a la necesidad, para listarlos como anexo en el 3.4. Con
    // service-role (como el resto del módulo EETT/TDR); la visibilidad ya la
    // garantizó la lectura de la necesidad con el token del usuario, arriba.
    const anexoRows = await supabaseRest<Array<{ file_name: string | null; title: string | null }>>(
      `documents?${filtroEettTdr(id)}&select=file_name,title&order=created_at.asc`,
    ).catch((err) => {
      console.error("[requerimiento-docx] no se pudieron leer los EETT/TDR adjuntos:", err);
      return [];
    });
    const anexosTdr = anexoRows.map((r) => str(r.file_name) || str(r.title)).filter(Boolean);
```

- [ ] **Step 3: Pasarlos al constructor** — en la llamada `generarRequerimientoDocx({ … })`, añadir el
  campo (p. ej. junto a `items`):

```ts
      anexosTdr,
```

- [ ] **Step 4: Verificar** — `npx tsc --noEmit && npx eslint app lib && npx vitest run`. Expected:
  sin errores; el suite sigue en verde. Opcional: descargar el «Requerimiento (Word)» de una necesidad
  con un TDR adjunto y comprobar que el bloque «Anexos» sale al final del 3.4.

- [ ] **Step 5: Commit**

```bash
git add "app/api/necesidades/[id]/requerimiento-docx/route.ts"
git commit -m "feat(necesidades): el requerimiento en Word incluye los TDR adjuntos de la necesidad"
```

---

### Task 4: Anclaje ligero del panel al 3.4 (UI)

**Files:**
- Modify: `app/components/necesidad-detail.tsx` (encabezado del panel `sec-eett` + nota-puente)

- [ ] **Step 1: Retitular el panel `sec-eett`** — localizar su encabezado
  (`grep -n "sec-eett" app/components/necesidad-detail.tsx` y el `<h3 className="panelTitle">` con
  «Especificaciones Técnicas (EETT) / Términos de Referencia (TDR)»). Anteponer «3.4 · » al título:

```tsx
<h3 className="panelTitle">3.4 · Especificaciones Técnicas (EETT) / Términos de Referencia (TDR) — documento adjunto</h3>
```

- [ ] **Step 2: Nota-puente en el 3.4** — en el `nota` de la sección «3.4 Términos de referencia»
  ([lib/necesidad-ficha-secciones.ts](../../../lib/necesidad-ficha-secciones.ts) ~línea 517), añadir al
  final del texto de la nota:

```
 El PDF del TDR/EETT se adjunta en el panel de EETT/TDR de esta misma ficha: se indexa para consulta y se lista como anexo en el requerimiento en Word.
```

(Es texto de la nota de sección, sin lógica; conserva el resto de la nota intacto.)

- [ ] **Step 3: Verificar** — `npx tsc --noEmit && npx eslint app lib`. Verificación visual (si hay
  dev server): el panel de subida se titula «3.4 · …» y la nota del 3.4 apunta a él.

- [ ] **Step 4: Commit**

```bash
git add app/components/necesidad-detail.tsx lib/necesidad-ficha-secciones.ts
git commit -m "feat(necesidades): el panel de EETT/TDR queda anclado a la seccion 3.4"
```

---

## Self-Review

- **Cobertura del spec:** §A (sin cambios) — nada que hacer; §B (anclaje UI) → Task 4; §C (anexo docx)
  → Tasks 2 (constructor) + 3 (ruta); §D (marcadores compartidos) → Task 1. Sin huecos.
- **Placeholders:** ninguno; todo el código está escrito.
- **Consistencia de tipos:** `filtroEettTdr(id): string` (Task 1) se usa en Task 3; `anexosTdr?: string[]`
  y `lineasAnexoTdr(nombres): string[]` (Task 2) se usan en Task 3 y el test. Nombres idénticos en las
  tres tareas.

## Riesgos / a confirmar al ejecutar

- **Alias en Task 1:** si `eslint` marca los alias `const marca = filtroEettTdr` como innecesarios,
  sustituir los usos directamente por `filtroEettTdr`/`KIND_EETT`/`DOC_TYPE_EETT` (no cambia el
  comportamiento).
- **Ubicación de `bloqueAnexosTdr`:** debe declararse donde ya están en scope `Paragraph`, `run` y el
  helper de viñetas (`bullet: { level: 0 }` ya se usa en el fichero), es decir, dentro de
  `lib/requerimiento-docx.ts`.
- **`str` en Task 3** ya existe en la ruta (helper de la cabecera): reutilizarlo, no redefinirlo.
