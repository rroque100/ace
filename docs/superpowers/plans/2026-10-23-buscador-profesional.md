# Buscador profesional — plan de implementación

Diseño: docs/superpowers/specs/2026-10-23-buscador-profesional-design.md. Ejecución en esta sesión según instrucción expresa del usuario.

- [ ] Metadata común: entidad, fechas diferenciadas, identidad/versiones; integrar API de catálogo, resultados, Normativa y fuente del Chat. No alterar vigencia registrada.
- [ ] Motor: modo all_words intersectando búsquedas literales institucionales; reconocimiento de número/artículo; orden por pertinencia de título/pasaje; límites visibles. Pruebas con documentos sintéticos e IDs institucionales restringidos.
- [ ] Continuidad: serializador validado, caducidad y almacenamiento por usuario; reejecutar y restaurar página/scroll al volver sin exponer texto en URL. Historial compatible.
- [ ] UX: filtros principales Tipo/Régimen/Fecha, panel avanzado móvil Aplicar/Restablecer, chips, snippets compactos, PDF integrado existente, selección y alcance explícito al Chat. Mantener controles accesibles.
- [ ] Cobertura: resumen de categorías indexadas y fechas conocidas; reanudar documentos oficiales seleccionados que puedan validarse; registrar límites de archivos pendientes.
- [ ] Verificación: pruebas de búsqueda, aislamiento, handoff, chat y metadatos; TypeScript, lint, compilación y navegador. Publicar solo cambios autorizados conservando trabajo local ajeno.
