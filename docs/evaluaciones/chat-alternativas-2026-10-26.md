# Evaluación de preguntas con alternativas · 2026-10-26

## Diagnóstico
La revisión previa recibía afirmaciones y fuentes, pero no la pregunta original; por eso comprobar una cita no bastaba para comprobar que respondía al enunciado. La recuperación mezclaba el enunciado y todos los distractores. El reemplazo literal podía terminar mostrando una disposición relacionada sin resolver la elección. Además, las citas reescritas por el modelo podían alterar espacios de OCR u omitir literales y provocar rechazos aun con evidencia disponible.

## Verificación
- Caso contrastado con el corpus real: Reglamento original, documento 43b7991a-0768-45c2-a1a0-7c4d0c62abef, fragmento 47; texto actualizado, documento 8371bce1-f773-4ad8-8efa-1266276ae4ec, fragmento 50. Artículo 44.2, literal c), propuesta de modalidad de pago y sistema de entrega.
- Con la implementación final se realizaron dos consultas reales, sin persistir conversaciones: ambas publicaron la opción b con artículo 44.2 y sus fuentes; revisión completa. Tiempos observados: 6,77 y 6,92 segundos. Son dos observaciones de este caso, no una medición representativa de precisión.
- Pruebas automatizadas de análisis, formato, pasajes, referencias inexistentes, revisión contradicha, caída del revisor y publicación en streaming.
- Tipos, lint y compilación de producción correctos. Permanece la advertencia previa de pdfjs-dist.

La evaluación jurídica de un conjunto amplio revisado por especialistas continúa pendiente. No se cambió la biblioteca ni se asignaron cuerpos normativos automáticamente.
