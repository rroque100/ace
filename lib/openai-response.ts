// Helper para extraer el texto de la respuesta de OpenAI Responses API.
// La API puede devolver el texto en `output_text` (versiones anteriores) o en
// `output[0].content[0].text` (versiones recientes con formato estructurado).
// Este helper acepta ambos para mantener compatibilidad.

type ResponseLike = {
  output?: Array<{
    content?: Array<{
      text?: string;
    }>;
  }>;
  output_text?: string;
};

export function extractResponseText(response: unknown): string {
  if (!response || typeof response !== "object") return "";
  const r = response as ResponseLike;
  return (
    r.output_text ??
    r.output?.[0]?.content?.[0]?.text ??
    ""
  );
}
