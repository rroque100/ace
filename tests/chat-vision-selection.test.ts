import { describe, expect, it } from "vitest";
import { MAX_VISION_POR_TURNO, seleccionarVisionAdjuntos } from "../lib/chat-case-attachments";
import type { SelectedCaseAttachment } from "../lib/chat-case-attachments";

function adjunto(partial: Partial<SelectedCaseAttachment>): SelectedCaseAttachment {
  return {
    id: partial.id ?? crypto.randomUUID(),
    sessionId: "sesion",
    name: partial.name ?? "imagen.png",
    mime: partial.mime ?? "image/png",
    text: partial.text ?? "transcripción",
    pageCount: partial.pageCount ?? 1,
    partial: partial.partial ?? true,
    method: partial.method ?? "imagen-ia",
    storagePath: partial.storagePath ?? "ruta",
    createdAt: partial.createdAt ?? "",
    lectura: partial.lectura ?? { text: "transcripción", pages: null, label: "lectura parcial" },
  } as SelectedCaseAttachment;
}

describe("seleccionarVisionAdjuntos", () => {
  it("devuelve vacío sin adjuntos o sin imágenes", () => {
    expect(seleccionarVisionAdjuntos([]).vision).toEqual([]);
    const pdf = adjunto({ mime: "application/pdf" });
    expect(seleccionarVisionAdjuntos([pdf]).vision).toEqual([]);
  });

  it("respeta el orden de los documentos al asignar la referencia C#", () => {
    const primera = adjunto({ createdAt: "2026-01-01" });
    const segunda = adjunto({ createdAt: "2026-01-02" });
    const pdf = adjunto({ mime: "application/pdf" });
    const { vision } = seleccionarVisionAdjuntos([pdf, segunda, primera]);
    expect(vision.map((item) => item.id)).toEqual([segunda.id, primera.id]);
  });

  it("limita a 3 imágenes por turno (las más recientes) y declara las excluidas", () => {
    expect(MAX_VISION_POR_TURNO).toBe(3);
    const documentos = [
      adjunto({ createdAt: "2026-01-01", name: "a.png" }),
      adjunto({ createdAt: "2026-01-02", name: "b.png" }),
      adjunto({ createdAt: "2026-01-03", name: "c.png" }),
      adjunto({ createdAt: "2026-01-04", name: "d.png" }),
      adjunto({ createdAt: "2026-01-05", name: "e.png" }),
    ];
    const { vision, excluidas } = seleccionarVisionAdjuntos(documentos);
    expect(vision.map((item) => item.name)).toEqual(["e.png", "d.png", "c.png"]);
    expect(excluidas.map((item) => item.name)).toEqual(["b.png", "a.png"]);
    expect(excluidas[0].reference).toMatch(/^C\d+$/);
  });

  it("excluidas queda vacío cuando hay 3 o menos imágenes", () => {
    const { excluidas } = seleccionarVisionAdjuntos([adjunto({}), adjunto({})]);
    expect(excluidas).toEqual([]);
  });
});
