# TDR adjunto anclado al 3.4 + anexo en el .docx — Diseño

**Fecha:** 2026-07-29
**Módulo:** 1 · Necesidad · Ficha del requerimiento · Sección 3.4 Términos de referencia
**Estado:** aprobado (diseño).

## Problema

El área usuaria puede subir el PDF de EETT/TDR con el **módulo EETT/TDR existente**
(`sec-eett`): lo indexa en RAG (`documents` + Pinecone) y lo asocia a la
necesidad (`metadata.necesidadId`, se borra con ella). Pero:

1. Ese panel vive **suelto**, no anclado a la sección **3.4 «Términos de
   referencia»** de la ficha, que es su sitio conceptual.
2. El **.docx exportado** del requerimiento no menciona esos adjuntos: solo
   lleva el TEXTO del campo «Términos de referencia», no la lista de documentos.

## Decisiones (del usuario)

- **Reutilizar** el módulo EETT/TDR (no crear un segundo sistema de subida/RAG) y
  **anclarlo al 3.4** con un cambio ligero (retitular + nota-puente).
- En el .docx, **una lista de adjuntos como anexo** (nombres de archivo) al cerrar
  el 3.4 y antes del 3.5.1. El PDF **no se incrusta**: es un documento que se
  firma, el archivo va aparte.

## Alcance

### A. Subida + RAG + registro — SIN cambios
El pipeline actual (subir PDF → indexar → `documents` con `metadata.necesidadId`)
se conserva intacto. Ya cubre «adjuntar → RAG → registrado en la necesidad».

### B. Anclaje ligero al 3.4 (UI)
Sin reorganizar el render (no verificable en vivo por el login):
- Retitular el panel `sec-eett` en `necesidad-detail.tsx` a algo como
  **«3.4 · Especificaciones Técnicas (EETT) / Términos de Referencia (TDR) —
  documento adjunto»**.
- Añadir una **nota-puente** en la sección 3.4 (campo `descripcionDetallada`)
  indicando que el PDF del TDR se adjunta en ese panel, se indexa para consulta y
  se lista como anexo en el Word. Se implementa como texto de ayuda del campo o
  una nota de sección; no cambia datos ni lógica.

### C. Anexo en el .docx (backend, lo nuevo)
- **Ruta** `app/api/necesidades/[id]/requerimiento-docx/route.ts`: además de lo
  que ya lee, consulta los EETT/TDR de la necesidad (solo `file_name`/`title`) y
  los pasa al constructor como `anexosTdr: string[]`.
- **Constructor** `lib/requerimiento-docx.ts`: nuevo campo opcional
  `anexosTdr?: string[]` en `RequerimientoDocInput`. En el bucle de secciones,
  **al cerrar la sección del 3.4** (la que contiene el campo `descripcionDetallada`)
  y antes de la siguiente (3.5.1), si `anexosTdr` tiene elementos, se añade:
  > **Anexos**
  > Se adjuntan como anexo los siguientes términos de referencia / especificaciones técnicas:
  > • `nombre_archivo.pdf`
  con el mismo estilo de viñeta que ya usa el documento (`bullet: { level: 0 }`).
- Sin adjuntos → no se añade nada (no ensucia el documento).
- La detección del 3.4 es por **presencia del campo `descripcionDetallada`** en la
  sección, no por el título (robusto ante mayúsculas/renombrados).

### D. Marcadores EETT/TDR compartidos (anti-deriva)
El `document_type` (`bases_integradas`), el `kind` (`eett_tdr`) y el fragmento de
consulta por `metadata` están hoy **solo** en
`app/api/necesidades/[id]/eett-tdr/route.ts`. Para que la ruta del .docx consulte
EXACTAMENTE los mismos documentos, se extrae una lib mínima
`lib/eett-tdr-documento.ts` con esas constantes + un `filtroEettTdr(necesidadId)`
(el fragmento PostgREST). El route de eett-tdr pasa a importarla. Evita el mismo
tipo de deriva que las constantes de portafolio.

## Flujo de datos

```
ruta requerimiento-docx
  → supabaseRest(documents?…filtroEettTdr(id)…select=file_name,title)
  → anexosTdr: string[]  (nombres, orden de subida)
  → generarRequerimientoDocx({ …, anexosTdr })
      → bucle de secciones → al cerrar el 3.4 → bloque «Anexos» (si hay)
```

## Tests

`tests/requerimiento-anexos-tdr.test.ts` (Node, sin red):
- Con `anexosTdr` no vacío: el documento generado incluye el texto «Anexos» y cada
  nombre de archivo, y la sección 3.4 aparece antes de 3.5.1 (se comprueba sobre la
  estructura/bloques, no el binario). Enfoque: extraer el render del bloque a una
  función pura `bloqueAnexosTdr(nombres)` y probarla directamente + un test de
  `estructuraDelRequerimiento`/orden de secciones que fije que el 3.4 precede al
  3.5.1.
- Con `anexosTdr` vacío/ausente: no se añade el bloque.

## No incluido (YAGNI)

- No se **incrusta** el PDF en el Word (solo se referencia por nombre).
- No se genera propuesta nueva ni se toca el flujo de traslado/revisión.
- No se toca el pipeline RAG ni el `sec-eett` más allá del retítulo.
- No se mueve físicamente el panel `sec-eett` bajo el 3.4 (anclaje ligero).
