"use client";

import "./search-discovery.css";

import { useEffect, useState } from "react";
import type { DocumentSearchFilters } from "@/lib/document-search";
import { documentTypeLabel } from "@/lib/legal-taxonomy";

type Suggestion = { documentId: string; title: string; documentType: string };
type Discovery = { original: string; documents: Suggestion[]; correction: string | null };

export function SearchDiscovery({ query, filters, visible, onChoose, onCorrect }: {
  query: string; filters: DocumentSearchFilters; visible: boolean;
  onChoose: (document: Suggestion) => void; onCorrect: (query: string) => void;
}) {
  const [response, setResponse] = useState<(Discovery & { filtersKey: string }) | null>(null);
  const [failed, setFailed] = useState(false);
  const filtersKey = JSON.stringify(filters);
  useEffect(() => {
    if (!visible || query.trim().length < 2 || query.length > 200) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch("/api/search/suggestions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: query.trim(), filters: JSON.parse(filtersKey) }), signal: controller.signal })
        .then(async result => { if (!result.ok) throw new Error(); return result.json() as Promise<Discovery>; })
        .then(data => { if (!controller.signal.aborted) { setResponse({ ...data, filtersKey }); setFailed(false); } })
        .catch(error => { if (error.name !== "AbortError") { setFailed(true); setResponse(null); } });
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, filtersKey, visible]);
  if (!visible || query.length > 200 || query.trim().length < 2) return null;
  const current = response?.original === query.trim() && response.filtersKey === filtersKey ? response : null;
  return <div className="searchDiscovery">
    {failed ? <small role="status">Las sugerencias no están disponibles. Puedes buscar igualmente.</small> : null}
    {current?.correction ? <p className="searchCorrection">¿Quisiste decir <button type="button" onClick={() => onCorrect(current.correction!)}>{current.correction}</button>? <small>Solo se cambia si lo seleccionas.</small></p> : null}
    {current?.documents.length ? <section aria-label="Sugerencias del catálogo"><p className="searchSuggestionLabel">Documentos de tu biblioteca · con los filtros actuales</p><ul className="searchCatalogueSuggestions">{current.documents.map(document => <li key={document.documentId}><button type="button" onClick={() => onChoose(document)}><span>{document.title}</span><small>{documentTypeLabel(document.documentType)} · Buscar este documento</small></button></li>)}</ul></section> : null}
  </div>;
}
