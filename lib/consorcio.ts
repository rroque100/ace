/**
 * Condiciones de participación en consorcio (Art. 72.3.d).
 *
 * El formato ofrece hasta tres condiciones —D.1 número máximo de consorciados,
 * D.2 porcentaje mínimo de cada uno, D.3 porcentaje mínimo del que acredite mayor
 * experiencia—, y se incluyen «una o más… en caso así haya sido sustentado en la
 * estrategia de contratación». Por eso cada una es una casilla con su número.
 *
 * Se compone dentro del `detalle` del tipo `consorcio` del editor de requisitos
 * (texto canónico), y se relee de él, así que no hace falta columna ni migración.
 */

/** Lo que se muestra cuando no se ha marcado ninguna condición. */
export const MENSAJE_CONSORCIO =
  "[CONSIGNAR UNO O MÁS DE LOS REQUISITOS SIGUIENTES, EN CASO ASÍ HAYA SIDO SUSTENTADO EN LA ESTRATEGIA DE CONTRATACIÓN]";

/** Cómo se acredita: texto fijo del formato. */
export const ACREDITACION_CONSORCIO = "Se acredita con la promesa de consorcio.";

const HUECO_D1 = "CONSIGNAR EL NÚMERO MÁXIMO DE INTEGRANTES DEL CONSORCIO EN FUNCIÓN A LA NATURALEZA DE LA PRESTACIÓN";
const HUECO_D2 = "CONSIGNAR EL PORCENTAJE MÍNIMO DE PARTICIPACIÓN DE CADA INTEGRANTE DEL CONSORCIO";
const HUECO_D3 =
  "CONSIGNAR EL PORCENTAJE MÍNIMO DE PARTICIPACIÓN EN LAS OBLIGACIONES DEL INTEGRANTE DEL CONSORCIO QUE " +
  "ACREDITE LA MAYOR EXPERIENCIA";

export type CondicionesConsorcio = {
  /** D.1 · número máximo de consorciados. */
  d1: boolean;
  n1: string;
  /** D.2 · porcentaje mínimo de participación de cada consorciado. */
  d2: boolean;
  n2: string;
  /** D.3 · porcentaje mínimo del integrante con mayor experiencia. */
  d3: boolean;
  n3: string;
};

export const CONDICIONES_CONSORCIO_VACIO: CondicionesConsorcio = {
  d1: false,
  n1: "",
  d2: false,
  n2: "",
  d3: false,
  n3: "",
};

function hueco(valor: string, textoOriginal: string): string {
  return valor.trim() || `[${textoOriginal}]`;
}

/** El texto del requisito, con las condiciones marcadas. Ninguna → el mensaje. */
export function componerConsorcio(c: CondicionesConsorcio): string {
  const lineas: string[] = [];
  if (c.d1) lineas.push(`D.1. El número máximo de consorciados es de ${hueco(c.n1, HUECO_D1)}.`);
  if (c.d2) lineas.push(`D.2. El porcentaje mínimo de participación de cada consorciado es de ${hueco(c.n2, HUECO_D2)}%.`);
  if (c.d3) {
    lineas.push(
      "D.3. El porcentaje mínimo de participación en la ejecución del contrato, para el integrante del consorcio " +
        `que acredite mayor experiencia, es de ${hueco(c.n3, HUECO_D3)}%.`,
    );
  }
  return lineas.length > 0 ? lineas.join("\n") : MENSAJE_CONSORCIO;
}

/** Relee las casillas y sus números del requisito ya compuesto. */
export function parseConsorcio(texto: string | null | undefined): CondicionesConsorcio {
  const t = texto ?? "";
  // El número que va tras «es de », descartando el corchete del hueco. Se acota
  // por línea para que el «.» del propio «D.1.» no lo corte.
  const num = (re: RegExp) => {
    const v = (t.match(re)?.[1] ?? "").trim();
    return v.startsWith("[") ? "" : v;
  };
  return {
    d1: /(?:^|\n)\s*D\.1\./.test(t),
    n1: num(/D\.1\.[^\n]*?es de (.+?)\.(?:\n|$)/),
    d2: /(?:^|\n)\s*D\.2\./.test(t),
    n2: num(/D\.2\.[^\n]*?es de (.+?)%\.(?:\n|$)/),
    d3: /(?:^|\n)\s*D\.3\./.test(t),
    n3: num(/D\.3\.[^\n]*?es de (.+?)%\.(?:\n|$)/),
  };
}
