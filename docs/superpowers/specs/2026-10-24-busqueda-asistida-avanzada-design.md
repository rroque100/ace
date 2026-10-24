# Búsqueda asistida y recuperación combinada

Diseño solicitado por el usuario el 24 de octubre de 2026.

Se conserva el buscador existente y sus modos exacto, palabras y tema. El modo tema combina resultados documentales por palabras con recuperación por significado mediante fusión por posiciones; el marcador explica qué métodos encontraron cada documento. No equipara similitud con vigencia ni exactitud jurídica.

Los filtros se resuelven en el índice antes de enviar candidatos al recuperador. Se declara un límite operativo de 10.000 candidatos para significado; al excederlo se solicita acotar filtros, sin truncar ni simular una lista completa. La búsqueda exacta conserva paginación completa en servidor. No se cambia el corpus ni se inventan documentos faltantes.

La asistencia consulta títulos e identificadores del índice y un vocabulario derivado del texto institucional. Propone correcciones únicamente de palabras alfabéticas largas, nunca cifras, siglas o referencias de artículos. La consulta original permanece hasta confirmar. Las sugerencias tienen seis documentos como máximo, demora breve, cancelación de peticiones obsoletas y controles accesibles por teclado. Si falla la asistencia, buscar sigue disponible.

La pantalla mantiene el lenguaje y colores de ACE, presenta un campo con ejemplos, filtros principales con cantidades del catálogo (etiquetadas como tales), el pasaje/página y acciones Leer PDF, Consultar en Chat y Ver en Normativa. La IA de preparación conserva confirmación y respaldo sin IA.

Evaluación: pruebas de fusión, errores parciales, filtros, referencias y correcciones. Un evaluador lee consultas y documentos esperados de un archivo revisable y registra recall@k, MRR, tiempos, páginas y fallos. No etiqueta casos como aprobados por especialista sin revisión humana. La prueba bajo carga y la ampliación IVN/2026 siguen pendientes.
