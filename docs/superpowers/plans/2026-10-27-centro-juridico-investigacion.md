# Investigación jurídica — plan de implementación

**Objetivo:** ejecutar en esta sesión las tres entregas aprobadas, reutilizando catálogo, Chat, carpetas y cadena de importación.
**Arquitectura:** migraciones aditivas, servicios autenticados, componentes Tailwind pequeños y contratos compartidos; ejecución directa sin delegación.
**Stack:** Next.js, TypeScript, Supabase/Postgres/RLS, Pinecone, DOCX.

## Restricciones

No inventar entidades verificadas, RUC, páginas, vigencia ni cobertura. Separar roles y revisiones. Conectores solo oficiales con límites y candidatos pendientes. Seguimiento personal dentro de ACE. Conservar cambios ajenos. Cada entrega se registra como implementada/migrada/poblada/probada/publicada por separado.

## A. Directorio y fichas

- [ ] Crear `lib/entity-directory.ts`: `entityQuerySchema`, `entityReviewSchema`, `isValidRuc`, y `lib/document-facts.ts`: `documentFacts(document)` con campos específicos por tipo.
- [ ] Probar en `tests/entity-directory.test.ts`: `expect(isValidRuc('20288774553')).toBe(true)` y rechazo de dígito alterado, roles separados y procedencia obligatoria al verificar.
- [ ] Migración `202610270004_legal_research.sql`: entidades, vínculos documentales por rol, revisiones con actor/fecha; lectura institucional y escritura administrativa a través de rutas autenticadas.
- [ ] `app/api/library/entities/route.ts`: GET consulta normalizada con límite 10 y rango; PATCH administrativa con evidencia y auditoría, POST asociación validada por UUID y rol. SQL de búsqueda solo institucional, paginado con conteos independientes.
- [ ] `EntityPicker` accesible con campo, resultados, anterior/siguiente y estado detectado/verificado; usar en filtros de biblioteca, Búsqueda y Normativa sin deducir RUC.
- [ ] `DocumentFacts` en tarjetas y lector. Sembrar solo nombres detectados con evidencia de metadatos; no llamarlos verificados.

## B. Lector y carpetas de investigación

- [ ] `lib/guided-reading.ts`: acciones y URL de traspaso; validar documento/version/localizador en servidor antes de preparar pregunta.
- [ ] `app/api/library/guide/route.ts`: POST autenticada carga fuente y fragmento real, rechaza localizador ajeno o hash cambiado. Devuelve destino de Chat con documento inicial y alcance; no genera una segunda respuesta.
- [ ] Componente `GuidedReading` en PDF/bloques y ficha; contexto visible y ampliación explícita. Prueba: un bloque sin página conserva `locator`, nunca página 1.
- [ ] Ampliar `carpetas` con pregunta/objetivo/estado/notas sin romper nombre existente; validar permisos en PATCH/GET/exportación. `ResearchBrief` permite editar y abrir fuentes actuales en Chat.
- [ ] Reutilizar `saved/export` para informe con contexto de investigación autorizado. DOCX y CSV mantienen separación original/nota/respuesta, control de huella y permisos.

## C. Seguimiento y actualización

- [ ] Tablas personales seguimiento/eventos; tablas administrativas fuentes/ejecuciones/candidatos. Políticas por propietario y rutas sin acceso anónimo.
- [ ] `lib/library-updates.ts`: URL oficial, deduplicación, estados y eventos; `app/api/library/updates/route.ts` GET/POST/PATCH con administración. POST ejecuta una fuente registrada, acepta solo HTTPS oficial, sin redirecciones y con tope de bytes/tiempo. Detectar enlaces y conservar evidencia; no indexar candidatos automáticamente.
- [ ] Conectar aprobación de candidatos con cadena existente de importación y comprobación; registrar anexos pendientes. Nueva versión conserva original, no lo sobrescribe.
- [ ] `app/api/library/follows/route.ts`: seguir documento o consulta normalizada, pausar, borrar, marcar leído; eventos deduplicados al aceptar publicaciones. Componente discreto `FollowSource` y bandeja en Novedades/Guardados.
- [ ] Preparar ejecución manual y servicio invocable; sin activar frecuencia automática ni correo.

## C. Laudos

- [ ] Añadir `laudo_arbitral` en tipos compartidos, SQL y filtros. `documentFacts` muestra partes/árbitros/pretensiones con estado.
- [ ] Buscar hasta cinco originales oficiales accesibles; generar manifiesto con SHA y URL; usar importador existente y comprobar páginas/indexación. Si no hay originales válidos, registrar impedimento y mostrar cobertura vacía.

## Pruebas y entrega

- [ ] Ejecutar pruebas de directorio, fichas, guía, permisos, investigación, seguimiento, actualizaciones y laudos. Reutilizar `tests/library-routes.test.ts` y añadir casos de acceso cruzado y candidatos incompletos.
- [ ] `npm run typecheck`; build en directorio aislado. Revisar escritorio y viewport móvil en navegador autenticado, fuentes/citas, navegación y fallos explícitos.
- [ ] Aplicar migración al proyecto autorizado, poblar registros detectados, verificar lectura y permisos. Guardar auditoría sin secretos.
- [ ] Publicar con Vercel y comprobar READY, alias y recorridos; no mezclar precisión jurídica o teléfono físico con pruebas de software.
