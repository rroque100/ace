# Buscador documental: plan de implementación

**Objetivo:** implementar los cinco puntos aprobados sobre el buscador existente.
**Arquitectura:** contrato de búsqueda documental separado de la recuperación del chat; catálogo institucional autenticado, búsqueda literal en base de datos, agrupación semántica y filtros comunes. Conservar API de búsqueda anterior para consumidores existentes.
**Tecnologías:** Next.js/React, Supabase Postgres, Pinecone existente, CSS y componentes existentes.

- [x] Revisar catálogo, metadatos y acceso SQL; crear contrato y clasificación pura con pruebas de precedencia y desconocidos.
- [x] Crear consulta literal agrupada con conteo y paginación deterministas, sin acceso a privados; verificar escape y límites.
- [x] Crear API documental autenticada, catálogo de filtros reales y agrupación/paginación semántica con alcance explícito.
- [x] Reorganizar la pantalla con modos, filtros guiados, tarjetas por documento, coincidencias resaltadas y vigencia unificada.
- [x] Verificar errores, filtros, historial y continuidad a chat/PDF; ejecutar pruebas, tipos, lint y compilación.
- [x] Publicar solo el alcance autorizado y comprobar consulta literal, semántica y navegación en producción; guardar evidencia.

## Verificación · 23 de octubre de 2026

57 pruebas aprobadas en diez archivos; tipos y lint aprobados. Compilación local de producción aprobada. Las funciones SQL se aplicaron al proyecto ACE de Control y sus pruebas transaccionales comprobaron exclusión de documentos privados, conteo de fragmentos, continuación desde el quinto fragmento, caracteres literales y permisos de ejecución restringidos. Los documentos sintéticos se revirtieron con rollback.

En producción, «perfeccionamiento del contrato» devolvió 22 documentos distintos en modo literal, cinco páginas al elegir cinco documentos por página y contenidos diferentes en la segunda página. Se desplegaron y cargaron las 15 coincidencias del primer documento. El modo por significado recuperó siete documentos distintos; su conteo se presenta como recuperación, no cobertura exhaustiva. La combinación objeto sin clasificar / ejecución / perfeccionamiento devolvió la opinión esperada. Se comprobó restauración de consulta y modo desde historial y continuidad al chat con documento fijado, sin llevar la pregunta en la URL.

El despliegue inicial 6e8c4b2fc3da55220d04834727f64bfabb31e14d fue Ready. Se preservaron los cambios remotos de chat posteriores (f6f3a6a2d4c3b345730e55770595c8156d18245c); el ajuste final de navegación y nombres de procesos es 92631be32fa6a3eda3598edebc362342c06c0096.

## Límites explícitos

La literalidad se aplica al título y al texto almacenado/indexado, ignorando tildes, mayúsculas y espacios repetidos; no verifica texto que no se haya extraído de un PDF. Las coincidencias cuentan fragmentos, que pueden solaparse. La recuperación semántica está acotada a candidatos y prioriza diversidad, con hasta tres fragmentos por documento. La clasificación sugerida usa títulos y temas registrados y permanece marcada como orientativa; lo desconocido no se completa inventando etiquetas. El catálogo rechaza conteos parciales si supera 2.000 registros: requeriría ampliar esta implementación. La fecha de carga no se usa como fecha de publicación. Estas comprobaciones no miden precisión jurídica.
Vercel confirmó Ready para 92631be32fa6a3eda3598edebc362342c06c0096. Evidencia visual del buscador: .next/piloto-oficial/ace-buscador-documental-final.png. Se conservó la compatibilidad de consultas largas del chat y se distinguió el límite de la frase literal.
