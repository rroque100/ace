# Capacitación del personal clave — Plan de implementación

> **For agentic workers:** los pasos usan casillas (`- [ ]`) para seguimiento. Cada tarea termina en
> algo probado y commiteable por separado. TDD donde el suite lo permite (Node); las tareas de UI
> llevan verificación manual en el preview del entorno.

**Goal:** añadir «Capacitación del personal clave» como un cuadro repetible dentro de los requisitos
de calificación, justo tras «Formación académica», con su texto de requisito autocompuesto y su
salida al Word.

**Architecture:** análogo casi exacto de Formación académica. Módulo puro reversible en `lib/` +
editor cuadro que hereda filas del cuadro de experiencia + columna oculta en el catálogo + tabla en
el `.docx`. Ver el spec: `docs/superpowers/specs/2026-07-28-capacitacion-personal-clave-design.md`.

**Tech Stack:** Next.js 16 / React 19 / TypeScript, Vitest (`environment: "node"`), `docx`.

## Global Constraints

- Código, comentarios y commits en **español**; el asunto del commit describe el síntoma del
  usuario, en minúscula y **sin acentos** (Conventional Commits con scope).
- Comentarios explican el **porqué**, no el qué.
- El suite **no renderiza React** (`tests/**/*.test.ts`, solo `.ts`): las tareas de UI se verifican
  a mano en el preview, no con test automático.
- Las columnas de la ficha se **derivan** del catálogo (`columnasSelect`/`construirColumnas`): al
  añadir un `FichaField` con su `col`, el GET y el PATCH la recogen solos.
- Una columna nueva **no existe hasta correr el SQL** de `docs/supabase/`: hay que entregarlo y
  decirlo explícitamente.
- Verificación por tarea (las que tocan `.ts`): `npx tsc --noEmit`, `npx eslint app lib`,
  `npx vitest run`.
- El literal de acreditación (`ACREDITACION_CAPACITACION`) es una **entrada externa pendiente**: se
  deja el marcador `[PENDIENTE…]` y el usuario lo pasa después.

## File Structure

- `lib/capacitacion-personal-clave.ts` — **crear**. Módulo puro: tipos, huecos, composición,
  parse/format reversible, incompletas, corte de 120 horas, constante de acreditación.
- `tests/necesidad-capacitacion-personal-clave.test.ts` — **crear**. Cubre el módulo puro.
- `lib/necesidad-ficha-secciones.ts` — **modificar**. `kind` nuevo + dos `FichaField` ocultos.
- `lib/necesidades.ts` — **modificar**. Dos filas del tipo `Necesidad` + dos campos del schema.
- `lib/necesidades-limites.ts` — **modificar**. Dos topes de texto.
- `docs/supabase/2026-07-28-capacitacion-personal-clave.sql` — **crear**. Dos columnas.
- `app/components/capacitacion-personal-clave-editor.tsx` — **crear**. Editor cuadro.
- `app/components/requisitos-calificacion-editor.tsx` — **modificar**. Render + props.
- `app/components/necesidad/campo-ficha.tsx` — **modificar**. Passthrough de dos props.
- `lib/requerimiento-estructura.ts` — **modificar**. `formatoDe` + `soloEnDocumento` + union.
- `lib/requerimiento-docx.ts` — **modificar**. Tabla + consumo del formato.
- `tests/requerimiento-capacitacion.test.ts` — **crear**. Estructura del Word.

---

### Task 1: Módulo puro `lib/capacitacion-personal-clave.ts`

**Files:**
- Create: `lib/capacitacion-personal-clave.ts`
- Test: `tests/necesidad-capacitacion-personal-clave.test.ts`

**Interfaces:**
- Produces: `FilaCapacitacion = { actividad: string; horas: string; materia: string; puesto: string }`,
  `FILA_CAPACITACION_VACIA`, `componerRequisitoCapacitacion(f: Partial<FilaCapacitacion>): string`,
  `parseFilasCapacitacion(t: string|null|undefined): FilaCapacitacion[]`,
  `formatFilasCapacitacion(f: FilaCapacitacion[]): string`,
  `capacitacionIncompletas(f: FilaCapacitacion[]): number[]`,
  `capacitacionExcedeHoras(f: FilaCapacitacion[]): number[]`, `ACREDITACION_CAPACITACION: string`.

- [ ] **Step 1: Escribir el test que falla** — `tests/necesidad-capacitacion-personal-clave.test.ts`

```ts
import { describe, expect, it } from "vitest";
import {
  type FilaCapacitacion,
  capacitacionExcedeHoras,
  capacitacionIncompletas,
  componerRequisitoCapacitacion,
  formatFilasCapacitacion,
  parseFilasCapacitacion,
} from "@/lib/capacitacion-personal-clave";

const fila = (extra: Partial<FilaCapacitacion>): FilaCapacitacion => ({
  actividad: "",
  horas: "",
  materia: "",
  puesto: "",
  ...extra,
});

describe("componerRequisitoCapacitacion", () => {
  it("compone con los tres datos", () => {
    expect(
      componerRequisitoCapacitacion({ horas: "40", materia: "seguridad de obra", puesto: "residente" }),
    ).toBe("40 horas en seguridad de obra del personal clave requerido como residente.");
  });

  it("pone los huecos en mayusculas cuando falta un dato", () => {
    const t = componerRequisitoCapacitacion({ horas: "40" });
    expect(t).toContain("40 horas en [CONSIGNAR LA MATERIA");
    expect(t).toContain("del personal clave requerido como [CONSIGNAR EL PERSONAL CLAVE");
  });
});

describe("parse/format reversibles", () => {
  it("format y luego parse devuelve las filas con contenido", () => {
    const filas = [
      fila({ actividad: "Supervision", horas: "24", materia: "BIM", puesto: "residente" }),
      fila({ actividad: "Calidad", horas: "12", materia: "ISO 9001", puesto: "especialista" }),
    ];
    expect(parseFilasCapacitacion(formatFilasCapacitacion(filas))).toEqual(filas);
  });

  it("una fila vacia no se serializa", () => {
    expect(formatFilasCapacitacion([fila({})])).toBe("");
  });
});

describe("capacitacionIncompletas", () => {
  it("marca la fila a la que le falta horas, materia o puesto (la actividad no cuenta)", () => {
    const filas = [
      fila({ actividad: "A", horas: "40", materia: "X", puesto: "P" }), // completa
      fila({ actividad: "B", horas: "40" }), // incompleta
    ];
    expect(capacitacionIncompletas(filas)).toEqual([2]);
  });
});

describe("capacitacionExcedeHoras", () => {
  it("corta en 120: 120 no excede, 121 si, no-numerico no cuenta", () => {
    const filas = [
      fila({ horas: "120", materia: "X", puesto: "P" }),
      fila({ horas: "121", materia: "X", puesto: "P" }),
      fila({ horas: "muchas", materia: "X", puesto: "P" }),
    ];
    expect(capacitacionExcedeHoras(filas)).toEqual([2]);
  });
});
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npx vitest run tests/necesidad-capacitacion-personal-clave.test.ts`
Expected: FAIL (módulo no existe).

- [ ] **Step 3: Implementar el módulo** — `lib/capacitacion-personal-clave.ts`

```ts
/**
 * Calificaciones del personal clave · CAPACITACION (Art. 72.3.b).
 *
 * Puede exigirse a VARIOS puestos, cada uno con sus horas y su materia. Por eso
 * es una LISTA, no un texto suelto, y en el requerimiento sale como un cuadro. El
 * texto de cada requisito se compone con las horas, la materia y el puesto de su
 * fila. Se guarda serializado en una sola columna, con parse/format reversibles,
 * igual que Formacion academica.
 */

/**
 * Como se acredita la capacitacion del personal clave, texto literal del formato
 * OECE. ENTRADA EXTERNA: lo pasa el usuario. Hasta entonces, un marcador visible
 * para no fabricar texto legal.
 */
export const ACREDITACION_CAPACITACION =
  "[PENDIENTE: pegar aqui el texto de acreditacion de la capacitacion del personal clave del formato OECE]";

const HUECO_HORAS = "CONSIGNAR LA CANTIDAD DE HORAS, HASTA UN MAXIMO DE 120";
const HUECO_MATERIA =
  "CONSIGNAR LA MATERIA O AREA DE CAPACITACION, LA CUAL DEBE ESTAR ESPECIFICAMENTE RELACIONADA CON " +
  "LAS ACTIVIDADES QUE REALIZARA EL PERSONAL CLAVE";
const HUECO_PUESTO =
  "CONSIGNAR EL PERSONAL CLAVE REQUERIDO PARA EJECUTAR LA PRESTACION OBJETO DE LA CONVOCATORIA " +
  "RESPECTO DEL CUAL SE DEBE ACREDITAR ESTE REQUISITO";

const CONECTOR = " del personal clave requerido como ";

export type FilaCapacitacion = {
  /** Actividad. Se hereda del cuadro de experiencia del personal clave. */
  actividad: string;
  /** Cantidad de horas de capacitacion (hasta 120). */
  horas: string;
  /** Materia o area de la capacitacion. */
  materia: string;
  /** Puesto del personal clave del que debe acreditarse. */
  puesto: string;
};

export const FILA_CAPACITACION_VACIA: FilaCapacitacion = { actividad: "", horas: "", materia: "", puesto: "" };

function hueco(valor: string, textoOriginal: string): string {
  return valor.trim() || `[${textoOriginal}]`;
}

/** El texto del requisito de UNA fila. */
export function componerRequisitoCapacitacion(f: Partial<FilaCapacitacion>): string {
  return `${hueco(f.horas ?? "", HUECO_HORAS)} horas en ${hueco(f.materia ?? "", HUECO_MATERIA)}${CONECTOR}${hueco(
    f.puesto ?? "",
    HUECO_PUESTO,
  )}.`;
}

// Etiquetas explicitas: son textos libres que pueden traer guiones o puntos, y
// asi la linea se sigue leyendo si alguien abre la columna a mano.
const LINEA =
  /^\s*\d+\.\s*Actividad:\s*(.*?)\s*·\s*Horas:\s*(.*?)\s*·\s*Materia:\s*(.*?)\s*·\s*Puesto:\s*(.*?)\s*$/;

function algoEscrito(f: FilaCapacitacion): boolean {
  return Boolean(f.actividad.trim() || f.horas.trim() || f.materia.trim() || f.puesto.trim());
}

export function parseFilasCapacitacion(texto: string | null | undefined): FilaCapacitacion[] {
  if (!texto) return [];
  const salida: FilaCapacitacion[] = [];
  for (const linea of texto.split(/\r?\n/)) {
    const m = linea.match(LINEA);
    if (!m) continue;
    const fila = { actividad: m[1].trim(), horas: m[2].trim(), materia: m[3].trim(), puesto: m[4].trim() };
    if (algoEscrito(fila)) salida.push(fila);
  }
  return salida;
}

/** Operacion inversa de `parseFilasCapacitacion`. El par debe seguir siendo reversible. */
export function formatFilasCapacitacion(filas: FilaCapacitacion[]): string {
  const utiles = filas.filter(algoEscrito);
  if (utiles.length === 0) return "";
  const g = (v: string) => v.trim() || "[POR DEFINIR]";
  return utiles
    .map(
      (f, k) =>
        `${k + 1}. Actividad: ${g(f.actividad)} · Horas: ${g(f.horas)} · Materia: ${g(f.materia)} · Puesto: ${g(
          f.puesto,
        )}`,
    )
    .join("\n");
}

/** Filas a medio declarar: falta horas, materia o puesto (la actividad viene heredada). */
export function capacitacionIncompletas(filas: FilaCapacitacion[]): number[] {
  return filas
    .map((f, i) => (algoEscrito(f) && !(f.horas.trim() && f.materia.trim() && f.puesto.trim()) ? i + 1 : 0))
    .filter((n) => n > 0);
}

/** Filas cuyas horas superan el tope de 120 del formato. Alimenta el aviso suave. */
export function capacitacionExcedeHoras(filas: FilaCapacitacion[]): number[] {
  return filas
    .map((f, i) => {
      const n = Number(f.horas);
      return Number.isFinite(n) && n > 120 ? i + 1 : 0;
    })
    .filter((n) => n > 0);
}
```

Nota: los tests comparan contra huecos SIN acentos (`[CONSIGNAR LA MATERIA`, `[CONSIGNAR EL PERSONAL
CLAVE`), que es como quedan las constantes arriba. Si al pegar el literal definitivo se decide poner
acentos, actualizar también el `toContain` del test.

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `npx vitest run tests/necesidad-capacitacion-personal-clave.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/capacitacion-personal-clave.ts tests/necesidad-capacitacion-personal-clave.test.ts
git commit -m "feat(necesidades): calificaciones del personal clave · capacitacion (modulo y composicion)"
```

---

### Task 2: Catálogo, tipo, esquema, límites y SQL

**Files:**
- Modify: `lib/necesidad-ficha-secciones.ts:28` (union `FichaFieldKind`) y `:569` (tras el campo de
  acreditación de formación).
- Modify: `lib/necesidades.ts:133` (tipo) y `:312` (schema).
- Modify: `lib/necesidades-limites.ts:124`.
- Create: `docs/supabase/2026-07-28-capacitacion-personal-clave.sql`.

**Interfaces:**
- Consumes: nada (independiente de Task 1 salvo el nombre de las columnas/apis).
- Produces: columnas `capacitacion_personal_clave`, `capacitacion_personal_clave_acreditacion` y sus
  apis `capacitacionPersonalClave`, `capacitacionPersonalClaveAcreditacion`; `kind: "capacitacion"`.

- [ ] **Step 1: Añadir el `kind` a la unión** — `lib/necesidad-ficha-secciones.ts:28`

Reemplazar `"formacionAcademica" | "subcontratacion"` por
`"formacionAcademica" | "capacitacion" | "subcontratacion"` en `FichaFieldKind`.

- [ ] **Step 2: Añadir los dos `FichaField`** — `lib/necesidad-ficha-secciones.ts`, justo después
  del campo `formacion_academica_acreditacion` (hoy en `:569`), dentro de la sección
  «3.5.1 Requisitos de calificación obligatorios»:

```ts
      // CALIFICACIONES DEL PERSONAL CLAVE · Capacitacion (Art. 72.3.b). Requisito
      // con tres huecos —horas, materia y puesto— que se compone
      // (lib/capacitacion-personal-clave.ts). Oculto —lo pinta el editor— pero SI
      // al documento; ver la excepcion en requerimiento-estructura.ts.
      { col: "capacitacion_personal_clave", api: "capacitacionPersonalClave", label: "Capacitacion del personal clave", oculto: true, kind: "capacitacion", baseLegal: "Art. 72.3.b Reglamento · un requisito por fila (horas + materia + puesto). El tope es 120 horas.", ejemplo: "40 horas en seguridad de obra · Ingeniero residente" },
      // Como se acredita la capacitacion: texto fijo del formato (Anexo N° 19).
      // Oculto —lo pinta el editor, tras el cuadro— pero SI al documento.
      { col: "capacitacion_personal_clave_acreditacion", api: "capacitacionPersonalClaveAcreditacion", label: "Acreditacion de la capacitacion", oculto: true, kind: "textarea", baseLegal: "Art. 72.3.b Reglamento · forma de acreditar la capacitacion del personal clave (Anexo N° 19)." },
```

- [ ] **Step 3: Tipo `Necesidad`** — `lib/necesidades.ts`, tras `formacion_academica_acreditacion`
  (hoy `:133`):

```ts
  capacitacion_personal_clave: string | null;
  capacitacion_personal_clave_acreditacion: string | null;
```

- [ ] **Step 4: Schema** — `lib/necesidades.ts`, en `necesidadUpdateSchema`, tras
  `formacionAcademicaAcreditacion` (hoy `:312`):

```ts
  capacitacionPersonalClave: optionalText(3000),
  capacitacionPersonalClaveAcreditacion: optionalText(2000),
```

- [ ] **Step 5: Límites** — `lib/necesidades-limites.ts`, tras `formacionAcademicaAcreditacion`
  (hoy `:124`):

```ts
  capacitacionPersonalClave: 3000,
  capacitacionPersonalClaveAcreditacion: 2000,
```

- [ ] **Step 6: SQL** — `docs/supabase/2026-07-28-capacitacion-personal-clave.sql`:

```sql
-- Capacitacion del personal clave (Art. 72.3.b) en los requisitos de calificacion.
-- Dos columnas nuevas en `necesidades`: el cuadro serializado y su texto de
-- acreditacion. Espeja lo que ya existe para `formacion_academica`.
-- La tabla esta particionada por anio; ALTER TABLE sobre la tabla padre alcanza
-- las particiones (igual que la tanda de formacion academica).
alter table public.necesidades
  add column if not exists capacitacion_personal_clave text,
  add column if not exists capacitacion_personal_clave_acreditacion text;
```

- [ ] **Step 7: Verificar** — hay tests de paridad esquema↔columnas y de select completo que
  recorren `FICHA_SECCIONES`:

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS (los tests de columnas/select ya cubren los campos nuevos por recorrer el catálogo;
si alguno enumera columnas a mano, actualizarlo con las dos nuevas).

- [ ] **Step 8: Commit**

```bash
git add lib/necesidad-ficha-secciones.ts lib/necesidades.ts lib/necesidades-limites.ts docs/supabase/2026-07-28-capacitacion-personal-clave.sql
git commit -m "feat(necesidades): la capacitacion del personal clave se guarda y viaja en la ficha"
```

---

### Task 3: Editor cuadro y su cableado en la ficha (UI)

**Files:**
- Create: `app/components/capacitacion-personal-clave-editor.tsx`
- Modify: `app/components/requisitos-calificacion-editor.tsx` (imports; props `:80`; render tras `:469`)
- Modify: `app/components/necesidad/campo-ficha.tsx` (tipo props `:82`; destructura `:131`; pasa `:314`)

**Interfaces:**
- Consumes: de Task 1 `FilaCapacitacion`, `componerRequisitoCapacitacion`, `formatFilasCapacitacion`,
  `parseFilasCapacitacion`, `capacitacionIncompletas`, `capacitacionExcedeHoras`,
  `ACREDITACION_CAPACITACION`; de Task 2 los apis `capacitacionPersonalClave` /
  `capacitacionPersonalClaveAcreditacion`.

- [ ] **Step 1: Crear el editor** — `app/components/capacitacion-personal-clave-editor.tsx`. Es el
  gemelo de `formacion-academica-editor.tsx`: hereda una fila por actividad del cuadro de
  experiencia; por fila edita Horas / Materia / Puesto; la columna «Requisito» se compone sola;
  aviso suave si alguna fila supera 120 horas.

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  type FilaCapacitacion,
  capacitacionExcedeHoras,
  capacitacionIncompletas,
  componerRequisitoCapacitacion,
  formatFilasCapacitacion,
  parseFilasCapacitacion,
} from "@/lib/capacitacion-personal-clave";

/**
 * Cuadro de capacitacion del personal clave (Art. 72.3.b). Las filas se HEREDAN
 * del cuadro de «Experiencia del personal clave»: una por actividad, en el mismo
 * orden. Aqui solo se completan horas, materia y puesto; la columna «Requisito»
 * se redacta sola. Sin actividades heredadas, se muestran las filas guardadas.
 */
export function CapacitacionPersonalClaveEditor({
  value,
  onChange,
  readOnly = false,
  actividades,
}: {
  value: string;
  onChange: (next: string) => void;
  readOnly?: boolean;
  actividades: string[];
}) {
  function fusionar(guardadas: FilaCapacitacion[]): FilaCapacitacion[] {
    if (actividades.length === 0) return guardadas;
    return actividades.map((actividad, i) => ({
      actividad,
      horas: guardadas[i]?.horas ?? "",
      materia: guardadas[i]?.materia ?? "",
      puesto: guardadas[i]?.puesto ?? "",
    }));
  }

  const [filas, setFilas] = useState<FilaCapacitacion[]>(() => fusionar(parseFilasCapacitacion(value)));
  const emitido = useRef(value);
  useEffect(() => {
    if (value !== emitido.current) {
      setFilas(fusionar(parseFilasCapacitacion(value)));
      emitido.current = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const actKey = actividades.join("");
  const actRef = useRef(actKey);
  useEffect(() => {
    if (actKey === actRef.current) return;
    actRef.current = actKey;
    setFilas((prev) => fusionar(prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actKey]);

  function editar(i: number, cambio: Partial<FilaCapacitacion>) {
    if (readOnly) return;
    const next = filas.map((f, k) => (k === i ? { ...f, ...cambio } : f));
    setFilas(next);
    const texto = formatFilasCapacitacion(next);
    emitido.current = texto;
    onChange(texto);
  }

  const incompletas = capacitacionIncompletas(filas);
  const excede = capacitacionExcedeHoras(filas);
  const celda =
    "w-full rounded-md border border-line bg-panel px-2 py-1 text-[12.5px] leading-relaxed text-ink " +
    "outline-none focus:border-brand focus:shadow-[var(--shadow-focus)]";

  if (filas.length === 0) {
    return (
      <p className="m-0 text-[12px] leading-[1.5] text-muted">
        Agrega puestos en el cuadro de «Experiencia del personal clave» de arriba y aqui aparecera una fila por cada
        uno para completar su capacitacion.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="overflow-x-auto rounded-[10px] border border-line">
        <table className="w-full border-collapse text-[12.5px] [&_th]:border-b [&_th]:border-line [&_th]:px-2.5 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold [&_th]:text-muted [&_td]:border-b [&_td]:border-line [&_td]:px-2.5 [&_td]:py-1.5 [&_td]:align-top [&_tr:last-child_td]:border-b-0">
          <thead>
            <tr>
              <th scope="col">N.º</th>
              <th scope="col">Actividad</th>
              <th scope="col">Horas</th>
              <th scope="col">Materia o area de capacitacion</th>
              <th scope="col">Personal clave del cual acreditar el requisito</th>
              <th scope="col">Requisito</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((fila, i) => (
              <tr key={i}>
                <td className="text-muted tabular-nums">{i + 1}</td>
                <td className="min-w-[120px] text-muted">{fila.actividad || <span className="italic">—</span>}</td>
                <td className="min-w-[70px]">
                  <input
                    aria-label={`Horas de capacitacion ${i + 1}`}
                    className={celda}
                    disabled={readOnly}
                    inputMode="numeric"
                    onChange={(e) => editar(i, { horas: e.target.value })}
                    placeholder="40"
                    value={fila.horas}
                  />
                </td>
                <td className="min-w-[170px]">
                  <textarea
                    aria-label={`Materia de capacitacion ${i + 1}`}
                    className={celda}
                    disabled={readOnly}
                    onChange={(e) => editar(i, { materia: e.target.value })}
                    placeholder="Seguridad y salud en obra"
                    rows={2}
                    value={fila.materia}
                  />
                </td>
                <td className="min-w-[150px]">
                  <textarea
                    aria-label={`Personal clave del cual acreditar ${i + 1}`}
                    className={celda}
                    disabled={readOnly}
                    onChange={(e) => editar(i, { puesto: e.target.value })}
                    placeholder="Ingeniero residente"
                    rows={2}
                    value={fila.puesto}
                  />
                </td>
                <td className="min-w-[190px] text-muted">{componerRequisitoCapacitacion(fila)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {incompletas.length > 0 ? (
        <p className="m-0 flex items-start gap-1.5 text-[11.5px] leading-[1.45] text-warning" role="status">
          <AlertTriangle aria-hidden className="mt-0.5 shrink-0" size={12} />
          <span>
            {incompletas.length === 1
              ? `Al requisito ${incompletas[0]} le faltan horas, materia o puesto.`
              : `A los requisitos ${incompletas.join(", ")} les faltan horas, materia o puesto.`}
          </span>
        </p>
      ) : null}
      {excede.length > 0 ? (
        <p className="m-0 flex items-start gap-1.5 text-[11.5px] leading-[1.45] text-warning" role="status">
          <AlertTriangle aria-hidden className="mt-0.5 shrink-0" size={12} />
          <span>
            {excede.length === 1
              ? `El requisito ${excede[0]} supera el maximo de 120 horas del formato.`
              : `Los requisitos ${excede.join(", ")} superan el maximo de 120 horas del formato.`}
          </span>
        </p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Cablear en `requisitos-calificacion-editor.tsx`.** Imports (junto a los de
  formación, `:27` y `:29`):

```ts
import { ACREDITACION_CAPACITACION } from "@/lib/capacitacion-personal-clave";
import { CapacitacionPersonalClaveEditor } from "./capacitacion-personal-clave-editor";
```

Props del componente (junto a `formacionAcademica`, `:80`/`:82`):

```ts
  capacitacionPersonalClave?: string;
  capacitacionPersonalClaveAcreditacion?: string;
```

y añadirlos a la desestructuración de props (junto a `formacionAcademica`, `:59`/`:60`).

Render: **después** del `</label>` de la acreditación de formación (hoy `:469`) y antes del `</div>`
que cierra el bloque (`:470`):

```tsx
                  {/* CALIFICACIONES DEL PERSONAL CLAVE · Capacitacion (Art. 72.3.b).
                      Un puesto por fila; el requisito se redacta con horas, materia
                      y puesto de su fila. Tope de 120 horas (aviso suave). */}
                  <p className="reqCalPersonalClaveTitulo">Capacitacion del personal clave</p>
                  <p className="reqCalPersonalClaveAyuda">
                    Horas (maximo 120), materia relacionada con la actividad y el puesto del que se acredita.
                  </p>
                  <CapacitacionPersonalClaveEditor
                    actividades={parsePersonalClave(personalClaveExperiencia ?? "").map((f) => f.actividad)}
                    onChange={(next) => onCampoFicha("capacitacionPersonalClave", next)}
                    readOnly={readOnly}
                    value={capacitacionPersonalClave ?? ""}
                  />
                  <label className="reqCalCampo">
                    <span className="reqCalSpanConBoton">
                      ¿Como se acredita la capacitacion?
                      <button
                        className="reqCalRedactar"
                        disabled={readOnly}
                        onClick={() => onCampoFicha("capacitacionPersonalClaveAcreditacion", ACREDITACION_CAPACITACION)}
                        title="Rellenar con el texto estandar del formato (Anexo N° 19)"
                        type="button"
                      >
                        <Sparkles size={12} /> Redactar con IA
                      </button>
                    </span>
                    <textarea
                      disabled={readOnly}
                      onChange={(ev) => onCampoFicha("capacitacionPersonalClaveAcreditacion", ev.target.value)}
                      placeholder="Pulsa «Redactar con IA» para el texto estandar (Anexo N° 19)."
                      rows={filasTextarea(capacitacionPersonalClaveAcreditacion ?? "", true)}
                      value={capacitacionPersonalClaveAcreditacion ?? ""}
                    />
                  </label>
```

- [ ] **Step 3: Passthrough en `campo-ficha.tsx`.** Añadir al tipo de props (junto a
  `formacionAcademicaAcreditacion`, `:80`/`:82`):

```ts
  capacitacionPersonalClave: string;
  capacitacionPersonalClaveAcreditacion: string;
```

Desestructurar (junto a `formacionAcademica`, `:130`/`:131`) y pasar a
`<RequisitosCalificacionEditor>` (junto a `:313`/`:314`):

```tsx
          capacitacionPersonalClave={capacitacionPersonalClave}
          capacitacionPersonalClaveAcreditacion={capacitacionPersonalClaveAcreditacion}
```

Comprobar de dónde saca `campo-ficha` los valores por api (el mismo mecanismo con el que ya obtiene
`formacionAcademica`) y alimentar los dos nuevos igual.

- [ ] **Step 4: Verificar en el preview.** `npx tsc --noEmit && npx eslint app lib`. Luego levantar
  el preview del entorno, abrir una necesidad de servicios/obras con personal clave, y comprobar:
  (a) tras «Formación académica» aparece «Capacitación del personal clave» con una fila por actividad
  del cuadro de experiencia; (b) al escribir horas/materia/puesto, la columna «Requisito» compone el
  texto; (c) horas > 120 muestra el aviso; (d) «Redactar con IA» rellena la acreditación; (e) se
  guarda y al recargar persiste. Capturar pantalla para el usuario.

- [ ] **Step 5: Commit**

```bash
git add app/components/capacitacion-personal-clave-editor.tsx app/components/requisitos-calificacion-editor.tsx app/components/necesidad/campo-ficha.tsx
git commit -m "feat(necesidades): el area usuaria registra la capacitacion del personal clave en la ficha"
```

---

### Task 4: Salida al Word

**Files:**
- Modify: `lib/requerimiento-estructura.ts` (union `:21`; `formatoDe` `:64`; `soloEnDocumento` `:137`)
- Modify: `lib/requerimiento-docx.ts` (import `:25`; función tras `tablaFormacion` `:285`; consumo `:365`)
- Create: `tests/requerimiento-capacitacion.test.ts`

**Interfaces:**
- Consumes: de Task 1 `parseFilasCapacitacion`, `componerRequisitoCapacitacion`; de Task 2 el
  `kind: "capacitacion"` y el api `capacitacionPersonalClaveAcreditacion`.

- [ ] **Step 1: Test que falla** — `tests/requerimiento-capacitacion.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { estructuraDelRequerimiento } from "@/lib/requerimiento-estructura";
import { formatFilasCapacitacion } from "@/lib/capacitacion-personal-clave";

describe("la capacitacion del personal clave entra en el requerimiento", () => {
  it("el campo del cuadro sale con formato tablaCapacitacion", () => {
    const ficha: Record<string, string> = {
      capacitacionPersonalClave: formatFilasCapacitacion([
        { actividad: "Supervision", horas: "40", materia: "BIM", puesto: "residente" },
      ]),
    };
    const secciones = estructuraDelRequerimiento([], ficha);
    const campos = secciones.flatMap((s) => s.campos);
    const cuadro = campos.find((c) => c.api === "capacitacionPersonalClave");
    expect(cuadro?.formato).toBe("tablaCapacitacion");
  });
});
```

Run: `npx vitest run tests/requerimiento-capacitacion.test.ts` → FAIL (formato `linea`/ausente).

- [ ] **Step 2: `formatoDe` y la unión** — `lib/requerimiento-estructura.ts`. En `FormatoCampo`
  (`:21`) añadir `| "tablaCapacitacion"`. En `formatoDe` (tras `:64`):

```ts
  if (field.kind === "capacitacion") return "tablaCapacitacion";
```

- [ ] **Step 3: Dejar pasar los ocultos al documento** — `lib/requerimiento-estructura.ts`, en
  `soloEnDocumento` (`:133-137`), añadir dos condiciones:

```ts
        field.kind === "capacitacion" ||
        field.api === "capacitacionPersonalClaveAcreditacion" ||
```

- [ ] **Step 4: Verificar que el test de estructura pasa**

Run: `npx vitest run tests/requerimiento-capacitacion.test.ts` → PASS.

- [ ] **Step 5: Tabla en el docx** — `lib/requerimiento-docx.ts`. Import (junto a `:25`):

```ts
import { componerRequisitoCapacitacion, parseFilasCapacitacion } from "./capacitacion-personal-clave";
```

Función nueva tras `tablaFormacion` (tras `:285`):

```ts
function tablaCapacitacion(filas: ReturnType<typeof parseFilasCapacitacion>): Table {
  const cabecera = new TableRow({
    children: [
      celda("N°", { ancho: 4, bold: true }),
      celda("Actividad", { ancho: 14, bold: true }),
      celda("Horas", { ancho: 7, bold: true }),
      celda("Materia o area de capacitacion", { ancho: 24, bold: true }),
      celda("Personal clave del cual acreditar el requisito", { ancho: 22, bold: true }),
      celda("Requisito", { ancho: 29, bold: true }),
    ],
    tableHeader: true,
  });
  return new Table({
    rows: [
      cabecera,
      ...filas.map((f, i) =>
        new TableRow({
          children: [
            celda(String(i + 1)),
            celda(f.actividad ?? ""),
            celda(f.horas ?? ""),
            celda(f.materia ?? ""),
            celda(f.puesto ?? ""),
            celda(componerRequisitoCapacitacion(f)),
          ],
        }),
      ),
    ],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}
```

Consumo, junto al de `tablaFormacion` (`:363-365`):

```ts
  if (c.formato === "tablaCapacitacion") {
    const filas = parseFilasCapacitacion(c.valor);
    return filas.length > 0 ? [tablaCapacitacion(filas)] : [contenido(c.valor)];
  }
```

- [ ] **Step 6: Verificar todo**

Run: `npx tsc --noEmit && npx eslint app lib && npx vitest run`
Expected: PASS. Opcional: descargar el «Requerimiento (Word)» de una necesidad con capacitación y
comprobar que la tabla aparece tras la de formación.

- [ ] **Step 7: Commit**

```bash
git add lib/requerimiento-estructura.ts lib/requerimiento-docx.ts tests/requerimiento-capacitacion.test.ts
git commit -m "feat(necesidades): el Word del requerimiento lleva el cuadro de capacitacion del personal clave"
```

---

## Self-Review

- **Cobertura del spec:** §1 módulo → Task 1; §2 datos/esquema/SQL → Task 2; §3 UI → Task 3; §4 Word
  → Task 4; §5 herencia de actividad → Task 3 (mismo mecanismo que formación, `parsePersonalClave`);
  §6 tests → Tasks 1 y 4; §7 acreditación pendiente → constante marcador en Task 1. Sin huecos.
- **Placeholders:** ninguno salvo `ACREDITACION_CAPACITACION`, que es una entrada externa declarada
  en el spec, no un TODO de implementación.
- **Consistencia de tipos:** `FilaCapacitacion` y las firmas usadas en Tasks 3 y 4 coinciden con las
  producidas en Task 1; apis `capacitacionPersonalClave` / `capacitacionPersonalClaveAcreditacion`
  idénticos en catálogo, schema, límites, editor, passthrough y docx.

## Riesgos / a confirmar durante la ejecución

- **Tests de paridad columnas↔schema** (`necesidad-select*`, `necesidad-columnas`): si alguno lista
  columnas a mano, hay que sumar las dos nuevas (Task 2, Step 7).
- **`campo-ficha.tsx`**: confirmar la vía por la que recibe los valores por api (para alimentar los
  dos nuevos igual que `formacionAcademica`); el plan asume el mismo mecanismo, verificar al abrir.
- **Herencia de actividad**: si el número de filas de capacitación debe seguir EXACTO al de
  experiencia aun sin guardar, ya lo cubre `fusionar` (idéntico a formación).
