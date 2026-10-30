# Buscador profesional: diseño aprobado

El usuario aprobó el 23/10/2026 el diseño del informe de evaluación e indicó implementarlo.

Implementación incremental sobre el buscador existente: preservar estado privado por usuario; modos frase/todas las palabras/significado; identificadores y artículos normalizados; filtros principales y secundarios; chips individuales; tarjetas compactas; lector PDF conservando resultados; selección de varias fuentes para el chat con alcance explícito. Unificar presentación de entidad, fechas y versiones mediante funciones compartidas, sin deducir vigencia jurídica. Añadir cobertura del corpus y reanudar importaciones oficiales disponibles, sin completar cuotas con documentos ajenos ni extracciones parciales.

Las búsquedas se restauran desde sessionStorage acotado al usuario y con caducidad; no se publican hechos del caso en URLs. Los resultados se vuelven a validar por el servidor autenticado. Las versiones se relacionan por identidad documental, no se borran. La consulta de selección usa documentIds en servidor, sin ampliación implícita.
