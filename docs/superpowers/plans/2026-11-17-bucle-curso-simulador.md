# Mejoras al bucle de estudio del curso — Plan de implementación

> **Para quien lo ejecute:** inline en la sesión actual, tarea por tarea con su ciclo test→implementación→commit.

**Objetivo:** tres mejoras aprobadas al curso de certificación OECE: (1) el coaching del banco enlaza el tema débil con la clase del curso que lo enseña; (2) las 144 preguntas de los balotarios 1–2 quedan etiquetadas por competencia; (3) seis casuísticas nuevas en los temas que más pesan (108 → 114).

**Spec:** `docs/superpowers/specs/2026-11-17-bucle-curso-simulador-design.md`.

**Ajuste al spec (por peso del bundle):** la búsqueda tema→clase NO vive en `temario-examen.ts` operando sobre el catálogo (que arrastra ~230 KB de contenido de clases al bundle del cliente, porque `exam-workspace.tsx` es un componente de cliente). Vive en un módulo generado y compacto (`lib/cursos/clases-tema.ts`, ~45 filas), el mismo patrón de `practica-tematica.ts` en su día: generado una vez, versionado, y un test de consistencia que lo amarra al catálogo real.

## Restricciones globales

- Español; Conventional Commits en minúscula; tokens Tailwind, sin hex.
- Todo dato normativo de las casuísticas nuevas sale de reglas ya verificadas verbatim contra el corpus esta sesión (Arts. 54, 63, 64.2, 68.1, 112.2, 207.2 del Reglamento) — no se introduce cifra nueva sin chunk.
- `balotarios-oece.json` se reescribe solo si el roundtrip es byte-exacto: `JSON.stringify(obj, null, 2)` con finales CRLF y **sin** salto final (verificado: 314 932 bytes idénticos).
- Tests: `npx vitest run <fichero>`; `npm run typecheck` por tarea.

---

### Tarea 1: Mapa generado tema→clase

**Ficheros:** Create `lib/cursos/clases-tema.ts`, `tests/cursos-clases-tema.test.ts`; desechable `tmp/gen-clases-tema.mts`.

- [ ] **Paso 1: test que falla** — `tests/cursos-clases-tema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CERTIFICACION_OECE } from "@/lib/cursos/certificacion-oece";
import { clasesEnOrden } from "@/lib/cursos/catalogo";
import { CLASES_TEMA, claseParaTema } from "@/lib/cursos/clases-tema";

describe("mapa tema→clase del curso", () => {
  it("cada fila es una (clase, tema) real del catálogo, en orden del curso", () => {
    const clases = clasesEnOrden(CERTIFICACION_OECE);
    const orden = new Map(clases.map((c, i) => [c.slug, i]));
    let anterior = -1;
    for (const fila of CLASES_TEMA) {
      const clase = clases.find((c) => c.slug === fila.slug);
      expect(clase, fila.slug).toBeTruthy();
      expect(clase!.temas, fila.slug).toContain(fila.tema);
      const pos = orden.get(fila.slug)!;
      expect(pos, fila.slug).toBeGreaterThanOrEqual(anterior);
      if (pos === anterior) {
        const previa = CLASES_TEMA[CLASES_TEMA.indexOf(fila) - 1];
        expect(clase!.temas.indexOf(fila.tema) > clases.find((c) => c.slug === previa.slug)!.temas.indexOf(previa.tema), fila.slug).toBe(true);
      }
      anterior = pos;
    }
  });

  it("cubre todos los temas declarados y ningún complemento", () => {
    const clases = clasesEnOrden(CERTIFICACION_OECE);
    const esperadas = clases.flatMap((c) => c.temas.map((t) => `${c.slug}:${t}`));
    const filas = CLASES_TEMA.map((f) => `${f.slug}:${f.tema}`);
    expect(filas.sort()).toEqual(esperadas.sort());
  });

  it("resuelve el primer tema del curso que enseña el tema pedido", () => {
    expect(claseParaTema("2.8")?.slug).toBe("recurso-apelacion");
    expect(claseParaTema("1.2")?.slug).toBe("requerimiento-contenido");
    expect(claseParaTema("9.9")).toBeNull();
  });
});
```

- [ ] **Paso 2:** `npx vitest run tests/cursos-clases-tema.test.ts` → FALLA (el módulo no existe).
- [ ] **Paso 3: generador** `tmp/gen-clases-tema.mts` (desechable, se borra tras ejecutar):

```ts
// Genera lib/cursos/clases-tema.ts desde el catálogo real. Desechable.
import { writeFileSync } from "node:fs";
import { CERTIFICACION_OECE } from "../lib/cursos/certificacion-oece";
import { clasesEnOrden } from "../lib/cursos/catalogo";

const filas = clasesEnOrden(CERTIFICACION_OECE)
  .flatMap((c) => c.temas.map((t) => ({ tema: t, slug: c.slug, titulo: c.titulo })));
const cuerpo = filas.map((f) => `  { tema: "${f.tema}", slug: "${f.slug}", titulo: "${f.titulo}" },`).join("\n");
writeFileSync(
  "lib/cursos/clases-tema.ts",
  `// Mapa compacto tema del examen → clase que lo enseña, para enlazar desde el simulador SIN importar el catálogo
// completo (el catálogo arrastra el texto de todas las clases al bundle del cliente; esto son unas decenas de filas).
// Generado una vez desde lib/cursos/certificacion-oece.ts y amarrado por tests/cursos-clases-tema.test.ts.
// Módulo puro: sin red ni base de datos.

export type ClaseDeTema = { tema: string; slug: string; titulo: string };

/** Filas (tema, clase) en orden del curso: la primera coincidencia es la clase que corresponde estudiar primero. */
export const CLASES_TEMA: readonly ClaseDeTema[] = [
${cuerpo}
];

/** La clase sugerida para un tema del temario (p. ej. «2.8»), o null si ninguna lo enseña. */
export function claseParaTema(tema: string): ClaseDeTema | null {
  return CLASES_TEMA.find((f) => f.tema === tema) ?? null;
}
`,
  "utf8",
);
console.log("filas:", filas.length);
```

  Ejecutar: `npx tsx tmp/gen-clases-tema.mts` → borrar el generador.
- [ ] **Paso 4:** `npx vitest run tests/cursos-clases-tema.test.ts` → PASA · typecheck.
- [ ] **Paso 5: commit** — `git commit -m "feat(cursos): mapa compacto tema del examen a clase para enlazar desde el simulador"`.

---

### Tarea 2: El coaching lleva el código del tema y el panel enlaza la clase

**Ficheros:** Modify `lib/exam-coaching.ts`, `tests/exam-coaching.test.ts`, `app/components/exam-training.tsx`, `app/components/exam-workspace.tsx`.

- [ ] **Paso 1:** en `lib/exam-coaching.ts`:
  - `recommendation` gana `code: string` (código de subcompetencia; `""` cuando no hay tema débil).
  - El mapa de temas pasa de clave `[competencia, topic-texto]` a clave `classification.code`; se guarda `{ competency, code, topic (etiqueta para mostrar), errors }`.
  - El desempate del más débil: errores descendentes, luego código ascendente (determinista).

```ts
  const topics = new Map<string, { competency: string; code: string; topic: string; errors: number }>>();
  // dentro del bucle, donde hoy se acumulan errores:
  const key = classification.code;
  const entry = topics.get(key) ?? {
    competency: row.code, code: classification.code,
    topic: typeof q.topic === "string" && q.topic.trim() ? q.topic : classification.label,
    errors: 0,
  };
  entry.errors++;
  topics.set(key, entry);
  // …
  const weakest = [...topics.values()].sort((a, b) =>
    b.errors - a.errors || a.code.localeCompare(b.code),
  )[0];
  return {
    practiced, correct, accuracy: accuracy(correct, practiced), competencies,
    recommendation: weakest
      ? { competency: weakest.competency, code: weakest.code, topic: weakest.topic, reason: "errors" as const }
      : { competency: next.code, code: "", topic: "", reason: next.total ? "continue" as const : "unseen" as const },
  };
```

- [ ] **Paso 2: tests** — en `tests/exam-coaching.test.ts`:
  - el caso `toEqual` de «sin errores…» pasa a incluir `code: ""`;
  - la aserción de claves expuestas pasa a `["code", "competency", "reason", "topic"]`;
  - el caso de prioridad de errores afirma `code: "2.1"` (las preguntas del test usan `subcompetency_code` `1.1`/`2.1`): la recomendación del test actual (`Selección`) pasa a llevar el código de la subcompetencia con más errores, con `topic` tomado de `q.topic` cuando existe y no vacío.

- [ ] **Paso 3: panel** — `app/components/exam-training.tsx`, `ExamCoachingPanel`:

```tsx
export function ExamCoachingPanel({ state, onPractice, claseSugerida }: {
  state: CoachingState;
  onPractice: (competency: string, topic: string) => void;
  /** Clase del curso que enseña el tema débil; la resuelve el workspace, el panel solo la pinta. */
  claseSugerida?: { slug: string; titulo: string } | null;
}) {
```

  y en la fila «Siguiente paso sugerido», junto al botón primario:

```tsx
{claseSugerida && data.recommendation.reason === "errors" && (
  <Link href={`/cursos/certificacion-oece/${claseSugerida.slug}`} className={cn(buttonClasses({ variant: "secondary" }), "w-full sm:w-auto")}>
    <BookOpen size={16} aria-hidden /> Estudiar la clase «{claseSugerida.titulo}»
  </Link>
)}
```

  (importar `Link` de `next/link` y `BookOpen` de `lucide-react`).

- [ ] **Paso 4: workspace** — `app/components/exam-workspace.tsx`: importar `claseParaTema` de `@/lib/cursos/clases-tema` y en el montaje del panel:

```tsx
const claseSugerida = coaching.data?.recommendation.reason === "errors"
  ? claseParaTema(coaching.data.recommendation.code)
  : null;
// …
<ExamCoachingPanel state={coaching} claseSugerida={claseSugerida} onPractice={(code, topic) => { …la existente… }} />
```

  (calcularlo justo antes del JSX; `coaching` ya está en scope). Toda cuenta que ve el banco tiene el módulo «simulacro», que incluye `/cursos`: el enlace nunca acaba en rechazo.

- [ ] **Paso 5:** `npx vitest run tests/exam-coaching.test.ts tests/exam-learning-routes.test.ts` → PASA · typecheck · revisión visual del panel en preview.
- [ ] **Paso 6: commit** — `git commit -m "feat(simulador): el coaching sugiere estudiar la clase del tema fallado"`.

---

### Tarea 3: Etiquetar por competencia las 144 preguntas de los balotarios 1 y 2

**Ficheros:** Modify `app/components/balotarios/balotarios-oece.json`, `tests/balotarios-policy.test.ts`; desechable `tmp/etiqueta-b12.mjs`.

- [ ] **Paso 1: regresión que falla** — añadir a `tests/balotarios-policy.test.ts`:

```ts
it("ninguna pregunta del catálogo queda sin competencia", () => {
  for (const b of catalogoBalotarios)
    for (const q of b.preguntas)
      expect(["COMPETENCIA 1", "COMPETENCIA 2", "COMPETENCIA 3"], `${b.balotario}-q${q.n}`).toContain(q.competencia);
});
```

  (importa `catalogoBalotarios` de `@/lib/balotarios-catalogo` si aún no está). → FALLA (144 sin etiqueta).

- [ ] **Paso 2: etiquetador** `tmp/etiqueta-b12.mjs`:
  - Lee `docs/evaluaciones/2026-11-17-anexos-coherencia/analisis-b{1,2}.md`, tabla `| n | clase o NO_CUBIERTA | tema | … |`.
  - Clase → competencia con el mapa de secciones del plan versionado (`docs/superpowers/plans/2026-11-17-curso-examen-coherencia.md`): actos preparatorios → `COMPETENCIA 1`; mecanismo-diferenciado (MDA) → `COMPETENCIA 2`; selección (procedimientos, apelación, plazos, evaluadores) → `COMPETENCIA 2`; ejecución y obras → `COMPETENCIA 3`; incentivos → `COMPETENCIA 3`.
  - `NO_CUBIERTA` → las reglas de palabras clave del mismo plan (obra/programa/valorización/incentivo → 3; apelación/buena pro/bases/oferta/subasta/pliego/desempate/participante → 2; requerimiento/segmentación/PAC/CMN/estrategia/interacción/MDA/CPI/modalidad/catalogo/no competitiv/principio → 1; contrato/garantía/adelanto/penalidad/modificación/conformidad/liquidación/controversia/nulidad → 3), primera coincidencia.
  - Verifica el roundtrip ANTES de mutar (`JSON.stringify(obj,null,2)` CRLF sin salto final === archivo original; abortar si no).
  - Escribe `competencia` solo en preguntas de balotarios 1 y 2; imprime el desglose C1/C2/C3 por balotario; reescribe con el mismo formato exacto.
  - Las 6 preguntas con revisión en `balotario_reviews` toman la etiqueta que ya les puso el overlay (b1-q32 → 3, b2-q71 → 2): la clasificación derivada ya coincide; el script lo verifica y aborta si no.
- [ ] **Paso 3:** ejecutar; el diff debe mostrar solo líneas `competencia` nuevas en B1/B2. `npx vitest run tests/balotarios-policy.test.ts tests/balotarios-routes.test.ts` → PASA.
- [ ] **Paso 4: commit** — `git commit -m "fix(simulador): etiqueta por competencia las 144 preguntas de los balotarios 1 y 2"`.

---

### Tarea 4: Seis casuísticas nuevas en los temas pesados (108 → 114)

**Ficheros:** Modify `lib/cursos/contenido/actos-preparatorios.ts` (+2), `fase-seleccion.ts` (+2), `ejecucion-contractual.ts` (+1), `obras.ts` (+1).

Reglas ya verificadas verbatim esta sesión; los enunciados no duplican los casos existentes (revisados: MDA/CMN/desierto; anuncio futuro/oferta única/pérdida; adenda/extemporánea/silencio; 2 valorizaciones/70 %/ruta crítica).

- [ ] **Paso 1:** en `expediente-contratacion.casuisticas` añadir:

```ts
{
  enunciado:
    "El expediente trae el requerimiento final, la estrategia de contratación con su interacción con el mercado, la designación de los evaluadores y la previsión presupuestal, pero no la certificación de crédito presupuestario. ¿Puede la autoridad de la gestión administrativa aprobarlo?",
  resolucion:
    "Sí. El Reglamento exige «la certificación de crédito presupuestario o previsión presupuestal»: basta una de las dos. Con la previsión documentada, el expediente reúne el contenido mínimo para aprobarse.",
  baseLegal: [{ norma: "Reglamento", articulo: "54" }],
},
{
  enunciado:
    "La entidad ya tiene el requerimiento cerrado y la estrategia definida, y quiere convocar de inmediato para no perder el año fiscal, sin esperar la aprobación del expediente. ¿Puede?",
  resolucion:
    "No. Sin expediente aprobado y bases elaboradas no se puede convocar: la aprobación del expediente por la autoridad de la gestión administrativa es requisito previo a la convocatoria.",
  baseLegal: [{ norma: "Reglamento", articulo: "63" }],
},
```

- [ ] **Paso 2:** en `plazos-buena-pro-seleccion.casuisticas` añadir:

```ts
{
  enunciado:
    "Por un evento no previsto, la entidad necesita postergar dos etapas del procedimiento. ¿Cómo queda constancia?",
  resolucion:
    "La prórroga o postergación de las etapas se registra en la Pladicop modificando el cronograma inicial: el calendario vigente es el que allí consta.",
  baseLegal: [{ norma: "Reglamento", articulo: "64" }],
},
{
  enunciado:
    "Publicada la integración de bases un martes, la entidad fija la presentación de ofertas para el miércoles siguiente (1 día). ¿Es válido?",
  resolucion:
    "No. La presentación de ofertas va en un plazo no menor de siete días hábiles contabilizados desde la publicación de la integración de bases; en modalidades abreviadas el mínimo son tres días hábiles.",
  baseLegal: [{ norma: "Reglamento", articulo: "68" }],
},
```

- [ ] **Paso 3:** en `modificaciones-procedimiento.casuisticas` añadir:

```ts
{
  enunciado:
    "Dos ministerios se fusionan y el que asumía los contratos de mantenimiento quiere ceder su posición contractual al otro. ¿Basta un acuerdo entre ellos?",
  resolucion:
    "No basta el acuerdo: la cesión de posición contractual entre entidades procede en los casos del artículo 112.2 del Reglamento —traslado de funciones, extinción, fusión o absorción— con sustento técnico legal previo de la DEC y acreditación de la necesidad de la cesionaria en su CMN, según el caso.",
  baseLegal: [{ norma: "Reglamento", articulo: "112" }],
},
```

- [ ] **Paso 4:** en `suspension-reprogramacion-obra.casuisticas` añadir:

```ts
{
  enunciado:
    "El supervisor ordenó presentar un nuevo programa de ejecución acelerado y el contratista lo entregó dentro de los siete días. Pasan siete días hábiles sin que la entidad observe nada. ¿Qué estado tiene el programa?",
  resolucion:
    "Se considera aprobado: el contratista presenta los documentos en siete días, el supervisor remite su pronunciamiento en cinco y la entidad puede observarlos dentro de siete días hábiles siguientes; sin observación, el nuevo programa y su calendario quedan aprobados.",
  baseLegal: [{ norma: "Reglamento", articulo: "207" }],
},
```

- [ ] **Paso 5:** `npx vitest run tests/cursos-catalogo.test.ts` → PASA (≥3 por clase se mantiene; 114 totales) · typecheck.
- [ ] **Paso 6: commit** — `git commit -m "docs(cursos): seis casuisticas mas en expediente, plazos, cesion y programa acelerado"`.

---

### Tarea 5: Cierre

- [ ] **Paso 1:** `npm run lint && npm run typecheck && npm run test` (suite completa; el test intermitente `hoja-preview` corre aislado si falla).
- [ ] **Paso 2:** `npm run build`.
- [ ] **Paso 3:** QA manual en preview: en el banco, con errores registrados, el panel muestra «Refuerza …» + «Estudiar la clase «…»» y el enlace abre la clase; los resultados de un balotario 1 muestran el desglose por competencia; las 4 clases muestran los casos nuevos.
- [ ] **Paso 4:** commit final si queda algo (CHANGELOG) y `git push rroque100 main`.
- [ ] **Paso 5:** al entregar: no hay SQL nuevo que aplicar (todo es código y datos versionados); Vercel despliega solo desde main.

## Fuera de alcance

Vídeos reales, reequilibrio 25/22/25 de B3–B5, cambios en `balotario_reviews`.
