export type DossierSource = {
  sha256?: string | null;
  title: string;
  documentId?: string;
  version?: string | null;
  sourceEntity?: string | null;
  locator?: string | null;
  locatorLabel?: string | null;
  pageStart?:number|null;pageEnd?:number|null;
  quote?: string | null;
  sourceUrl?: string | null;
  review?: string | null;
  consultedAt?: string;
  note?: string | null;
  contentKind?: string;
};
export const csvSafe = (value: unknown) => {
  const text = String(value ?? "");
  return (
    '"' +
    (/^[\s]*[=+@-]/.test(text) ? "'" : "") +
    text.replaceAll('"', '""') +
    '"'
  );
};
export function dossierCsv(items: DossierSource[]) {
  return (
    "\ufeff" +
    [
      [
        "Documento",
        "Versión",
        "Emisor",
        "Ubicación",
        "Pasaje",
        "Revisión",
        "Fuente oficial",
        "Consulta",
        "Nota personal",
        "Huella del original",
      ],
      ...items.map((s) => [
        s.title,
        s.version,
        s.sourceEntity,
        s.locatorLabel,
        s.quote,
        s.review,
        s.sourceUrl,
        s.consultedAt,
        s.note,
        s.sha256,
      ]),
    ]
      .map((row) => row.map(csvSafe).join(","))
      .join("\r\n")
  );
}
export function sourceSnapshot(
  d: {
    id: string;
    title: string;
    source_entity?: string | null;
    metadata: Record<string, unknown>;
  },
  location?: { locator?: string; locatorLabel?: string; quote?: string;pageStart?:number|null;pageEnd?:number|null },
): DossierSource {
  const m = d.metadata;
  return {
    sha256: typeof m.sha256 === "string" ? m.sha256 : null,
    title: d.title,
    documentId: d.id,
    sourceEntity: d.source_entity,
    version: typeof m.officialVersion === "string" ? m.officialVersion : null,
    sourceUrl:
      typeof m.officialPublicationUrl === "string"
        ? m.officialPublicationUrl
        : typeof m.sourceUrl === "string"
          ? m.sourceUrl
          : null,
    review:
      typeof m.legalReviewStatus === "string"
        ? m.legalReviewStatus
        : "pendiente",
    consultedAt: new Date().toISOString(),
    ...location,
  };
}
