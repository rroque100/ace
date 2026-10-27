# Centro Jurídico — plan de ejecución

> Ejecución en esta sesión, en cuatro etapas, sin delegación. Diseño aprobado: `docs/superpowers/specs/2026-10-27-centro-juridico-colecciones-y-trabajo-design.md`.

**Objetivo:** implementar las ocho funciones aprobadas sobre el catálogo, carpetas y Chat existentes.

**Arquitectura:** extracción multiformato con bloques estables; catálogo compartido en servidor; rutas autenticadas para lectura, colecciones y exportación; ampliación de los lectores y guardados actuales.

**Stack:** Next.js/React/TypeScript, Tailwind, Supabase, Pinecone, JSZip y DOCX existentes.

## Restricciones globales

- No inventar páginas, régimen, vigencia ni anexos revisados.
- Conservar originales, huellas y revisiones existentes.
- Usar permisos de usuario en fuentes privadas, carpetas, exportaciones y destinos de trabajo.
- No sustituir plantillas ni modificar procedimientos al vincular fuentes.
- Cada documento pendiente debe terminar habilitado con evidencia o con causa concreta.
- No declarar publicada una modificación local.

## Etapa 1: extracción, categorías y citas

### Tarea 1 — Bloques estables y categorías

Archivos: `lib/source-blocks.ts`, `lib/official-corpus.ts`, `tests/source-blocks.test.ts`.

Interfaz: `extractSourceBlocks(bytes, mime): Promise<SourceBlock[]>`; `SourceBlock={id,label,content,ordinal,kind}`. Los bloques no PDF no contienen páginas.

- [ ] Probar párrafos, encabezados y tablas DOCX con un ZIP de prueba, texto web y rechazo de XML con entidades.
- [ ] Implementar extracción OOXML sin ejecutar recursos externos y segmentación determinista de texto.
- [ ] Añadir categorías y diferenciar norma, criterio, orientación e información.

```ts
expect(blocks.every(block => block.id && block.label && block.content)).toBe(true);
expect(blocks.map(block => block.id)).toEqual((await extractSourceBlocks(bytes, mime)).map(block => block.id));
```

### Tarea 2 — Índice y lectura multiformato

Archivos: `lib/source-indexing.ts`, `app/api/documents/[id]/content/route.ts`, `lib/chat-source-locations.ts`, `lib/legal-chat.ts`, `app/components/pdf-cite-viewer.tsx`, migración `202610270002_legal_library.sql`.

Interfaz: `indexSourceDocument(document, bytes)` para DOCX/texto; API content devuelve formato y bloques comprobando acceso. PDF conserva el procesamiento actual.

- [ ] Guardar fragmentos con `page_start=null`, `page_end=null`, `metadata.locator` y huella del original.
- [ ] Verificar Pinecone antes de publicar `indexedTextComplete=true`; en fallos dejar estado explícito.
- [ ] Ampliar restricciones e índices SQL conservando filtros existentes.
- [ ] Hacer que lectores/citas usen página PDF o localizador registrado.
- [ ] Ejecutar importación de los 48 registros y guardar resultados individuales.

## Etapa 2: catálogo y bases

### Tarea 3 — Colecciones y novedades

Archivos: `lib/library-workspace.ts`, `app/api/library/route.ts`, `app/components/library-workspace.tsx`, integración en `app/normas/page.tsx` y Búsqueda.

Interfaz: catálogo paginado con vista `collections|templates|news`, filtros `collection`, `contractingEntity`, `ruc`, procedimiento y objeto; fechas de publicación y carga separadas.

- [ ] Probar asignación temática revisada/propuesta y validación RUC.
- [ ] Consultar y contar en servidor; devolver errores explícitos.
- [ ] Construir navegación responsive con accesos a RNP, SEACE, obras, garantías, arbitraje y sanciones.
- [ ] Mostrar bases DOCX con procedencia, versión, descarga original y lector de bloques.

### Tarea 4 — Vincular originales al trabajo

Archivos: `app/api/library/work-links/route.ts`, `app/components/source-work-link.tsx`, migración de vínculos personales.

- [ ] Validar documento y destino con JWT del usuario.
- [ ] Guardar instantánea con versión, huella y procedencia; no modificar el destino.
- [ ] Reutilizar selección de destino de las notas existentes.
- [ ] Probar rechazo de fuente/destino ajenos y datos inválidos.

## Etapa 3: carpetas y exportación

### Tarea 5 — Ampliar carpetas y guardados

Archivos: `app/api/folders/route.ts`, `app/api/saved/route.ts`, `app/components/saved-workspace.tsx`, `app/components/save-button.tsx`, `lib/source-dossier.ts`.

- [ ] Validar UUID en PATCH/DELETE y comprobar fuente/carpeta en servidor.
- [ ] Guardar versión y localizador desde la fuente registrada; admitir pasajes.
- [ ] Crear/renombrar carpetas, mover elementos, conservar notas y seleccionar fuentes.
- [ ] Abrir selección en Chat conservando todas las fuentes o mostrar un límite explícito.

### Tarea 6 — Exportación DOCX y CSV

Archivos: `app/api/saved/export/route.ts`, `lib/source-dossier.ts`, `tests/source-dossier.test.ts`.

- [ ] Reconsultar permisos y fuentes por cada elemento exportado.
- [ ] Preparar vista previa de títulos, versiones, localizadores, enlaces y revisión.
- [ ] Generar DOCX/CSV sin fórmulas activas; separar texto original, nota personal y contenido asistido.
- [ ] Probar carpetas ajenas, selección vacía y neutralización de fórmulas.

## Etapa 4: lectura y Chat

### Tarea 7 — Acciones y seguimientos

Archivos: `app/components/legal-chat.tsx`, `app/components/normative-browser.tsx`, `app/components/pdf-cite-viewer.tsx`, `lib/chat-experience.ts`.

- [ ] Mostrar alcance de fuentes y versión junto al lector.
- [ ] Abrir página o bloque citado sin perder la conversación.
- [ ] Guardar pasaje y vincular una referencia al trabajo desde el lector.
- [ ] Probar sugerencias por documento/tipo y datos faltantes sin introducir conclusiones no comprobadas.

### Tarea 8 — Comprobación y entrega

- [ ] Ejecutar pruebas específicas de formatos, permisos, filtros, citas y exportación.
- [ ] Ejecutar `npm run typecheck` y build con los cambios integrados.
- [ ] Aplicar migraciones e indexar con reporte individual.
- [ ] Comprobar escritorio y viewport móvil en navegador, incluyendo teclado y estados de fallo.
- [ ] Registrar evidencia, archivos cambiados, pruebas, migración e indexación; separar estado local de publicación.

Comprobación previa: `npm run typecheck` pasó antes de modificar código.
