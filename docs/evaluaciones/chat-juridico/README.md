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

### Completitud (grupo `completitud`)

El resto del banco comprueba que la respuesta tenga lo correcto; este grupo comprueba que **no le falte nada**. La verificación del chat quita las afirmaciones que no puede respaldar y, a veces, deja una sola frase: una respuesta correcta pero a medias que pasa las demás comprobaciones (medido en producción el 2026-11-11 con una pregunta sobre resolución del contrato y penalidad máxima).

Cada caso es una pregunta con varias partes y un campo `partes`, una lista de `{ nombre, contieneAlguno }`. Una parte se da por contestada si la respuesta contiene alguno de sus términos; el caso falla por cada parte que falte, y el informe cuenta las partes contestadas (`partes contestadas 16/16`).

Cómo escribir una parte:

- **Los términos deben distinguirla.** Que «10%» aparezca en la respuesta no prueba que se contestó el tope de penalidades: el 10% también es el plazo de requerimiento del art. 122. Usa la frase de la norma («del monto vigente», «exceder el 10%»).
- **Todo término sale del corpus**, no de memoria: busca la frase en `document_chunks` (Reglamento de la Ley 32069) antes de fijarla. Cada parte cita el artículo en su `nombre`.
- Una pregunta de una sola parte no es de completitud (lo comprueba `tests/banco-oro-formato.test.ts`).
- **La parte tiene que estar a la vista**, no solo en el texto completo: la interfaz pliega todo salvo el primer bloque bajo «Ver fundamento y fuentes», y una segunda respuesta escondida ahí es, para quien pregunta, una respuesta a medias (medido en producción el 2026-11-11). El script lo comprueba con `chatAnswerSections(...).main` y marca «está, pero plegada». En una pregunta de varias partes (`isMultiPartQuestion`) lo verificado se publica a la vista.

Un caso que documenta un defecto conocido se marca `intermitente: true` y lleva una `nota` con la causa y lo que lo dejaría verde; sale como AVISO y no bloquea. Hoy hay dos: `comparar-plazos` y `completitud-resolucion-y-penalidad-redaccion-de-produccion` (el D.S. 071-2018-PCM, régimen especial de Reconstrucción con Cambios, encabeza la respuesta). Al corregir la causa, se quita `intermitente`.

## Comprobación en GitHub

- `tests/banco-oro-formato.test.ts` corre en el CI normal (sin red): ids únicos, ninguna expectativa vacía, ningún caso sin expectativas, partes bien formadas, notas en los intermitentes.
- `.github/workflows/chat-oro.yml` corre el banco entero contra los servicios reales: en un PR hacia `main` que toque algo que afecta a las respuestas, cada lunes y a mano (con un grupo opcional). Tarda unos 15 minutos y consume modelo, por eso no está en cada push. Sube el informe como artefacto y un resumen con los casos que fallan.
- Secretos del repositorio: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PINECONE_API_KEY` y `GOOGLE_API_KEY` (opcional `COHERE_API_KEY`). Sin ellos el trabajo se omite con un aviso en un PR y falla en el calendario y a mano.
- Para que bloquee la fusión de un PR, añade «Banco de oro» como comprobación obligatoria en la protección de la rama `main`. El trabajo no corre en todos los PR; si lo marcas obligatorio, GitHub lo esperará también en los que no lo lanzan: úsalo solo si quitas el filtro `paths`.

## Revisión por especialista

Usar `revision-especialista.json` como registro versionado. Los casos iniciales están pendientes, sin respuestas de referencia inventadas. El especialista debe registrar identidad profesional, fecha, documentos originales y versión, régimen y hechos, respuesta esperada y condiciones/excepciones relevantes. Los documentos deben permitir comprobar identidad, vigencia y aplicación temporal, no solo el número de página.

Por cada respuesta real, evaluar separadamente: exactitud de la regla; régimen y vigencia; respaldo de cada afirmación; correspondencia documento/artículo/numeral/página; excepciones pertinentes; reconocimiento de datos faltantes. Registrar aprobado/rechazado por criterio, explicación y evidencia. Para casos sin información suficiente, la respuesta esperada debe reconocer el límite.

No publicar porcentajes de precisión hasta disponer de respuestas de referencia revisadas, muestra identificada, versión de corpus/modelo/prompt y metodología. Mantener los casos con datos sintéticos o anonimizados. No exportar conversaciones privadas ni adjuntos del caso a este repositorio.

## Alcance del control en producción

La segunda llamada evalúa cada línea sustantiva frente a sus fragmentos citados. Se comprueba que los pasajes devueltos existan y que la revisión cubra todas las afirmaciones. Está limitada a 24 afirmaciones y 25 segundos, sin reintentos. Una respuesta no comprobada se sustituye por pasajes literales y límites. La evaluación usa el proveedor y modelo configurados, por lo que comparte posibles sesgos del generador; no equivale a un dictamen independiente. La aplicabilidad al caso siempre permanece pendiente de confirmación humana.
