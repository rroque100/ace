export function normalizeExamText(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
const anchors: Record<string, string[]> = {
  "1.1": ["expediente de contratacion", "expedientes de contratacion"],
  "1.2": [
    "requerimiento",
    "segmentacion",
    "estrategia de contratacion",
    "interaccion con el mercado",
    "modalidad de pago",
    "sistema de entrega",
    "gestion de riesgos",
    "incentivo",
  ],
  "1.3": ["evaluador", "evaluadores", "oficial de compra", "comite", "jurado"],
  "1.4": [
    "bases",
    "estandarizados",
    "estandarizadas",
    "documentos del procedimiento",
  ],
  "1.5": ["pac", "plan anual de contrataciones"],
  "1.6": [
    "pac",
    "plan anual de contrataciones",
    "cuadro multianual de necesidades",
    "cmn",
  ],
  "1.7": [
    "dec",
    "area usuaria",
    "evaluador",
    "titular",
    "autoridad",
    "dependencia encargada",
  ],
  "1.8": ["pladicop", "seace"],
  "2.1": [
    "procedimiento de seleccion",
    "modalidad",
    "licitacion",
    "concurso",
    "subasta",
    "comparacion de precios",
  ],
  "2.2": [
    "procedimiento de seleccion",
    "etapa",
    "convocatoria",
    "plazo",
    "modalidad",
  ],
  "2.3": [
    "principio",
    "enfoque",
    "pronunciamiento",
    "directiva",
    "opinion",
    "evaluador",
  ],
  "2.4": ["buena pro"],
  "2.5": ["buena pro"],
  "2.6": ["pladicop", "seace"],
  "2.7": ["apelacion"],
  "2.8": ["apelacion"],
  "2.9": ["perfeccionamiento", "suscripcion", "suscribir"],
  "2.10": ["perfeccionamiento", "suscripcion", "suscribir"],
  "3.1": ["contrato", "contractual"],
  "3.2": [
    "modificacion",
    "modificaciones",
    "adicional",
    "reduccion",
    "ampliacion",
    "suspension",
  ],
  "3.3": [
    "penalidad",
    "penalidades",
    "garantia",
    "resolucion del contrato",
    "nulidad",
    "resuelve",
    "terminacion anticipada",
  ],
  "3.4": ["conformidad", "entrega", "observacion", "subsanacion"],
  "3.5": ["controversia", "conciliacion", "arbitraje", "jprd", "disputa"],
  "3.6": ["obra", "obras"],
  "3.7": ["expediente tecnico"],
  "3.8": [
    "residente",
    "supervisor",
    "inspector",
    "coordinador",
    "gerente de proyecto",
  ],
  "3.9": ["adelanto", "amortizacion"],
  "3.10": ["obra", "obras"],
  "3.11": [
    "valorizacion",
    "valorizaciones",
    "recepcion de obra",
    "liquidacion",
  ],
  "3.12": ["contrato estandarizado", "contratos estandarizados"],
};
export function topicFocus(code: string, text: string) {
  const normalized = normalizeExamText(text);
  return (anchors[code] ?? []).filter((a) =>
    a.length <= 4
      ? new RegExp(`(^| )${a}( |$)`).test(normalized)
      : normalized.includes(a),
  ).length;
}
function materialFacts(text: string) {
  const s = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const quantities = [
    ...s.matchAll(
      /\b(\d+(?:[.,]\d+)?)\s*(%|dias?\b|mes(?:es)?\b|anos?\b|horas?\b|minutos?\b|uit\b|soles\b|por ciento\b)/g,
    ),
  ].map((m) => `${m[1].replace(",", ".")}:${m[2].replace("%", "por ciento")}`);
  return {
    quantities: [...new Set(quantities)].sort().join("|"),
    negative: /\b(?:no|excepto|incorrect[ao]|fals[ao])\b/.test(
      normalizeExamText(text.slice(Math.max(0, text.lastIndexOf("¿")))),
    ),
  };
}
export function nearDuplicate(a: string, b: string) {
  const left = materialFacts(a),
    right = materialFacts(b);
  if (left.quantities !== right.quantities || left.negative !== right.negative)
    return false;
  const stop = new Set([
    "segun",
    "conforme",
    "caso",
    "hipotetico",
    "escenario",
    "normativa",
    "publica",
    "publico",
  ]);
  const words = (s: string) =>
    new Set(
      normalizeExamText(s)
        .split(" ")
        .filter((w) => w.length > 3 && !stop.has(w)),
    );
  const x = words(a),
    y = words(b),
    union = new Set([...x, ...y]);
  return (
    union.size > 0 && [...x].filter((w) => y.has(w)).length / union.size > 0.82
  );
}
