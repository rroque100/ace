// Marcadores de página del texto indexado: «=== PAGINA 6 ===».
//
// Al extraer un PDF, lib/pdf-processing.ts antepone ese marcador a cada página
// (y gemini-pdf.ts lo pide con tilde) para poder trocear por páginas y asignar
// page_start/page_end a cada fragmento. Es una pista INTERNA: el texto guardado
// debe conservarla, pero el fragmento que se muestra o se envía al modelo no.
// Medido en producción: la Búsqueda mostraba «… ABRIL DE 2025 === PAGINA 6 ===
// Página 6 de 29 Tribunal de Contrataciones…» dentro del pasaje.
//
// Aquí se limpia solo la SALIDA. Nada de lo almacenado cambia (los fragmentos
// históricos y los chats guardados se corrigen también al mostrarlos).
// Módulo puro, sin dependencias.

const FULL_MARKER = /\s*={2,}\s*P[ÁA]GINA\s+\d+\s*={2,}\s*/gi;

// Un fragmento recortado puede cortar el marcador por la mitad. Al FINAL:
// «… texto === PAG», «… === PAGINA 6 =». Al PRINCIPIO: «INA 6 === texto».
// Solo se reconoce lo que lleva `==` (nunca aparece en un texto legal).
const TRAILING_PARTIAL = /\s*={2,}\s*(?:P(?:[ÁA](?:G(?:I(?:N(?:A(?:\s+\d{0,4}\s*={0,1})?)?)?)?)?)?)?\s*$/i;
const LEADING_PARTIAL = /^\s*(?:(?:P?[ÁA]?G?I?N?A)\s+)?\d{1,4}\s*={2,}\s*/i;

/** El texto sin los marcadores de página; el resto del contenido queda intacto. */
export function stripPageMarkers(text: string): string {
  if (!text || !text.includes("=")) return text;
  return text
    .replace(FULL_MARKER, " ")
    .replace(TRAILING_PARTIAL, "")
    .replace(LEADING_PARTIAL, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/**
 * Limpia en profundidad todo campo `excerpt` de una respuesta cuyo formato no
 * controlamos (p. ej. lo que devuelve una función SQL). No toca otros campos.
 */
export function stripPageMarkersInExcerpts<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripPageMarkersInExcerpts) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        key === "excerpt" && typeof item === "string" ? stripPageMarkers(item) : stripPageMarkersInExcerpts(item),
      ]),
    ) as T;
  }
  return value;
}
