# Rediseño UX/UI de la Ficha de Necesidad — Diseño

Fecha: 2026-07-28 · Estado: **diseño, pendiente de aprobación** · Maqueta:
`scratchpad/ficha-rediseno.html` (artifact publicado)

**Objetivo:** profesionalizar la funcionalidad y el diseño de la Ficha de Necesidad
(`/necesidades/[id]`) tratándola como lo que es —un **instrumento jurídico de
captura de datos**, no un dashboard ni una landing— para que rellenar ~100 campos
legalmente precisos sea orientado, fiable y rápido.

**Alcance:** cuatro líneas de mejora (abajo). No es un repintado de la identidad
visual: reutiliza el sistema de tokens CSS existente y el Tailwind acotado bajo
`.tw`. Se acopla al plan de descomposición ya escrito
(`docs/superpowers/plans/2026-07-27-descomponer-necesidad-detail.md`), que es el
vehículo para introducir estos cambios sin regresión.

## Contexto y restricciones (heredadas del repo)

- **Cero tests de UI.** Los ~264 tests son de lógica; ninguna prueba renderiza
  React. Toda mejora visual se valida a ojo, pantalla por pantalla, y **la app
  exige login** (DNI + contraseña), así que la verificación en navegador es del
  usuario, no del agente.
- **`necesidad-detail.tsx` mide ~2.384 líneas** con el formulario controlado en la
  raíz: cada tecla re-renderiza todo. La descomposición planificada extrae el
  cuerpo cargado a piezas con `necesidad` no-nula; esa extracción es donde estas
  mejoras entran limpias (y donde la memoización deja de estar bloqueada por los
  returns tempranos).
- **Contrato campo↔columna intacto.** La ficha se persiste derivando de
  `necesidadCreateSchema` (`lib/necesidad-columnas.ts`): auditado, 104 campos, 0
  sin columna. Ninguna mejora de UI debe romper este derivado ni volver a listas
  manuales.
- **Tailwind acotado.** Sin Preflight global; los componentes nuevos deben
  añadirse a la lista `@source` o sus clases no se generan.

## Dirección visual (voz)

ACE es un instrumento de precisión del mundo del documento oficial peruano. La
maqueta lo traduce en tres decisiones deliberadas (no defaults de IA):

- **Tres roles tipográficos.** Serif de resolución para títulos de sección y
  extractos legales (autoridad); sans humanista para controles e inputs
  (operación); mono para artículos, códigos y plazos (precisión).
- **Neutro de papel frío** (sesgo azul-gris, no cream cálido) + **autoridad
  petróleo-navy** (no azul bootstrap).
- **Firma: el marcador de artículo "sellado" en latón** (`§ Art. 72.3.b`), usado
  solo en las referencias legales. Es el elemento memorable y es fiel al dominio
  (la cita verificable es un valor central del producto).

## Las cuatro líneas

### Línea 1 — Orientación (navegador de secciones + no-aplicables)

**Problema.** 11 secciones en una página abruman; el avance obligatorio se calcula
(`avanceRequerimiento`) pero no hay un índice que diga *por sección* qué falta, ni
se ocultan las secciones que el objeto/proceso no usa.

**Diseño.**
- Navegador lateral **sticky** con una fila por sección, cada una con su **marca de
  estado**: ✓ completa · nº de pendientes · ○ vacía · ⌀ no aplicable (atenuada,
  tachada).
- El estado por sección se deriva de la verificación por campo ya existente
  (`resumenNecesidad` + `FICHA_SECCIONES`), agregada por sección.
- **No-aplicables** se calculan con la aplicabilidad de fases por objeto+proceso
  que ya existe (`lib/aplicabilidad-fases.ts`); la sección se atenúa y su contenido
  se colapsa, sin borrarse (los datos siguen ahí si el objeto cambia).
- Clic en una sección → scroll + `aria-current`. Responsive: en <1080px pasa a una
  tira horizontal desplazable arriba.

**Interfaz que produce:** `<SectionNav secciones={estadoPorSeccion} activa onIr />`
donde `estadoPorSeccion: { titulo, ref, estado: "ok"|"pendiente"|"vacia"|"na",
pendientes: number }[]`.

### Línea 2 — Estado de guardado visible

**Problema.** El autoguardado (debounce + manejo de 409) existe, pero su estado no
siempre es legible; el usuario no sabe si su trabajo está a salvo.

**Diseño.** Indicador permanente en la topbar con tres estados textuales claros:
**Guardando…** (punto ámbar pulsante) · **Guardado hace X** · **Error al guardar
— Reintentar** (acción explícita). Cumple la guía `submit-feedback` (severidad
alta). No cambia la lógica de guardado; solo expone su estado.

### Línea 3 — Validación inline junto al campo

**Problema.** La verificación vive **agregada** en el panel lateral, lejos del
campo. El usuario ve "faltan 3" pero no *cuál* ni *por qué*, y tiene que cazarlos.

**Diseño.**
- El mensaje de "qué falta / qué contradice" aparece **bajo el campo**, con su
  **base legal**, en tres severidades: error (bloquea), aviso (coherencia), ok.
- Se valida **on blur** (guía `inline-validation`: nunca solo en submit), sin
  parpadear mientras se escribe.
- El panel lateral sigue existiendo como **índice**: cada diagnóstico es un botón
  que salta al campo y lo resalta (ya hay `irACampo`; se reutiliza). Doble vía:
  panel para el resumen, inline para el detalle en contexto.

### Línea 4 — Composer de IA unificado

**Problema.** Hay varios "Redactar con IA" con patrones distintos (redactar,
servicios similares, etc.); cada uno se comporta un poco diferente.

**Diseño.** Un **único componente compuesto** con un flujo constante:
**Proponer con IA → ver el extracto propuesto (anclado al objeto/modelo, con su
huella `[F#]`) → ver el diff contra el hueco `[CONSIGNAR…]` → Aceptar / Editar /
Descartar.** La propuesta nunca pisa el campo sin que el usuario lo confirme. El
extracto legal se renderiza en serif (voz de resolución) con su cita. Un solo
patrón para los ~26 puntos de llamada, con `slot`s para el texto y el ancla.

**Interfaz:** `<ComposerIA onProponer ancla huella>…</ComposerIA>` (patrón
compound component; ver `vercel-composition-patterns`).

## Sistema visual y accesibilidad (transversal a las 4)

- **Tokens fijos**: escala tipográfica, densidad 8 (dashboard), focus-ring visible
  (`inline-validation`/`focus-states`), escala de z-index (`--z-sticky/panel/pop`
  en vez de valores arbitrarios), `max-w` ~74ch en textareas legales
  (`line-length`).
- **Jerarquía sección › subgrupo › campo** con tipografía, no solo con sangría
  (los subgrupos "a) …" ganan etiqueta en versalita).
- **Light/dark** por tokens (media query + `data-theme`), ambos con contraste
  ≥ 4.5:1.
- **Pre-entrega** (checklist de la skill): sin emoji como iconos (SVG:
  Lucide, ya en uso), `cursor-pointer`, transiciones 150–300ms,
  `prefers-reduced-motion`, focus para teclado, responsive 375/768/1024/1440.

## Arquitectura de implementación

Nada de esto es un componente monolítico nuevo: son piezas que se cuelgan de la
descomposición de `necesidad-detail.tsx`.

- `SectionNav`, `ComposerIA`, `SaveStatus` y el `CampoFicha` con validación inline
  salen como componentes propios, memoizados, con props estables
  (`useCallbackEstable` para callbacks que cruzan a hijos memoizados).
- El estado por sección y los diagnósticos inline se **derivan** de datos ya
  calculados (`resumenNecesidad`, `tarjetasCoherencia`, aplicabilidad de fases);
  no se añade fuente de verdad nueva.
- **Sin migración SQL**: no hay columnas nuevas. Es puro cliente + presentación.

## Riesgos y validación

- **Sin red de UI.** Antes de tocar, la Fase 0 del plan de descomposición debería
  añadir una red mínima (al menos una prueba de estructura/estado de las funciones
  derivadas que alimentan `SectionNav`). Lo visual se valida a ojo en el preview,
  con el checklist de pre-entrega, por el usuario (login).
- **Rendimiento.** Estas extracciones habilitan la memoización que hoy está
  bloqueada; deben dejar de repintar los paneles en cada tecla (medir con el
  perfil de React).
- **No romper el derivado campo↔columna** ni el contrato de traslado IA→ficha.

## Orden sugerido

1. **Línea 1 + 2** (orientación + estado de guardado): máxima reducción de
   fricción, riesgo bajo, no tocan lógica de dominio.
2. **Línea 3** (validación inline): reusa `irACampo` y la verificación existente.
3. **Línea 4** (composer unificado): la más transversal; conviene hacerla cuando
   una pieza del composer ya esté extraída.
4. **Sistema visual + A11y**: se aplica de forma incremental sobre cada pieza
   extraída, no en un big-bang.
