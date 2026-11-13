// Cálculo aritmético de vencimientos de plazos DENTRO del chat, determinista y sin red.
//
// El chat respondía la REGLA del plazo (cuántos días, citando la norma) pero no sabía
// hacer la aritmética: «tengo 8 días hábiles desde el 12/03, ¿hasta qué fecha?» quedaba
// sin la fecha. Este módulo detecta ese pedido en la pregunta —plazo y fecha los aporta
// el USUARIO, nunca el modelo ni este código— y calcula el vencimiento con los mismos
// helpers del cronograma (lib/cronograma-fechas.ts) y los feriados de Configuración.
//
// No se codifica NINGÚN valor legal: el número de días sale de la pregunta. La regla
// jurídica (día de inicio, exclusiones, suspensión) sigue siendo lo que el modelo cita
// con [F#]; el bloque lo dice expresamente para que nadie tome la aritmética por regla.

import { type CaseContext } from "./chat-case-context";
import { extractDates } from "./chat-regime";
import { calcularVencimiento } from "./cronograma-fechas";

// Palabras-número que suelen aparecer en plazos («un plazo de ocho días hábiles»).
const NUMEROS_PALABRA: Record<string, number> = {
  un: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8,
  nueve: 9, diez: 10, once: 11, doce: 12, quince: 15, veinte: 20, veintiun: 21, veintiuno: 21,
  treinta: 30, cuarenta: 40, cuarentaycinco: 45, sesenta: 60, noventa: 90, ciento: 100,
};

const plain = (text: string) => text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// La pregunta pide una FECHA de resultado, no solo la regla.
const PIDE_FECHA = /\b(venc\w*|fecha limite|ultimo dia|hasta que fecha|hasta el dia|que fecha|que dia|cuando debo|cuando puedo|cuando vence|cuando se agota)\b/;
// Un plazo expresado en días, con su clase de cómputo cuando se declara.
const PLAZO_DIAS = /\b(\d{1,3}|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|quince|veinte|veintiun|veintiuno|treinta|cuarenta|cuarentaycinco|sesenta|noventa|ciento)\s*(?:\(\s*\d{1,3}\s*\)\s*)?dias?\b(?:\s+(habiles|calendario))?/;

export type CalculoPlazo = {
  /** Días declarados por el usuario en su pregunta. */
  dias: number;
  /** True = días hábiles (excluye sábados, domingos y feriados registrados). */
  habiles: boolean;
  /** Fecha base (AAAA-MM-DD) tomada de la pregunta o, en su defecto, de «Datos del caso». */
  baseIso: string;
  origenFecha: "pregunta" | "caso";
};

/**
 * ¿La pregunta trae plazo + fecha base + pedido de fecha de vencimiento? Solo entonces
 * hay cálculo que hacer: sin los tres datos se responde como siempre (la regla citada,
 * sin aritmética inventada).
 */
export function detectarCalculoPlazo(question: string, caseContext?: CaseContext): CalculoPlazo | null {
  const texto = plain(question);
  if (!PIDE_FECHA.test(texto)) return null;

  const match = texto.match(PLAZO_DIAS);
  if (!match) return null;
  const dias = /^\d+$/.test(match[1]) ? Number(match[1]) : NUMEROS_PALABRA[match[1]] ?? 0;
  if (dias < 1 || dias > 730) return null;
  // Sin clase declarada no se ADIVINA el cómputo: se declaran calendario y el bloque
  // advierte que la norma debe confirmar la clase. «Hábiles» solo si la pregunta lo dice.
  const habiles = match[2] === "habiles";

  const enPregunta = extractDates(question);
  const enCaso = enPregunta.length === 0 ? extractDates(caseContext?.dates ?? "") : [];
  const base = enPregunta[0] ?? enCaso[0];
  if (!base) return null;

  return { dias, habiles, baseIso: base.iso, origenFecha: enPregunta.length ? "pregunta" : "caso" };
}

function fechaLegible(iso: string) {
  const [anio, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${anio}`;
}

/**
 * El bloque que se ANTEPONE a la respuesta: la fecha de vencimiento calculada, cómo se
 * computó y la advertencia de que la regla legal del plazo es la que citan las fuentes.
 * `feriados` son las fechas ISO registradas en Configuración (puede venir vacía).
 */
export function bloqueCalculoPlazo(calculo: CalculoPlazo, feriados: ReadonlySet<string> = new Set()): string {
  const vence = calcularVencimiento(calculo.baseIso, calculo.dias, { habiles: calculo.habiles, feriados });
  if (!vence) return "";
  const comoSeComputo = calculo.habiles
    ? `${calculo.dias} días hábiles posteriores al ${fechaLegible(calculo.baseIso)} (sábados, domingos${feriados.size ? " y feriados registrados en Configuración" : ""} no cuentan)`
    : `${calculo.dias} días calendario sumados al ${fechaLegible(calculo.baseIso)}`;
  const avisoComputo = calculo.habiles && feriados.size === 0
    ? " No hay feriados registrados en Configuración: solo se excluyeron sábados y domingos."
    : "";
  return `**Cálculo de fecha con los datos de tu consulta**

Vence el ${fechaLegible(vence)} (${comoSeComputo}).
Fecha base tomada de ${calculo.origenFecha === "pregunta" ? "tu pregunta" : "los datos del caso"}.${avisoComputo}
Es un cómputo aritmético con los días que indicaste: la regla legal del plazo (día de inicio, cómputo en hábiles o calendario, exclusión del feriado y suspensiones) es la que citan las fuentes de esta respuesta; confírmala en la norma antes de usar la fecha.

`;
}
