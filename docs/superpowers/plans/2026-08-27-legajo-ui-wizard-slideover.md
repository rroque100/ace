# Legajo multidocumento (Fase 2: selector en el wizard + slide-over multi-documento) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que el wizard de Subir permita elegir entre abrir un **expediente nuevo**
(comportamiento de siempre) o **adjuntar el PDF a uno ya existente** (folio nuevo
dentro del mismo legajo), y que el slide-over de detalle muestre los demás
documentos del expediente al que pertenece el que estás viendo, con acceso
directo a cada uno.

**Architecture:** un componente nuevo `LegajoPicker` (búsqueda con debounce sobre
`GET /api/expedientes-archivo/legajos`, ya construido en la Fase 1) que decide el
`expedienteId` opcional que ya acepta `POST /api/expedientes-archivo` (Fase 1);
el slide-over gana una sección que consulta `GET /api/expedientes-archivo/legajos/[id]`
(también de la Fase 1) y reusa `openExpedienteById` (ya existente en el
workspace) para saltar entre documentos del mismo legajo sin cerrar el panel.

**Tech Stack:** Next.js 16 (App Router) + React 19 + TypeScript estricto, Tailwind
(tokens `--exp-*` y constantes de `app/components/expedientes-archivo/estilos.ts`).

## Global Constraints

- Código, comentarios y commits en **español**; asunto del commit = lo que gana
  el usuario, en minúscula (Conventional Commits con scope).
- Comentarios explican el **porqué**, no el qué.
- **Prerrequisito**: la Fase 1 (`docs/superpowers/plans/2026-08-27-expediente-legajo-multidocumento.md`)
  ya está implementada y la migración SQL ya está aplicada en producción
  (confirmado — la tabla `expedientes_archivo_legajos` y las columnas
  `expediente_id`/`numero_folio` existen y tienen datos).
- **No repetir el error de esta misma sesión**: nunca combines, en un mismo
  `cn(...)`, una clase base que declara sin condición un valor para una
  propiedad CSS (ej. `px-3` de `EXP_FIELD_CONTROL`) con otra clase que
  intenta pisar esa MISMA propiedad (ej. `pl-8`) — Tailwind v4 genera las
  utilidades en el orden en que las descubre al escanear, no en un orden fijo,
  así que la que gane la cascada es impredecible. Por eso el buscador del
  `LegajoPicker` (Task 1) pone el ícono como hermano del `<input>` en un
  `flex`, nunca superpuesto con padding.
- No se cambia el contrato del `POST` de subida (ya acepta `expedienteId`
  opcional desde la Fase 1) ni el modelo de datos — esta fase es 100% UI.
- No se ocultan ni bloquean los campos de identificación del paso 1 cuando se
  elige un expediente existente: se siguen llenando y guardando también en el
  documento (duplicación ya aceptada y documentada en la Fase 1). Simplifica
  esta fase: ningún campo cambia de comportamiento, solo se añade el selector.
- Verificación por tarea: `npx tsc --noEmit`, `npx eslint app lib`. No hay
  test dedicado para componentes React en este repo (sin Testing Library,
  per SDD del módulo) — se verifica con tsc/eslint/build, como el resto de la
  UI de `/expedientes-archivo`.

## File Structure

- `app/components/expedientes-archivo/legajo-picker.tsx` — **crear**. Selector "nuevo/existente" + búsqueda.
- `app/components/expedientes-archivo/subir-tab-content.tsx` — **modificar**. Monta `LegajoPicker` en el paso 1 del wizard.
- `app/components/expedientes-archivo-workspace.tsx` — **modificar**. Estado `selectedLegajo`, lo manda en el `POST`, lo resetea, y cablea las dos props nuevas del slide-over.
- `app/components/expedientes-archivo/types.ts` — **modificar**. Tipos `LegajoDocumentoResumen`/`LegajoDetalle`.
- `lib/expedientes-archivo-actions.ts` — **modificar**. Acción `fetchLegajoDetalle`.
- `app/components/expedientes-archivo/slide-over-detalle.tsx` — **modificar**. Sección "Otros documentos de este expediente".

---

### Task 1: Componente `LegajoPicker`

**Files:**
- Create: `app/components/expedientes-archivo/legajo-picker.tsx`

**Interfaces:**
- Consumes: `searchLegajos` (`lib/expedientes-archivo-actions.ts`, ya existe —
  Fase 1); `ExpedienteLegajoItem` (`./types`, ya existe — Fase 1).
- Produces: `LegajoPicker({ selected: ExpedienteLegajoItem | null, onSelect: (l: ExpedienteLegajoItem | null) => void })`.

- [ ] **Step 1: Crear el fichero**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Folder, Loader2, Search, X } from "lucide-react";
import { searchLegajos } from "@/lib/expedientes-archivo-actions";
import type { ExpedienteLegajoItem } from "./types";
import {
  EXP_FIELD,
  EXP_FIELD_CONTROL,
  EXP_FIELD_LABEL,
  EXP_HELP_TEXT,
  EXP_LIST,
  EXP_LIST_ITEM,
  EXP_LIST_ITEM_ACTIONS,
  EXP_LIST_ITEM_BODY,
  EXP_LIST_ITEM_ICON,
  EXP_LIST_ITEM_META,
  EXP_LIST_ITEM_TITLE,
  EXP_SPIN,
  expBtnClass,
} from "./estilos";
import { cn } from "@/lib/utils";

function etiquetaLegajo(l: ExpedienteLegajoItem): string {
  return l.serie_documento || l.sgd_expediente || l.asunto || "Expediente sin identificar";
}

/**
 * Elige si el PDF que se está subiendo abre un expediente NUEVO (de siempre)
 * o se ADJUNTA a uno YA EXISTENTE (folio nuevo dentro del mismo legajo). No
 * cambia nada más del wizard: los campos de identificación del paso 1 se
 * siguen llenando igual y se guardan en el documento aunque se adjunte a un
 * expediente existente (ver Global Constraints del plan de esta fase).
 */
export function LegajoPicker({
  selected,
  onSelect,
}: {
  selected: ExpedienteLegajoItem | null;
  onSelect: (legajo: ExpedienteLegajoItem | null) => void;
}) {
  const [modo, setModo] = useState<"nuevo" | "existente">(selected ? "existente" : "nuevo");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ExpedienteLegajoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Debounce 250ms, igual que el resto de buscadores del módulo
  // (ver BibliotecaSelector en respuesta/biblioteca-selector.tsx).
  useEffect(() => {
    if (modo !== "existente" || selected) return;
    setLoading(true);
    const timeout = setTimeout(() => {
      void searchLegajos(query, 8)
        .then((data) => setResults(data.legajos))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timeout);
  }, [modo, query, selected]);

  useEffect(() => {
    if (modo === "existente" && !selected) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [modo, selected]);

  return (
    <div className={EXP_FIELD}>
      <label className={EXP_FIELD_LABEL}>¿A qué expediente pertenece?</label>
      <div className="flex gap-2">
        <button
          type="button"
          className={expBtnClass(modo === "nuevo" ? "primary" : "ghost", "small")}
          onClick={() => {
            setModo("nuevo");
            onSelect(null);
          }}
        >
          Expediente nuevo
        </button>
        <button
          type="button"
          className={expBtnClass(modo === "existente" ? "primary" : "ghost", "small")}
          onClick={() => setModo("existente")}
        >
          Añadir a uno existente
        </button>
      </div>

      {modo === "existente" ? (
        selected ? (
          <div className={cn(EXP_LIST_ITEM, "mt-2")}>
            <div className={EXP_LIST_ITEM_ICON}>
              <Folder size={16} />
            </div>
            <div className={EXP_LIST_ITEM_BODY}>
              <p className={EXP_LIST_ITEM_TITLE}>{etiquetaLegajo(selected)}</p>
              <div className={EXP_LIST_ITEM_META}>
                {selected.anio ? <span>{selected.anio}</span> : null}
                {selected.oficina ? <span>· {selected.oficina}</span> : null}
                <span>
                  · {selected.documentos_count} documento{selected.documentos_count === 1 ? "" : "s"}
                </span>
              </div>
            </div>
            <div className={EXP_LIST_ITEM_ACTIONS}>
              <button
                type="button"
                className={expBtnClass("ghost", "small")}
                onClick={() => onSelect(null)}
                aria-label="Quitar expediente seleccionado"
              >
                <X size={13} /> Quitar
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-2 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Search size={14} className="shrink-0 text-exp-muted" aria-hidden="true" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por SGD, serie o asunto…"
                className={EXP_FIELD_CONTROL}
              />
            </div>
            {loading ? (
              <span className={EXP_HELP_TEXT}>
                <Loader2 size={12} className={EXP_SPIN} /> Buscando expedientes…
              </span>
            ) : results.length === 0 ? (
              <span className={EXP_HELP_TEXT}>
                {query.trim().length > 0 && query.trim().length < 2
                  ? "Escribe al menos 2 caracteres"
                  : "Sin expedientes que coincidan"}
              </span>
            ) : (
              <ul className={cn(EXP_LIST, "list-none p-0")}>
                {results.map((legajo) => (
                  <li key={legajo.id}>
                    <button
                      type="button"
                      className={cn(EXP_LIST_ITEM, "w-full text-left")}
                      onClick={() => onSelect(legajo)}
                    >
                      <div className={EXP_LIST_ITEM_ICON}>
                        <Folder size={16} />
                      </div>
                      <div className={EXP_LIST_ITEM_BODY}>
                        <p className={EXP_LIST_ITEM_TITLE}>{etiquetaLegajo(legajo)}</p>
                        <div className={EXP_LIST_ITEM_META}>
                          {legajo.anio ? <span>{legajo.anio}</span> : null}
                          {legajo.oficina ? <span>· {legajo.oficina}</span> : null}
                          <span>
                            · {legajo.documentos_count} documento{legajo.documentos_count === 1 ? "" : "s"}
                          </span>
                        </div>
                      </div>
                      <div className={EXP_LIST_ITEM_ACTIONS}>
                        <Check size={14} className="text-exp-muted" />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      ) : (
        <span className={EXP_HELP_TEXT}>
          Se creará un expediente nuevo con los datos de este documento.
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar** — `npx tsc --noEmit && npx eslint app/components/expedientes-archivo/legajo-picker.tsx`.
  Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add app/components/expedientes-archivo/legajo-picker.tsx
git commit -m "feat(expedientes-archivo): selector para elegir expediente nuevo o existente al subir"
```

---

### Task 2: Montar `LegajoPicker` en el wizard de Subir

**Files:**
- Modify: `app/components/expedientes-archivo/subir-tab-content.tsx`

**Interfaces:**
- Consumes: de Task 1, `LegajoPicker`; de Fase 1, `ExpedienteLegajoItem`.
- Produces: `SubirTabContentProps` gana `selectedLegajo: ExpedienteLegajoItem | null` y `setSelectedLegajo: (l: ExpedienteLegajoItem | null) => void`.

- [ ] **Step 1: Import del tipo.** En el import de tipos desde `./types` (línea 45-52), añadir `ExpedienteLegajoItem`:

```ts
import type {
  DuplicateMatch,
  ExpedienteItem,
  ExpedienteLegajoItem,
  PdfInventory,
  SubirForm,
  WizardStep,
  WorkspaceTab,
} from "./types";
```

- [ ] **Step 2: Import del componente.** Junto al import de `BatchUpload` (línea 55):

```ts
import { BatchUpload } from "./batch-upload";
import { LegajoPicker } from "./legajo-picker";
```

- [ ] **Step 3: Prop en el tipo.** En `SubirTabContentProps`, dentro del bloque `// Wizard` (junto a `wizardStep`/`setWizardStep`/`canProceedStep`, línea 116-119):

```ts
  // Wizard
  wizardStep: WizardStep;
  setWizardStep: React.Dispatch<React.SetStateAction<WizardStep>>;
  canProceedStep: () => { ok: boolean; reason?: string };
  // Expediente (legajo) elegido para adjuntar el documento, o null para crear
  // uno nuevo (Fase 2 del legajo multidocumento).
  selectedLegajo: ExpedienteLegajoItem | null;
  setSelectedLegajo: (l: ExpedienteLegajoItem | null) => void;
```

- [ ] **Step 4: Desestructurar la prop.** En la firma de `SubirTabContent(...)`, junto a `wizardStep, setWizardStep, canProceedStep,` (línea 271-273):

```ts
  wizardStep,
  setWizardStep,
  canProceedStep,
  selectedLegajo,
  setSelectedLegajo,
```

- [ ] **Step 5: Montar el picker al inicio del paso 0.** Justo después de `{wizardStep === 0 ? (` y `<>` (línea 424-425), **antes** del `<div className={EXP_FORM_SECTION}>` de "1. Carga el PDF":

```tsx
        {wizardStep === 0 ? (
          <>
            <div className={EXP_FORM_SECTION}>
              <LegajoPicker selected={selectedLegajo} onSelect={setSelectedLegajo} />
            </div>
            <div className={EXP_FORM_SECTION}>
              <div className={EXP_FORM_SECTION_HEADER}>
                <h3 className={EXP_FORM_SECTION_TITLE}>
                  <FileUp size={16} /> 1. Carga el PDF
```

  (El resto del bloque de "1. Carga el PDF" sigue exactamente igual — solo se
  inserta el `<div>` del picker antes.)

- [ ] **Step 6: Resetear la selección al cancelar.** Dentro del `onConfirm` del
  diálogo de "¿Cancelar subida?" (línea 1240-1250), junto a `setDupsDismissed(false);`:

```tsx
                  onConfirm: () => {
                    setForm(baseForm);
                    setFile(null);
                    setExtractedData(null);
                    setAutoFilledFields(new Set());
                    setDuplicates([]);
                    setDupsDismissed(false);
                    setSelectedLegajo(null);
                    lastDupSignatureRef.current = "";
                    setWizardStep(0);
                    showToast("Subida cancelada", "info");
                  },
```

- [ ] **Step 7: Verificar** — `npx tsc --noEmit && npx eslint app/components/expedientes-archivo/subir-tab-content.tsx`.
  Expected: errores de tipo esperados hasta la Task 3 (el workspace todavía no
  pasa `selectedLegajo`/`setSelectedLegajo` como props) — es normal, se
  resuelve en la siguiente tarea. Confirmar que el ÚNICO error que queda es
  "falta la prop selectedLegajo/setSelectedLegajo" en el call site de
  `expedientes-archivo-workspace.tsx`, no otro.

- [ ] **Step 8: Commit**

```bash
git add app/components/expedientes-archivo/subir-tab-content.tsx
git commit -m "feat(expedientes-archivo): el wizard de subir muestra el selector de expediente"
```

---

### Task 3: Estado del legajo elegido en el workspace

**Files:**
- Modify: `app/components/expedientes-archivo-workspace.tsx`

**Interfaces:**
- Consumes: de Fase 1, `ExpedienteLegajoItem`; de Task 2, las props nuevas de `SubirTabContent`.
- Produces: estado `selectedLegajo`/`setSelectedLegajo`; el `POST` de subida manda `expedienteId` cuando corresponde.

- [ ] **Step 1: Import del tipo.** Busca el import de tipos desde
  `./expedientes-archivo/types` (trae `ExpedienteItem`, `SubirForm`, etc. — es
  el mismo import que ya usa varios de esos nombres) y añade
  `ExpedienteLegajoItem` a la lista.

- [ ] **Step 2: Estado nuevo.** Junto a `const [uploadMode, setUploadMode] = useState<"single" | "batch">("single");` (línea 355):

```ts
  const [uploadMode, setUploadMode] = useState<"single" | "batch">("single");
  // Expediente (legajo) elegido para adjuntar el documento, o null para crear
  // uno nuevo. Ver docs/superpowers/plans/2026-08-27-legajo-ui-wizard-slideover.md.
  const [selectedLegajo, setSelectedLegajo] = useState<ExpedienteLegajoItem | null>(null);
```

- [ ] **Step 3: Mandar `expedienteId` en la subida.** Dentro de `async function uploadExpediente(...)`, justo después de `formData.append("file", file);`:

```ts
    const formData = new FormData();
    formData.append("file", file);
    if (selectedLegajo) {
      formData.append("expedienteId", selectedLegajo.id);
    }
    for (const [key, value] of Object.entries(form)) {
```

- [ ] **Step 4: Resetear tras subir con éxito.** Junto a `setDuplicates([]); setDupsDismissed(false);` dentro del bloque de éxito de `uploadExpediente` (después de `if (!result.ok) {...}`, donde ya se resetea `setFile(null); setForm(baseForm); ...`):

```ts
      setFile(null);
      setForm(baseForm);
      setAutoFilledFields(new Set());
      setDuplicates([]);
      setDupsDismissed(false);
      setSelectedLegajo(null);
      lastDupSignatureRef.current = "";
```

- [ ] **Step 5: Pasar las props al `<SubirTabContent .../>`.** Junto a
  `wizardStep={wizardStep}` `setWizardStep={setWizardStep}` `canProceedStep={canProceedStep}` en el call site:

```tsx
          wizardStep={wizardStep}
          setWizardStep={setWizardStep}
          canProceedStep={canProceedStep}
          selectedLegajo={selectedLegajo}
          setSelectedLegajo={setSelectedLegajo}
```

- [ ] **Step 6: Verificar** — `npx tsc --noEmit && npx eslint app/components/expedientes-archivo-workspace.tsx`.
  Expected: sin errores (el de la Task 2 queda resuelto).

- [ ] **Step 7: Commit**

```bash
git add app/components/expedientes-archivo-workspace.tsx
git commit -m "feat(expedientes-archivo): la subida manda el expedienteId elegido al backend"
```

---

### Task 4: Tipos y acción cliente para el detalle del legajo

**Files:**
- Modify: `app/components/expedientes-archivo/types.ts`
- Modify: `lib/expedientes-archivo-actions.ts`

**Interfaces:**
- Produces: `LegajoDocumentoResumen`, `LegajoDetalle` (`./types`);
  `fetchLegajoDetalle(id: string): Promise<LegajoDetalle | null>`.

- [ ] **Step 1: `types.ts` — tipos nuevos.** Después del cierre de
  `ExpedienteLegajoItem` (antes de `/** Resultado de autocompletar PDF... */`):

```ts
/** Un documento (folio) dentro de un legajo — resumen para el slide-over. */
export type LegajoDocumentoResumen = {
  id: string;
  numero_folio: number | null;
  tipo_documento: string | null;
  title: string;
  anio: number | null;
  status: "uploaded" | "processing" | "indexed" | "error";
  error_message: string | null;
  file_name: string;
  file_size: number;
  created_at: string;
};

/** Detalle de un legajo + sus documentos, tal como lo devuelve
 *  GET /api/expedientes-archivo/legajos/[id]. */
export type LegajoDetalle = {
  legajo: ExpedienteLegajoItem;
  documentos: LegajoDocumentoResumen[];
};
```

- [ ] **Step 2: `expedientes-archivo-actions.ts` — import del tipo.** En el
  import de tipos (línea 17, ya extendido en la Fase 1 con `ExpedienteLegajoItem`):

```ts
import type { ChatAnswer, DuplicateMatch, ExpedienteLegajoItem, LegajoDetalle, PdfInventory, SearchResult } from "@/app/components/expedientes-archivo/types";
```

- [ ] **Step 3: Función `fetchLegajoDetalle`.** Después de `searchLegajos`
  (Fase 1), antes de `/** Llama al endpoint /extract... */`:

```ts
/** Trae un legajo y sus documentos (folios), para la sección "Otros
 *  documentos de este expediente" del slide-over. */
export async function fetchLegajoDetalle(id: string): Promise<LegajoDetalle | null> {
  try {
    const res = await fetch(`/api/expedientes-archivo/legajos/${id}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => ({}))) as Partial<LegajoDetalle>;
    if (!data.legajo) return null;
    return { legajo: data.legajo, documentos: data.documentos ?? [] };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Verificar** — `npx tsc --noEmit && npx eslint app/components/expedientes-archivo/types.ts lib/expedientes-archivo-actions.ts`.
  Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add app/components/expedientes-archivo/types.ts lib/expedientes-archivo-actions.ts
git commit -m "feat(expedientes-archivo): tipos y accion cliente para el detalle de un legajo"
```

---

### Task 5: Sección "Otros documentos de este expediente" en el slide-over

**Files:**
- Modify: `app/components/expedientes-archivo/slide-over-detalle.tsx`

**Interfaces:**
- Consumes: de Task 4, `fetchLegajoDetalle`, `LegajoDetalle`.
- Produces: `SlideOverDetalleProps` gana `onOpenDocumentoId: (id: string) => void` y `statusLabel: (s: LegajoDocumentoResumen["status"]) => string`.

- [ ] **Step 1: Imports.** Ampliar el import de `react` y de iconos (línea 1-3):

```tsx
"use client";

import { useEffect, useState } from "react";
import { Download, FileText, Loader2, Pencil, RefreshCw, Save, Sparkles } from "lucide-react";
```

  Añadir el import de la acción y el tipo (después del import de `ARCHIVO_COLORES...`, línea 4):

```tsx
import { fetchLegajoDetalle } from "@/lib/expedientes-archivo-actions";
```

  Ampliar el import de tipos (línea 6):

```tsx
import type { ExpedienteItem, LegajoDetalle, LegajoDocumentoResumen } from "./types";
```

  Ampliar el import de `./estilos` (línea 7-17) con las clases de lista y de status:

```tsx
import {
  EXP_FIELD,
  EXP_FIELD_CONTROL,
  EXP_FIELD_LABEL,
  EXP_FIELD_TEXTAREA,
  EXP_HELP_TEXT,
  EXP_LIST,
  EXP_LIST_ITEM,
  EXP_LIST_ITEM_BODY,
  EXP_LIST_ITEM_ICON,
  EXP_LIST_ITEM_META,
  EXP_LIST_ITEM_TITLE,
  EXP_SLIDE_OVER_BODY,
  EXP_SLIDE_OVER_FOOTER,
  EXP_SPIN,
  expBtnClass,
  expStatusClass,
} from "./estilos";
```

- [ ] **Step 2: Props nuevas.** En `SlideOverDetalleProps` (línea 20-34), junto a `onReplace`:

```ts
export type SlideOverDetalleProps = {
  openExp: ExpedienteItem;
  editMode: boolean;
  editForm: Record<string, unknown>;
  savingEdit: boolean;
  isAdmin: boolean;
  canManage: boolean;
  formatBytes: (n: number) => string;
  onClose: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSetEditField: (key: string, value: unknown) => void;
  onSaveEdits: () => void;
  onReplace: (exp: ExpedienteItem) => void;
  // Abre OTRO documento del mismo expediente sin cerrar el slide-over (Fase 2
  // del legajo multidocumento).
  onOpenDocumentoId: (id: string) => void;
  statusLabel: (s: LegajoDocumentoResumen["status"]) => string;
};
```

- [ ] **Step 3: Desestructurar y cargar el legajo.** En la firma del
  componente (línea 36-50), añadir las dos props nuevas, y justo antes del
  `return (` insertar el `useEffect` que carga el detalle del legajo:

```tsx
export function ExpedienteSlideOver({
  openExp,
  editMode,
  editForm,
  savingEdit,
  isAdmin,
  canManage,
  formatBytes,
  onClose,
  onStartEdit,
  onCancelEdit,
  onSetEditField,
  onSaveEdits,
  onReplace,
  onOpenDocumentoId,
  statusLabel,
}: SlideOverDetalleProps) {
  // Otros documentos del mismo legajo: se recarga cada vez que se abre un
  // expediente distinto (openExp.id cambia también al saltar entre folios).
  const [legajoDetalle, setLegajoDetalle] = useState<LegajoDetalle | null>(null);
  const [loadingLegajo, setLoadingLegajo] = useState(false);

  useEffect(() => {
    if (!openExp.expediente_id) {
      setLegajoDetalle(null);
      return;
    }
    let cancelled = false;
    setLoadingLegajo(true);
    void fetchLegajoDetalle(openExp.expediente_id)
      .then((data) => {
        if (!cancelled) setLegajoDetalle(data);
      })
      .finally(() => {
        if (!cancelled) setLoadingLegajo(false);
      });
    return () => {
      cancelled = true;
    };
  }, [openExp.expediente_id, openExp.id]);

  const otrosDocumentos = (legajoDetalle?.documentos ?? []).filter((d) => d.id !== openExp.id);

  // Escape, foco atrapado y bloqueo de scroll los aporta ExpSlideOver (Radix).
  return (
```

- [ ] **Step 4: Render de la sección.** Justo después del bloque
  `{openExp.metadata?.tokenUsage ? (...) : null}` (línea 69-88) y **antes** de
  `{editMode ? (...) : (...)}` (línea 89):

```tsx
          {otrosDocumentos.length > 0 || loadingLegajo ? (
            <div className="mt-4">
              <label className={EXP_FIELD_LABEL}>
                Otros documentos de este expediente
                {legajoDetalle ? ` (${legajoDetalle.documentos.length})` : ""}
              </label>
              {loadingLegajo ? (
                <span className={cn(EXP_HELP_TEXT, "mt-1")}>
                  <Loader2 size={12} className={EXP_SPIN} /> Cargando…
                </span>
              ) : (
                <ul className={cn(EXP_LIST, "mt-1.5 list-none p-0")}>
                  {otrosDocumentos.map((doc) => (
                    <li key={doc.id}>
                      <button
                        type="button"
                        className={cn(EXP_LIST_ITEM, "w-full text-left")}
                        onClick={() => onOpenDocumentoId(doc.id)}
                      >
                        <div className={EXP_LIST_ITEM_ICON}>
                          <FileText size={16} />
                        </div>
                        <div className={EXP_LIST_ITEM_BODY}>
                          <p className={EXP_LIST_ITEM_TITLE}>
                            {doc.numero_folio ? `Folio ${doc.numero_folio} · ` : ""}
                            {doc.title}
                          </p>
                          <div className={EXP_LIST_ITEM_META}>
                            {doc.tipo_documento ? <span>{doc.tipo_documento}</span> : null}
                            {doc.anio ? <span>· {doc.anio}</span> : null}
                            <span className={expStatusClass(doc.status)}>{statusLabel(doc.status)}</span>
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
```

- [ ] **Step 5: Verificar** — `npx tsc --noEmit && npx eslint app/components/expedientes-archivo/slide-over-detalle.tsx`.
  Expected: errores de tipo esperados hasta la Task 6 (el workspace todavía no
  pasa `onOpenDocumentoId`/`statusLabel` al `<ExpedienteSlideOver .../>`) — se
  resuelve en la siguiente tarea.

- [ ] **Step 6: Commit**

```bash
git add app/components/expedientes-archivo/slide-over-detalle.tsx
git commit -m "feat(expedientes-archivo): el slide-over lista los otros documentos del mismo expediente"
```

---

### Task 6: Cablear las props nuevas del slide-over en el workspace

**Files:**
- Modify: `app/components/expedientes-archivo-workspace.tsx`

**Interfaces:**
- Consumes: de Task 5, `SlideOverDetalleProps.onOpenDocumentoId`/`statusLabel`;
  del workspace, ya existentes, `openExpedienteById`, `statusLabel`.

- [ ] **Step 1: Pasar las dos props nuevas.** En el call site de
  `<ExpedienteSlideOver .../>` (junto a `onReplace={setReplaceExp}`):

```tsx
      {openExp ? (
        <ExpedienteSlideOver
          openExp={openExp}
          editMode={editMode}
          editForm={editForm}
          savingEdit={savingEdit}
          isAdmin={isAdmin}
          canManage={canManage}
          formatBytes={formatBytes}
          onClose={closeSlideOver}
          onStartEdit={startEdit}
          onCancelEdit={() => setEditMode(false)}
          onSetEditField={setEditField}
          onSaveEdits={saveExpedienteEdits}
          onReplace={setReplaceExp}
          onOpenDocumentoId={openExpedienteById}
          statusLabel={statusLabel}
        />
```

  (`openExpedienteById` y `statusLabel` ya existen en este fichero — los usa
  la pestaña Buscar para abrir resultados y etiquetar el status; se reusan
  tal cual, sin cambiarlos.)

- [ ] **Step 2: Verificar** — `npx tsc --noEmit && npx eslint app/components/expedientes-archivo-workspace.tsx`.
  Expected: sin errores (los de la Task 5 quedan resueltos). Confirmar
  además `npx vitest run tests/expedientes-archivo.test.ts` — deben seguir
  pasando los 13 tests (esta fase no toca lógica de dominio, solo UI).

- [ ] **Step 3: Commit**

```bash
git add app/components/expedientes-archivo-workspace.tsx
git commit -m "feat(expedientes-archivo): saltar entre documentos de un mismo expediente desde el slide-over"
```

---

## Self-Review

- **Cobertura del spec:** selector nuevo/existente en el wizard → Tasks 1-3.
  Slide-over multi-documento → Tasks 4-6. Ambas piezas de "Fuera de alcance
  de este plan" de la Fase 1 quedan cubiertas.
- **Placeholders:** ninguno; cada paso de código tiene el contenido completo.
- **Consistencia de tipos:** `ExpedienteLegajoItem` (Fase 1) lo consumen
  `LegajoPicker` (Task 1), `SubirTabContent` (Task 2) y el workspace (Task 3)
  con el mismo shape. `LegajoDetalle`/`LegajoDocumentoResumen` (Task 4) los
  consumen `fetchLegajoDetalle` (misma tarea) y `slide-over-detalle.tsx`
  (Task 5) sin discrepancias. `onOpenDocumentoId`/`statusLabel` (Task 5,
  definidos en `SlideOverDetalleProps`) coinciden exactamente con
  `openExpedienteById`/`statusLabel` ya existentes en el workspace (Task 6).
- **Lección de la sesión aplicada:** ningún `cn(...)` de este plan combina una
  clase base con padding/color incondicional junto a otra que intente pisar
  la MISMA propiedad — el buscador del picker usa ícono+input como hermanos
  en un `flex`, no ícono superpuesto con padding en el input.

## Riesgos / a confirmar al ejecutar

- **Orden Task 2 antes de Task 3**: la Task 2 deja `subir-tab-content.tsx`
  con un error de tipos esperado (le faltan las props que la Task 3 añade en
  el workspace) — es intencional y transitorio, está anotado en el Step 7 de
  la Task 2. No lo "arregles" quitando las props del componente: espera a la
  Task 3.
- **Mismo patrón en Task 5 antes de Task 6**: error de tipos esperado hasta
  cablear las props en el workspace.
- **Verificación visual pendiente**: ninguna tarea de este plan pudo
  verificarse en el navegador durante su creación (la app exige login). Tras
  ejecutar las 6 tareas, conviene abrir `/expedientes-archivo` → Subir y
  probar manualmente: elegir "Añadir a uno existente", buscar un expediente
  de los 9 ya migrados, subir un PDF, y confirmar en el slide-over que
  aparece como folio 2 de ese expediente.
