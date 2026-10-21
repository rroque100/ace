# A9 — Elaboración de Bases desde el expediente Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que A9 arme la Sección Específica de las Bases del procedimiento de selección a partir de lo YA registrado en A1-A9 del expediente, y las exporte en Word — reproduciendo la Sección General oficial tal cual, sin tocarla.

**Architecture:** Cada tipo de procedimiento tiene UN documento de bases estándar (ya indexado en el RAG, `metadata.kind="modelo_bases"`, ver `lib/procesos-seleccion.ts:pdfsBasesEstandarDeProceso`) con DOS partes de naturaleza opuesta, confirmadas leyendo el extraído real de "Licitación Pública para bienes":

- **Sección General** (Capítulos I-IV): texto FIJO — la propia bases dice literalmente *"ESTA SECCIÓN NO DEBE SER MODIFICADA EN NINGÚN EXTREMO, BAJO SANCIÓN DE NULIDAD"*. No se genera ni se redacta: se **reproduce tal cual**, una vez transcrita y verificada por persona (ver la Global Constraint de fidelidad, abajo — es no negociable).
- **Sección Específica**: campos `[ENTRE CORCHETES]` que la entidad completa. Confirmado leyendo el extraído: la mayoría de estos campos **ya tienen dato en ACE** — Cap. I (entidad, RUC, año fiscal) sale de Configuración/el expediente; Cap. III "REQUERIMIENTO" es literalmente el contenido que A3 ya redactó (finalidad pública, descripción, condiciones); Cap. III "CONDICIONES DE CONTRATACIÓN" (modalidad de pago, sistema de entrega, otras penalidades) sale de A4 y reusa `lib/otras-penalidades.ts` (ya estructurado, con editor propio) tal cual. La tarea NO es "redactar con IA": es **ensamblar** datos que casi siempre ya existen, y solo pedir lo poco que de verdad falta.

Mismo patrón arquitectónico que ya está probado en el proyecto: `PasoDetalle.campos` (lib/actuaciones-preparatorias.ts) para el esquema, `lib/*-docx-datos.ts` + `lib/*-docx.ts` para la composición (ver lib/buena-pro-docx.ts, ya construido en la Fase 2), y el mecanismo genérico `EXPORT_FORMATO` de fase-panel.tsx para el botón de descarga.

**Tech Stack:** TypeScript, `docx` (composición de Word), Vitest, el RAG ya indexado (Pinecone + `documents`/`document_chunks`).

## Global Constraints

- **Fidelidad de la Sección General — NO NEGOCIABLE.** El texto que hoy está indexado se extrajo por OCR de un PDF, y ya se confirmó ruido real (`"CAPÍTULO II I"` en vez de `"III"`, espaciados irregulares). Reproducir un carácter mal en una sección "bajo sanción de nulidad" es un vicio real del procedimiento, no un detalle cosmético. **Antes de dar CUALQUIER Sección General por lista para producción**: (a) preguntar al usuario si tiene la versión .docx editable que el OECE publica junto al PDF (es la fuente correcta, no el OCR) y usarla si existe; (b) si no existe, transcribir a mano contra el PDF visualizándolo directamente (no confiar en el texto ya indexado sin cotejarlo palabra por palabra). Ningún task de este plan marca una Sección General como "lista" sin este paso.
- Código, comentarios y commits en español (CLAUDE.md).
- No se inventa contenido normativo: cada campo de la Sección Específica que no tenga ya un dato en `hitos` se dej

a en blanco con su placeholder `[...]`, igual que hace la propia plantilla — nunca se rellena con un valor supuesto.
- Cada task termina en algo verificable con `npm run typecheck`, `npm run lint` y (si aplica) `npx vitest run <archivo>`.
- Este plan cubre el tipo **"Licitación Pública para bienes"** como implementación de referencia completa (Fase A-C). Los otros 14 tipos siguen el MISMO molde (Fase D) — no se detallan campo por campo aquí porque cada uno exige la misma lectura cuidadosa contra su propio PDF que se hizo para bienes.

---

## Fase A — Infraestructura: plantilla de bases por procedimiento

### Task 1: Esquema de la plantilla y la Sección General de "bienes"

**Files:**
- Create: `lib/bases-plantillas.ts`
- Test: `tests/bases-plantillas.test.ts`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `export type CampoBases = { ruta: string; label: string; origen: "literal" | "libre"; hito?: string; campoHito?: string }` (`ruta` identifica el campo dentro de la Sección Específica, p. ej. `"cap1.entidad.ruc"`; `origen: "literal"` significa que se resuelve de `hitos[hito].data[campoHito]` sin tocarlo; `"libre"` significa que la entidad debe escribirlo aparte porque no hay dato capturado en A1-A9). `export type PlantillaBases = { proceso: string; seccionGeneral: string; seccionEspecifica: CampoBases[] }`. `export const PLANTILLAS_BASES: Record<string, PlantillaBases>`. Los Tasks 2 y 4 consumen `PLANTILLAS_BASES[proceso].seccionGeneral` y `.seccionEspecifica`.

- [ ] **Step 1: Obtener el texto verificado de la Sección General de "bienes"**

Antes de escribir código: pedir al usuario si tiene la versión .docx editable de "Bases estándar Licitación Pública para bienes" (R.D. 001-2026-EF/54.01). Si la tiene, extraer el texto de los Capítulos I-IV de la Sección General de ahí. Si no, abrir `actuaciones-preparatorias/bases/7614342-1-bases-estandar-licitacion-publica-para-bienes.pdf` y transcribir esos 4 capítulos a mano, cotejando contra el PDF (no contra el texto ya indexado, que tiene ruido de OCR confirmado). Es un paso de transcripción cuidadosa, no de programación — puede tomar más tiempo que el resto del task.

- [ ] **Step 2: Escribir el test que falla**

```ts
// tests/bases-plantillas.test.ts
import { describe, expect, it } from "vitest";
import { PLANTILLAS_BASES } from "@/lib/bases-plantillas";

describe("PLANTILLAS_BASES · Licitación Pública para bienes", () => {
  const plantilla = PLANTILLAS_BASES["Licitación Pública para bienes"];

  it("existe y no está vacía", () => {
    expect(plantilla).toBeDefined();
    expect(plantilla.seccionGeneral.length).toBeGreaterThan(500);
  });

  it("la Sección General incluye los 4 capítulos confirmados", () => {
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO I");
    expect(plantilla.seccionGeneral).toContain("ASPECTOS GENERALES");
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO II");
    expect(plantilla.seccionGeneral).toContain("DESARROLLO DEL PROCEDIMIENTO DE SELECCIÓN");
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO III");
    expect(plantilla.seccionGeneral).toContain("RECURSO DE APELACIÓN");
    expect(plantilla.seccionGeneral).toContain("CAPÍTULO IV");
    expect(plantilla.seccionGeneral).toContain("DEL CONTRATO");
  });

  it("la Sección Específica tiene los campos confirmados del Capítulo I y III", () => {
    const rutas = plantilla.seccionEspecifica.map((c) => c.ruta);
    expect(rutas).toContain("cap1.entidad.nombre");
    expect(rutas).toContain("cap1.entidad.ruc");
    expect(rutas).toContain("cap3.finalidadPublica");
    expect(rutas).toContain("cap3.descripcionRequerimiento");
    expect(rutas).toContain("cap3.modalidadPago");
    expect(rutas).toContain("cap3.sistemaEntrega");
  });

  it("los campos con origen literal declaran de qué hito salen", () => {
    const finalidad = plantilla.seccionEspecifica.find((c) => c.ruta === "cap3.finalidadPublica")!;
    expect(finalidad.origen).toBe("literal");
    expect(finalidad.hito).toBe("A3");
  });
});
```

- [ ] **Step 3: Correr el test y confirmar que falla**

Run: `npx vitest run tests/bases-plantillas.test.ts`
Expected: FAIL — `Cannot find module '@/lib/bases-plantillas'`

- [ ] **Step 4: Implementar `lib/bases-plantillas.ts`**

```ts
// Plantillas de Bases estándar OECE por tipo de procedimiento (R.D. 001-2026-EF/54.01).
//
// Cada bases estándar tiene DOS partes de naturaleza opuesta (confirmado
// leyendo el extraído real de "Licitación Pública para bienes", ver el plan
// docs/superpowers/plans/2026-09-01-a9-elaboracion-bases.md):
//
//   Sección General (Cap. I-IV): FIJA. La propia norma dice "ESTA SECCIÓN NO
//   DEBE SER MODIFICADA EN NINGÚN EXTREMO, BAJO SANCIÓN DE NULIDAD". Se
//   reproduce tal cual, transcrita y verificada a mano contra el documento
//   oficial (nunca desde el texto OCR ya indexado, que tiene ruido confirmado).
//
//   Sección Específica: campos [ENTRE CORCHETES] que la entidad completa. La
//   mayoría YA tiene dato en ACE (A1-A9): origen "literal" apunta a
//   hitos[hito].data[campoHito] y NUNCA se pisa con texto libre. Solo lo que
//   de verdad no existe en ningún hito es origen "libre" (la entidad lo
//   escribe en el momento de elaborar las bases).

export type CampoBases = {
  /** Identifica el campo dentro de la Sección Específica (p. ej. "cap1.entidad.ruc"). */
  ruta: string;
  label: string;
  origen: "literal" | "libre";
  /** Código del hito de origen (A1..A9), solo si origen === "literal". */
  hito?: string;
  /** Clave dentro de hitos[hito].data, solo si origen === "literal". */
  campoHito?: string;
};

export type PlantillaBases = {
  proceso: string;
  /** Texto literal de los Capítulos I-IV, verificado a mano — ver Task 1, Step 1. */
  seccionGeneral: string;
  seccionEspecifica: CampoBases[];
};

const SECCION_GENERAL_BIENES = `
CAPÍTULO I
ASPECTOS GENERALES
[... texto verificado a mano contra el PDF/DOCX oficial, Step 1 ...]

CAPÍTULO II
DESARROLLO DEL PROCEDIMIENTO DE SELECCIÓN
[...]

CAPÍTULO III
RECURSO DE APELACIÓN
[...]

CAPÍTULO IV
DEL CONTRATO
[...]
`.trim();

export const PLANTILLAS_BASES: Record<string, PlantillaBases> = {
  "Licitación Pública para bienes": {
    proceso: "Licitación Pública para bienes",
    seccionGeneral: SECCION_GENERAL_BIENES,
    seccionEspecifica: [
      { ruta: "cap1.entidad.nombre", label: "Nombre de la entidad", origen: "literal", hito: "A9", campoHito: "__entidad_nombre" },
      { ruta: "cap1.entidad.ruc", label: "RUC de la entidad", origen: "literal", hito: "A9", campoHito: "__entidad_ruc" },
      { ruta: "cap1.anioFiscal", label: "Año fiscal", origen: "literal", hito: "A1", campoHito: "anio_fiscal" },
      { ruta: "cap3.finalidadPublica", label: "Finalidad pública de la contratación", origen: "literal", hito: "A3", campoHito: "finalidad_publica" },
      { ruta: "cap3.descripcionRequerimiento", label: "Descripción general del requerimiento", origen: "literal", hito: "A3", campoHito: "descripcion_general" },
      { ruta: "cap3.modalidadPago", label: "Modalidad de pago", origen: "literal", hito: "A4", campoHito: "var_modalidad_pago" },
      { ruta: "cap3.sistemaEntrega", label: "Sistema de entrega", origen: "literal", hito: "A4", campoHito: "var_sistema_entrega" },
      // El resto de la Sección Específica (Cap. II cronograma/requisitos de
      // participación, Cap. IV factores de evaluación, Cap. V proforma del
      // contrato) se completa en el Task 3, leyendo el resto del extraído
      // real igual que se hizo con estos 7 campos — no se adivina aquí.
    ],
  },
};

export function plantillaDeProceso(proceso: string): PlantillaBases | undefined {
  return PLANTILLAS_BASES[proceso];
}
```

**Nota para quien implemente**: los nombres exactos de `campoHito` para `A9.__entidad_nombre`/`A9.__entidad_ruc` (el nombre/RUC de LA ENTIDAD, no del expediente) hay que resolverlos contra `entity_settings`/Configuración → Municipalidad (mismo dato que ya usan otros exportables de Fase 1, ver `lib/fase1-export.ts:proceso.entity`) — no necesariamente vive en un `hito`; puede que la ruta correcta sea `origen: "literal"` pero resuelta en `lib/bases-elaboracion.ts` (Task 3) desde `entity_settings`, no desde `hitos`. Ajustar el tipo `CampoBases` si hace falta un tercer `origen: "entidad"` cuando se llegue a ese punto — no fijarlo aquí a ciegas.

- [ ] **Step 5: Correr el test y confirmar que pasa**

Run: `npx vitest run tests/bases-plantillas.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Typecheck y lint**

Run: `npm run typecheck && npx eslint lib/bases-plantillas.ts`

- [ ] **Step 7: Commit**

```bash
git add lib/bases-plantillas.ts tests/bases-plantillas.test.ts
git commit -m "feat(expedientes): esquema de plantilla de bases + Seccion General verificada de bienes"
```

---

## Fase B — Completar el mapeo de "Licitación Pública para bienes"

### Task 2: Leer el resto del extraído indexado y completar `seccionEspecifica`

**Files:**
- Modify: `lib/bases-plantillas.ts` (ampliar `seccionEspecifica` de "Licitación Pública para bienes")
- Modify: `tests/bases-plantillas.test.ts` (nuevos casos por cada campo agregado)

**Interfaces:**
- Consumes: el documento ya indexado (`documents?file_name=eq.7614342-1-bases-estandar-licitacion-publica-para-bienes.pdf&metadata->>kind=eq.modelo_bases`, `document_chunks?document_id=eq.<id>&order=chunk_index.asc`) — consultarlo con `supabaseRest` igual que se hizo para la investigación de este plan.
- Produces: `seccionEspecifica` completo (Cap. I-V), consumido por el Task 3.

- [ ] **Step 1: Leer los chunks restantes**

Consultar `document_chunks` del documento de bienes (ya indexado, 95 chunks) y leer los que no se leyeron todavía en la investigación de este plan (Cap. II "Del Procedimiento de Selección" — cronograma, requisitos de participación —, Cap. IV "Evaluación" — factores —, Cap. V "Proforma del Contrato" — el resto de condiciones más allá de modalidad de pago/sistema de entrega, que ya se mapearon). Anotar cada campo `[ENTRE CORCHETES]` encontrado.

- [ ] **Step 2: Para cada campo, decidir origen "literal" o "libre"**

Cruzar cada campo contra lo que YA existe en `lib/actuaciones-preparatorias.ts` (`PASOS_F1`) y en los helpers estructurados ya construidos (`lib/otras-penalidades.ts` para el cuadro de "Otras penalidades" del Cap. III que ya se confirmó calza; revisar si hay equivalentes para el cronograma de A9/A3, requisitos de participación de A4, factores de evaluación de A4/A6). Si un campo no tiene dato en ningún hito, `origen: "libre"`.

- [ ] **Step 3: Ampliar `seccionEspecifica` y el test**

Por cada campo nuevo: una entrada en `seccionEspecifica` (mismo Task 1) y un caso en el test que confirme su `ruta`/`origen`/`hito`.

- [ ] **Step 4: Typecheck, lint y test**

Run: `npm run typecheck && npx eslint lib/bases-plantillas.ts && npx vitest run tests/bases-plantillas.test.ts`

- [ ] **Step 5: Commit**

```bash
git add lib/bases-plantillas.ts tests/bases-plantillas.test.ts
git commit -m "feat(expedientes): completa el mapeo de la Seccion Especifica de bienes (Cap. II, IV, V)"
```

---

## Fase C — Ensamblar y exportar

### Task 3: `lib/bases-elaboracion.ts` — resolver los valores desde el expediente

**Files:**
- Create: `lib/bases-elaboracion.ts`
- Test: `tests/bases-elaboracion.test.ts`

**Interfaces:**
- Consumes: `PLANTILLAS_BASES`/`CampoBases` (Task 1-2), `HitosMap` de `@/lib/procurement-fases`.
- Produces: `export type ValorBases = { ruta: string; label: string; valor: string; resuelto: boolean }`, `export function resolverBases(proceso: string, hitos: HitosMap, entidad: { nombre: string; ruc: string }): ValorBases[] | null` (null si no hay plantilla para ese proceso). `resuelto: false` cuando el campo es `origen: "libre"` o el hito de origen no tiene el dato — consumido por el Task 4 (el .docx dice `[...]` ahí, igual que la plantilla original) y por la UI (Task 5, para avisar qué falta antes de exportar).

- [ ] **Step 1: Escribir el test que falla**

```ts
// tests/bases-elaboracion.test.ts
import { describe, expect, it } from "vitest";
import { resolverBases } from "@/lib/bases-elaboracion";
import type { HitosMap } from "@/lib/procurement-fases";

describe("resolverBases", () => {
  it("proceso sin plantilla devuelve null", () => {
    expect(resolverBases("Concurso Público con diálogo competitivo", {}, { nombre: "X", ruc: "1" })).toBeNull();
  });

  it("resuelve los campos literales desde los hitos correspondientes", () => {
    const hitos: HitosMap = {
      A1: { status: "hecho", data: { anio_fiscal: 2026 } },
      A3: { status: "hecho", data: { finalidad_publica: "Mejorar la atención al ciudadano.", descripcion_general: "Adquisición de mobiliario." } },
      A4: { status: "hecho", data: { var_modalidad_pago: "pago_unico", var_sistema_entrega: "" } },
    };
    const valores = resolverBases("Licitación Pública para bienes", hitos, { nombre: "MUNICIPALIDAD X", ruc: "20123456789" });
    expect(valores).not.toBeNull();
    const porRuta = Object.fromEntries(valores!.map((v) => [v.ruta, v]));
    expect(porRuta["cap1.entidad.nombre"].valor).toBe("MUNICIPALIDAD X");
    expect(porRuta["cap3.finalidadPublica"].valor).toBe("Mejorar la atención al ciudadano.");
    expect(porRuta["cap3.finalidadPublica"].resuelto).toBe(true);
  });

  it("un campo sin dato en su hito queda sin resolver, no se inventa", () => {
    const valores = resolverBases("Licitación Pública para bienes", {}, { nombre: "MUNICIPALIDAD X", ruc: "20123456789" });
    const porRuta = Object.fromEntries(valores!.map((v) => [v.ruta, v]));
    expect(porRuta["cap3.finalidadPublica"].resuelto).toBe(false);
    expect(porRuta["cap3.finalidadPublica"].valor).toBe("");
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `npx vitest run tests/bases-elaboracion.test.ts`
Expected: FAIL — `Cannot find module '@/lib/bases-elaboracion'`

- [ ] **Step 3: Implementar `lib/bases-elaboracion.ts`**

```ts
import { plantillaDeProceso } from "./bases-plantillas";
import type { HitosMap } from "./procurement-fases";

export type ValorBases = { ruta: string; label: string; valor: string; resuelto: boolean };

function txt(v: unknown): string {
  return typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";
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
    // Los dos campos de "entidad" no viven en un hito: salen de Configuración.
    if (campo.hito === "A9" && campo.campoHito === "__entidad_nombre") {
      return { label: campo.label, resuelto: Boolean(entidad.nombre), ruta: campo.ruta, valor: entidad.nombre };
    }
    if (campo.hito === "A9" && campo.campoHito === "__entidad_ruc") {
      return { label: campo.label, resuelto: Boolean(entidad.ruc), ruta: campo.ruta, valor: entidad.ruc };
    }
    const data = (hitos[campo.hito!]?.data ?? {}) as Record<string, unknown>;
    const valor = txt(data[campo.campoHito!]);
    return { label: campo.label, resuelto: valor !== "", ruta: campo.ruta, valor };
  });
}
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `npx vitest run tests/bases-elaboracion.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Typecheck, lint y commit**

```bash
npm run typecheck && npx eslint lib/bases-elaboracion.ts
git add lib/bases-elaboracion.ts tests/bases-elaboracion.test.ts
git commit -m "feat(expedientes): resuelve los valores de la Seccion Especifica desde los hitos A1-A9"
```

---

### Task 4: `lib/bases-docx.ts` + ruta de exportación + botón en A9

**Files:**
- Create: `lib/bases-docx.ts`
- Create: `app/api/processes/[id]/fase1/bases-docx/route.ts`
- Modify: `app/components/fase-panel.tsx` (entrada en `EXPORT_FORMATO.A9`, mismo patrón que Fase 2 Task 6/9 — sin previa por ahora, dado el tamaño del documento; considerar previa en un task aparte si hace falta)

**Interfaces:**
- Consumes: `resolverBases` (Task 3), `plantillaDeProceso` (Task 1).
- Produces: `export async function generarBasesDocx(proceso: string, valores: ValorBases[], seccionGeneral: string): Promise<Buffer>`.

- [ ] **Step 1: Implementar `lib/bases-docx.ts`**

Composición con `docx` (mismo patrón que `lib/buena-pro-docx.ts`, Fase 2): la Sección General como párrafos literales (un `Paragraph` por línea de `seccionGeneral`, respetando saltos), seguida de la Sección Específica agrupada por capítulo (`Heading` + `Paragraph` por campo, mostrando `[...]` cuando `resuelto === false` — igual que hace la plantilla oficial con los campos sin completar, para que quien revisa sepa exactamente qué falta).

- [ ] **Step 2: Ruta `app/api/processes/[id]/fase1/bases-docx/route.ts`**

Mismo patrón que `fase2/buena-pro-docx/route.ts`: `requireCapability("expediente.manage")`, trae `procurement_processes` (nomenclature, object_type, procedure_type, hitos) + `entity_settings` (nombre/RUC de la entidad), llama `resolverBases` + `plantillaDeProceso` + `generarBasesDocx`, descarga el `.docx`. 404 si el `procedure_type` del expediente no tiene plantilla todavía (`plantillaDeProceso` devuelve `undefined`) — mensaje claro: "Todavía no hay plantilla de bases para este tipo de procedimiento."

- [ ] **Step 3: Botón en A9**

```ts
A9: [
  { path: "fase1/export?formato=bases_checklist", label: "Checklist de Bases", previa: "bases_checklist" },
  { path: "fase1/bases-docx", label: "Elaborar Bases (Word)", word: true },
],
```

- [ ] **Step 4: Typecheck, lint, verificar en el preview**

Run: `npm run typecheck && npx eslint lib/bases-docx.ts "app/api/processes/[id]/fase1/bases-docx/route.ts" app/components/fase-panel.tsx`

Con un expediente que tenga A1/A3/A4 con datos y `procedure_type = "Licitación Pública para bienes"`, descargar el .docx y confirmar que abre sin error y que la Sección General coincide EXACTAMENTE con el documento oficial (cotejo manual, no automatizable) antes de considerar esto usable en producción.

- [ ] **Step 5: Commit**

```bash
git add lib/bases-docx.ts "app/api/processes/[id]/fase1/bases-docx/route.ts" app/components/fase-panel.tsx
git commit -m "feat(expedientes): A9 exporta las Bases (Word) para Licitacion Publica de bienes"
```

---

## Fase D — Replicar para los otros 14 tipos de procedimiento ✅ COMPLETA (2026-09-02)

Mismo molde de las Fases A-C, un tipo a la vez (cada uno su propio Task 1+2+3+4, o agrupados si dos comparten estructura muy similar, p. ej. "Licitación Pública de obras" y sus variantes con precalificación/negociación probablemente compartan casi toda la Sección Específica). **No se detalla campo por campo aquí** — exige la misma lectura cuidadosa del extraído real que exigió "bienes", y forzar una plantilla sin haber leído su propio PDF sería inventar contenido de un documento oficial, exactamente lo que este proyecto evita.

Orden sugerido (por volumen de uso esperado, a confirmar con el usuario): obras → servicios → consultoría/mantenimiento vial → subasta inversa/comparación de precios/no competitivo (los tres más simples, probablemente con Secciones Específicas más cortas) → el resto.

Cada tipo nuevo:
1. Repetir el Task 1 (Sección General transcrita y verificada — el paso de fidelidad NO es opcional en ninguno).
2. Repetir el Task 2 (mapeo completo de la Sección Específica).
3. El Task 3 (`resolverBases`) y el Task 4 (`generarBasesDocx`/ruta/botón) son GENÉRICOS — ya funcionan para cualquier proceso con plantilla en `PLANTILLAS_BASES`, no hay que tocarlos de nuevo salvo que un tipo tenga una estructura de capítulos genuinamente distinta (p. ej. obras probablemente tenga un capítulo propio de "adelantos"/garantías de fiel cumplimiento distinto al de bienes).

### Cierre de Fase D

Confirmado con una auditoría de cobertura (cruzando cada `pdfBasesEstandar` del catálogo de `lib/procesos-seleccion.ts` contra `PLANTILLAS_BASES`/`VARIANTES_AMBIGUAS`): **todo tipo de procedimiento con bases estándar publicada por el OECE ya tiene su plantilla registrada.** Task 3 y Task 4 nunca necesitaron tocarse — son genéricos, tal como se anticipó arriba.

**Transcritos desde su propio PDF** (Sección General leída y verificada a mano contra el documento oficial):
- Licitación Pública de obras (parcial ampliado — 12 campos: agrega subcontratación, modalidad de pago, fórmulas de reajuste, penalidad por mora, otras penalidades, solución de controversias, requisitos de calificación y factores de evaluación, confirmados en el PDF completo; 3.2 estructurado y el sistema de entrega —es la elección de qué variante de Cap. III usar, no un campo de relleno— siguen sin mapear)
- Licitación Pública abreviada de obras (parcial ampliado, mismo alcance)
- Concurso Público de servicios (completo)
- Concurso Público para consultoría en general (completo)
- Concurso Público para consultoría de obra (parcial ampliado — 14 campos: además de lo de obras, aquí el sistema de entrega SÍ es un campo de relleno propio, más lugar de prestación del servicio; 3.2 y el plazo de prestación —tabla, no escalar— siguen sin mapear)
- Concurso Público para servicio de mantenimiento vial (completo)
- Subasta Inversa Electrónica (parcial — YA en su máximo honesto, releído completo y confirmado: sin sistema de entrega/factores de evaluación, estructura propia por ficha técnica; el Cap. IV dice literalmente "el único factor de evaluación es el precio")
- Comparación de Precios (parcial — YA en su máximo honesto, mismo motivo)
- Procedimiento de Selección No Competitivo (parcial — YA en su máximo honesto: el 3.3 "Condiciones de contratación" es literalmente un bloque de remisión a las bases estándar del objeto correspondiente, sin sub-campos, y no tiene capítulo de evaluación — releído completo y confirmado)
- Licitación Pública abreviada para bienes (completo)
- Concurso Público abreviado de servicios (completo)
- Concurso Público abreviado para consultoría en general (completo)
- Concurso Público abreviado para consultoría de obra (parcial ampliado, mismo alcance que su contraparte sin abreviar)
- Concurso Público abreviado para servicios de mantenimiento vial (completo)

**Pase de profundización (2026-09-02):** a pedido del usuario, se releyeron los PDF COMPLETOS (no solo hasta la Sección General) de los 5 tipos que habían quedado "parcial" en el pase inicial. En obras y consultoría de obra (+ sus 5 alias/abreviadas) se encontraron campos genuinamente mapeables que el primer pase no había leído — el mapeo pasó de ~5 a 12-14 campos. En subasta inversa, comparación de precios y no competitivo, la relectura CONFIRMÓ que ya estaban en su máximo honesto: no había nada más que mapear sin inventar contenido que el propio PDF no tiene como campo de relleno.

**Registrados sin transcribir un PDF nuevo** (su `pdfBasesEstandar` en el catálogo apunta al MISMO documento que un tipo ya transcrito — el OECE no publicó una bases estándar propia para la variante diferenciada/con precalificación):
- Licitación Pública para bienes especializados → alias de "Licitación Pública para bienes"
- Licitación Pública de obras con precalificación → alias de "Licitación Pública de obras"
- Licitación Pública de obras con negociación → alias de "Licitación Pública de obras" (encontrado en la auditoría final, no en el pase inicial)
- Concurso Público con precalificación → alias ambiguo de las 3 variantes de "Concurso Público para consultorías y servicios de mantenimiento vial" (vía `VARIANTES_AMBIGUAS`)

**Genuinamente sin bases estándar OECE** (confirmado: ningún PDF en `actuaciones-preparatorias/bases/` ni entrada `pdfBasesEstandar` en el catálogo) — quedan sin plantilla a propósito, no por descuido:
- Licitación Pública con diálogo competitivo
- Licitación Pública para mecanismos diferenciados de adquisición (MDA)
- Concurso Público con diálogo competitivo
- Concurso Público abreviado para la contratación de expertos y gerentes de proyectos
- Compra Pública Precomercial
- Asociación para la Innovación
- Concurso de Proyectos Arquitectónicos y Urbanísticos
