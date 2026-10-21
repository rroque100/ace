// Copiloto del expediente — iteración 2: redacción por campo anclada al modelo.
//
// A3 (Formular el requerimiento) ES el requerimiento del Art. 44, así que reusa
// TAL CUAL la maquinaria del copiloto de necesidades (`completarDesdeModelo`):
// recupera el PDF-modelo del proceso + la norma y propone el contenido de los
// apartados. Este módulo solo hace la parte determinista —mapear el esquema de
// campos de A3 y sus datos al formato de esa maquinaria—, para no duplicarla y
// poder probarla sin red.

import type { CampoFormulario } from "./actuaciones-preparatorias";
import { faltaParaAprobar } from "./expediente-contenido";
import { type LegalSource, searchLegalSources } from "./legal-chat";
import { getOpenAIClient, legalAnswerModel } from "./openai-server";
import type { HitosMap } from "./procurement-fases";
import { soles } from "./segmentacion-parametros";

/** Un campo objetivo para `completarDesdeModelo` (incluye su ancla legal). */
export type CampoObjetivoCopiloto = {
  api: string;
  label: string;
  seccion: string;
  baseLegal: string;
  obligatorio: boolean;
  plantilla: string;
};

/** Un campo ya relleno, como contexto de coherencia. */
export type CampoLlenoCopiloto = { key: string; label: string; valor: string };

function comoTexto(v: unknown): string {
  if (typeof v === "string") return v;
  if (v === null || v === undefined) return "";
  return String(v);
}

/** El paso soportado por el copiloto de redacción y su sección legal. */
export const SECCION_REDACCION: Record<string, string> = {
  A3: "Requerimiento (Art. 44 del Reglamento)",
  A4: "Estrategia de contratación (Art. 46 del Reglamento)",
};

/**
 * Construye la petición de redacción de un paso (A3 o A4) a partir de su esquema
 * de campos y de lo ya guardado.
 *
 * Solo se ofrecen a la IA los apartados de **texto largo** (`textarea`): en A3 el
 * alcance, la finalidad, las condiciones, las penalidades; en A4 los sustentos y
 * análisis de las variables del Art. 46. Los selects, booleanos, fechas y
 * editores estructurados NO se redactan por IA —son decisiones puntuales o
 * formatos propios—, así que quedan fuera. Los que YA tienen valor viajan como
 * `camposLlenos` (contexto) y no se re-proponen a la fuerza.
 */
export function peticionRedaccion(
  code: string,
  campos: CampoFormulario[],
  data: Record<string, unknown>,
): { camposObjetivo: CampoObjetivoCopiloto[]; camposLlenos: CampoLlenoCopiloto[] } {
  const seccion = SECCION_REDACCION[code] ?? "";
  const redactables = campos.filter((c) => c.tipo === "textarea");

  const camposObjetivo: CampoObjetivoCopiloto[] = redactables.map((c) => ({
    api: c.name,
    label: c.label,
    seccion,
    baseLegal: c.baseLegal ?? "",
    obligatorio: c.required === true,
    plantilla: "",
  }));

  const camposLlenos: CampoLlenoCopiloto[] = redactables
    .filter((c) => comoTexto(data[c.name]).trim() !== "")
    .map((c) => ({ key: c.name, label: c.label, valor: comoTexto(data[c.name]) }));

  return { camposObjetivo, camposLlenos };
}

/** @deprecated Usa `peticionRedaccion("A3", …)`. Conservada por compatibilidad. */
export const peticionRedaccionA3 = (campos: CampoFormulario[], a3Data: Record<string, unknown>) =>
  peticionRedaccion("A3", campos, a3Data);

// Campos de NARRATIVA de A2 que hacen sustantivo el Informe de Segmentación
// (Art. 125.4 + Guía). A2 usa un formulario propio (sin esquema `campos`
// genérico), así que sus apartados redactables se declaran aquí a mano.
const NARRATIVA_A2: { api: string; label: string; baseLegal: string }[] = [
  { api: "justificacion", label: "Justificación de la categoría de segmentación", baseLegal: "Art. 125.1 del Reglamento y Guía de Actuaciones Preparatorias" },
  { api: "continuidad", label: "Continuidad de la prestación", baseLegal: "Guía de Actuaciones Preparatorias" },
  { api: "riesgoMercado", label: "Riesgo de mercado", baseLegal: "Art. 125.3 del Reglamento y Guía" },
  { api: "estrategiaMitigacion", label: "Estrategia de mitigación del riesgo", baseLegal: "Art. 125.4 del Reglamento y Guía" },
  { api: "puntoControl", label: "Punto de control", baseLegal: "Guía de Actuaciones Preparatorias" },
];

/**
 * Petición de redacción de la narrativa de A2 (la que alimenta el Informe de
 * Segmentación). Solo esos cinco apartados de análisis; el resto de A2 es
 * clasificación determinista, no texto que la IA deba proponer.
 */
export function peticionRedaccionA2(
  a2Data: Record<string, unknown>,
): { camposObjetivo: CampoObjetivoCopiloto[]; camposLlenos: CampoLlenoCopiloto[] } {
  const camposObjetivo: CampoObjetivoCopiloto[] = NARRATIVA_A2.map((f) => ({
    api: f.api,
    label: f.label,
    seccion: "Segmentación · justificación de la categoría (Art. 125)",
    baseLegal: f.baseLegal,
    obligatorio: false,
    plantilla: "",
  }));
  const camposLlenos: CampoLlenoCopiloto[] = NARRATIVA_A2.filter(
    (f) => comoTexto(a2Data[f.api]).trim() !== "",
  ).map((f) => ({ key: f.api, label: f.label, valor: comoTexto(a2Data[f.api]) }));
  return { camposObjetivo, camposLlenos };
}

/**
 * De la propuesta del copiloto (`api → texto`), qué campos conviene APLICAR: solo
 * los que están VACÍOS en el paso, para no pisar lo que la DEC ya escribió. Es la
 * misma disciplina de la precarga («rellena huecos, no sobrescribe»).
 */
export function camposAplicables(
  propuesta: Record<string, string>,
  a3Data: Record<string, unknown>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, texto] of Object.entries(propuesta)) {
    if (!texto?.trim()) continue;
    if (comoTexto(a3Data[key]).trim() === "") out[key] = texto;
  }
  return out;
}

// ===== Iteración 4 · Chat del expediente =====

const CODIGOS_F1 = ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "A10"];

/**
 * Resumen DETERMINISTA del estado del expediente, para dar de comer al chat.
 *
 * Es la «fuente de verdad» sobre lo que ya hay y lo que falta: se arma con los
 * estados de los pasos y el checklist del Art. 54.2 (`faltaParaAprobar`), NO con
 * el modelo. Así el chat responde sobre el expediente REAL en vez de inventar, y
 * la parte factual queda cubierta por tests. Es puro (sin red ni LLM).
 */
export function resumenEstadoExpediente(
  hitos: HitosMap,
  valorEstimado: number | null,
  pacBienesServicios: number | null = null,
): string {
  const st = (c: string): string => hitos[c]?.status ?? "pendiente";
  const lineas: string[] = ["ESTADO DE LOS PASOS (Fase 1 · Actuaciones Preparatorias):"];
  for (const c of CODIGOS_F1) lineas.push(`- ${c}: ${st(c)}`);

  const falta = faltaParaAprobar(hitos, valorEstimado, pacBienesServicios);
  lineas.push("", "QUÉ FALTA PARA APROBAR EL EXPEDIENTE (Art. 54.2 + gates):");
  if (falta.length === 0) {
    lineas.push("- Nada pendiente: el expediente puede aprobarse.");
  } else {
    for (const f of falta) {
      lineas.push(`- ${f.literal}) ${f.etiqueta}${f.detalle ? ` — ${f.detalle}` : ""} [paso ${f.paso ?? "?"}]`);
    }
  }

  lineas.push(
    "",
    valorEstimado != null && valorEstimado > 0
      ? `CUANTÍA de la contratación: ${soles(valorEstimado)}.`
      : "CUANTÍA: aún no fijada (la fija la interacción con el mercado, A5).",
  );
  return lineas.join("\n");
}

const CHAT_SISTEMA = [
  "Eres el copiloto del EXPEDIENTE de contratación pública del sistema ACE (Ley N.° 32069 y su",
  "Reglamento). Respondes preguntas del usuario sobre ESTE expediente, de forma breve, en español",
  "llano y orientada a la acción.",
  "",
  "Reglas estrictas:",
  "- Para el ESTADO del expediente (qué hay, qué falta, qué paso sigue, la cuantía) usa EXCLUSIVAMENTE",
  "  el bloque «ESTADO DEL EXPEDIENTE». No supongas nada que no esté ahí.",
  "- Para lo que DICE la norma, usa las «FUENTES NORMATIVAS» y cítalas con [F#] junto al dato.",
  "- Si algo no consta ni en el estado ni en las fuentes, dilo con claridad ('no me consta / revísalo",
  "  en el paso X'). NUNCA inventes datos, cifras, plazos ni números de artículo.",
  "- Cuando el usuario pregunte '¿qué falta?' o '¿qué sigue?', responde con los literales pendientes y",
  "  el paso donde se resuelven.",
].join("\n");

/**
 * Responde una pregunta sobre el expediente: combina el estado determinista con
 * el RAG de la norma. La verificación factual del estado la garantiza el resumen;
 * la parte legal se ancla a las fuentes recuperadas y se cita con [F#].
 */
export async function chatExpediente(
  pregunta: string,
  resumen: string,
): Promise<{ answer: string; sources: LegalSource[] }> {
  const { sources } = await searchLegalSources({ query: pregunta, topK: 6 }).catch(
    () => ({ sources: [] as LegalSource[] }),
  );
  const norma = sources.filter((s) => ["ley", "reglamento", "directiva"].includes(s.documentType));
  const normaTxt = norma
    .slice(0, 5)
    .map((s, i) => `[F${i + 1}] ${s.citation}${s.article ? ` (Art. ${s.article})` : ""}: ${s.excerpt.slice(0, 400)}`)
    .join("\n");

  const user = [
    "ESTADO DEL EXPEDIENTE (fuente de verdad para lo que ya hay y lo que falta):",
    resumen,
    "",
    normaTxt ? `FUENTES NORMATIVAS (para lo que dice la norma):\n${normaTxt}` : "FUENTES NORMATIVAS: (ninguna recuperada)",
    "",
    `PREGUNTA DEL USUARIO: ${pregunta.trim()}`,
  ].join("\n");

  const client = getOpenAIClient();
  const resp = await client.responses.create({
    input: [
      { role: "system", content: CHAT_SISTEMA },
      { role: "user", content: user },
    ],
    max_output_tokens: 1200,
    model: legalAnswerModel,
    temperature: 0.2,
  });

  return { answer: (resp.output_text ?? "").trim(), sources: norma };
}
