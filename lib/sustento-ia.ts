// Borradores de sustento con IA para los textos libres de la estrategia (A4).
//
// Por qué existe: los campos de sustento del Art. 46.1 son los únicos del
// formato que no se pueden deducir de nada. Quien rellena A4 se atasca en ellos
// y acaba escribiendo "NOLOSE" o "11" con tal de pasar de pantalla — y eso viaja
// a un documento que se firma. La IA redacta el primer borrador a partir de lo
// que YA está registrado; la persona lo lee, lo corrige y decide.
//
// Lo que la IA NO hace aquí, a propósito:
//   - No decide nada: es texto, no un dato del que dependa otro paso.
//   - No cita artículos. Las citas legales de la app salen de código (la norma
//     es un hecho verificable, no una probabilidad); un "Art. 72.3" alucinado en
//     un expediente firmado es el peor resultado posible de esta función.
//   - No se aplica sola: siempre pasa por un botón.

import { labelProcedimiento } from "./estrategia-formato";

export type CampoSustento = "objetivo" | "factor" | "punto_no_negociable";

/** Qué se le pide al modelo en cada campo, y qué contexto necesita. */
export const CAMPOS_SUSTENTO: Record<
  CampoSustento,
  { label: string; instruccion: string; pideDetalle: boolean }
> = {
  objetivo: {
    label: "s) Identificación de lo que afecta o impulsa el objetivo del proceso",
    instruccion:
      "Redacta el análisis de los factores internos y externos que pueden afectar o impulsar el éxito de esta contratación, y su alineamiento con los objetivos institucionales de la entidad.",
    pideDetalle: false,
  },
  factor: {
    label: "g) Sustento del factor de evaluación",
    instruccion:
      "Redacta el sustento TÉCNICO de por qué este factor de evaluación es pertinente y proporcional para ESTA contratación, en coherencia con su objeto, su cuantía y el procedimiento de selección elegido: qué característica de la oferta permite valorar, cómo contribuye a seleccionar la oferta que ofrece el mejor valor por el dinero, y por qué su exigencia no restringe indebidamente la competencia entre postores.",
    pideDetalle: true,
  },
  punto_no_negociable: {
    label: "j) Sustento del punto no negociable",
    instruccion:
      "Redacta el sustento de por qué esta condición del requerimiento no puede ser materia de negociación: qué riesgo evita o qué necesidad esencial protege.",
    pideDetalle: true,
  },
};

export function esCampoSustento(v: unknown): v is CampoSustento {
  // `in` recorre el prototipo, así que "constructor" o "toString" pasarían por
  // campos válidos y llegarían al prompt como un encargo vacío.
  return typeof v === "string" && Object.hasOwn(CAMPOS_SUSTENTO, v);
}

/**
 * Lo que ya está registrado en el expediente y sirve de materia prima. Todo es
 * opcional: con poco contexto el borrador será genérico, que es honesto — pero
 * inventarlo sería peor.
 */
export type ContextoSustento = {
  /** Denominación de la contratación (nombre de la necesidad o descripción de A3). */
  denominacion?: string | null;
  /** Objeto contractual: bienes, servicios, obras… */
  objeto?: string | null;
  /** Procedimiento elegido en A4 a). */
  procedimiento?: string | null;
  /** Categoría de la segmentación (A2): rutinaria, crítico, estratégico… */
  categoria?: string | null;
  /** Valor estimado del expediente (la cuantía que fija A5). */
  valorEstimado?: number | null;
  /** Plazo de ejecución en días (A3). */
  plazoDias?: number | null;
  /** El factor o el punto concreto que se sustenta. */
  detalle?: string | null;
  /**
   * Borrador de partida (p. ej. la plantilla sugerida del factor): la IA lo
   * PERFECCIONA y lo adapta a esta contratación en vez de empezar de cero. Es
   * texto del propio usuario, no una instrucción: sigue rigiendo el "no cites,
   * no inventes".
   */
  base?: string | null;
};

function linea(etiqueta: string, valor: string | null | undefined): string | null {
  const v = (valor ?? "").trim();
  return v ? `- ${etiqueta}: ${v}` : null;
}

/** Los datos del expediente en texto plano, para el prompt. */
export function datosDelExpediente(ctx: ContextoSustento): string {
  const proc = ctx.procedimiento ? (labelProcedimiento(ctx.procedimiento) ?? ctx.procedimiento) : null;
  return [
    linea("Contratación", ctx.denominacion),
    linea("Objeto contractual", ctx.objeto),
    linea("Procedimiento de selección", proc),
    linea("Categoría de la segmentación", ctx.categoria),
    ctx.valorEstimado != null && ctx.valorEstimado > 0
      ? `- Cuantía de la contratación: S/ ${ctx.valorEstimado.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : null,
    ctx.plazoDias != null && ctx.plazoDias > 0 ? `- Plazo de ejecución: ${ctx.plazoDias} días` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Prompt del borrador. Puro: se puede revisar y testear sin llamar al modelo. */
export function promptSustento(campo: CampoSustento, ctx: ContextoSustento): string {
  const meta = CAMPOS_SUSTENTO[campo];
  const datos = datosDelExpediente(ctx);
  const detalle = (ctx.detalle ?? "").trim();
  const base = (ctx.base ?? "").trim();
  return `Eres un especialista en contrataciones públicas del Perú (Ley N° 32069 y su Reglamento) que asiste a la Dependencia Encargada de las Contrataciones (DEC) a redactar la estrategia de contratación.

TAREA: ${meta.instruccion}

${base ? `BORRADOR DE PARTIDA (perfecciónalo y concrétalo a ESTA contratación con los datos de abajo; no lo copies literal ni inventes datos que no aparezcan):\n"${base}"\n\n` : ""}${detalle ? `ELEMENTO A SUSTENTAR: ${detalle}\n` : ""}DATOS YA REGISTRADOS EN EL EXPEDIENTE:
${datos || "- (No hay datos registrados todavía.)"}

REGLAS ESTRICTAS:
${base ? "- Parte del borrador de partida y MEJÓRALO (no lo repitas tal cual): concrétalo al objeto, la cuantía y el procedimiento de arriba.\n" : ""}- Usa ÚNICAMENTE los datos de arriba. No inventes cifras, fechas, nombres, áreas ni hechos que no aparezcan.
- NO cites artículos, numerales ni normas. Ni siquiera si los conoces: las citas legales las pone el sistema. Redacta el fundamento técnico, no el legal.
- Un solo párrafo de 60 a 120 palabras, en español, con lenguaje administrativo formal peruano y en tercera persona.
- Si los datos no alcanzan para sustentar algo concreto, redacta lo que sí se sostiene con ellos. No rellenes con frases vacías.
- Devuelve SOLO el párrafo: sin título, sin markdown, sin comillas, sin explicaciones.`;
}

/**
 * ¿El borrador se coló citando la norma? Se le prohíbe expresamente, pero un
 * modelo puede desobedecer, y una cita inventada en un documento que se firma
 * es justo lo que no puede pasar. Si la hay, la UI lo avisa antes de usarlo.
 */
export function citaNormaLegal(texto: string): boolean {
  return /\b(art[íi]culo|art\.|numeral|inciso|literal)\s*\d|\bley\s*n?[°º]?\s*\d|\bd\.?s\.?\s*n?[°º]?\s*\d|reglamento\b/i.test(
    texto,
  );
}
