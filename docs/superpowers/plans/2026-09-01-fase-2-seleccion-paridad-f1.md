# Fase 2 (Selección) — paridad con Fase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Llevar la Fase 2 · Selección (`/expedientes/{id}`, pasos B1-B8) al mismo nivel de sofisticación que ya tiene la Fase 1: validaciones cruzadas entre pasos, editores estructurados (en vez de texto libre) para B2 y B6, y generación de documentos oficiales (.docx) para B1, B7 y B8.

**Architecture:** Se sigue EXACTAMENTE el patrón ya usado por la Fase 1 — no se inventa arquitectura nueva:
- Validaciones: una función pura `LiteralExpediente[]`-shaped por gate, igual que `lib/expediente-contenido.ts` (`contenidoExpediente`/`faltaParaAprobar`), consumida por `fase-panel.tsx` para mostrar avisos antes de marcar un paso "hecho".
- Editores: un componente `"use client"` con contrato `{ value: unknown; onChange: (next: T[]) => void; readOnly?: boolean }`, cableado en `fase-panel.tsx` con un `if (campo.tipo === "...")`, igual que `ProveedoresConsultadosEditor`/`RequisitosCalificacionEditor`.
- Documentos: un par `lib/<doc>-docx-datos.ts` (mapeo `hitos` → datos del documento, puro y testeable) + `lib/<doc>-docx.ts` (composición con la librería `docx`, igual que `lib/evaluadores-docx.ts`), consumidos por una ruta `app/api/processes/[id]/fase2/<doc>/route.ts` que hace `requireCapability("expediente.manage")`, arma los datos y devuelve el `.docx`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript estricto, `docx` (composición de Word), Vitest.

## Global Constraints

- Código, comentarios y commits en español (CLAUDE.md).
- Ningún dato normativo (número de artículo, plazo, monto) se inventa: donde el texto exacto de un documento oficial no está verificado contra la norma o un formato ya usado por la entidad, el task lo marca explícitamente con `// VERIFICAR:` y NO se da por terminado hasta confirmarlo (usar la skill `verificacion-legal-rag` contra el corpus indexado, o pedir al usuario el formato real que ya usa la entidad).
- Los 8 pasos B1-B8 y su `baseLegal` YA EXISTEN en `lib/actuaciones-seleccion.ts` — verificado contra el RAG (Arts. 62-90 del Reglamento, alta confianza semántica). Este plan NO los reescribe: los pasos ya funcionan a nivel básico (campos sueltos, sin editor estructurado ni documento). Este plan cierra tres brechas puntuales sobre esa base, no reconstruye la Fase 2 desde cero.
- Cada task termina en algo verificable con `npm run typecheck`, `npm run lint` y (si aplica) `npx vitest run <archivo>` — mismo criterio que el resto del proyecto.
- No tocar `fase-dos-panel.tsx` ni `procurement-fases.ts` (B1-B8, catálogo) salvo que un task lo diga explícitamente — son el contrato estable del que parte este plan.

---

## Parte 1 — Validaciones cruzadas entre pasos

Hoy no existe ninguna: se puede marcar B7 (Otorgamiento) "hecho" sin que B6 (Evaluación) lo esté, o B8 (Consentimiento) sin B7. F1 resuelve esto con `lib/expediente-contenido.ts` — se replica el mismo patrón para F2.

### Task 1: `lib/seleccion-contenido.ts` — gates de la Fase 2

**Files:**
- Modify: `lib/expediente-contenido.ts:65-66` (exportar `estado`/`hecho`, hoy privados, para no duplicarlos)
- Create: `lib/seleccion-contenido.ts`
- Test: `tests/seleccion-contenido.test.ts`

**Interfaces:**
- Consumes: `HitosMap` de `@/lib/procurement-fases` (ya existe); `estado`/`hecho` de `@/lib/expediente-contenido` (se exportan en este task).
- Produces: `export type LiteralSeleccion = { literal: string; etiqueta: string; cumple: boolean; detalle?: string; paso: string }`, `export function faltaParaOtorgar(hitos: HitosMap): LiteralSeleccion[]`, `export function faltaParaConsentir(hitos: HitosMap): LiteralSeleccion[]`. Las usa el Task 2 (fase-panel.tsx) y el Task 6 (docx de B7/B8, que deben poder generarse solo cuando el gate está en cumple:true).

- [ ] **Step 1: Exportar `estado`/`hecho` de `lib/expediente-contenido.ts`**

En `lib/expediente-contenido.ts:65-66`, cambiar:
```ts
const estado = (hitos: HitosMap, code: string): HitoStatus => hitos[code]?.status ?? "pendiente";
const hecho = (hitos: HitosMap, code: string) => estado(hitos, code) === "hecho";
```
por:
```ts
export const estado = (hitos: HitosMap, code: string): HitoStatus => hitos[code]?.status ?? "pendiente";
export const hecho = (hitos: HitosMap, code: string) => estado(hitos, code) === "hecho";
```
(Son usadas dentro del propio archivo sin cambios — `export` no rompe nada, solo las hace visibles afuera.)

- [ ] **Step 2: Escribir el test que falla**

```ts
// tests/seleccion-contenido.test.ts
import { describe, expect, it } from "vitest";
import { faltaParaConsentir, faltaParaOtorgar } from "@/lib/seleccion-contenido";
import type { HitosMap } from "@/lib/procurement-fases";

describe("faltaParaOtorgar", () => {
  it("exige B6 (evaluación) hecho antes de otorgar la buena pro", () => {
    const hitos: HitosMap = {};
    const falta = faltaParaOtorgar(hitos);
    expect(falta.some((f) => f.paso === "B6" && !f.cumple)).toBe(true);
  });

  it("si hubo consultas u observaciones (B3), exige B4 (bases integradas) hecho", () => {
    const hitos: HitosMap = {
      B3: { status: "hecho", data: { cantidad_consultas: 2 } },
      B6: { status: "hecho", data: {} },
    };
    const falta = faltaParaOtorgar(hitos);
    expect(falta.some((f) => f.paso === "B4" && !f.cumple)).toBe(true);
  });

  it("sin consultas ni observaciones, B4 no es exigible", () => {
    const hitos: HitosMap = {
      B3: { status: "hecho", data: { cantidad_consultas: 0, cantidad_observaciones: 0 } },
      B6: { status: "hecho", data: {} },
    };
    expect(faltaParaOtorgar(hitos)).toHaveLength(0);
  });

  it("con B6 hecho y sin consultas/observaciones, no falta nada", () => {
    const hitos: HitosMap = { B6: { status: "hecho", data: {} } };
    expect(faltaParaOtorgar(hitos)).toHaveLength(0);
  });
});

describe("faltaParaConsentir", () => {
  it("exige B7 (otorgamiento) hecho", () => {
    expect(faltaParaConsentir({}).some((f) => f.paso === "B7" && !f.cumple)).toBe(true);
  });

  it("con B7 hecho, no falta nada", () => {
    expect(faltaParaConsentir({ B7: { status: "hecho", data: {} } })).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Correr el test y confirmar que falla**

Run: `npx vitest run tests/seleccion-contenido.test.ts`
Expected: FAIL — `Cannot find module '@/lib/seleccion-contenido'`

- [ ] **Step 4: Implementar `lib/seleccion-contenido.ts`**

```ts
// Gates entre los pasos de la Fase 2 (Ley N° 32069, Reglamento D.S. 009-2025-EF
// mod. por D.S. 001-2026-EF). Mismo patrón que lib/expediente-contenido.ts
// (Fase 1): cada literal es una condición real de la norma, no una regla
// inventada — si un paso previo no cerró, el siguiente no debería poder
// marcarse "hecho" sin que quien lo hace lo vea explícitamente.
//
//   B7 (Otorgamiento) exige B6 (Evaluación) cerrado — Art. 80: solo se otorga
//   la buena pro sobre ofertas ya evaluadas y calificadas.
//   B7 exige B4 (Bases integradas) cerrado SI hubo consultas u observaciones
//   en B3 — Art. 74: cuando el pliego absolutorio modifica las bases, hay que
//   publicar la versión integrada antes de seguir; si no hubo consultas ni
//   observaciones, no hay nada que integrar.
//   B8 (Consentimiento) exige B7 (Otorgamiento) cerrado — Art. 82.1: el plazo
//   de consentimiento corre desde el otorgamiento, no puede haber consentimiento
//   sin un otorgamiento previo.

import { estado, hecho } from "./expediente-contenido";
import type { HitosMap } from "./procurement-fases";

export type LiteralSeleccion = {
  literal: string;
  etiqueta: string;
  cumple: boolean;
  detalle?: string;
  paso: string;
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function faltaParaOtorgar(hitos: HitosMap): LiteralSeleccion[] {
  const items: LiteralSeleccion[] = [];

  items.push({
    literal: "Art. 80",
    etiqueta: "Evaluación y calificación (B6) cerrada",
    cumple: hecho(hitos, "B6"),
    detalle: hecho(hitos, "B6")
      ? undefined
      : "No se puede otorgar la buena pro sin haber cerrado la evaluación y calificación de ofertas (B6).",
    paso: "B6",
  });

  const b3 = (hitos.B3?.data ?? {}) as Record<string, unknown>;
  const huboConsultasUObservaciones = num(b3.cantidad_consultas) > 0 || num(b3.cantidad_observaciones) > 0;
  if (huboConsultasUObservaciones) {
    items.push({
      literal: "Art. 74",
      etiqueta: "Bases integradas (B4) publicadas",
      cumple: hecho(hitos, "B4"),
      detalle: hecho(hitos, "B4")
        ? undefined
        : "Hubo consultas u observaciones (B3): la Art. 74 exige publicar las bases integradas (B4) antes de otorgar la buena pro.",
      paso: "B4",
    });
  }

  return items.filter((i) => !i.cumple);
}

export function faltaParaConsentir(hitos: HitosMap): LiteralSeleccion[] {
  const items: LiteralSeleccion[] = [
    {
      literal: "Art. 82.1",
      etiqueta: "Otorgamiento de la buena pro (B7) cerrado",
      cumple: hecho(hitos, "B7"),
      detalle: hecho(hitos, "B7")
        ? undefined
        : "El plazo de consentimiento corre desde el otorgamiento (B7): no se puede declarar consentida sin un otorgamiento previo.",
      paso: "B7",
    },
  ];
  return items.filter((i) => !i.cumple);
}

// Reexportado por conveniencia: fase-panel.tsx ya importa `estado` de aquí en
// otros contextos de la Fase 1, y así el mismo símbolo sirve para ambos.
export { estado };
```

- [ ] **Step 5: Correr el test y confirmar que pasa**

Run: `npx vitest run tests/seleccion-contenido.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 6: Typecheck y lint**

Run: `npm run typecheck && npx eslint lib/seleccion-contenido.ts lib/expediente-contenido.ts`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add lib/seleccion-contenido.ts lib/expediente-contenido.ts tests/seleccion-contenido.test.ts
git commit -m "feat(expedientes): gates entre pasos de la Fase 2 (B6->B7, B4->B7 si hubo consultas, B7->B8)"
```

---

### Task 2: Mostrar los avisos de `faltaParaOtorgar`/`faltaParaConsentir` en `fase-panel.tsx`

**Files:**
- Modify: `app/components/fase-panel.tsx` (el bloque que en F1 muestra `faltaParaAprobar` en A8 — buscar `faltaParaAprobar` en el archivo para ubicarlo exactamente y replicar el mismo patrón de aviso para B7/B8)

**Interfaces:**
- Consumes: `faltaParaOtorgar`, `faltaParaConsentir` de `@/lib/seleccion-contenido` (Task 1).
- Produces: nada nuevo para otros tasks — es la capa de presentación final de este gate.

- [ ] **Step 1: Ubicar el patrón existente**

```bash
grep -n "faltaParaAprobar" app/components/fase-panel.tsx
```
Leer las ~15 líneas alrededor de ese uso (es el bloque que en A8 lista los literales pendientes con su `detalle`). Replicar la MISMA estructura JSX (mismo componente de aviso/alerta, mismo estilo) para `code === "B7"` (usando `faltaParaOtorgar(hitosTodos)`) y `code === "B8"` (usando `faltaParaConsentir(hitosTodos)`) — `hitosTodos` ya está disponible en el componente (se usa para A8 igual).

- [ ] **Step 2: Importar y cablear**

Añadir al bloque de imports de `@/lib/seleccion-contenido`:
```ts
import { faltaParaConsentir, faltaParaOtorgar } from "@/lib/seleccion-contenido";
```
Y, junto a donde se calcula `faltaAprobar` para A8, añadir:
```ts
const faltaOtorgar = code === "B7" && hitosTodos ? faltaParaOtorgar(hitosTodos) : [];
const faltaConsentir = code === "B8" && hitosTodos ? faltaParaConsentir(hitosTodos) : [];
```
Renderizar `faltaOtorgar`/`faltaConsentir` con el MISMO componente de aviso que ya renderiza `faltaAprobar` en A8 (mismo bloque JSX, cambiando la fuente de datos) — no crear un componente de aviso nuevo.

- [ ] **Step 3: Verificar manualmente**

No hay test automatizado para JSX en este proyecto (ver CLAUDE.md — los tests cubren lógica de dominio, no componentes). Verificar con el preview: abrir un expediente en Fase 2 sin B6 marcado "hecho", abrir el paso B7, confirmar que aparece el aviso "Evaluación y calificación (B6) cerrada" con su `detalle`.

- [ ] **Step 4: Typecheck y lint**

Run: `npm run typecheck && npx eslint app/components/fase-panel.tsx`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add app/components/fase-panel.tsx
git commit -m "feat(expedientes): muestra los gates de B7/B8 en el paso, igual que A8 en Fase 1"
```

---

## Parte 2 — Editores estructurados (B2, B6)

Hoy `relacion_admitidos` (B2) y `orden_prelacion` (B6) son `textarea` de texto libre. Se reemplazan por tablas, mismo patrón que `ProveedoresConsultadosEditor` (Art. 49, ya migrado).

### Task 3: `PostoresEditor` — tabla de participantes admitidos/no admitidos (B2)

**Files:**
- Modify: `lib/actuaciones-preparatorias.ts:21-44` (añadir `"postores"` al union `TipoCampo`)
- Modify: `lib/actuaciones-seleccion.ts:35-41` (paso B2: reemplazar el campo `relacion_admitidos` por el nuevo tipo)
- Create: `lib/postores-seleccion.ts` (tipo + helpers puros, mismo rol que `lib/anexo1-interaccion.ts` para proveedores)
- Create: `app/components/postores-editor.tsx`
- Modify: `app/components/fase-panel.tsx` (cablear `campo.tipo === "postores"`, mismo bloque que `"proveedores"`)
- Modify: `app/tailwind.css` (añadir `@source "./components/postores-editor.tsx";` junto a los demás editores — sin esto sale sin estilos, ver CLAUDE.md)
- Test: `tests/postores-seleccion.test.ts`

**Interfaces:**
- Consumes: `PROV_TABLA`, `PROV_QUITAR`, `PROV_VACIA` de `./tabla-editor-estilos` (reutilizar las clases ya compartidas, no crear otras nuevas).
- Produces: `export type Postor = { ruc: string; razonSocial: string; admitido: boolean; motivoNoAdmision?: string }`, `export function leerPostores(value: unknown): Postor[]`, `export function contarAdmitidos(postores: Postor[]): number` — el Task 6 (docx del acta de otorgamiento, si lista postores) puede reusar `leerPostores`.

- [ ] **Step 1: Escribir el test que falla**

```ts
// tests/postores-seleccion.test.ts
import { describe, expect, it } from "vitest";
import { contarAdmitidos, leerPostores } from "@/lib/postores-seleccion";

describe("leerPostores", () => {
  it("con valor vacío o inválido, devuelve []", () => {
    expect(leerPostores(undefined)).toEqual([]);
    expect(leerPostores("texto viejo de un formulario anterior")).toEqual([]);
  });

  it("lee filas válidas, ignora las que no tienen forma de Postor", () => {
    const filas = leerPostores([
      { ruc: "20123456789", razonSocial: "ACME SAC", admitido: true },
      { ruc: "20999999999", razonSocial: "OTRA SAC", admitido: false, motivoNoAdmision: "No presentó garantía" },
      "basura",
    ]);
    expect(filas).toHaveLength(2);
  });
});

describe("contarAdmitidos", () => {
  it("cuenta solo los admitidos", () => {
    const postores = [
      { admitido: true, razonSocial: "A", ruc: "1" },
      { admitido: false, razonSocial: "B", ruc: "2" },
      { admitido: true, razonSocial: "C", ruc: "3" },
    ];
    expect(contarAdmitidos(postores)).toBe(2);
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `npx vitest run tests/postores-seleccion.test.ts`
Expected: FAIL — `Cannot find module '@/lib/postores-seleccion'`

- [ ] **Step 3: Implementar `lib/postores-seleccion.ts`**

```ts
// Registro de participantes (B2, Arts. 67-70 del Reglamento): quiénes se
// presentaron y si fueron admitidos, estructurado en vez de texto libre —
// mismo criterio que lib/anexo1-interaccion.ts para los proveedores del Art.
// 49: con texto libre no se puede contar, filtrar ni volcar al acta.

export type Postor = {
  ruc: string;
  razonSocial: string;
  admitido: boolean;
  motivoNoAdmision?: string;
};

function esPostor(v: unknown): v is Postor {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return typeof r.ruc === "string" && typeof r.razonSocial === "string" && typeof r.admitido === "boolean";
}

export function leerPostores(value: unknown): Postor[] {
  if (!Array.isArray(value)) return [];
  return value.filter(esPostor);
}

export function contarAdmitidos(postores: Postor[]): number {
  return postores.filter((p) => p.admitido).length;
}
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `npx vitest run tests/postores-seleccion.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Añadir el tipo de campo**

En `lib/actuaciones-preparatorias.ts`, en el union `TipoCampo` (línea ~21), añadir tras `"evaluadores"`:
```ts
  | "evaluadores"
  // B2) Registro de participantes: RUC, razón social, admitido/no y motivo.
  | "postores";
```

- [ ] **Step 6: Crear el editor `app/components/postores-editor.tsx`**

```tsx
"use client";

import { Plus, Trash2 } from "lucide-react";
import { leerPostores, type Postor } from "@/lib/postores-seleccion";
import { PROV_QUITAR, PROV_TABLA, PROV_VACIA } from "./tabla-editor-estilos";

/** Tabla de participantes admitidos/no admitidos del registro (B2, Arts. 67-70). */
export function PostoresEditor({
  value,
  onChange,
  readOnly,
}: {
  value: unknown;
  onChange: (next: Postor[]) => void;
  readOnly?: boolean;
}) {
  const filas = leerPostores(value);

  function editar(i: number, campo: keyof Postor, v: string | boolean) {
    const next = filas.map((f, j) => (j === i ? { ...f, [campo]: v } : f));
    onChange(next);
  }

  function agregar() {
    onChange([...filas, { admitido: true, razonSocial: "", ruc: "" }]);
  }

  function quitar(i: number) {
    onChange(filas.filter((_, j) => j !== i));
  }

  if (readOnly && filas.length === 0) {
    return <p className={PROV_VACIA}>Sin postores registrados.</p>;
  }

  return (
    <div>
      <table className={PROV_TABLA}>
        <thead>
          <tr>
            <th>RUC</th>
            <th>Razón social</th>
            <th>Admitido</th>
            <th>Motivo (si no admitido)</th>
            {!readOnly ? <th /> : null}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i}>
              <td>
                {readOnly ? (
                  f.ruc
                ) : (
                  <input value={f.ruc} onChange={(e) => editar(i, "ruc", e.target.value)} maxLength={11} />
                )}
              </td>
              <td>
                {readOnly ? (
                  f.razonSocial
                ) : (
                  <input value={f.razonSocial} onChange={(e) => editar(i, "razonSocial", e.target.value)} />
                )}
              </td>
              <td>
                {readOnly ? (
                  f.admitido ? "Sí" : "No"
                ) : (
                  <select value={f.admitido ? "si" : "no"} onChange={(e) => editar(i, "admitido", e.target.value === "si")}>
                    <option value="si">Sí</option>
                    <option value="no">No</option>
                  </select>
                )}
              </td>
              <td>
                {readOnly ? (
                  f.motivoNoAdmision ?? "—"
                ) : (
                  <input
                    value={f.motivoNoAdmision ?? ""}
                    onChange={(e) => editar(i, "motivoNoAdmision", e.target.value)}
                    disabled={f.admitido}
                    placeholder={f.admitido ? "No aplica" : "Motivo de no admisión"}
                  />
                )}
              </td>
              {!readOnly ? (
                <td>
                  <button type="button" className={PROV_QUITAR} onClick={() => quitar(i)} aria-label="Quitar postor">
                    <Trash2 size={14} />
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      {!readOnly ? (
        <button type="button" onClick={agregar} className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-brand hover:underline">
          <Plus size={14} /> Agregar postor
        </button>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 7: Cablear en `fase-panel.tsx`**

Ubicar el bloque `if (campo.tipo === "proveedores")` (visto en la investigación de este plan, línea ~821) y añadir justo después un bloque análogo:
```tsx
if (campo.tipo === "postores") {
  return (
    <div className={cn(FIELD, full && "col-span-full")}>
      {labelContent}
      <PostoresEditor onChange={(next) => onChange(next)} readOnly={disabled} value={value} />
      {ayudaConEnlace}
    </div>
  );
}
```
Y añadir el import junto a `ProveedoresConsultadosEditor`:
```ts
import { PostoresEditor } from "./postores-editor";
```

- [ ] **Step 8: Cambiar el campo de B2 en `lib/actuaciones-seleccion.ts`**

Reemplazar, dentro de `PASOS_F2.B2.campos` (línea ~38):
```ts
{ name: "relacion_admitidos", label: "Relación de postores admitidos / no admitidos", tipo: "textarea", ancho: "full", required: true },
```
por:
```ts
{ name: "relacion_admitidos", label: "Relación de postores admitidos / no admitidos", tipo: "postores", ancho: "full", required: true, baseLegal: "Arts. 67-70 del Reglamento" },
```
(Se conserva el mismo `name`: los expedientes que ya tengan esto guardado como texto simplemente lo pierden de vista al re-renderizar como tabla — `leerPostores` ya descarta valores que no tienen forma de `Postor[]`, así que no revienta con datos viejos, solo empieza vacío.)

- [ ] **Step 9: Añadir a `app/tailwind.css`**

Junto a los demás `@source` de editores (buscar la línea de `proveedores-consultados-editor.tsx` o similar; si el archivo se escanea vía una carpeta ya cubierta como `./components/`, confirmar que este archivo cae dentro de esa cobertura antes de asumir que hace falta la línea nueva):
```css
@source "./components/postores-editor.tsx";
```

- [ ] **Step 10: Typecheck, lint y test**

Run: `npm run typecheck && npx eslint lib/postores-seleccion.ts app/components/postores-editor.tsx app/components/fase-panel.tsx lib/actuaciones-seleccion.ts && npx vitest run tests/postores-seleccion.test.ts`
Expected: sin errores, 3 tests PASS.

- [ ] **Step 11: Verificar manualmente en el preview**

Abrir un expediente en B2, confirmar que la tabla se ve con los estilos de `tabla-editor-estilos.ts` (no sin estilos — sería la señal de que faltó el `@source`).

- [ ] **Step 12: Commit**

```bash
git add lib/postores-seleccion.ts app/components/postores-editor.tsx app/components/fase-panel.tsx lib/actuaciones-seleccion.ts lib/actuaciones-preparatorias.ts app/tailwind.css tests/postores-seleccion.test.ts
git commit -m "feat(expedientes): B2 registra postores en tabla estructurada, no texto libre"
```

---

### Task 4: `OrdenPrelacionEditor` — tabla de resultados de evaluación (B6)

Mismo patrón que el Task 3, aplicado a `orden_prelacion` (B6). Se detalla más corto porque el patrón ya quedó fijado arriba — el implementador sigue el MISMO molde (tipo de campo nuevo, `lib/`, componente, cableo en `fase-panel.tsx`, `@source`).

**Files:**
- Modify: `lib/actuaciones-preparatorias.ts` (añadir `"puntajes"` a `TipoCampo`)
- Modify: `lib/actuaciones-seleccion.ts` (paso B6: reemplazar `orden_prelacion` de `tipo: "text"` a `tipo: "puntajes"`)
- Create: `lib/puntajes-seleccion.ts`
- Create: `app/components/puntajes-editor.tsx`
- Modify: `app/components/fase-panel.tsx`
- Modify: `app/tailwind.css`
- Test: `tests/puntajes-seleccion.test.ts`

**Interfaces:**
- Produces: `export type PuntajePostor = { orden: number; razonSocial: string; puntaje: number; admitida: boolean }`, `export function leerPuntajes(value: unknown): PuntajePostor[]`, `export function ganador(puntajes: PuntajePostor[]): PuntajePostor | null` (el de `orden === 1` entre los `admitida`) — lo consume el Task 6 (docx de B7) para autocompletar "Postor ganador" y "Puntaje máximo obtenido" desde B6, en vez de que el usuario los reteclee.

- [ ] **Step 1:** Escribir `tests/puntajes-seleccion.test.ts` con el mismo esqueleto de casos que el Task 3 (vacío/inválido → `[]`; filtra filas sin forma; `ganador()` devuelve el de `orden === 1` entre `admitida: true`, o `null` si no hay ninguna).
- [ ] **Step 2:** Correr y confirmar que falla (`Cannot find module`).
- [ ] **Step 3:** Implementar `lib/puntajes-seleccion.ts` con el mismo estilo de `lib/postores-seleccion.ts` (guards de tipo, sin red, puro).
- [ ] **Step 4:** Correr y confirmar que pasa.
- [ ] **Step 5:** Añadir `"puntajes"` a `TipoCampo` en `lib/actuaciones-preparatorias.ts`.
- [ ] **Step 6:** Crear `app/components/puntajes-editor.tsx` con el mismo layout de tabla que `postores-editor.tsx` (columnas: Orden, Razón social, Puntaje, Admitida), mismas clases `PROV_TABLA`/`PROV_QUITAR`/`PROV_VACIA`.
- [ ] **Step 7:** Cablear `campo.tipo === "puntajes"` en `fase-panel.tsx`, mismo bloque que el Task 3.
- [ ] **Step 8:** Cambiar `orden_prelacion` en `PASOS_F2.B6.campos` de `lib/actuaciones-seleccion.ts` a `tipo: "puntajes"`; quitar el campo suelto `puntaje_maximo` (ahora se deriva de la tabla vía `ganador()`, no se teclea aparte — evita que los dos puedan contradecirse).
- [ ] **Step 9:** Añadir `@source "./components/puntajes-editor.tsx";` a `app/tailwind.css`.
- [ ] **Step 10:** `npm run typecheck && npx eslint ... && npx vitest run tests/puntajes-seleccion.test.ts`.
- [ ] **Step 11:** Verificar manualmente en el preview (paso B6).
- [ ] **Step 12:** Commit: `feat(expedientes): B6 registra el orden de prelación en tabla estructurada, no texto libre`.

---

## Parte 3 — Generación de documentos (.docx)

Hoy ningún paso de F2 genera un documento — solo guarda campos. Se replica el patrón de `lib/evaluadores-docx-datos.ts` + `lib/evaluadores-docx.ts` + `app/api/processes/[id]/fase1/evaluadores-docx/route.ts`.

**Importante — no inventar el formato:** el texto exacto de un acta oficial (membrete, fórmulas protocolares, orden de las cláusulas) debe salir del formato que la entidad YA usa (pedir al usuario el acta real que usan hoy en papel/Word, si la tiene) o verificarse contra las bases estándar ya indexadas en el RAG (`Bases_estandar_de_Subasta_inversa_electronica` apareció en la búsqueda de este plan — puede tener el formato de acta de otorgamiento). Cada task de esta parte trae un borrador ESTRUCTURAL completo (mismas convenciones tipográficas que `evaluadores-docx.ts`: fuente Arial, 10pt) marcado con `// VERIFICAR:` en los puntos de redacción que dependen del formato real de la entidad — no se publica en producción sin resolver esos puntos.

### Task 5: Datos y ruta para el Acta de Otorgamiento de la Buena Pro (B7)

**Files:**
- Create: `lib/buena-pro-docx-datos.ts` (mapeo `hitos` → datos del documento, puro y testeable — mismo rol que `lib/evaluadores-docx-datos.ts`)
- Create: `lib/buena-pro-docx.ts` (composición con `docx`, mismo rol que `lib/evaluadores-docx.ts`)
- Create: `app/api/processes/[id]/fase2/buena-pro-docx/route.ts`
- Test: `tests/buena-pro-docx-datos.test.ts`

**Interfaces:**
- Consumes: `HitosMap` de `@/lib/procurement-fases`; `leerPostores`/`Postor` de `@/lib/postores-seleccion` (Task 3), para listar los postores admitidos en el acta. `ganadorRazonSocial`/`montoAdjudicado` se leen directo de `hitos.B7.data` (lo que el usuario ya tecleó en el paso B7) — NO se derivan de `puntajes-seleccion.ts` (Task 4): B7 es la decisión formal de otorgamiento, que puede no coincidir en redacción exacta con lo tecleado en B6 (p. ej. razón social completa vs. abreviada), así que el acta debe reflejar lo que B7 dice, no recalcularlo desde B6. Si en la práctica se prefiere autocompletar B7 desde el `ganador()` de B6, eso es una mejora de UX en `fase-panel.tsx` (prellenar el campo, no cambiar de dónde lee el acta) — fuera del alcance de este task.
- Produces: `export type DatosActaBuenaPro = { nomenclatura: string; fechaOtorgamiento: string; ganadorRazonSocial: string; montoAdjudicado: number; postoresAdmitidos: Postor[] }`, `export function datosActaBuenaPro(nomenclatura: string, hitos: HitosMap): DatosActaBuenaPro | null` (null si B7 no está "hecho" — no se genera el acta de un otorgamiento que no ha ocurrido), `export async function generarActaBuenaPro(datos: DatosActaBuenaPro): Promise<Buffer>`.

- [ ] **Step 1: Escribir el test que falla**

```ts
// tests/buena-pro-docx-datos.test.ts
import { describe, expect, it } from "vitest";
import { datosActaBuenaPro } from "@/lib/buena-pro-docx-datos";
import type { HitosMap } from "@/lib/procurement-fases";

describe("datosActaBuenaPro", () => {
  it("sin B7 hecho, devuelve null (no se genera un acta de algo que no ocurrió)", () => {
    expect(datosActaBuenaPro("PROC-2026-001", {})).toBeNull();
  });

  it("con B7 hecho, arma los datos del acta", () => {
    const hitos: HitosMap = {
      B7: {
        status: "hecho",
        data: {
          fecha_otorgamiento: "2026-06-10",
          ganador: "ACME SAC",
          monto_adjudicado: 80000,
        },
      },
      B2: {
        status: "hecho",
        data: { relacion_admitidos: [{ admitido: true, razonSocial: "ACME SAC", ruc: "20123456789" }] },
      },
    };
    const datos = datosActaBuenaPro("PROC-2026-001", hitos);
    expect(datos).not.toBeNull();
    expect(datos?.ganadorRazonSocial).toBe("ACME SAC");
    expect(datos?.montoAdjudicado).toBe(80000);
    expect(datos?.postoresAdmitidos).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `npx vitest run tests/buena-pro-docx-datos.test.ts`
Expected: FAIL — `Cannot find module '@/lib/buena-pro-docx-datos'`

- [ ] **Step 3: Implementar `lib/buena-pro-docx-datos.ts`**

```ts
// Datos del Acta de Otorgamiento de la Buena Pro (B7, Arts. 83-86 del
// Reglamento), mapeados desde `hitos` — puro, sin red, testeable. La
// composición del .docx vive aparte en lib/buena-pro-docx.ts (mismo split que
// evaluadores-docx-datos.ts / evaluadores-docx.ts en Fase 1).

import { leerPostores, type Postor } from "./postores-seleccion";
import type { HitosMap } from "./procurement-fases";

export type DatosActaBuenaPro = {
  nomenclatura: string;
  fechaOtorgamiento: string;
  ganadorRazonSocial: string;
  montoAdjudicado: number;
  postoresAdmitidos: Postor[];
};

function txt(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// null cuando B7 no está "hecho": no tiene sentido generar el acta de un
// otorgamiento que todavía no ocurrió — el botón de exportar debe estar
// deshabilitado en ese caso (ver Task 6, wiring en fase-panel.tsx).
export function datosActaBuenaPro(nomenclatura: string, hitos: HitosMap): DatosActaBuenaPro | null {
  if (hitos.B7?.status !== "hecho") return null;
  const b7 = (hitos.B7.data ?? {}) as Record<string, unknown>;
  const b2 = (hitos.B2?.data ?? {}) as Record<string, unknown>;

  return {
    fechaOtorgamiento: txt(b7.fecha_otorgamiento),
    ganadorRazonSocial: txt(b7.ganador),
    montoAdjudicado: num(b7.monto_adjudicado),
    nomenclatura,
    postoresAdmitidos: leerPostores(b2.relacion_admitidos).filter((p) => p.admitido),
  };
}
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `npx vitest run tests/buena-pro-docx-datos.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Implementar `lib/buena-pro-docx.ts`**

```ts
// Acta de Otorgamiento de la Buena Pro (B7) en Word.
//
// // VERIFICAR: el texto protocolar exacto (membrete, fórmula de apertura,
// orden de las cláusulas) debe confirmarse contra el formato que la entidad
// ya usa para esta acta, o contra el formato de las bases estándar del OECE
// (ver "Bases_estandar_de_Subasta_inversa_electronica" en el corpus indexado —
// consultar con la skill verificacion-legal-rag antes de dar este documento
// por listo para producción). Lo que sigue es un borrador estructural con las
// MISMAS convenciones tipográficas que lib/evaluadores-docx.ts (Arial 10pt),
// no un formato ya confirmado.

import { AlignmentType, Document, Packer, Paragraph, TextRun } from "docx";
import type { DatosActaBuenaPro } from "./buena-pro-docx-datos";

const FUENTE = "Arial";
const TAM = 20; // 10 pt

function parrafo(texto: string, opts?: { negrita?: boolean; alineacion?: (typeof AlignmentType)[keyof typeof AlignmentType] }): Paragraph {
  return new Paragraph({
    alignment: opts?.alineacion ?? AlignmentType.JUSTIFIED,
    children: [new TextRun({ bold: opts?.negrita, font: FUENTE, size: TAM, text: texto })],
    spacing: { after: 200 },
  });
}

export async function generarActaBuenaPro(datos: DatosActaBuenaPro): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        children: [
          parrafo(`ACTA DE OTORGAMIENTO DE LA BUENA PRO`, { alineacion: AlignmentType.CENTER, negrita: true }),
          parrafo(`Procedimiento de selección: ${datos.nomenclatura}`),
          parrafo(`Fecha de otorgamiento: ${datos.fechaOtorgamiento}`),
          parrafo(
            `El Comité de Selección, en atención a los resultados de la evaluación y calificación de ofertas, ` +
              `otorga la Buena Pro del presente procedimiento a favor de ${datos.ganadorRazonSocial}, ` +
              `por el monto de S/ ${datos.montoAdjudicado.toLocaleString("es-PE")}.`,
          ),
          parrafo(`Postores admitidos:`, { negrita: true }),
          ...datos.postoresAdmitidos.map((p) => parrafo(`- ${p.razonSocial} (RUC ${p.ruc})`)),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}
```

- [ ] **Step 6: Crear la ruta `app/api/processes/[id]/fase2/buena-pro-docx/route.ts`**

```ts
import { NextResponse } from "next/server";
import { idsDeRutaInvalidos, requireCapability } from "@/lib/auth";
import { datosActaBuenaPro } from "@/lib/buena-pro-docx-datos";
import { generarActaBuenaPro } from "@/lib/buena-pro-docx";
import { supabaseUserRest } from "@/lib/supabase-server";
import type { HitosMap } from "@/lib/procurement-fases";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/processes/{id}/fase2/buena-pro-docx → el Acta de Otorgamiento de
// la Buena Pro (B7) en Word. 409 si B7 todavía no está "hecho": no se genera
// el acta de un otorgamiento que no ha ocurrido.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability("expediente.manage");
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const malos = idsDeRutaInvalidos(id);
  if (malos) return malos;

  try {
    const [proceso] = await supabaseUserRest<Array<{ nomenclature: string; hitos: HitosMap | null }>>(
      auth.user.accessToken,
      `procurement_processes?id=eq.${id}&select=nomenclature,hitos`,
    );
    if (!proceso) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });

    const datos = datosActaBuenaPro(proceso.nomenclature, proceso.hitos ?? {});
    if (!datos) {
      return NextResponse.json(
        { error: "El paso B7 (Otorgamiento de la Buena Pro) todavía no está cerrado." },
        { status: 409 },
      );
    }

    const buffer = await generarActaBuenaPro(datos);
    return new NextResponse(buffer, {
      headers: {
        "Content-Disposition": `attachment; filename="Acta-Buena-Pro-${proceso.nomenclature}.docx"`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo generar el acta" },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 7: Typecheck y lint**

Run: `npm run typecheck && npx eslint lib/buena-pro-docx-datos.ts lib/buena-pro-docx.ts app/api/processes/[id]/fase2/buena-pro-docx/route.ts`
Expected: sin errores.

- [ ] **Step 8: Verificar manualmente en el preview**

Con un expediente en B7 "hecho", pedir `GET /api/processes/{id}/fase2/buena-pro-docx` (curl o desde el navegador con sesión) y confirmar que descarga un `.docx` que abre sin error en Word/LibreOffice. Con B7 sin cerrar, confirmar el 409.

- [ ] **Step 9: Commit**

```bash
git add lib/buena-pro-docx-datos.ts lib/buena-pro-docx.ts "app/api/processes/[id]/fase2/buena-pro-docx/route.ts" tests/buena-pro-docx-datos.test.ts
git commit -m "feat(expedientes): genera el Acta de Otorgamiento de la Buena Pro (B7) en Word"
```

- [ ] **Step 10 (antes de dar la Parte 3 por cerrada en producción): resolver los `// VERIFICAR:`**

Confirmar el texto protocolar exacto contra el formato real de la entidad o las bases estándar indexadas (skill `verificacion-legal-rag`), y quitar el comentario una vez confirmado.

---

### Task 6: Botón de descarga del acta en `fase-panel.tsx` (B7)

**Files:**
- Modify: `app/components/fase-panel.tsx` (buscar cómo A9 ofrece su descarga de "Bases" — mismo patrón de botón junto al paso)

**Interfaces:**
- Consumes: nada nuevo — llama a `GET /api/processes/{id}/fase2/buena-pro-docx` (Task 5).

- [ ] **Step 1:** Ubicar el patrón de botón de descarga ya usado para un `docKind` de Fase 1 (buscar `evaluadores-docx` en `fase-panel.tsx` para ver cómo se dispara la descarga — típicamente un `<a href=...>` o un `fetch` + `blob` + `URL.createObjectURL`).
- [ ] **Step 2:** Replicar el mismo patrón para `code === "B7"`, apuntando a `/api/processes/${processId}/fase2/buena-pro-docx`, deshabilitado mientras `hitos.B7?.status !== "hecho"` (mismo criterio que el 409 del backend, para no dejar clickear un botón que va a fallar).
- [ ] **Step 3:** Verificar manualmente: el botón descarga el acta cuando B7 está "hecho", y aparece deshabilitado (o no aparece) cuando no lo está.
- [ ] **Step 4:** `npm run typecheck && npx eslint app/components/fase-panel.tsx`.
- [ ] **Step 5:** Commit: `feat(expedientes): botón para descargar el Acta de Buena Pro desde B7`.

---

### Tasks 7-9: Documentos restantes (mismo patrón que Task 5+6)

Se listan para completar la Parte 3, siguiendo EXACTAMENTE el molde de los Tasks 5 y 6 (datos puros testeados + composición `docx` + ruta `fase2/<doc>` + botón). Cada uno es su propio task/commit — no se agrupan.

- [ ] **Task 7 — Convocatoria (B1).** `lib/convocatoria-docx-datos.ts` + `lib/convocatoria-docx.ts` + `app/api/processes/[id]/fase2/convocatoria-docx/route.ts`. Datos desde `hitos.B1` (`fecha_convocatoria`, `numero_convocatoria`, `plazo_presentacion`) + `nomenclature`/`object_type`/`amount` del expediente. `// VERIFICAR` el formato exacto del aviso de convocatoria contra PLADICOP/bases estándar antes de producción.
- [ ] **Task 8 — Declaración de Consentimiento de la Buena Pro (B8).** `lib/consentimiento-docx-datos.ts` + `lib/consentimiento-docx.ts` + `app/api/processes/[id]/fase2/consentimiento-docx/route.ts`. `datosConsentimiento()` devuelve `null` si B8 no está "hecho" (mismo criterio que Task 5). Incluye `hubo_impugnacion`/`resultado_impugnacion` de `hitos.B8.data` cuando corresponda — Art. 82.2 (la excepción de oferta única) debe reflejarse en el texto si `postoresAdmitidos.length === 1` (dato ya disponible vía `datosActaBuenaPro`/`leerPostores`, reusar en vez de recalcular).
- [ ] **Task 9 — Botones de descarga de B1 y B8 en `fase-panel.tsx`.** Mismo patrón que el Task 6, para los dos documentos del Task 7 y el Task 8.

---

## Orden de ejecución sugerido

1. Task 1 → Task 2 (Parte 1 completa: es la más chica y no depende de nada más).
2. Task 3 → Task 4 (Parte 2: cada uno es independiente del otro, pueden ir en paralelo si hay dos agentes).
3. Task 5 → Task 6 (Parte 3, B7): depende del Task 3 (usa `postores-seleccion.ts` para listar admitidos en el acta) — hacerlo después de ese, no hace falta esperar al Task 4.
4. Task 7, Task 8, Task 9: independientes entre sí una vez cerrada la Parte 2.

Cada Parte deja el expediente en un estado mejor y funcionando por sí sola — no hace falta terminar las tres para que la Parte 1 (o la 2) ya aporte valor real.
