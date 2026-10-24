# Biblioteca e índice — verificación del 24/10/2026

## Cambios realizados

- Índice institucional persistente de documentos y fragmentos, con filtros y paginación literal/por palabras en PostgreSQL. Sin carga previa de todo el catálogo en ese recorrido. Sincronización transaccional mediante disparadores al cambiar originales y fragmentos; originales y documentos privados se conservan.
- Índices de texto, referencia, fecha y familia documental. Los mejores cinco pasajes se seleccionan antes del recorte, y las páginas adicionales conservan ese orden. La recuperación semántica mantiene su alcance limitado y sus avisos.
- Recorrido del catálogo y revisión de metadatos con cursor; se eliminó el corte de 2.000 documentos. Se conserva un límite operativo explícito de recorrido para impedir conteos truncados.
- Fechas obtenidas exclusivamente de encabezados oficiales, con procedencia y auditoría. Se añadieron 43: 83 de 92 documentos tienen publicación registrada. No se inventaron las nueve restantes.
- Versiones relacionadas por identidad documental, manteniendo históricos y notas de publicación.
- Cobertura: 94 registros de las categorías admitidas; 92 indexados y dos registros previos con error. La interfaz distingue registrado/indexado/en proceso/error y las categorías sin contenido.

## Ampliación oficial

Diez PDFs originales de bases estándar publicados por el MEF en 2025: 911 páginas, 931 fragmentos. Se comprobaron integridad SHA-256 en Storage, extracción completa registrada y recuperación en Pinecone de cada documento. Manifiesto: bases-oficiales-2026-10-24.json.

Fuente primaria: https://www.gob.pe/institucion/mef/normas-legales/6683111

Son publicaciones históricas con revisión de vigencia pendiente. La publicación posterior de bases en 2026 contiene originales DOCX; no se convirtieron ni se presentaron como PDFs oficiales: https://www.gob.pe/institucion/mef/normas-legales/7614342-001-2026-ef-54-01

IVN permanece pendiente de originales oficiales verificables. Los resultados de búsqueda encontrados eran referencias en otros documentos; no se reclasificaron esas referencias como informes originales.

## Comprobaciones

- Proyección del índice contrastada con los 92 registros y clasificación/familias de la aplicación: cero diferencias.
- Consultas de referencia contrastadas con la búsqueda anterior, incluyendo filtros y todas las páginas; reporte indice-consultas-verificacion-2026-10-24.json.
- Privilegios comprobados en la base: anon y authenticated no tienen SELECT sobre el índice; anon no puede ejecutar el RPC. El backend autenticado sigue siendo la vía de consulta.
- Recorrido de coincidencias comprobado con cinco pasajes iniciales y seis adicionales, sin IDs repetidos.
- Plan de consulta simple revisado: PostgreSQL eligió recorrido secuencial con el corpus pequeño (92 registros, 27,680 ms de ejecución interna en esa comprobación). Los índices están creados; no se afirma una mejora de latencia bajo carga ni se fuerza el planificador.
- 189 pruebas seleccionadas correctas, tipos y lint correctos; compilación correcta con la advertencia preexistente de pdfjs-dist.

## Límites

No se declara precisión jurídica certificada, prueba de carga, corpus completo de contrataciones ni validación móvil completa. La vía semántica y el listado de clasificación todavía recorren el catálogo; la mejora de paginación en base de datos corresponde a la vía literal/por palabras. El límite de 100.000 registros del recorrido administrativo es operativo y explícito, no un total parcial publicado.
