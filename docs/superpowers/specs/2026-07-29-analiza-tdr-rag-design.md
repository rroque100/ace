# Analiza TDR — gestión del RAG del EETT/TDR + saneo del botón «Revisar TDR» — Diseño

**Fecha:** 2026-07-29
**Módulo:** 1 · Necesidad · Ficha del requerimiento · Sección 3.4 Términos de referencia
**Estado:** aprobado (diseño).

## Problema

Al subir un EETT/TDR a una necesidad se indexa en RAG (`documents` + `document_chunks`
+ Pinecone, namespace `legal-documents`), pero esa indexación es **opaca**:

1. No hay UI que muestre el **estado** de indexación (`uploaded/processing/indexed/error`),
   los errores, ni los metadatos del pipeline (método OCR vs texto, OCR parcial, páginas,
   nº de chunks, `recordCount`, namespace, `indexedTextComplete`, `contentHash`).
2. No se puede **ver los fragmentos** indexados ni el texto extraído.
3. No se puede **reindexar** manualmente desde la ficha.
4. No se puede **probar la recuperación**: comprobar que el RAG responde sobre ese TDR.
5. El flujo de revisión/generación del TDR **ni siquiera lee** esa indexación de vuelta
   (usa el texto OCR cacheado en `metadata.textoExtraido`).

Además, el botón actual de sección **«Revisar TDR — subir y gestionar el PDF»**
(`app/components/necesidad/ficha-editable.tsx:567`) arrastra tres defectos:

- **(1) Botón muerto sin permisos**: se pinta siempre, pero el `Dialog` que abre está
  tras `permisos.manage ?` (`necesidad-detail.tsx:1899`). Un usuario sin `manage` lo
  pulsa y no ocurre nada.
- **(3) Inconsistencia de formato**: el modal acepta **solo PDF**
  (`accept="application/pdf,.pdf"`, `necesidad-detail.tsx:1915`), mientras el campo
  inline `NecesidadEettCampo` acepta **PDF y .docx** (`necesidad-eett-campo.tsx:77`),
  pese a llamar al mismo endpoint (que ya admite `.docx` vía `leerDocx`).
- **(5) Solapamiento de modales al subir**: `subirEett` abre `eettModal` **sin cerrar**
  `gestionTdrAbierta` (`necesidad-detail.tsx:898`); el botón «Revisar / editar» sí lo
  cierra (`:1942`). La subida deja dos modales apilados.

## Decisiones (del usuario)

- **Nuevo modal «Analiza»**: inspección del RAG + reindexar + consulta de prueba.
  Ventana **modal aparte y grande**, independiente del modal de revisión existente.
- **Reindexar** = re-encolar asíncrono (`after()`→`processPdfForSearch`) + polling del
  estado dentro del modal. Igual que `POST /api/documents/[id]`.
- **Permisos** = `permisos.manage` para ver el botón y para reindexar (coincide con el
  campo inline hoy, `campo-ficha.tsx:297` con `puedeGestionar={permisos.manage}`).
- **Botón «Analiza» por documento** dentro del modal de gestión «Revisar TDR»
  (`Dialog` `gestionTdrAbierta`, `necesidad-detail.tsx:1933-1949`), al lado del botón
  «Revisar / editar». Abre una **nueva ventana modal** «Analiza» que gestiona el RAG
  del PDF subido. (No a nivel de sección ni en el campo inline.)
- **Consulta de prueba filtrada al documento** (`documentId`, `topK=8`).
- **Saneo del botón «Revisar TDR»** (puntos 1, 3 y 5) **como parte del trabajo**. El
  punto 2 (redundancia con el campo inline) queda fuera por decisión: conviven. El
  punto 4 (selectores de tipo sin sincronizar) se arregla de paso al tocar el modal.

## Alcance

### A. Botón «Analiza» en el modal de gestión «Revisar TDR» (frontend)

En el `Dialog` de gestión `gestionTdrAbierta` (`necesidad-detail.tsx:1933-1949`), cada
item de la lista de documentos (`eettDocs.map`) gana un botón **«Analiza»** junto al
actual «Revisar / editar». Al pulsarlo, **cierra el modal de gestión** y abre la nueva
ventana modal «Analiza» (mismo patrón que «Revisar / editar», que cierra antes de abrir
`eettModal`, `:1942`): evita dos modales apilados.

Como ese `Dialog` ya vive tras `permisos.manage` (`:1899`), el botón hereda el guard sin
cable extra. El handler es local a `necesidad-detail.tsx`:
`analizarEett(d)` → `setAnalizaTdrAbierta({ doc: d })` + `setGestionTdrAbierta(false)`.
**No se toca** la cadena `NecesidadEettCampo` / `campo-ficha` / `ficha-editable`.

### B. Modal nuevo «Analiza» (frontend)

`app/components/necesidad-eett-analiza-modal.tsx` — modal **grande** (casi full-screen,
`size` máximo del `Dialog` del design system), titulado **«Analiza»**, **dos columnas**:

- **Columna izquierda — Estado**: badge de `status` (`Subido / Procesando / Indexado /
  Error`) + `error_message` si lo hay; tarjetas de metadatos (método de extracción
  PDF-text vs OCR, `ocrPartial`, `pageCount`, `chunkCount`, `recordCount` Pinecone,
  `namespace`, `indexedTextComplete`, `contentHash`, `indexingPipelineVersion`); botón
  **«Reindexar»** (con confirmación). Mientras `status === "processing"`, polling de
  `GET rag` cada 4 s y spinner.
- **Columna derecha — explorador con 3 pestañas**:
  1. **Fragmentos**: lista paginada de `document_chunks` (`chunk_index`, `page_start`,
     `content` con scroll, `token_count`) + caja de búsqueda léxica local (filtra
     `content` por `q`).
  2. **Consulta de prueba**: textarea + botón → `POST consulta` → lista de resultados
     con `score`, `chunk_index`, `page_start` y un extracto. Para verificar que el RAG
     «sabe» responder sobre ese TDR.
  3. **Resumen IA**: `document_summaries` (`summary_type=executive`) si existe.

Casos límite reflejados en la UI:

- **`.docx`** (no se indexan, `eett-tdr/route.ts:170-175`): estado «No indexado — los
  .docx no entran en el RAG, solo PDF»; pestañas Fragmentos/Consulta vacías con aviso;
  botón Reindexar oculto.
- **`processing`**: badge amarillo + spinner + polling.
- **`error`**: `error_message` en rojo + botón Reindexar destacado.
- **OCR parcial / `indexedTextComplete=false`**: aviso «RAG posiblemente incompleto».

Integración en `necesidad-detail.tsx`: estado
`analizaTdrAbierta: { doc: EettDocRow } | null`; handler `analizarEett(d)` que lo abre;
render del modal al final (junto a `eettModal` y al `Dialog` de gestión).

### C. Rutas API nuevas (backend)

Bajo `app/api/necesidades/[id]/eett-tdr/[docId]/` (mismo prefijo que las ya existentes
`pdf`, `parrafos`, `texto`, `trasladados`). Todas arrancan con el mismo guard de
autorización que las rutas eett-tdr actuales y **verifican pertenencia**: el documento
`docId` debe tener `metadata.necesidadId === id` y `metadata.kind === "eett_tdr"`, si no
404.

- **`GET rag`** → `{ status, error_message, metadatos, job, resumen }`. Lee `documents`
  por `docId`, el último `processing_jobs` (`document_id=eq.{docId}`,
  `order=created_at.desc&limit=1`) y `document_summaries` (`summary_type=eq.executive`).
- **`GET chunks?q=&page=&limit=`** → `{ items, total, page }`. Select paginado de
  `document_chunks` por `document_id`; si `q`, filtra `content=ilike.*q*`. `limit`
  por defecto 20, máximo 50.
- **`POST consulta`** body `{ query }` → `{ resultados: [{ chunk_index, page_start,
  score, extracto }] }`. Llama a `searchTextRecords` (`lib/pinecone.ts:464`) con filtro
  `documentId=docId`, `topK=8`. `query` requerido (no vacío).
- **`POST reindex`** → 202. Replica la lógica de `app/api/documents/[id]/route.ts`
  (PATCH `status=uploaded`, limpia vectores/chunks previos del doc, `after()`→
  `processPdfForSearch(document, file)` tras descargar el PDF de Storage). Guard de
  autorización `requireCapability("necesidad.manage")` — **el mismo que la subida**
  (`eett-tdr/route.ts:65`), que es el equivalente servidor de `permisos.manage` del
  frontend — y rate limit `RATE_LIMITS.reindex`.

### D. Saneo del botón «Revisar TDR» (puntos 1, 3 y 5)

- **(1)** `app/components/necesidad/ficha-editable.tsx:567` — envolver el botón en
  `{permisos.manage ? ( …botón… ) : null}`. `permisos.manage` ya está en scope
  (`ficha-editable.tsx:141`).
- **(3)** `app/components/necesidad-detail.tsx`:
  - `:1915` `accept` → `application/pdf,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document`.
  - `:1928` etiqueta → `Subir {tipo} (PDF o .docx)`.
  - `:1903` descripción del `Dialog` → ajustar copy para mencionar PDF o .docx.
- **(5)** `app/components/necesidad-detail.tsx:898` (`subirEett`) — antes de
  `setEettModal(…)`, añadir `setGestionTdrAbierta(false)`. Idempotente si la subida
  viene del campo inline.

### E. Selectores de tipo sincronizados (punto 4, de paso)

Al tocar el modal, unificar el estado de tipo: el selector del modal «Revisar TDR» y el
del campo inline pasan a respetar su propio `tipo` local (ya parcialmente hecho:
`subirEett` recibe `tipo` explícito desde `:883`). Se revisa que ningún camino derive el
tipo del estado global `eettTipo` salvo el selector del propio modal.

## Seguridad

- Toda ruta nueva hereda el guard de las rutas eett-tdr existentes (`requireUser`) y
  añade la **comprobación de pertenencia** doc↔necesidad (`metadata.necesidadId`).
- `reindex` requiere además `requireCapability("necesidad.manage")` (igual que la
  subida de EETT/TDR, `eett-tdr/route.ts:65`) y rate limit, como
  `app/api/documents/[id]/route.ts`.
- No se expone ningún dato de otros documentos: `chunks`, `rag` y `consulta` filtran
  siempre por el `docId` validado.

## Flujo de datos

```
Subida (sin cambios): POST /api/necesidades/[id]/eett-tdr
  → Storage → documents(status=uploaded) → after()→ processPdfForSearch
  → document_chunks + Pinecone(namespace legal-documents, vector id {docId}::{idx})

Analiza TDR (lectura):
  GET /eett-tdr/[docId]/rag         → documents + processing_jobs + summaries
  GET /eett-tdr/[docId]/chunks      → document_chunks (paginado, filtro q)
  POST /eett-tdr/[docId]/consulta   → searchTextRecords({documentId, topK:8})

Analiza TDR (escritura):
  POST /eett-tdr/[docId]/reindex    → status=uploaded + limpieza + after()→processPdfForSearch
  → el modal hace polling de GET rag cada 4s hasta status=indexed|error
```

## Tests

`tests/analiza-tdr.test.ts` (Node, sin red, mockeando Supabase/Pinecone):

- **Mapeo de estado → etiqueta/color**: las 4 constantes (`uploaded`, `processing`,
  `indexed`, `error`) + caso `.docx` no indexable. Función pura extraída del modal.
- **Validación de pertenencia**: dado un documento con `metadata.necesidadId` distinto
  al `id` de la ruta (o `kind != eett_tdr`), la validación devuelve «no pertenece»
  (→ 404). Cubre el caso mismo-id y el caso ajeno.
- **Formateo de metadatos**: `extractionMethod`, `ocrPartial`,
  `indexedTextComplete=false` se traducen a los avisos esperados.
- **Construcción del filtro de chunks**: `document_id=eq.{docId}`, paginación
  (`limit`/`offset`) y `q` (`content=ilike.*q*`) — sobre la función pura que arma el
  query string.
- **Cuerpo de la consulta de prueba**: `query` vacío → la ruta lo rechaza; `topK=8` y
  filtro `documentId` correctos.

Estilo: cubrir el catálogo de estados, no un caso suelto (convención del repo).

## No incluido (YAGNI)

- **No se editan chunks** ni se re-embebe texto editado a mano.
- **No se cambia el namespace** de Pinecone (los EETT/TDR siguen en `legal-documents`).
- **No se hace que la revisión/generación del TDR lea el RAG indexado**: ese puente queda
  fuera; aquí solo se inspecciona/gestiona la indexación existente.
- **No se elimina la redundancia** entre el botón de sección «Revisar TDR» y el campo
  inline (punto 2): conviven por decisión del usuario.
- **No se toca** el modal de revisión `necesidad-eett-tdr-modal.tsx` ni el pipeline RAG.
- **No hay reindex síncrono**: solo asíncrono + polling.
