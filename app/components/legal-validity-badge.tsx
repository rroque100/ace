"use client";
import { useEffect, useState } from "react";
import { legalValidity } from "@/lib/legal-center";
import { activeValidityReview, reviewedValidity, type ValidityRecord } from "@/lib/validity-review";
import { ValidityReviewDetails } from "./validity-review-details";

export function LegalValidityBadge({ value, status, review, documentId, articleId, compact = false }: { value?: string | null; status?: string | null; review?: ValidityRecord | null; documentId?: string; articleId?: string; compact?: boolean }) {
  const [current, setCurrent] = useState<{ id: string; review: ValidityRecord | null } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!documentId) return;
    const controller = new AbortController();
    void fetch(`/api/norms/${encodeURIComponent(documentId)}/validity`, { cache: "no-store", signal: controller.signal }).then(async response => {
      const payload = await response.json(); if (!response.ok) throw Error(payload.error);
      setCurrent({ id: documentId, review: activeValidityReview({ validityReviews: payload.active }, articleId) }); setError("");
    }).catch(() => { if (!controller.signal.aborted) setError("No se pudo consultar la revisión actual del catálogo."); });
    return () => controller.abort();
  }, [documentId, articleId]);
  const record = documentId ? current?.id === documentId ? current.review : null : review;
  const validity = record ? reviewedValidity(record) : legalValidity(value, status);
  return <><span className={`normTag legalValidity ${validity.state === "current" ? "neutral" : validity.tone}`} title={record ? `Revisión registrada por ${record.reviewer}, comprobada al ${record.asOf}. No confirma aplicación al caso.` : "Registro documental; no acredita una revisión humana. Comprueba esta versión y su aplicabilidad al caso."}>{record ? validity.label : validity.state === "current" ? "Registro: vigente · revisión por comprobar" : validity.label}</span>{record && !compact ? <ValidityReviewDetails review={record} documentId={documentId} /> : null}{error ? <small role="status">{error}</small> : null}</>;
}
