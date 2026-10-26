# Preguntas de alternativas con evidencia

El usuario aprobó mejorar el reconocimiento de alternativas, la recuperación específica, la verificación de la elección y la respuesta directa. La implementación mantiene las fuentes y los permisos existentes.

## Diseño
- Analizar enunciado y opciones sin cambiar letras, cifras ni negación.
- Consultar el enunciado y cada opción en paralelo, con el mismo alcance. Una recuperación fallida se advierte; no prueba que el distractor sea falso.
- Priorizar el encabezado que responde al enunciado. Mantener fuentes iniciales obligatorias y artículos exactos.
- Generar una elección estructurada con contraste por opción. El servidor exige claves completas y una sola elección, comprueba fuentes existentes y construye una afirmación citada.
- Verificar esa afirmación de forma independiente con la pregunta original. Los pasajes numerados se resuelven al texto original del servidor, evitando errores al reescribir OCR. Esto no sustituye la comprobación de significado.
- Si la elección no supera la revisión, reconocer el límite y no sustituirla por un extracto relacionado. La misma protección rige antes del envío de texto en streaming.

## Límites
No garantiza precisión jurídica universal. Las preguntas ambiguas, los regímenes desconocidos y los documentos no incorporados siguen requiriendo aclaración o revisión. No se codificó una letra correcta ni un artículo fijo en producción.
