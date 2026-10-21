# Dos modos en la ficha de necesidad — Plan de implementación

> **Para quien ejecute este plan:** los pasos usan casillas (`- [ ]`) para seguimiento. Cada tarea
> termina en algo probable y commiteable por separado.

**Objetivo:** partir `/necesidades/[id]` en dos modos —Redactar y Revisar— con un interruptor que
recuerda la última elección, sin que ningún bloque quede inalcanzable.

**Arquitectura:** el reparto de bloques vive en un módulo de funciones puras
(`lib/necesidad-modos.ts`) y el componente solo lo consume. Así se puede probar lo único que
hundiría la idea —un bloque huérfano o duplicado— en un suite que no renderiza React.

**Tecnologías:** Next.js 16 (App Router), React 19, TypeScript, Vitest (`environment: "node"`),
Tailwind v4 acotado bajo `.tw`.

## Restricciones globales

- **El suite NO renderiza React.** `vitest.config.ts` fija `environment: "node"` e `include:
  ["tests/**/*.test.ts"]` — solo `.ts`, nunca `.tsx`. Las tareas de interfaz no llevan test
  automático: llevan comprobación manual escrita.
- **Ficheros CRLF.** `app/components/necesidad-detail.tsx` usa CRLF. Al editar con scripts hay que
  preservarlo o el diff sale de miles de líneas.
- **Nada de clases Tailwind inventadas al vuelo.** Solo se genera lo que está escrito en el código
  fuente; una clase arbitraria probada en el navegador sin estar en un fichero no existe.
- **Comentarios en castellano**, explicando el porqué y no el qué, como el resto del fichero.
- **Sin acentos en los mensajes de commit** (convención del repositorio).
- Verificación de cada tarea: `npx tsc --noEmit`, `npx eslint app lib`, `npx vitest run`.

---

### Tarea 1: Identificadores para los bloques que no los tienen

Hoy solo seis bloques llevan `id="sec-*"`: `sec-flujo`, `sec-eett`, `sec-ficha`, `sec-adjuntos`,
`sec-derivacion`, `sec-riesgos`. Verificación, coherencia, admisibilidad, observaciones e historial
son componentes anidados sin identificador: no se puede saltar a ellos ni comprobar su reparto.

**Ficheros:**
- Modificar: `app/components/necesidad-detail.tsx` (los cinco puntos de render de esos componentes)

**Interfaces:**
- Produce: los identificadores `sec-verificacion`, `sec-coherencia`, `sec-admisibilidad`,
  `sec-observaciones`, `sec-historial` en el DOM. La tarea 2 los usa como catálogo.

- [ ] **Paso 1: Envolver cada componente en un contenedor con identificador**

Buscar `<VerificacionNecesidad` y envolverlo:

```tsx
{/* `id` propio: sin el, este bloque no es alcanzable desde la navegacion rapida
    ni comprobable por el reparto de modos. */}
<div id="sec-verificacion">
  <VerificacionNecesidad onIrACampo={permisos.manage ? irACampo : undefined} resumen={verificacion} />
</div>
```

Repetir con `<CoherenciaNecesidad` → `sec-coherencia`, `<AdmisibilidadDec` → `sec-admisibilidad`,
`<ObservacionesNecesidad` → `sec-observaciones`, `<HistorialNecesidad` → `sec-historial`.

En `<AdmisibilidadDec` el envoltorio va DENTRO del condicional
`{necesidad.status !== "borrador" ? (...) : null}`, no fuera: si no, quedaría un `div` vacío.

- [ ] **Paso 2: Comprobar que los once identificadores existen**

Ejecutar:

```bash
grep -o 'id="sec-[a-z]*"' app/components/necesidad-detail.tsx | sort -u
```

Esperado: `sec-adjuntos`, `sec-admisibilidad`, `sec-coherencia`, `sec-derivacion`, `sec-eett`,
`sec-ficha`, `sec-flujo`, `sec-historial`, `sec-observaciones`, `sec-riesgos`, `sec-verificacion`.

- [ ] **Paso 3: Verificar y commitear**

```bash
npx tsc --noEmit && npx eslint app/components/necesidad-detail.tsx && npx vitest run
git add app/components/necesidad-detail.tsx
git commit -m "refactor(necesidades): dar id propio a los bloques anidados de la ficha"
```

---

### Tarea 2: El módulo del reparto, con sus pruebas

**Ficheros:**
- Crear: `lib/necesidad-modos.ts`
- Crear: `tests/necesidad-modos.test.ts`

**Interfaces:**
- Produce:
  - `type ModoFicha = "redactar" | "revisar"`
  - `BLOQUES_FICHA: ReadonlyArray<{ id: string; label: string; modos: readonly ModoFicha[] }>`
  - `panelesDelModo(modo: ModoFicha): string[]` — ids de ese modo, en orden
  - `modoParaSeccion(id: string): ModoFicha | null` — `null` si el id es desconocido
  - `MODO_POR_DEFECTO: ModoFicha` (vale `"redactar"`)

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `tests/necesidad-modos.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  BLOQUES_FICHA,
  MODO_POR_DEFECTO,
  modoParaSeccion,
  panelesDelModo,
} from "@/lib/necesidad-modos";

describe("reparto de bloques por modo", () => {
  it("ningun bloque queda huerfano", () => {
    // Un bloque sin modo no se ve NUNCA: el usuario concluye que desaparecio.
    for (const b of BLOQUES_FICHA) {
      expect(b.modos.length, b.id).toBeGreaterThan(0);
    }
  });

  it("los dos modos tienen contenido", () => {
    expect(panelesDelModo("redactar").length).toBeGreaterThan(0);
    expect(panelesDelModo("revisar").length).toBeGreaterThan(0);
  });

  it("la ficha, el flujo y la cabecera viven en los dos modos", () => {
    // Quien revisa necesita leer lo que juzga sin cambiar de modo.
    for (const id of ["sec-flujo", "sec-ficha"]) {
      expect(modoParaSeccion(id), id).toBe(null);
      expect(panelesDelModo("redactar")).toContain(id);
      expect(panelesDelModo("revisar")).toContain(id);
    }
  });

  it("un id desconocido devuelve null en vez de lanzar", () => {
    expect(modoParaSeccion("sec-inventado")).toBe(null);
  });

  it("no hay ids repetidos en el catalogo", () => {
    const ids = BLOQUES_FICHA.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("el modo por defecto es redactar", () => {
    expect(MODO_POR_DEFECTO).toBe("redactar");
  });
});
```

- [ ] **Paso 2: Ejecutarla y ver que falla**

```bash
npx vitest run tests/necesidad-modos.test.ts
```

Esperado: FALLA con «Cannot find module '@/lib/necesidad-modos'».

- [ ] **Paso 3: Escribir el módulo**

Crear `lib/necesidad-modos.ts`:

```ts
/**
 * Reparto de los bloques de la ficha entre los dos modos de trabajo.
 *
 * Vive aqui y no dentro del JSX por una razon concreta: el suite no renderiza
 * React (`environment: "node"`), asi que con el reparto disperso en el markup no
 * se podria comprobar lo unico que hundiria la idea —un bloque que quede fuera de
 * los dos modos y desaparezca sin que nadie lo note—.
 */

export type ModoFicha = "redactar" | "revisar";

export const MODO_POR_DEFECTO: ModoFicha = "redactar";

const AMBOS = ["redactar", "revisar"] as const;

export const BLOQUES_FICHA = [
  // La cabecera y el flujo orientan en los dos modos. El diff de no objecion
  // viaja dentro del flujo, porque explica el punto en que esta.
  { id: "sec-flujo", label: "Flujo y estado", modos: AMBOS },
  { id: "sec-eett", label: "EETT / TDR", modos: ["redactar"] },
  // La ficha se lee en los dos; solo cambia si es editable.
  { id: "sec-ficha", label: "Ficha del requerimiento", modos: AMBOS },
  { id: "sec-adjuntos", label: "Adjuntos", modos: ["redactar"] },
  { id: "sec-riesgos", label: "Riesgos", modos: ["redactar"] },
  { id: "sec-verificacion", label: "¿Está lista?", modos: AMBOS },
  { id: "sec-coherencia", label: "Coherencia", modos: AMBOS },
  { id: "sec-observaciones", label: "Observaciones", modos: AMBOS },
  { id: "sec-admisibilidad", label: "Admisibilidad (DEC)", modos: ["revisar"] },
  { id: "sec-derivacion", label: "Derivación", modos: ["revisar"] },
  { id: "sec-historial", label: "Historial", modos: ["revisar"] },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  modos: readonly ModoFicha[];
}>;

/** Ids de los bloques de un modo, en el orden en que se pintan. */
export function panelesDelModo(modo: ModoFicha): string[] {
  return BLOQUES_FICHA.filter((b) => (b.modos as readonly ModoFicha[]).includes(modo)).map(
    (b) => b.id,
  );
}

/**
 * A que modo hay que cambiar para ver ese bloque.
 *
 * `null` cuando el bloque esta en los dos —no hace falta cambiar— y tambien
 * cuando el id es desconocido. En ambos casos el llamador hace lo mismo: no
 * cambiar de modo e intentar el desplazamiento. Degradar asi es mejor que lanzar
 * y dejar la pantalla a medias por un id mal escrito.
 */
export function modoParaSeccion(id: string): ModoFicha | null {
  const bloque = BLOQUES_FICHA.find((b) => b.id === id);
  if (!bloque || bloque.modos.length !== 1) return null;
  return bloque.modos[0];
}
```

- [ ] **Paso 4: Ejecutar y ver que pasa**

```bash
npx vitest run tests/necesidad-modos.test.ts
```

Esperado: 6 pruebas en verde.

- [ ] **Paso 5: Commitear**

```bash
npx tsc --noEmit && npx eslint lib
git add lib/necesidad-modos.ts tests/necesidad-modos.test.ts
git commit -m "feat(necesidades): modulo del reparto de bloques por modo"
```

---

### Tarea 3: Prueba que ata el catálogo al componente

Sin esto, alguien añade un bloque a la ficha y el catálogo se queda atrás. El bloque nuevo no
aparecería en ningún modo y nadie se enteraría hasta que un usuario lo eche en falta.

**Ficheros:**
- Modificar: `tests/necesidad-modos.test.ts`

**Interfaces:**
- Consume: `BLOQUES_FICHA` de la tarea 2, y los `id="sec-*"` de la tarea 1.

- [ ] **Paso 1: Escribir la prueba que falla**

Añadir a `tests/necesidad-modos.test.ts`:

```ts
import { readFileSync } from "node:fs";

describe("el catalogo no se queda atras del componente", () => {
  const fuente = readFileSync("app/components/necesidad-detail.tsx", "utf-8");
  const enElDom = [...fuente.matchAll(/id="(sec-[a-z]+)"/g)].map((m) => m[1]);

  it("todo sec-* del componente esta en el catalogo", () => {
    const catalogados = new Set(BLOQUES_FICHA.map((b) => b.id));
    const sinCatalogar = [...new Set(enElDom)].filter((id) => !catalogados.has(id));
    expect(sinCatalogar, "bloques en pantalla sin modo asignado").toEqual([]);
  });

  it("todo bloque del catalogo existe en el componente", () => {
    const presentes = new Set(enElDom);
    const fantasmas = BLOQUES_FICHA.map((b) => b.id).filter((id) => !presentes.has(id));
    expect(fantasmas, "bloques catalogados que ya no existen").toEqual([]);
  });
});
```

- [ ] **Paso 2: Ejecutarla**

```bash
npx vitest run tests/necesidad-modos.test.ts
```

Esperado: PASA si las tareas 1 y 2 están bien. Si falla, el mensaje dice exactamente qué id
sobra o falta — arreglarlo antes de seguir.

- [ ] **Paso 3: Commitear**

```bash
git add tests/necesidad-modos.test.ts
git commit -m "test(necesidades): atar el catalogo de modos a los bloques reales"
```

---

### Tarea 4: El interruptor, con memoria

Aún no reparte nada: solo introduce el estado, lo persiste y lo enseña. Así se puede comprobar la
persistencia por separado de la reorganización, que es la parte arriesgada.

**Ficheros:**
- Modificar: `app/components/necesidad-detail.tsx` (junto a `modoSimple`, hacia la línea 1149, y la
  barra de acciones donde está el botón «Modo simple», hacia la 3970)

**Interfaces:**
- Consume: `ModoFicha`, `MODO_POR_DEFECTO` de la tarea 2.
- Produce: el estado `modo` y `cambiarModo(siguiente)`, que usa la tarea 5.

- [ ] **Paso 1: Añadir el estado y la lectura del almacenamiento**

Justo después del bloque de `modoSimple`, imitando su patrón exacto:

```tsx
// Modo de trabajo. Arranca en Redactar y recuerda el ultimo usado, por navegador.
// Eso reparte por rol SIN una tabla de roles: quien trabaja en la DEC acabara
// abriendo en Revisar porque es donde trabaja.
const [modo, setModo] = useState<ModoFicha>(MODO_POR_DEFECTO);
useEffect(() => {
  try {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    const guardado = localStorage.getItem("ficha-modo-trabajo");
    if (guardado === "redactar" || guardado === "revisar") setModo(guardado);
  } catch { /* ignora */ }
}, []);

function cambiarModo(siguiente: ModoFicha) {
  setModo(siguiente);
  try { localStorage.setItem("ficha-modo-trabajo", siguiente); } catch { /* ignora */ }
}
```

Añadir el import:

```tsx
import {
  BLOQUES_FICHA,
  MODO_POR_DEFECTO,
  type ModoFicha,
  modoParaSeccion,
  panelesDelModo,
} from "@/lib/necesidad-modos";
```

- [ ] **Paso 2: Añadir el interruptor a la barra de acciones**

Junto al botón «Modo simple», con el mismo grupo de dos botones que ya usa «Solo obligatorios /
Todos los campos»:

```tsx
<div className="inline-flex rounded-[10px] border border-line bg-surface p-0.5" role="group" aria-label="Modo de trabajo">
  {([["redactar", "Redactar"], ["revisar", "Revisar"]] as const).map(([valor, etiqueta]) => (
    <button
      aria-pressed={modo === valor}
      className={cn(
        "rounded-[8px] px-3 py-1.5 text-[12.5px] font-semibold transition",
        modo === valor ? "bg-brand text-white shadow-card" : "text-muted hover:text-brand",
      )}
      key={valor}
      onClick={() => cambiarModo(valor)}
      type="button"
    >
      {etiqueta}
    </button>
  ))}
</div>
```

- [ ] **Paso 3: Verificar**

```bash
npx tsc --noEmit && npx eslint app/components/necesidad-detail.tsx && npx vitest run
```

Comprobación manual (el suite no renderiza React, así que esto no lo cubre ningún test):
abrir una necesidad, pulsar «Revisar», recargar la página y confirmar que sigue en Revisar;
pulsar «Redactar», recargar, confirmar que sigue en Redactar.

- [ ] **Paso 4: Commitear**

```bash
git add app/components/necesidad-detail.tsx
git commit -m "feat(necesidades): interruptor de modo de trabajo con memoria"
```

---

### Tarea 5: Repartir los bloques y cablear los saltos

La tarea arriesgada, y por eso va la última: para entonces el reparto ya está probado y el
interruptor ya funciona.

**Ficheros:**
- Modificar: `app/components/necesidad-detail.tsx`

**Interfaces:**
- Consume: `modo`, `cambiarModo` (tarea 4); `modoParaSeccion`, `panelesDelModo` (tarea 2).

- [ ] **Paso 1: Condicionar cada bloque a su modo**

Envolver cada bloque con su condición, usando el catálogo como fuente:

```tsx
{panelesDelModo(modo).includes("sec-eett") ? (
  /* …el bloque EETT/TDR tal como está hoy… */
) : null}
```

Aplicarlo a los once. Los que están en ambos modos (`sec-flujo`, `sec-ficha`,
`sec-verificacion`, `sec-coherencia`, `sec-observaciones`) pasan la condición siempre — se
envuelven igual, para que añadir o quitar un modo en el catálogo baste sin tocar el JSX.

La ficha además pasa a solo lectura en Revisar: donde hoy se decide `fichaEdit`, añadir
`&& modo === "redactar"`.

- [ ] **Paso 2: Cablear los tres saltos automáticos**

En `irACampo` (hacia la línea 1767), antes de `startFichaEdit()`:

```tsx
function irACampo(api: string) {
  // La ficha solo es editable en Redactar: sin este cambio, pulsar «ir al campo»
  // desde un diagnostico en Revisar no haria nada visible.
  cambiarModo("redactar");
  startFichaEdit();
  setWizardMode(false);
  requestAnimationFrame(() => { /* …lo que ya hay… */ });
}
```

En el `onClick` de los chips de navegación rápida:

```tsx
onClick={() => {
  // El destino puede vivir en el otro modo. Sin esto el clic no haria nada y
  // nadie sabria por que.
  const destino = modoParaSeccion(t.id);
  if (destino) cambiarModo(destino);
  requestAnimationFrame(() => {
    document.getElementById(t.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}}
```

En `startFichaEdit`, primera línea: `cambiarModo("redactar");`.

- [ ] **Paso 3: Filtrar los chips por modo**

La lista de chips pasa a construirse desde el catálogo, de modo que solo salgan los del modo
activo más los que obligan a cambiar:

```tsx
{BLOQUES_FICHA.filter((b) => b.id !== "sec-riesgos" || riesgosAplica).map((t) => (
  /* …el botón tal como está, con t.label… */
))}
```

- [ ] **Paso 4: Verificar**

```bash
npx tsc --noEmit && npx eslint app lib && npx vitest run
```

Comprobación manual, una por una (ninguna la cubre el suite):

1. En Redactar: se ven EETT/TDR, ficha editable, adjuntos, riesgos. NO se ven admisibilidad,
   derivación ni historial.
2. En Revisar: se ven verificación, coherencia, admisibilidad, observaciones, ficha en solo
   lectura, derivación e historial. NO se ven EETT/TDR ni riesgos.
3. Estando en Revisar, pulsar «Ir al campo» en un punto de la verificación: cambia a Redactar,
   abre la ficha y enfoca el campo.
4. Estando en Redactar, pulsar el chip «Derivación»: cambia a Revisar y se desplaza al bloque.
5. Estando en Revisar, pulsar «Editar ficha»: cambia a Redactar.

- [ ] **Paso 5: Commitear**

```bash
git add app/components/necesidad-detail.tsx
git commit -m "feat(necesidades): repartir la ficha en modos Redactar y Revisar"
```

---

## Qué queda fuera, a propósito

Está en la especificación y se repite aquí para que nadie lo tome por olvido:

- **El reparto del estado y la extracción a ficheros.** Es lo que arregla la lentitud. El corte por
  modos crea la costura; extraer antes de repartir el estado obliga a pasar treinta props.
- **El modo en la URL.** Haría el enlace compartible. Nadie lo ha pedido.
- **El modo «Paso a paso».** Se conserva. Que su uso caiga a cero es una señal a observar.
