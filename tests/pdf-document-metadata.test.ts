import { describe, expect, it, vi } from "vitest";
vi.mock("pdf-parse/lib/pdf-parse", () => ({ default: vi.fn() }));
import { detectDocumentNumber, resolveDocumentValidity, resolvePublishedDocumentNumber } from "../lib/pdf-processing";

describe("metadatos de documentos oficiales", () => {
  it("una guía oficial sin número no hereda el de una ley citada",()=>{
    expect(resolvePublishedDocumentNumber({officialPublicationUrl:"https://www.gob.pe/guia"},"27269")).toBeNull();
    expect(resolvePublishedDocumentNumber({officialPublicationUrl:"https://www.gob.pe/opinion",number:"D000112-2026-OECE-DTN"},"27269")).toBe("D000112-2026-OECE-DTN");
    expect(resolvePublishedDocumentNumber({},"32069")).toBe("32069");
  });
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
