# Curso que prepara el examen: contradicciones, casuísticas y práctica por tema — Plan de implementación

> **Integrado en el PR #37 (2026-11-17), salvo la práctica por tema.** Las correcciones, las casuísticas y las clases
> XIX–XXIII entraron sobre la estructura por competencias de
> `docs/superpowers/plans/2026-11-17-cursos-alineacion-temario-oece.md` (las 4 secciones de este plan ya no existen).
> La tarea de práctica por tema (`lib/cursos/practica-tematica.ts`, `?tema=` en el simulador) se quedó fuera: chocaba con
> la navegación del simulador en `main` y el curso ya practica en el banco, que filtra por competencia y tema.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el curso `/cursos/certificacion-oece` prepare de verdad para el examen: corrige las reglas que hoy enseña mal o incompletas, añade un bloque de casuísticas tipo examen a cada clase, crea 5 clases nuevas para los temas más preguntados, y hace que cada sección practique en el simulador con sus propias preguntas.

**Architecture:** Todo el contenido del curso sigue siendo código versionado en `lib/cursos/` (catálogo puro, sin red). Las casuísticas son un campo más de `ContenidoClase` con su propia pestaña en la página de clase. La práctica por tema es una función pura (`lib/cursos/practica-tematica.ts`) que clasifica las 360 preguntas de los balotarios por sección del curso, alimentada por el análisis de coherencia ya hecho; el simulador solo gana una colección más en su selector y dos parámetros de URL (`tema` y `seccion=banco`). Lo único que toca la base de datos es nada: progreso y exámenes siguen como están.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript estricto, Tailwind acotado a `.tw` con tokens (`bg-panel`, `text-muted`, `border-line`, `bg-brand-soft`…), Vitest.

**Fuente de verdad legal.** Cada cifra, plazo y porcentaje de este plan ya se verificó contra el chunk verbatim del corpus (Reglamento «texto actualizado al 09.01.2026», doc `8371bce1-f773-4ad8-8efa-1266276ae4ec`; Ley «texto actualizado al 19.07.2026», doc `dc721f35-138c-41b8-8dca-16289f74d9df`), según el informe `docs/evaluaciones/2026-11-17-coherencia-simulador-curso.md` y sus anexos. Al editar contenido, no se introducen cifras nuevas que no estén en este plan ni en las clases ya verificadas; si algo no cuadra con el chunk, se saca en vez de aproximarlo.

## Global Constraints

- Código, comentarios, copys y commits en **español**; Conventional Commits con scope y el síntoma que ve el usuario, en minúscula.
- Componentes solo con utilidades y tokens; nada de hex, paleta por defecto ni clases nuevas en CSS.
- El catálogo de cursos vive en código (`lib/cursos/`), puro y recorrible en tests.
- `verificada: true` solo si cada artículo, plazo y cifra se contrastó con el corpus. Todo el contenido nuevo de este plan ya está contrastado (ver cabecera); si un ejecutor cambia una cifra, debe re-verificarla.
- Tests con `npx vitest run <fichero>`; `npm run typecheck` tras cada tarea de código.
- No se toca la base de datos ni las APIs en este plan (progreso, exámenes y balotarios siguen igual).
- La corrección de preguntas defectuosas de los balotarios (B1-32, B2-71, B4-28, B4-51/68, B4-63) va por `balotario_reviews` en otro momento; **fuera de alcance aquí**.

---

## Estructura de ficheros

| Fichero | Responsabilidad |
|---|---|
| `lib/cursos/tipos.ts` | Añade `Casuistica` y `casuisticas?` en `ContenidoClase`. |
| `lib/cursos/contenido/actos-preparatorios.ts` | Correcciones clases I, III, IV, V, VII + casuísticas de las 7 clases. |
| `lib/cursos/contenido/fase-seleccion.ts` | Corrección clase XI + casuísticas de las 3 clases + clase nueva XIX. |
| `lib/cursos/contenido/ejecucion-contractual.ts` | Casuísticas de las 5 clases + clases nuevas XX, XXI, XXIII. |
| `lib/cursos/contenido/obras.ts` | Casuísticas de las 3 clases + clase nueva XXII. |
| `lib/cursos/certificacion-oece.ts` | Enlaces de punto de control con `&tema=`. |
| `lib/cursos/practica-tematica.ts` | Mapa pregunta→sección (360 entradas) + `preguntasDeTema` + etiquetas. |
| `app/components/cursos/pestanas-clase.tsx` | Pestaña «Casuística» con revelado por caso. |
| `app/components/simulador-shell.tsx` | Lee `?tema=` y `?seccion=banco`. |
| `app/components/balotarios/modulo.tsx` | Acepta `temaInicial` y lo pasa a `Practica`. |
| `app/components/balotarios/recorrido.tsx` | Selector de colección con las 4 secciones temáticas. |
| `tests/cursos-catalogo.test.ts` | Regresión de correcciones + exigencia de casuísticas + nuevos conteos. |
| `tests/practica-tematica.test.ts` | El mapa cubre las 360 preguntas y cada tema reúne preguntas. |

---

### Tarea 1: Corregir las cinco contradicciones del contenido

**Ficheros:**
- Modify: `lib/cursos/contenido/actos-preparatorios.ts` (clases I, III, IV, V y VII)
- Modify: `lib/cursos/contenido/fase-seleccion.ts` (clase XI)
- Test: `tests/cursos-catalogo.test.ts`

**Interfaces:** consume `Clase` existente; produce contenido corregido. Ninguna firma cambia.

- [ ] **Paso 1: test que falla** — añade al final de `tests/cursos-catalogo.test.ts` (dentro del `describe` general, fuera del bucle `for`):

```ts
it("las reglas corregidas del D.S. 001-2026-EF están en el contenido", () => {
  const curso = buscarCurso("certificacion-oece")!;
  const todo = JSON.stringify(curso);
  // Art. 42.3 sustituido: con la necesidad en el CMN, la DEC segmenta al recibir el requerimiento.
  expect(todo).toContain("luego de la recepción del requerimiento");
  // Art. 42.5: catálogos electrónicos, no competitivos y supuestos excluidos no se segmentan.
  expect(todo).toContain("no se segmentan");
  // Art. 302.1: la AGA resuelve apelaciones de forma indelegable.
  expect(todo).toContain("indelegable");
  // Art. 302.3: nulidad de oficio y cancelación se impugnan ante el TCP sin importar la cuantía.
  expect(todo).toContain("con independencia de la cuantía");
  // Art. 60.4: el jurado conduce las rondas de negociación y diálogo competitivo.
  expect(todo).toContain("el jurado conduce las rondas");
  // Art. 295.1: en el MDA no aplican segmentación ni interacción con el mercado.
  expect(todo).toContain("sin segmentación ni interacción con el mercado");
  // Art. 14.2.a con 59.5.c y 60.3: la DEC no registra lo que corresponde a evaluadores.
  expect(todo).toContain("los comités registran sus actas");
});
```

- [ ] **Paso 2:** `npx vitest run tests/cursos-catalogo.test.ts` → FALLA (ninguna frase existe aún).
- [ ] **Paso 3: correcciones**, una clase a la vez. Textos exactos (ya verificados contra el corpus):

  **3a. Clase `plan-anual-contrataciones`** — sustituye el bloque «¿Qué pasa con una contratación no planificada?»:

```ts
{
  pregunta: "¿Qué pasa con una contratación no planificada?",
  parrafos: [
    "Si la contratación no está programada pero la necesidad ya está incluida en el CMN respectivo, la DEC efectúa la segmentación luego de la recepción del requerimiento (Reglamento, Art. 42.3, texto sustituido por el D.S. 001-2026-EF).",
    "Las compras centralizadas y corporativas las segmenta la entidad encargada al inicio de las actuaciones preparatorias, y las considera estratégicas (bienes y servicios) o avanzadas (obras y consultorías de obras). Las contrataciones por encargo las segmenta la entidad encargada cuando el encargo contempla esa fase (Reglamento, Art. 42.4).",
    "No se segmentan los contratos menores ni las contrataciones por catálogos electrónicos de acuerdos marco, procedimientos no competitivos y supuestos excluidos (Reglamento, Arts. 42.1 y 42.5).",
  ],
},
```

  Y en sus `puntosClave` sustituye «Lo no planificado exige primero que el área usuaria solicite modificar el CMN.» por:

```ts
"No programada con la necesidad ya en el CMN: la DEC segmenta al recibir el requerimiento (Art. 42.3, texto del D.S. 001-2026-EF).",
"Catálogos electrónicos, no competitivos y supuestos excluidos no se segmentan.",
```

  **3b. Clase `segmentacion-contrataciones`** — en el bloque «¿Qué es la segmentación y para qué sirve?», sustituye «…del PAC del CMN del ejercicio en curso, salvo los contratos menores.» por «…del PAC del CMN del ejercicio en curso, salvo los contratos menores; y no se segmentan las contrataciones por catálogos electrónicos de acuerdos marco, los procedimientos no competitivos ni los supuestos excluidos (Reglamento, Arts. 42.1 y 42.5), ni las contrataciones por MDA (Reglamento, Art. 295.1).». En `puntosClave`, sustituye «Se segmenta todo el PAC del CMN del ejercicio, menos los contratos menores.» por «Se segmenta el PAC del CMN del ejercicio, menos los contratos menores; los catálogos electrónicos, los no competitivos, los supuestos excluidos y el MDA no se segmentan.». Añade a `baseLegal`: `{ norma: "Reglamento", articulo: "295" }`.

  **3c. Clase `actores-involucrados`** — en el bloque «¿Qué hace la DEC y qué no?», sustituye el primer párrafo por:

```ts
"La DEC, a través de los compradores públicos, registra en la Pladicop los actos de las tres fases, salvo aquellos que el Reglamento asigna a los evaluadores u otros actores (Reglamento, Art. 14.2.a): los comités registran sus actas (Reglamento, Art. 59.5.c) y los jurados comunican sus prórrogas a la DEC para que esta las registre (Reglamento, Art. 60.3).",
```

  En `puntosClave` añade: `"La DEC no registra todo: los comités registran sus actas y los jurados comunican sus prórrogas a la DEC."`. En `baseLegal` añade `{ norma: "Reglamento", articulo: "59" }` y `{ norma: "Reglamento", articulo: "60" }`.

  **3d. Clase `evaluadores`** — en el bloque «¿De qué responde cada uno?», tras el primer párrafo añade:

```ts
"Excepción: en los procedimientos con subetapas de negociación o diálogo competitivo, el jurado conduce las rondas y decide de forma colegiada y por mayoría; se integra además por al menos un servidor del área usuaria, que la representa y emite la no objeción a las modificaciones del requerimiento (Reglamento, Art. 60.4).",
```

  En `puntosClave` añade: `"Con negociación o diálogo competitivo, el jurado conduce las rondas, no la DEC."`. En `baseLegal` añade `{ norma: "Reglamento", articulo: "60" }`.

  **3e. Clase `expediente-contratacion`** — en el bloque «¿Qué documentos debe tener para aprobarse?», tras el último párrafo añade:

```ts
"En el MDA el proceso empieza con el requerimiento y las actuaciones preparatorias aplican sin segmentación ni interacción con el mercado (Reglamento, Art. 295.1); el expediente no incorpora lo que la interacción produciría en otros regímenes.",
```

  En `puntosClave` añade: `"MDA: actuaciones preparatorias sin segmentación ni interacción con el mercado."`. En `baseLegal` añade `{ norma: "Reglamento", articulo: "295" }`.

  **3f. Clase `recurso-apelacion`** — en el bloque «¿Ante quién se presenta?», añade un segundo párrafo:

```ts
"La facultad de la autoridad de la gestión administrativa de resolver apelaciones es indelegable. Y con independencia de la cuantía, la declaración de nulidad de oficio y la cancelación del procedimiento se impugnan ante el Tribunal de Contrataciones Públicas (Reglamento, Art. 302).",
```

  En `puntosClave` añade: `"Nulidad de oficio y cancelación: siempre ante el TCP, sin importar la cuantía."` y `"La AGA resuelve las apelaciones de forma indelegable."`. En `baseLegal` añade `{ norma: "Reglamento", articulo: "302" }`.

- [ ] **Paso 4:** `npx vitest run tests/cursos-catalogo.test.ts` → PASA. `npm run typecheck`.
- [ ] **Paso 5: commit**

```bash
git add lib/cursos/contenido tests/cursos-catalogo.test.ts
git commit -m "fix(cursos): ensena las reglas vigentes de segmentacion, apelacion, jurado, mda y pladicop"
```

---

### Tarea 2: Tipo de casuística y pestaña en la clase

**Ficheros:**
- Modify: `lib/cursos/tipos.ts`
- Modify: `app/components/cursos/pestanas-clase.tsx`
- Test: `tests/cursos-catalogo.test.ts`

**Interfaces:**
- Produce: `type Casuistica = { enunciado: string; resolucion: string; baseLegal: BaseLegal[] }`; `ContenidoClase.casuisticas?: Casuistica[]` (opcional para no romper futuros cursos; la exigencia de contenido se impone por test en la Tarea 6).
- La pestaña no se muestra si `casuisticas` está vacío.

- [ ] **Paso 1: tipo** — en `lib/cursos/tipos.ts`, tras `BaseLegal`:

```ts
export type Casuistica = {
  /** Situación tipo examen: hechos concretos que piden decidir algo. */
  enunciado: string;
  /** Cómo se resuelve: la regla aplicada al caso, con la cifra o el plazo exacto. */
  resolucion: string;
  /** Artículos que sostienen la resolución. Se muestran como texto, sin enlace. */
  baseLegal: BaseLegal[];
};
```

  y dentro de `ContenidoClase`, tras `puntosClave`:

```ts
/** Casos tipo examen para ensayar la regla de la clase. */
casuisticas?: Casuistica[];
```

- [ ] **Paso 2: pestaña** — en `pestanas-clase.tsx`: importa `ClipboardList` de `lucide-react` y añade al array `pestanas` la entrada `{ id: "casuistica" as const, label: "Casuística", icono: ClipboardList }`; el estado pasa a `"resumen" | "base" | "casuistica"`. Tras el panel `panel-base` añade:

```tsx
<div id="panel-casuistica" role="tabpanel" aria-labelledby="pestana-casuistica" hidden={activa !== "casuistica"} className="p-5 sm:p-6">
  {!contenido.casuisticas?.length ? (
    <p className="m-0 text-sm text-muted">Esta clase aún no tiene casuísticas.</p>
  ) : (
    <>
      <p className="mb-5 mt-0 text-sm text-muted">
        Casos tipo examen. Lee la situación, piensa tu respuesta y compárala con la resolución.
      </p>
      <div className="space-y-5">
        {contenido.casuisticas.map((c, i) => (
          <CasoClave key={c.enunciado} indice={i + 1} caso={c} />
        ))}
      </div>
    </>
  )}
</div>
```

  y al final del fichero el componente de caso (revelado por caso, accesible):

```tsx
function CasoClave({ indice, caso }: { indice: number; caso: NonNullable<ContenidoClase["casuisticas"]>[number] }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <article className="rounded-xl border border-line bg-surface p-4">
      <h4 className="mb-2 mt-0 text-sm font-semibold uppercase tracking-wide text-brand">Caso {indice}</h4>
      <p className="mb-3 mt-0 text-[15px] leading-relaxed text-ink">{caso.enunciado}</p>
      <button
        type="button"
        className="mb-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-soft px-4 font-semibold text-brand-dark outline-none hover:bg-brand/15 focus-visible:shadow-[var(--shadow-focus)]"
        aria-expanded={abierta}
        aria-controls={`caso-${indice}-resolucion`}
        onClick={() => setAbierta(v => !v)}
      >
        <ClipboardList size={16} aria-hidden />
        {abierta ? "Ocultar la resolución" : "Ver cómo se resuelve"}
      </button>
      <div id={`caso-${indice}-resolucion`} hidden={!abierta} className="space-y-3 rounded-xl bg-panel p-4">
        <p className="m-0 text-[15px] leading-relaxed text-ink">{caso.resolucion}</p>
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          {caso.baseLegal.map(b => (
            <li key={`${b.norma}-${b.articulo}`} className="rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted">
              {b.norma} · Art. {b.articulo}
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
```

- [ ] **Paso 3:** `npm run typecheck` → PASA (la pestaña no aparece porque ninguna clase tiene casuísticas todavía; el `hidden` del panel la mantiene fuera del flujo).
- [ ] **Paso 4:** `npx vitest run tests/cursos-catalogo.test.ts` → PASA.
- [ ] **Paso 5: commit**

```bash
git add lib/cursos/tipos.ts app/components/cursos/pestanas-clase.tsx
git commit -m "feat(cursos): pestana de casuistica con revelado por caso en la clase"
```

---

### Tarea 3: Casuísticas de las clases de actos preparatorios

**Fichero:** Modify `lib/cursos/contenido/actos-preparatorios.ts` — añade `casuisticas: [...]` al `contenido` de las 7 clases. Toda regla que aparece aquí ya está en la clase (verificada) o en las correcciones de la Tarea 1.

- [ ] **Paso 1:** pega `casuisticas` dentro de cada `contenido` (tras `baseLegal`):

**`actores-involucrados`:**

```ts
casuisticas: [
  {
    enunciado: "La DEC recibe un requerimiento de mobiliario y observa dos cosas: la necesidad no está registrada en el CMN y la marca de los escritorios no le parece la más conveniente. ¿Qué puede hacer la DEC?",
    resolucion: "La DEC verifica que la necesidad esté registrada y aprobada en el CMN y sus modificaciones, pero su participación en el requerimiento alcanza solo lo normativo de la contratación: los aspectos técnicos de la necesidad son responsabilidad del área usuaria, así que la DEC no puede cambiar la marca.",
    baseLegal: [{ norma: "Reglamento", articulo: "14" }],
  },
  {
    enunciado: "Termina la entrega de un servicio de mantenimiento y el jefe de la DEC quiere emitir él mismo la conformidad para agilizar el pago. ¿Corresponde?",
    resolucion: "No. La conformidad de la prestación la emite el área usuaria, que además verificó el cumplimiento del contrato; la DEC gestiona el contrato, no lo recibe.",
    baseLegal: [{ norma: "Reglamento", articulo: "20" }],
  },
  {
    enunciado: "En un concurso público abreviado a cargo de un comité, la evaluación necesita una prórroga. El comprador público de la DEC quiere registrarla él en la Pladicop «porque la DEC registra los actos de las tres fases». ¿Es correcto?",
    resolucion: "No. La regla general de la DEC tiene excepciones: los comités registran sus acuerdos y votos en actas en la Pladicop. Si el evaluador fuera un jurado, este comunica la prórroga a la DEC para que esta la registre.",
    baseLegal: [{ norma: "Reglamento", articulo: "14" }, { norma: "Reglamento", articulo: "59" }, { norma: "Reglamento", articulo: "60" }],
  },
],
```

**`modalidades-contratacion-eficiente`:**

```ts
casuisticas: [
  {
    enunciado: "Una entidad necesita comprar útiles de oficina por un monto equivalente a 6 UIT. El área usuaria pide «un procedimiento rápido». ¿Qué figura corresponde?",
    resolucion: "El contrato menor: monto igual o inferior a 8 UIT vigentes al momento de la contratación, sin procedimiento de selección, sujeto a supervisión del OECE y con publicación de la información en la Pladicop.",
    baseLegal: [{ norma: "Ley 32069", articulo: "34" }],
  },
  {
    enunciado: "Un ministerio quiere que Perú Compras se encargue no solo de seleccionar sino también de ejecutar, liquidar y pagar la contratación. ¿Es la compra por encargo?",
    resolucion: "No. La compra por encargo cubre solo las fases de actuaciones preparatorias o de selección, mediante convenio. Lo que describe es la compra centralizada: todas las fases hasta la liquidación o el pago total, con posible transferencia de partidas.",
    baseLegal: [{ norma: "Ley 32069", articulo: "35" }, { norma: "Ley 32069", articulo: "36" }],
  },
  {
    enunciado: "Dos entidades públicas necesitan el mismo servicio de vigilancia y quieren juntarse para conseguir mejor precio. ¿Pueden?",
    resolucion: "Sí, mediante compra corporativa: dos o más entidades consolidan la contratación de bienes y servicios para necesidades comunes. Puede ser facultativa u obligatoria; la obligatoria está a cargo de Perú Compras.",
    baseLegal: [{ norma: "Ley 32069", articulo: "37" }],
  },
],
```

**`expediente-contratacion`:**

```ts
casuisticas: [
  {
    enunciado: "Un hospital del Ministerio de Salud arma el expediente de una contratación por MDA e incluye la segmentación y una ronda de interacción con el mercado «para cumplir el expediente completo». ¿Corresponde?",
    resolucion: "No. En el MDA el proceso se inicia con el requerimiento y las actuaciones preparatorias aplican sin segmentación ni interacción con el mercado.",
    baseLegal: [{ norma: "Reglamento", articulo: "295" }],
  },
  {
    enunciado: "La autoridad de la gestión administrativa duda en aprobar un expediente porque la necesidad no aparece en el CMN aprobado ni en su modificatoria. ¿Puede aprobarlo de todos modos si hay presupuesto?",
    resolucion: "No. Para aprobar el expediente la necesidad debe estar prevista en el CMN aprobado del año fiscal o en su modificatoria; sin expediente aprobado y bases elaboradas tampoco se puede convocar.",
    baseLegal: [{ norma: "Reglamento", articulo: "54" }, { norma: "Reglamento", articulo: "63" }],
  },
  {
    enunciado: "Una licitación pública se declara desierta y la necesidad persiste. ¿Hay que volver a aprobar el expediente para la nueva convocatoria?",
    resolucion: "Por regla general, no: la siguiente convocatoria del procedimiento declarado desierto no exige aprobar de nuevo el expediente.",
    baseLegal: [{ norma: "Reglamento", articulo: "63" }],
  },
],
```

**`plan-anual-contrataciones`:**

```ts
casuisticas: [
  {
    enunciado: "A mitad de año surge una contratación no programada, pero la necesidad sí está incluida en el CMN respectivo. ¿La DEC espera a que el área usuaria pida modificar el CMN antes de segmentar?",
    resolucion: "No. Con la necesidad ya incluida en el CMN, la DEC efectúa la segmentación luego de la recepción del requerimiento (Art. 42.3, texto sustituido por el D.S. 001-2026-EF).",
    baseLegal: [{ norma: "Reglamento", articulo: "42" }],
  },
  {
    enunciado: "Perú Compras asume la compra centralizada de dos puentes para varias entidades. ¿Quién segmenta esa contratación y en qué categoría cae?",
    resolucion: "La segmentación la realiza la entidad encargada al inicio de las actuaciones preparatorias, y las compras centralizadas de obras se consideran en la categoría de contratación avanzada.",
    baseLegal: [{ norma: "Reglamento", articulo: "42" }],
  },
  {
    enunciado: "La DEC quiere segmentar una contratación que se hará por un catálogo electrónico de acuerdos marco. ¿Procede?",
    resolucion: "No. Los catálogos electrónicos de acuerdos marco, los procedimientos no competitivos y los supuestos excluidos no se segmentan.",
    baseLegal: [{ norma: "Reglamento", articulo: "42" }],
  },
],
```

**`segmentacion-contrataciones`:**

```ts
casuisticas: [
  {
    enunciado: "En el PAC del CMN, una contratación de servicios informáticos representa el 14 % del monto total destinado a bienes y servicios del año. ¿Es de alta cuantía?",
    resolucion: "Sí. La contratación es de alta cuantía cuando su cuantía en el PAC del CMN supera el 10 % del monto total de las contrataciones de bienes y servicios contempladas en él.",
    baseLegal: [{ norma: "Reglamento", articulo: "125" }],
  },
  {
    enunciado: "La compra anual de papelería y el arrendamiento de la plataforma de trámite documental del mismo PAC del CMN. ¿Qué categoría le toca a cada una?",
    resolucion: "La papelería es de baja cuantía y bajo riesgo: rutinaria. El arrendamiento de la plataforma, si es de alta cuantía y bajo riesgo: operacional. Las cuatro categorías se definen por cuantía y riesgo.",
    baseLegal: [{ norma: "Reglamento", articulo: "125" }],
  },
  {
    enunciado: "Un hospital programa una contratación por MDA y la DEC la segmenta «porque se segmenta todo el PAC». ¿Es correcto?",
    resolucion: "No. El MDA no se segmenta: sus actuaciones preparatorias aplican sin segmentación ni interacción con el mercado.",
    baseLegal: [{ norma: "Reglamento", articulo: "295" }],
  },
],
```

**`actos-preparatorios`:**

```ts
casuisticas: [
  {
    enunciado: "El área usuaria propone dividir la adquisición anual de reactivos en cuatro contratos menores trimestrales «para agilizar». ¿Es válido?",
    resolucion: "No. Está prohibido fraccionar: dividir una contratación en dos o más procedimientos o contratos menores para evitar el procedimiento que corresponde según la necesidad anual o para evadir la Ley y su Reglamento.",
    baseLegal: [{ norma: "Ley 32069", articulo: "50" }],
  },
  {
    enunciado: "La DEC recibe del área usuaria un requerimiento ya cerrado, sin haber participado en su formulación. ¿Cumple el proceso?",
    resolucion: "No. El requerimiento lo determina el área usuaria o el área técnica estratégica en coordinación con la DEC, e identifica la finalidad pública y los objetivos de la contratación.",
    baseLegal: [{ norma: "Ley 32069", articulo: "46" }],
  },
  {
    enunciado: "Ante un requerimiento de poca oferta en el mercado, la DEC quiere obligar a todos los proveedores a una consulta al mercado. ¿Puede?",
    resolucion: "La interacción con el mercado sirve para perfeccionar el requerimiento, actualizar la cuantía y medir la oferta y el riesgo, y puede ser indagación o consulta al mercado: la DEC elige el tipo, no impone uno solo.",
    baseLegal: [{ norma: "Ley 32069", articulo: "47" }, { norma: "Reglamento", articulo: "47" }],
  },
],
```

**`evaluadores`:**

```ts
casuisticas: [
  {
    enunciado: "Un concurso público con subetapa de diálogo competitivo está a cargo de un jurado. ¿Quién conduce las rondas del diálogo?",
    resolucion: "El jurado conduce las rondas y determina de forma colegiada y por mayoría las decisiones; además, está conformado por al menos un servidor del área usuaria, que la representa y emite la no objeción a las modificaciones del requerimiento.",
    baseLegal: [{ norma: "Reglamento", articulo: "60" }],
  },
  {
    enunciado: "La DEC designa un comité de dos integrantes: un comprador público y un experto. ¿Es válido?",
    resolucion: "No. El comité son tres integrantes, de los cuales al menos uno es comprador público de la DEC y uno experto o profesional con conocimiento técnico o experiencia en el objeto; titulares y suplentes los designa la autoridad de la gestión administrativa.",
    baseLegal: [{ norma: "Reglamento", articulo: "56" }, { norma: "Reglamento", articulo: "59" }],
  },
  {
    enunciado: "El único comprador público certificado ya conduce otros dos procedimientos. ¿Puede ser oficial de compra de un tercero?",
    resolucion: "Sí. Un oficial de compra puede ser designado en más de un procedimiento de selección simultáneamente; lo designa la DEC.",
    baseLegal: [{ norma: "Reglamento", articulo: "58" }],
  },
],
```

- [ ] **Paso 2:** `npx vitest run tests/cursos-catalogo.test.ts` → PASA · `npm run typecheck`.
- [ ] **Paso 3: commit** — `git commit -m "docs(cursos): casuisticas tipo examen en las clases de actos preparatorios"`.

---

### Tarea 4: Casuísticas de las clases de fase de selección

**Fichero:** Modify `lib/cursos/contenido/fase-seleccion.ts` — `casuisticas` para las 3 clases.

- [ ] **Paso 1:**

**`mecanismo-diferenciado-adquisicion`:**

```ts
casuisticas: [
  {
    enunciado: "Una municipalidad provincial quiere contratar por MDA una tecnología sanitaria para pacientes oncológicos. ¿Puede?",
    resolucion: "No. El MDA está reservado al Ministerio de Salud, EsSalud, las sanidades de la PNP y de las Fuerzas Armadas, las entidades del Sistema Nacional de Salud autorizadas por resolución ministerial y, conforme a la Ley Nacional del Cáncer, el INEN.",
    baseLegal: [{ norma: "Ley 32069", articulo: "44" }, { norma: "Reglamento", articulo: "293" }],
  },
  {
    enunciado: "En un acuerdo MDA, el pago al proveedor depende de que los pacientes respondan al tratamiento: si no responden, el proveedor asume parte del costo. ¿Qué tipo de acuerdo es?",
    resolucion: "Un acuerdo de riesgo compartido. Los MDA pueden ser de tipo financiero, de riesgo compartido o híbridos.",
    baseLegal: [{ norma: "Ley 32069", articulo: "44" }],
  },
  {
    enunciado: "Para un MDA de dos tecnologías que tratan la misma patología, ¿cuántos procedimientos de selección se convocan?",
    resolucion: "Uno solo: si existe más de una tecnología sanitaria para la misma patología, se realiza un único procedimiento y en la fase de negociación la buena pro va a la que evidencie mejores condiciones contractuales, por costo-efectividad y valor por dinero.",
    baseLegal: [{ norma: "Reglamento", articulo: "295" }],
  },
],
```

**`procedimientos-seleccion`:**

```ts
casuisticas: [
  {
    enunciado: "Una entidad necesita contratar el mantenimiento preventivo de sus ascensores. ¿Qué procedimiento competitivo corresponde?",
    resolucion: "El concurso público: los servicios se contratan por concurso público, como la licitación pública corresponde a bienes y obras.",
    baseLegal: [{ norma: "Ley 32069", articulo: "54" }],
  },
  {
    enunciado: "Las lluvias destruyen vías rurales de una municipalidad y hay que contratara la maquinaria de inmediato. ¿Qué procedimiento cabe y quién lo aprueba?",
    resolucion: "La contratación directa por situación de emergencia, del artículo 55 de la Ley, y la aprueba el titular de la entidad.",
    baseLegal: [{ norma: "Ley 32069", articulo: "55" }, { norma: "Reglamento", articulo: "18" }],
  },
  {
    enunciado: "La buena pro quedó consentida el jueves y el equipo quiere contar el plazo de presentación de requisitos desde ese mismo jueves. ¿Está bien?",
    resolucion: "No. Los plazos de la fase de selección se cuentan en días hábiles, sin el día inicial y con el de vencimiento: los ocho días hábiles del postor corren desde el día siguiente al registro del consentimiento en la Pladicop.",
    baseLegal: [{ norma: "Reglamento", articulo: "62" }, { norma: "Reglamento", articulo: "90" }],
  },
],
```

**`recurso-apelacion`:**

```ts
casuisticas: [
  {
    enunciado: "Una entidad cancela un procedimiento cuya cuantía es de 30 UIT y un participante quiere apelar esa cancelación. ¿Ante quién la presenta?",
    resolucion: "Ante el Tribunal de Contrataciones Públicas. La cancelación del procedimiento y la declaración de nulidad de oficio se impugnan ante el TCP con independencia de la cuantía; la regla de los 50 UIT no aplica aquí.",
    baseLegal: [{ norma: "Reglamento", articulo: "302" }],
  },
  {
    enunciado: "Un postor apela un procedimiento cuya cuantía es el equivalente a 400 000 UIT. ¿Cuánta garantía presenta una MYPE y cuánta una empresa grande?",
    resolucion: "La empresa grande: 3 % de la cuantía, con tope de 300 UIT. La MYPE: 0,5 %, con tope de 25 UIT.",
    baseLegal: [{ norma: "Ley 32069", articulo: "73" }, { norma: "Reglamento", articulo: "309" }],
  },
  {
    enunciado: "Vence el plazo para que la autoridad de la gestión administrativa resuelva una apelación y no hay resolución notificada. ¿Qué queda para el impugnante?",
    resolucion: "Opera la denegatoria ficta: el recurso se considera desestimado, se agota la vía administrativa y procede la acción contencioso-administrativa; la garantía se devuelve.",
    baseLegal: [{ norma: "Ley 32069", articulo: "75" }, { norma: "Reglamento", articulo: "316" }, { norma: "Reglamento", articulo: "317" }],
  },
],
```

- [ ] **Paso 2:** `npx vitest run tests/cursos-catalogo.test.ts` → PASA · `npm run typecheck`.
- [ ] **Paso 3: commit** — `git commit -m "docs(cursos): casuisticas tipo examen en las clases de seleccion"`.

---

### Tarea 5: Casuísticas de las clases de ejecución contractual

**Fichero:** Modify `lib/cursos/contenido/ejecucion-contractual.ts` — `casuisticas` para las 5 clases.

- [ ] **Paso 1:**

**`perfeccionamiento-contrato`:**

```ts
casuisticas: [
  {
    enunciado: "La buena pro de una licitación pública abreviada de bienes quedó consentida y las bases no exigen garantía de fiel cumplimiento. ¿Cuántos días hábiles tiene el postor para presentar sus requisitos?",
    resolucion: "Cinco días hábiles. El plazo general es de ocho, pero baja a cinco cuando no se exige garantía de fiel cumplimiento.",
    baseLegal: [{ norma: "Reglamento", articulo: "90" }],
  },
  {
    enunciado: "Una compra por comparación de precios debe ejecutarse dentro del año fiscal y las bases prevén el perfeccionamiento con orden de compra. ¿Hace falta suscribir contrato?",
    resolucion: "No. En los procedimientos que el Reglamento permite (licitaciones públicas abreviadas para bienes, concursos públicos abreviados y comparación de precios), si las bases lo prevén y la ejecución no supera el año fiscal, el contrato se perfecciona con la recepción de la orden de compra o de servicio.",
    baseLegal: [{ norma: "Reglamento", articulo: "87" }],
  },
  {
    enunciado: "El postor ganador tiene multas impagas de otro contrato. ¿Se le suspende la suscripción?",
    resolucion: "No: antes de suscribir se incorpora una cláusula de compromiso de pago de las multas, que se cumple mediante retención.",
    baseLegal: [{ norma: "Ley 32069", articulo: "58" }],
  },
],
```

**`garantias`:**

```ts
casuisticas: [
  {
    enunciado: "Un contrato de servicios por S/ 800 000 está por suscribirse. ¿De cuánto es la garantía de fiel cumplimiento?",
    resolucion: "De S/ 80 000: el 10 % del monto del contrato original, requisito indispensable para perfeccionar el contrato.",
    baseLegal: [{ norma: "Reglamento", articulo: "113" }],
  },
  {
    enunciado: "Un contratista pide el adelanto de pago y ofrece garantizarlo con retención del propio pago. ¿Se acepta?",
    resolucion: "No. La retención de pago sirve para el fiel cumplimiento y las prestaciones accesorias, pero no para garantizar el adelanto; para el adelanto proceden fideicomiso, carta fianza financiera o contrato de seguro.",
    baseLegal: [{ norma: "Ley 32069", articulo: "61" }],
  },
  {
    enunciado: "Un contrato de suministro de 60 días calendario propone garantía de fiel cumplimiento por fideicomiso. ¿Procede?",
    resolucion: "No. En bienes y servicios, el fideicomiso como garantía de fiel cumplimiento solo procede si el plazo de ejecución supera noventa días calendario.",
    baseLegal: [{ norma: "Reglamento", articulo: "138" }],
  },
],
```

**`modificaciones-contrato`:**

```ts
casuisticas: [
  {
    enunciado: "Un contrato de servicios de S/ 1 000 000 necesita una prestación adicional de S/ 260 000 indispensable para la finalidad. ¿Puede aprobarse?",
    resolucion: "No. En bienes, servicios y consultorías de obras la autoridad de la gestión administrativa solo puede autorizar adicionales hasta el 25 % del monto del contrato original: S/ 250 000 en este caso.",
    baseLegal: [{ norma: "Ley 32069", articulo: "64" }],
  },
  {
    enunciado: "En una obra bajo solo construcción ya se aprobaron adicionales por 12 % del contrato original (menos los deductivos vinculados) y ahora se pide llegar al 20 %. ¿Quién autoriza? ¿Y si se pidiera llegar al 35 %?",
    resolucion: "Hasta el 15 % autoriza la autoridad de la gestión administrativa; por encima del 15 % y hasta el 30 %, el titular, si cuenta con los recursos. Para pasar del 30 % hasta el 50 % se requiere además la autorización previa de la Contraloría; y en conjunto los adicionales no pueden superar el 50 % del contrato original, porque de lo contrario el contrato se resuelve.",
    baseLegal: [{ norma: "Ley 32069", articulo: "64" }, { norma: "Reglamento", articulo: "194" }],
  },
  {
    enunciado: "La entidad ya recibió parte de los bienes y quiere reducir el contrato en 20 %. ¿Cómo se formaliza la reducción?",
    resolucion: "Con resolución de la autoridad de la gestión administrativa, hasta el 25 % del monto del contrato original, siempre que las prestaciones por reducir no hayan sido ejecutadas y sean cuantificables y divisibles. No se suscribe adenda: basta publicar la resolución en la Pladicop.",
    baseLegal: [{ norma: "Ley 32069", articulo: "64" }, { norma: "Reglamento", articulo: "109" }],
  },
],
```

**`resolucion-nulidad-contrato`:**

```ts
casuisticas: [
  {
    enunciado: "Un contrato de 200 días tiene un ítem incumplido cuyo plazo venció a los 100 días. ¿Entre cuántos días debe fijarse el requerimiento previo de subsanación? ¿Y si el cálculo da 12,5 días?",
    resolucion: "El plazo no puede ser menor al 10 % ni mayor al 15 % del plazo del ítem incumplido: aquí, entre 10 y 15 días. Si el cálculo da decimal, se redondea a favor del contratista.",
    baseLegal: [{ norma: "Reglamento", articulo: "122" }],
  },
  {
    enunciado: "Una entidad suscribió el contrato mientras aún estaba en trámite un recurso de apelación. ¿El contrato es válido?",
    resolucion: "Es causal de nulidad del contrato, que declara la autoridad de la gestión administrativa. Suscribir con una apelación en trámite está entre los supuestos de nulidad.",
    baseLegal: [{ norma: "Ley 32069", articulo: "71" }, { norma: "Reglamento", articulo: "19" }],
  },
  {
    enunciado: "Se descubrió documentación falsa: en un caso sustentó la buena pro; en el otro, solo la ejecución del contrato. ¿Es lo mismo?",
    resolucion: "No. La documentación falsa o inexacta presentada en la ejecución es causal de resolución del contrato; la que sustentó el otorgamiento de la buena pro es causal de nulidad.",
    baseLegal: [{ norma: "Ley 32069", articulo: "68" }, { norma: "Ley 32069", articulo: "71" }],
  },
],
```

**`resolucion-controversias`:**

```ts
casuisticas: [
  {
    enunciado: "En un contrato de obras con JPRD, una parte pide que la junta declare la nulidad del contrato. ¿Puede conocerla?",
    resolucion: "No. La JPRD absuelve consultas y resuelve controversias técnicas y contractuales, pero no puede conocer la validez, la nulidad ni la eficacia del contrato.",
    baseLegal: [{ norma: "Ley 32069", articulo: "79" }],
  },
  {
    enunciado: "Las partes de un contrato de obras quieren someter a conciliación la nulidad del contrato. ¿Se puede?",
    resolucion: "No. La nulidad del contrato no es materia conciliable; las controversias sobre validez, nulidad o eficacia se resuelven por arbitraje.",
    baseLegal: [{ norma: "Ley 32069", articulo: "81" }],
  },
  {
    enunciado: "¿Dónde debe constar el convenio arbitral de un contrato de la Ley 32069?",
    resolucion: "En el contrato: el convenio arbitral es una cláusula del contrato, y el arbitraje resuelve por defecto las controversias de validez, nulidad, interpretación, ejecución, terminación o eficacia.",
    baseLegal: [{ norma: "Ley 32069", articulo: "83" }],
  },
],
```

- [ ] **Paso 2:** `npx vitest run tests/cursos-catalogo.test.ts` → PASA · `npm run typecheck`.
- [ ] **Paso 3: commit** — `git commit -m "docs(cursos): casuisticas tipo examen en las clases de ejecucion contractual"`.

---

### Tarea 6: Casuísticas de las clases de obras y exigencia mínima

**Fichero:** Modify `lib/cursos/contenido/obras.ts` — `casuisticas` para las 3 clases. Modify `tests/cursos-catalogo.test.ts`.

- [ ] **Paso 1:**

**`incentivos-obras-consultoria`:**

```ts
casuisticas: [
  {
    enunciado: "En una obra bajo solo construcción el contratista terminó un componente antes de la fecha programada y obtuvo su conformidad. ¿Le corresponde algo?",
    resolucion: "El incentivo por cumplimiento anticipado: el pago del gasto general variable diario por los días de diferencia. En el sistema de solo construcción este incentivo es obligatorio y se fija en las bases.",
    baseLegal: [{ norma: "Reglamento", articulo: "162" }],
  },
  {
    enunciado: "La entidad quiere pagar la bonificación por excelencia en estándares ambientales y de seguridad equivalente al 3 % del contrato. ¿Es correcto?",
    resolucion: "No. Esa bonificación llega hasta el 1 % del monto del contrato original, solo para componentes de ejecución de obra; el 3 % corresponde al incentivo por respuesta rápida de la supervisión.",
    baseLegal: [{ norma: "Reglamento", articulo: "162" }],
  },
  {
    enunciado: "La supervisión se pronunció sobre todas las consultas del cuaderno de incidencias en la mitad del plazo previsto. ¿Gana algo?",
    resolucion: "Sí, el incentivo por respuesta rápida de la supervisión: si responde en un plazo igual o menor al 50 % del previsto, la bonificación llega hasta el 3 % del monto del contrato original.",
    baseLegal: [{ norma: "Reglamento", articulo: "162" }],
  },
],
```

**`inicio-plazo-vigencia-contrato`:**

```ts
casuisticas: [
  {
    enunciado: "La entidad ya entregó el terreno y la actualización del expediente técnico, pero aún no comunicó quién supervisará la obra. ¿Corre el plazo de ejecución?",
    resolucion: "No. El plazo de ejecución de la obra empieza solo cuando la entidad cumple todas las condiciones: actualización del expediente técnico, comunicación del supervisor, entrega del adelanto directo solicitado, contrato tripartito de la JPRD si corresponde y, en solo construcción, entrega del terreno.",
    baseLegal: [{ norma: "Reglamento", articulo: "176" }],
  },
  {
    enunciado: "El contratista solicitó adelanto directo y lo garantizó con fideicomiso. La entidad quiere retener el inicio del plazo hasta entregarlo. ¿Puede?",
    resolucion: "La entrega del adelanto directo es condición de inicio del plazo, pero esa condición no aplica cuando el adelanto se garantiza mediante fideicomiso.",
    baseLegal: [{ norma: "Reglamento", articulo: "176" }],
  },
  {
    enunciado: "En una obra por diseño y construcción ya se aprobó el expediente técnico. ¿Cuándo inicia la ejecución del componente obra?",
    resolucion: "La entidad pone el terreno a disposición del contratista durante la elaboración del diseño, y en un plazo máximo de veinte días computados desde el día siguiente de la aprobación del expediente técnico se inicia la ejecución del componente obra, notificando la aprobación y entregando el terreno.",
    baseLegal: [{ norma: "Reglamento", articulo: "176" }],
  },
],
```

**`intervencion-economica`:**

```ts
casuisticas: [
  {
    enunciado: "El contratista de una obra incumple de modo que, a juicio de la entidad, ya no podrá terminarla. ¿Qué medida cabe además de resolver el contrato?",
    resolucion: "La intervención económica de la obra, de oficio o a solicitud de parte: una medida técnica y económica para culminar la obra sin resolver el contrato.",
    baseLegal: [{ norma: "Reglamento", articulo: "208" }],
  },
  {
    enunciado: "Notificada la intervención económica, el contratista la rechaza. ¿Qué pasa?",
    resolucion: "El contrato se resuelve por incumplimiento.",
    baseLegal: [{ norma: "Reglamento", articulo: "208" }],
  },
  {
    enunciado: "La intervención se originó en incumplimientos del contratista. ¿Puede este reclamar mayores gastos generales o indemnización?",
    resolucion: "No. Cuando la intervención se debe a su incumplimiento, el contratista pierde el derecho a mayores gastos generales, indemnización o similares, sin quedar fuera del contrato ni de sus obligaciones.",
    baseLegal: [{ norma: "Reglamento", articulo: "208" }],
  },
],
```

- [ ] **Paso 2: exigencia** — añade a `tests/cursos-catalogo.test.ts`:

```ts
it("toda clase del taller presenta al menos tres casuísticas", () => {
  const curso = buscarCurso("certificacion-oece")!;
  for (const c of clasesEnOrden(curso)) {
    expect(c.contenido.casuisticas?.length ?? 0, c.slug).toBeGreaterThanOrEqual(3);
    for (const caso of c.contenido.casuisticas ?? []) {
      expect(caso.enunciado.length, c.slug).toBeGreaterThan(40);
      expect(caso.resolucion.length, c.slug).toBeGreaterThan(40);
      expect(caso.baseLegal.length, c.slug).toBeGreaterThan(0);
    }
  }
});
```

- [ ] **Paso 3:** `npx vitest run tests/cursos-catalogo.test.ts` → PASA · `npm run typecheck`.
- [ ] **Paso 4: commit** — `git commit -m "docs(cursos): casuisticas tipo examen en las clases de obras"`.

---

### Tarea 7: Cinco clases nuevas para los temas más preguntados

**Ficheros:**
- Modify: `lib/cursos/contenido/fase-seleccion.ts` (+1 clase), `ejecucion-contractual.ts` (+3 clases), `obras.ts` (+1 clase)
- Modify: `tests/cursos-catalogo.test.ts` (conteos)

**Interfaces:** consume `Clase` y `Casuistica`. Produce las clases `plazos-buena-pro-seleccion` (XIX), `modificaciones-procedimiento` (XX), `adelantos-penalidades-subcontratacion` (XXI), `suspension-reprogramacion-obra` (XXII), `contratos-estandarizados-internacionales` (XXIII). El temario pasa de 18 a 23 clases y los conteos de sección de `[7, 3, 5, 3]` a `[7, 4, 8, 4]`.

- [ ] **Paso 1: actualiza el test de conteos** (falla primero):

```ts
it("el taller OECE tiene 4 secciones y 23 clases (18 del aula + 5 de refuerzo)", () => {
  const c = buscarCurso("certificacion-oece")!;
  expect(c.secciones.map((s) => s.clases.length)).toEqual([7, 4, 8, 4]);
  expect(duracionTotal(c)).toBeGreaterThan(0);
});
```

  y el test de avance: `expect(avance(...)).toEqual({ hechas: 1, total: 23, porcentaje: 4 })` (1/23 = 4,35 → 4).

- [ ] **Paso 2: clase XIX** — añade al final de `FASE_SELECCION`:

```ts
{
  slug: "plazos-buena-pro-seleccion",
  modulo: "XIX",
  titulo: "Plazos, consentimiento y pérdida de la buena pro",
  descripcion:
    "Los plazos mínimos de cada etapa de la selección, cómo queda firme la buena pro y qué pasa cuando el postor ganador o la entidad incumplen al perfeccionar el contrato.",
  minutos: 9,
  contenido: {
    resumen: [
      {
        pregunta: "¿Cuánto dura cada etapa?",
        parrafos: [
          "Entre la convocatoria y la presentación de ofertas o los documentos de precalificación no pueden pasar menos de veintidós días hábiles, salvo en las modalidades abreviadas y las que no tienen etapa de consultas y observaciones (Reglamento, Art. 64.1). Las prórrogas de etapas se registran en la Pladicop modificando el cronograma (Art. 64.2).",
          "Con un anuncio de contratación futura publicado al menos cuarenta días calendario antes de la convocatoria, el plazo puede reducirse conforme a las bases estándar, nunca por debajo de diez días calendario (Art. 64.3).",
          "Las consultas y observaciones a las bases se presentan en no menos de siete días hábiles desde la convocatoria (tres en abreviadas) (Art. 66.1). Las ofertas se presentan en no menos de siete días hábiles desde la integración de bases (tres en abreviadas); sin etapa de consultas, no menos de seis días hábiles desde la convocatoria, y en comparación de precios, tres (Arts. 66.1 y 68).",
        ],
      },
      {
        pregunta: "¿Qué pasa si el área usuaria objeta un cambio del requerimiento durante las consultas?",
        parrafos: [
          "Si una consulta u observación obliga a precisar el requerimiento, los evaluadores proponen la modificación y piden la no objeción del área usuaria. Si esta objeta de manera sustentada, los evaluadores pueden modificar el requerimiento conforme pide el área usuaria o devolver el expediente a la DEC para que se evalúe la nulidad del procedimiento por no satisfacer la necesidad (Reglamento, Art. 66.5).",
        ],
      },
      {
        pregunta: "¿Cuándo queda consentida la buena pro?",
        parrafos: [
          "Con dos o más ofertas, al día siguiente de vencido el plazo de apelación sin que los postores hayan recurrido. Con una sola oferta, el mismo día de la notificación de su otorgamiento (Reglamento, Art. 82).",
        ],
      },
      {
        pregunta: "¿Qué pasa si alguien incumple al perfeccionar?",
        parrafos: [
          "Si la entidad no perfecciona el contrato en plazo, el postor ganador puede requerirle su cumplimiento dándole cinco días hábiles; vencido ese plazo, el postor queda libre de suscribir (Reglamento, Art. 91.1 y 91.2).",
          "Si es el postor quien incumple, pierde automáticamente la buena pro: la DEC requiere al segundo lugar, en un máximo de dos días hábiles desde la finalización del plazo de consentimiento de la pérdida, para que presente sus requisitos (Reglamento, Art. 91.3).",
        ],
      },
    ],
    puntosClave: [
      "Convocatoria a ofertas: mínimo 22 días hábiles; con anuncio futuro de 40 días calendario, mínimo 10 días calendario.",
      "Consultas: mínimo 7 días hábiles (3 en abreviadas). Ofertas: mínimo 7 desde integración (3 en abreviadas).",
      "Buena pro consentida: al día siguiente de vencer el plazo de apelación sin recurso; con oferta única, el mismo día de la notificación.",
      "Entidad que no perfecciona: requerimiento de 5 días hábiles y el postor queda libre. Postor que incumple: pierde la buena pro y sale el segundo lugar.",
    ],
    baseLegal: [
      { norma: "Reglamento", articulo: "64" },
      { norma: "Reglamento", articulo: "66" },
      { norma: "Reglamento", articulo: "68" },
      { norma: "Reglamento", articulo: "82" },
      { norma: "Reglamento", articulo: "91" },
    ],
    verificada: true,
    casuisticas: [
      {
        enunciado: "Una licitación pública publicó su convocatoria habiendo difundido 45 días antes un anuncio de contratación futura. ¿Puede convocar a ofertas con un plazo menor a 22 días hábiles?",
        resolucion: "Sí: con el anuncio publicado al menos 40 días calendario antes, el plazo puede reducirse conforme a las bases estándar, pero nunca por debajo de 10 días calendario.",
        baseLegal: [{ norma: "Reglamento", articulo: "64" }],
      },
      {
        enunciado: "En un procedimiento solo se presentó una oferta y la buena pro fue notificada el lunes. ¿Cuándo queda consentida?",
        resolucion: "El mismo día de la notificación de su otorgamiento; con dos o más ofertas, en cambio, se espera al día siguiente del vencimiento del plazo de apelación sin recurso.",
        baseLegal: [{ norma: "Reglamento", articulo: "82" }],
      },
      {
        enunciado: "El postor ganador no presenta sus requisitos y pierde la buena pro. ¿Cómo sigue el procedimiento?",
        resolucion: "La pérdida es automática y la DEC requiere al postor del segundo lugar, en un máximo de dos días hábiles desde la finalización del plazo de consentimiento de la pérdida, para que presente sus requisitos.",
        baseLegal: [{ norma: "Reglamento", articulo: "91" }],
      },
    ],
  },
},
```

- [ ] **Paso 3: clase XX** — añade al final de `EJECUCION_CONTRACTUAL`:

```ts
{
  slug: "modificaciones-procedimiento",
  modulo: "XX",
  titulo: "Modificaciones en bienes y servicios: trámite",
  descripcion:
    "Cómo se tramitan de verdad los adicionales, las reducciones y las ampliaciones de plazo en bienes y servicios: quién resuelve, en cuántos días y qué pasa si la entidad calla.",
  minutos: 9,
  contenido: {
    resumen: [
      {
        pregunta: "¿Cómo se aprueba una prestación adicional en bienes y servicios?",
        parrafos: [
          "La autoridad de la gestión administrativa la aprueba mediante resolución publicada en la Pladicop, hasta el 25 % del monto del contrato original, con sustento técnico y legal previo y con la certificación o previsión presupuestaria (Reglamento, Art. 141.1).",
          "El costo se determina con las especificaciones o términos de referencia y los precios pactados; a falta de estos, la DEC, con el área usuaria, determina el monto considerando la estructura de costos presentada por el contratista (Art. 141.2).",
          "No se suscribe adenda: basta la publicación de la resolución en la Pladicop, y está prohibido aprobar adicionales en vía de regularización (Art. 141.3).",
        ],
      },
      {
        pregunta: "¿Y una reducción de prestaciones?",
        parrafos: [
          "La autoridad de la gestión administrativa la ordena mediante resolución, hasta el 25 % del monto del contrato original, siempre que la falta de esas prestaciones no impida la finalidad, que sean divisibles y cuantificables, que no estén ejecutadas y que se apruebe antes de la conformidad final o del acta de recepción; en obras, con opinión del supervisor (Reglamento, Art. 109.1).",
          "En la misma resolución se determina si reduce el plazo. No se suscribe adenda: basta publicar la resolución en la Pladicop (Arts. 109.2 y 109.3).",
        ],
      },
      {
        pregunta: "¿Cómo se tramita una ampliación de plazo?",
        parrafos: [
          "El contratista la solicita dentro de los diez días hábiles siguientes a la notificación del adicional o de finalizado el atraso o paralización no imputable, y puede pedir dentro de ese plazo una prórroga de hasta diez días hábiles más; las solicitudes extemporáneas se tienen por no presentadas (Reglamento, Art. 142.3).",
          "La autoridad de la gestión administrativa resuelve y notifica por la Pladicop dentro de los doce días hábiles; si no se pronuncia, la ampliación se tiene por aprobada, salvo que el contratista no haya cumplido el procedimiento (Art. 142.5). Las ampliaciones dan lugar al pago de costos y gastos generales acreditados (Art. 142.7).",
        ],
      },
      {
        pregunta: "¿Cuándo se puede ceder la posición contractual?",
        parrafos: [
          "El contratista solo la cede en casos de transferencia de bienes arrendados a la entidad, fusiones, escisiones o norma expresa que lo permita (Reglamento, Art. 112.1). Entre entidades, con sustento de la DEC, por traslado de funciones, extinción, fusión o absorción, desaparición de la necesidad acreditada por la cesionaria en su CMN, o norma expresa (Art. 112.2).",
        ],
      },
    ],
    puntosClave: [
      "Adicional de bienes y servicios: resolución de la AGA publicada en Pladicop, hasta 25 %, sin adenda y sin regularización.",
      "Reducción: resolución de la AGA hasta 25 %, prestaciones divisibles y no ejecutadas, antes de la conformidad final.",
      "Ampliación de plazo: solicitud en 10 días hábiles + prórroga de 10; la AGA resuelve en 12 y el silencio la aprueba.",
      "Cesión de posición contractual: solo en los casos cerrados del artículo 112 del Reglamento.",
    ],
    baseLegal: [
      { norma: "Ley 32069", articulo: "64" },
      { norma: "Reglamento", articulo: "109" },
      { norma: "Reglamento", articulo: "112" },
      { norma: "Reglamento", articulo: "141" },
      { norma: "Reglamento", articulo: "142" },
    ],
    verificada: true,
    casuisticas: [
      {
        enunciado: "Se aprobó un adicional de servicios y el contratista pide suscribir la adenda correspondiente. ¿Corresponde?",
        resolucion: "No. En bienes y servicios no se suscribe adenda por la aprobación de un adicional: basta con la publicación de la resolución en la Pladicop para que surta efectos.",
        baseLegal: [{ norma: "Reglamento", articulo: "141" }],
      },
      {
        enunciado: "El hecho generador del atraso terminó el lunes y el contratista recién presenta su solicitud de ampliación de plazo 15 días hábiles después, sin haber pedido prórroga. ¿Qué sigue?",
        resolucion: "La solicitud se tiene por no presentada: el plazo era de diez días hábiles, ampliables por prórroga de hasta diez más solo si se pidió dentro del plazo original.",
        baseLegal: [{ norma: "Reglamento", articulo: "142" }],
      },
      {
        enunciado: "Presentada la solicitud de ampliación de plazo, la autoridad de la gestión administrativa no resuelve ni notifica dentro del plazo. ¿Se perdió la ampliación?",
        resolucion: "No: si no hay pronunciamiento en los doce días hábiles, la ampliación se tiene por aprobada, salvo que el contratista no haya cumplido estrictamente el procedimiento de presentación.",
        baseLegal: [{ norma: "Reglamento", articulo: "142" }],
      },
    ],
  },
},
```

- [ ] **Paso 4: clase XXI** — añade a `EJECUCION_CONTRACTUAL`:

```ts
{
  slug: "adelantos-penalidades-subcontratacion",
  modulo: "XXI",
  titulo: "Adelantos, penalidades y subcontratación",
  descripcion:
    "Los topes de los adelantos y cómo se amortizan, el límite del 10 % de las penalidades y las reglas de la subcontratación, incluida la respuesta del silencio de la entidad.",
  minutos: 10,
  contenido: {
    resumen: [
      {
        pregunta: "¿Cuánto se puede adelantar en una obra?",
        parrafos: [
          "En obras bajo solo construcción, el adelanto directo y el adelanto para materiales e insumos, equipamiento y mobiliario no exceden, respectivamente, el 10 % y el 20 % del monto del contrato original; el adelanto por avance no excede el 10 % del monto del contrato original (Reglamento, Art. 178.3).",
          "En consultoría de obras solo proceden los adelantos directos y no procede garantizarlos con fideicomiso (Art. 178.2).",
        ],
      },
      {
        pregunta: "¿Cómo se amortizan?",
        parrafos: [
          "El adelanto directo se amortiza con descuentos proporcionales en cada una de las valorizaciones o pagos (Reglamento, Art. 180.1). El de materiales se amortiza conforme a la directiva de la DGA sobre fórmulas polinómicas, aceptándose la amortización total salvo que el saldo pendiente supere el monto de la valorización (Art. 180.2). Cualquier diferencia de una valorización se toma en cuenta en la posterior o en la liquidación (Art. 180.4).",
        ],
      },
      {
        pregunta: "¿Hasta dónde llegan las penalidades?",
        parrafos: [
          "La suma de la penalidad por mora y de las demás penalidades no puede exceder el 10 % del monto vigente del contrato o del ítem correspondiente. Se deducen de los pagos a cuenta o parciales, del pago o liquidación final, o de la ejecución de la garantía de fiel cumplimiento (Reglamento, Art. 119).",
        ],
      },
      {
        pregunta: "¿Qué se puede subcontratar?",
        parrafos: [
          "Hasta el 40 % del monto del contrato vigente de bienes, servicios u obras. En bienes y servicios, las bases pueden excluir prestaciones esenciales o prohibir la subcontratación si así se evaluó en la estrategia (Reglamento, Art. 108.1).",
          "La solicitud contiene el alcance y el RNP vigente del subcontratista, y la entidad resuelve en cinco días hábiles; si no se pronuncia, se entiende denegada (Arts. 108.2 y 108.3). No cabe subcontratar a los evaluadores expertos o especialistas técnicos de los contratos estandarizados (Art. 108.4).",
        ],
      },
    ],
    puntosClave: [
      "Solo construcción: adelanto directo 10 %, materiales 20 %, por avance 10 %, siempre del contrato original.",
      "Consultoría de obras: solo adelantos directos, nunca fideicomiso por adelanto.",
      "Penalidades (mora + otras): tope conjunto del 10 % del monto vigente del contrato o del ítem.",
      "Subcontratación: máximo 40 % del monto del contrato vigente; el silencio de la entidad la deniega.",
    ],
    baseLegal: [
      { norma: "Reglamento", articulo: "108" },
      { norma: "Reglamento", articulo: "119" },
      { norma: "Reglamento", articulo: "178" },
      { norma: "Reglamento", articulo: "180" },
    ],
    verificada: true,
    casuisticas: [
      {
        enunciado: "Un contrato de obra de S/ 2 000 000 propone adelanto directo de 12 % y adelanto para materiales de 20 %. ¿Es viable?",
        resolucion: "El adelanto para materiales sí (20 % del contrato original); el directo no: el tope es 10 %, es decir S/ 200 000.",
        baseLegal: [{ norma: "Reglamento", articulo: "178" }],
      },
      {
        enunciado: "El contratista pidió subcontratar parte del mantenimiento y la entidad no respondió en cinco días hábiles. ¿Puede empezar a subcontratar?",
        resolucion: "No. La entidad aprueba o deniega en cinco días hábiles y, si calla, la solicitud se entiende denegada.",
        baseLegal: [{ norma: "Reglamento", articulo: "108" }],
      },
      {
        enunciado: "En un contrato, la mora acumulada suma 8 % del monto vigente y otras penalidades llegan a 4 %. ¿Se pueden aplicar todas?",
        resolucion: "No juntas: la suma de la mora y las demás penalidades no puede exceder el 10 % del monto vigente del contrato o del ítem. Las penalidades se cobran de los pagos o de la garantía.",
        baseLegal: [{ norma: "Reglamento", articulo: "119" }],
      },
    ],
  },
},
```

- [ ] **Paso 5: clase XXII** — añade al final de `OBRAS`:

```ts
{
  slug: "suspension-reprogramacion-obra",
  modulo: "XXII",
  titulo: "Suspensión, reprogramación y control de la obra",
  descripcion:
    "Cómo se suspende el plazo de ejecución de una obra (incluido el impago de valorizaciones), cómo se reprograma la obra atrasada y qué mide el supervisor para exigir un programa acelerado.",
  minutos: 11,
  contenido: {
    resumen: [
      {
        pregunta: "¿Cómo se suspende el plazo de ejecución de la obra?",
        parrafos: [
          "Por eventos no atribuibles a las partes que interrumpen la ejecución, las partes acuerdan por escrito la suspensión hasta que culmine el evento, sin reconocimiento de mayores gastos generales ni costos directos, salvo los necesarios para viabilizar la suspensión (Reglamento, Arts. 107.1 y 202.1).",
          "Culminado el evento, las partes suscriben un acta con la fecha de reinicio; si no hay acuerdo, la fecha la determina la entidad (Art. 107.2). La suspensión por causa imputable a la entidad requiere autorización previa de la autoridad de la gestión administrativa (Art. 107.5). Durante la suspensión no se ejecutan actividades del alcance del contrato, pero sí trámites de gestión como adicionales o valorizaciones pendientes (Art. 107.4). Reiniciado el plazo, la entidad comunica al contratista la modificación de las fechas del programa de ejecución actualizado (Art. 202.2).",
        ],
      },
      {
        pregunta: "¿Qué pasa si la entidad no paga las valorizaciones?",
        parrafos: [
          "La falta de pago de dos valorizaciones consecutivas suspende el plazo: el contratista requiere el pago de al menos una valorización pendiente en un plazo no mayor de diez días y, vencido ese plazo, el residente anota la suspensión en el cuaderno de incidencias, que inicia desde el día siguiente de la anotación. En ese caso la entidad reconoce los costos directos y mayores gastos generales vinculados y acreditados (Reglamento, Art. 202.3).",
        ],
      },
      {
        pregunta: "¿Cuándo se amplía el plazo de una obra?",
        parrafos: [
          "Solo por causales que modifiquen la ruta crítica del programa de ejecución vigente: atrasos o paralizaciones no imputables al contratista, la necesidad de plazo para ejecutar un adicional o los mayores metrados en contratos a precios unitarios o costo reembolsable (Reglamento, Arts. 198.1 y 175.1 para el presupuesto del diseño y construcción).",
          "El contratista notifica su solicitud en no más de diez días hábiles desde el hecho generador, con prórroga posible de hasta diez más; la supervisión opina en cinco días hábiles y la entidad resuelve en diez días hábiles. Si la entidad calla, se tiene por aprobado lo informado por el supervisor y, si este tampoco se pronunció, lo solicitado por el contratista (Art. 200.1).",
        ],
      },
      {
        pregunta: "¿Cuándo obliga el nuevo programa acelerado?",
        parrafos: [
          "Cuando en una valorización el supervisor verifica retraso injustificado: valorización acumulada ejecutada menor al 80 % de la programada o atraso en la ruta crítica. Entonces ordena un nuevo programa de ejecución acelerado y un calendario de avance valorizado acelerado, anotándolo en el cuaderno de incidencias (Reglamento, Art. 207.1).",
          "El contratista los presenta en siete días, el supervisor se pronuncia en cinco y la entidad puede observarlos en siete días hábiles; de lo contrario se consideran aprobados. No presentarlos puede activar la intervención económica o la resolución del contrato, sin apercibimiento (Arts. 207.2 y 207.5).",
        ],
      },
      {
        pregunta: "¿Qué pasa con la garantía al recibir la obra y con el personal clave?",
        parrafos: [
          "Recibida la obra y deducidas las penalidades de ese hito, el contratista puede pedir reducir la garantía de fiel cumplimiento al equivalente del 5 % del monto vigente, manteniendo un mecanismo de garantía por ese 5 % (Reglamento, Art. 183.2).",
          "La sustitución permanente de personal clave se solicita diez días hábiles antes de que opere, con reemplazante de perfil igual o mayor; si la entidad no se pronuncia, se considera autorizada, y hay penalidad si se sustituye al mismo integrante por segunda vez (Art. 189.3).",
        ],
      },
    ],
    puntosClave: [
      "Suspensión: acuerdo escrito por eventos no atribuibles; si la causa es de la entidad, autorización previa de la AGA.",
      "Dos valorizaciones impagas consecutivas: requireimiento de pago en 10 días, anotación del residente y suspensión al día siguiente.",
      "Ampliación de plazo en obra: solo causales que muevan la ruta crítica; silencio de la entidad = aprobado.",
      "Atraso (menos del 80 % valorizado o ruta crítica): programa acelerado en 7 días; no presentarlo habilita intervención económica o resolución.",
      "Tras la recepción, la garantía se puede reducir al 5 % del monto vigente; personal clave: aviso de 10 días hábiles y silencio que autoriza.",
    ],
    baseLegal: [
      { norma: "Reglamento", articulo: "107" },
      { norma: "Reglamento", articulo: "175" },
      { norma: "Reglamento", articulo: "183" },
      { norma: "Reglamento", articulo: "189" },
      { norma: "Reglamento", articulo: "198" },
      { norma: "Reglamento", articulo: "200" },
      { norma: "Reglamento", articulo: "202" },
      { norma: "Reglamento", articulo: "207" },
    ],
    verificada: true,
    casuisticas: [
      {
        enunciado: "La entidad lleva dos valorizaciones consecutivas sin pagar. ¿Qué debe hacer el contratista para suspender el plazo?",
        resolucion: "Requerir el pago de al menos una valorización pendiente otorgando un plazo no mayor de diez días; vencido ese plazo, el residente anota la suspensión en el cuaderno de incidencias y el plazo se suspende desde el día siguiente de la anotación, con reconocimiento de los costos vinculados y acreditados.",
        baseLegal: [{ norma: "Reglamento", articulo: "202" }],
      },
      {
        enunciado: "La valorización acumulada ejecutada llegó al 70 % de la programada. ¿Qué puede ordenar el supervisor?",
        resolucion: "Un nuevo programa de ejecución acelerado y un calendario de avance valorizado acelerado, por el retraso injustificado (menos del 80 %): el contratista los presenta en siete días, el supervisor opina en cinco y la entidad puede observar en siete días hábiles, caso contrario se aprueban.",
        baseLegal: [{ norma: "Reglamento", articulo: "207" }],
      },
      {
        enunciado: "El contratista pide ampliación de plazo por un atraso que no toca la ruta crítica del programa vigente. ¿Procede?",
        resolucion: "No. En obras, las causales de ampliación de plazo deben modificar la ruta crítica del programa de ejecución vigente al momento de la solicitud.",
        baseLegal: [{ norma: "Reglamento", articulo: "198" }],
      },
    ],
  },
},
```

- [ ] **Paso 6: clase XXIII** — añade a `EJECUCION_CONTRACTUAL`:

```ts
{
  slug: "contratos-estandarizados-internacionales",
  modulo: "XXIII",
  titulo: "Contratos estandarizados de uso internacional",
  descripcion:
    "Qué marco rige la selección y la ejecución de los contratos estandarizados de ingeniería y construcción de uso internacional, sus topes de modificación y sus cláusulas clave.",
  minutos: 8,
  contenido: {
    resumen: [
      {
        pregunta: "¿Qué norma los rige?",
        parrafos: [
          "Las contrataciones que usan contratos estandarizados de ingeniería y construcción de uso internacional se rigen por sus propios contratos: las modificaciones que inciden en el monto contractual no pueden exceder el 50 % del valor del presupuesto de obra consignado en el expediente técnico aprobado o, en solo construcción, del monto del contrato de obra (Ley, Art. 64.7; Reglamento, Art. 221.2.d). Si el 50 % se supera, se configura la terminación anticipada que ocasiona la resolución del contrato; el porcentaje no comprende las modificaciones que afecten el plazo.",
        ],
      },
      {
        pregunta: "¿Qué cláusulas debe traer la proforma?",
        parrafos: [
          "Las bases incluyen la proforma del contrato adaptada por la DEC y el área usuaria (Reglamento, Art. 221.1). Entre otras: comunicación honesta y colaboración entre las partes (Art. 221.2.a); responsabilidad única del contratista por sus terceros, incluido el plantel técnico (221.2.b); caso fortuito y vicios ocultos conforme a los artículos 1315 y 1326 del Código Civil (221.2.c); informe previo de la oficina de presupuesto cuando la modificación supere el 30 % (221.2.e); suspensión o resolución si no hay presupuesto (221.2.f); y en diseño y construcción, no aprobar modificaciones por deficiencias del expediente técnico imputables al propio contratista (221.2.g).",
        ],
      },
      {
        pregunta: "¿Qué particularidad tiene el diseño y construcción?",
        parrafos: [
          "El expediente técnico puede aprobarse con un presupuesto de obra incrementado hasta en 50 % del monto del componente considerado en el contrato original, con certificación presupuestal; eso no califica como prestación adicional. El contrato contempla la terminación anticipada por pérdida sobreviniente de viabilidad del proyecto o por motivos presupuestales (Reglamento, Art. 175).",
        ],
      },
      {
        pregunta: "¿Qué restricciones tienen?",
        parrafos: [
          "No cabe subcontratar a los evaluadores expertos o especialistas técnicos de estos contratos (Reglamento, Art. 108.4), y las prestaciones adicionales de tecnologías sanitarias del MDA están exceptuadas de los límites generales y se sujetan a sus contratos (Ley, Art. 64.8).",
        ],
      },
    ],
    puntosClave: [
      "Se rigen por sus propios contratos; las modificaciones de monto no pasan del 50 % del presupuesto de obra del ETO (o del contrato original en solo construcción).",
      "Superar el 50 % configura terminación anticipada que resuelve el contrato; las modificaciones de plazo no computan en el tope.",
      "Diseño y construcción: presupuesto aprobable hasta +50 % del componente; no es adicional.",
      "Ni subcontratación de evaluadores expertos ni límites para las tecnologías sanitarias del MDA.",
    ],
    baseLegal: [
      { norma: "Ley 32069", articulo: "64" },
      { norma: "Reglamento", articulo: "108" },
      { norma: "Reglamento", articulo: "175" },
      { norma: "Reglamento", articulo: "221" },
    ],
    verificada: true,
    casuisticas: [
      {
        enunciado: "En un contrato estandarizado de uso internacional quieren aprobar modificaciones de monto por el 55 % del presupuesto de obra del expediente técnico. ¿Se puede?",
        resolucion: "No. El tope es el 50 %; superarlo configura la condición de terminación anticipada que ocasiona la resolución del contrato. Las modificaciones que afectan el plazo no computan en ese porcentaje.",
        baseLegal: [{ norma: "Ley 32069", articulo: "64" }, { norma: "Reglamento", articulo: "221" }],
      },
      {
        enunciado: "En una obra por diseño y construcción, el error que motiva la modificación proviene del expediente técnico que elaboró el propio contratista. ¿Se aprueba?",
        resolucion: "No. En los sistemas donde el contratista elabora el expediente técnico, no se pueden aprobar modificaciones de monto que sean consecuencia de deficiencias o errores del expediente que le sean imputables.",
        baseLegal: [{ norma: "Reglamento", articulo: "221" }],
      },
      {
        enunciado: "El contratista de un contrato estandarizado quiere subcontratar al especialista técnico evaluador. ¿Cabe?",
        resolucion: "No. La subcontratación no procede para los evaluadores expertos o especialistas técnicos de los contratos estandarizados de ingeniería y construcción de uso internacional.",
        baseLegal: [{ norma: "Reglamento", articulo: "108" }],
      },
    ],
  },
},
```

- [ ] **Paso 7:** anota en la cabecera de `lib/cursos/certificacion-oece.ts` que las clases XIX–XXIII son de refuerzo de ACE (no del aula del taller), debajo del comentario existente:

```ts
// Las clases XIX–XXIII son de refuerzo añadidas por ACE tras el análisis de coherencia con los
// balotarios y el banco revisado (docs/evaluaciones/2026-11-17-coherencia-simulador-curso.md):
// cubren los bloques que el examen más pregunta y el aula original no desarrolla.
```

- [ ] **Paso 8:** `npx vitest run tests/cursos-catalogo.test.ts` → PASA (los 23 slugs únicos, conteos `[7, 4, 8, 4]`, avance 23 y las ≥3 casuísticas por clase) · `npm run typecheck`.
- [ ] **Paso 9: commit** — `git commit -m "feat(cursos): clases de refuerzo en plazos, modificaciones, adelantos, obra y estandarizados"`.

---

### Tarea 8: Práctica por tema en el simulador

**Ficheros:**
- Create: `lib/cursos/practica-tematica.ts`
- Create: `tests/practica-tematica.test.ts`
- Modify: `app/components/simulador-shell.tsx`, `app/components/balotarios/modulo.tsx`, `app/components/balotarios/recorrido.tsx`, `lib/cursos/certificacion-oece.ts`

**Interfaces:**
- Produce: `type TemaPractica = "actos-preparatorios" | "fase-seleccion" | "ejecucion-contractual" | "obras"`, `SECCION_POR_PREGUNTA: Record<string, TemaPractica>` (360 entradas), `ETIQUETAS_TEMA: { valor: TemaPractica; etiqueta: string }[]`, `preguntasDeTema(catalogo, tema): PreguntaBalotario[]`.
- URL: `/simulador?vista=practicar&tema=<TemaPractica>` preselecciona el tema; `/simulador?seccion=banco` abre el banco revisado.

- [ ] **Paso 1: mapa clase→sección y preguntas→sección.** El mapa de las 360 preguntas se genera desde los análisis ya hechos (`docs/evaluaciones/2026-11-17-anexos-coherencia/analisis-b{1..5}.md`): cada tabla asigna a cada pregunta una clase o `NO_CUBIERTA` con su tema. Escribe un script desechable `tmp/gen-temas.mjs` que lea esos cinco ficheros, aplique las reglas de abajo y emita `lib/cursos/practica-tematica.ts` completo. Reglas:

```js
// clase slug → sección (para preguntas cubiertas)
const SECCION_POR_CLASE = {
  "actores-involucrados": "actos-preparatorios",
  "modalidades-contratacion-eficiente": "actos-preparatorios",
  "expediente-contratacion": "actos-preparatorios",
  "plan-anual-contrataciones": "actos-preparatorios",
  "segmentacion-contrataciones": "actos-preparatorios",
  "actos-preparatorios": "actos-preparatorios",
  "evaluadores": "actos-preparatorios",
  "plazos-buena-pro-seleccion": "fase-seleccion",
  "mecanismo-diferenciado-adquisicion": "fase-seleccion",
  "procedimientos-seleccion": "fase-seleccion",
  "recurso-apelacion": "fase-seleccion",
  "perfeccionamiento-contrato": "ejecucion-contractual",
  "modificaciones-procedimiento": "ejecucion-contractual",
  "garantias": "ejecucion-contractual",
  "modificaciones-contrato": "ejecucion-contractual",
  "adelantos-penalidades-subcontratacion": "ejecucion-contractual",
  "resolucion-nulidad-contrato": "ejecucion-contractual",
  "resolucion-controversias": "ejecucion-contractual",
  "contratos-estandarizados-internacionales": "ejecucion-contractual",
  "incentivos-obras-consultoria": "obras",
  "inicio-plazo-vigencia-contrato": "obras",
  "suspension-reprogramacion-obra": "obras",
  "intervencion-economica": "obras",
};
// temas NO_CUBIERTAS → sección, por palabras clave en el tema (primera que coincide gana)
const CLAVES = [
  ["obras|obra|expediente tecnico|residente|supervis|programa|valoriz|plantel|terreno|intervencion|ruta critica|liquidacion de obra|adicionales de obra|entrega de obra|recepcion de obra", "obras"],
  ["apelacion|buena pro|bases|consulta|observacion|convocatoria|oferta|subasta|comparacion de precios|precalificacion|negociacion|dialogo|pliego|desempate|participante|precomercial|homologacion|cuestionamiento|registro de participantes", "fase-seleccion"],
  ["requerimiento|segmentacion|pac|cmn|expediente de contratacion|estrategia|interaccion con el mercado|fraccionamiento|evaluador|mda|cpi|modalidad|encargo|centralizada|corporativa|catalogo|contratacion directa|principio|actor|comprador publico|pladicop", "actos-preparatorios"],
  ["contrato|garantia|adelanto|amortizacion|penalidad|subcontratacion|conformidad|entrega|liquidacion|controversia|arbitraje|conciliacion|jprd|nulidad|resolucion|perfeccionamiento|estandarizado|modificacion|adicion|reduccion|ampliacion|cesion|suspension del contrato|penal", "ejecucion-contractual"],
];
```

  El fichero emitido es puro y autocontenido:

```ts
// Clasificación temática de las 360 preguntas de los balotarios por sección del curso, derivada del
// análisis de coherencia (docs/evaluaciones/2026-11-17-coherencia-simulador-curso.md). Se genera una
// vez y se versiona: cambia solo con un nuevo análisis. Módulo puro, sin red.
export type TemaPractica = "actos-preparatorios" | "fase-seleccion" | "ejecucion-contractual" | "obras";
export const ETIQUETAS_TEMA: { valor: TemaPractica; etiqueta: string }[] = [
  { valor: "actos-preparatorios", etiqueta: "Actos preparatorios" },
  { valor: "fase-seleccion", etiqueta: "Fase de selección" },
  { valor: "ejecucion-contractual", etiqueta: "Ejecución contractual" },
  { valor: "obras", etiqueta: "Obras" },
];
export const SECCION_POR_PREGUNTA: Record<string, TemaPractica> = {
  "b1-q1": "ejecucion-contractual",
  // … 360 entradas en orden b1-q1 … b5-q72, generadas por el script
};
export function preguntasDeTema(
  catalogo: { balotario: number; preguntas: { id: string }[] }[],
  tema: TemaPractica,
) {
  return catalogo.flatMap((b) => b.preguntas).filter((q) => SECCION_POR_PREGUNTA[q.id] === tema);
}
```

  Tras generarlo, borra el script (`tmp/` no se versiona) y revisa a mano el diff de conteos: cada tema debe tener más de 40 preguntas y menos de 160.

- [ ] **Paso 2: test que falla** — `tests/practica-tematica.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { catalogoBalotarios } from "@/lib/balotarios-catalogo";
import { ETIQUETAS_TEMA, SECCION_POR_PREGUNTA, preguntasDeTema } from "@/lib/cursos/practica-tematica";

describe("práctica por tema", () => {
  const todas = catalogoBalotarios.flatMap((b) => b.preguntas);
  it("todas las preguntas de los balotarios tienen tema", () => {
    expect(todas.every((q) => SECCION_POR_PREGUNTA[q.id])).toBe(true);
    expect(Object.keys(SECCION_POR_PREGUNTA).length).toBe(todas.length);
  });
  it("cada tema reúne preguntas de los cinco balotarios", () => {
    for (const t of ETIQUETAS_TEMA) {
      const qs = preguntasDeTema(catalogoBalotarios, t.valor);
      expect(qs.length, t.valor).toBeGreaterThan(40);
      expect(new Set(qs.map((q) => q.id.split("-")[0])).size, t.valor).toBe(5);
    }
  });
});
```

- [ ] **Paso 3:** `npx vitest run tests/practica-tematica.test.ts` → FALLA (el módulo aún no existe en disco).
- [ ] **Paso 4: simulador** — `app/components/simulador-shell.tsx`: en `read()`, tras leer `vista`, añade `u.searchParams.get("tema")` válido a un estado `temaInicial` que se pasa como prop `temaInicial` a `BalotariosOece`; y si `u.searchParams.get("seccion") === "banco"`, llama `openBank()` (así la URL `?seccion=banco` que circula entre alumnos deja de ignorarse y abre el banco revisado). En `go()`, borra también el parámetro `tema`. En `modulo.tsx`, `BalotariosOece` acepta `temaInicial?: string` y lo entrega a `Practica`. En `recorrido.tsx`, `Practica` acepta `temaInicial?: string`:

```tsx
const [coleccion, setColeccion] = useState<string>(temaInicial ?? "1");
const esTema = coleccion.startsWith("tema:");
const source =
  repaso ??
  (esTema
    ? preguntasDeTema(catalogo, coleccion.slice(5) as TemaPractica)
    : catalogo.find((b) => b.balotario === Number(coleccion))!.preguntas);
```

  y el `<select>` gana, tras las opciones de balotario:

```tsx
{ETIQUETAS_TEMA.map((t) => (
  <option key={t.valor} value={`tema:${t.valor}`}>
    {t.etiqueta} · {preguntasDeTema(catalogo, t.valor).length} preguntas
  </option>
))}
```

  (impórtense `ETIQUETAS_TEMA`, `preguntasDeTema` y el tipo `TemaPractica` de `@/lib/cursos/practica-tematica`; el resto de la lógica de `Practica` —mezclar, responder, navegar— no cambia porque opera sobre `source`).

- [ ] **Paso 5: enlaces del curso** — en `lib/cursos/certificacion-oece.ts`, cada `puntoControl.href` pasa de `/simulador?vista=practicar` a `/simulador?vista=practicar&tema=<sección>` (los cuatro slugs de `TemaPractica` en el mismo orden de las secciones), y cada `descripcion` menciona que las preguntas están filtradas por el tema de la sección. El `examenFinal` no cambia.

- [ ] **Paso 6:** `npx vitest run tests/practica-tematica.test.ts tests/cursos-catalogo.test.ts` → PASA · `npm run typecheck` · revisión visual en preview (claro/oscuro, 375 px: el select no desborda).
- [ ] **Paso 7: commit** — `git commit -m "feat(simulador): practica por tema del curso y enlace seccion=banco"`.

---

### Tarea 9: Cierre

- [ ] **Paso 1:** `npm run lint && npm run typecheck && npm run test`.
- [ ] **Paso 2:** QA manual: abrir `/cursos/certificacion-oece` → terminar la sección «Actos preparatorios» → el punto de control debe abrir el simulador con «Actos preparatorios» preseleccionado; abrir una clase → pestaña «Casuística» con 3 casos y revelado; verificar las 5 correcciones visibles en las clases I, III, IV, V, VII y XI; `/simulador?seccion=banco` abre el banco revisado.
- [ ] **Paso 3:** entrada en `CHANGELOG.md` (si existe): «Cursos: corrección de reglas vigentes, casuísticas tipo examen, 5 clases de refuerzo y práctica por tema».
- [ ] **Paso 4:** `npm run build` para confirmar el despliegue.
- [ ] **Paso 5:** al entregar, recordar: el análisis y sus anexos quedaron en `docs/evaluaciones/2026-11-17-coherencia-simulador-curso.md` y `docs/evaluaciones/2026-11-17-anexos-coherencia/`; las preguntas defectuosas de los balotarios (B1-32, B2-71, B4-28, B4-51/68, B4-63) quedan documentadas para su corrección vía `balotario_reviews` en una tarea futura.

---

## Fuera de alcance (a propósito)

- Corregir las preguntas defectuosas de los balotarios (van por `balotario_reviews`, con edición revisada).
- Las clases de refuerzo de Fases 2 y 3 (valorización/recepción/liquidación, residente/supervisor/ETO, controversias procedimentales, CPI/MDA avanzados, principios, modalidades de pago): dependen de otro ciclo de verificación contra el corpus y de un análisis de cuánto suman.
- Cambios en el banco revisado o en `exam_questions`.
- Vídeos de las clases (siguen en formato lectura).
