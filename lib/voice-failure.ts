// Qué se registra en el servidor cuando falla una transcripción de voz.
//
// La ruta responde siempre con el mismo 503 genérico (no debe filtrar detalles del proveedor al usuario),
// y sin registro el fallo era invisible: un formato que Gemini rechazara en Safari, una clave caducada o un
// crédito agotado se veían igual que un silencio. Aquí se decide qué merece una línea de log y con qué
// contenido, sin tocar la respuesta al usuario. Módulo puro, sin red.

import { z } from "zod";

export type VoiceFailure = {
  /** `cancelada`: el usuario cerró o repitió la grabación (no es un fallo). `sin-texto`: llegó audio sin habla
   *  inteligible. `proveedor`: falló la transcripción en sí (clave, formato, crédito, tiempo, red). */
  kind: "cancelada" | "sin-texto" | "proveedor";
  detail: string;
};

// Un mensaje de error de proveedor puede traer la clave truncada («Incorrect API key provided: sk-abc…»).
const SECRET = /\b(?:sk-[A-Za-z0-9_-]{4,}|AIza[0-9A-Za-z_-]{8,}|Bearer\s+[A-Za-z0-9._-]{8,})/g;

export function voiceFailure(error: unknown): VoiceFailure {
  const name = error instanceof Error ? error.name : "";
  // `AbortError` es el cliente cancelando la petición; `TimeoutError` (AbortSignal.timeout) sí es un fallo.
  if (name === "AbortError") return { kind: "cancelada", detail: "" };
  if (error instanceof z.ZodError) return { kind: "sin-texto", detail: "la transcripción llegó vacía o fuera de rango" };
  const message = (error instanceof Error ? error.message : String(error ?? "")).replace(/\s+/g, " ").replace(SECRET, "[clave]").slice(0, 240);
  return { kind: "proveedor", detail: `${name || "Error"}: ${message}` };
}
