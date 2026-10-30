# Fiabilidad del buscador — implementación

Diseño autorizado por el usuario al aprobar la primera etapa. Usar ejecución en esta sesión, sin delegación.

Objetivo: transmitir fallos parciales de recuperación y mantener idéntica normalización de artículos en consulta inicial y paginación. No modificar corpus, ranking ni reglas jurídicas.

- [x] Pruebas de regresión: caída léxica con semántica disponible, consulta/paginación con Art. y numeral y filtro de artículo explícito.
- [x] Extraer `normalizeLiteralSearch` a `lib/document-search-query.ts`; consumir desde búsqueda y endpoint de coincidencias.
- [x] Añadir estado estructurado de recuperación a `searchLegalSources`, propagar avisos y mostrar resumen visible.
- [x] Evitar duplicados y carga reiterada de páginas sin avance.
- [x] Ejecutar regresión, tipos, lint, compilación; revisar diff selectivo; commit/push y verificar Vercel y pantalla.

Aceptación: mismo p_query/p_article en ambos endpoints; fallo parcial visible incluso con cero resultados; fallo total conserva respuesta de error; pruebas de acceso y validación existentes no se alteran.

Validación previa: tipos y lint correctos; compilación correcta con advertencia preexistente de pdfjs-dist. 164 pruebas de regresión y dos pruebas adicionales del endpoint correctas. La publicación y la comprobación en navegador se registran al finalizar.
