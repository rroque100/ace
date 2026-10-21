import { expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { loadServerPdfJs } from "../lib/pdf-server";

it("abre y rasteriza un PDF con el worker explícito, sin llamadas a IA", async () => {
  const source = await PDFDocument.create();
  source.addPage([100, 100]);
  const pdfjs = await loadServerPdfJs();
  const task = pdfjs.getDocument({ data: await source.save() });
  const doc = await task.promise;
  try {
    expect(doc.numPages).toBe(1);
    const page = await doc.getPage(1);
    const { createCanvas } = await import("@napi-rs/canvas");
    const canvas = createCanvas(100, 100);
    await page.render({ canvas: canvas as unknown as HTMLCanvasElement, canvasContext: canvas.getContext("2d") as never, viewport: page.getViewport({ scale: 1 }) }).promise;
    expect(canvas.toBuffer("image/png").length).toBeGreaterThan(0);
  } finally { await task.destroy(); }
});
