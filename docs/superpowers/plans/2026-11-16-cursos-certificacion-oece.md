# Cursos: taller de certificación OECE — Plan de implementación

> **Para quien lo ejecute:** sub-skill recomendada: superpowers:subagent-driven-development
> (o superpowers:executing-plans). Los pasos usan casillas (`- [ ]`) para el seguimiento.

**Objetivo:** una sección `/cursos` en ACE con la organización de un curso de Platzi
(portada con temario → clase con reproductor, resumen, recursos y panel lateral) y el
temario del *Taller de preparación para el examen de certificación OECE* de CAEM,
con el progreso por cuenta y los exámenes enlazados al simulador que ya existe.

**Arquitectura:** el catálogo del curso es **código versionado** (`lib/cursos/`),
como `balotarios-oece.json`: puro, sin red, recorrible en tests. Lo único que se
persiste es el progreso del alumno (`curso_progreso`, RLS «solo lo mío», escrito con
`supabaseUserRest`). Tres páginas server-side bajo `app/cursos/` dentro de `AppShell`,
con utilidades Tailwind y tokens. Los exámenes no se reimplementan: cada sección
termina enlazando al simulador (`/simulador?vista=...`).

**Stack:** Next.js 16 App Router, React 19, TypeScript estricto, Supabase (PostgREST),
Tailwind acotado a `.tw`, Vitest.

## Restricciones globales

- Código, comentarios, copys y commits en **español**; vocabulario del dominio sin traducir.
- Ruta canónica en minúscula: **`/cursos`**. `/Cursos` redirige (Next distingue mayúsculas en Linux/Netlify aunque Windows no).
- Componentes nuevos **solo con utilidades y tokens** (`bg-panel`, `text-muted`, `border-line`, `bg-brand`, `text-on-brand`…), dentro de un contenedor `.tw`. Nada de hex, paleta por defecto ni clases nuevas en CSS (`tests/paleta-colores.test.ts`, `tests/tailwind-migracion.test.ts`).
- Datos privados del usuario → `supabaseUserRest`, nunca `supabaseRest`.
- Toda ruta de `app/api/` empieza por `requireUser` con el patrón `if ("error" in auth) return auth.error`.
- Cuentas externas: deniega por omisión. Toda página/API nueva se declara en `lib/modulos-acceso.ts` o queda cerrada para alumnos.
- SQL nuevo en `docs/supabase/`, aplicado **a mano**. El fallback cuando la tabla aún no existe se limita a los códigos `42P01`/`PGRST205` (nada de `catch` que trague todo).
- **Ningún dato normativo inventado.** Artículos, plazos y cifras de los resúmenes se comprueban contra el corpus (skill `verificacion-legal-rag`). Una clase sin verificar se publica con la marca «En revisión».
- Commits: Conventional Commits con scope y el síntoma que ve el usuario, en minúscula.

---

## 0. Lo que se analizó (referencia, no se implementa tal cual)

### 0.1 Organización de Platzi (`/cursos/construir-agentes-ai/`)

**Portada del curso**
1. Cabecera: título, valoración, fecha de publicación, chips *Nivel · N clases · horas de contenido · horas de práctica*.
2. Descripción de un párrafo y CTA principal («Empieza ya») + secundario.
3. **Temario por secciones** («Qué es (y qué no es) un agente», «Decidir antes de diseñar», «Diseña el agente», «Prototipo»). Cada clase lleva **número correlativo global** (1…18, no reinicia por sección), título y duración. Al final, «Tomar examen».
4. Profesores, opiniones, rutas de aprendizaje a las que pertenece.

**Página de clase** (`/cursos/{curso}/{clase}/`)
1. Reproductor grande a la izquierda.
2. Debajo, pestañas **Recursos | Resumen**; el resumen es texto estructurado con preguntas como subtítulos y marcas de tiempo.
3. Columna derecha: **«Pregúntame tus dudas»** (asistente) y comentarios.
4. Barra inferior fija: título de la clase, «Clase 1 de 18 · nombre del curso», botón **Clases** (cajón con el temario) y **Siguiente clase**.

### 0.2 Contenido del taller de CAEM

Aula con barra lateral de progreso («0 % · 0/18 sesiones»), «Descargar Balotario»,
secciones plegables con exámenes intercalados y «Mis exámenes». Cada sesión: vídeo
(Vimeo), *Anterior / Siguiente*, **Marcar como completado**, «Sobre esta sesión» y
«Materiales» (diapositiva; en el Módulo I también la Ley).

| Sección | Sesiones (orden del aula) | Exámenes |
|---|---|---|
| Actos Preparatorios | I Actores involucrados · II Modalidades de la contratación pública eficiente · III Expediente de contratación · IV Plan anual de contrataciones · V Segmentación de contrataciones · VI Actos preparatorios · VII Evaluadores | Tipo 1, Tipo 2 |
| Fase de Selección | VIII Mecanismo diferenciado de adquisición (MDA) · X Procedimientos de selección · XI Recurso de apelación | Tipo 3, Tipo 4 |
| Ejecución Contractual | XII Perfeccionamiento del contrato · XIV Garantías · XV Modificaciones al contrato · XVI Resolución y nulidad de contrato · XVIII Mecanismos de resolución de controversias | Tipo 5, Tipo 6 |
| Obras | IX Incentivos para proveedores de obras y consultores de obra · XIII Inicio de plazo de ejecución y vigencia del contrato · XVII Intervención económica | Tipo 7 |

Solo los módulos I–VII tienen descripción real; VIII–XVIII la tienen vacía o de
relleno. Las descripciones del catálogo se redactan en ACE (paráfrasis propia), no se
copian.

### 0.3 Decisión pendiente: vídeos y diapositivas de CAEM

Los vídeos (Vimeo con hash privado) y las diapositivas son material de pago de CAEM.
**Este plan no los descarga ni los re-aloja.** El modelo admite un vídeo opcional por
clase (`video?: { proveedor: "vimeo" | "youtube"; id: string; hash?: string }`); sin
vídeo, la clase se muestra en formato lectura (resumen + puntos clave + base legal).
Rellenar `video` con los de CAEM solo si hay autorización escrita suya; si no, con
vídeos propios cuando existan. Ver Tarea 7.

---

## Estructura de ficheros

| Fichero | Responsabilidad |
|---|---|
| `lib/cursos/tipos.ts` | Tipos `Curso`, `Seccion`, `Clase`, `Recurso`, `PuntoControl`. |
| `lib/cursos/certificacion-oece.ts` | Catálogo del taller: 4 secciones, 18 clases, puntos de control. |
| `lib/cursos/contenido/*.ts` | Un fichero por sección con resumen, puntos clave y base legal de cada clase. |
| `lib/cursos/catalogo.ts` | Registro de cursos + funciones puras: `buscarCurso`, `buscarClase`, `clasesEnOrden`, `vecinas`, `avance`, `duracionTotal`. |
| `docs/supabase/2026-11-16-cursos-progreso.sql` | Tabla `curso_progreso` + RLS. |
| `lib/cursos/progreso-server.ts` | Lectura/escritura del progreso con `supabaseUserRest`, fallback acotado. |
| `app/api/cursos/progreso/route.ts` | `GET` (progreso de un curso) y `POST` (marcar/desmarcar clase). |
| `app/cursos/page.tsx` | Catálogo de cursos (una tarjeta hoy). |
| `app/cursos/[curso]/page.tsx` | Portada estilo Platzi. |
| `app/cursos/[curso]/[clase]/page.tsx` | Página de clase. |
| `app/components/cursos/*.tsx` | `TemarioCurso`, `CabeceraCurso`, `ReproductorClase`, `PestanasClase`, `BarraClase`, `BotonCompletar`, `PanelDudas`. |
| `lib/modulos-acceso.ts`, `lib/navegacion.ts`, `lib/uso-ia.ts`, `app/components/sidebar.tsx`, `next.config.ts` | Acceso, menú, auditoría de uso y redirección `/Cursos`. |
| `tests/cursos-catalogo.test.ts`, `tests/cursos-progreso-route.test.ts`, `tests/modulos-acceso.test.ts` | Tests. |

---

### Tarea 1: Modelo y catálogo del curso (puro)

**Ficheros:**
- Crear: `lib/cursos/tipos.ts`, `lib/cursos/certificacion-oece.ts`, `lib/cursos/catalogo.ts`
- Test: `tests/cursos-catalogo.test.ts`

**Interfaces:**
- Produce: `type Curso`, `type Clase`, `CURSOS: readonly Curso[]`, `buscarCurso(slug): Curso | null`, `buscarClase(curso, slug): { clase: Clase; seccion: Seccion; numero: number } | null`, `clasesEnOrden(curso): Clase[]`, `vecinas(curso, slug): { anterior: Clase | null; siguiente: Clase | null }`, `avance(curso, completadas: ReadonlySet<string>): { hechas: number; total: number; porcentaje: number }`, `duracionTotal(curso): number` (minutos).

- [ ] **Paso 1: tipos**

```ts
// lib/cursos/tipos.ts
// El catálogo vive en código y no en la base: cambia con despliegues revisados, los tests lo recorren entero y un
// alumno externo no necesita permisos de lectura sobre tablas para verlo. Solo el progreso es dato del usuario.
export type BaseLegal = { norma: "Ley 32069" | "Reglamento"; articulo: string };
export type Recurso = { tipo: "norma" | "enlace"; titulo: string; href: string };
export type VideoClase = { proveedor: "vimeo" | "youtube"; id: string; hash?: string };
export type ContenidoClase = {
  resumen: { pregunta: string; parrafos: string[] }[];
  puntosClave: string[];
  baseLegal: BaseLegal[];
  /** true solo cuando cada artículo, plazo y cifra se contrastó con el corpus. */
  verificada: boolean;
};
export type Clase = {
  slug: string;
  modulo: string; // numeral romano del aula original («II»)
  titulo: string;
  descripcion: string;
  minutos: number; // duración estimada de lectura o del vídeo
  video?: VideoClase;
  recursos: Recurso[];
  contenido: ContenidoClase;
};
export type PuntoControl = { titulo: string; href: string; descripcion: string };
export type Seccion = { slug: string; titulo: string; clases: Clase[]; puntoControl: PuntoControl };
export type Curso = {
  slug: string;
  titulo: string;
  descripcion: string;
  nivel: "Básico" | "Intermedio" | "Avanzado";
  publicado: string; // ISO
  secciones: Seccion[];
  examenFinal: PuntoControl;
};
```

- [ ] **Paso 2: test que falla** — recorre el catálogo entero, al estilo del resto del repo.

```ts
// tests/cursos-catalogo.test.ts
import { describe, expect, it } from "vitest";
import { CURSOS, avance, buscarClase, buscarCurso, clasesEnOrden, duracionTotal, vecinas } from "@/lib/cursos/catalogo";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

describe("catálogo de cursos", () => {
  for (const curso of CURSOS) {
    const clases = clasesEnOrden(curso);
    it(`${curso.slug}: slugs válidos y únicos`, () => {
      expect(curso.slug).toMatch(SLUG);
      const slugs = clases.map((c) => c.slug);
      for (const s of slugs) expect(s, s).toMatch(SLUG);
      expect(new Set(slugs).size).toBe(slugs.length);
    });
    it(`${curso.slug}: toda clase tiene contenido y base legal`, () => {
      for (const c of clases) {
        expect(c.contenido.resumen.length, c.slug).toBeGreaterThan(0);
        expect(c.contenido.puntosClave.length, c.slug).toBeGreaterThanOrEqual(3);
        expect(c.contenido.baseLegal.length, c.slug).toBeGreaterThan(0);
        expect(c.minutos, c.slug).toBeGreaterThan(0);
      }
    });
    it(`${curso.slug}: cada sección cierra con un punto de control al simulador`, () => {
      for (const s of curso.secciones) expect(s.puntoControl.href.startsWith("/simulador")).toBe(true);
      expect(curso.examenFinal.href.startsWith("/simulador")).toBe(true);
    });
    it(`${curso.slug}: la numeración es correlativa y no reinicia por sección`, () => {
      clases.forEach((c, i) => expect(buscarClase(curso, c.slug)?.numero).toBe(i + 1));
    });
    it(`${curso.slug}: anterior/siguiente encadenan todas las clases`, () => {
      expect(vecinas(curso, clases[0].slug).anterior).toBeNull();
      expect(vecinas(curso, clases.at(-1)!.slug).siguiente).toBeNull();
      for (let i = 1; i < clases.length; i++) expect(vecinas(curso, clases[i].slug).anterior?.slug).toBe(clases[i - 1].slug);
    });
  }

  it("el taller OECE tiene las 4 secciones y 18 clases del aula", () => {
    const c = buscarCurso("certificacion-oece")!;
    expect(c.secciones.map((s) => s.clases.length)).toEqual([7, 3, 5, 3]);
    expect(duracionTotal(c)).toBeGreaterThan(0);
  });
  it("el avance ignora slugs que no son del curso", () => {
    const c = buscarCurso("certificacion-oece")!;
    const primera = clasesEnOrden(c)[0].slug;
    expect(avance(c, new Set([primera, "otra-cosa"]))).toEqual({ hechas: 1, total: 18, porcentaje: 6 });
  });
  it("un slug desconocido no rompe", () => {
    expect(buscarCurso("no-existe")).toBeNull();
    expect(buscarClase(buscarCurso("certificacion-oece")!, "no-existe")).toBeNull();
  });
});
```

- [ ] **Paso 3:** `npx vitest run tests/cursos-catalogo.test.ts` → FALLA (no existe el módulo).

- [ ] **Paso 4: funciones puras**

```ts
// lib/cursos/catalogo.ts
import { CERTIFICACION_OECE } from "./certificacion-oece";
import type { Clase, Curso, Seccion } from "./tipos";

export const CURSOS: readonly Curso[] = [CERTIFICACION_OECE];

export const buscarCurso = (slug: string): Curso | null => CURSOS.find((c) => c.slug === slug) ?? null;

export const clasesEnOrden = (curso: Curso): Clase[] => curso.secciones.flatMap((s) => s.clases);

export function buscarClase(curso: Curso, slug: string): { clase: Clase; seccion: Seccion; numero: number } | null {
  let numero = 0;
  for (const seccion of curso.secciones) {
    for (const clase of seccion.clases) {
      numero += 1;
      if (clase.slug === slug) return { clase, seccion, numero };
    }
  }
  return null;
}

export function vecinas(curso: Curso, slug: string) {
  const clases = clasesEnOrden(curso);
  const i = clases.findIndex((c) => c.slug === slug);
  return { anterior: i > 0 ? clases[i - 1] : null, siguiente: i >= 0 && i < clases.length - 1 ? clases[i + 1] : null };
}

export function avance(curso: Curso, completadas: ReadonlySet<string>) {
  const clases = clasesEnOrden(curso);
  const hechas = clases.filter((c) => completadas.has(c.slug)).length;
  return { hechas, total: clases.length, porcentaje: clases.length ? Math.round((hechas / clases.length) * 100) : 0 };
}

export const duracionTotal = (curso: Curso) => clasesEnOrden(curso).reduce((t, c) => t + c.minutos, 0);
```

- [ ] **Paso 5: catálogo del taller** — `lib/cursos/certificacion-oece.ts`. Las clases se importan de `lib/cursos/contenido/{actos-preparatorios,fase-seleccion,ejecucion-contractual,obras}.ts` (Tarea 2). Slugs: `actores-involucrados`, `modalidades-contratacion-eficiente`, `expediente-contratacion`, `plan-anual-contrataciones`, `segmentacion-contrataciones`, `actos-preparatorios`, `evaluadores`, `mecanismo-diferenciado-adquisicion`, `procedimientos-seleccion`, `recurso-apelacion`, `perfeccionamiento-contrato`, `garantias`, `modificaciones-contrato`, `resolucion-nulidad-contrato`, `resolucion-controversias`, `incentivos-obras-consultoria`, `inicio-plazo-vigencia-contrato`, `intervencion-economica`.

```ts
import type { Curso } from "./tipos";
import { ACTOS_PREPARATORIOS } from "./contenido/actos-preparatorios";
import { FASE_SELECCION } from "./contenido/fase-seleccion";
import { EJECUCION_CONTRACTUAL } from "./contenido/ejecucion-contractual";
import { OBRAS } from "./contenido/obras";

// Temario del Taller de preparación para el examen de certificación OECE (CAEM), en el orden de su aula. Los numerales
// romanos se conservan porque el alumno los reconoce del examen; el orden de Obras (IX, XIII, XVII) es el del aula,
// no el numérico, a propósito.
export const CERTIFICACION_OECE: Curso = {
  slug: "certificacion-oece",
  titulo: "Preparación para el examen de certificación OECE",
  descripcion:
    "Repasa la Ley 32069 y su Reglamento en el orden en que se presenta una contratación: actos preparatorios, fase de " +
    "selección, ejecución contractual y obras. Cada sección termina con un examen en el simulador.",
  nivel: "Intermedio",
  publicado: "2026-11-16",
  secciones: [
    { slug: "actos-preparatorios", titulo: "Actos preparatorios", clases: ACTOS_PREPARATORIOS,
      puntoControl: { titulo: "Practica actos preparatorios", href: "/simulador?vista=practicar", descripcion: "Preguntas del balotario sobre actores, PAC, expediente y requerimiento." } },
    { slug: "fase-seleccion", titulo: "Fase de selección", clases: FASE_SELECCION,
      puntoControl: { titulo: "Practica fase de selección", href: "/simulador?vista=practicar", descripcion: "Procedimientos, MDA y recurso de apelación." } },
    { slug: "ejecucion-contractual", titulo: "Ejecución contractual", clases: EJECUCION_CONTRACTUAL,
      puntoControl: { titulo: "Practica ejecución contractual", href: "/simulador?vista=practicar", descripcion: "Perfeccionamiento, garantías, modificaciones, resolución y controversias." } },
    { slug: "obras", titulo: "Obras", clases: OBRAS,
      puntoControl: { titulo: "Practica obras", href: "/simulador?vista=practicar", descripcion: "Incentivos, inicio de plazo e intervención económica." } },
  ],
  examenFinal: { titulo: "Tomar examen", href: "/simulador?vista=examen", descripcion: "Examen cronometrado con los balotarios OECE." },
};
```

- [ ] **Paso 6:** stubs mínimos en `lib/cursos/contenido/*.ts` (título, módulo, slug, `minutos`, una entrada de resumen, 3 puntos clave y una base legal **con `verificada: false`**) para que el test pase; el contenido real llega en la Tarea 2.
- [ ] **Paso 7:** `npx vitest run tests/cursos-catalogo.test.ts` → PASA.
- [ ] **Paso 8: commit**

```bash
git add lib/cursos tests/cursos-catalogo.test.ts
git commit -m "feat(cursos): temario del taller de certificacion oece en 4 secciones y 18 clases"
```

---

### Tarea 2: Contenido de las 18 clases, verificado contra el corpus

**Ficheros:** Modificar `lib/cursos/contenido/{actos-preparatorios,fase-seleccion,ejecucion-contractual,obras}.ts`

**Interfaces:** Consume `Clase`, `ContenidoClase` (Tarea 1). Produce los arrays `ACTOS_PREPARATORIOS`, `FASE_SELECCION`, `EJECUCION_CONTRACTUAL`, `OBRAS: Clase[]`.

Una clase por vez, en este orden de trabajo:

- [ ] **Paso 1:** para la clase, consultar el corpus por debajo (`searchTextRecords` de `lib/pinecone` + `document_chunks.content`; ver memoria «Consultar el RAG legal») por el tema del módulo y anotar los artículos que lo regulan.
- [ ] **Paso 2:** redactar `descripcion` (paráfrasis propia de 2–3 frases; para VIII–XVIII, nueva), `resumen` como 3–5 bloques *pregunta → párrafos* (el formato del Resumen de Platzi), 3–6 `puntosClave` y `baseLegal`.
- [ ] **Paso 3:** pasar cada artículo, plazo, porcentaje y umbral por la skill `verificacion-legal-rag`. Si todo coincide, `verificada: true`; si algo queda dudoso, se quita la cifra o se deja `verificada: false` (la UI muestra «En revisión»).
- [ ] **Paso 4:** recurso de la norma: `{ tipo: "norma", titulo: "Ley 32069 — Art. N", href: "/normas?..." }` usando el lector de normas que ya existe (comprobar el formato del enlace en `app/normas`).
- [ ] **Paso 5:** `npx vitest run tests/cursos-catalogo.test.ts` → PASA.
- [ ] **Paso 6:** commit por sección: `docs(cursos): resumen verificado de las clases de actos preparatorios` (ídem para las otras tres).

> No copiar texto de las diapositivas ni de las descripciones de CAEM. El temario
> (títulos de módulo) es el de la norma; el desarrollo es de ACE.

---

### Tarea 3: Progreso por cuenta (SQL + servidor + API)

**Ficheros:**
- Crear: `docs/supabase/2026-11-16-cursos-progreso.sql`, `lib/cursos/progreso-server.ts`, `app/api/cursos/progreso/route.ts`
- Test: `tests/cursos-progreso-route.test.ts`

**Interfaces:**
- Consume: `buscarCurso`, `buscarClase` (Tarea 1); `requireUser` (`lib/auth`); `supabaseUserRest(accessToken, path, init)`.
- Produce: `leerProgreso(token: string, curso: string): Promise<string[] | null>` (`null` = tabla aún no creada), `marcarClase(token, userId, curso, clase, completada: boolean): Promise<void>`. API: `GET /api/cursos/progreso?curso=slug → { completadas: string[], disponible: boolean }`; `POST { curso, clase, completada } → { ok: true }`.

- [ ] **Paso 1: SQL**

```sql
-- docs/supabase/2026-11-16-cursos-progreso.sql
-- Progreso de cada cuenta en los cursos. El catálogo vive en código (lib/cursos); aquí solo se guarda qué clase
-- marcó cada persona. Sin partición por año: un curso no es un dato del año fiscal.
create table if not exists public.curso_progreso (
  user_id uuid not null references auth.users(id) on delete cascade,
  curso text not null check (curso ~ '^[a-z0-9-]{1,80}$'),
  clase text not null check (clase ~ '^[a-z0-9-]{1,120}$'),
  completada_at timestamptz not null default now(),
  primary key (user_id, curso, clase)
);
alter table public.curso_progreso enable row level security;
drop policy if exists curso_progreso_propio on public.curso_progreso;
create policy curso_progreso_propio on public.curso_progreso
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
grant select, insert, delete on public.curso_progreso to authenticated;
```

- [ ] **Paso 2: test que falla**

```ts
// tests/cursos-progreso-route.test.ts
import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ auth: vi.fn(), leer: vi.fn(), marcar: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: m.auth }));
vi.mock("@/lib/cursos/progreso-server", () => ({ leerProgreso: m.leer, marcarClase: m.marcar }));
import { GET, POST } from "@/app/api/cursos/progreso/route";

const yo = { id: "11111111-1111-4111-8111-111111111111", accessToken: "jwt" };
const post = (b: unknown) => new Request("https://ace.test/api/cursos/progreso", { method: "POST", body: JSON.stringify(b) });
beforeEach(() => { vi.clearAllMocks(); m.auth.mockResolvedValue({ error: new Response(null, { status: 401 }) }); });

it("sin sesión no lee ni escribe", async () => {
  expect((await GET(new Request("https://ace.test/api/cursos/progreso?curso=certificacion-oece"))).status).toBe(401);
  expect((await POST(post({ curso: "certificacion-oece", clase: "garantias", completada: true }))).status).toBe(401);
  expect(m.leer).not.toHaveBeenCalled(); expect(m.marcar).not.toHaveBeenCalled();
});
it("el propietario sale de la sesión, no del cuerpo", async () => {
  m.auth.mockResolvedValue({ user: yo }); m.marcar.mockResolvedValue(undefined);
  expect((await POST(post({ curso: "certificacion-oece", clase: "garantias", completada: true, user_id: "otro" }))).status).toBe(200);
  expect(m.marcar).toHaveBeenCalledWith("jwt", yo.id, "certificacion-oece", "garantias", true);
});
it("rechaza cursos o clases que no están en el catálogo", async () => {
  m.auth.mockResolvedValue({ user: yo });
  expect((await POST(post({ curso: "certificacion-oece", clase: "inventada", completada: true }))).status).toBe(400);
  expect((await GET(new Request("https://ace.test/api/cursos/progreso?curso=nada"))).status).toBe(404);
  expect(m.marcar).not.toHaveBeenCalled();
});
it("si la migración no está aplicada, avisa sin romper la página", async () => {
  m.auth.mockResolvedValue({ user: yo }); m.leer.mockResolvedValue(null);
  const r = await GET(new Request("https://ace.test/api/cursos/progreso?curso=certificacion-oece"));
  expect(await r.json()).toEqual({ completadas: [], disponible: false });
  expect(r.headers.get("cache-control")).toBe("no-store");
});
```

- [ ] **Paso 3:** `npx vitest run tests/cursos-progreso-route.test.ts` → FALLA.

- [ ] **Paso 4: servidor**

```ts
// lib/cursos/progreso-server.ts
import { supabaseUserRest } from "@/lib/supabase-server";

// Datos privados de la persona: siempre con su JWT (RLS), nunca con service_role.
// El único error que se tolera es «la tabla aún no existe» (migración manual pendiente): cualquier otro se propaga,
// porque un catch genérico ya escondió fallos reales en este proyecto.
const TABLA_AUSENTE = /42P01|PGRST205/;

export async function leerProgreso(token: string, curso: string): Promise<string[] | null> {
  try {
    const filas = await supabaseUserRest<{ clase: string }[]>(token, `curso_progreso?curso=eq.${encodeURIComponent(curso)}&select=clase`);
    return filas.map((f) => f.clase);
  } catch (e) {
    if (TABLA_AUSENTE.test(String((e as Error).message))) return null;
    throw e;
  }
}

export async function marcarClase(token: string, userId: string, curso: string, clase: string, completada: boolean) {
  if (completada) {
    await supabaseUserRest(token, "curso_progreso?on_conflict=user_id,curso,clase", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates" },
      body: JSON.stringify({ user_id: userId, curso, clase }),
    });
  } else {
    await supabaseUserRest(token, `curso_progreso?curso=eq.${encodeURIComponent(curso)}&clase=eq.${encodeURIComponent(clase)}`, { method: "DELETE" });
  }
}
```

> Antes de dar por buena la detección de «tabla ausente», leer cómo `supabaseUserRest`
> construye el `Error` (`lib/supabase-server.ts:184`) y ajustar la regex al mensaje real
> que devuelve PostgREST (`PGRST205 … Could not find the table`).

- [ ] **Paso 5: ruta**

```ts
// app/api/cursos/progreso/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { buscarClase, buscarCurso } from "@/lib/cursos/catalogo";
import { leerProgreso, marcarClase } from "@/lib/cursos/progreso-server";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
const cuerpo = z.object({ curso: z.string().max(80), clase: z.string().max(120), completada: z.boolean() });

export async function GET(request: Request) {
  const auth = await requireUser({ usesAI: false });
  if ("error" in auth) return auth.error;
  const curso = buscarCurso(new URL(request.url).searchParams.get("curso") ?? "");
  if (!curso) return NextResponse.json({ error: "Curso no encontrado" }, { status: 404, headers });
  const completadas = await leerProgreso(auth.user.accessToken, curso.slug);
  return NextResponse.json({ completadas: completadas ?? [], disponible: completadas !== null }, { headers });
}

export async function POST(request: Request) {
  const auth = await requireUser({ usesAI: false });
  if ("error" in auth) return auth.error;
  const p = cuerpo.safeParse(await request.json().catch(() => null));
  const curso = p.success ? buscarCurso(p.data.curso) : null;
  if (!p.success || !curso || !buscarClase(curso, p.data.clase)) {
    return NextResponse.json({ error: "Clase no encontrada en el curso" }, { status: 400, headers });
  }
  await marcarClase(auth.user.accessToken, auth.user.id, curso.slug, p.data.clase, p.data.completada);
  return NextResponse.json({ ok: true }, { headers });
}
```

- [ ] **Paso 6:** test → PASA. `npm run typecheck`.
- [ ] **Paso 7: commit** — `feat(cursos): marcar una clase como completada se guarda en tu cuenta`.

---

### Tarea 4: Acceso, menú y `/Cursos`

**Ficheros:** Modificar `lib/modulos-acceso.ts`, `lib/navegacion.ts`, `lib/uso-ia.ts:66`, `app/components/sidebar.tsx:131,356`, `next.config.ts`; Test: `tests/modulos-acceso.test.ts`

**Decisión:** los cursos entran en el módulo externo `simulacro` (mismo público: alumnos que preparan la certificación). Así un alumno ya dado de alta los ve sin tocar su credencial. Se renombra la etiqueta a «Cursos y simulacro».

- [ ] **Paso 1: test que falla** — añadir a `tests/modulos-acceso.test.ts`, dentro de «rutas que abre cada módulo»:

```ts
it("el simulacro abre también los cursos y su API de progreso", () => {
  for (const ruta of ["/cursos", "/cursos/certificacion-oece", "/cursos/certificacion-oece/garantias", "/api/cursos/progreso"]) {
    expect(rutaPermitidaExterno(simulacro, ruta), ruta).toBe(true);
    expect(rutaPermitidaExterno(juridico, ruta), ruta).toBe(false);
  }
  expect(moduloDeRuta("/cursos/certificacion-oece")).toBe("simulacro");
});
```

- [ ] **Paso 2:** ejecutar → FALLA.
- [ ] **Paso 3:** en `MODULOS_EXTERNOS.simulacro`: `label: "Cursos y simulacro"`, `descripcion: "Cursos de preparación y práctica del examen de certificación con corrección y cita de la norma."`, `inicio: "/cursos"`, `paginas: ["/cursos", "/simulacro", "/simulador"]`, `apis: [..., "/api/cursos"]`. En `lib/uso-ia.ts:66` añadir `"/cursos", "/api/cursos"` a la lista del simulacro.
- [ ] **Paso 4:** en `lib/navegacion.ts`, el grupo «Simulacro» pasa a llamarse «Formación» y gana `{ href: "/cursos", icon: "GraduationCap", id: "cursos", label: "Cursos", adminOnly: false }` antes del simulador. Comprobar que `GraduationCap` está en el mapa `ICONOS` de `sidebar.tsx`; si no, añadirlo desde `lucide-react`. En móvil, sustituir `"simulador"` por `"cursos"` en `mobileItems` solo si caben 5; si no, dejarlo como está (el simulador se alcanza desde la portada del curso).
- [x] **Paso 5 (cambiado al implementar):** la redirección **no** puede ir en `next.config.ts`: Next compara ahí sin distinguir mayúsculas y `/cursos` se redirigía a sí misma en bucle (comprobado: 308 → `/cursos`). Se hizo en `proxy.ts` con la función pura `lib/cursos/ruta-canonica.ts`, que compara exacto. Propuesta original, descartada:

```ts
  // Windows resuelve /Cursos y /cursos al mismo directorio, pero Netlify (Linux) no: el enlace en mayúscula que circula
  // entre los alumnos daría 404 en producción y funcionaría en local. Se normaliza aquí, antes del proxy.
  async redirects() {
    return [{ source: "/Cursos/:path*", destination: "/cursos/:path*", permanent: true }];
  },
```

- [ ] **Paso 6:** `npx vitest run tests/modulos-acceso.test.ts` → PASA; `npm run typecheck`.
- [ ] **Paso 7: commit** — `feat(cursos): los alumnos del simulacro ven los cursos en el menu`.

---

### Tarea 5: Portada del curso (estilo Platzi)

**Ficheros:**
- Crear: `app/cursos/page.tsx`, `app/cursos/[curso]/page.tsx`, `app/components/cursos/cabecera-curso.tsx`, `app/components/cursos/temario-curso.tsx`
- Modificar: `lib/navegacion.ts` (el `id: "cursos"` ya existe en `ActiveId` tras la Tarea 4)

**Interfaces:** Consume `buscarCurso`, `clasesEnOrden`, `avance`, `duracionTotal`, `leerProgreso`. Produce `<TemarioCurso curso completadas claseActual? compacto? />` reutilizado en la Tarea 6.

- [ ] **Paso 1: `/cursos`** — `AppShell active="cursos" eyebrow="Formación en contratación pública" title="Cursos"`, rejilla de tarjetas (`CURSOS`): título, nivel, nº de clases, duración total, barra de avance.
- [ ] **Paso 2: `/cursos/[curso]`** — server component. `getSessionUser()` (redirige a login si no hay sesión, como `app/simulador/page.tsx`), `notFound()` si el slug no existe, `leerProgreso` para la barra. Estructura, todo dentro de `<div className="tw">`:
  1. `CabeceraCurso`: título (`text-2xl font-semibold text-ink`), chips (`bg-surface text-muted border border-line rounded-full px-3 py-1`): *Nivel · 18 clases · N h de contenido · 5 balotarios de práctica* (los que tiene hoy el simulador); descripción; CTA `bg-brand text-on-brand` «Empezar» → primera clase no completada (o la primera); secundario «Ir al simulador».
  2. Barra de progreso si hay avance (`bg-brand-soft` / `bg-brand`), con texto «7 de 18 clases · 39 %».
  3. `TemarioCurso`: por sección, encabezado con «k/n clases»; filas con número correlativo, título «Módulo II · Modalidades…», minutos, icono de completada (`text-success`) y marca «En revisión» (`bg-warning-soft text-warning`) cuando `verificada === false`. Tras las clases de cada sección, la fila del punto de control (icono de examen) enlazada al simulador. Al final, «Tomar examen».
  4. Aviso discreto (`bg-info-soft text-info`) cuando `disponible === false`: «Tu avance aún no se guarda: falta activar esta función.»
- [ ] **Paso 3:** revisar en preview (claro, oscuro, 375 px): ninguna regla nueva en CSS, sin `style` en línea.
- [ ] **Paso 4:** `npm run lint && npm run typecheck && npm run test`.
- [ ] **Paso 5: commit** — `feat(cursos): portada del curso con temario por secciones y avance`.

---

### Tarea 6: Página de clase

**Ficheros:**
- Crear: `app/cursos/[curso]/[clase]/page.tsx`, `app/components/cursos/{reproductor-clase,pestanas-clase,barra-clase,boton-completar,panel-dudas}.tsx`

**Interfaces:** Consume `buscarClase`, `vecinas`, `TemarioCurso`, `POST /api/cursos/progreso`.

- [ ] **Paso 1: layout** (`lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] gap-6`, una columna en móvil):
  - Izquierda: `ReproductorClase` → si hay `video`, iframe 16:9 (`aspect-video w-full rounded-lg`) con `https://player.vimeo.com/video/{id}?h={hash}` o `https://www.youtube-nocookie.com/embed/{id}`, `title` accesible y `allow="fullscreen; picture-in-picture"`; si no, portada de lectura (`bg-surface border border-line`) con «Módulo II», el título y «Lectura · 12 min». Debajo, `PestanasClase` (Radix Tabs si ya está en dependencias; si no, botones con `aria-selected`): **Resumen** (bloques pregunta→párrafos, puntos clave, base legal) y **Recursos** (enlaces a `/normas`).
  - Derecha: `PanelDudas` + `TemarioCurso compacto claseActual`.
- [ ] **Paso 2: `PanelDudas`** — campo de texto + «Preguntar»: abre `/chat?pregunta=` con `encodeURIComponent("Sobre «" + titulo + "»: " + texto)` (el chat ya lee `pregunta` en `app/components/legal-chat.tsx:852`). Solo se muestra si `!user.esExterno || user.modulosExternos.includes("centro_juridico")`, el mismo criterio que `app/simulador/page.tsx`; si no, no se pinta. Las respuestas pasan por la verificación de citas existente; aquí no se genera nada.
- [ ] **Paso 3: `BotonCompletar`** (cliente) — «Marcar como completada» / «Completada ✓»; actualización optimista, revierte y muestra el error si el `POST` falla; deshabilitado con explicación si `disponible === false`.
- [ ] **Paso 4: `BarraClase`** — fija abajo (`sticky bottom-0 bg-panel border-t border-line`): título, «Clase 4 de 18 · Preparación para el examen…», botón **Clases** (abre el temario en un `<dialog>` en móvil), **Anterior** / **Siguiente clase**; en la última, «Tomar examen».
- [ ] **Paso 5:** QA en preview: navegar clase 1 → 18 con Siguiente, marcar/desmarcar, recargar y ver que persiste (con la migración aplicada) y que sin migración aparece el aviso; claro/oscuro; 375 px sin scroll horizontal; foco visible y orden de tabulación.
- [ ] **Paso 6:** `npm run lint && npm run typecheck && npm run test`.
- [ ] **Paso 7: commit** — `feat(cursos): clase con resumen, recursos, dudas al chat y siguiente clase`.

---

### Tarea 7: Vídeos (solo si hay autorización) y cierre

- [ ] **Paso 1:** si se obtiene autorización escrita de CAEM, rellenar `video` de cada clase con su id y hash de Vimeo (están en el aula: sesión → iframe `player.vimeo.com/video/{id}?h={hash}`) y comprobar que se reproducen desde el dominio de ACE (Vimeo puede restringir dominios). Sin autorización, no se toca: las clases siguen en formato lectura.
- [ ] **Paso 2:** `CHANGELOG.md`: entrada «Cursos: taller de preparación para la certificación OECE».
- [ ] **Paso 3:** al entregar, decir explícitamente: **hay que ejecutar `docs/supabase/2026-11-16-cursos-progreso.sql` en el SQL Editor** de Supabase; hasta entonces el avance no se guarda.
- [ ] **Paso 4:** `npm run lint && npm run typecheck && npm run test && npm run build`.

---

## Fuera de alcance (a propósito)

- Comentarios y valoraciones entre alumnos (Platzi los tiene): exigen moderación; el asistente cubre las dudas.
- Rutas de aprendizaje, profesores, certificados de finalización.
- Exámenes por sección con balotario fijo: el simulador aún no acepta `?balotario=N`; los puntos de control abren Practicar/Examen. Si se quiere, es un cambio pequeño en `app/components/simulador-shell.tsx:16` en otra tarea.
- Editor de cursos en la interfaz: el catálogo se edita en código y pasa por revisión.
