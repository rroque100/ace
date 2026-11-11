# Diseño propuesto: el estado vacío del chat enseña lo que el chat sabe hacer

Fecha: 10 de noviembre de 2026. Estado: diseño aprobado por el usuario; implementación autorizada.

## Objetivo

Que quien abre `/chat` por primera vez sepa, sin escribir nada, qué clase de
preguntas resuelve el asistente y qué puede aportar para que la respuesta sea
precisa.

## Punto de partida (lo que ya existe)

El estado vacío NO está por hacer. `app/components/legal-chat.tsx` ya renderiza
un panel con «¿Qué necesitas resolver?», un párrafo de bienvenida y **tres
ejemplos clicables** que rellenan el compositor (`exampleQuestions`).

Lo que falla es otra cosa:

1. Los tres ejemplos son los tres de *requisitos*. Ninguno enseña los caminos
   que distinguen a este chat: aplicación de la ley en el tiempo, vigencia y
   derogación, aritmética de un plazo, regla con sus excepciones.
2. El texto invita a «adjuntar un documento de tu caso», pero el control está
   abajo y plegado. No hay camino de descubrimiento a acción, ni para adjuntar,
   ni para dictar, ni para los datos del caso.
3. No dice qué corpus cubre ni promete lo que lo diferencia (que avisa cuando no
   encuentra respaldo en vez de inventar).
4. Todo eso sí está —mejor redactado— en la guía de `lib/chat-meta.ts`, que solo
   se ve si el usuario escribe «hola» o «¿qué sabes hacer?». Son dos textos
   para lo mismo, mantenidos por separado.

## Alternativas

1. **Fuente única en `chat-meta.ts` y acciones sobre los paneles existentes**
   (recomendada). Los ejemplos y las dos frases que definen al asistente pasan a
   constantes exportadas; la guía las compone y el estado vacío las importa. Las
   acciones no crean controles nuevos: abren los que ya hay.
2. **Componente nuevo autónomo** (`chat-empty-state.tsx`) con sus propios
   textos. Más fácil de leer, pero conserva dos redacciones de lo mismo: es el
   problema que este diseño viene a quitar.
3. **Encuadre obligatorio antes de preguntar** (objeto, etapa, fecha como paso
   previo). Descartada: bloquea a quien solo quiere preguntar algo suelto. La
   entrevista de encuadre es un diseño aparte.

## Diseño recomendado

### Contenido compartido

En `lib/chat-meta.ts` (módulo puro, ya importado por servidor y pantalla):

- `EJEMPLOS_CHAT`: las cinco preguntas de ejemplo.
- `COBERTURA_CHAT`: una línea con el corpus cubierto (Ley 32069 y su Reglamento;
  Ley 30225 para los procedimientos convocados antes).
- `PROMESA_SIN_RESPALDO`: la frase de que avisa en lugar de inventar.

`metaQuestionAnswer()` compone su markdown a partir de esas constantes. El
estado vacío importa las mismas. Ninguna frase queda escrita dos veces.

### Los cinco ejemplos

Cada uno ejercita un camino distinto del motor; no se eligen por variedad de
tema:

| Ejemplo | Camino que enseña |
| --- | --- |
| ¿Qué requisitos tiene una compra por comparación de precios? | Pasada tipada al Reglamento |
| Mi procedimiento se convocó en junio de 2026, ¿puedo aplicar la Ley 30225? | `chat-regime` y el bloque de aplicación temporal |
| ¿Hasta qué fecha vence un plazo de ocho días hábiles contado desde el 12 de marzo? | `chat-plazo-calculo` (aritmética con feriados) |
| ¿Qué norma derogó la Ley 30225 y desde cuándo? | `chat-vigencia` (disposiciones complementarias) |
| ¿Cuándo no se exige la garantía de fiel cumplimiento? | Regla con excepciones y verificación de citas |

Restricción de redacción, no cosmética: `tests/chat-meta.test.ts` prohíbe que la
guía contenga `\d+ días`, `\d+ ?%` o `artículo \d`, porque los ejemplos son
preguntas y no pueden parecer afirmaciones jurídicas. Por eso el plazo se
escribe «**ocho** días hábiles» en palabra —que es además la forma que
`detectarCalculoPlazo` reconoce por diseño— y la garantía va sin porcentaje. Los
cinco pasan el guard actual: ese test no se toca.

### Las tres acciones

- **Adjuntar un documento del caso**: abre el panel de `case-attachments.tsx` y
  lo desplaza a la vista. Para eso su `<details>` acepta `open` y `onOpenChange`
  opcionales; sin esas props sigue siendo autónomo como hoy.
- **Dictar la pregunta**: una segunda instancia de `VoiceDictation` con el mismo
  `onInsert` que la del compositor. El componente compartido no se modifica.
- **Añadir datos del caso**: el `<details>` de contexto en `legal-chat.tsx` pasa
  a estado controlado local; la acción lo abre y enfoca *Objeto contractual*.

No se programa el clic del `input[type=file]` desde el botón: depende de la
activación transitoria del navegador y falla de forma distinta en cada uno. Se
abre el panel, cuyo primer control es el de subida.

### Estructura

Intro de dos líneas (qué cubre y la promesa) → cinco ejemplos → tres acciones.
Todo con utilidades y tokens en `legal-chat-estilos.ts`, sin CSS de componente
ni estilos en línea, para no mover `tests/tailwind-migracion.test.ts` ni la
paleta.

## Alcance y compatibilidad

Solo el estado vacío del chat y el contenido compartido con la guía. No cambia
la recuperación, el gating, la verificación de citas, el corpus ni ninguna regla
jurídica. `case-attachments.tsx` y el `<details>` de contexto mantienen su
comportamiento actual cuando no se les pasan las props nuevas; `VoiceDictation`
no se modifica. Sin dependencias nuevas.

## Validación

- `npm run lint`, `npm run typecheck`, `npm run test`.
- Caso nuevo en `tests/chat-meta.test.ts` que recorre el catálogo entero: cada
  ejemplo de `EJEMPLOS_CHAT` debe aparecer en la guía, de modo que pantalla y
  guía no puedan volver a divergir.
- Preview con sesión: los cinco ejemplos se envían de verdad y se comprueba que
  cada uno devuelve lo que promete (en particular, que el del plazo devuelve una
  fecha). Un ejemplo que no rinda se cambia, no se deja.
- Las tres acciones abren su panel, con teclado y en ancho de móvil.

Estas comprobaciones son de software: no acreditan corrección jurídica de
ninguna respuesta.
