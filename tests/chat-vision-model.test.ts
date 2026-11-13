import { afterEach, describe, expect, it, vi } from "vitest";

describe("legalAnswerVisionModel", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("con Z.ai activo usa el modelo de visión glm-4.5v (legalAnswerModel es texto puro)", async () => {
    vi.resetModules();
    vi.stubEnv("ZAI_API_KEY", "test");
    vi.stubEnv("GOOGLE_API_KEY", "");
    const { legalAnswerVisionModel } = await import("../lib/openai-server");
    expect(legalAnswerVisionModel).toBe("glm-4.5v");
  });

  it("con override ZAI_VISION_MODEL lo respeta", async () => {
    vi.resetModules();
    vi.stubEnv("ZAI_API_KEY", "test");
    vi.stubEnv("ZAI_VISION_MODEL", "glm-4.6v");
    const { legalAnswerVisionModel } = await import("../lib/openai-server");
    expect(legalAnswerVisionModel).toBe("glm-4.6v");
  });

  it("con Gemini activo usa el mismo legalAnswerModel (gemini-2.5-flash ya soporta visión)", async () => {
    vi.resetModules();
    vi.stubEnv("GOOGLE_API_KEY", "test");
    const { legalAnswerVisionModel, legalAnswerModel } = await import("../lib/openai-server");
    expect(legalAnswerVisionModel).toBe(legalAnswerModel);
    expect(legalAnswerVisionModel).toBe("gemini-2.5-flash");
  });
});
