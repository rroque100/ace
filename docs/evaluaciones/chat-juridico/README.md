# Evaluación del chat jurídico

Esta carpeta separa pruebas de software, evaluación automática de respaldo y revisión jurídica humana. Ninguna sustituye a las otras.

## Ejecutar controles sintéticos

Desde el proyecto, con las variables del proveedor configuradas:

```powershell
npx tsx --env-file=.env.local scripts/evaluate-chat-evidence.ts docs/evaluaciones/chat-juridico/resultado-sintetico.json
```

La ejecución consume llamadas del proveedor configurado. No usa conversaciones reales, no escribe en Supabase y no incorpora documentos a Pinecone. Sus reglas ficticias sirven para comprobar cifra con concepto equivocado, negación, objeto, versión, falta de cita y ausencia de fuentes. Un resultado satisfactorio no demuestra precisión jurídica del chat ni calidad de recuperación del corpus.

## Revisión por especialista

Usar `revision-especialista.json` como registro versionado. Los casos iniciales están pendientes, sin respuestas de referencia inventadas. El especialista debe registrar identidad profesional, fecha, documentos originales y versión, régimen y hechos, respuesta esperada y condiciones/excepciones relevantes. Los documentos deben permitir comprobar identidad, vigencia y aplicación temporal, no solo el número de página.

Por cada respuesta real, evaluar separadamente: exactitud de la regla; régimen y vigencia; respaldo de cada afirmación; correspondencia documento/artículo/numeral/página; excepciones pertinentes; reconocimiento de datos faltantes. Registrar aprobado/rechazado por criterio, explicación y evidencia. Para casos sin información suficiente, la respuesta esperada debe reconocer el límite.

No publicar porcentajes de precisión hasta disponer de respuestas de referencia revisadas, muestra identificada, versión de corpus/modelo/prompt y metodología. Mantener los casos con datos sintéticos o anonimizados. No exportar conversaciones privadas ni adjuntos del caso a este repositorio.

## Alcance del control en producción

La segunda llamada evalúa cada línea sustantiva frente a sus fragmentos citados. Se comprueba que los pasajes devueltos existan y que la revisión cubra todas las afirmaciones. Está limitada a 24 afirmaciones y 25 segundos, sin reintentos. Una respuesta no comprobada se sustituye por pasajes literales y límites. La evaluación usa el proveedor y modelo configurados, por lo que comparte posibles sesgos del generador; no equivale a un dictamen independiente. La aplicabilidad al caso siempre permanece pendiente de confirmación humana.
