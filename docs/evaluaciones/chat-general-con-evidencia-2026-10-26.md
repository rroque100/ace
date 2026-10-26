# Chat general con evidencia · evaluación 2026-10-26

## Cambios
- Orientación del formato para explicación, requisitos, pasos, comparación, resumen, cantidades y casos; las etiquetas no fijan respuestas jurídicas. La IA interpreta el contenido en el mismo flujo de generación.
- Hasta tres subpreguntas explícitas para recuperación adicional, con filtros y selección documental conservados. Aviso si el alcance o alguna recuperación son parciales.
- Analizador compartido para revisar y publicar párrafos, listas, encabezados y tablas. Cada fila se comprueba junto con sus encabezados; no se publican títulos sustantivos sin revisión. El desarrollo adicional puede permanecer plegado.
- Comparaciones con salida estructurada y tabla construida por el servidor, con fuentes existentes y revisión semántica posterior.
- Revisión en hasta tres tandas de dieciséis afirmaciones. Conserva lo comprobado si otra tanda falla y declara el límite de cuarenta y ocho, sin afirmar que se revisó el resto.
- Distinción de consulta general y caso; preguntas por año no se convierten por sí mismas en un caso. Solicitudes de comparación completa incluyen acceso al comparador y aviso de alcance.
- Detección de generación interrumpida; un reintento compacto y acotado antes de la revisión. No transmite borradores truncados en streaming.

## Evidencia
86 pruebas correctas en nueve archivos de chat, evidencia, alternativas, selección y transferencia de fuentes. Tipos y lint correctos. La compilación mantiene la advertencia previa de pdfjs-dist.

Se consultó el corpus real sin guardar conversaciones de prueba. Una explicación con lista conservó contenido comprobado y retiró afirmaciones adicionales no verificadas. Una comparación entre requerimiento y estrategia de contratación produjo tres filas comprobadas (finalidad, responsable y contenido), con revisión completa, en 7,55 segundos en la observación final. Las primeras pruebas detectaron un corte del proveedor y referencias F en formato de texto; ambos casos tienen manejo explícito. Estas observaciones no constituyen una medición representativa de precisión jurídica.

## Límites
No se añadieron fuentes ni reglas normativas fijas. Los cuerpos, regímenes y versiones sin revisión humana siguen pendientes. La recuperación no certifica cobertura completa del catálogo. La precisión jurídica requiere evaluación amplia por especialistas; la aprobación automática comprueba respaldo de las fuentes recuperadas, no aplicabilidad definitiva a un caso.
