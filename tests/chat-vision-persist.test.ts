import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ search: vi.fn(), rest: vi.fn(), userRest: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/pinecone", () => ({ searchTextRecords: mocks.search, rerankWithModel: async () => null }));
vi.mock("@/lib/openai-server", () => ({ getOpenAIClient: () => ({ responses: { create: mocks.create } }), legalAnswerModel: "test" }));
vi.mock("@/lib/supabase-server", () => ({ supabaseRest: mocks.rest, supabaseUserRest: mocks.userRest, writeAuditLog: async () => {}, institutionalAuditDetails: (x: unknown) => x }));
import { avisoDegradacionVision } from "@/lib/legal-chat";

describe("avisoDegradacionVision", () => {
  it("sin imágenes no añade advertencias", () => {
    const avisos: string[] = [];
    avisoDegradacionVision(avisos, 0);
    expect(avisos).toEqual([]);
  });

  it("con imágenes añade el aviso de degradación a OCR", () => {
    const avisos: string[] = [];
    avisoDegradacionVision(avisos, 2);
    expect(avisos).toEqual([
      "La imagen no pudo analizarse visualmente en este turno; se usó su transcripción.",
    ]);
  });
});
