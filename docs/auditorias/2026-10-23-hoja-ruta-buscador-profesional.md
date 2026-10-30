# Hoja de ruta del buscador profesional de ACE

Fecha: 23/10/2026. Alcance: análisis y propuesta, no implementación. Basada en la auditoría de robustez, el código actual y la comprobación previa de producción. No acredita cumplimiento legal, rendimiento bajo carga ni exactitud jurídica medida.

## Propósito

Ayudar a encontrar documentos de contratación pública, revisar el pasaje original y reunir fuentes para una consulta verificable. Búsqueda encuentra fuentes; Normativa estudia documentos y versiones; Chat desarrolla una explicación con fuentes y límites. Los tres usan los mismos identificadores y estados de revisión.

## Requisitos y aceptación

| Prioridad | Frente | Trabajo requerido | Evidencia para aceptar |
|---|---|---|---|
| Crítica | Cobertura | Inventario de fuentes oficiales y autorizadas; importación idempotente; distinguir documento detectado, descargado, extraído, indexado, revisado y fallido. Priorizar materias demandadas, no cuotas iguales por tipo. | Totales por tipo y etapa; documentos esperados recuperables; errores visibles y recuperables. |
| Crítica | Clasificación | Tipo documental, emisor histórico y unidad, número/año, procedimiento, objeto, materia, tema, subtema. Aclarar qué dictámenes se incorporarán y quién los emite. Procedimiento competitivo como dimensión de clasificación, no automáticamente como tipo de PDF. | Un mismo documento conserva la misma clasificación en los tres módulos; filtros no mezclan tipos y procedimientos. |
| Crítica | Versiones y temporalidad | Separar publicación, actualización textual y carga. Vincular original, modificación y compilación. Estado jurídico revisado con fuente de revisión y fecha; desconocido visible. | Históricos accesibles; no se marca aplicabilidad por ser el PDF más reciente. |
| Crítica | Extracción y trazabilidad | PDF original, huella, URL de origen, páginas y texto extraído; control de OCR; encabezados/pies apartados para recuperación sin alterar el original. | El pasaje abre la página correcta y se puede contrastar visualmente; originales no cambian. |
| Crítica | Fiabilidad | Propagar estados de recuperación parcial y distinguir error de cero resultados; reproducir inconsistencia potencial en más coincidencias por artículo. | Fallos simulados visibles; paginación conserva consulta normalizada; ningún error presentado como ausencia documental. |
| Alta | Índice y escala | Índice textual persistente, consultas y paginación en servidor, planes medidos, caché institucional invalidable, superar límite de 2.000 de forma controlada. | Comparación de resultados antes/después; pruebas con corpus representativo ampliado y concurrencia definida; sin truncamiento silencioso. |
| Alta | Recuperación híbrida | Mejorar integración existente de palabras, vectores y reranking; filtros previos cuando sea posible y ampliación acotada de candidatos. | Documento esperado recuperado con filtros; conteos exhaustivos y conjuntos recuperados correctamente diferenciados. |
| Alta | Referencias y lenguaje | Normalizar números, artículos, numerales y siglas en todos los endpoints. Corrección ortográfica propuesta; frase, todas las palabras y significado diferenciados. | Variantes equivalentes encuentran el original; números y exclusiones nunca cambian silenciosamente. |
| Alta | Orden y pasajes | Reducir dependencia absoluta del título, seleccionar pasajes antes de recortar a cinco y diversificar páginas. Orden temporal explícito. | Conjunto revisado de consultas con documentos y pasajes esperados; no privilegiar automáticamente un histórico, una versión nueva o un título sin atender a la intención. |
| Alta | UX y accesibilidad | Un campo principal, modos comprensibles, filtros Tipo/Régimen/Fecha, cantidades y etiquetas activas. PDF lateral, retorno conservado, cero resultados orientativo, teclado y móvil real. | Tareas de búsqueda completadas por usuarios no técnicos; auditoría de teclado, foco, contraste y lector; teléfono real validado. |
| Alta | Integración jurídica | Selección de fuentes y alcance explícito al abrir Chat; mismas versiones y páginas en Normativa; distinguir documento original de documento que solo lo cita. | Selección limitada no amplía corpus sin permiso; referencias indirectas identificadas; consulta y selección conservadas al volver. |
| Alta | Seguridad y operación | Corpus institucional separado de expedientes privados; autorización en servidor; audio y consultas privados; límites compartidos entre instancias; control de costes y diagnóstico sin datos sensibles. | Pruebas de acceso cruzado denegadas; cambios de sesión no restauran consultas ajenas; límites y recuperación ensayados. |
| Alta | Actualización y calidad | Actualizaciones programadas con registro de cambios y sincronización catálogo/PDF/texto/vectores. Pruebas revisadas por especialista y métricas de recuperación, ranking, páginas, errores y latencia. | Una actualización o retirada se refleja coherentemente en los tres módulos; evaluación repetible por versión del buscador. |
| Posterior | Voz | Grabación breve iniciada por el usuario, transcripción revisable, confirmación de siglas/números, aviso de procesamiento y retención, alternativa escrita. | Pruebas de hablantes y ruido; tasas de error específicas en números/años/referencias; búsquedas no se ejecutan antes de revisar. |
| Posterior | Organización | Colecciones de fuentes, historial recuperable, exportación de bibliografía y alertas por consulta guardada con permisos adecuados. | Enlaces estables, procedencia visible y ausencia de exposición de consultas privadas en URLs compartidas. |

## Etapas

1. Fiabilidad inmediata: errores parciales, artículo/paginación, cobertura visible y trazabilidad de pasajes.
2. Biblioteca e índice: completar clasificación y extracción, controlar versiones e implementar consultas escalables con pruebas de regresión.
3. Relevancia profesional: recuperación filtrada, normalización integral, ranking evaluado y UX validada por usuarios.
4. Producción sostenida: concurrencia, seguridad, actualización, métricas y costes; después voz y organización avanzada.

## Métricas necesarias

Definir el conjunto de consultas y corpus de referencia antes de fijar umbrales. Medir si se recupera el documento esperado, su posición, la fidelidad del pasaje/página, cobertura por categoría, fecha de actualización, latencia mediana y de solicitudes lentas, errores y costes. Separar estas métricas de la exactitud de una respuesta jurídica del Chat. Pruebas unitarias correctas no sustituyen la revisión experta ni una prueba de carga.

## Decisiones que deben documentarse

Fuentes que se autoriza importar, categorías objetivo y emisor de dictámenes; tamaño esperado y usuarios simultáneos; responsable de revisión de metadatos jurídicos; frecuencia de actualización y retención de consultas/audio; criterios de éxito medibles. Se pueden preparar mejoras independientes mientras se concretan estas decisiones.
