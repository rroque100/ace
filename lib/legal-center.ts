export type LegalCenterView = "chat" | "busqueda" | "normas";
export type LegalCenterFilters = Record<string, string | number | null | undefined>;

export const legalCenterViews = [
  { id: "chat", label: "Chat jurídico", description: "Pregunta sobre tu caso y comprueba las fuentes de la respuesta." },
  { id: "busqueda", label: "Búsqueda documental", description: "Encuentra fragmentos relevantes y abre el documento original." },
  { id: "normas", label: "Normativa y criterios", description: "Explora normas, decisiones y guías por categoría y documento." },
] as const;

// Solo metadatos documentales: nunca trasladar hechos, preguntas o sesiones por URL.
const sharedFilterKeys = ["documentType", "documentId", "article", "processType", "sourceEntity", "year", "topic", "vigencia"] as const;
export function legalCenterHref(view: LegalCenterView, filters: LegalCenterFilters = {}) {
  const params = new URLSearchParams();
  for (const key of sharedFilterKeys) {
    const value = filters[key];
    if (value !== undefined && value !== null && String(value).trim()) params.set(key, String(value).trim());
  }
  return `/${view}${params.size ? `?${params.toString()}` : ""}`;
}

function normalized(value?: string | null) {
  return (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[_-]/g, " ").trim();
}

export function legalValidity(vigencia?: string | null, status?: string | null): {
  state: "current" | "not_current" | "unknown"; label: string; tone: "ok" | "warn" | "neutral";
} {
  const value = normalized(vigencia);
  const review = normalized(status);
  if (/derog|no vigente|sin vigencia|vencid/.test(value)) {
    return { state: "not_current", label: "No vigente según registro", tone: "warn" };
  }
  if (/modific/.test(value) || /revision pendiente|pending review|por revisar/.test(review)) {
    return { state: "unknown", label: "Vigencia por revisar", tone: "warn" };
  }
  if (value === "vigente") return { state: "current", label: "Vigente según registro", tone: "ok" };
  return { state: "unknown", label: "Vigencia sin confirmar", tone: "neutral" };
}

export function legalSearchEmptyState(loading: boolean, error: string, completed: boolean) {
  if (loading) return { title: "Buscando fuentes…", detail: "Estamos consultando los documentos disponibles." };
  if (error) return { title: "La búsqueda no se completó", detail: "Revisa el mensaje de error e intenta de nuevo. Esto no significa que no existan documentos." };
  if (completed) return { title: "Sin coincidencias con esta consulta", detail: "Prueba quitar filtros o utilizar otros términos. No se ha evaluado toda la biblioteca." };
  return { title: "Listo para buscar", detail: "Escribe una consulta y, si lo necesitas, filtra por tipo, entidad, año o vigencia." };
}
