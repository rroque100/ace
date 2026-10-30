# Auditoría de robustez del buscador de ACE — 23/10/2026

Alcance: revisión del buscador publicado, código del servidor, funciones SQL del repositorio y pruebas automatizadas. Evaluación, sin cambios funcionales. No es una prueba de carga, de penetración ni una medición de precisión jurídica.

## Dictamen

Base funcional adecuada para un piloto con biblioteca pequeña. No está acreditada la preparación para una biblioteca masiva ni para concurrencia elevada. No corresponde asignar un porcentaje de precisión sin un conjunto de consultas revisadas y documentos esperados.

## Evidencias

- UI: 82 documentos institucionales indexados: ley 6, reglamento 2, directiva 11, opinión 22, resolución 11, acuerdos 10, pronunciamientos 10, guías 10, IVN 0, bases estándar 0.
- UI: la búsqueda literal de garantía de fiel cumplimiento con Opinión y 2026 muestra siete documentos. Persisten encabezados de validación de firmas y ruido OCR en algunas vistas previas.
- Pruebas ejecutadas: 39 correctas en seis archivos: document-search, document-search-server, document-search-ranking, document-search-route, search-assistant y search-assistant-route. Son pruebas funcionales y de límites; no acreditan exhaustividad o rendimiento bajo carga.
- Búsqueda literal, todas las palabras y significado separados; títulos/números normalizados, filtros, agrupación documental, páginas/PDF y traspaso de fuentes al chat implementados.
- Búsqueda por significado ya combina recuperación vectorial, respaldo léxico y reranking. No se recomienda reconstruirla como si esas capacidades no existieran.

## Hallazgos prioritarios

### Alta: cobertura y metadatos

Categorías vacías y biblioteca reducida limitan cualquier motor. Agregar dictámenes o procedimientos competitivos requiere definir su naturaleza documental y actualizar la taxonomía, admisión/indexación, filtros SQL y módulos consumidores; añadir solo una opción visual no permite buscarlos. Verificar integridad de PDF, texto, páginas, vectores, versiones y procedencia. Mostrar cobertura por categoría y estado de revisión.

### Alta: crecimiento y coste de consulta

`lib/document-search-server.ts` carga todo el catálogo y aplica filtros y paginación en memoria. El límite de 2.000 es explícito y genera un error, no un resultado truncado. Las funciones SQL de `docs/supabase/2026-10-23-document-search.sql` normalizan texto y concatenan fragmentos en consulta con position/string_agg. Todas las palabras puede ejecutar hasta diez búsquedas. No hay evidencia de un índice específico utilizado por esa expresión ni de planes de ejecución medidos en esta auditoría.

Propuesta: índice textual normalizado persistente; recuperación y paginación documental en base de datos; consultar planes reales antes de elegir índices de texto completo/trigramas. Mantener una comprobación literal exacta posterior para no confundir búsqueda lingüística con frase exacta. Caché institucional breve con invalidación al indexar, actualizar o retirar documentos.

### Alta: alcance y filtros de la búsqueda semántica

Se recuperan hasta 60 candidatos vectoriales y se seleccionan hasta 20 fuentes finales diversificadas. No son veinte documentos garantizados ni todos los documentos pertinentes. Algunos filtros y la lista de IDs permitidos se aplican después de recuperar candidatos; un subconjunto válido puede quedar fuera de esa ventana.

Propuesta: aplicar restricciones admisibles antes de recuperar candidatos y ampliar la recuperación de forma acotada cuando los filtros descarten demasiados. Etiquetar total exhaustivo frente a documentos recuperados. Conservar advertencias de que el orden por fecha no encuentra necesariamente lo más reciente de toda la biblioteca.

### Alta: comunicar recuperaciones parciales

`searchLegalSources` añade avisos a assessment cuando falla la vía léxica o semántica. La capa documental solo transforma semanticaCaida en aviso; no propaga todos los avisos del assessment. Esto puede ocultar una degradación parcial. Propagar una señal estructurada de estado para cada vía y mostrar un aviso breve cuando corresponda.

### Media: calidad del orden y de los pasajes

La coincidencia en título aporta 100 puntos y puede dominar la relevancia del contenido. SQL envía inicialmente los primeros cinco fragmentos por orden físico del documento; el ranking posterior solo puede comparar esos cinco. No garantiza seleccionar el pasaje más útil de todo el documento. Mejorar selección de pasajes antes del recorte, diversidad por página y penalización de encabezados; medir con resultados esperados. Conservar documentos históricos y su relación con versiones.

### Media: normalización uniforme de artículos

La búsqueda inicial transforma consultas Art./Artículo y el artículo padre. La carga de más coincidencias usa el texto original y el filtro original en otro endpoint. Hay una posible inconsistencia para búsquedas por artículo que requiere reproducción específica y prueba de extremo a extremo antes de declararla un fallo observado en producción.

### Media: operación y límites

El limitador de solicitudes usa un Map en memoria, independiente por instancia. No es un límite global fiable en despliegue distribuido. Centralizar límites y registrar tiempos, errores, recuperación parcial y consultas sin resultados con protección de datos y retención definida. Medir latencia y errores con concurrencia real; no se midieron en esta revisión.

## UX

- Mantener un campo principal y tres modos claros; reducir duplicación entre los botones de modo y el selector adicional.
- Mostrar cantidades por tipo y distinguir categoría vacía de cero coincidencias bajo filtros.
- Diferenciar año del documento, publicación original y actualización del texto.
- Elegir el pasaje sustantivo antes de limpiar la vista; el PDF y el texto fuente permanecen íntegros.
- IA como ayuda revisable para preparar criterios; no interpretar su propuesta como un resultado documental comprobado.
- Mantener Chat para explicar fuentes y Normativa para estudiar documentos/versiones.
- Falta validación real con teléfono, teclado y lectores de pantalla; no se declara auditoría de accesibilidad completa.

## Orden recomendado

1. Propagar avisos de recuperación parcial y comprobar paginación por artículo.
2. Completar tipos y metadatos, depurar extracción y seleccionar mejores pasajes.
3. Optimizar índice, filtros y paginación en servidor, con mediciones y consulta de planes.
4. Afinar recuperación híbrida y ranking mediante un conjunto revisado de consultas.
5. Validar móvil, accesibilidad y concurrencia. Medir recuperación del documento esperado, relevancia de los primeros resultados, cobertura por tipo, latencia y tasa de errores.
