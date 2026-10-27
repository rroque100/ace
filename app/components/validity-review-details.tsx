import { validityLabel, type ValidityRecord } from "@/lib/validity-review";

export function ValidityReviewDetails({ review, documentId }: { review: ValidityRecord; documentId?: string }) {
  return <details className="validityReviewDetails">
    <summary>{validityLabel(review)} · ver sustento</summary>
    <p>Versión revisada: {review.version}</p>
    <p>Comprobación al {review.asOf} · registrada por {review.reviewer}.</p>
    <p>Registro: {new Date(review.recordedAt).toLocaleString("es-PE", { timeZone: "America/Lima" })}.</p>
    <p>Alcance: {review.scope === "document" ? "Documento completo" : `${review.articleIds.length} artículo(s) identificados; no declara el estado del documento completo`}.</p>
    <p className="whitespace-pre-wrap">{review.basis}</p>
    <a href={review.sourceUrl} target="_blank" rel="noopener noreferrer">Abrir sustento oficial</a>
    {documentId ? <a href={`/normas?documentId=${encodeURIComponent(documentId)}`}>Ver documento e historial</a> : null}
    <p>Revisión registrada para esta versión y fecha. La aplicación a un contrato concreto debe comprobarse por separado.</p>
  </details>;
}
