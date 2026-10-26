# Chat general con evidencia — Implementation Plan

**Goal:** responder consultas diversas con IA, estructura útil y revisión documental antes de publicar.
**Architecture:** planificación ligera de consulta y recuperación limitada; borrador adaptativo; analizador común de afirmaciones y formato; publicación solo de nodos revisados.
**Tech Stack:** TypeScript, Next.js, Vitest, proveedor IA configurado, corpus existente.

## Restricciones
No codificar respuestas jurídicas. Respetar filtros, selección obligatoria, artículo exacto y documentos privados. No prometer exhaustividad o vigencia. No transmitir borradores sin revisar. No ampliar catálogo ni cambiar proveedor.

- [x] Crear pruebas y módulo de planificación: tareas combinadas, formatos, subpreguntas limitadas, contexto general/caso y seguimientos.
- [x] Crear pruebas y analizador compartido de párrafos, listas, encabezados y tablas. Cada fila debe revisarse con sus encabezados. Solo conservar encabezados neutrales o afirmaciones comprobadas.
- [x] Integrar recuperación por subpreguntas, avisos de fallos parciales e instrucciones de generación adaptativas. Mantener alternativas existentes.
- [x] Revisar respuestas largas por lotes acotados, conservar lo comprobado y declarar cualquier límite o fallo sin convertirlo en ausencia de fuentes.
- [x] Probar formatos, selección, casos, streaming, errores y regresiones; ejecutar tipos, lint y build.
- [x] Comprobar con consultas reales del corpus y publicar los cambios autorizados, verificando producción.
