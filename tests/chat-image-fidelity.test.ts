import { describe, expect, it } from "vitest";
import { checkImageFaithfulness } from "../lib/chat-image-fidelity";
import type { SelectedCaseAttachment } from "../lib/chat-case-attachments";

function imagen(text: string): SelectedCaseAttachment {
  return {
    id: "id-1", sessionId: "s", name: "captura.png", mime: "image/png",
    text, pageCount: 1, partial: true, method: "imagen-ia", storagePath: "p", createdAt: "",
    lectura: { text, pages: null, label: "lectura parcial" },
  } as SelectedCaseAttachment;
}
function pdf(text: string): SelectedCaseAttachment {
  return { ...imagen(text), id: "id-2", name: "doc.pdf", mime: "application/pdf", method: "pdf-text" };
}

describe("checkImageFaithfulness", () => {
  it("sin imágenes no emite advertencias aunque el dato no conste", () => {
    const advertencias = checkImageFaithfulness("La garantía es 10% [C1].", [pdf("texto sin cifras")]);
    expect(advertencias).toEqual([]);
  });

  it("cifra presente en la transcripción: sin advertencia", () => {
    const advertencias = checkImageFaithfulness("El monto es 8 UIT [C1].", [imagen("El monto máximo es 8 UIT")]);
    expect(advertencias).toEqual([]);
  });

  it("cifra ausente de la transcripción: advertencia con la referencia", () => {
    const advertencias = checkImageFaithfulness("La garantía es 10% [C1].", [imagen("texto sin esa cifra")]);
    expect(advertencias).toHaveLength(1);
    expect(advertencias[0]).toContain("10%");
    expect(advertencias[0]).toContain("C1");
  });

  it("distingue por número: el dato de C2 no se valida contra C1", () => {
    const advertencias = checkImageFaithfulness("Son 4% [C2].", [imagen("otra cosa"), imagen("cuatro por ciento escrito sin cifra")]);
    expect(advertencias).toHaveLength(1);
    expect(advertencias[0]).toContain("C2");
  });

  it("una cifra solo citada a un PDF no genera advertencia (los PDF son texto extraído)", () => {
    const advertencias = checkImageFaithfulness("Son S/ 1,000 [C1].", [pdf("sin el dato")]);
    expect(advertencias).toEqual([]);
  });
});
