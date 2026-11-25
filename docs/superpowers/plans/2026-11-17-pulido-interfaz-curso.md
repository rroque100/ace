# Pulido de la interfaz del curso — Plan

**Objetivo:** cerrar las 10 brechas detectadas en el análisis de la experiencia del alumno.

| # | Mejora | Ficheros | Tipo |
|---|---|---|---|
| A | `IntroTema` que sustituye la maqueta en las 32 clases sin video | Create `intro-tema.tsx` | Componente nuevo |
| B | Mini-temario siempre visible en el panel lateral de cada clase | Modify `page.tsx` clase | Layout |
| C | Franja «El diagnóstico te recomendó esta clase» cuando aplica | Modify `page.tsx` clase | Datos del servidor |
| D | El video auto-marca la clase al terminar las escenas | Modify `video-animado.tsx` + `page.tsx` | Callback |
| E | Tras el video, un enlace «Ver los N casos tipo examen» lleva a la pestaña | Modify `video-animado.tsx` | Enlace |
| F | CTA «Practicar este tema» al final de CADA clase (no solo sección) | Modify `page.tsx` clase | Enlace |
| G | «Estás aquí» en el temario de la portada del curso | Modify `temario-curso.tsx` + `page.tsx` curso | Resaltado |
| H | Botón de completar como toggle prominente (no un botón gris pequeño) | Modify `boton-completar.tsx` | Estilo |
| I | Botón «Volver al curso» en la ficha de cifras y el glosario | Modify `ficha/page.tsx` + `glosario/page.tsx` | Enlace |
| J | El panel lateral empieza con el temario compacto, no al final | Reordenar `page.tsx` clase | Orden |

## Decisión sobre (A): IntroTema en vez de 32 videos

Escribir 32 guiones de video completo (con narración, fichas, sonidos y quiz) es un proyecto de días, no de una sesión. La mejora honesta y escalable: un **IntroTema** que lee el contenido existente de cada clase (sus preguntas clave del resumen y su peso en el examen) y muestra una tarjeta de introducción bien diseñada con:

- Módulo, título y duración estimada
- Las 2–3 preguntas que la clase responde (de `contenido.resumen[].pregunta`)
- El peso en el examen (de `temasDeClase`)
- Botón «Estudiar el resumen» que lleva a las pestañas
- Fondo animado sutil (mismos focos del video)

El componente es **genérico** (funciona con cualquier clase que tenga `contenido.resumen`), puro (lee solo props) y no necesita guiones a mano.
