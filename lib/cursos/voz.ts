// Voz de los vídeos animados: qué voz del navegador elegir y cómo preparar el guion para que suene menos a máquina.
//
// La síntesis del navegador (speechSynthesis) depende de las voces instaladas. En Windows, las locales (Helena,
// Laura, Pablo, Sabina…) son las robóticas de siempre; Edge trae voces neuronales «Online (Natural)» y Chrome, las de
// Google, mucho mejores. Antes se tomaba la primera voz de la región, que en Chrome es casi siempre una local: por eso
// sonaba robótico aunque hubiera una voz buena disponible.
//
// Además, el texto del guion está escrito para leerse: «(Rgto., Art. 20)», «TODAS» o «≈» se pronuncian mal o letra
// por letra. textoParaVoz los traduce a lo que diría una persona; el subtítulo sigue mostrando el texto original.
// Módulo puro: sin DOM, para poder probarlo.

export type VozDisponible = { name: string; lang: string; localService: boolean };

const LATAM = ["es-419", "es-mx", "es-us", "es-co", "es-ar", "es-cl", "es-ve", "es-ec", "es-bo", "es-uy", "es-py"];

/**
 * Cuánto promete sonar natural una voz. Lo que más pesa es el motor (neuronal > Google > mejorada de Apple > local),
 * y a igualdad, el acento: Perú, luego Latinoamérica, luego España.
 */
export function puntuarVoz(v: VozDisponible): number {
  const lang = v.lang.toLowerCase().replace("_", "-");
  if (!lang.startsWith("es")) return -1;
  let p = 0;
  if (/natural|neural|online/i.test(v.name)) p += 100;
  else if (/google/i.test(v.name)) p += 60;
  else if (/premium|enhanced|mejorad/i.test(v.name)) p += 50;
  if (!v.localService) p += 20;
  if (lang === "es-pe") p += 15;
  else if (LATAM.includes(lang)) p += 10;
  return p;
}

/** Las voces en español, de la más natural a la menos. */
export function vocesEnEspanol<T extends VozDisponible>(voces: readonly T[]): T[] {
  return voces.filter((v) => puntuarVoz(v) >= 0).sort((a, b) => puntuarVoz(b) - puntuarVoz(a));
}

/** Por debajo de esto solo hay voces locales del sistema: se avisa de que otro navegador suena mejor. */
export const vozEsBasica = (v: VozDisponible | null) => !v || puntuarVoz(v) < 50;

// Abreviaturas que el guion usa al citar la norma, en la forma en que se dicen.
const ABREVIATURAS: Array<[RegExp, string]> = [
  [/\bRgto\./g, "Reglamento"],
  [/\bArts\./g, "artículos"],
  [/\bArt\./g, "artículo"],
  [/\bN\.\s?°\s?/g, "número "],
  [/≈\s?/g, "aproximadamente "],
  [/(\d)\s?%/g, "$1 por ciento"],
  [/#\s?(\d)/g, "número $1"],
  [/\bvs\.?\s/gi, "frente a "],
  [/\s—\s/g, ", "],
  [/[«»"]/g, ""],
];

/**
 * El guion, tal como se dice en voz alta:
 * - las citas entre paréntesis se quitan: la referencia ya está en la ficha y en el subtítulo, y leída corta la frase;
 * - las abreviaturas se expanden («Rgto., Art. 20» → «Reglamento, artículo 20»);
 * - las palabras en mayúsculas de énfasis («TODAS», «NUNCA») pasan a minúsculas, porque algunas voces las deletrean.
 *   Las siglas cortas (DEC, OECE, AGA) se quedan: tienen cuatro letras o menos.
 */
export function textoParaVoz(texto: string): string {
  let t = texto.replace(/\s*\([^)]*\)/g, "");
  for (const [patron, reemplazo] of ABREVIATURAS) t = t.replace(patron, reemplazo);
  t = t.replace(/\b[A-ZÁÉÍÓÚÑ]{5,}\b/g, (p) => p.toLowerCase());
  return t.replace(/\s+([,.;:!?])/g, "$1").replace(/\s{2,}/g, " ").trim();
}

/** Más largo que esto, Chrome corta algunas voces a mitad de frase y nunca avisa de que terminó: el vídeo se quedaba colgado. */
export const MAX_FRASE = 160;

/**
 * Parte un segmento en frases para decirlas una a una, con una pausa breve entre ellas: suena más natural que un
 * bloque continuo y evita el corte de Chrome en textos largos. Si una frase sigue siendo larga, se parte en comas.
 */
export function frasesParaVoz(texto: string): string[] {
  const frases = texto.split(/(?<=[.!?…:;])\s+/).map((f) => f.trim()).filter(Boolean);
  return frases.flatMap((f) => {
    if (f.length <= MAX_FRASE) return [f];
    const trozos: string[] = [];
    let actual = "";
    for (const parte of f.split(/(?<=,)\s+/)) {
      if (actual && actual.length + parte.length + 1 > MAX_FRASE) {
        trozos.push(actual);
        actual = parte;
      } else actual = actual ? `${actual} ${parte}` : parte;
    }
    if (actual) trozos.push(actual);
    return trozos;
  });
}
