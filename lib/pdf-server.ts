/** Import literal: Next debe rastrear el worker aunque PDF.js lo cargue dinámicamente. */
export async function loadServerPdfJs() {
  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("pdfjs-dist/legacy/build/pdf.worker.mjs"),
  ]);
  (globalThis as typeof globalThis & { pdfjsWorker?: typeof worker }).pdfjsWorker = worker;
  return pdfjs;
}
