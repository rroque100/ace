import { describe, expect, it } from "vitest";
import { buildCaseSearchQuery } from "@/lib/chat-case-attachments";
import type { SelectedCaseAttachment } from "@/lib/chat-case-attachments";

const attachment = (text: string): SelectedCaseAttachment => ({
  id: "image-1",
  sessionId: "session-1",
  name: "tabla.png",
  mime: "image/png",
  text,
  pageCount: 1,
  partial: true,
  method: "imagen-ia",
  storagePath: "private/path",
  createdAt: "",
  lectura: { text, pages: null, label: "lectura parcial" },
});

describe("buildCaseSearchQuery", () => {
  it("mantiene la pregunta y agrega OCR como contexto de búsqueda, no como norma", () => {
    const question = "¿Qué norma aplica a esta tabla?";
    const ocr = "Área usuaria | S/ 250 | requerimiento";
    const query = buildCaseSearchQuery(question, [attachment(ocr)]);

    expect(query).toContain(question);
    expect(query).toContain("Texto extraído de adjuntos privados (contexto de búsqueda, no norma):");
    expect(query).toContain(ocr);
  });

  it("sin adjuntos o sin OCR devuelve exactamente la pregunta original", () => {
    const question = "¿Qué norma aplica?";

    expect(buildCaseSearchQuery(question, [])).toBe(question);
    expect(buildCaseSearchQuery(question, [attachment("  \n ")])).toBe(question);
  });

  it("limita el OCR a maxChars sin truncar la pregunta", () => {
    const question = "consulta";
    const query = buildCaseSearchQuery(question, [attachment("x".repeat(5000))], 100);

    expect(query).toContain(question);
    expect(query).toContain("x".repeat(100));
    expect(query).not.toContain("x".repeat(101));
  });
});
