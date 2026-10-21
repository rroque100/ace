# Módulo Especial — Gestión de Expedientes Archivados y Respuesta Documental

> **Estado:** especificación / por implementar. Documento de intención para recordar
> qué se desea construir. Aún no hay código de este módulo.
> **Fecha:** 2026-06-23.

Este "módulo especial" cubre **dos capacidades relacionadas** dentro de la plataforma
municipal (ver `docs/ARQUITECTURA.md` — arquitectura de **monolito modular**):

1. **Biblioteca de Expedientes Archivados** — subir expedientes y documentos
   escaneados (PDF), indexarlos en Pinecone y buscarlos con IA, incluyendo el
   **registro de su ubicación física exacta** (archivo, caja, folder, color, etc.).
2. **Mesa de Partes con Respuesta Asistida** — subir documentos que llegan, pasarlos
   por **OCR**, y **redactar automáticamente la respuesta** (oficio/carta) fundamentada
   en la biblioteca normativa, generando un **`.docx`** que se guarda dentro del expediente.

Ambos comparten el corpus de expedientes y se conectan: la respuesta generada por el
sub-módulo 2 se archiva en el expediente del sub-módulo 1.

---

## 1. Objetivo y principios

- **Digitalizar y localizar** el archivo físico de expedientes terminados: que cualquier
  funcionario pregunte "¿dónde está el expediente X?" y obtenga tanto el **contenido**
  (qué contiene, Nro, fecha, asunto) como su **ubicación física** (caja, archivador, color…).
- **Automatizar la respuesta** a documentos entrantes con una redacción **fundamentada,
  trazable y de calidad profesional**, que no invente y que cite la normativa aplicable.
- **Principio rector (igual que el resto de ACE):** la IA propone, el funcionario valida.
  La respuesta se genera, se revisa y se aprueba antes de emitirse. "No debe fallar" se
  garantiza con *grounding* (solo normativa real citada) + revisión humana obligatoria,
  no asumiendo que el modelo es infalible.

---

## 2. Sub-módulo A — Biblioteca de Expedientes Archivados

> **Estado: IMPLEMENTADO** (2026-06-23). Falta solo aplicar el SQL a la BD en vivo
> (`docs/supabase/expedientes-archivo.sql`) y la prueba E2E. Archivos:
> `lib/expedientes-archivo.ts`, `lib/expedientes-archivo-processing.ts`,
> `lib/expedientes-archivo-search.ts`, `app/api/expedientes-archivo/**`,
> `app/expedientes-archivo/page.tsx`, `app/components/expedientes-archivo-workspace.tsx`,
> nav en `app-shell.tsx`, tests en `tests/expedientes-archivo.test.ts`.
> Namespace Pinecone: `PINECONE_EXPEDIENTES_NAMESPACE` (def. `expedientes-archivo`).
> typecheck/lint/build limpios; 112 tests verdes.

### 2.1 Qué hace
- Subir expedientes completos y/o documentos escaneados en **PDF** (pueden ser muchas
  páginas, escaneados → requieren **OCR**).
- **Primero se organizan/indexan en Pinecone** (corpus aislado de expedientes), y luego
  la IA permite **buscar** sobre la biblioteca de expedientes ya terminados.
- Si ya está en Pinecone, la búsqueda devuelve y encuentra:
  - **Nro de documento / expediente**
  - **Fecha**
  - **Asunto / sumilla**
  - **Qué contiene** (resumen, materia, partes)
  - otros datos relevantes detectados.
- **Registro de ubicación física exacta** de dónde está el expediente en papel.

### 2.2 Datos de ubicación física (clave de este sub-módulo)
Cada expediente registra **dónde se encuentra físicamente**:

| Campo | Ejemplo |
|---|---|
| Tipo de contenedor | `folder`, `archivador`, `caja`, `estante`, `tomo` |
| Número de archivo/archivador | `Archivador 12` |
| Número de caja | `Caja 045` |
| Color | `rojo`, `azul`… (código de color del archivo) |
| Ubicación / ambiente | área, estante, fila, balda |
| Código de ubicación física | identificador compuesto (p. ej. `AMB2-EST3-CAJA045`) |
| Nro de folios | total de folios del expediente |
| Año / periodo | año del expediente |
| Observaciones | notas libres |

> Esta es información que **no** está en el PDF: la captura el funcionario al archivar.
> La búsqueda IA combina el **contenido** (de Pinecone) con esta **ubicación física**
> (de Postgres) para responder "qué es" + "dónde está".
>
> **Catálogo fijo (decisión tomada):** `tipo_contenedor`, `color`, `ubicacion/ambiente`
> y demás se eligen de **listas predefinidas mantenibles** (no texto libre). La UI muestra
> selects; los valores se administran en catálogos (patrón `lib/settings-catalog.ts`).

### 2.3 Modelo de datos (propuesto, schema `expedientes_archivo`)
- `expediente_archivado`
  - `id`, `numero_expediente`, `numero_documento`, `fecha`, `asunto`, `materia`,
    `anio`, `resumen`, `partes` (remitente/destinatario), `status`
    (`uploaded → processing → indexed | error`)
  - **Ubicación física:** `tipo_contenedor`, `nro_archivador`, `nro_caja`, `color`,
    `ubicacion`, `codigo_ubicacion`, `nro_folios`, `observaciones`
  - `storage_bucket`, `storage_path`, `metadata jsonb`, `uploaded_by`, timestamps
- `expediente_archivo_chunk`
  - `id`, `expediente_id` (fk cascade), `chunk_index`, `page_start/end`, `content`,
    `pinecone_vector_id`, `metadata`
- **RLS:** lectura para autenticados; escritura para `editor`/`admin` (patrón del corpus).
- **Pinecone:** namespace propio (p. ej. `expedientes-archivo`), aislado del corpus
  normativo (`legal-documents`) y del archivo administrativo (`archivo-municipal`).

### 2.4 Pipeline de indexación
Reutiliza primitivas existentes (`lib/pdf-processing.ts`, `lib/pinecone.ts`,
patrón del módulo `archivo`):
1. Subida → Storage → estado `uploaded` (responde 202).
2. **Extracción de texto con OCR** (escaneados): `extractPdfText` con fallback OpenAI Vision.
3. Detección IA + regex: Nro de documento, fecha, asunto, materia, partes, resumen.
4. Chunking → embeddings OpenAI → **upsert al namespace `expedientes-archivo`**.
5. Persistencia de chunks + metadata; estado → `indexed`.
6. **Cola resiliente / drainer** para recuperar lo atascado (patrón ya existente).

### 2.5 Búsqueda IA
- Búsqueda semántica + filtros (Nro, fecha/año, asunto, materia, tipo de contenedor).
- Resultado muestra: contenido encontrado + **dónde está físicamente** + cita a páginas.
- Chat opcional: "¿qué expedientes tratan sobre X?" con respuesta fundamentada `[E#]`.

---

## 3. Sub-módulo B — Mesa de Partes con Respuesta Asistida

### 3.1 Qué hace
- Subir los documentos que **llegan** (entrantes); se escanean y pasan por **OCR**.
- Permite **dar respuesta** a ese documento (a ese Nro).
- Para responder, gestiona:
  - **Nro de documento con siglas** (numeración oficial con siglas de la entidad/área).
  - **A quién se dirige** (destinatario).
  - **Asunto**.
- La redacción de la respuesta **usa la biblioteca universal de leyes/normativa**
  (el corpus RAG legal existente — Ley 32069, reglamento, directivas, opiniones).
- Genera la respuesta como **`.docx`** y la **almacena dentro del expediente**.

### 3.2 Flujo
```
1. Llega documento → subir PDF → OCR → texto + metadatos (Nro, remitente, asunto, fecha)
2. Clasificación IA: tipo de documento, materia, qué se solicita / pretende
3. "Generar respuesta":
     · el usuario fija: Nro de respuesta (con siglas), destinatario, asunto
     · el módulo RECUPERA normativa aplicable de la biblioteca legal (RAG con citas)
     · REDACTA el oficio/carta de respuesta fundamentado
4. Vista previa → el funcionario REVISA y EDITA (validación humana obligatoria)
5. Aprobar → genera .docx (plantilla oficial municipal con membrete/encabezado)
6. El .docx se ARCHIVA dentro del expediente correspondiente (sub-módulo A / contrataciones)
```

### 3.3 Numeración con siglas
- La respuesta lleva un **número oficial** con siglas de la entidad y área
  (formato configurable, p. ej. `OFICIO N° 012-2026-MDXX/GM`).
- Debe llevar **contador por serie/área/año** para no duplicar numeración.
- Decisión pendiente: ¿numeración automática (secuencial por serie) o manual validada?

### 3.4 Calidad de la redacción ("no debe fallar")
La exigencia de "respuesta perfecta" se cumple con **controles**, no con fe en el modelo:
- **Grounding estricto:** la fundamentación normativa sale **solo** del corpus legal real,
  con citas verificables `[F#]` (reusa `assessSources` / gating de suficiencia de ACE).
- **Plantilla formal** fija (estructura de oficio: sumilla, antecedentes, análisis, base
  legal, conclusión, despedida) para que la forma sea siempre correcta.
- **Revisión humana obligatoria** antes de generar el `.docx` definitivo.
- **Verificación de fidelidad de citas** (reusa `lib/citation-faithfulness.ts`).
- Si no hay sustento normativo suficiente, el módulo **lo advierte** en vez de inventar.

### 3.5 Generación del .docx
- Reutiliza `docx` + el patrón de `lib/contract-generator.ts` / `lib/process-agents.ts`.
- Plantilla con membrete municipal, numeración con siglas, destinatario, asunto y cuerpo.
- Se sube a Storage y se vincula al expediente (`storage_path` + registro en BD).

---

## 4. Reutilización (no reinventar)
| Necesidad | Ya existe en ACE |
|---|---|
| Extracción + OCR de PDF escaneado | `lib/pdf-processing.ts` (OpenAI Vision) |
| Indexado aislado por namespace | `lib/pinecone.ts` (param `namespace`) |
| Pipeline subir→indexar + drainer | módulo `archivo` + `lib/indexing-queue.ts` |
| RAG legal con citas y gating | `lib/legal-chat.ts`, `lib/procedure-catalog.ts` |
| Fidelidad de citas | `lib/citation-faithfulness.ts` |
| Generación .docx | `docx` + `lib/contract-generator.ts` |
| Roles/permisos + auditoría | `lib/auth.ts`, `audit_logs` |

---

## 5. Decisiones

### Tomadas (2026-06-23)
- ✅ **Ubicación física = catálogo fijo.** No es texto libre: los contenedores, colores,
  ambientes y demás se eligen de **catálogos predefinidos** (listas mantenibles).
  Implicación: tablas/catálogo de valores (reutilizar el patrón de `lib/settings-catalog.ts`)
  para `tipo_contenedor`, `color`, `ubicacion/ambiente`, etc. La UI usa selects, no inputs libres.
- ✅ **Existe una plantilla oficial** de oficio/carta de la municipalidad → el `.docx`
  debe **replicarla exactamente** (membrete, encabezado, numeración con siglas, pie/firmas).
  **Pendiente operativo:** el usuario debe **entregar el archivo de plantilla** (un `.docx`
  o `.pdf` de ejemplo) para mapear su estructura al generador.
- ✅ **Expediente INDEPENDIENTE del expediente de contratación.** Este módulo gestiona un
  expediente **distinto**, con otra tratativa y funcionalidad; **no** es el "expediente de
  contratación" de la Ley 32069 (módulo `contrataciones`). Implicación: **schema y módulo
  propios** (p. ej. `expedientes_archivo` / `lib/expedientes-archivo`), sin acoplarse a
  `contrataciones`. Comparten solo primitivas transversales (OCR, Pinecone, RAG, docx, auth).

### Pendientes (confirmar antes de implementar)
1. **¿Un solo módulo o dos sub-módulos?** A (archivo físico-digital) y B (mesa de partes +
   respuesta). Propuesta: **dos sub-módulos bajo el mismo schema/área** `expedientes_archivo`.
2. **Numeración con siglas:** ¿**automática** secuencial por serie/área/año, o **manual** validada?
3. **Firma:** sin integraciones externas (decisión de arquitectura), lo natural es
   **imprimir para firma manual**; ¿se confirma, o se quiere firma digital más adelante?
4. **Catálogos:** entregar los **valores reales** de los catálogos fijos (lista de cajas/
   archivadores, colores, ambientes/ubicaciones, tipos de contenedor).

---

## 6. Resumen en una frase
Un módulo que **digitaliza y localiza** físicamente los expedientes archivados (búsqueda
IA de contenido + ubicación en caja/archivador/color) y, para los documentos entrantes,
los **escanea con OCR y redacta automáticamente la respuesta** fundamentada en la
normativa, entregando un **`.docx`** revisado por el funcionario y archivado en el expediente.
