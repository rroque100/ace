// Orden de la búsqueda documental por significado: jerarquía normativa y régimen.
//
// Medido en producción con «qué pasa si el contratista se atrasa en la entrega»: primero la Ley 30225
// (derogada), luego una resolución y un decreto de Reconstrucción, y ninguna fuente de la Ley 32069. Con
// «garantía de fiel cumplimiento» (por palabras) salían un pronunciamiento, una resolución y una opinión
// antes que el Reglamento. La fusión de los dos rankings (RRF) usa solo posiciones y ve igual a una ley
// que a un pronunciamiento; aquí se le suma lo que se espera de un buscador jurídico: la norma vigente
// primero y los criterios después.
//
// Módulo puro (sin red ni BD).

import { questionRegimeIntent, sourceRegime, type RegimeIntent } from "./chat-regime";

// Un multiplicador, no una suma: la RRF produce valores casi planos (≈0,016 el primero y ≈0,015 el
// quinto), así que un factor reordena sin descartar a nadie.
const HIERARCHY: Record<string, number> = {
  ley: 1.3,
  reglamento: 1.25,
  directiva: 1.12,
  lineamiento: 1.1,
  acuerdo_sala_plena: 1.08,
  opinion: 1,
  resolucion: 0.95,
  pronunciamiento: 0.9,
  bases_integradas: 0.8,
};

const NORM_TYPES = new Set(["ley", "reglamento", "directiva", "lineamiento"]);

/**
 * Peso por régimen. Una norma de la ley derogada aparece en los DOS rankings (palabras y significado),
 * así que la fusión le da el doble de puntos que a la norma vigente que solo sale en uno: el castigo
 * tiene que ser decidido (×0,45) para que no gane por duplicado. En cambio un criterio antiguo (una
 * opinión de 2014) sigue siendo jurisprudencia útil: solo se baja un poco.
 */
function regimeFactor(intent: RegimeIntent, regime: "32069" | "30225" | null, documentType: string): number {
  if (!regime || intent.regime === "ambos") return 1;
  const strong = NORM_TYPES.has(documentType);
  const wanted = intent.regime ?? "32069"; // sin pista, lo vigente
  if (regime === wanted) return strong ? (intent.regime ? 1.3 : 1.15) : 1.05;
  return strong ? (intent.regime ? 0.35 : 0.45) : 0.8;
}

type RowLike = {
  document_type: string;
  title: string;
  metadata?: Record<string, unknown> | null;
};

/** Factor por el que se multiplica el rank de un documento antes de ordenar por relevancia. */
export function searchRankFactor(row: RowLike, query: string): number {
  const number = typeof row.metadata?.documentNumber === "string" ? row.metadata.documentNumber
    : typeof row.metadata?.number === "string" ? row.metadata.number : null;
  const year = typeof row.metadata?.year === "number" ? row.metadata.year : null;
  const regime = sourceRegime({ documentType: row.document_type, documentNumber: number, documentTitle: row.title, year });
  return (HIERARCHY[row.document_type] ?? 1) * regimeFactor(questionRegimeIntent(query), regime, row.document_type);
}
