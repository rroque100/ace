# Implementación de revisión de vigencia

1. Crear esquema compartido y presentación de revisiones, separando documento y artículos, registro y resultado.
2. Crear historial inmutable y operación atómica restringida a servicio, con comprobación de roles, versión y concurrencia; invalidación ante cambios de archivo/versión/estructura.
3. Crear API autenticada de lectura y registro, historial paginado y errores explícitos.
4. Integrar formulario, estado e historial en Normativa; propagar metadatos a Búsqueda y fuentes del Chat sin cambiar respuestas históricas.
5. Probar permisos, validación, alcance, conflictos, invalidación y presentación; tipos, lint y compilación.
6. Aplicar migración, verificar con transacciones revertidas, commit/push y publicación; comprobación visual sin declarar vigencia de documentos no revisados.

Comprobación previa a publicar: 138 pruebas correctas; tipos, lint y compilación correctos. Prueba SQL con rol de servicio y autenticado: registro, conflictos, ámbito por artículos, sincronización del índice, invalidación e historial inmutable comprobados con rollback. Cero revisiones reales creadas por las pruebas.
