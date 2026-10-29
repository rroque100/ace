# Evaluación del chat jurídico

Esta carpeta separa pruebas de software, evaluación automática de respaldo y revisión jurídica humana. Ninguna sustituye a las otras.

## Ejecutar controles sintéticos

Desde el proyecto, con las variables del proveedor configuradas:

```powershell
npx tsx --env-file=.env.local scripts/evaluate-chat-evidence.ts docs/evaluaciones/chat-juridico/resultado-sintetico.json
```

La ejecución consume llamadas del proveedor configurado. No usa conversaciones reales, no escribe en Supabase y no incorpora documentos a Pinecone. Sus reglas ficticias sirven para comprobar cifra con concepto equivocado, negación, objeto, versión, falta de cita y ausencia de fuentes. Un resultado satisfactorio no demuestra precisión jurídica del chat ni calidad de recuperación del corpus.

## Banco de regresión de conducta (preguntas de oro)

`preguntas-oro.json` fija, para cada caso, lo que la respuesta del chat DEBE cumplir: qué ley rige según la fecha de convocatoria, qué fuentes entran, cuándo se pide contexto, qué se hace ante un artículo o una norma que no se recupera, cómo se resuelve un seguimiento («¿y si fue en 2024?»). Comprueba conducta, no texto exacto, porque el modelo varía.

```powershell
npx tsx --env-file=.env.local scripts/evaluar-chat-oro.mts [--solo id1,id2] [--grupo nombre] [--salida informe.json]
```

Corre el pipeline REAL (recuperación, modelo y verificación de citas) sin escribir en la base de datos ni guardar conversaciones, y sale con código 1 si algún caso falla. Úsalo antes de dar por bueno un cambio en `lib/legal-chat.ts`, en la recuperación o en los prompts. Un caso que falla de forma intermitente es una señal, no ruido. Los informes fechados (`oro-AAAA-MM-DD.json`) son la línea base de cada día.

Qué NO es: no mide precisión jurídica ni sustituye la revisión por especialista de abajo. Una expectativa solo debe afirmar lo que el corpus confirma; para comprobar un valor normativo concreto (un artículo, un plazo, un porcentaje) hay que verificarlo contra el texto del documento antes de ponerlo como expectativa.

Casos con `historial` prueban seguimientos: reciben los turnos previos a mano y solo funcionan con `persist: false` (el chat real siempre lee el historial de la sesión del usuario).

## Revisión por especialista

Usar `revision-especialista.json` como registro versionado. Los casos iniciales están pendientes, sin respuestas de referencia inventadas. El especialista debe registrar identidad profesional, fecha, documentos originales y versión, régimen y hechos, respuesta esperada y condiciones/excepciones relevantes. Los documentos deben permitir comprobar identidad, vigencia y aplicación temporal, no solo el número de página.

Por cada respuesta real, evaluar separadamente: exactitud de la regla; régimen y vigencia; respaldo de cada afirmación; correspondencia documento/artículo/numeral/página; excepciones pertinentes; reconocimiento de datos faltantes. Registrar aprobado/rechazado por criterio, explicación y evidencia. Para casos sin información suficiente, la respuesta esperada debe reconocer el límite.

No publicar porcentajes de precisión hasta disponer de respuestas de referencia revisadas, muestra identificada, versión de corpus/modelo/prompt y metodología. Mantener los casos con datos sintéticos o anonimizados. No exportar conversaciones privadas ni adjuntos del caso a este repositorio.

## Alcance del control en producción

La segunda llamada evalúa cada línea sustantiva frente a sus fragmentos citados. Se comprueba que los pasajes devueltos existan y que la revisión cubra todas las afirmaciones. Está limitada a 24 afirmaciones y 25 segundos, sin reintentos. Una respuesta no comprobada se sustituye por pasajes literales y límites. La evaluación usa el proveedor y modelo configurados, por lo que comparte posibles sesgos del generador; no equivale a un dictamen independiente. La aplicabilidad al caso siempre permanece pendiente de confirmación humana.
