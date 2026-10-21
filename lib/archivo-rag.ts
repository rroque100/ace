/** Metadatos de procedencia: los nombres no sustituyen la lectura del documento. */
export type RagIdentity = { path: string; type: string; cabinet: string; cp: string; siaf: string; date: string; year: string };

export function parseRagPath(path: string): RagIdentity {
  const parts = path.replaceAll("\\", "/").split("/").filter(Boolean);
  const name = (parts.at(-1) ?? "").replaceAll("_", " ");
  const cp = name.match(/\bCP[ _-]*(\d+)\b/i)?.[1] ?? "";
  const siaf = name.match(/\bSIAF[ _-]*(\d+)\b/i)?.[1] ?? "";
  const match = name.match(/\b(\d{2})[ _-](\d{2})[ _-](\d{4})\b/);
  let date = "";
  if (match) {
    const candidate = `${match[3]}-${match[2]}-${match[1]}`;
    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === candidate) date = candidate;
  }
  return { path: parts.join("/"), type: parts.length >= 3 ? parts[0] : "", cabinet: parts.length >= 2 ? parts.at(-2)! : "", cp: cp ? `CP${cp}` : "", siaf, date, year: date.slice(0, 4) || parts.at(-2)?.replaceAll("_", " ").match(/\b(?:19|20)\d{2}\b/)?.[0] || "" };
}

/** Scalar eq values are URL encoded, not quoted: PostgREST keeps quotes literally.
 * This is only for standalone eq filters, never in()/or() expressions. */
export function restLiteral(value: string): string {
  return encodeURIComponent(value);
}

export function ragRecordFilters(params: URLSearchParams): string {
  const fields: Record<string, string> = { cp: "metadata->rag->>cp", siaf: "metadata->rag->>siaf", cabinet: "nro_archivador", type: "tipo_documento", year: "anio" };
  let filter = "";
  for (const [key, column] of Object.entries(fields)) {
    let value = params.get(key)?.trim();
    if (!value) continue;
    if (value.length > 120) throw new Error("El filtro es demasiado largo");
    if (key === "cp") {
      if (!/^(?:CP\s*)?\d+$/i.test(value)) throw new Error("Escribe un CP válido, por ejemplo CP2955");
      value = `CP${value.replace(/^CP\s*/i, "")}`;
    }
    if (key === "siaf" && !/^\d+$/.test(value)) throw new Error("El SIAF debe contener números");
    if (key === "year" && !/^(19|20|21)\d{2}$/.test(value)) throw new Error("Escribe un año válido");
    filter += `&${column}=eq.${restLiteral(value)}`;
  }
  return filter;
}
