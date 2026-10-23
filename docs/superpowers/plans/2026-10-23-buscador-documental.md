# Buscador documental: plan de implementación

**Objetivo:** implementar los cinco puntos aprobados sobre el buscador existente.
**Arquitectura:** contrato de búsqueda documental separado de la recuperación del chat; catálogo institucional autenticado, búsqueda literal en base de datos, agrupación semántica y filtros comunes. Conservar API de búsqueda anterior para consumidores existentes.
**Tecnologías:** Next.js/React, Supabase Postgres, Pinecone existente, CSS y componentes existentes.

- [ ] Revisar catálogo, metadatos y acceso SQL; crear contrato y clasificación pura con pruebas de precedencia y desconocidos.
- [ ] Crear consulta literal agrupada con conteo y paginación deterministas, sin acceso a privados; verificar escape y límites.
- [ ] Crear API documental autenticada, catálogo de filtros reales y agrupación/paginación semántica con alcance explícito.
- [ ] Reorganizar la pantalla con modos, filtros guiados, tarjetas por documento, coincidencias resaltadas y vigencia unificada.
- [ ] Verificar errores, filtros, historial y continuidad a chat/PDF; ejecutar pruebas, tipos, lint y compilación.
- [ ] Publicar solo el alcance autorizado y comprobar consulta literal, semántica y navegación en producción; guardar evidencia.
