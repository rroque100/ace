# Estado vacío guiado del chat jurídico · plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la pantalla inicial de `/chat` enseñe, sin que el usuario escriba nada, los cinco caminos que el chat resuelve de verdad y las tres cosas que puede aportar para que la respuesta sea precisa.

**Architecture:** Los ejemplos y las dos frases que definen al asistente pasan a constantes en `lib/chat-meta.ts` (módulo puro que ya usan el servidor y la pantalla); la guía fija y el estado vacío las consumen, así que no puede haber dos redacciones. Las tres acciones no crean controles: abren los paneles que ya están debajo del compositor, con props `open` opcionales en `case-attachments.tsx` y estado local para el `<details>` de contexto.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript estricto, Tailwind acotado por `.tw`, Vitest (entorno node), lucide-react, Radix Dialog.

## Global Constraints

- Código, comentarios y commits **en español**; vocabulario del dominio sin traducir.
- Commits en Conventional Commits con scope, y el asunto describe **el síntoma que veía el usuario**, en minúscula.
- Colores **solo con tokens** (`text-brand`, `text-muted`, `border-line`…): nada de hex ni paleta por defecto. Lo impide `tests/paleta-colores.test.ts`.
- **Sin CSS de componente nuevo y sin `style` en línea**: los estilos van como utilidades en `app/components/legal-chat-estilos.ts`. Lo impide `tests/tailwind-migracion.test.ts`.
- Los ejemplos son **preguntas**, nunca afirmaciones jurídicas: `tests/chat-meta.test.ts` prohíbe en la guía `\[F\d+\]`, `artículo \d`, `\d+ ?%` y `\d+ días`. Ese test **no se modifica**.
- Dependencias con `npm install --legacy-peer-deps`.
- Para levantar la app, el preview del entorno (`.claude/launch.json`), no `npm run dev` por Bash.
- Comentarios que explican **por qué**, no qué.

---

### Task 1: Contenido compartido entre la guía y la pantalla inicial

**Files:**
- Modify: `lib/chat-meta.ts:45-63` (la función `metaQuestionAnswer`)
- Test: `tests/chat-meta.test.ts`

**Interfaces:**
- Consumes: nada de tareas anteriores.
- Produces: `EJEMPLOS_CHAT: readonly string[]` (5 elementos), `COBERTURA_CHAT: string`, `PROMESA_SIN_RESPALDO: string`, todos exportados desde `lib/chat-meta.ts`. La Task 2 los importa.

- [ ] **Step 1: Escribir el test que falla**

Añade este caso al final del `describe("preguntas sobre el propio asistente", …)` de `tests/chat-meta.test.ts`, y añade `EJEMPLOS_CHAT` al import que ya existe en la línea 2:

```ts
  // Recorre el catálogo entero, no un ejemplo suelto: la pantalla inicial y la guía tienen que ofrecer
  // exactamente los mismos ejemplos, que es lo que se desincronizó cuando cada una tenía su propia lista.
  it("la guía ofrece todos los ejemplos de la pantalla inicial, y ninguno afirma un dato jurídico", () => {
    const guia = metaQuestionAnswer();
    expect(EJEMPLOS_CHAT.length).toBeGreaterThanOrEqual(5);
    for (const ejemplo of EJEMPLOS_CHAT) {
      expect(guia, ejemplo).toContain(ejemplo);
      // Un ejemplo con «8 días» o «10 %» se leería como respuesta, no como pregunta.
      expect(ejemplo, ejemplo).not.toMatch(/\[F\d+\]|artículo \d|\d+ ?%|\d+ días/i);
      expect(ejemplo, ejemplo).toMatch(/\?$/);
    }
  });
```

- [ ] **Step 2: Comprobar que falla**

Run: `npx vitest run tests/chat-meta.test.ts`
Expected: FAIL — `EJEMPLOS_CHAT` no existe en `@/lib/chat-meta` (error de tipos / import undefined).

- [ ] **Step 3: Implementar las constantes y recomponer la guía**

En `lib/chat-meta.ts`, justo antes de `metaQuestionAnswer`, añade:

```ts
/**
 * Los ejemplos que se ofrecen en la pantalla inicial del chat y en esta guía. Cada uno ejercita un camino
 * DISTINTO del motor —pasada tipada al Reglamento, régimen por fecha de convocatoria, aritmética de un
 * plazo, disposición derogatoria, regla con excepciones—, porque la pantalla inicial solo traía ejemplos de
 * requisitos y nadie descubría el resto. Son preguntas: ninguno afirma un plazo, un porcentaje ni un
 * artículo (lo comprueba tests/chat-meta.test.ts). El plazo va en palabra («ocho días hábiles») por eso y
 * porque es la forma que `detectarCalculoPlazo` reconoce.
 */
export const EJEMPLOS_CHAT = [
  "¿Qué requisitos tiene una compra por comparación de precios?",
  "Mi procedimiento se convocó en junio de 2026, ¿puedo aplicar la Ley 30225?",
  "¿Hasta qué fecha vence un plazo de ocho días hábiles contado desde el 12 de marzo?",
  "¿Qué norma derogó la Ley 30225 y desde cuándo?",
  "¿Cuándo no se exige la garantía de fiel cumplimiento?",
] as const;

/** Qué corpus cubre el asistente. Una sola redacción para la guía y la pantalla inicial. */
export const COBERTURA_CHAT =
  "la Ley 32069 y su Reglamento, y la Ley 30225 para los procedimientos convocados antes";

/** Lo que distingue a este asistente de un chat cualquiera. Va en la guía y en la pantalla inicial. */
export const PROMESA_SIN_RESPALDO =
  "Si no encuentro respaldo en las normas disponibles, te lo digo en lugar de inventar una respuesta.";
```

Y sustituye el cuerpo de `metaQuestionAnswer` por esta versión, que compone con las constantes:

```ts
export function metaQuestionAnswer(): string {
  return (
    "**Soy el asistente jurídico de ACE**\n" +
    `Respondo dudas sobre contrataciones públicas en el Perú —${COBERTURA_CHAT}—, ` +
    "y te muestro la norma en la que se apoya cada respuesta para que puedas comprobarla.\n\n" +
    "**Puedes preguntarme, por ejemplo:**\n" +
    `${EJEMPLOS_CHAT.map((ejemplo) => `- ${ejemplo}`).join("\n")}\n\n` +
    "**Para una respuesta más precisa**\n" +
    "1. Indica **qué se contrata** (bienes, servicios, obras o consultoría) y **en qué etapa** estás.\n" +
    "2. Di **cuándo se convocó** el procedimiento: de eso depende qué ley se aplica.\n" +
    "3. Si tienes un documento del caso, adjúntalo, o completa «Añadir datos del caso» debajo de la caja de pregunta.\n\n" +
    `${PROMESA_SIN_RESPALDO} ` +
    "También puedes usar **Búsqueda documental** para encontrar normas, opiniones y resoluciones por número o por tema."
  );
}
```

- [ ] **Step 4: Comprobar que pasa, incluido el guard anterior**

Run: `npx vitest run tests/chat-meta.test.ts`
Expected: PASS en los cuatro casos. En particular sigue pasando «la guía dice qué cubre, da ejemplos como preguntas y no afirma nada jurídico ni cita fuentes»: `COBERTURA_CHAT` contiene «Ley 32069» y `PROMESA_SIN_RESPALDO` contiene «en lugar de inventar».

- [ ] **Step 5: Commit**

```bash
git add lib/chat-meta.ts tests/chat-meta.test.ts
git commit -m "feat(chat): la guia y la pantalla inicial dejan de contar cosas distintas"
```

---

### Task 2: La pantalla inicial enseña los cinco caminos

**Files:**
- Modify: `app/components/legal-chat.tsx:178-182` (quitar `exampleQuestions`), `app/components/legal-chat.tsx:1347-1370` (el bloque del estado vacío), y el import de `@/lib/chat-meta`
- Modify: `app/components/legal-chat-estilos.ts` (una clave nueva)

**Interfaces:**
- Consumes: `EJEMPLOS_CHAT`, `COBERTURA_CHAT`, `PROMESA_SIN_RESPALDO` de `lib/chat-meta.ts` (Task 1).
- Produces: nada que consuman tareas posteriores; la Task 3 añade markup dentro del mismo bloque `S.chatEmptyRedesign`.

- [ ] **Step 1: Añadir el estilo de la promesa**

En `app/components/legal-chat-estilos.ts`, añade la clave en orden alfabético (va justo después de `chatEmptyIntro`):

```ts
  chatEmptyPromise: "flex items-start gap-2 text-left text-[12.5px] leading-5 text-muted [&_svg]:mt-0.5 [&_svg]:shrink-0",
```

- [ ] **Step 2: Importar el contenido compartido y borrar la lista local**

En `app/components/legal-chat.tsx`, añade el import (junto a los demás de `@/lib/...`):

```ts
import { COBERTURA_CHAT, EJEMPLOS_CHAT, PROMESA_SIN_RESPALDO } from "@/lib/chat-meta";
```

Y borra por completo el bloque de las líneas 178-182:

```ts
const exampleQuestions = [
  "¿Cuáles son los requisitos para una compra por comparación de precios?",
  "¿Cómo revisar si están bien hechas las especificaciones técnicas de subasta inversa electrónica?",
  "¿Qué garantías y cláusulas obligatorias debe incluir un contrato?",
];
```

- [ ] **Step 3: Reescribir el bloque del estado vacío**

Sustituye el contenido de `<div className={S.chatEmptyRedesign}>` (líneas 1348-1369) por:

```tsx
          <div className={S.chatEmptyRedesign}>
            <div className={S.chatEmptyIntro}>
              <div className={S.chatEmptyIcon}>
                <Bot size={28} />
              </div>
              <strong>¿Qué necesitas resolver?</strong>
              <span>
                Cuéntame tu duda sobre contrataciones públicas: respondo con {COBERTURA_CHAT}, y te muestro la norma en la que se apoya cada respuesta.
              </span>
              {/* La promesa de no inventar solo la veía quien escribía «hola»: es lo que distingue a este
                  asistente, así que va donde se decide si preguntar o no. */}
              <small className={S.chatEmptyPromise}>
                <ShieldCheck size={15} aria-hidden="true" />
                {PROMESA_SIN_RESPALDO}
              </small>
            </div>

            <div className={S.chatEmptyExamples}>
              <p>Prueba una de estas · cada una usa algo distinto de lo que sé hacer</p>
              <div className={S.exampleCards}>
                {EJEMPLOS_CHAT.map((item) => (
                  <button key={item} onClick={() => { setQuestion(item); composerRef.current?.focus(); }} type="button">
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>
```

`Bot` y `ShieldCheck` ya están importados de `lucide-react` en este fichero; no añadas imports de iconos en este paso.

- [ ] **Step 4: Comprobar tipos, lint y la suite**

Run: `npm run typecheck`
Expected: sin errores (si queda alguna referencia a `exampleQuestions`, aquí salta).

Run: `npm run lint`
Expected: sin errores.

Run: `npx vitest run tests/tailwind-migracion.test.ts tests/paleta-colores.test.ts`
Expected: PASS — no se añadió CSS de componente, ni `style` en línea, ni color fuera de tokens.

- [ ] **Step 5: Commit**

```bash
git add app/components/legal-chat.tsx app/components/legal-chat-estilos.ts
git commit -m "feat(chat): la pantalla inicial ensena los cinco caminos que el chat resuelve"
```

---

### Task 3: Adjuntar, dictar y dar datos del caso desde la pantalla inicial

**Files:**
- Modify: `app/components/case-attachments.tsx:9-27` (props) y `:85` (el `<details>`)
- Modify: `app/components/legal-chat.tsx` (estado y handlers nuevos junto a `focusComposer`, línea ~1337; el `<CaseAttachments />` de la línea 1734; el `<details>` de contexto de la línea 1746; el bloque del estado vacío de la Task 2)
- Modify: `app/components/legal-chat-estilos.ts` (dos claves nuevas)

**Interfaces:**
- Consumes: el bloque del estado vacío de la Task 2; `insertDictation` y `focusComposer` (ya existen en `legal-chat.tsx:1327` y `:1337`); `focusCaseField(field: CaseField)` (`:1336`).
- Produces: `CaseAttachments` acepta además `open?: boolean` y `onOpenChange?: (open: boolean) => void`. Sin esas props su comportamiento es el de hoy (`<details>` no controlado).

- [ ] **Step 1: Hacer opcionalmente controlable el panel de adjuntos**

En `app/components/case-attachments.tsx`, añade las dos props a la firma y al tipo:

```tsx
export function CaseAttachments({
  sessionId,
  onSession,
  onChange,
  selected,
  onBusy,
  disabled = false,
  open,
  onOpenChange,
}: {
  sessionId: string | null;
  onSession: (id: string) => void;
  onChange: (ids: string[]) => void;
  onBusy: (busy: boolean) => void;
  selected: string[];
  disabled?: boolean;
  /** Abre el panel desde fuera (la pantalla inicial del chat). Sin esta prop, el panel es autónomo. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
```

Y sustituye la apertura del `<details>` (línea 85):

```tsx
    <details
      className="legalWorkspacePanel"
      {...(open === undefined ? {} : { open })}
      onToggle={(event) => onOpenChange?.(event.currentTarget.open)}
    >
```

El `...(open === undefined ? {} : { open })` es lo que conserva el modo no controlado: pasar `open={undefined}` a un `<details>` lo deja cerrado en cada render y el usuario no podría abrirlo a mano.

- [ ] **Step 2: Estado, ref y handlers en el chat**

En `app/components/legal-chat.tsx`, junto a los demás `useState` del componente, añade:

```tsx
  const [adjuntosAbierto, setAdjuntosAbierto] = useState(false);
  const [datosDelCasoAbierto, setDatosDelCasoAbierto] = useState(false);
  const adjuntosRef = useRef<HTMLDivElement>(null);
```

Y justo después de `focusComposer` (línea 1340), los handlers:

```tsx
  // Las acciones de la pantalla inicial abren los paneles que YA existen debajo del compositor, en vez de
  // duplicar controles. No se dispara el clic del input[type=file] desde aquí: eso depende de la activación
  // transitoria del navegador y falla distinto en cada uno; se abre el panel, cuyo primer control es el de
  // subida.
  function abrirAdjuntos() {
    setAdjuntosAbierto(true);
    adjuntosRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  function abrirDatosDelCaso() {
    setDatosDelCasoAbierto(true);
    // El campo aún no es enfocable en este fotograma: el <details> se abre al pintar.
    requestAnimationFrame(() => focusCaseField("object"));
  }
```

- [ ] **Step 3: Conectar los dos paneles**

En la línea 1734, envuelve `CaseAttachments` y pásale las props (el `ref` va en un `div` para no ampliar la API del componente):

```tsx
      <div ref={adjuntosRef}>
        <CaseAttachments sessionId={sessionId} onSession={adoptSession} onBusy={setAttachmentsBusy} selected={attachmentIds} onChange={setAttachmentIds} disabled={isStreaming || loadingSession} open={adjuntosAbierto} onOpenChange={setAdjuntosAbierto} />
      </div>
```

Y en la línea 1746, haz controlado el `<details>` de contexto:

```tsx
        <details open={datosDelCasoAbierto} onToggle={(event) => setDatosDelCasoAbierto(event.currentTarget.open)}>
          <summary>Añadir datos del caso · opcional</summary>
```

- [ ] **Step 4: Añadir los estilos de la fila de acciones**

En `app/components/legal-chat-estilos.ts`, en orden alfabético:

```ts
  chatEmptyActionRow: "flex flex-wrap gap-2 [&_button]:inline-flex [&_button]:min-h-11 [&_button]:items-center [&_button]:gap-2 [&_button]:rounded-xl [&_button]:border [&_button]:border-line [&_button]:bg-panel [&_button]:px-3.5 [&_button]:py-2 [&_button]:text-[13px] [&_button]:font-semibold [&_button]:text-ink [&_button]:cursor-pointer [&_button:hover]:border-brand/40 [&_button:hover]:bg-brand-soft [&_svg]:text-brand",
  chatEmptyActions: "[&>p]:mt-0 [&>p]:mb-[9px] [&>p]:mx-0 [&>p]:text-muted [&>p]:text-[12.5px] [&>p]:font-bold",
```

- [ ] **Step 5: Añadir las tres acciones al estado vacío**

En `app/components/legal-chat.tsx`, dentro de `<div className={S.chatEmptyRedesign}>`, después del bloque `S.chatEmptyExamples`:

```tsx
            <div className={S.chatEmptyActions}>
              <p>O dame contexto primero · opcional</p>
              <div className={S.chatEmptyActionRow}>
                <button onClick={abrirAdjuntos} type="button" disabled={isStreaming || loadingSession}>
                  <Paperclip size={16} aria-hidden="true" />
                  Adjuntar un documento del caso
                </button>
                {/* El mismo dictado del compositor: inserta en la caja y nunca envía solo. */}
                <VoiceDictation onInsert={insertDictation} onAfterInsert={focusComposer} disabled={isStreaming || loadingSession} />
                <button onClick={abrirDatosDelCaso} type="button" disabled={isStreaming || loadingSession}>
                  <ClipboardList size={16} aria-hidden="true" />
                  Añadir datos del caso
                </button>
              </div>
            </div>
```

Añade `ClipboardList` y `Paperclip` a la lista de iconos importados de `lucide-react` (está ordenada alfabéticamente: `ClipboardList` va tras `Clipboard`, `Paperclip` tras `LoaderCircle`).

Aviso sobre el botón de dictado: su clase `voiceSearchTrigger` vive en `voice-search.css`, que se importa **fuera de capa**, y una regla sin capa gana a las utilidades de `[&_button]:…` sin importar la especificidad. Así que el botón del micrófono puede no igualar a los otros dos. Compruébalo en el Step 4 de la Task 4: si desencaja, pásale `compact` (usa `voiceDictationInline`, más pequeño) y ajusta la fila; no añadas `!` ni CSS nuevo para forzarlo.

- [ ] **Step 6: Comprobar tipos, lint y la suite completa**

Run: `npm run typecheck`
Expected: sin errores.

Run: `npm run lint`
Expected: sin errores.

Run: `npm run test`
Expected: PASS. `tests/chat-case-attachments.test.ts` y `tests/chat-case-context.test.ts` no deben cambiar de resultado: las props nuevas son opcionales.

- [ ] **Step 7: Commit**

```bash
git add app/components/legal-chat.tsx app/components/legal-chat-estilos.ts app/components/case-attachments.tsx
git commit -m "feat(chat): desde la pantalla inicial se puede adjuntar, dictar y dar datos del caso"
```

---

### Task 4: Comprobar en el preview que cada ejemplo rinde lo que promete

Los cinco ejemplos son promesas: si el del plazo no devuelve una fecha, la pantalla inicial queda peor que antes. Esta tarea es la que decide si alguno se cambia.

**Files:**
- Modify (solo si algún ejemplo no rinde): `lib/chat-meta.ts` (el texto de `EJEMPLOS_CHAT`)

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: nada.

- [ ] **Step 1: Levantar el preview e iniciar sesión**

Arranca el preview del entorno con la configuración de `.claude/launch.json` (no `npm run dev` por Bash). `/chat` no está en el allowlist de `isPublicPath`, así que la pantalla pide credenciales: la sesión la inicia la persona que acompaña la ejecución.

- [ ] **Step 2: Comprobar la pantalla inicial**

Expected: se ven la cobertura, la promesa, cinco ejemplos y tres acciones. Sin consola con errores.

- [ ] **Step 3: Enviar los cinco ejemplos, uno a uno**

Para cada ejemplo, pulsarlo y enviarlo. Lo que debe aparecer:

| Ejemplo | Qué tiene que traer la respuesta |
| --- | --- |
| comparación de precios | fuentes del Reglamento entre las normas citadas |
| convocado en junio de 2026 | el bloque de aplicación en el tiempo, con la regla de transición |
| ocho días hábiles desde el 12 de marzo | una **fecha** de vencimiento, en el bloque de cálculo |
| derogó la Ley 30225 | la disposición derogatoria, no artículos sueltos de la 30225 |
| garantía de fiel cumplimiento | la regla y sus excepciones, con citas `[F#]` comprobadas |

Un ejemplo que no cumpla su fila se reescribe en `EJEMPLOS_CHAT` (respetando el guard de la Task 1) y se vuelve a probar. No se deja un ejemplo que no rinda.

- [ ] **Step 4: Comprobar las tres acciones**

Expected: «Adjuntar un documento del caso» abre el panel de adjuntos y lo trae a la vista; «Dictar» abre el diálogo de dictado y lo insertado aparece en la caja; «Añadir datos del caso» abre el panel y el foco queda en *Objeto contractual*. Las tres, además, con teclado (Tab y Enter) y en ancho de móvil (375 px), sin desplazamiento horizontal.

- [ ] **Step 5: Comprobar que no se rompió el panel autónomo**

Expected: abrir y cerrar a mano el panel de adjuntos y el de datos del caso sigue funcionando, y lo mismo en `/comparar` y en cualquier otra pantalla que use `CaseAttachments` sin las props nuevas.

- [ ] **Step 6: Commit (solo si cambió algún ejemplo)**

```bash
git add lib/chat-meta.ts
git commit -m "fix(chat): un ejemplo de la pantalla inicial no devolvia lo que prometia"
```

---

## Qué queda fuera, a propósito

- La **entrevista de encuadre** (pedir objeto, etapa, fecha y cuantía juntos, con botones) es la brecha siguiente y tiene su propio diseño. Aquí solo se abre el panel que ya existe.
- El **streaming visible** de la respuesta y las **calculadoras deterministas** en el chat son trabajos aparte.
- No se toca la recuperación, el gating, la verificación de citas ni el corpus.
