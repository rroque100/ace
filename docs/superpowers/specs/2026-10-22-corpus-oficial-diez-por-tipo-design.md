# Corpus oficial: diez documentos por categoría

Fecha: 22 de octubre de 2026, Lima.
Estado: aprobado por el usuario el 22 de octubre de 2026; adaptación y lote inicial en ejecución.

## Objetivo y alcance

Preparar ACE para incorporar un lote de hasta cien documentos oficiales relacionados con contratación pública: diez por cada una de las diez categorías siguientes. Las diez opiniones del piloto completan la cuota de opiniones y no se descargarán otra vez. Los documentos existentes solo cuentan para las demás cuotas después de comprobar su identidad y procedencia oficial.

| Categoría visible | Código documental | Meta | Tratamiento en consultas |
|---|---|---:|---|
| Leyes | ley | 10 | Fuente normativa, con régimen y revisión explícitos |
| Reglamentos | reglamento | 10 | Fuente normativa; modificaciones y versiones relacionadas |
| Directivas | directiva | 10 | Fuente normativa con alcance identificado, sin inventar un procedimiento |
| Opiniones | opinion | 10 | Criterio interpretativo, identificando documento y páginas |
| Resoluciones del Tribunal | resolucion | 10 | Criterio del caso, sin asumir aplicación general |
| Acuerdos de Sala Plena | acuerdo_sala_plena | 10 | Acuerdo identificado; obligatoriedad no inferida por el tipo |
| Pronunciamientos | pronunciamiento | 10 | Documento referido a un procedimiento, sin generalizar su alcance |
| Informes de vicios de nulidad | informe_vicio_nulidad | 10 | Documento referido a su caso y contexto |
| Bases estándar | bases_estandar | 10 | Modelo operativo, diferenciado de las bases integradas de una entidad |
| Guías e instructivos | guia_instructivo | 10 | Orientación práctica, sin reemplazar el fundamento normativo |

La meta es un máximo de diez documentos distintos por categoría. No se completarán cuotas con duplicados, normas ajenas a contratación pública, ni diez copias del mismo texto. Si faltan PDF oficiales pertinentes, el lote informará la cantidad conseguida y la faltante. Las leyes o reglamentos históricos se identificarán como tales; no se mezclarán sus reglas con el régimen seleccionado en la consulta.

## Enfoques considerados

1. **Importador controlado de fuentes oficiales — recomendado.** Un catálogo revisable de publicaciones y archivos permite descargar, reanudar, detectar duplicados y auditar cada resultado. Requiere adaptar las categorías y el uso de fuentes por IA una sola vez.
2. **Carga manual por categoría.** Aprovecha el formulario existente, pero exige repetir comprobaciones, no deja un manifiesto de descarga reproducible y dificulta reintentar lotes sin duplicación.

Se propone el primer enfoque, reutilizando Storage, documents, el procesador de PDF y Pinecone existentes. No se creará un segundo corpus ni otro proveedor de embeddings.

## Estado comprobado de ACE

- Producción: ace-rormi.vercel.app, Supabase medmcaiskvtbckpakseo.
- Inventario al preparar esta propuesta: 57 documentos; 12 opiniones, 2 leyes, 1 reglamento, 1 resolución, 1 directiva y 40 clasificados como bases integradas. Dos de estas últimas están en error.
- Diez opiniones del lote oece-oficial-2026-10-22 tienen publicación oficial, SHA-256, PDF íntegro, indexación completa y comprobación en Pinecone.
- Las etiquetas actuales no prueban la procedencia o el contenido: los cuarenta registros de bases integradas no se contarán automáticamente como bases estándar.
- El endpoint /api/documents/import es una propuesta de integración Drive/S3: responde planned=true, no realiza una importación real.
- La taxonomía, los filtros de búsqueda y la selección de fuentes del chat no incluyen todavía todas las categorías propuestas.
- El formulario exige un proceso específico a toda directiva, lo que impide representar correctamente directivas transversales.
- Google/Gemini y Pinecone ya están configurados de forma coincidente en producción. Se conservarán los modelos, dimensiones y namespaces actuales.

## Selección y procedencia

Fuentes: publicaciones oficiales de OECE/OSCE, MEF, Congreso y El Peruano. La descarga utiliza el enlace de archivo que figura en la publicación oficial; no se accede a material editorial privado de LEX.

Cada candidato del manifiesto incluirá: categoría, título, número cuando exista, entidad, URL de publicación, URL del PDF, fecha cuando conste, régimen verificado o no determinado, procedimiento específico o alcance general documentado, estado de selección y motivo de exclusión si corresponde.

Catálogos de partida comprobados:

- https://www.gob.pe/institucion/oece/colecciones/66839-opiniones-de-la-direccion-tecnico-normativa-oece
- https://www.gob.pe/institucion/oece/colecciones/45029-ley-n-32069-ley-general-de
- https://www.gob.pe/institucion/mef/colecciones/66745-normas-expedidas-en-el-marco-de-la-ley-n-32069
- https://www.gob.pe/institucion/mef/normas-legales/7614342-001-2026-ef-54-02
- https://www.gob.pe/14269-acceder-al-buscador-de-pronunciamientos-y-resoluciones-del-tcp-del-oece
- https://www.gob.pe/institucion/oece/normas-legales/tipos

Solo se indexan PDF auténticos con texto legible o extracción OCR completa. Cuando una publicación ofrezca únicamente DOCX, el candidato quedará identificado como formato no compatible con este lote; no se presentará una conversión como un PDF oficial. Los anexos se conservarán relacionados con su publicación, pero no se usarán para inflar la cuota del mismo documento.

## Descarga e importación

El importador tendrá dos operaciones separadas: preparar/validar el manifiesto sin escribir en producción, y aplicar un lote validado. Se ejecutará como trabajo administrativo fuera de una petición larga de Vercel, usando credenciales de servidor que no se enviarán al navegador.

Flujo: publicación oficial → PDF descargado → validación de tipo y tamaño → SHA-256 y comparación con corpus → Storage privado → documents → procesador existente → fragmentos de Supabase y Pinecone → comprobación de recuperación.

Se descargará y procesará un documento a la vez. Cada archivo tendrá tiempo límite, comprobación de respuesta HTTP, cabecera PDF, tamaño máximo de 50 MiB y registro de resultado. Se admitirán únicamente los dominios oficiales del manifiesto; cada redirección se validará antes de seguirla, rechazando destinos privados y esquemas distintos de HTTPS.

Cada documento guardará sourceUrl, officialPublicationUrl, sha256, importBatch, importedAt, categoría, título y número verificados, año de publicación si consta, régimen y alcance cuando estén sustentados, legalReviewStatus=pendiente y vigencia=desconocida. La IA no reemplazará estos datos de identidad o procedencia validados.

La deduplicación comprobará SHA-256 y la identidad categoría/número/entidad/versión. El texto idéntico en otro enlace se reutiliza; una modificación real conserva relación con su versión anterior. No se borran documentos existentes para completar cuotas. Un error individual no detiene los restantes y queda disponible para reintento por identificador. La reanudación de un lote no crea nuevas filas, PDF ni vectores para elementos ya completados.

## Adaptación de ACE

La taxonomía compartida incorporará las cinco categorías que faltan, conservando los códigos y registros anteriores, incluidos bases_integradas, contrato y expediente. Se comprobarán las restricciones de la base antes de ampliar tipos; las consultas, facetas, formularios y etiquetas consumirán el mismo catálogo.

El navegador documental mostrará grupos comprensibles: normas; criterios y decisiones; bases y orientación. Los filtros permitirán distinguir las diez categorías y abrir su PDF, resumen y referencias de página. No se exigirá segmentación por artículos a una guía, opinión o resolución para considerarla indexada correctamente.

Las directivas podrán tener alcance general cuando así lo indique la fuente. No se atribuirá un proceso concreto para superar la validación del formulario. Las bases estándar conservarán el procedimiento al que realmente corresponden.

Buscar recuperará todos los tipos. Consultas con IA podrá utilizar las nuevas categorías, mostrando qué clase de fuente sustenta cada afirmación. La evaluación de suficiencia no contará una guía, una base, un pronunciamiento o una resolución individual como sustituto automático de la ley o del reglamento que exige una consulta. No se declarará obligatoriedad, vigencia ni alcance general solo por el nombre de la categoría.

No se incluirán noticias, eventos, vídeos, material de formación exclusivo ni contenido editorial de LEX en este lote.

## Unidades de implementación

1. Catálogo compartido y compatibilidad: lib/documents.ts, lib/legal-taxonomy.ts y las restricciones pertinentes de Supabase; pruebas de conservación de tipos existentes y clasificación de las diez categorías.
2. Importador administrativo: scripts/import-corpus-oficial.ts y lib/official-import/, con manifiesto persistente, validación de origen, deduplicación, reanudación y reutilización del procesador actual.
3. Integración del corpus: lib/pdf-processing.ts, lib/legal-chat.ts y lib/procedure-catalog.ts, para conservar identidad, alcance y clase de evidencia sin alterar reglas sustantivas de contratación.
4. Navegador y filtros: app/api/norms/, app/api/facets/, app/components/normative-browser.tsx y app/components/semantic-search.tsx; las nuevas categorías serán seleccionables y sus fuentes consultables.
5. Preparación del lote y verificación: docs/importaciones/, con inventario de candidatos, cobertura por categoría, bytes previstos, exclusiones y prueba de recuperación antes de aplicar el lote completo.

## Comprobaciones de aceptación

- Diez categorías seleccionables de manera coherente en catálogo, búsqueda y consultas.
- La ley, el reglamento y los documentos privados existentes permanecen accesibles con sus permisos actuales.
- Una simulación no escribe en Supabase ni Pinecone; aplicar dos veces el mismo manifiesto no duplica documentos.
- PDF inválido, destino de red no autorizado, exceso de tamaño o extracción parcial quedan excluidos del corpus utilizable.
- Un documento no pasa a indexed hasta verificar texto, páginas y recuperación real en Pinecone.
- El lote muestra por categoría: meta, candidatos aprobados, reutilizados, descargados, indexados, fallidos y faltantes.
- Se verifica al menos una búsqueda de cada categoría que tenga documentos aprobados y una respuesta con citas para cada nueva clase de evidencia.
- El número de páginas se calcula a partir de páginas distintas; no se confunde con el número de fragmentos.
- No aparecen claves, tokens, respaldos ni archivos privados en el repositorio o en los informes del lote.

## Límites de esta preparación

Esta propuesta deja definido un primer lote controlado y su adaptación al producto. No crea una sincronización periódica ni promete cien documentos antes de revisar su disponibilidad y pertinencia. La selección de documentos no equivale a una revisión jurídica integral de su vigencia.
