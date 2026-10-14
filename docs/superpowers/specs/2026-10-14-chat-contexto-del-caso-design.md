# Contexto del caso en el chat de ACE

Estado: aprobado por el usuario; implementado.

## Objetivo
Recoger régimen, fechas relevantes y hechos del caso, y aplicar en el servidor la instrucción: «Responde solo con las fuentes disponibles, cita documento y página, e indica qué información falta».

## Alternativas
1. Contexto estructurado opcional y regla permanente en el servidor (recomendada): ayuda a formular la consulta sin bloquear preguntas generales.
2. Solo una plantilla en el cuadro de texto: menor cambio, pero el usuario puede omitirla y no queda una regla consistente.
3. Exigir todos los datos antes de enviar: mejora la completitud inicial, pero bloquea consultas generales y casos cuyo régimen se desconoce.

## Diseño recomendado
Añadir junto al cuadro de consulta una sección «Contexto del caso» con régimen (texto, admite «No determinado»), fechas relevantes (texto para describir varios hitos) y hechos (texto multilínea). Todos son opcionales y tienen límites de longitud validados por el servidor. No se deduce automáticamente el régimen ni la vigencia de una norma a partir de una fecha.

El cliente envía el contexto por separado de la pregunta. El servidor lo incorpora como datos del usuario a la recuperación y a la generación, sin tratarlo como instrucciones de mayor prioridad. El contexto se conserva con el intercambio mediante el historial existente y se restituye al abrir la conversación; no se comparte entre conversaciones. Al iniciar una nueva conversación, se limpia.

La instrucción sobre fuentes se aplica siempre, aunque el cliente no mande contexto. Las conclusiones materiales deben sustentarse en las fuentes recuperadas y sus referencias; si una fuente no tiene página, se indica esa limitación sin inventarla. La respuesta identifica datos del caso y fuentes que faltan, así como incertidumbres sobre régimen y vigencia. Sin evidencia suficiente, evita una conclusión jurídica categórica. La instrucción se aplica tanto al flujo de respuesta en directo como al flujo no interactivo.

## Alcance y comprobación
Mantener filtros, permisos, historial privado y citas existentes. No cambiar el corpus ni codificar reglas jurídicas nuevas. Verificar validación del contexto, compatibilidad con solicitudes antiguas, propagación a búsqueda y generación, tratamiento de datos ausentes, aislamiento entre conversaciones y ambas formas de respuesta. Revisar visualmente el formulario y publicar únicamente los cambios de esta mejora.
