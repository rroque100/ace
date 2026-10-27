import { legalValidity } from "./legal-center";
import { documentaryDates, documentFamily, canonicalSourceEntity, normalizedDocumentNumber } from "./search-document-metadata";
import { foldSearchText, type SearchCatalogueRow } from "./document-search";

export function matchesNormValidity(value: unknown, status: unknown, filter: string) {
  if (!filter) return true;
  const states: Record<string, string> = { vigente: "current", current: "current", "no vigente": "not_current", derogado: "not_current", not_current: "not_current", unknown: "unknown" };
  return states[filter] === legalValidity(typeof value === "string" ? value : null, typeof status === "string" ? status : null).state;
}
export function normTitleMatches(row: SearchCatalogueRow, query: string) {
  if (!query.trim()) return true;
  const number = row.metadata.documentNumber ?? row.metadata.number;
  if (/\d/.test(query) && typeof number === "string" && normalizedDocumentNumber(number) === normalizedDocumentNumber(query)) return true;
  const text = foldSearchText(`${row.title} ${row.metadata.documentNumber ?? row.metadata.number ?? ""}`);
  return foldSearchText(query).split(/\s+/).every(word => text.includes(word));
}
export function normativeVersions(rows: SearchCatalogueRow[]) {
  const groups = new Map<string, SearchCatalogueRow[]>();
  for (const row of rows) {
    const key = documentFamily(row.document_type, row.title, row.metadata);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups].map(([key, members]) => {
    const documents = members.map(row => ({ id: row.id, title: row.title, documentType: row.document_type, sourceEntity: canonicalSourceEntity(row.source_entity), dates: documentaryDates(row.metadata), year: typeof row.metadata.year === "number" ? row.metadata.year : null, vigencia: typeof row.metadata.vigencia === "string" ? row.metadata.vigencia : null, status: typeof row.metadata.status === "string" ? row.metadata.status : null, amends: typeof row.metadata.amends === "string" ? row.metadata.amends : null }));
    documents.sort((a,b) => (b.dates.updated ?? b.dates.published ?? "").localeCompare(a.dates.updated ?? a.dates.published ?? "") || a.id.localeCompare(b.id));
    return { key, title: members[0].title, total: members.length, hasAmendments: documents.some(row=>Boolean(row.amends)), documents };
  });
}
/** Linking a citation does not verify the legal effect asserted by its wording. */
export function referenceReviewLabel(resolved: boolean, targetId?: string | null) {
  return resolved && targetId ? "Enlace localizado · relación jurídica sin revisar" : "Referencia detectada · destino sin localizar";
}
export function repeatedArticleNumbers(articles: Array<{articleNumber:string}>) {
  const seen = new Set<string>(); const repeated = new Set<string>();
  for (const article of articles) { if (seen.has(article.articleNumber)) repeated.add(article.articleNumber); seen.add(article.articleNumber); }
  return [...repeated];
}

/** Use only explicit standalone headings; inline legal references are not headings. */
export function annotateArticleSections<T extends {content:string;section_title:string|null}>(articles:T[]) {
  let title="", chapter="", subchapter="";
  return articles.map((article,index)=>{
    const tail=index?articles[index-1].content.slice(-1600):"";
    const suffix=tail.match(/(?:^|\.\s+)((?:T[ÍI]TULO|CAP[ÍI]TULO|SUBCAP[ÍI]TULO)\s+(?:[IVXLCDM]+|\d+)\b[^.;“”"]{0,600})$/)?.[1];
    const lines=tail.split(/\r?\n/).map(line=>line.trim());
    // Some PDF extraction joins headings to the previous article. Accept only an
    // explicit trailing heading after a sentence boundary, not an inline reference.
    if(suffix) lines.push(...suffix.split(/(?=\b(?:T[ÍI]TULO|CAP[ÍI]TULO|SUBCAP[ÍI]TULO)\s+(?:[IVXLCDM]+|\d+)\b)/).filter(Boolean));
    for(let lineIndex=0;lineIndex<lines.length;lineIndex++) {
      const line=lines[lineIndex];
      if(!/^(?:T[ÍI]TULO|CAP[ÍI]TULO|SUBCAP[ÍI]TULO)\s+(?:[IVXLCDM]+|\d+)\s*(?:[:.\-–—]|$)/.test(line) && !(suffix && suffix.includes(line) && /^(?:T[ÍI]TULO|CAP[ÍI]TULO|SUBCAP[ÍI]TULO)\s+(?:[IVXLCDM]+|\d+)\b/.test(line)))continue;
      const next=lines[lineIndex+1]??"";
      const heading=(line+(next && next.length<140 && next===next.toUpperCase() && !/^(?:ART[ÍI]CULO|T[ÍI]TULO|CAP[ÍI]TULO)/.test(next)?` — ${next}`:"")).slice(0,240);
      if(/^T[ÍI]TULO/.test(line)){title=heading;chapter="";subchapter="";}else if(/^SUBCAP[ÍI]TULO/.test(line))subchapter=heading;else{chapter=heading;subchapter="";}
    }
    return {...article,section_title:article.section_title || [title,chapter,subchapter].filter(Boolean).join(" / ") || null,sectionOrigin:article.section_title?"registered":title||chapter||subchapter?"explicit-text-heading":"unknown"};
  });
}
