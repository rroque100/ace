# Buscador profesional — plan de implementación

Diseño: docs/superpowers/specs/2026-10-23-buscador-profesional-design.md. Ejecución en esta sesión según instrucción expresa del usuario.

- [x] Metadata común: entidad, fechas diferenciadas, identidad/versiones; integrar API de catálogo, resultados, Normativa y fuente del Chat. No alterar vigencia registrada.
- [x] Motor: modo all_words intersectando búsquedas literales institucionales; reconocimiento de número/artículo; orden por pertinencia de título/pasaje; límites visibles. Pruebas con documentos sintéticos e IDs institucionales restringidos.
- [x] Continuidad: serializador validado, caducidad y almacenamiento por usuario; reejecutar y restaurar página/scroll al volver sin exponer texto en URL. Historial compatible.
- [x] UX: filtros principales Tipo/Régimen/Fecha, panel avanzado móvil Aplicar/Restablecer, chips, snippets compactos, PDF integrado existente, selección y alcance explícito al Chat. Mantener controles accesibles.
- [x] Cobertura: resumen de categorías indexadas y fechas conocidas; reanudar documentos oficiales seleccionados que puedan validarse; registrar límites de archivos pendientes.
- [x] Verificación: pruebas de búsqueda, aislamiento, handoff, chat y metadatos; TypeScript, lint, compilación y navegador. Publicar solo cambios autorizados conservando trabajo local ajeno.

Validación: 148 pruebas aprobadas; TypeScript, lint y compilación de producción sin errores. Prueba real de números y artículos, todas las palabras, selección exclusiva de dos fuentes y restauración desde Chat. La revisión de pantalla detectó y corrigió comparación del estado restaurado y ancho del PDF. El panel móvil se implementó con Aplicar/Restablecer, foco y Escape; el cambio de viewport del navegador de prueba no tuvo efecto, por lo que falta verificación en dispositivo real.
