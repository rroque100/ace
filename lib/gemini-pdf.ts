// Lectura NATIVA de PDF con Gemini (multimodal). A diferencia del OCR local
// (pdfjs + rasterización), Gemini lee el PDF entero —incluidos escaneos y
// formatos que pdfjs no decodifica, como JBig2— y transcribe su texto RESPETANDO
// la numeración y el orden. Es la vía precisa para EETT/TDR escaneados.
//
// Usa el endpoint NATIVO de Gemini (generateContent con inline_data), distinto
// del compatible-OpenAI que usa el resto del proyecto para chat.

export function geminiPdfDisponible(): boolean {
  return Boolean(process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY);
}

const PROMPT_TRANSCRIBIR = [
  "Transcribe FIEL y COMPLETAMENTE todo el texto de este documento tal como aparece.",
  "Respeta su NUMERACIÓN (1., 2., 3.1, 3.2, literales A., B., C., D., E., F.…) y su orden exacto.",
  "Antepón a cada página el marcador «=== PÁGINA N ===» (N = número de página).",
  "No resumas, no interpretes, no completes ni omitas nada. Devuelve SOLO la transcripción.",
].join(" ");

/**
 * Transcribe un PDF con Gemini nativo. Devuelve el texto (con marcadores de
 * página) o "" si no hay Gemini configurado, el PDF es muy grande, o falla.
 */
export async function transcribirPdfConGemini(
  buffer: Buffer,
  mimeType = "application/pdf",
): Promise<string> {
  const apiKey = process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey) return "";
  // inline_data admite hasta ~20 MB; por seguridad se limita.
  if (buffer.length > 15 * 1024 * 1024) return "";

  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const base = process.env.GEMINI_NATIVE_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta";
  const url = `${base}/models/${model}:generateContent?key=${apiKey}`;
  const body = {
    contents: [
      {
        parts: [
          { inline_data: { mime_type: mimeType, data: buffer.toString("base64") } },
          { text: PROMPT_TRANSCRIBIR },
        ],
      },
    ],
    // thinkingBudget 0: sin "pensar" para que todo el presupuesto vaya a la
    // transcripción (evita truncados en documentos largos).
    generationConfig: { maxOutputTokens: 32000, temperature: 0, thinkingConfig: { thinkingBudget: 0 } },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return "";
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = (json.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
    return typeof text === "string" ? text.trim() : "";
  } catch {
    return "";
  }
}
