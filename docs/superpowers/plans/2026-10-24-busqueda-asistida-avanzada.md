# Plan de búsqueda asistida avanzada

**Objetivo:** ejecutar el diseño explícitamente solicitado, en esta sesión.

- [x] Añadir vocabulario y candidatos filtrados al índice, conservando permisos de servicio.
- [x] Implementar normalización de referencias y correcciones conservadoras con pruebas.
- [x] Combinar recuperación por palabras/significado con degradación parcial visible.
- [x] Añadir sugerencias cancelables, conteos y acciones claras a la interfaz existente.
- [x] Crear evaluador repetible y conjunto documental con revisión humana pendiente.
- [x] Validar pruebas, tipos, compilación y migración; publicar y revisar interfaz.

Archivos: lib/search-discovery.ts, lib/document-search-server.ts, app/api/search/suggestions/route.ts, app/components/search-discovery.tsx, app/components/document-search-workspace.tsx, supabase/migrations/202610240002_search_discovery.sql y pruebas/evaluador relacionados.

Publicación y revisión visual: se realizan después de validar las pruebas y antes de cerrar la entrega.
