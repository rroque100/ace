type Source = {
  document_type?: string;
  documentType?: string;
  source_entity?: string | null;
  sourceEntity?: string | null;
  process_type?: string | null;
  processType?: string | null;
  metadata?: Record<string, unknown>;
};
export function documentFacts(d: Source) {
  const m = d.metadata ?? {};
  const type = d.document_type ?? d.documentType;
  const value = (...keys: string[]) =>
    keys.map((k) => m[k]).find((v) => typeof v === "string" && v.trim()) as
      string | undefined;
  const facts: Array<{ label: string; value: string; detected?: boolean }> = [];
  const add = (label: string, v: unknown, detected = false) => {
    if (typeof v === "string" && v.trim())
      facts.push({ label, value: v.trim(), detected });
  };
  add("Número", value("documentNumber", "number"));
  add(
    type === "laudo_arbitral" ? "Fuente publicadora" : "Emisor",
    d.source_entity ?? d.sourceEntity,
  );
  if (type === "opinion") {
    add(
      "Solicitante",
      value("requestingEntity"),
      m.requestingEntityReviewStatus !== "verified",
    );
    add("Asunto", value("subject", "topic"));
    add("Consultas registradas", value("registeredQuestions"));
  }
  if (type === "pronunciamiento") {
    add(
      "Entidad contratante",
      value("contractingEntity"),
      m.contractingEntityReviewStatus !== "verified",
    );
    add("Asunto", value("subject", "topic"));
  }
  if (type === "bases_estandar" || type === "pronunciamiento") {
    add(
      "Procedimiento",
      value("procedureLabel") ?? d.process_type ?? d.processType,
      m.procedureReviewStatus !== "confirmed",
    );
    add("Objeto", value("contractObject", "object"));
  }
  if (type === "bases_estandar")
    add("Norma aprobatoria", value("approvalNorm"));
  if (type === "laudo_arbitral") {
    for (const [label, key] of [
      ["Institución arbitral", "arbitralInstitution"],
      ["Árbitros", "arbitrators"],
      ["Demandante", "claimant"],
      ["Demandado", "respondent"],
      ["Pretensiones registradas", "claims"],
    ])
      add(label, value(key), m.arbitrationReviewStatus !== "verified");
  }
  add("Versión", value("officialVersion", "versionLabel"));
  add("Publicación", value("officialPublicationDate", "publicationDate"));
  return facts;
}
