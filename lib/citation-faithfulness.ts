// Verificador de fidelidad de citas (determinista, sin red).
// En materia legal, una afirmacion con [F#] que contenga un dato ESPECIFICO
// (monto en UIT, S/, porcentaje, numero de norma) debe poder rastrearse a ese
// dato EN EL FRAGMENTO CITADO. Si el dato no aparece en ninguna de las fuentes
// citadas por esa afirmacion, la cita es "infiel" (p. ej. el modelo dijo "8 UIT
// [F7]" pero F7 trata de otro tema y no contiene "8 UIT"). Solo se revisan datos
// numericos especificos para minimizar falsos positivos.

export type FaithfulnessIssue = {
  datum: string;
  markers: number[];
  reason: string;
};

export type FaithfulnessResult = {
  ok: boolean;
  checked: number;
  issues: FaithfulnessIssue[];
};

function normalizeForMatch(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

// Solo digitos (y separadores), para comparar "8 UIT" vs "8 uit", "S/ 1,000" etc.
function digitsOf(value: string) {
  return value.replace(/[^\d]/g, "");
}

// Extrae datos especificos de una afirmacion que DEBEN constar en el texto del
// fragmento citado: montos en UIT, S/ y porcentajes (umbrales/cifras concretas).
// NO se incluyen los numeros de norma (Ley 32069, D.S. 009-2025): esos son
// identidad del documento (van en su titulo/metadata, no necesariamente en el
// texto del chunk) y el modelo los toma del contexto legitimamente; ademas, citar
// una norma derogada ya lo detecta el chequeo de grounding aparte.
function extractSpecificData(claim: string): Array<{ raw: string; digits: string }> {
  const data: Array<{ raw: string; digits: string }> = [];
  const patterns = [
    /\d+(?:[.,]\d+)?\s*uit/gi, // 8 UIT, 8.5 UIT
    /s\/\.?\s*\d[\d.,]*/gi, // S/ 1,000
    /\d+(?:[.,]\d+)?\s*%/g, // 4%
  ];
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(claim)) !== null) {
      const raw = match[0].trim();
      const digits = digitsOf(raw);
      if (digits.length >= 1) {
        data.push({ raw, digits });
      }
    }
  }
  return data;
}

// Revisa que los datos especificos de cada afirmacion citada existan en alguno de
// los fragmentos que cita. `sources` se indexa por [F#] (1-based).
//
// `markerLetter`: la letra del marcador de cita ("F" del chat legal, "E" de
// "Preguntar a la IA" en expedientes-archivo — cada modulo cita distinto,
// pero la logica de fidelidad es la misma). Por defecto "F" para no romper a
// legal-chat.ts, el primer consumidor.
export function checkCitationFaithfulness(
  answer: string,
  sources: Array<{ excerpt?: string | null }>,
  markerLetter: string = "F",
): FaithfulnessResult {
  const issues: FaithfulnessIssue[] = [];
  let checked = 0;

  // Divide la respuesta en segmentos por grupos de marcadores [F#]/[E#],
  // tolerando separadores entre marcadores ("[F1], [F2]" cuenta como un solo
  // grupo).
  const markerGroup = new RegExp(`((?:\\s*,?\\s*\\[${markerLetter}\\d+\\])+)`, "g");
  const markerOne = new RegExp(`\\[${markerLetter}(\\d+)\\]`, "g");
  const parts = answer.split(markerGroup).filter(Boolean);

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    const markerMatches = [...part.matchAll(markerOne)];
    const isMarkerGroup =
      markerMatches.length > 0 &&
      part.replace(new RegExp(`[\\s,]|\\[${markerLetter}\\d+\\]`, "g"), "") === "";
    if (!isMarkerGroup) {
      continue;
    }

    // La afirmacion es el texto inmediatamente anterior al grupo de marcadores.
    const claim = (parts[index - 1] ?? "").toString();
    const data = extractSpecificData(claim);
    if (data.length === 0) {
      continue;
    }

    const citedExcerpts = markerMatches
      .map((marker) => Number(marker[1]))
      .map((number) => normalizeForMatch(sources[number - 1]?.excerpt ?? ""));
    const markers = markerMatches.map((marker) => Number(marker[1]));

    for (const datum of data) {
      checked += 1;
      const supported = citedExcerpts.some((excerpt) => digitsOf(excerpt).includes(datum.digits));
      if (!supported) {
        issues.push({
          datum: datum.raw,
          markers,
          reason: `El dato "${datum.raw}" no aparece en el/los fragmento(s) citado(s) ${markers
            .map((m) => `${markerLetter}${m}`)
            .join(", ")}.`,
        });
      }
    }
  }

  return { ok: issues.length === 0, checked, issues };
}
