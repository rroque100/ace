// Disposiciones complementarias (finales, transitorias, modificatorias,
// derogatorias) de una norma: segmentación para indexarlas una por una.
//
// Problema medido en producción: la segmentación por artículos hacía que el
// ÚLTIMO artículo (el 100 de la Ley 32069, el 389 de su Reglamento) absorbiera
// todo lo que venía después —las disposiciones—, y luego truncaba ese artículo a
// 24 000 caracteres. La cola de la Ley mide 46 161: se perdían el resto de las
// finales, la modificatoria, TODAS las transitorias y la derogatoria (justo la
// que deroga la Ley 30225). En el Reglamento se cortaba dentro de las
// transitorias («…aprobado»). Además todo quedaba etiquetado «art. 100/389» con
// rangos de página absurdos (p. 94-196). Por eso ACE no podía responder si la
// Ley 30225 seguía vigente.
//
// Módulo puro (sin red ni BD): lo usa lib/pdf-processing.ts al segmentar y lo
// prueba tests/disposiciones-normativas.test.ts.

export type DispositionKind = "final" | "transitoria" | "modificatoria" | "derogatoria";

export type DispositionSegment = {
  /** Etiqueta estable para citar y filtrar: DCF-1, DCT-4, DCM-1, DCD-1. */
  label: string;
  kind: DispositionKind;
  /** Número de orden dentro de su sección (ÚNICA = 1). */
  number: number;
  /** Texto del encabezado: «Disposición Complementaria Transitoria Cuarta». */
  heading: string;
  /** Contenido completo, empezando por el encabezado. */
  content: string;
  /** Posición (en el texto de entrada) donde empieza y termina. */
  start: number;
  end: number;
};

const KIND_INFO: Record<DispositionKind, { code: string; singular: string; plural: string }> = {
  final: { code: "DCF", singular: "Final", plural: "Disposiciones Complementarias Finales" },
  transitoria: { code: "DCT", singular: "Transitoria", plural: "Disposiciones Complementarias Transitorias" },
  modificatoria: { code: "DCM", singular: "Modificatoria", plural: "Disposiciones Complementarias Modificatorias" },
  derogatoria: { code: "DCD", singular: "Derogatoria", plural: "Disposiciones Complementarias Derogatorias" },
};

export function dispositionSectionTitle(kind: DispositionKind): string {
  return KIND_INFO[kind].plural;
}

// Solo MAYÚSCULAS: así no se confunde el encabezado de sección con las
// referencias del cuerpo («conforme a la Décima Disposición Complementaria
// Final de la Ley»). Sin la bandera `i` a propósito.
const SECTION_HEADING =
  /DISPOSICI(?:ONES|[ÓO]N)\s+COMPLEMENTARIAS?\s+(FINALES?|TRANSITORIAS?|MODIFICATORIAS?|DEROGATORIAS?)/gu;

const KIND_BY_WORD: Array<[RegExp, DispositionKind]> = [
  [/^FINAL/, "final"],
  [/^TRANSITORI/, "transitoria"],
  [/^MODIFICATORI/, "modificatoria"],
  [/^DEROGATORI/, "derogatoria"],
];

// Fin de la zona de disposiciones: anexos, firmas y notas editoriales.
const ZONE_END =
  /ANEXO\s+(?:N[°º.]?\s*)?[IVX\d]+\b|POR TANTO|Comun[ií]quese|Dado en |\(\*\)\s*RECTIFICADO|FE DE ERRATAS|NOTA SPIJ/gu;

// «(*)RECTIFICADO POR FE DE ERRATAS» también aparece DENTRO de la zona, pegado al
// ordinal de la disposición siguiente («…ERRATAS TERCERA. Reinscripción…»). Ahí no
// es el fin: solo lo es la nota que no va seguida de un ordinal.
const EDITORIAL_NOTE_THEN_ORDINAL =
  /^(?:\(\*\)\s*RECTIFICADO)?(?:\s*POR)?(?:\s*FE\s+DE\s+ERRATAS)?\s*(\p{Lu}+(?:\s+\p{Lu}+)?)\.\s/u;

function zoneEndAfter(text: string, from: number): number {
  ZONE_END.lastIndex = from;
  let match: RegExpExecArray | null;
  while ((match = ZONE_END.exec(text)) !== null) {
    const isNote = /^(?:\(\*\)|FE DE ERRATAS|NOTA SPIJ)/u.test(match[0]);
    if (isNote) {
      const next = EDITORIAL_NOTE_THEN_ORDINAL.exec(text.slice(match.index, match.index + 120));
      if (next && ordinalValue(next[1]) !== null) continue;
    }
    return match.index;
  }
  return text.length;
}

const UNIT: Record<string, number> = {
  PRIMERA: 1, PRIMERO: 1, PRIMER: 1, SEGUNDA: 2, SEGUNDO: 2, TERCERA: 3, TERCERO: 3, TERCER: 3,
  CUARTA: 4, CUARTO: 4, QUINTA: 5, QUINTO: 5, SEXTA: 6, SEXTO: 6, SEPTIMA: 7, SEPTIMO: 7,
  OCTAVA: 8, OCTAVO: 8, CTAVA: 8, CTAVO: 8, NOVENA: 9, NOVENO: 9,
};
const TENS: Record<string, number> = {
  DECIMA: 10, DECIMO: 10, VIGESIMA: 20, VIGESIMO: 20, TRIGESIMA: 30, TRIGESIMO: 30,
};
const SINGLE: Record<string, number> = { UNICA: 1, UNDECIMA: 11, DUODECIMA: 12 };

const strip = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

/**
 * Valor numérico de un ordinal legal en español: «ÚNICA» = 1, «DÉCIMA TERCERA» =
 * 13, «DECIMOSEGUNDA» = 12, «VIGESIMOPRIMERA» = 21. Devuelve null si la palabra
 * no es un ordinal (p. ej. «OECE», «EF»).
 */
export function ordinalValue(raw: string): number | null {
  const words = strip(raw).replace(/\s+/g, " ").trim().split(" ");
  if (words.length === 1) {
    const [word] = words;
    if (word in SINGLE) return SINGLE[word];
    if (word in UNIT) return UNIT[word];
    if (word in TENS) return TENS[word];
    for (const [prefix, tens] of Object.entries(TENS)) {
      if (word.startsWith(prefix) && word.length > prefix.length) {
        const rest = word.slice(prefix.length);
        if (rest in UNIT) return tens + UNIT[rest];
      }
    }
    return null;
  }
  if (words.length === 2 && words[0] in TENS && words[1] in UNIT) return TENS[words[0]] + UNIT[words[1]];
  return null;
}

const titleCase = (raw: string) =>
  raw.trim().toLowerCase().replace(/\s+/g, " ").replace(/^./u, (c) => c.toUpperCase());

// Posible encabezado ordinal: 1-2 palabras en mayúsculas + punto + inicio de frase.
// Algunas ediciones escriben «SEGUNDA. - Ficha Única…»: se admite un guion tras el punto.
const ORDINAL_CANDIDATE = /(?<![\p{L}\p{N}])(\p{Lu}+(?:\s+\p{Lu}+)?)\.\s+(?:[-–—]\s+)?(?=[\p{Lu}¿(“"])/gu;

// La nota editorial que SPIJ antepone al ordinal siguiente («(*)RECTIFICADO POR FE
// DE ERRATAS») queda al final del cuerpo de la disposición anterior: no es suya.
const TRAILING_EDITORIAL_NOTE = /\s*\(\*\)\s*RECTIFICADO(?:\s+POR)?(?:\s+FE\s+DE\s+ERRATAS)?\s*$/u;

type SectionHead = { kind: DispositionKind; index: number; end: number };

function sectionHeads(text: string, from: number): SectionHead[] {
  SECTION_HEADING.lastIndex = from;
  const seen = new Set<DispositionKind>();
  const heads: SectionHead[] = [];
  let match: RegExpExecArray | null;
  while ((match = SECTION_HEADING.exec(text)) !== null) {
    const kind = KIND_BY_WORD.find(([re]) => re.test(match![1]))?.[1];
    // Solo la PRIMERA aparición de cada tipo: las ediciones consolidadas (SPIJ)
    // repiten los encabezados al citar textos modificatorios más abajo.
    if (!kind || seen.has(kind)) continue;
    seen.add(kind);
    heads.push({ kind, index: match.index, end: match.index + match[0].length });
  }
  return heads;
}

/** Dónde empieza la zona de disposiciones, o -1 si el texto no la tiene. */
export function dispositionZoneStart(text: string, from = 0): number {
  const first = sectionHeads(text, from)[0];
  return first ? first.index : -1;
}

/**
 * Segmenta las disposiciones complementarias que hay desde `from`. Cada
 * disposición numerada («PRIMERA.», «ÚNICA.») es un segmento. Devuelve [] si no
 * hay ninguna.
 */
export function segmentDispositions(text: string, from = 0): DispositionSegment[] {
  const heads = sectionHeads(text, from).sort((a, b) => a.index - b.index);
  if (heads.length === 0) return [];

  // La zona acaba en el primer anexo/firma/nota posterior al último encabezado.
  const zoneEnd = zoneEndAfter(text, heads[heads.length - 1].end);

  const segments: DispositionSegment[] = [];
  heads.forEach((head, position) => {
    const sectionEnd = position + 1 < heads.length ? heads[position + 1].index : zoneEnd;
    const info = KIND_INFO[head.kind];
    const accepted: Array<{ index: number; bodyStart: number; number: number; word: string }> = [];
    let previous = 0;

    ORDINAL_CANDIDATE.lastIndex = head.end;
    let match: RegExpExecArray | null;
    while ((match = ORDINAL_CANDIDATE.exec(text)) !== null && match.index < sectionEnd) {
      let word = match[1];
      let index = match.index;
      let value = ordinalValue(word);
      // Las copias SPIJ pegan la nota «(*)RECTIFICADO POR FE DE ERRATAS» justo
      // delante del ordinal («ERRATAS TERCERA.»): el candidato de dos palabras no
      // es un ordinal, pero su última palabra sí.
      if (value === null && /\s/u.test(word)) {
        const last = word.split(/\s+/u).pop()!;
        const lastValue = ordinalValue(last);
        if (lastValue !== null) {
          value = lastValue;
          index = match.index + word.length - last.length;
          word = last;
        }
      }
      // Secuencia creciente con saltos pequeños (tolera un encabezado que la
      // extracción haya perdido). «ÚNICA» solo abre una sección.
      const isUnique = strip(word) === "UNICA";
      if (value === null || (isUnique && previous !== 0)) continue;
      if (!(value > previous && value <= previous + 3)) continue;
      accepted.push({ index, bodyStart: match.index + match[0].length, number: value, word });
      previous = value;
    }

    accepted.forEach((item, i) => {
      const end = i + 1 < accepted.length ? accepted[i + 1].index : sectionEnd;
      const heading = `Disposición Complementaria ${info.singular} ${titleCase(item.word)}`;
      const body = text.slice(item.bodyStart, end).replace(TRAILING_EDITORIAL_NOTE, "").trim();
      segments.push({
        label: `${info.code}-${item.number}`,
        kind: head.kind,
        number: item.number,
        heading,
        content: `${heading}. ${body}`,
        start: item.index,
        end,
      });
    });
  });
  return segments;
}
