# Etapas 2 y 3: plan de ejecución

**Objetivo:** filtros coherentes, continuidad privada, documentos del caso y observabilidad.
**Arquitectura:** extender el recuperador compartido; reutilizar RLS de conversaciones para historial y adjuntos; bucket privado sin acceso público.

- [x] Crear legal-workspace-filters.ts y probar OR/AND, régimen revisado/desconocido y parámetros antiguos.
- [x] Integrar filtros en Chat/Búsqueda/Normativa y limitar recuperación institucional.
- [x] Crear API y panel plegable de historial de búsqueda usando sesiones owner_id con JWT; restaurar sin query en URL.
- [x] Crear servicio de adjuntos y rutas autenticadas: validar bytes/tamaño, verificar propietario antes de leer/escribir y descargar, almacenar original privado y extracción con estado explícito.
- [x] Integrar selección de adjuntos, referencias C# y contexto de generación; excluir registros de adjuntos del historial conversacional ordinario.
- [x] Registrar y mostrar telemetría efectiva sin claves/contenido privado en auditoría.
- [ ] Ejecutar pruebas significativas, tipos/lint/compilación, publicar y comprobar interfaz y rutas en producción.

No cambiar proveedor/dimensiones de embeddings, no modificar permisos del corpus ni ampliar lectura privada mediante credenciales de servicio. Preservar cambios locales ajenos al alcance.
