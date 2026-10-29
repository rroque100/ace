// Régimen aplicable (Ley 30225 o Ley 32069) en el chat: qué régimen pide la pregunta, a qué
// régimen pertenece cada fuente y cuánto debe pesar eso al ordenar.
//
// Por qué existe. Medido en producción con preguntas reales:
//  · «Mi procedimiento se convocó en junio de 2026, ¿puedo aplicar la Ley 30225?» respondía
//    «la Ley 30225 es una ley de contrataciones públicas». Al nombrar «Ley 30225», la
//    coincidencia de palabras subía sus artículos por encima de los de la Ley 32069, y la
//    regla que decide (DCT Cuarta: lo iniciado antes de la vigencia se rige por la norma
//    vigente al convocarse) ni se recuperaba.
//  · El orden por tipo (ley > reglamento > …) no distingue régimen: la Ley 30225, derogada,
//    competía de igual a igual con la vigente.
//  · «junio de 2026» no se reconocía como fecha, así que el chat volvía a pedirla.
//
// Módulo puro (sin red ni BD).

/** La Ley 32069 rige desde esta fecha. Consta en el propio corpus (Acuerdo de Sala Plena
 *  002-2025/TCP, Opinión D000049-2025 y la Resolución 9319-2026-TCP-S4): el Reglamento
 *  (D.S. 009-2025-EF) se publicó el 22-01-2025 y la ley entra en vigor 90 días después de
 *  su publicación (DCF Vigésima novena). */
export const LEY_32069_VIGENCIA = "2025-04-22";

export type Regime = "32069" | "30225";
export type DatePrecision = "dia" | "mes" | "anio";
export type DateRef = { iso: string; precision: DatePrecision; raw: string };
export type RegimeIntent = {
  /** Régimen que debe pesar al ordenar; «ambos» = comparación o vigencia (no sesgar). */
  regime: Regime | "ambos" | null;
  basis: "fecha" | "explicito" | "comparacion" | "actual";
  /** Fecha de convocatoria del procedimiento, si la pregunta la da. */
  convocatoria: DateRef | null;
  /** La fecha dada no basta (año 2025 o abril de 2025): hay que pedir la exacta. */
  ambiguous: boolean;
};

const plain = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8,
  septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};
const MONTH_NAMES = Object.keys(MONTHS).join("|");
const pad = (n: number) => String(n).padStart(2, "0");

/** Fechas que contiene el texto, de la más precisa a la menos, sin repetir el mismo trozo. */
export function extractDates(text: string): Array<DateRef & { index: number }> {
  const t = plain(text);
  const found: Array<DateRef & { index: number }> = [];
  const taken: Array<[number, number]> = [];
  const take = (index: number, length: number) => {
    if (taken.some(([a, b]) => index < b && index + length > a)) return false;
    taken.push([index, index + length]);
    return true;
  };

  for (const m of t.matchAll(/\b(\d{1,2})\s*[/-]\s*(\d{1,2})\s*[/-]\s*(\d{4})\b/g)) {
    const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && take(m.index!, m[0].length)) {
      found.push({ index: m.index!, iso: `${year}-${pad(month)}-${pad(day)}`, precision: "dia", raw: m[0] });
    }
  }
  const dayMonth = new RegExp(`\\b(\\d{1,2})\\s+de\\s+(${MONTH_NAMES})\\s+(?:de(?:l)?\\s+)?(\\d{4})\\b`, "g");
  for (const m of t.matchAll(dayMonth)) {
    if (take(m.index!, m[0].length)) {
      found.push({ index: m.index!, iso: `${m[3]}-${pad(MONTHS[m[2]])}-${pad(Number(m[1]))}`, precision: "dia", raw: m[0] });
    }
  }
  const monthYear = new RegExp(`\\b(${MONTH_NAMES})\\s+(?:de(?:l)?\\s+)?(\\d{4})\\b`, "g");
  for (const m of t.matchAll(monthYear)) {
    if (take(m.index!, m[0].length)) {
      found.push({ index: m.index!, iso: `${m[2]}-${pad(MONTHS[m[1]])}-01`, precision: "mes", raw: m[0] });
    }
  }
  // Un año suelto solo cuenta si va marcado como fecha («en 2026», «del año 2025»): así no se
  // confunde con el número de una norma («Ley 32069», «009-2025-EF»).
  for (const m of t.matchAll(/\b(?:en|durante|desde|del|el)\s+(?:el\s+|del\s+)?(?:ano\s+)?(20\d{2})\b(?!\s*[-/]\s*[a-z0-9])/g)) {
    const at = m.index! + m[0].length - 4;
    if (take(at, 4)) found.push({ index: at, iso: `${m[1]}-01-01`, precision: "anio", raw: m[1] });
  }
  return found.sort((a, b) => a.index - b.index);
}

/** Régimen que corresponde a una fecha de convocatoria, o null si la fecha no alcanza. */
export function regimeForDate(date: DateRef): Regime | null {
  const [year, month] = date.iso.split("-").map(Number);
  const [cutYear, cutMonth] = LEY_32069_VIGENCIA.split("-").map(Number);
  if (date.precision === "dia") return date.iso >= LEY_32069_VIGENCIA ? "32069" : "30225";
  if (date.precision === "mes") {
    if (year === cutYear && month === cutMonth) return null; // el mes que contiene la fecha de corte
    return year * 12 + month > cutYear * 12 + cutMonth ? "32069" : "30225";
  }
  if (year === cutYear) return null; // 2025 contiene la fecha de corte
  return year > cutYear ? "32069" : "30225";
}

const CONVOCATORIA_CUE = /convoc|se inici|inicio del (?:procedimiento|proceso)|procedimiento iniciado|proceso iniciado|publicacion de (?:las )?bases|bases publicadas/;

/** La fecha de convocatoria del procedimiento, si la pregunta la da junto a su señal. */
export function extractConvocatoria(question: string): DateRef | null {
  const t = plain(question);
  const cue = CONVOCATORIA_CUE.exec(t);
  const dates = extractDates(question);
  if (!cue || dates.length === 0) return null;
  // La fecha más cercana a la señal («se convocó en junio de 2026», «convocatoria del 3 de marzo…»).
  const nearest = [...dates].sort((a, b) => Math.abs(a.index - cue.index) - Math.abs(b.index - cue.index))[0];
  return { iso: nearest.iso, precision: nearest.precision, raw: nearest.raw };
}

const LAW_30225 = /\b30225\b|ley de contrataciones del estado|regimen anterior|ley anterior|normativa anterior|norma anterior|\btuo\b/;
const LAW_32069 = /\b32069\b|ley general de contrataciones|nueva ley|regimen vigente|regimen nuevo|nuevo regimen|\b009\s*-?\s*2025\b/;
const COMPARISON = /\b(?:compar\w*|diferenc\w*|difier\w*|cambi\w*|novedad\w*|nuevo\w*|versus|frente a|respecto a)\b|\bantes y despues\b|\bque trae\b/;

/** Pregunta que pone una ley frente a la otra («qué cambió entre la 30225 y la 32069»). */
export function isRegimeComparison(question: string): boolean {
  const t = plain(question);
  const both = LAW_30225.test(t) && LAW_32069.test(t);
  const sequence = /\b(?:ley|regimen|norma|normativa)\s+anterior\b/.test(t) && /\b(?:ley|regimen|norma|normativa)\s+(?:nueva|vigente)\b|nueva ley/.test(t);
  return COMPARISON.test(t) && (both || sequence || (LAW_30225.test(t) && /\bnuev[ao]\b|actual/.test(t)) || (LAW_32069.test(t) && /\banterior\b/.test(t)));
}

const APPLICABILITY = /\b(?:aplic\w*|rige|rigen|rigio|regir|se rige|corresponde|regimen aplicable|norma aplicable|ley aplicable|que ley|cual ley|que norma|cual norma|transicion|transitori\w*)\b/;
const TIME_CUE = /\bantes de\b|\bdespues de\b|\ba partir de\b|desde cuando|cuando entr[oó]|entro en vigencia|entra en vigencia|vigencia de la ley|aun se aplica|todavia se aplica|ultractiv/;

/** ¿Qué ley rige un procedimiento/contrato según la fecha? Pregunta de aplicación en el tiempo. */
export function isTemporalApplicabilityQuestion(question: string): boolean {
  const t = plain(question);
  if (isRegimeComparison(question)) return false;
  const hasLaw = LAW_30225.test(t) || LAW_32069.test(t);
  const date = extractConvocatoria(question);
  return (APPLICABILITY.test(t) && (Boolean(date) || hasLaw || TIME_CUE.test(t) || /\bmi (?:proceso|procedimiento|contrato)\b/.test(t)))
    || /desde cuando (?:rige|aplica)|cuando entr[oó] en vigencia|aun se aplica|todavia se aplica/.test(t);
}

/** Qué régimen pide la pregunta, para decidir cómo pesar las fuentes. */
export function questionRegimeIntent(question: string): RegimeIntent {
  const t = plain(question);
  const convocatoria = extractConvocatoria(question);
  if (isRegimeComparison(question)) return { regime: "ambos", basis: "comparacion", convocatoria, ambiguous: false };
  if (convocatoria) {
    const regime = regimeForDate(convocatoria);
    if (regime) return { regime, basis: "fecha", convocatoria, ambiguous: false };
    return { regime: "ambos", basis: "fecha", convocatoria, ambiguous: true };
  }
  const names30225 = LAW_30225.test(t);
  const names32069 = LAW_32069.test(t);
  if (names30225 && names32069) return { regime: "ambos", basis: "comparacion", convocatoria: null, ambiguous: false };
  // Una ley nombrada junto a vigencia o aplicación se resuelve con las disposiciones transitorias
  // y derogatorias de la otra: no se sesga.
  if ((names30225 || names32069) && (APPLICABILITY.test(t) || /vigente|vigencia|deroga/.test(t))) {
    return { regime: "ambos", basis: "explicito", convocatoria: null, ambiguous: false };
  }
  if (names30225) return { regime: "30225", basis: "explicito", convocatoria: null, ambiguous: false };
  if (names32069) return { regime: "32069", basis: "explicito", convocatoria: null, ambiguous: false };
  return { regime: null, basis: "actual", convocatoria: null, ambiguous: false };
}

type SourceLike = {
  documentType: string;
  documentNumber?: string | null;
  documentTitle?: string;
  /** Régimen revisado por una persona (no «no_determinado»). */
  regime?: string | null;
  year?: number | null;
};

// Normas del órgano rector: su emisor fija la época (el OECE nace con la Ley 32069).
const NORM_TYPES = new Set(["directiva", "lineamiento"]);
// Criterios y decisiones: se emiten sobre procedimientos de ambos regímenes incluso después de la
// vigencia (opiniones de 2026 sobre procedimientos de la ley anterior), así que el emisor no
// prueba nada; solo una fecha anterior a la vigencia lo hace.
const CRITERIA_TYPES = new Set(["opinion", "resolucion", "pronunciamiento", "acuerdo_sala_plena", "comunicado"]);

/** A qué régimen pertenece una fuente, o null si no se puede afirmar. */
export function sourceRegime(source: SourceLike): Regime | null {
  if (source.regime === "32069" || source.regime === "30225") return source.regime;
  const text = plain(`${source.documentNumber ?? ""} ${source.documentTitle ?? ""}`);
  if (/\b32069\b|009\s*-?\s*2025\s*-?\s*ef|ley general de contrataciones/.test(text)) return "32069";
  // También del régimen anterior: los regímenes especiales que se apoyaron en la Ley 30225.
  if (/\b30225\b|344\s*-?\s*2018\s*-?\s*ef|082\s*-?\s*2019\s*-?\s*ef|071\s*-?\s*2018\s*-?\s*pcm|168\s*-?\s*2020\s*-?\s*ef|decreto legislativo n\W*\s*(?:1341|1444)\b|ley de contrataciones del estado|reconstruccion con cambios/.test(text)) return "30225";
  const isNorm = NORM_TYPES.has(source.documentType);
  if (!isNorm && !CRITERIA_TYPES.has(source.documentType)) return null;
  if (isNorm && /\boece\b/.test(text)) return "32069";
  if (/\bosce\b|\btce\b/.test(text)) return "30225";
  const year = source.year ?? Number(/(?:^|\D)(20\d{2})(?!\d)/.exec(text)?.[1] ?? NaN);
  if (Number.isFinite(year) && year <= 2024) return "30225"; // anterior a la vigencia: solo pudo aplicar la ley anterior
  return null;
}

/** Ajuste al puntaje de una fuente según el régimen que pide la pregunta. */
export function regimeRankAdjustment(intent: RegimeIntent, regime: Regime | null): number {
  if (!regime || intent.regime === "ambos") return 0;
  if (intent.regime === null) return regime === "32069" ? 0.04 : -0.12; // sin pista: lo vigente primero
  return regime === intent.regime ? 0.1 : -0.18;
}

const DISPLAY_DATE = new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
export function displayDate(iso: string): string {
  return DISPLAY_DATE.format(new Date(`${iso}T00:00:00Z`));
}

/** Consultas dirigidas para encontrar la regla de transición y la fecha de vigencia. */
export function temporalRetrievalQueries(): string[] {
  return [
    "Aplicación de la norma en el tiempo: los procedimientos de selección iniciados antes de la vigencia de la presente ley se rigen por las normas vigentes al momento de su convocatoria",
    // Calcada de cómo lo dicen las propias fuentes del corpus (Acuerdo de Sala Plena 002-2025/TCP y opiniones de la DTN).
    "El 22 de abril de 2025 entraron en vigencia las disposiciones de la Ley N° 32069, Ley General de Contrataciones Públicas, vigente desde el 22 de abril de 2025",
  ];
}

type EvidenceLike = { article?: string | null; documentType: string; excerpt: string; chunkId: string };

/** De lo recuperado, lo que sustenta la regla de transición o la fecha de vigencia. */
export function pickTemporalEvidence<T extends EvidenceLike>(candidates: T[], max = 3): T[] {
  const seen = new Set<string>();
  const score = (source: T) => {
    if (source.documentType === "ley" && source.article === "DCT-4") return 0; // la regla
    if (source.documentType === "ley" && source.article === "DCF-29") return 1; // vigencia de la ley
    if (/22 de abril de 2025/i.test(source.excerpt)) return 2; // la fecha, dicha por una fuente
    return null;
  };
  return candidates
    .filter((source) => score(source) !== null)
    .filter((source) => {
      const key = `${source.documentType}|${source.article ?? ""}|${source.excerpt.slice(0, 80)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => score(a)! - score(b)!)
    .slice(0, max);
}

export function temporalInstruction(intent: RegimeIntent): string {
  const cut = displayDate(LEY_32069_VIGENCIA);
  const given = intent.convocatoria
    ? `La persona indica como convocatoria: «${intent.convocatoria.raw}» (${intent.convocatoria.precision === "dia" ? "fecha exacta" : intent.convocatoria.precision === "mes" ? "solo mes y año" : "solo el año"}). `
    : "La pregunta no da la fecha de convocatoria del procedimiento. ";
  const verdict = intent.regime === "32069" || intent.regime === "30225"
    ? `Comparada con el ${cut}, esa fecha corresponde a la Ley ${intent.regime}. `
    : intent.ambiguous
      ? `La fecha dada no permite decidir (el ${cut} cae dentro de ese periodo): pide la fecha exacta de convocatoria y explica qué ocurre en cada caso. `
      : "Sin fecha de convocatoria no se puede decidir: pídela y explica qué ocurre en cada caso. ";
  return (
    "La pregunta es sobre QUÉ LEY SE APLICA EN EL TIEMPO. Empieza con la conclusión directa (sí, no o depende) y después da la regla. " +
    given + verdict +
    "La regla está en la Disposición Complementaria Transitoria Cuarta de la Ley 32069: los procedimientos de selección iniciados antes de la vigencia de la ley se rigen por las normas vigentes al momento de su convocatoria; cítala con [F#]. " +
    `Solo si una fuente recuperada lo dice, indica que la Ley 32069 rige desde el ${cut} y cítala. ` +
    "Lo que decide es la fecha de CONVOCATORIA del procedimiento, no la fecha de suscripción del contrato ni la de la consulta. No cites artículos de la Ley 30225 como si fueran aplicables a un procedimiento convocado después de esa vigencia. "
  );
}

export function comparisonInstruction(): string {
  return (
    "La pregunta compara la Ley 30225 (régimen anterior, derogado salvo transición) con la Ley 32069 (régimen vigente). " +
    "Responde con una tabla Markdown de tres columnas: Aspecto | Ley 30225 | Ley 32069. Una fila por aspecto realmente comparable. " +
    "En CADA celda cita la fuente con [F#] o escribe «no consta en las fuentes recuperadas»; no completes de memoria ni inventes diferencias. " +
    "Si de una de las dos leyes no se recuperó ninguna fuente, dilo antes de la tabla en vez de suponer su contenido. " +
    "Cierra con una línea: qué ley se aplica a un procedimiento depende de su fecha de convocatoria (Disposición Complementaria Transitoria Cuarta de la Ley 32069). "
  );
}

type CitedSource = { article?: string | null; documentType: string; excerpt: string };

/**
 * Conclusión directa para una pregunta de aplicación en el tiempo que trae su fecha de convocatoria:
 * se calcula en código (fecha dada frente a la vigencia), no la redacta el modelo. La revisión de
 * evidencia descartaba la frase «no puede aplicar la Ley 30225» porque «convocado en junio de 2026»
 * está en la pregunta, no en ninguna fuente, y la respuesta quedaba sin conclusión.
 *
 * Solo se emite si la regla de transición (DCT Cuarta de la Ley 32069) está entre las fuentes
 * recuperadas, que es lo que se cita; la fecha de vigencia solo se nombra si una fuente la dice.
 * `sources` va en el orden de los marcadores [F#].
 */
export function temporalApplicationBlock(question: string, sources: CitedSource[]): string | null {
  if (!isTemporalApplicabilityQuestion(question)) return null;
  const intent = questionRegimeIntent(question);
  if (!intent.convocatoria || (intent.regime !== "32069" && intent.regime !== "30225")) return null;
  const rule = sources.findIndex((source) => source.documentType === "ley" && source.article === "DCT-4");
  if (rule < 0) return null;
  const dateSource = sources.findIndex((source) => /22 de abril de 2025/i.test(source.excerpt));
  const cut = displayDate(LEY_32069_VIGENCIA);
  const after = intent.regime === "32069";
  const when = dateSource >= 0
    ? `${after ? "posterior" : "anterior"} al ${cut}, fecha desde la que rige la Ley 32069 [F${dateSource + 1}]`
    : `${after ? "posterior" : "anterior"} a la entrada en vigencia de la Ley 32069`;
  return (
    "**Aplicación a tu caso**\n" +
    `Indicas que el procedimiento se convocó en ${intent.convocatoria.raw}. Esa fecha es ${when}, así que corresponde la **Ley ${intent.regime}**: ` +
    `los procedimientos de selección iniciados antes de la vigencia se rigen por las normas vigentes al momento de su convocatoria [F${rule + 1}]. ` +
    "Se aplica por la fecha de convocatoria, no por la del contrato. Es un cálculo con la fecha que indicas; confírmala en el expediente.\n\n"
  );
}
