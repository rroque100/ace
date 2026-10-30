# Evaluación de Contratos, IA y comparación con LEX

Estado: auditoría realizada; propuesta de primera entrega pendiente de aprobación. No se ha modificado el comportamiento del módulo en esta etapa.

## Conclusión
ACE ya ofrece preparación de contratos SIE y Comparación de Precios, extracción de datos desde PDF, almacenamiento de contratos, vistas previas y exportación. La mejora prioritaria es la fiabilidad del trabajo: lectura del PDF, conservación del borrador, revisión explícita de lo extraído y una interfaz que lleve al siguiente dato pendiente. Cambiar de modelo por sí solo no resuelve estos problemas.

La inspección comprende código local, pantallas publicadas de ACE y acceso autenticado a LEX. No se cargaron documentos privados de usuarios a proveedores adicionales. El diagnóstico del adaptador se ejecutó con un cliente simulado: cero solicitudes de red y sin claves reales.

## IA efectiva

| Componente | Resultado de la inspección | Alcance de la evidencia |
| --- | --- | --- |
| Respuestas recientes de producción | `gemini-2.5-flash` | Modelo registrado y visible en el historial de ACE |
| Respuestas antiguas | `gpt-4.1-mini` | También existen en el historial; no son evidencia del proveedor actual |
| Extracción de contratos | Usa `legalAnswerModel` del cliente compartido | Con la configuración inspeccionada resuelve a Gemini 2.5 Flash |
| Proveedor del cliente | Presencia de clave Google/Gemini tiene prioridad sobre Z.ai y OpenAI | La biblioteca OpenAI no implica que se esté llamando a un modelo OpenAI |
| Embeddings locales | Google, modelo predeterminado `gemini-embedding-001`, 1536 dimensiones | Comprobación limitada a ajustes no secretos; se conservan los espacios vectoriales existentes |
| Razonamiento de Gemini | El adaptador fija `reasoning_effort: none` | Confirmado en solicitud simulada, no es una medida de calidad |

Google documenta que Gemini 2.5 Flash admite salidas estructuradas y razonamiento. La compatibilidad con OpenAI permite desactivar el razonamiento en los modelos 2.5 mediante `none`. No se recomienda cambiar ese ajuste globalmente sin medir latencia, costes y salidas truncadas. Fuentes: [modelo Gemini 2.5 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash) y [compatibilidad OpenAI](https://ai.google.dev/gemini-api/docs/openai/).

## Hallazgos priorizados

| Prioridad | Hallazgo | Evidencia y consecuencia | Mejora propuesta |
| --- | --- | --- | --- |
| Alta | Respaldo de PDF incompatible con el adaptador activo | `contratos-sie/extraer` envía `input_file`; `toChatMessages` solo conserva texto e imágenes. Diagnóstico: `partTypes=[text,text]`, `pdfRetained=false`. La ruta alternativa pierde el PDF antes de llegar a Gemini. No demuestra que toda extracción falle: la vía de texto puede funcionar. | Ruta PDF compatible con el proveedor; comprobar truncamiento y extracción parcial; error explícito si no se puede leer. |
| Alta | Borrador local con clave global | SIE usa `contrato-sie-borrador` y CP usa `contrato-cp-borrador`, sin usuario ni contrato. Riesgo de mezclar borradores en un navegador compartido. | Clave por usuario, tipo e identificador de contrato; no restaurar automáticamente entradas antiguas sin propietario verificable. |
| Alta | Cierre puede guardar una instantánea inicial | El efecto de desmontaje de `useAutoSave` tiene dependencias vacías y captura el primer `data/serialize`; el marcador de última instantánea sí cambia. Riesgo de sobrescribir cambios al salir. Requiere prueba de regresión antes del arreglo. | Mantener referencia al último estado, vaciar pendientes al salir y comprobar restauración/navegación. |
| Alta | Extracción reemplaza datos editados | Los formularios asignan el resultado directamente a proceso/postor, incluidos campos vacíos. | Revisar sugerencias, mostrar campos ausentes y aplicar de forma explícita sin borrar datos manuales. |
| Alta | Validación estructural débil | El analizador de JSON acepta objetos sin comprobar el contrato de cada tipo de extracción; la generación y el guardado tienen validaciones distintas. | Esquemas de salida, validación compartida y límites; borrador incompleto permitido, preparación para exportar diferenciada. |
| Media | Formularios largos y navegación con desmontaje | Cambiar pestaña incrementa la clave de montaje. El usuario depende del borrador; acciones mezclan «Guardar borrador» y «Guardar en DB». | Navegación estable, progreso con pendientes, advertencia contextual al salir y mensajes de guardado comprensibles. |
| Media | Accesibilidad desigual | Varios campos visibles del formulario no tienen nombre accesible en la inspección del navegador; textos y acciones secundarios pequeños. | Etiquetas asociadas, foco visible, controles de tamaño suficiente, estados y errores por campo. |
| Media | Bibliotecas separadas y pocas herramientas de búsqueda | Dos listados con búsquedas independientes; eliminación permanente junto a acciones frecuentes. | Biblioteca unificada con tipo/estado/búsqueda, vacíos útiles y acciones peligrosas separadas. |
| Alta | Resultado automático presentado como corrección jurídica | El evaluador pondera suficiencia, confianza, palabras esperadas y coincidencia de fuentes, y puede emitir «Respuesta correcta» sin revisión jurídica de referencia. | Llamarlo puntuación automática; separar evaluación técnica, citas y validación humana. |

## Qué sabemos de la precisión

La pantalla de evaluación muestra una corrida histórica de 27 preguntas con puntuación aproximada de 98%. El código calcula esa puntuación con heurísticas de cobertura y confianza; no es una estimación de exactitud jurídica ni una prueba actual del modelo y corpus tras las últimas modificaciones.

La evaluación existente además marca menciones de normas antiguas con patrones globales. Un caso donde un régimen histórico sea pertinente exige etiquetas específicas del caso; no debe juzgarse con una prohibición universal basada solo en texto.

No hay una comparación controlada ACE/LEX ni una medición nueva de precisión jurídica en esta auditoría. Tampoco se ha medido tiempo de completar tareas con usuarios. Deben distinguirse:

- Exactitud de extracción: campos correctos frente al PDF original, y datos ausentes correctamente reconocidos.
- Recuperación: fuentes pertinentes recuperadas para la consulta y el régimen del caso.
- Sustento: cada afirmación respaldada por un fragmento y una ubicación verificable.
- Aplicabilidad: vigencia, régimen, fechas y hechos suficientes.
- Experiencia: tiempo de completar, pérdida de datos, errores corregidos y tareas completadas.

La guía oficial de [evaluación de OpenAI](https://developers.openai.com/api/docs/guides/evaluation-best-practices) recomienda definir objetivos, reunir datos de referencia, establecer métricas y repetir comparaciones. La revisión de expertos es necesaria para evaluar la corrección jurídica del conjunto de referencia; pasar pruebas de código no sustituye esa revisión.

## Comparación verificada con LEX

| Función | ACE inspeccionado | LEX inspeccionado | Lectura práctica |
| --- | --- | --- | --- |
| Chat y búsqueda con IA | Existen, con fuentes y contexto del caso | Ambos visibles en `app/ai` y `app/chat` | La existencia de chat no diferencia por sí sola a ACE. |
| Régimen, categorías y años | Contexto del caso; filtros de tipo/año; vigencia/régimen aún pendientes en parte del lote oficial | Selector de ley aplicable y selección de categorías/años en el chat | ACE necesita controlar mejor la aplicabilidad; un campo libre no garantiza filtrar el corpus por régimen. |
| Archivos en el chat | La consulta se apoya en el corpus indexado y otros flujos documentales | Se ofrece adjuntar hasta cuatro imágenes en el chat | Capacidad visible de LEX que no se presume implementada en el chat de ACE. |
| Preparación contractual | Formularios SIE y CP, extracción, guardado y exportación | No se observó generador contractual en las pantallas y menú revisados | Diferencia funcional observable a favor del trabajo operativo de ACE; no prueba de ausencia en todos los planes de LEX. |
| Organización y originales | Biblioteca, PDF, guardados e historial | Carpetas, anotaciones y descargas de originales | Ambos cubren parte del trabajo documental. |
| Amplitud documental | El lote oficial verificado contiene 65 documentos; no es un inventario del total del sistema | Múltiples categorías normativas, criterios editoriales, dictámenes y formación visibles | No se ha demostrado equivalencia de cobertura. No copiar contenido editorial. |
| Modelo y precisión | Modelo de respuestas recientes identificado; puntuación heurística histórica | La pantalla revisada no muestra el modelo subyacente ni una métrica comparable | No puede afirmarse una superioridad de precisión ni asignarse un porcentaje de mejora. |

Referencias de producto: [LEX y funciones públicas](https://lexcontrataciones.com/), [IA de LEX](https://lexcontrataciones.com/app/ai), [chat de LEX](https://lexcontrataciones.com/app/chat?view=chat), [Contratos de ACE](https://ace-rormi.vercel.app/contratos).

## Primera entrega recomendada

Corregir y profesionalizar Contratos SIE/CP con una revisión guiada antes de exportar, borradores fiables y revisión de extracción. Corregir también las etiquetas de evaluación que hoy pueden confundirse con precisión jurídica. Mantener el proveedor actual y medir antes de decidir una migración de modelo. Necesidades y Expedientes constituyen una siguiente entrega que necesita un diseño propio.

La mejora sobre LEX se debe medir como capacidad de pasar de fuentes a un contrato revisable: menos transcripción manual, menos pérdida de trabajo y citas trazables. No hay aún datos para prometer un porcentaje de ahorro o de precisión.

## Verificación realizada

- 17 pruebas existentes aprobadas sobre selección de modelos, módulos y permisos de contratación.
- Diagnóstico aislado del adaptador, sin red: pérdida de `input_file` confirmada.
- Revisión visual de Inicio/SIE, IA/chat/filtros de LEX, evaluación e historial de ACE.
- Capturas locales: `.next/piloto-oficial/ace-contratos-antes.png` y `.next/piloto-oficial/lex-chat-auditoria.png`.

Estas pruebas no miden precisión de extracción con documentos de referencia ni corrección jurídica. Eso queda como criterio de validación de la implementación propuesta.
