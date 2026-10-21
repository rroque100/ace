# Subir RAG y Buscar RAG

Objetivo: importar la jerarquía tipo/archivador/PDF y consultar identificación y contenido respetando los permisos existentes.

- [x] Parser compartido de rutas, CP, fecha y SIAF; revisión de coincidencias sin sobrescrituras.
- [x] Importación secuencial por Storage con metadata de origen y hash calculado en servidor. Conservar cada expediente y ubicación.
- [x] OCR por bloques con puntos de recuperación, integración con cola y publicación atómica existente. No confundir lectura parcial con completa.
- [x] Consulta paginada de registros por CP/SIAF/archivador/tipo/año. Consultas de contenido y preguntas acotadas al documento seleccionado.
- [x] Pestañas accesibles, revisión antes de importar, estados, errores y reintentos; reutilizar colores del módulo.
- [x] Pruebas de parser, permisos, filtros, procesamiento reanudable y TypeScript/lint.

No subir los documentos reales durante el desarrollo. No inventar estante/local ni interpretar CP como SGD. SIAF conserva ceros. El cron existente es diario: informar esa cadencia, y permitir continuar manualmente. La selección local debe repetirse si se cierra el navegador antes de finalizar la subida.

Validación: 44 pruebas seleccionadas, TypeScript y ESLint correctos. Compilación de producción correcta (advertencia preexistente sobre pdfjs-dist del visor cliente). Verificada la inclusión del worker legacy en el artefacto de la nueva ruta RAG. Pendiente prueba con sesión real y PDF del usuario en producción.
