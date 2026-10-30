// Respuestas fijas del chat: no consultan fuentes ni afirman nada jurídico, así que ni la puerta de publicación ni los paneles de
// evidencia, revisión y telemetría tienen nada que decir de ellas. El servidor (lib/legal-chat.ts) y la pantalla
// (app/components/legal-chat.tsx) tienen que coincidir en cuáles son, por eso viven aquí y no repetidas en cada lado.

/** Pide lo mínimo para ubicar la norma (ver chat-vague.ts). */
export const MODELO_ACLARACION = "needs-clarification";
/** Explica qué hace el asistente y cómo preguntarle (ver chat-meta.ts). */
export const MODELO_GUIA = "assistant-intro";

export const esRespuestaFija = (modelo: string | null | undefined): boolean => modelo === MODELO_ACLARACION || modelo === MODELO_GUIA;
