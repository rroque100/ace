// Formato de la respuesta del chat jurídico (el campo `mode` de la petición). Módulo puro.
//
// La petición aceptaba y guardaba `mode` («breve», «tecnica», «informe», «checklist») desde el principio, pero nada lo usaba: la
// generación solo leía el tono y la longitud, y la interfaz ni siquiera ofrecía elegirlo (medido el 2026-11-11). Aquí vive lo que
// cada formato le pide al modelo y cuánto puede escribir.
//
// Los formatos cambian la FORMA, nunca las reglas de evidencia: cada punto de una lista y cada frase de un informe se audita
// igual que una respuesta normal. Por eso:
//  · cada punto de la lista AFIRMA un requisito tal como lo dice la fuente («El contratista presenta… [F3]») en vez de una orden
//    («Verificar que…»), que el auditor no puede contrastar con ningún pasaje;
//  · los encabezados del informe y de la lista son los neutros de chat-answer-layout.ts (neutralHeadings): se muestran como
//    títulos y no cuentan como afirmaciones sin respaldo.
export type AnswerMode = "breve" | "tecnica" | "informe" | "checklist";
export type AnswerLength = "concisa" | "media" | "detallada";

/** Encabezados que usan los formatos; tienen que estar entre los neutros de chat-answer-layout.ts. */
export const FORMAT_HEADINGS = {
  checklist: ["Lista de verificación"],
  informe: ["Resumen", "Fundamento legal", "Análisis", "Conclusión"],
} as const;

/** Lo que el formato le pide al modelo. «tecnica» es la respuesta de siempre: no añade nada. */
export function formatInstruction(mode: AnswerMode) {
  switch (mode) {
    case "breve":
      return "Formato BREVE: solo la respuesta directa a lo preguntado, en 1 a 3 frases, cada una con su cita [F#]. Sin encabezados, sin listas y sin desarrollo. Este formato prevalece sobre la extensión indicada.";
    case "checklist":
      return `Formato LISTA DE VERIFICACIÓN (prevalece sobre la extensión y sobre el formato orientativo indicados): empieza con UNA frase que diga a qué se aplica la lista, con su cita [F#]. Después escribe el encabezado **${FORMAT_HEADINGS.checklist[0]}** y una lista numerada (1., 2., 3.…). Cada punto es UN requisito, obligación, plazo o documento concreto, redactado como afirmación tal como lo dice la fuente (quién, qué y cuándo), y termina con su cita [F#]. No escribas órdenes como «Verificar que…» ni «Revisar…»: afirma la regla. No juntes dos obligaciones en un punto. No añadas puntos que no consten en las fuentes; si falta algo importante, dilo en una frase final sin cita.`;
    case "informe":
      return `Formato INFORME (prevalece sobre la extensión y sobre el formato orientativo indicados): usa exactamente estos encabezados, en este orden y en negrita: ${FORMAT_HEADINGS.informe.map((heading) => `**${heading}**`).join(", ")}. En ${FORMAT_HEADINGS.informe[0]}, la respuesta en 1 a 2 frases. En ${FORMAT_HEADINGS.informe[1]}, las disposiciones aplicables (norma, artículo y lo que establecen). En ${FORMAT_HEADINGS.informe[2]}, cómo se relacionan y qué condiciones o excepciones tienen. En ${FORMAT_HEADINGS.informe[3]}, lo que las fuentes permiten concluir, sin aplicarlo a un caso que no se haya descrito. Cada afirmación lleva su cita [F#]; no añadas otros encabezados.`;
    default:
      return "";
  }
}

/** Cuánto puede escribir el modelo. Un informe necesita sitio para sus cuatro secciones; la lista, para sus puntos. */
export function formatOutputTokens(mode: AnswerMode, length: AnswerLength) {
  const byLength = length === "concisa" ? 600 : length === "media" ? 1300 : 2400;
  if (mode === "breve") return 600;
  if (mode === "informe") return 2400;
  if (mode === "checklist") return Math.max(byLength, 1600);
  return byLength;
}

/**
 * ¿Todo lo comprobado va a la vista? En una respuesta normal el primer bloque queda visible y el resto se pliega bajo «Ver
 * fundamento y fuentes»; en una lista o un informe eso escondería la lista entera o tres de las cuatro secciones.
 */
export function formatShowsEverything(mode: AnswerMode) {
  return mode === "informe" || mode === "checklist";
}
