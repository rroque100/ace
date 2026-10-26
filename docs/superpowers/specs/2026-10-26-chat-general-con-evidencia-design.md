# Chat jurídico general con evidencia · diseño

## Objetivo solicitado
Atender distintas formas de consulta con IA y la información disponible en ACE. Evitar una solución centrada en una pregunta de examen. No prometer respuesta jurídica correcta a cualquier tema ni completar documentos ausentes de memoria.

## Diagnóstico comprobado
La generación general ya existe. La verificación recibe desde la última corrección la pregunta original y puede seleccionar pasajes literales numerados. Las preguntas con alternativas tienen recuperación específica y una elección estructurada. Sin embargo, la publicación de respuestas generales reconstruye afirmaciones en un formato fijo; puede perder la estructura de listas, tablas y explicaciones. La revisión tiene un límite de 24 afirmaciones, que debe gestionarse expresamente en preguntas extensas.

## Enfoques considerados
1. Modificar solamente las instrucciones: rápido, pero no resuelve publicación, cobertura ni pruebas por tareas.
2. Flujo común de planificación, recuperación y publicación verificada: recomendado. Reutiliza el motor existente y adapta la respuesta sin codificar reglas legales.
3. Agente autónomo con herramientas amplias: mayor alcance y coste; no necesario para consolidar primero las respuestas del corpus.

## Diseño recomendado
Una única conversación, sin exigir al usuario elegir modos técnicos. La IA interpreta la consulta y puede combinar tareas: explicación general, requisitos, plazos/cifras, procedimiento, comparación, análisis de caso, resumen o alternativas. La clasificación organiza la recuperación y el formato; no determina por sí misma el contenido jurídico.

La recuperación usa el enunciado y subpreguntas limitadas. Mantiene documento, versión, artículo, filtros, fuentes iniciales y autorización de ampliación. No debe mezclar regímenes ni convertir un documento del caso en fuente normativa. Cuando una comparación completa de versiones requiere el servicio específico, el Chat debe indicar el alcance y enlazarlo, sin presentar una selección temática como comparación exhaustiva.

La respuesta estructurada conserva secciones, listas o tablas cuando aportan claridad. Cada afirmación jurídica tiene identificadores de fuentes y pasajes existentes. Una revisión independiente contrasta pregunta, sujeto, condiciones, excepciones, cifras, referencias y versión. Solo se publica contenido comprobado; la estructura no debe permitir que un encabezado o una tabla reintroduzcan conclusiones descartadas.

En preguntas generales no se exigirán hechos de un caso inexistente. En un caso concreto se pedirán únicamente los datos determinantes que falten. Se distinguirán ausencia de documentos, recuperación parcial, generación fallida y revisión incompleta. Las preguntas amplias se responden por partes o declaran cobertura parcial; no se simula haber comprobado más afirmaciones que las revisadas.

## Validación y aceptación
- Pruebas de preguntas abiertas, requisitos, cantidades, negaciones, comparación, resumen, caso y seguimiento.
- Casos sin evidencia, referencias incorrectas, documentos seleccionados, fallos y streaming.
- Pruebas de que una tabla, encabezado o conclusión no publiquen contenido rechazado.
- Consultas reales con el corpus, con respuesta esperada y citas revisadas; separar estas observaciones de las pruebas de programación.
- Tipos, lint, compilación y comprobación en producción.

## Alcance y límites
No ampliar automáticamente la biblioteca, cambiar proveedores o publicar reglas legales fijas. La planificación y la revisión pueden aumentar tiempo y consumo; se limitarán consultas, pasajes y afirmaciones, mostrando cualquier recorte. No presentar una medición inicial como precisión jurídica universal. La evaluación por especialistas seguirá siendo necesaria.
