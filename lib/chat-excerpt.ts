// Qué parte de cada fragmento ve el modelo. Módulo puro.
//
// El chat recortaba cada fragmento a sus primeros 1 400 caracteres, pero los fragmentos de la biblioteca miden hasta 3 380. Lo que
// quedaba fuera era invisible para el modelo y para la verificación: en el art. 210 del Reglamento de la Ley 32069 (fragmento de
// 2 240 caracteres) la frase «deduciendo dicho monto de las valorizaciones…» caía después del carácter 1 400, y el chat contestaba
// «no se especifica en las fuentes recuperadas» teniendo la respuesta en la mano.
//
// Darle el fragmento ENTERO se probó y salió peor (medido con el banco de oro): +25 % de tiempo por pregunta y una regresión en la
// pregunta de la garantía de fiel cumplimiento (6 de 6 → 2 de 6), porque más texto cambia qué afirmaciones sobreviven a la
// comprobación de cifras. Por eso aquí el tamaño NO crece: se elige QUÉ ventana de 1 400 caracteres se muestra.
//
// Regla: el encabezado del fragmento (donde está «Artículo N. Título») se conserva siempre, y el resto es la ventana, dentro del
// fragmento, que cubre más palabras de la pregunta. Si ninguna ventana cubre más que el trozo que ya se mostraba, queda el recorte
// de siempre: la gran mayoría de los fragmentos no cambia.

/** Largo del extracto que ve el modelo (el recorte de siempre). */
export const EXCERPT_LIMIT = 1400;
/** Principio del fragmento que se conserva siempre. */
export const EXCERPT_HEAD = 350;

const STOP = new Set([
  "cuando", "cuales", "cual", "como", "donde", "quien", "quienes", "sobre", "segun", "entre", "desde", "hasta", "para", "porque",
  "puede", "pueden", "debe", "deben", "tiene", "tienen", "hacer", "hace", "esta", "este", "estos", "estas", "otro", "otros", "otras",
  "contrato", "contratos", "contratacion", "contrataciones", "publica", "publicas", "entidad", "entidades", "norma", "normas",
  "articulo", "articulos", "ley", "reglamento", "caso", "casos", "solo", "ademas", "mismo", "misma", "cada", "todo", "todos",
]);

const plain = (texto: string) => texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Raíces de las palabras con contenido de la pregunta: 5 letras o más, sin las vacías ni las genéricas de toda norma de
 * contratación, recortadas a 6 letras para que «valorización» encuentre «valorizaciones» y «supervisión» a «supervisor».
 */
export function queryStems(query: string): string[] {
  const palabras = plain(query).match(/[a-z]{5,}/g) ?? [];
  return [...new Set(palabras.filter((palabra) => !STOP.has(palabra)).map((palabra) => palabra.slice(0, 6)))];
}

/**
 * El extracto que se le da al modelo: `content` entero si cabe en `limit`; si no, el encabezado más la ventana que cubre más raíces
 * de la pregunta. Con empate, o sin raíces, el recorte de siempre (los primeros `limit` caracteres).
 */
export function relevantExcerpt(content: string, query: string, limit = EXCERPT_LIMIT, head = EXCERPT_HEAD): string {
  if (content.length <= limit) return content;
  const legacy = content.slice(0, limit);
  const stems = queryStems(query);
  const text = plain(content);
  // Las posiciones del texto sin tildes tienen que coincidir con las del original; si alguna letra cambia de largo, no se arriesga.
  if (stems.length === 0 || text.length !== content.length) return legacy;

  const width = limit - head;
  const coverage = (from: number) => {
    const window = text.slice(from, from + width);
    return stems.reduce((total, stem) => total + (window.includes(stem) ? 1 : 0), 0);
  };
  const baseline = coverage(head); // lo que el recorte de siempre mostraba después del encabezado
  let best = baseline;
  let first = head;
  let last = head;
  const lastStart = Math.max(head, content.length - width);
  const starts: number[] = [];
  for (let from = head; from <= lastStart; from += 50) starts.push(from);
  // La última ventana (la que termina con el fragmento) puede no caer en un múltiplo de 50.
  if (starts[starts.length - 1] !== lastStart) starts.push(lastStart);
  for (const from of starts) {
    const score = coverage(from);
    if (score > best) { best = score; first = from; last = from; } else if (score === best && best > baseline) last = from;
  }
  if (best <= baseline) return legacy;
  // Con varias ventanas empatadas se toma la del medio del rango: lo que responde suele venir DESPUÉS de las palabras de la pregunta
  // (art. 210: «asume el pago… deduciendo dicho monto de las valorizaciones»), y la más temprana lo dejaba justo fuera.
  const bestFrom = Math.floor((first + last) / 2);

  // Se empieza en el inicio de una frase cercana para que el modelo no lea media oración.
  const sentence = Math.max(content.lastIndexOf(". ", bestFrom), content.lastIndexOf("\n", bestFrom));
  const start = sentence >= bestFrom - 120 && sentence + 2 > head ? sentence + 2 : bestFrom;
  // El final de la ventana queda donde estaba aunque el inicio retroceda: así la frase que puntuó no se queda fuera. Crece a lo sumo 120.
  return `${content.slice(0, head).trimEnd()} … ${content.slice(start, bestFrom + width)}`;
}
