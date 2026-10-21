# Formato oficial del .docx de Bases (A9) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el `.docx` de Bases (A9) tenga portada, encabezados con estilo real de Word, una tabla para Factores de evaluación (arreglando de paso el bug que le impedía resolverse) y pie de página con numeración — en vez del borrador de texto plano actual. Aplica a **todos** los tipos de procedimiento, porque `lib/bases-docx.ts` es genérico.

**Architecture:** Dos cambios independientes. (1) `lib/bases-elaboracion.ts`: `resolverBases()` gana la capacidad de exponer `filas` cuando el campoHito es un array real (hoy, `factores_items`), sin cambiar la forma de `valor` (sigue siendo string, así que ningún consumidor existente se rompe). (2) `lib/bases-docx.ts`: reescritura de la composición con `docx` — página A4 con márgenes, portada con salto de página, estilos `Heading1`/`Heading2` reales para los encabezados detectados, párrafos multilínea partidos en vez de aplastados, tabla de 2 columnas para campos con `filas`, pie de página con "Página X de Y".

**Tech Stack:** TypeScript, librería `docx` (ya en uso), Vitest.

## Global Constraints

- Código, comentarios y commits en español (CLAUDE.md).
- No se inventa contenido: un campo sin dato sigue imprimiéndose como `[...]`, igual que la plantilla oficial.
- `npm run typecheck` y `npx eslint` limpios antes de cada commit; `npx vitest run <archivo>` en verde.
- El fix de `resolverBases()` es aditivo: `ValorBases.valor` sigue siendo `string` en todos los casos — ningún consumidor existente (bases-checklist, previsualizaciones) cambia de comportamiento.
- Verificación end-to-end de que el `.docx` sigue siendo un ZIP válido (firma `"PK"`) vía un test temporal por task, borrado al terminar — mismo patrón usado en toda la Fase D de A9.

---

## Task 1: `resolverBases()` expone `filas` para campoHito de tipo array

**Files:**
- Modify: `lib/bases-elaboracion.ts`
- Test: `tests/bases-elaboracion.test.ts` (nuevo — hasta hoy `resolverBases` solo se ejercitaba indirectamente vía los tests de plantillas)

**Interfaces:**
- Produces: `export type FilaFactorEvaluacion = { factor: string; sustento: string }`. `ValorBases` gana `filas?: FilaFactorEvaluacion[]` (opcional). Lo consume `lib/bases-docx.ts` en el Task 3.

- [ ] **Step 1: Escribir el test que falla**

```ts
// tests/bases-elaboracion.test.ts
import { describe, expect, it } from "vitest";
import { resolverBases } from "@/lib/bases-elaboracion";

const entidad = { nombre: "Municipalidad de Prueba", ruc: "20123456789" };

describe("resolverBases · factores_items (array real, no texto)", () => {
  it("con datos, expone `filas` y un resumen legible en `valor`", () => {
    const hitos = {
      A3: { data: { finalidad_publica: "Contar con el bien.", descripcion: "Descripción." } },
      A4: {
        data: {
          var_h_modalidad_pago: "Suma alzada.",
          factores_items: [
            { nombre: "Experiencia del postor", sustento: "Puntaje según monto facturado." },
            { nombre: "Mejoras a las condiciones previstas", sustento: "Hasta 10 puntos." },
          ],
        },
      },
    };
    const valores = resolverBases("Licitación Pública para bienes", hitos as never, entidad);
    const factores = valores!.find((v) => v.ruta === "cap4.factoresEvaluacion")!;
    expect(factores.resuelto).toBe(true);
    expect(factores.filas).toEqual([
      { factor: "Experiencia del postor", sustento: "Puntaje según monto facturado." },
      { factor: "Mejoras a las condiciones previstas", sustento: "Hasta 10 puntos." },
    ]);
    expect(factores.valor).toContain("Experiencia del postor: Puntaje según monto facturado.");
  });

  it("con el array vacío, queda sin resolver (igual que un campo vacío)", () => {
    const hitos = { A4: { data: { factores_items: [] } } };
    const valores = resolverBases("Licitación Pública para bienes", hitos as never, entidad);
    const factores = valores!.find((v) => v.ruta === "cap4.factoresEvaluacion")!;
    expect(factores.resuelto).toBe(false);
    expect(factores.filas).toBeUndefined();
  });

  it("un campoHito string normal no gana `filas` (sin regresión)", () => {
    const hitos = { A3: { data: { finalidad_publica: "Contar con el bien." } } };
    const valores = resolverBases("Licitación Pública para bienes", hitos as never, entidad);
    const finalidad = valores!.find((v) => v.ruta === "cap3.finalidadPublica")!;
    expect(finalidad.valor).toBe("Contar con el bien.");
    expect(finalidad.filas).toBeUndefined();
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `npx vitest run tests/bases-elaboracion.test.ts`
Expected: FAIL — `factores.filas` es `undefined` en el primer caso (hoy `txt()` devuelve `""` para el array, así que ni siquiera `resuelto` sería `true`).

- [ ] **Step 3: Implementar el fix en `lib/bases-elaboracion.ts`**

```ts
export type FilaFactorEvaluacion = { factor: string; sustento: string };

export type ValorBases = {
  ruta: string;
  label: string;
  valor: string;
  resuelto: boolean;
  /** Solo presente cuando el campoHito es un array real (hoy: factores_items).
   *  bases-docx.ts lo usa para pintar una tabla; `valor` sigue trayendo un
   *  resumen en texto plano para cualquier otro consumidor. */
  filas?: FilaFactorEvaluacion[];
};

function txt(v: unknown): string {
  return typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";
}

// Filas de un campoHito que es un array real (hoy, solo factores_items: A4
// lo guarda como FactorEvaluacion[] = {nombre?, sustento?}[], no como texto —
// txt() lo trataba como "" y "Factores de evaluación" nunca se resolvía en
// ningún .docx generado hasta este fix). No se acopla al nombre del campo:
// cualquier array de objetos con `nombre`/`sustento` se lee igual.
function filasDeArray(v: unknown): FilaFactorEvaluacion[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v.map((item) => {
    const o = (item ?? {}) as Record<string, unknown>;
    return { factor: txt(o.nombre), sustento: txt(o.sustento) };
  });
}

export function resolverBases(
  proceso: string,
  hitos: HitosMap,
  entidad: { nombre: string; ruc: string },
): ValorBases[] | null {
  const plantilla = plantillaDeProceso(proceso);
  if (!plantilla) return null;

  return plantilla.seccionEspecifica.map((campo): ValorBases => {
    if (campo.origen === "libre") {
      return { label: campo.label, resuelto: false, ruta: campo.ruta, valor: "" };
    }
    if (campo.origen === "entidad") {
      const valor = campo.ruta === "cap1.entidad.ruc" ? entidad.ruc.trim() : entidad.nombre.trim();
      return { label: campo.label, resuelto: valor !== "", ruta: campo.ruta, valor };
    }
    // origen === "literal"
    const data = (hitos[campo.hito!]?.data ?? {}) as Record<string, unknown>;
    const crudo = data[campo.campoHito!];
    const filas = filasDeArray(crudo);
    if (filas) {
      const valor = filas.map((f) => `${f.factor}: ${f.sustento}`).join("\n");
      return { filas, label: campo.label, resuelto: filas.length > 0, ruta: campo.ruta, valor };
    }
    const valor = txt(crudo);
    return { label: campo.label, resuelto: valor !== "", ruta: campo.ruta, valor };
  });
}
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `npx vitest run tests/bases-elaboracion.test.ts`
Expected: PASS (3/3)

- [ ] **Step 5: Typecheck, lint y correr el resto de la suite de plantillas (sin regresión)**

Run: `npm run typecheck && npx eslint lib/bases-elaboracion.ts tests/bases-elaboracion.test.ts && npx vitest run tests/bases-plantillas.test.ts`
Expected: los tres en verde — `tests/bases-plantillas.test.ts` no debería cambiar de resultado, porque no toca `ValorBases.valor`.

- [ ] **Step 6: Commit**

```bash
git add lib/bases-elaboracion.ts tests/bases-elaboracion.test.ts
git commit -m "fix(expedientes): resolverBases no resolvia factores_items porque es un array, no texto"
```

---

## Task 2: Página A4, portada y estilos de encabezado reales en `bases-docx.ts`

**Files:**
- Modify: `lib/bases-docx.ts`
- Test: `tests/bases-docx.test.ts` (nuevo)

**Interfaces:**
- Consumes: `ValorBases[]` con `filas?` del Task 1 (aún no se usa en este task; se usa en el Task 3).
- Produces: `generarBasesDocx(proceso, valores, seccionGeneral): Promise<Buffer>` mantiene su firma pública — nada que la consuma (la ruta `app/api/processes/[id]/fase1/bases-docx/route.ts`) cambia.

- [ ] **Step 1: Escribir el test que falla, para el heurístico de nivel de encabezado**

Se extrae `nivelEncabezado()` (hoy `esEncabezado()` devuelve `boolean`; pasa a devolver `1 | 2 | null` para distinguir CAPÍTULO de un numeral):

```ts
// tests/bases-docx.test.ts
import { describe, expect, it } from "vitest";
import { nivelEncabezado } from "@/lib/bases-docx";

describe("nivelEncabezado", () => {
  it("CAPÍTULO es nivel 1", () => {
    expect(nivelEncabezado("CAPÍTULO I")).toBe(1);
    expect(nivelEncabezado("CAPÍTULO IV")).toBe(1);
  });

  it("un numeral en mayúsculas es nivel 2", () => {
    expect(nivelEncabezado("2.2 CONSIDERACIONES PARA TODOS LOS PROVEEDORES:")).toBe(2);
    expect(nivelEncabezado("1.1. REFERENCIAS")).toBe(2);
  });

  it("un párrafo de contenido normal no es encabezado", () => {
    expect(nivelEncabezado("El contrato se rige por la modalidad de pago determinada.")).toBeNull();
    expect(nivelEncabezado("a) Convocatoria. Se realiza a través del SEACE.")).toBeNull();
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `npx vitest run tests/bases-docx.test.ts`
Expected: FAIL — `nivelEncabezado` no existe todavía (hoy es `esEncabezado`, sin exportar).

- [ ] **Step 3: Implementar — página A4, portada, `nivelEncabezado` exportado y estilos reales**

```ts
import {
  AlignmentType,
  Document,
  Footer,
  HeadingLevel,
  PageBreak,
  PageNumber,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { ValorBases } from "./bases-elaboracion";

const FUENTE = "Arial";
const TAM = 20; // 10 pt.
const TAM_PORTADA = 32; // 16 pt., para el título de portada.

// Márgenes de un documento gubernamental estándar (no medidos al milímetro
// contra el PDF oficial — ver docs/superpowers/specs/2026-09-02-bases-docx-formato-oficial-design.md,
// "Fuera de alcance"). 1 cm ≈ 567 twips.
const MARGEN_VERTICAL = 1701; // 3 cm
const MARGEN_HORIZONTAL = 1417; // 2.5 cm

const TITULO_CAPITULO: Record<string, string> = {
  cap1: "CAPÍTULO I: GENERALIDADES",
  cap2: "CAPÍTULO II: DEL PROCEDIMIENTO DE SELECCIÓN",
  cap3: "CAPÍTULO III: REQUERIMIENTO",
  cap4: "CAPÍTULO IV: EVALUACIÓN",
  cap5: "CAPÍTULO V: PROFORMA DEL CONTRATO",
};

function parrafo(
  texto: string,
  opts?: { negrita?: boolean; alineacion?: (typeof AlignmentType)[keyof typeof AlignmentType] },
): Paragraph {
  return new Paragraph({
    alignment: opts?.alineacion ?? AlignmentType.JUSTIFIED,
    children: [new TextRun({ bold: opts?.negrita, font: FUENTE, size: TAM, text: texto })],
    spacing: { after: 200 },
  });
}

// 1 = CAPÍTULO (Heading1); 2 = numeral en mayúsculas tipo "2.2 CONSIDERACIONES...:"
// (Heading2); null = párrafo de contenido normal. Reemplaza al esEncabezado()
// booleano anterior — distingue DOS niveles en vez de uno para que el panel de
// navegación de Word refleje la jerarquía real del documento.
export function nivelEncabezado(linea: string): 1 | 2 | null {
  if (/^CAPÍTULO\s/.test(linea)) return 1;
  const sinNumeral = linea.replace(/^\d+(\.\d+)*\.?\s*/, "");
  if (sinNumeral === linea) return null; // no empezaba con numeral
  if (sinNumeral.length > 0 && sinNumeral.length < 90 && sinNumeral === sinNumeral.toUpperCase()) return 2;
  return null;
}

function parrafoConNivel(linea: string): Paragraph {
  const nivel = nivelEncabezado(linea);
  if (nivel === 1) {
    return new Paragraph({
      children: [new TextRun({ bold: true, font: FUENTE, size: TAM, text: linea })],
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200, before: 200 },
    });
  }
  if (nivel === 2) {
    return new Paragraph({
      children: [new TextRun({ bold: true, font: FUENTE, size: TAM, text: linea })],
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 150, before: 150 },
    });
  }
  return parrafo(linea);
}

function parrafosSeccionGeneral(seccionGeneral: string): Paragraph[] {
  return seccionGeneral
    .split("\n")
    .filter((linea) => linea.trim() !== "")
    .map((linea) => parrafoConNivel(linea.trim()));
}

// Portada: título del procedimiento + nomenclatura y objeto (ambos entre
// corchetes, igual que el PDF oficial: ACE no tiene esos datos en A1-A9
// todavía). Termina con un salto de página — la Sección General arranca en
// su propia página, como en el documento oficial.
function paginaPortada(proceso: string): Paragraph[] {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ bold: true, font: FUENTE, size: TAM_PORTADA, text: proceso.toUpperCase() })],
      spacing: { after: 400, before: 2000 },
    }),
    parrafo("N° [NOMENCLATURA DEL PROCEDIMIENTO DE SELECCIÓN]", { alineacion: AlignmentType.CENTER }),
    parrafo("CONTRATACIÓN DE [CONSIGNAR SEGÚN EL OBJETO]", { alineacion: AlignmentType.CENTER }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

function piePagina(): Footer {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ children: ["Página ", PageNumber.CURRENT, " de ", PageNumber.TOTAL_PAGES], font: FUENTE, size: TAM }),
        ],
      }),
    ],
  });
}
```

(El resto del archivo —`parrafosSeccionEspecifica`, `generarBasesDocx`— se ajusta en el Task 3 para usar `filas`; en este task solo se conecta la portada, el pie de página y `parrafoConNivel` al `Document` final.)

- [ ] **Step 4: Conectar página A4, márgenes, portada y pie de página en `generarBasesDocx`**

```ts
export async function generarBasesDocx(
  proceso: string,
  valores: ValorBases[],
  seccionGeneral: string,
): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        children: [
          ...paginaPortada(proceso),
          parrafo("SECCIÓN GENERAL", { alineacion: AlignmentType.CENTER, negrita: true }),
          ...parrafosSeccionGeneral(seccionGeneral),
          ...parrafosSeccionEspecifica(valores),
        ],
        footers: { default: piePagina() },
        properties: {
          page: {
            margin: { bottom: MARGEN_VERTICAL, left: MARGEN_HORIZONTAL, right: MARGEN_HORIZONTAL, top: MARGEN_VERTICAL },
            size: { height: 16838, width: 11906 }, // A4 en twips
          },
        },
      },
    ],
  });
  return Packer.toBuffer(doc);
}
```

- [ ] **Step 5: Correr el test y confirmar que pasa**

Run: `npx vitest run tests/bases-docx.test.ts`
Expected: PASS (3/3)

- [ ] **Step 6: Verificación end-to-end temporal (portada + salto de página + pie de página no rompen la generación)**

Crear `tests/_verificar-bases-docx-formato.test.ts` (mismo patrón usado en toda la Fase D): llama a `generarBasesDocx("Licitación Pública para bienes", valoresDeEjemplo, seccionGeneralDeEjemplo)` y comprueba que el buffer arranca con la firma ZIP `"PK"`. Correr, confirmar que pasa, y borrar el archivo.

- [ ] **Step 7: Typecheck y lint**

Run: `npm run typecheck && npx eslint lib/bases-docx.ts tests/bases-docx.test.ts`
Expected: limpio.

- [ ] **Step 8: Commit**

```bash
git add lib/bases-docx.ts tests/bases-docx.test.ts
git commit -m "feat(expedientes): el .docx de Bases tiene portada, pagina A4 y encabezados con estilo real de Word"
```

---

## Task 3: Párrafos multilínea, tabla de Factores de evaluación y limpieza del comentario de cabecera

**Files:**
- Modify: `lib/bases-docx.ts`
- Test: `tests/bases-docx.test.ts` (amplía el del Task 2)

**Interfaces:**
- Consumes: `ValorBases.filas` del Task 1.
- Produces: nada nuevo hacia afuera — mismo `generarBasesDocx`.

- [ ] **Step 1: Escribir el test que falla, para el split de párrafos multilínea y la tabla de filas**

```ts
// añadir a tests/bases-docx.test.ts
import { filasATabla, parrafosDeCampo } from "@/lib/bases-docx";

describe("parrafosDeCampo", () => {
  it("un valor con saltos de línea se parte en varios párrafos, no uno aplastado", () => {
    const campo = {
      filas: undefined,
      label: "Otras penalidades",
      resuelto: true,
      ruta: "cap3.otrasPenalidades",
      valor: "OBLIGATORIOS:\n- Primera línea.\n- Segunda línea.",
    };
    const parrafos = parrafosDeCampo(campo as never);
    expect(parrafos.length).toBeGreaterThan(1);
  });

  it("un campo con `filas` se pinta como tabla, no como párrafo label:valor", () => {
    const campo = {
      filas: [{ factor: "Experiencia del postor", sustento: "Puntaje según monto facturado." }],
      label: "Factores de evaluación",
      resuelto: true,
      ruta: "cap4.factoresEvaluacion",
      valor: "Experiencia del postor: Puntaje según monto facturado.",
    };
    const elementos = parrafosDeCampo(campo as never);
    expect(elementos.some((e) => e instanceof Table)).toBe(true);
  });
});

describe("filasATabla", () => {
  it("arma una tabla de 2 columnas con cabecera Factor/Sustento", () => {
    const tabla = filasATabla([{ factor: "A", sustento: "B" }]);
    expect(tabla).toBeInstanceOf(Table);
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `npx vitest run tests/bases-docx.test.ts`
Expected: FAIL — `filasATabla`/`parrafosDeCampo` no existen todavía; `parrafosSeccionEspecifica` sigue imprimiendo `${label}: ${valor}` en un solo párrafo.

- [ ] **Step 3: Implementar `filasATabla` y `parrafosDeCampo`, y usarlos en `parrafosSeccionEspecifica`**

```ts
export function filasATabla(filas: FilaFactorEvaluacion[]): Table {
  const encabezado = new TableRow({
    children: ["Factor", "Sustento / metodología"].map(
      (texto) =>
        new TableCell({
          children: [parrafo(texto, { negrita: true })],
          width: { size: 50, type: WidthType.PERCENTAGE },
        }),
    ),
  });
  const filasTabla = filas.map(
    (f) =>
      new TableRow({
        children: [f.factor, f.sustento].map(
          (texto) => new TableCell({ children: [parrafo(texto)], width: { size: 50, type: WidthType.PERCENTAGE } }),
        ),
      }),
  );
  return new Table({ rows: [encabezado, ...filasTabla], width: { size: 100, type: WidthType.PERCENTAGE } });
}

// Un campo de la Sección Específica: si trae `filas` (hoy, solo Factores de
// evaluación — ver lib/bases-elaboracion.ts), se pinta como tabla. Si no,
// como párrafos: la etiqueta en negrita seguida del valor, partiendo el
// valor en varios párrafos cuando trae saltos de línea reales (confirmado en
// otras_penalidades/var_f_requisitos_calificacion, que sí los traen) — antes
// se aplastaba todo en un solo párrafo largo.
export function parrafosDeCampo(campo: ValorBases): (Paragraph | Table)[] {
  if (campo.filas && campo.filas.length > 0) {
    return [parrafo(campo.label, { negrita: true }), filasATabla(campo.filas)];
  }
  const valor = campo.resuelto ? campo.valor : "[...]";
  const lineas = valor.split("\n");
  return [
    parrafo(`${campo.label}:${lineas.length > 1 ? "" : " " + lineas[0]}`, { negrita: lineas.length > 1 }),
    ...(lineas.length > 1 ? lineas.map((l) => parrafo(l)) : []),
  ];
}

function parrafosSeccionEspecifica(valores: ValorBases[]): (Paragraph | Table)[] {
  const capitulos = new Map<string, ValorBases[]>();
  for (const v of valores) {
    const prefijo = v.ruta.split(".")[0];
    const grupo = capitulos.get(prefijo) ?? [];
    grupo.push(v);
    capitulos.set(prefijo, grupo);
  }

  const salida: (Paragraph | Table)[] = [
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ bold: true, font: FUENTE, size: TAM, text: "SECCIÓN ESPECÍFICA" })],
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
    }),
  ];
  for (const [prefijo, campos] of capitulos) {
    salida.push(
      new Paragraph({
        children: [new TextRun({ bold: true, font: FUENTE, size: TAM, text: TITULO_CAPITULO[prefijo] ?? prefijo.toUpperCase() })],
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 150, before: 150 },
      }),
    );
    for (const campo of campos) salida.push(...parrafosDeCampo(campo));
  }
  return salida;
}
```

Ajustar `generarBasesDocx` para que `children` acepte `(Paragraph | Table)[]` (el tipo de `docx`'s `ISectionOptions.children` ya lo permite).

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `npx vitest run tests/bases-docx.test.ts`
Expected: PASS (todos)

- [ ] **Step 5: Verificación end-to-end temporal con un campo `filas` real**

Nuevo `tests/_verificar-bases-docx-tabla.test.ts`: llama a `resolverBases()` (Task 1) con `factores_items` poblado + `generarBasesDocx()`, confirma firma `"PK"`. Correr, confirmar que pasa, borrar.

- [ ] **Step 6: Actualizar el comentario de cabecera del archivo**

El comentario actual dice "es un borrador estructural... el maquetado exacto del OECE no está replicado". Reemplazar por una nota que refleje el estado real: portada, estilos de encabezado, tabla de factores y pie de página SÍ están, márgenes son un estándar razonable no medido contra el PDF (mismo texto que "Fuera de alcance" del spec).

- [ ] **Step 7: Typecheck, lint y suite completa de Bases**

Run: `npm run typecheck && npx eslint lib/bases-docx.ts tests/bases-docx.test.ts && npx vitest run tests/bases-docx.test.ts tests/bases-elaboracion.test.ts tests/bases-plantillas.test.ts`
Expected: todo en verde.

- [ ] **Step 8: Commit**

```bash
git add lib/bases-docx.ts tests/bases-docx.test.ts
git commit -m "feat(expedientes): tabla real para Factores de evaluacion y parrafos multilinea en el .docx de Bases"
```

---

## Self-Review

- **Cobertura del spec:** portada ✓ (Task 2), estilos de encabezado ✓ (Task 2), tabla para dato tabular real ✓ (Task 3), párrafos multilínea para texto libre ✓ (Task 3), pie de página con numeración ✓ (Task 2), fix de `resolverBases()` ✓ (Task 1). "Fuera de alcance" del spec (logos, márgenes exactos, tablas para texto libre) no tiene tarea — correcto, es explícitamente lo que NO se hace.
- **Sin placeholders:** cada step trae el código real, no descripciones.
- **Tipos consistentes:** `FilaFactorEvaluacion` se define en el Task 1 y se usa tal cual (mismo nombre de campos `factor`/`sustento`) en `filasATabla`/`parrafosDeCampo` del Task 3. `ValorBases.filas` es opcional en los tres tasks, nunca se asume presente sin comprobar.
