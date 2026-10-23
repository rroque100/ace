# Centro Jurídico: implementación por etapas

**Objetivo:** aplicar el diseño aprobado tras el análisis de LEX, con entregas independientes y comprobables.

**Arquitectura:** conservar el recuperador compartido de Chat y Búsqueda. Resolver identidades documentales en el catálogo institucional antes de expandir semánticamente. Mantener separados los documentos oficiales y los adjuntos privados.

**Restricciones:** no cambiar proveedor ni dimensiones de embeddings; no inferir vigencia o régimen por año; no publicar secretos; preservar cambios locales ajenos; no atribuir precisión jurídica a una métrica de recuperación.

## Etapa 1: original exacto y respuesta comprobable

- [x] Crear `lib/legal-document-reference.ts`: detectar tipo y número/año; comparar identidad del documento, nunca su contenido incidental. Probar ceros iniciales, tipos distintos y referencias múltiples.
- [x] Integrar consulta institucional de catálogo y fragmentos en `lib/legal-chat.ts`. Priorizar originales y distinguir menciones indirectas. Si falla el catálogo, informar indisponibilidad sin afirmar ausencia.
- [x] Recuperar historial autorizado antes de resolver preguntas de continuación. Mantenerlo fuera de URLs y de sesiones ajenas.
- [x] Validar rangos contra `metadata.pageCount`; distinguir ubicación registrada de rango comprobado. Probar páginas negativas, invertidas y fuera del PDF.
- [x] Ejecutar pruebas de recuperación y generación, tipos y revisión del cambio antes de publicar esta etapa.

## Etapa 2: filtros y continuidad

- [x] Incorporar filtros independientes de régimen, entidad, tipo y año, con valores desconocidos explícitos. No filtrar vectores por metadatos inexistentes.
- [x] Añadir historial recuperable de búsquedas con autenticación y aislamiento por usuario, conservando consulta y filtros.
- [x] Comprobar restauración, navegación entre respuesta/fuente/PDF y compatibilidad con conversaciones anteriores.

## Etapa 3: documentos privados y observabilidad

- [x] Diseñar almacenamiento de adjuntos por propietario y conversación con RLS y rutas autenticadas; comprobar accesos cruzados antes de habilitar carga.
- [x] Procesar PDF e imágenes con estados completos/parciales explícitos, sin introducirlos en el corpus institucional.
- [x] Registrar proveedor/modelo efectivo, versión de instrucciones, recuperación y tiempos, sin contenido privado en registros generales.
- [x] Validar límites, fallos de extracción y respuesta con fuentes oficiales frente a documentos del caso; publicar solo después de pruebas.

Cada etapa se cierra con un cambio independiente y un informe de lo efectivamente comprobado. Las etapas pendientes no se presentan como disponibles en producción.

### Verificación de etapa 1

45 pruebas en ocho archivos, tipos y lint aprobados. Compilación local de producción aprobada; advertencia preexistente de empaquetado de `pdfjs-dist`. Commit inicial: `2c4e87025013acb9a0b575023e0985faf14de1b9`.

Límites: la identidad automática reconoce leyes, opiniones, acuerdos de Sala Plena, resoluciones, directivas y pronunciamientos con numeración explícita. El catálogo limita cada tipo a 201 registros y declara comprobación incompleta si excede 200; no afirma ausencia global. Un rango válido solo comprueba localización contra el total registrado, no fidelidad semántica ni aplicabilidad jurídica. La evaluación jurídica con casos de referencia continúa pendiente.

Prueba real en producción: el original 003-2025/TCP se mostró primero y el chat añadió páginas registradas y límites, sin declarar vigencia confirmada. La prueba detectó citas agrupadas; se añadió lectura de todos sus identificadores y una regresión específica.


### Verificación de etapas 2 y 3

Implementación y comprobaciones registradas en [el plan de ejecución](2026-10-22-centro-juridico-etapas-2-3.md). Los filtros de entidad existentes se conservan; se añaden régimen revisado, varios tipos y años. No se ha medido precisión jurídica.
