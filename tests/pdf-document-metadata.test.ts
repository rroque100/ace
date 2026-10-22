import { describe, expect, it, vi } from "vitest";
vi.mock("pdf-parse/lib/pdf-parse", () => ({ default: vi.fn() }));
import { detectDocumentNumber, resolveDocumentValidity } from "../lib/pdf-processing";

describe("metadatos de documentos oficiales", () => {
  it.each(["N.°", "N°", "Nº", "N.", ""])("reconoce el número propio con %s y no una ley citada", (prefix) => {
    expect(detectDocumentNumber(`Opinión ${prefix} D000112-2026-OECE-DTN`,
      "Documento firmado en el marco de la Ley N° 27269. Consulte Opinión D000059-2026-OECE-DTN", "opinion"))
      .toBe("D000112-2026-OECE-DTN");
  });
  it("mantiene la vigencia desconocida cuando la revisión está pendiente", () => {
    expect(resolveDocumentValidity({ legalReviewStatus: "pendiente", vigencia: "desconocida" }, "vigente"))
      .toBe("desconocida");
  });
  it("conserva la inferencia para los documentos sin revisión pendiente", () => {
    expect(resolveDocumentValidity({}, "modificado")).toBe("modificado");
  });
});
