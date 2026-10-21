export class PdfReadError extends Error {
  constructor(message: string, public status: number, public retryable: boolean) {
    super(message);
    this.name = "PdfReadError";
  }
}

export function classifyPdfError(error: unknown): PdfReadError {
  if (error instanceof PdfReadError) return error;
  const message = error instanceof Error ? error.message : String(error);
  if (/PasswordException|password.*required|encrypted|incorrect password/i.test(message)) {
    return new PdfReadError("El PDF está protegido. Sube una copia sin contraseña.", 422, false);
  }
  if (/InvalidPDFException|Invalid PDF|bad XRef|no.*texto.*suficiente|ilegible/i.test(message)) {
    return new PdfReadError("No se pudo leer el contenido del PDF. Verifica el archivo o la calidad del escaneo.", 422, false);
  }
  if (/worker|Cannot find module|canvas|wasm/i.test(message)) {
    return new PdfReadError("El lector de PDF no está disponible en el servidor. El archivo no necesariamente está dañado. Intenta nuevamente o contacta al administrador.", 503, true);
  }
  return new PdfReadError("No se pudo completar la lectura del PDF en el servidor. Intenta nuevamente.", 503, true);
}
