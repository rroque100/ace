/** Un fragmento OCR de un PDF largo no puede acreditar indexación completa. */
export function assertCompleteOfficialExtraction(extraction: {text: string; ocrPartial: boolean}) {
  if (extraction.ocrPartial) throw new Error("OCR parcial: el documento requiere extracción completa antes de incorporarse al RAG");
  if (extraction.text.length < 120) throw new Error("PDF sin texto suficiente; requiere revisión OCR");
}
