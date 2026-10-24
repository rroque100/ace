/** Documentary metadata only: these helpers never determine legal applicability. */
export function canonicalSourceEntity(value: string | null | undefined) {
  if (!value) return null;
  const key = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  if (/^congreso de la republica(?: del peru)?$/.test(key)) return "Congreso de la República";
  if (/^(oece|organismo especializado para las contrataciones publicas eficientes)$/.test(key)) return "OECE";
  if (/^(osce|organismo supervisor de las contrataciones del estado(?: \(osce\))?)$/.test(key)) return "OSCE";
  return value.trim();
}
export function documentaryDates(metadata: Record<string, unknown>) {
  const date = (...keys: string[]) => {
    for (const key of keys) {
      const value = metadata[key];
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(value)) continue;
      const day = value.slice(0, 10);
      if (!Number.isNaN(Date.parse(day)) && new Date(day).toISOString().slice(0, 10) === day) return day;
    }
    return null;
  };
  return { published: date("publicationDate", "publishedAt", "datePublished"),
    updated: date("versionDate", "updatedTextAt"), imported: date("importedAt", "uploadedAt"),
    version: [metadata.officialVersion, metadata.version].find((v): v is string => typeof v === "string" && Boolean(v.trim())) ?? null };
}
export function normalizedDocumentNumber(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/\b(?:opinion|resolucion|directiva|ley|reglamento|decreto|supremo|acuerdo|pronunciamiento)\b/g, "")
    .replace(/\bn\s*[.°ºo]+\s*/g, "").replace(/[^a-z0-9]/g, "").replace(/\d+/g, digits => digits.replace(/^0+(?=\d)/, ""));
}
export function documentFamily(type: string, title: string, metadata: Record<string, unknown>) {
  const number = metadata.documentNumber ?? metadata.number;
  const identity = typeof number === "string" && number.trim() ? normalizedDocumentNumber(number)
    : normalizedDocumentNumber(title.split(/—|texto actualizado|versi[oó]n/i)[0]);
  return `${type}:${identity}`;
}
export function normalizedArticle(value: string) {
  return value.trim().replace(/^(?:art[ií]culo|art\.?)\s*/i, "").match(/^\d+(?:\.\d+)*/)?.[0] ?? value.trim();
}
export function sourceEntityAliases(value: string) {
  const canonical = canonicalSourceEntity(value);
  const aliases: Record<string, string[]> = {
    OECE: ["Organismo Especializado para las Contrataciones Públicas Eficientes"],
    OSCE: ["Organismo Supervisor de las Contrataciones del Estado (OSCE)", "Organismo Supervisor de las Contrataciones del Estado"],
    "Congreso de la República": ["Congreso de la República del Perú"],
  };
  return [...new Set([value, canonical ?? value, ...(aliases[canonical ?? ""] ?? [])])];
}
