# LEX IA: funcionamiento observado y adaptación mejorada a ACE

Fecha: 22 de octubre de 2026. Alcance: análisis funcional autenticado de LEX y contraste con el código y funciones existentes de Centro Jurídico. No se modificó la aplicación ACE en esta investigación.

## Resultado principal

LEX plantea bien la elección inicial: preguntar para obtener una explicación o buscar para localizar documentos. La adaptación útil a ACE consiste en conservar esa claridad y mejorar la trazabilidad: localizar el original solicitado, distinguirlo de documentos que lo citan, comprobar páginas desde el PDF y separar resultados, fallos y cobertura incompleta. No es necesario reconstruir Centro Jurídico ni duplicar capacidades ya disponibles.

No se conoce el modelo, el proveedor, la base de datos ni la arquitectura interna de LEX a partir de esta inspección. Tampoco hay una comparación de precisión jurídica entre plataformas. Las respuestas con fuentes son compatibles con recuperación documental, pero eso no demuestra una implementación técnica concreta.

## Cómo funciona LEX desde la perspectiva del usuario

### 1. Entrada y elección de tarea

`/app/ai` muestra dos opciones: Chat IA para resolver dudas y Buscador con IA para encontrar documentos. Añade una explicación breve de cuándo elegir cada una y acceso al historial. La interfaz no exige conocer términos como embeddings o búsqueda vectorial.

Ambas opciones llevan al mismo espacio de trabajo de chat, con un selector de modo. El historial lateral cambia entre conversaciones y búsquedas. La entrada directa admite `view=chat` y `view=search`. En la sesión inspeccionada, cambiar el modo visual no actualizó inmediatamente el parámetro de URL: no debe suponerse que el modo visible siempre se puede reconstruir solo desde esa URL.

### 2. Filtros

El panel permite elegir una ley o ámbito, marcar categorías y seleccionar años por categoría. Tiene acciones para marcar todo, desmarcar y cerrar, además de un resumen visible de filtros aplicados.

En el selector inspeccionado aparecieron Ley 32069, norma especial, Ley 30225, OECE y DGA-MEF. Esta organización mezcla régimen y entidad emisora en un mismo selector. Para ACE conviene separarlos: régimen, entidad, tipo de documento, año de publicación y estado de revisión tienen significados diferentes.

Para Ley 32069, el panel revisado mostró ocho categorías: resoluciones, opiniones, pronunciamientos, informes de vicios de nulidad, ley, reglamento y dos grupos de bases. No apareció una categoría de Acuerdos de Sala Plena en ese panel. Esto no demuestra que LEX carezca de esos documentos en su biblioteca ni permite conocer cómo su servidor interpreta «todas las categorías».

### 3. Chat IA

El usuario escribe una pregunta o selecciona un ejemplo. Se ofrece adjuntar hasta cuatro imágenes. No se probó una subida de archivos ni puede deducirse compatibilidad con PDF desde ese botón.

Durante el envío se muestra la pregunta inmediatamente, un estado de análisis y el botón deshabilitado. Al terminar aparece una respuesta con encabezados, listas o tablas, documentos enlazados y sugerencias para continuar. También hay acciones de utilidad, copia y un aviso de verificación de fuentes oficiales.

La respuesta de prueba se guardó como una conversación con URL propia. El título automático del historial falló: en lugar de un título útil quedó un mensaje de imposibilidad de generar título, pese a que el cuerpo de la respuesta sí se había generado. La interfaz exigió calificar la respuesta anterior antes de continuar la conversación.

### 4. Buscador con IA

Tiene una consulta específica para documentos, ejemplos temáticos, filtros compartidos y una salida con síntesis normativa y tarjetas de pasajes. Cada tarjeta incluye un título, un fragmento y un enlace al documento. La síntesis puede facilitar la orientación, pero no debería confundirse con el resultado documental ni sustituir la comprobación del original.

La búsqueda realizada en esta revisión mostró simultáneamente un aviso de inconveniente y siete tarjetas con una síntesis. La pantalla no explicó si esas tarjetas eran resultados parciales, de respaldo o de otra condición. No se determinó la causa técnica. En ese intento no apareció como resultado principal el acuerdo exacto solicitado. El historial de búsquedas siguió vacío.

### 5. Documento y trabajo posterior

Los enlaces llevan al visor documental de LEX. En el documento abierto se observaron descarga de PDF, una descarga adicional denominada LEX y acceso para guardar en carpeta. El visor permitió leer el contenido del original. No se ejecutaron guardados ni descargas adicionales y no se probó el contenido del formato de descarga LEX.

### 6. Uso y límites

La interfaz muestra disponibilidad mensual y por conversación, y explica la renovación del cupo. No mostró en esta revisión el modelo de IA ni un precio por consulta. El porcentaje de cupo es uso del servicio, no precisión de la respuesta. No debe deducirse el coste unitario a partir de estos dos intentos.

## Pruebas realizadas y evidencia

Se enviaron solo dos consultas sobre una referencia pública, sin datos de un caso privado.

| Prueba | Objetivo | Observación |
| --- | --- | --- |
| Chat sobre el Acuerdo de Sala Plena 003-2025/TCP | Examinar respuesta, fuentes, páginas y reconocimiento de límites | Respuesta estructurada con 18 enlaces únicos a documentos. Utilizó como fuente principal una resolución que cita el acuerdo y reconoció no tener el original íntegro. |
| Abrir la primera fuente del chat | Comprobar identidad y paginación del documento enlazado | El chat mencionó un total de 15 páginas; el visor del PDF enlazado mostró un total de 29. Se comprobó la diferencia de total de páginas, no la exactitud jurídica de las reglas de la respuesta. |
| Búsqueda de la misma referencia | Examinar localización del documento solicitado | Aparecieron un aviso de error, síntesis y siete tarjetas. El original solicitado no apareció como resultado principal en ese intento. No se asigna una tasa de error a LEX con una sola búsqueda. |
| Continuidad e historial | Examinar recuperación de trabajo y seguimiento | La conversación se guardó; el título automático fue inadecuado y apareció una exigencia de calificación previa al siguiente turno. No se emitió una valoración jurídica de la respuesta. |

Estas observaciones son una muestra funcional, no un examen jurídico ni una medición estadística de calidad. No se afirma que las reglas sustantivas generadas por LEX sean correctas o incorrectas.

Capturas locales:

- [Respuesta de prueba](C:/Users/USER/Documents/ace/.next/piloto-oficial/lex-ai-respuesta-prueba.png)
- [Buscador y aviso de error](C:/Users/USER/Documents/ace/.next/piloto-oficial/lex-ai-buscador-prueba.png)
- [Filtros](C:/Users/USER/Documents/ace/.next/piloto-oficial/lex-ai-filtros.png)
- [Registro resumido de observaciones](C:/Users/USER/Documents/ace/.next/piloto-oficial/lex-ai-estudio-evidencias.json)

## Qué ya tiene ACE y debe reutilizarse

| Capacidad | Estado en ACE | Adaptación necesaria |
| --- | --- | --- |
| Tres tareas claras | Chat jurídico, Búsqueda documental y Normativa y criterios ya agrupados | Mantener las tres; añadir orientación contextual en estados iniciales, sin otro menú duplicado. |
| Contexto del caso | Régimen declarado, fechas y hechos opcionales | Usarlo también para decidir qué falta y orientar recuperación; el régimen declarado no es una fuente jurídica verificada. |
| Recuperación y fuentes | Búsqueda híbrida, reranking, filtros y agrupación por documento | Anteponer identificación exacta de documento y añadir filtros reales de régimen cuando los metadatos estén revisados. |
| Citas y ubicación | Marcadores, lista de documentos/páginas y aviso de fidelidad | Añadir validación de página contra PDF y comprobar sustento de cada afirmación; una ubicación existente no prueba aplicabilidad jurídica. |
| Visor de citas | Existe `PdfCiteButton`, con página y resaltado | Reutilizarlo para una comprobación directa, sin construir otro visor desde cero. |
| Historial | Conversaciones privadas y restauración del contexto | Incorporar búsquedas reanudables, filtros guardados y títulos deterministas de respaldo. |
| Exportación y organización | Copia con fuentes, Word, guardados y biblioteca | Unificar acciones y añadir estado de revisión del documento/cita. |
| Modelo | Respuestas recientes y configuración inspeccionada: Gemini 2.5 Flash | Mantenerlo como línea base. No atribuir a LEX un modelo desconocido ni cambiar el de ACE sin comparar resultados. |

El análisis del código actual de ACE muestra dos limitaciones relevantes: el esquema de búsqueda no incluye un filtro real de régimen y el historial se incorpora a la generación, mientras la recuperación de seguimientos se basa principalmente en la nueva pregunta y contexto declarado. Por tanto, añadir solo un selector de régimen o un historial visible no completa la mejora.

## Cómo adaptar a ACE con una mejora verificable

### Prioridad 1: original exacto, citas y fallos claros

1. Detectar referencias documentales expresas: tipo, número, año y entidad. Normalizar formas de escritura sin confundir tipos documentales distintos. Buscar primero en el catálogo de documentos; usar la búsqueda semántica para ampliar, no para sustituir silenciosamente el original.
2. Separar tres clases de resultados: **documento solicitado**, **documentos que lo citan** y **material relacionado**. Si el original no se localiza, indicarlo y ofrecer la evidencia indirecta con ese alcance.
3. Hacer que la referencia cite un identificador válido, fragmento y páginas existentes del PDF almacenado. Mantener el vínculo a la versión/hash del documento. No dejar que el modelo genere el total de páginas.
4. Mostrar sustento al lado de cada afirmación. Diferenciar cita textual comprobada, interpretación, información faltante y aplicabilidad pendiente. Una comprobación automática de ubicación no debe llamarse validación jurídica.
5. Distinguir carga, consulta completada, consulta sin coincidencias, resultados parciales y fallo. No mostrar una síntesis concluyente como si todo hubiera funcionado tras un fallo de recuperación.
6. Reformular internamente preguntas de seguimiento con contexto autorizado de esa conversación. Por ejemplo, resolver a qué documento se refiere «ese criterio» antes de recuperar fuentes. No trasladar hechos privados a la URL.

### Prioridad 2: filtros coherentes y continuidad

1. Separar régimen, entidad, tipo de evidencia, año de publicación y vigencia registrada. Permitir varios tipos y años con una semántica clara. No deducir vigencia o régimen solo del año de publicación.
2. Preparar metadatos revisados de régimen y versión antes de activar filtros que prometan esa precisión. Los documentos sin revisar deben identificarse como tales y su inclusión debe ser explícita.
3. Utilizar un historial plegable de Chat y Búsquedas, en vez de ocupar permanentemente otra columna junto al menú principal. Restaurar consulta, filtros y documento; distinguir la fecha de ejecución de la publicación de la fuente.
4. Hacer opcional la valoración. Guardar su significado: útil, cita incorrecta, falta el original, régimen incorrecto o respuesta incompleta. No bloquear un seguimiento para obtener una valoración.
5. Generar títulos con un respaldo determinista tomado de la consulta o referencia; nunca mostrar como título un rechazo o error del generador.

### Prioridad 3: documentos del caso y observabilidad

1. Permitir adjuntos privados dentro del caso, empezando por formatos y tamaños bien definidos. Mantenerlos fuera del corpus normativo compartido, con propietario y permisos de acceso, estado de lectura y advertencia si el OCR es parcial.
2. Distinguir documento oficial, documento del caso y comentario del usuario. Permitir contrastarlos, sin tratarlos como evidencias de igual naturaleza.
3. Registrar proveedor/modelo efectivos, versión de instrucciones, recuperación realizada, avisos, tiempos y coste disponible. Mostrar al usuario un estado sencillo de servicio y al administrador los detalles; nunca exponer claves.
4. Evaluar modelos alternativos solo después de corregir recuperación y trazabilidad. Un modelo más potente no puede respaldar una afirmación con un documento no recuperado.

## Arquitectura recomendada

Una sesión de trabajo común contiene el caso y los filtros. Dos acciones separadas resuelven intenciones: responder o buscar; Normativa y criterios sigue como lectura y comprobación del documento.

Flujo de consulta: identificar intención y referencias → resolver contexto del seguimiento → aplicar filtros compatibles con metadatos revisados → localizar original y recuperar evidencia relacionada → ordenar fuentes → comprobar ubicaciones → redactar con citas → presentar faltantes y límites → guardar la sesión privada.

La respuesta debe devolver datos estructurados de citas con identificadores pertenecientes al conjunto recuperado. La interfaz construye los enlaces y ubicaciones a partir de esos datos, no de enlaces inventados en texto libre. La revisión semántica de sustento y la revisión jurídica deben declararse por separado.

## Cómo demostrar que ACE mejora

Crear un conjunto de referencia de tareas comparables con fuentes oficiales y casos de información insuficiente. Medir por separado:

- Recuperación del documento exacto solicitado y detección de originales ausentes.
- Identidad, versión, existencia de páginas y localización real de las citas.
- Sustento de afirmaciones, con revisión experta de una muestra y respuestas de referencia.
- Separación de regímenes y reconocimiento de fechas/hechos faltantes.
- Continuidad entre preguntas y restauración de filtros.
- Claridad ante fallos y cobertura parcial.
- Tiempo de completar una tarea, latencia y coste observado.

No mezclar porcentajes de coincidencia de palabras, confianza del recuperador, disponibilidad de créditos y exactitud jurídica. Esta investigación no ofrece un porcentaje de superioridad de ACE.

## Recomendación de primera implementación

La siguiente entrega debería ser **Original exacto y respuesta comprobable**: búsqueda prioritaria por referencia, diferenciación de fuentes indirectas, comprobación de citas/páginas y mejor recuperación de seguimientos. Reutiliza Centro Jurídico y ataca los problemas observados sin comenzar por un cambio de modelo o una copia de la apariencia de LEX.

Las siguientes entregas serían filtros por régimen con metadatos revisados e historial de búsquedas, y después adjuntos privados y evaluación de modelos. Cada entrega requiere su propio diseño y validación antes de implementarse.

Referencias de las pantallas inspeccionadas: [IA de LEX](https://lexcontrataciones.com/app/ai), [Chat de LEX](https://lexcontrataciones.com/app/chat?view=chat), [Buscador de LEX](https://lexcontrataciones.com/app/chat?view=search), [documento fuente abierto](https://lexcontrataciones.com/app/documento/32548).
