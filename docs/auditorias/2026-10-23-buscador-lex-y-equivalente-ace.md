# Evaluación funcional: búsqueda de LEX frente a ACE

Fecha: 23 de octubre de 2026. Alcance: uso real de ambas interfaces con sesión autorizada y lectura de la implementación de ACE. No se modificó la aplicación ni se importaron documentos de LEX.

## Conclusión

El equivalente de https://lexcontrataciones.com/app/buscar ya existe en ACE: Centro Jurídico → Búsqueda documental, https://ace-rormi.vercel.app/busqueda. Su orientación actual es recuperar fragmentos relevantes para consulta y chat; no constituye todavía un buscador de catálogo exhaustivo equivalente al recorrido observado en LEX.

## Prueba reproducida

Consulta: «perfeccionamiento del contrato». Categoría: opiniones.

- LEX mostró 266 resultados documentales y paginación de 27 páginas, diez fichas en la primera. La ficha inicial fue la Opinión D000110-2026-OECE-DTN.
- ACE mostró diez fragmentos de un documento: la misma opinión D000110-2026-OECE-DTN, con acceso al PDF por página y acciones de chat, Normativa, validación, comparación y guardado.
- Los números cuentan unidades distintas. La prueba no demuestra que ACE solo almacene una opinión ni permite medir precisión o cobertura global de ninguno de los sistemas. Deben medirse por separado documentos disponibles, documentos recuperados y fragmentos seleccionados.

## Funciones observadas en LEX

1. Entrada por palabras/frases convertidas en etiquetas; sugerencias mientras se escribe. En esta prueba fue necesario confirmar la frase con Enter: buscar antes produjo «Ingrese una palabra o frase» aunque había texto visible.
2. Selección de categorías múltiples: criterios LEX, guías/instructivos, ley, reglamento, opiniones, pronunciamientos, resoluciones TCP, acuerdos de Sala Plena, directivas, IVN y dictámenes de procedimientos competitivos.
3. Filtros dependientes: al seleccionar opiniones aparecieron años de 2011 a 2026 y objetos de contratación. Al seleccionar Bienes apareció materia; al elegir Ejecución Contractual apareció el selector de temas, con mecanismos de resolución de controversias, modificaciones al contrato, penalidades y contrato complementario. Esta es una clasificación observada de la interfaz, no una afirmación normativa.
4. Cada resultado presenta identidad del documento, resumen editorial, extractos con la frase resaltada, categoría y año; algunos tienen etiqueta «No vigente».
5. Cuenta por categoría, total de resultados y paginación. No se observó un selector explícito de ordenación en la prueba. La primera página contenía documentos de 2026, pero esto no demuestra por sí solo la regla de ordenamiento.
6. Ficha documental con fecha de publicación, resumen, visor de PDF con capa de texto y resaltado de la búsqueda, enlace Descargar PDF, enlace Descargar Lex y Guardar carpeta. Se verificó la presencia de estos accesos y la carga del visor; no se descargaron archivos ni se guardaron carpetas.
7. Los parámetros de la URL conservan consulta y filtros. La URL incluye campos para vigencia, materias, temas y subtemas; no se considera comprobado un filtro solo por existir ese parámetro. En particular no se completó una prueba de subtemas ni de todas las categorías.

No se inspeccionó el servidor de LEX. No se puede atribuir un motor, modelo de IA, algoritmo, búsqueda booleana AND/OR ni exhaustividad a partir de la interfaz.

## Comparación con ACE

| Capacidad | Situación real en ACE |
|---|---|
| Ubicación y navegación | Centro Jurídico → Búsqueda documental; integrado con Chat y Normativa |
| Consulta libre | Recuperación semántica, candidatos léxicos y reordenación; prioriza originales cuando reconoce una referencia documental |
| Tipo, entidad, año y vigencia | Disponibles; añade múltiples tipos/años y régimen revisado/desconocido |
| Artículo, procedimiento y tema | Disponibles; tema es texto libre, no una jerarquía guiada objeto → materia → tema |
| Resultados | Lista principal por fragmento; resumen superior agrupa documentos, pero no elimina repetición en las tarjetas |
| Búsqueda literal verificable | Sin modo de frase exacta independiente y exhaustivo; coincidencia léxica no garantiza frase exacta |
| Total y paginación documental | No implementados en este recorrido; el selector 5/10/15/20 limita fragmentos, no páginas del catálogo |
| Sugerencias al escribir | No equivalentes: ACE tiene ejemplos fijos, no autocompletado documental como el observado |
| PDF y trazabilidad | PDF por página, fuente, Normativa y continuidad al chat |
| Continuidad personal | Historial privado recuperable y guardado |
| Categorías editoriales propias de LEX | No equivalencia completa; criterios LEX y descarga Lex no son sinónimos de documentos oficiales |

## Hallazgos prioritarios

- Diez resultados pueden pertenecer a un único documento. Hace falta diversidad entre documentos sin perder la posibilidad de explorar todos los fragmentos de cada uno.
- El límite de recuperación de ACE opera sobre candidatos y fragmentos: no permite anunciar «todos los documentos que contienen esta frase». La búsqueda literal de catálogo debe ser un recorrido distinto, con conteo y paginación propios.
- La consulta queda rodeada de métricas técnicas y múltiples botones por fragmento. Para personas no técnicas debe verse primero el documento, por qué coincide, su fecha y el acceso al original.
- Se mostraron simultáneamente texto de estado «vigente» y la etiqueta «Vigencia sin confirmar». Conviene unificar la explicación y distinguir siempre estado registrado de vigencia jurídicamente verificada.
- La clasificación temática precisa metadatos mantenidos; copiar solo los controles sin clasificar el corpus no mejora los resultados.
- No se deben interpretar relevancia alta o coincidencia 100 % como exactitud jurídica.

## Recomendación para una siguiente implementación

1. Mejorar Búsqueda documental existente, sin crear otro menú: modos «Por palabras o frase» y «Por significado», resultados agrupados por documento, coincidencias resaltadas, filtros opcionales y acciones principales Abrir documento / Consultar con IA.
2. Añadir índice de texto para catálogo con frase exacta, conteo de documentos distintos, paginación y orden explícito (relevancia o fecha), manteniendo la búsqueda semántica para preguntas y sin cambiar embeddings por una mejora visual.
3. Clasificar y revisar el corpus con objeto, materia, tema y, cuando corresponda, subtema; ampliar fuentes oficiales con control de duplicados, fecha, estado y procedencia. Mantener contenidos editoriales de terceros separados de los documentos oficiales.
4. Evaluar con consultas de referencia y documentos esperados: recuperación de documentos relevantes, diversidad, frase exacta, filtros, latencia y enlaces a páginas; no declarar porcentajes de precisión sin esta evaluación.

Esta entrega es una evaluación previa, no una nueva implementación ni una declaración de paridad con LEX.
