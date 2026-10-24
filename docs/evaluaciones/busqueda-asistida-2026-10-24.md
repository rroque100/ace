# Verificación de búsqueda asistida — 24 octubre 2026

## Implementación
- El modo tema combina hasta 20 documentos por palabras y 20 pasajes por significado/referencias, mediante fusión recíproca de posiciones. No suma scores de proveedores ni los interpreta como certeza jurídica.
- Los filtros del índice delimitan candidatos antes de Pinecone. A partir de 10.001 documentos candidatos se pide acotar filtros, sin truncar silenciosamente; la búsqueda literal conserva su paginación completa. Continúa existiendo ese límite operativo y no se ha validado carga masiva.
- Sugerencias: máximo seis documentos del índice; vocabulario de títulos/texto institucional con índice trigram y sincronización al modificar el índice documental. Las correcciones son únicas, de distancia de edición uno, alfabéticas; no cambian números, artículos, siglas ni frases entre comillas. Solo se aplican por selección del usuario.
- La asistencia no requiere un proveedor IA. La ayuda de IA ya existente prepara criterios con confirmación y respaldo. Un fallo de sugerencias no bloquea la búsqueda.
- Se añade página visible del pasaje, acciones Leer PDF/Consultar en Chat/Ver en Normativa y cantidades de biblioteca en filtros. Las cantidades no son facetas de la consulta actual.
- La pantalla aún descarga el catálogo para clasificación/cantidades al abrir. La nueva recuperación por tema solicita únicamente los candidatos filtrados; no se afirma haber eliminado toda transferencia del catálogo de la interfaz.

## Evidencia
- Compilación de producción, comprobación de tipos y revisión estática correctas. Persiste advertencia previa de empaquetado pdfjs-dist.
- 205 pruebas correctas en 27 archivos antes de la última prueba específica de prefiltrado vectorial; registro final en la entrega.
- Seis casos documentales en search-retrieval-cases-2026-10-24.json: documento esperado en primera posición en los seis. Tiempos observados 420–1111 ms en cinco consultas literales y 3540 ms en una combinada. Son observaciones puntuales, no percentiles ni pruebas de concurrencia.
- search-discovery-checks-2026-10-24.json documenta propuesta garantua → garantia, prioridad de identificador exacto y 22 candidatos del filtro opinión/2026, todos consistentes.
- Los tests deterministas forman parte de la suite que ya ejecuta CI. La evaluación con servicios reales se ejecuta explícitamente: node scripts/evaluate-document-search.mjs docs/evaluaciones/search-retrieval-cases-2026-10-24.json docs/evaluaciones/search-retrieval-results-2026-10-24.json. No escribe historial ni conversaciones.

## Pendientes
Revisión por especialista, ampliar consultas reales y negativos, relevancia jurídica y OCR por página, medidas bajo concurrencia y teléfono real. El catálogo sigue con 92 documentos; IVN verificables y bases 2026 no se incorporan por esta modificación. No se presupone cobertura completa ni vigencia revisada.
