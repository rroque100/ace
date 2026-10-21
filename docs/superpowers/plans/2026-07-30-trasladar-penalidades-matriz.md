# Trasladar penalidades de la matriz → «Otras penalidades» — Implementation Plan

> **For agentic workers:** casillas (`- [ ]`) para seguimiento. Cada tarea termina en algo probado y
> commiteable por separado. TDD donde el suite lo permite (Node); la UI se verifica con
> `tsc`/`eslint`/`build` (la página está tras login).

**Goal:** un botón en el cuadro «Otras penalidades» que trae, de la matriz de riesgos (Art. 44.3),
las filas cuya «Relación con Penalidades» diga «otras penalidades», con el riesgo como supuesto.

**Architecture:** parser de tablas Markdown extraído a una lib pura (compartida con el .docx, sin
`docx` en el cliente); una función pura de extracción; y un botón en el editor que añade las filas
(dedup por supuesto), con el valor de la matriz cableado desde la ficha.

**Tech Stack:** Next.js 16 / React 19 / TypeScript, Vitest (`environment: "node"`).

## Global Constraints

- Código, comentarios y commits en **español**; asunto del commit = síntoma del usuario, minúscula,
  **sin acentos** (Conventional Commits con scope).
- Comentarios explican el **porqué**, no el qué.
- El suite **no renderiza React**: la UI se verifica con `tsc`/`eslint`/`build`.
- Verificación por tarea: `npx tsc --noEmit`, `npx eslint app lib`, `npx vitest run`.
- Mapeo fijo: `Supuesto ← «Identificación del Riesgo»`, Cálculo y Verificación **vacíos**.
- Coincidencia: la celda de penalidades **contiene** «otras penalidad» (normalizado); dedup por
  supuesto normalizado; solo se **añaden** filas, nunca se borran/editan las manuales.

## File Structure

- `lib/markdown-tabla.ts` — **crear**. `SegmentoParrafo`, `segmentarParrafoMd` + ayudantes (movidos
  desde `requerimiento-docx.ts`). Parser puro de tablas Markdown, sin `docx`.
- `lib/requerimiento-docx.ts` — **modificar**. Importa el parser de la lib nueva; quita el bloque movido.
- `tests/requerimiento-matriz-riesgos.test.ts` — **modificar**. Import de `segmentarParrafoMd`.
- `lib/penalidades-matriz.ts` — **crear**. `penalidadesDesdeMatriz(matriz): OtraPenalidad[]`.
- `tests/penalidades-matriz.test.ts` — **crear**.
- `app/components/otras-penalidades-editor.tsx` — **modificar**. Prop `matriz` + botón «Traer…».
- `app/components/necesidad/campo-ficha.tsx` — **modificar**. Prop `gestionRiesgos`; pasa `matriz`.
- `app/components/necesidad/ficha-editable.tsx` — **modificar**. Pasa `gestionRiesgos` (gated).

---

### Task 1: Extraer el parser de tablas Markdown a `lib/markdown-tabla.ts`

**Files:**
- Create: `lib/markdown-tabla.ts`
- Modify: `lib/requerimiento-docx.ts:389-448` (bloque del parser) y su import
- Modify: `tests/requerimiento-matriz-riesgos.test.ts:2` (import)

**Interfaces:**
- Produces: `type SegmentoParrafo = { tipo: "tabla"; filas: string[][] } | { tipo: "parrafo"; texto: string } | { tipo: "vineta"; texto: string }`,
  `segmentarParrafoMd(valor: string): SegmentoParrafo[]`.

- [ ] **Step 1: Crear `lib/markdown-tabla.ts`** con el contenido movido (idéntico al actual):

```ts
// Parser puro de tablas Markdown embebidas en texto (la matriz de riesgos del
// Art. 44.3 va como tabla con pipes). Vivía en `requerimiento-docx.ts`, pero ese
// fichero importa la librería `docx`; sacándolo aquí lo reutiliza también un
// componente CLIENTE (el editor de «Otras penalidades») sin arrastrar `docx` al
// bundle del navegador, y queda un solo parser de pipes.

/** Un segmento de un párrafo de campo: texto, viñeta o tabla Markdown. */
export type SegmentoParrafo =
  | { tipo: "tabla"; filas: string[][] }
  | { tipo: "parrafo"; texto: string }
  | { tipo: "vineta"; texto: string };

/** ¿La línea es el separador de una tabla Markdown («|---|:--:|»)? */
function esSeparadorTablaMd(linea: string): boolean {
  const t = linea.trim();
  return t.includes("|") && t.includes("-") && /^\|?[\s:|-]+\|?$/.test(t);
}

/** ¿La línea parece una fila de tabla Markdown (tiene al menos un «|»)? */
function esFilaTablaMd(linea: string): boolean {
  return linea.includes("|");
}

/** Celdas de una fila Markdown: «| a | b |» → ["a","b"]. */
function celdasFilaMd(linea: string): string[] {
  let t = linea.trim();
  if (t.startsWith("|")) t = t.slice(1);
  if (t.endsWith("|")) t = t.slice(0, -1);
  return t.split("|").map((c) => c.trim());
}

/**
 * Parte el texto en segmentos: párrafos, viñetas y TABLAS Markdown. Una tabla es
 * una fila «| … |» seguida de una separadora «|---|»; el resto sigue como párrafo
 * o viñeta. Un pipe suelto en prosa NO es tabla (hace falta la separadora).
 */
export function segmentarParrafoMd(valor: string): SegmentoParrafo[] {
  const lineas = valor.split(/\r?\n/);
  const out: SegmentoParrafo[] = [];
  let i = 0;
  while (i < lineas.length) {
    const actual = lineas[i];
    if (esFilaTablaMd(actual) && esSeparadorTablaMd(lineas[i + 1] ?? "")) {
      const filas: string[][] = [celdasFilaMd(actual)];
      i += 2; // cabecera + separador
      while (i < lineas.length && lineas[i].trim() && esFilaTablaMd(lineas[i]) && !esSeparadorTablaMd(lineas[i])) {
        filas.push(celdasFilaMd(lineas[i]));
        i += 1;
      }
      out.push({ tipo: "tabla", filas });
      continue;
    }
    const limpio = actual.trim();
    if (limpio) {
      out.push(
        /^[-•*]\s+/.test(limpio)
          ? { tipo: "vineta", texto: limpio.replace(/^[-•*]\s+/, "") }
          : { tipo: "parrafo", texto: limpio },
      );
    }
    i += 1;
  }
  return out;
}
```

- [ ] **Step 2: Quitar el bloque movido de `requerimiento-docx.ts`.** Borrar desde
  `export type SegmentoParrafo =` (línea ~389) hasta el cierre de `segmentarParrafoMd` (antes de
  `function tablaMarkdown`). **Conservar** `tablaMarkdown` y `renderParrafoConTablas` (usan `docx`).
  Añadir el import (junto a los otros de `./`):

```ts
import { segmentarParrafoMd } from "./markdown-tabla";
```

- [ ] **Step 3: Actualizar el import del test** — `tests/requerimiento-matriz-riesgos.test.ts` línea 2:

```ts
import { segmentarParrafoMd } from "@/lib/markdown-tabla";
```

- [ ] **Step 4: Verificar** — `npx vitest run tests/requerimiento-matriz-riesgos.test.ts && npx tsc --noEmit`.
  Expected: PASS (los 6 casos, incluido el de estructura del Word, siguen verdes).

- [ ] **Step 5: Commit**

```bash
git add lib/markdown-tabla.ts lib/requerimiento-docx.ts tests/requerimiento-matriz-riesgos.test.ts
git commit -m "refactor(necesidades): el parser de tablas markdown sale a su propia lib"
```

---

### Task 2: Extracción `penalidadesDesdeMatriz`

**Files:**
- Create: `lib/penalidades-matriz.ts`
- Test: `tests/penalidades-matriz.test.ts`

**Interfaces:**
- Consumes: de Task 1 `segmentarParrafoMd`; de `lib/otras-penalidades` el tipo `OtraPenalidad`.
- Produces: `penalidadesDesdeMatriz(matriz: string | null | undefined): OtraPenalidad[]`.

- [ ] **Step 1: Test que falla** — `tests/penalidades-matriz.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { penalidadesDesdeMatriz } from "@/lib/penalidades-matriz";

const MATRIZ = [
  "MATRIZ DE GESTIÓN DE RIESGOS",
  "| Categoría | Identificación del Riesgo | Análisis | Asignación | Estrategia | Relación con Penalidades |",
  "|---|---|---|---|---|---|",
  "| Técnico | Deficiencias en el montaje | Media/Alto | Contratista | Supervisión | Otras penalidades |",
  "| Financiero | Desabastecimiento | Media/Alto | Contratista | Stock | Penalidad por mora |",
  "| Seguridad | Accidente en altura | Baja/Crítico | Contratista | EPP | Otras penalidades: 0.5 UIT |",
  "| Legal | Demora en licencias | Media/Medio | Entidad | Gestión previa | No aplica |",
].join("\n");

describe("penalidadesDesdeMatriz", () => {
  it("trae solo las filas «otras penalidad», con el riesgo como supuesto y el resto vacío", () => {
    expect(penalidadesDesdeMatriz(MATRIZ)).toEqual([
      { supuesto: "Deficiencias en el montaje", calculo: "", verificacion: "" },
      { supuesto: "Accidente en altura", calculo: "", verificacion: "" },
    ]);
  });

  it("sin tabla devuelve lista vacía", () => {
    expect(penalidadesDesdeMatriz("solo sustento, sin tabla")).toEqual([]);
    expect(penalidadesDesdeMatriz("")).toEqual([]);
    expect(penalidadesDesdeMatriz(undefined)).toEqual([]);
  });

  it("usa la última columna como penalidades y la 2.ª como riesgo si la cabecera no coincide", () => {
    const sinCabeceraClara = [
      "| A | B | C |",
      "|---|---|---|",
      "| x | El riesgo | otras penalidades |",
    ].join("\n");
    expect(penalidadesDesdeMatriz(sinCabeceraClara)).toEqual([
      { supuesto: "El riesgo", calculo: "", verificacion: "" },
    ]);
  });
});
```

- [ ] **Step 2: Correr y ver fallar** — `npx vitest run tests/penalidades-matriz.test.ts` → FAIL.

- [ ] **Step 3: Implementar** — `lib/penalidades-matriz.ts`

```ts
import { segmentarParrafoMd } from "./markdown-tabla";
import type { OtraPenalidad } from "./otras-penalidades";

/** Minúsculas, sin tildes y sin espacios de sobra, para comparar de forma robusta. */
function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

/**
 * Penalidades derivadas de la matriz de riesgos (Art. 44.3): las filas cuya
 * «Relación con Penalidades» dice «otras penalidades». El «supuesto de
 * aplicación» es la «Identificación del Riesgo»; el cálculo y la verificación
 * quedan vacíos —la matriz no los trae— para que el usuario los complete.
 *
 * Las columnas se localizan por cabecera (normalizada); si no coincide, se cae a
 * la 2.ª columna (riesgo) y la última (penalidades), que es el orden del formato.
 */
export function penalidadesDesdeMatriz(matriz: string | null | undefined): OtraPenalidad[] {
  const tabla = segmentarParrafoMd(matriz ?? "").find((s) => s.tipo === "tabla");
  if (!tabla || tabla.tipo !== "tabla" || tabla.filas.length < 2) return [];
  const [cabecera, ...cuerpo] = tabla.filas;
  const idxDe = (frag: string, porDefecto: number) => {
    const i = cabecera.findIndex((c) => norm(c).includes(norm(frag)));
    return i >= 0 ? i : porDefecto;
  };
  const idxRiesgo = idxDe("identificacion del riesgo", 1);
  const idxPenal = idxDe("relacion con penalidades", cabecera.length - 1);
  const out: OtraPenalidad[] = [];
  for (const fila of cuerpo) {
    if (norm(fila[idxPenal] ?? "").includes("otras penalidad")) {
      const supuesto = (fila[idxRiesgo] ?? "").trim();
      if (supuesto) out.push({ supuesto, calculo: "", verificacion: "" });
    }
  }
  return out;
}
```

- [ ] **Step 4: Correr y ver pasar** — `npx vitest run tests/penalidades-matriz.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/penalidades-matriz.ts tests/penalidades-matriz.test.ts
git commit -m "feat(necesidades): extraer del cuadro de riesgos las filas de otras penalidades"
```

---

### Task 3: Botón en el editor + cableado del valor de la matriz (UI)

**Files:**
- Modify: `app/components/otras-penalidades-editor.tsx` (prop `matriz` + botón)
- Modify: `app/components/necesidad/campo-ficha.tsx` (prop `gestionRiesgos`; pasa `matriz`)
- Modify: `app/components/necesidad/ficha-editable.tsx` (pasa `gestionRiesgos` gated)

**Interfaces:**
- Consumes: de Task 2 `penalidadesDesdeMatriz`.

- [ ] **Step 1: Editor — prop `matriz` + botón.** En `otras-penalidades-editor.tsx`:

Import (junto a los de `@/lib/otras-penalidades`):

```ts
import { penalidadesDesdeMatriz } from "@/lib/penalidades-matriz";
```

Firma (añadir `matriz`):

```tsx
export function OtrasPenalidadesEditor({
  value,
  onChange,
  readOnly = false,
  matriz = "",
}: {
  value: string;
  onChange: (next: string) => void;
  readOnly?: boolean;
  /** Contenido del campo «Gestión de riesgos», para traer sus «otras penalidades». */
  matriz?: string;
}) {
```

Dentro del componente, tras `const editar = …` (antes del `return`):

```tsx
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  const candidatas = penalidadesDesdeMatriz(matriz);
  const yaEstan = new Set(filas.map((f) => norm(f.supuesto)));
  const nuevas = candidatas.filter((c) => c.supuesto.trim() && !yaEstan.has(norm(c.supuesto)));
  function traerDeLaMatriz() {
    if (readOnly || nuevas.length === 0) return;
    propagar([...filas, ...nuevas]);
  }
```

Render del botón (justo después del `<p>` introductorio, antes del cuadro), solo si la matriz aporta
candidatas y no es readOnly:

```tsx
      {!readOnly && candidatas.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={nuevas.length === 0}
            onClick={traerDeLaMatriz}
            className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12.5px] font-semibold text-ink outline-none transition-colors hover:border-brand/40 hover:bg-brand-soft hover:text-brand focus-visible:shadow-[var(--shadow-focus)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={13} /> Traer penalidades de la matriz de riesgos
          </button>
          <span className="text-[11.5px] text-muted">
            {nuevas.length > 0
              ? `${nuevas.length} en la matriz sin registrar`
              : "Ya están todas las de la matriz"}
          </span>
        </div>
      ) : null}
```

(`Plus` ya está importado de `lucide-react` en este fichero.)

- [ ] **Step 2: `campo-ficha.tsx` — prop `gestionRiesgos` y pasarla al editor.** En el tipo de props
  del componente (junto a los demás string props como `personalClaveExperiencia`):

```ts
  /** Contenido de «Gestión de riesgos», para el botón de traer penalidades. */
  gestionRiesgos: string;
```

Desestructurarla en la firma del componente (junto a las otras props). Y en el `kind === "penalidades"`
(línea ~412) pasarla al editor:

```tsx
        <OtrasPenalidadesEditor
          matriz={gestionRiesgos}
          onChange={(next) => onCambio(field.api, next)}
          value={val}
        />
```

- [ ] **Step 3: `ficha-editable.tsx` — pasar `gestionRiesgos` (gated).** Donde se renderiza
  `<CampoFicha … />` (junto a `personalClaveExperiencia={esRequisitos ? … : ""}`, línea ~333), añadir:

```tsx
        gestionRiesgos={field.kind === "penalidades" ? (fichaForm.gestionRiesgos ?? "") : ""}
```

(Gated al campo de penalidades para no repintar el resto de campos memoizados.)

- [ ] **Step 4: Verificar** — `npx tsc --noEmit && npx eslint app lib && npx vitest run`. Expected:
  sin errores; suite verde. Manual (si hay dev server): en una necesidad con matriz que tenga filas
  «Otras penalidades», el cuadro «Otras penalidades» muestra el botón; al pulsarlo aparecen las filas
  con el riesgo como Supuesto y Cálculo/Verificación vacíos; pulsarlo de nuevo dice «Ya están todas».

- [ ] **Step 5: Commit**

```bash
git add app/components/otras-penalidades-editor.tsx app/components/necesidad/campo-ficha.tsx app/components/necesidad/ficha-editable.tsx
git commit -m "feat(necesidades): traer al cuadro de penalidades las otras penalidades de la matriz de riesgos"
```

---

## Self-Review

- **Cobertura del spec:** §A → Task 2; §B → Task 1; §C → Task 3 (Step 1); §D → Task 3 (Steps 2-3).
  Tests → Tasks 1 (parser sigue verde) y 2 (extracción). Sin huecos.
- **Placeholders:** ninguno; todo el código está escrito.
- **Consistencia de tipos:** `segmentarParrafoMd`/`SegmentoParrafo` (Task 1) los usa Task 2;
  `penalidadesDesdeMatriz(matriz): OtraPenalidad[]` (Task 2) lo usa Task 3; `OtraPenalidad`
  (`{ supuesto, calculo, verificacion }`) viene de `lib/otras-penalidades` sin cambios.

## Riesgos / a confirmar al ejecutar

- **Al mover el bloque (Task 1):** confirmar que `renderParrafoConTablas` (que queda en
  `requerimiento-docx.ts`) sigue llamando a `segmentarParrafoMd` ahora importado; y que no quedó
  `SegmentoParrafo` referenciado por nombre en ese fichero (si lo estuviera, importarlo también).
- **`campo-ficha` está memoizado:** `gestionRiesgos` como prop nueva es `""` salvo en el campo de
  penalidades, así que no cambia la identidad de props del resto (no rompe la memo).
