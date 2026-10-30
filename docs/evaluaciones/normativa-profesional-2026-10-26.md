# Normativa profesional — entrega y comprobaciones

## Fiabilidad

- El listado usa el catálogo institucional de Búsqueda y los mismos estados de vigencia. `vigente` ya no incluye `no vigente` por coincidencia parcial.
- Listado paginado de 20 por página; filtros antes de paginar y auxiliares solo de la página. Se elimina el corte silencioso de 300 documentos; el recorrido del catálogo conserva el límite operativo explícito de 100.000 registros de Búsqueda. No se declara rendimiento a escala masiva.
- Versiones por `documentFamily`, para todas las categorías admitidas, con publicación, actualización e incorporación separadas. No se afirma cuál es la versión vigente ni se usa el año de carga para determinarlo. Las fechas ausentes siguen sin registrar.
- Auxiliares recorren páginas de 500 con orden estable; un fallo posterior no publica una lista parcial como completa. Los avisos de referencias, páginas, resúmenes y versiones son visibles.
- Detalle institucional indexado y UUID validado; búsqueda dentro del documento comprueba primero que es institucional. Referencias entrantes se restringen a documentos institucionales.

## Lectura y UX

- Campo de título/número (formatos equivalentes conservadores), Tipo/Régimen/Año principales; entidad, procedimiento y vigencia dentro de más filtros, con cantidad de filtros activos.
- Tarjetas compactas: título, entidad, tipo, versión y registro de revisión. Indicadores de indexación y páginas plegados en Estado del documento.
- Procedencia por documento, nota de revisión automática y acceso a publicación oficial cuando existe URL admitida; texto extraído y PDF claramente diferenciados del resumen asistido.
- Índice por secciones registradas o encabezados explícitos de texto, sin clasificar por significado. En el reglamento de comprobación: 381 artículos registrados, cero secciones persistidas; 377 tienen contexto de encabezado recuperable y cuatro permanecen sin sección identificada. Es ayuda documental automática, pendiente de revisión humana.
- Numeración repetida conserva IDs/ordinales y muestra aviso de posible pluralidad de cuerpos. No se ha resegmentado el PDF completo ni certificado la integridad jurídica de la extracción.
- Diseño adapta listado y lectura a pantallas estrechas; la validación en teléfono real y con lectores de pantalla sigue pendiente.

## Asistencia

- Extractos y señales por palabras están plegados e identificados como automáticos. No se presentan como resumen jurídico ni acreditan ausencia de obligaciones/riesgos.
- Referencias: detectada o enlace localizado; enlazar no acredita una relación jurídica revisada. No se infieren modificaciones o derogaciones por palabras de una mención.
- Handoff autenticado fija documento, selección de un documento y artículo si su numeración no es ambigua. Se incluye pasaje y página seleccionados; en numeración repetida se evita filtrar por un número ambiguo y se mantiene el contexto textual.
- Enlaces de comparación fijan ambas versiones en el comparador existente. No se incorpora una nueva validación humana de diferencias.
- Búsqueda por significado dentro del documento avisa selección limitada, recuperación parcial o ausencia de pasajes, sin declarar ausencia del tema.

## Evidencia

- 67 pruebas correctas en nueve archivos: listado, versiones, UUID, privacidad institucional, fallos parciales, filtros, referencias, extracción conservadora de encabezados y continuidad con Chat.
- Auditoría con Supabase real: 93 documentos institucionales, nueve tipos con contenido, 90 familias y tres con versiones relacionadas. Consultas reales de referencias y artículos correctas; informe `normativa-audit-2026-10-26.json`.
- Compilación de producción y lint específicos. Persiste aviso previo de empaquetado de pdfjs-dist.

La revisión de vigencia, efectos de concordancias, ámbitos ambiguos y exactitud jurídica de resúmenes requiere revisión especialista. Esta entrega no marca esos contenidos como revisados ni cambia los originales almacenados.
