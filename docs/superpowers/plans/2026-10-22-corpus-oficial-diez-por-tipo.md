# Corpus oficial por categorías — Implementation Plan

> Ejecución en esta sesión, por unidades verificables. Diseño aprobado por el usuario el 22/10/2026. Se conserva el trabajo local existente y se publican únicamente archivos de esta adaptación.

**Goal:** Adaptar ACE a diez categorías y comenzar un lote oficial de hasta diez documentos distintos por categoría, reutilizando las diez opiniones comprobadas.

**Architecture:** Un catálogo compartido alimenta validación, filtros y selección de fuentes. Un importador administrativo valida un manifiesto, descarga archivos oficiales y reutiliza el procesador PDF existente; los resultados y reintentos permanecen en un manifiesto local e informe público sin secretos.

**Tech Stack:** TypeScript, Next.js, Supabase, Storage privado, Google embeddings y Pinecone existentes.

## Global Constraints

- No material editorial privado de LEX ni documentos ajenos para completar cuotas.
- No duplicar corpus, cambiar modelos de embeddings, namespaces o permisos de archivos.
- Identidad documental y procedencia validadas prevalecen sobre inferencias de IA.
- Vigencia desconocida mientras legalReviewStatus sea pendiente.
- PDFs máximos de 50 MiB, HTTPS y destinos oficiales validados en cada redirección.
- No declarar completadas categorías con menos de diez documentos pertinentes comprobados.

## Task 1: Taxonomía y uso de fuentes

**Files:** lib/official-corpus.ts; lib/documents.ts; lib/legal-taxonomy.ts; lib/legal-chat.ts; lib/pdf-processing.ts; tests/official-corpus.test.ts.

**Interface:** OFFICIAL_CORPUS_TYPES contiene diez códigos, etiquetas y grupos; corpusSourceKind(type) devuelve norma, criterio u orientacion. Los tipos antiguos siguen aceptados. Directivas admiten alcance general explícito; bases estándar requieren un procedimiento.

- [ ] Probar códigos nuevos, compatibilidad con bases_integradas y distinción entre norma y orientación.
- [ ] Implementar catálogo compartido y conectarlo a tipos y metadatos del procesador.
- [ ] Ampliar la selección del chat sin que una fuente de orientación satisfaga la cobertura crítica de ley/reglamento.
- [ ] Ejecutar `npm test -- tests/official-corpus.test.ts tests/documents.test.ts tests/pdf-document-metadata.test.ts` y `npm run typecheck`.

## Task 2: Navegador y filtros

**Files:** app/api/norms/route.ts; app/api/norms/[id]/route.ts; app/components/normative-browser.tsx; app/components/semantic-search.tsx.

**Interface:** Grupos normas, jurisprudencia y orientacion usan el catálogo compartido; todas las categorías son seleccionables. Opiniones/guías/resoluciones sin artículos conservan resumen, páginas y PDF.

- [ ] Sustituir listas parciales de tipos por categorías compartidas.
- [ ] Mantener las rutas y consultas existentes; extender category=orientacion.
- [ ] Verificar que calidad de indexación usa fragmentos, páginas y Pinecone para documentos sin artículos.
- [ ] Ejecutar comprobación de tipos y pruebas del navegador documental existentes.

## Task 3: Importador oficial reanudable

**Files:** lib/official-import/download.ts; scripts/import-corpus-oficial.ts; tests/official-import.test.ts; docs/importaciones/corpus-oficial-2026-10-22.json.

**Interface:** downloadOfficialPdf(url) valida HTTPS, host oficial, redirecciones, timeout y 50 MiB; run sin --apply prepara/valida sin escribir. --apply inserta solo identidades y huellas no presentes, procesa secuencialmente y verifica recuperación.

- [ ] Probar que localhost, IP literal, credenciales en URL, host parecido al oficial y archivos no PDF son rechazados.
- [ ] Implementar descarga con stream limitado y redirects manuales; SHA-256 de bytes almacenados.
- [ ] Revisar esquema remoto de documents antes de insertar nuevos tipos.
- [ ] Preparar manifiesto desde publicaciones oficiales; registrar faltantes, formatos incompatibles y duplicados.
- [ ] Procesar primero un candidato de cada tipo nuevo y comprobar sus metadatos y recuperación antes de ampliar a diez.

## Task 4: Publicación y comprobación

**Files:** docs/importaciones/corpus-oficial-2026-10-22.md y manifiesto público del lote.

- [ ] Ejecutar pruebas afectadas y typecheck; comprobar el diff de publicación frente a 663ecd3.
- [ ] Crear commit con índice separado, preservando el índice y los cambios locales del usuario; push normal a rroque100/ace main.
- [ ] Comprobar despliegue Ready, catálogo con sesión iniciada y una búsqueda por categoría importada.
- [ ] Informar metas, reutilizados, indexados, fallidos y faltantes, sin equiparar inicio de lote a cien documentos completados.
