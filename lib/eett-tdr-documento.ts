// Marcadores del documento EETT/TDR de una necesidad en la tabla `documents`.
//
// FUENTE ÚNICA: los usa la ruta del módulo EETT/TDR (listar/subir/borrar) y la
// ruta del requerimiento .docx (listar los adjuntos para el anexo del 3.4).
// Copiados a mano en dos sitios, una consulta y la otra dejarían de mirar los
// mismos documentos.

/** Tipo de documento con el que se guarda el EETT/TDR (capaz de RAG). */
export const DOC_TYPE_EETT = "bases_integradas";
/** Discriminador dentro de `metadata` para no tocar el resto del corpus. */
export const KIND_EETT = "eett_tdr";

/** Fragmento PostgREST que selecciona los EETT/TDR de UNA necesidad. */
export function filtroEettTdr(necesidadId: string): string {
  return `document_type=eq.${DOC_TYPE_EETT}&metadata->>kind=eq.${KIND_EETT}&metadata->>necesidadId=eq.${necesidadId}`;
}
