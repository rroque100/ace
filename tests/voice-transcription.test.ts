import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("openai", () => ({ default: class { audio = { transcriptions: { create: mocks.create } }; } }));
import { transcribeSearchAudio, voiceAvailable } from "@/lib/voice-transcription";
beforeEach(() => { vi.stubEnv("VOICE_TRANSCRIPTION_PROVIDER", "openai"); vi.stubEnv("OPENAI_API_KEY", "test-only"); vi.stubEnv("OPENAI_TRANSCRIPTION_MODEL", "gpt-4o-mini-transcribe"); mocks.create.mockReset(); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const file = new File(["RIFF0000WAVE0000"], "test.wav", { type: "audio/wav" });
it("usa español, contexto peruano y el proveedor de audio independiente", async () => {
  mocks.create.mockResolvedValue({ text: "Opiniones de la DTN", logprobs: [{ logprob: -.1 }] });
  expect(await transcribeSearchAudio(file)).toMatchObject({ uncertain: false, qualityAssessed: true });
  expect(mocks.create.mock.calls[0][0]).toMatchObject({ language: "es", model: "gpt-4o-mini-transcribe", include: ["logprobs"] });
  expect(mocks.create.mock.calls[0][0].prompt).toContain("Perú"); expect(mocks.create.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
});
it("señala duda o falta de comprobación sin inventar un porcentaje de precisión", async () => {
  mocks.create.mockResolvedValueOnce({ text: "Artículo ciento trece", logprobs: [{ logprob: -2 }] });
  expect((await transcribeSearchAudio(file)).uncertain).toBe(true);
  mocks.create.mockResolvedValueOnce({ text: "Artículo ciento trece" }); expect((await transcribeSearchAudio(file)).qualityAssessed).toBe(false);
});
it("rechaza respuestas vacías y configuración no soportada", async () => {
  mocks.create.mockResolvedValue({ text: "" }); await expect(transcribeSearchAudio(file)).rejects.toThrow();
  vi.stubEnv("OPENAI_TRANSCRIPTION_MODEL", "unknown-provider"); expect(voiceAvailable()).toBe(false);
  vi.stubEnv("OPENAI_API_KEY", ""); expect(voiceAvailable()).toBe(false);
});
it("transcribe con Gemini sin publicar una confianza acústica inexistente", async () => {
  vi.stubEnv("VOICE_TRANSCRIPTION_PROVIDER", "gemini"); vi.stubEnv("GOOGLE_API_KEY", "test-google-only");
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ text: "Artículo 113, numeral 1" }) }] } }] }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  expect(await transcribeSearchAudio(file)).toMatchObject({ text: "Artículo 113, numeral 1", qualityAssessed: false });
  expect(fetcher.mock.calls[0][0]).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent");
  const body = JSON.parse(fetcher.mock.calls[0][1].body); expect(body.contents[0].parts[0].inlineData.mimeType).toBe("audio/wav");
  expect(mocks.create).not.toHaveBeenCalled();
});
it("no cambia de proveedor en caso de fallo ni interpreta silencio como éxito", async () => {
  vi.stubEnv("VOICE_TRANSCRIPTION_PROVIDER", "gemini"); vi.stubEnv("GOOGLE_API_KEY", "test-google-only");
  const fetcher = vi.fn().mockResolvedValueOnce(new Response("{}", { status: 429 })).mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"text":""}' }] } }] }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  await expect(transcribeSearchAudio(file)).rejects.toThrow("429");
  await expect(transcribeSearchAudio(file)).rejects.toThrow(); expect(mocks.create).not.toHaveBeenCalled();
});
it("el tope de texto es 500 por defecto y se amplía para el dictado del chat", async () => {
  const largo = "Mi procedimiento se convocó en junio y el contratista se atrasó. ".repeat(12).trim();
  expect(largo.length).toBeGreaterThan(500);
  mocks.create.mockResolvedValue({ text: largo });
  await expect(transcribeSearchAudio(file)).rejects.toThrow();
  expect((await transcribeSearchAudio(file, undefined, 2000)).text).toBe(largo);
  mocks.create.mockResolvedValue({ text: "x".repeat(2001) });
  await expect(transcribeSearchAudio(file, undefined, 2000)).rejects.toThrow();
});
it("Gemini recibe más margen de salida cuando el tope de texto es mayor", async () => {
  vi.stubEnv("VOICE_TRANSCRIPTION_PROVIDER", "gemini"); vi.stubEnv("GOOGLE_API_KEY", "test-google-only");
  const fetcher = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ text: "Artículo 113" }) }] } }] }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  await transcribeSearchAudio(file); await transcribeSearchAudio(file, undefined, 2000);
  expect(JSON.parse(fetcher.mock.calls[0][1].body).generationConfig.maxOutputTokens).toBe(1000);
  expect(JSON.parse(fetcher.mock.calls[1][1].body).generationConfig.maxOutputTokens).toBe(1334);
});
