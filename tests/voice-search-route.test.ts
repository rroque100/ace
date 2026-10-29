import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), available: vi.fn(), transcribe: vi.fn(), rate: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.auth }));
vi.mock("@/lib/openai-server", () => ({ getProvider: () => "gemini" }));
vi.mock("@/lib/voice-transcription", () => ({ voiceAvailable: mocks.available, voiceConfiguration:()=>({provider:"OpenAI",providerId:"openai",policyUrl:"https://developers.openai.com/api/docs/guides/your-data"}), transcribeSearchAudio: mocks.transcribe }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: mocks.rate, getRateLimitKey: () => "key", rateLimitResponse: () => new Response(null, { status: 429 }) }));
import { GET, POST } from "@/app/api/search/voice/route";
const request = (options: { consent?: string; duration?: string; file?: File; origin?: string; provider?: string } = {}) => {
  const data = new FormData(); data.append("consent", options.consent ?? "true"); data.append("provider", options.provider ?? "openai"); data.append("durationMs", options.duration ?? "2000");
  data.append("audio", options.file ?? new File([new TextEncoder().encode("RIFF0000WAVE0000")], "consulta.wav", { type: "audio/wav" }));
  return new Request("https://ace.example/api/search/voice", { method: "POST", body: data, headers: options.origin ? { origin: options.origin } : {} });
};
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({ user: { id: "user" } }); mocks.available.mockReturnValue(true); mocks.rate.mockReturnValue({ allowed: true }); mocks.transcribe.mockResolvedValue({ text: "opiniones DTN 2026", uncertain: false, qualityAssessed: true }); });
it("requiere usuario antes de exponer configuración o procesar audio", async () => {
  mocks.auth.mockResolvedValue({ error: new Response(null, { status: 401 }) });
  expect((await GET()).status).toBe(401); expect((await POST(request())).status).toBe(401); expect(mocks.transcribe).not.toHaveBeenCalled();
});
it("muestra proveedor real y disponibilidad sin claves", async () => {
  const response = await GET(); expect(await response.json()).toMatchObject({ provider: "OpenAI", assistantProvider: "gemini", maxSeconds: 45, available: true }); expect(response.headers.get("cache-control")).toBe("no-store");
});
it("rechaza origen ajeno, ausencia de consentimiento y duración fuera de rango", async () => {
  expect((await POST(request({ origin: "https://evil.example" }))).status).toBe(403);
  expect((await POST(request({ consent: "false" }))).status).toBe(400);
  expect((await POST(request({ provider: "gemini" }))).status).toBe(400);
  expect((await POST(request({ duration: "999999" }))).status).toBe(400);
  expect(mocks.transcribe).not.toHaveBeenCalled();
});
it("rechaza audio demasiado grande o con tipo y firma incompatibles", async () => {
  expect((await POST(request({ file: new File([new Uint8Array(3 * 1024 * 1024 + 1)], "a.wav", { type: "audio/wav" }) }))).status).toBe(413);
  expect((await POST(request({ file: new File(["not-a-real-sound!"], "a.wav", { type: "audio/wav" }) }))).status).toBe(415);
  expect((await POST(request({ file: new File(["RIFF0000WAVE0000"], "a.mp4", { type: "audio/mp4" }) }))).status).toBe(415);
  expect(mocks.transcribe).not.toHaveBeenCalled();
});
it("aplica límite de solicitudes y permite escritura si falta configuración", async () => {
  mocks.rate.mockReturnValueOnce({ allowed: false }); expect((await POST(request())).status).toBe(429);
  mocks.available.mockReturnValue(false); expect((await POST(request())).status).toBe(503); expect(mocks.transcribe).not.toHaveBeenCalled();
});
it("transcribe un audio válido sin almacenar y conserva la señal de duda", async () => {
  const response = await POST(request()); expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ text: "opiniones DTN 2026", uncertain: false }); expect(response.headers.get("cache-control")).toBe("no-store"); expect(mocks.transcribe).toHaveBeenCalledOnce();
});
it("no expone errores del proveedor ni publica un éxito falso", async () => {
  mocks.transcribe.mockRejectedValue(new Error("private provider credential detail"));
  const response = await POST(request()); expect(response.status).toBe(503); expect(await response.text()).not.toContain("private provider");
});
it("registra el motivo real en el servidor sin cambiar lo que ve el usuario", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    mocks.transcribe.mockRejectedValue(new Error("Voice provider HTTP 400"));
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("HTTP 400");
    expect(error).toHaveBeenCalledOnce();
    const line = String(error.mock.calls[0][0]);
    expect(line).toContain("[voice-search] proveedor (openai, audio/wav, 16 B, 2000 ms)");
    expect(line).toContain("Voice provider HTTP 400");

    error.mockClear();
    mocks.transcribe.mockRejectedValue(new DOMException("aborted", "AbortError"));
    expect((await POST(request())).status).toBe(503);
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  } finally { error.mockRestore(); warn.mockRestore(); }
});
