import { describe, expect, it } from "vitest";
import { auditCaseReading, splitCaseReading } from "@/lib/chat-case-evidence";
import type { SelectedCaseAttachment } from "@/lib/chat-case-attachments";

const doc = (text: string): SelectedCaseAttachment => ({
  id: "id-1", sessionId: "s", name: "tabla.png", mime: "image/png", text,
  pageCount: 1, partial: true, method: "imagen-ia", storagePath: "private", createdAt: "",
  lectura: { text, pages: null, label: "lectura parcial" },
});

const verdict = (status: string, quote: string) => JSON.stringify({ claims: [{
  id: 1, status, reason: "Comparación con OCR sintético", evidence: [{ source: 1, quote }],
}] });

describe("evidencia privada C#", () => {
  it("separa los encabezados bold y markdown y los quita del contenido", () => {
    const bold = splitCaseReading("**Lectura del documento**\nÁrea usuaria: 8 unidades [C1]\n\n**Análisis normativo**\nConclusión [F1]");
    expect(bold.reading).toContain("8 unidades [C1]");
    expect(bold.reading).not.toContain("Lectura del documento");
    expect(bold.legalAnswer).toContain("Conclusión [F1]");
    expect(bold.legalAnswer).not.toContain("Análisis normativo");

    const markdown = splitCaseReading("## Lectura del documento\nLa tabla muestra 8 unidades [C1]\n## Respuesta normativa\nConclusión [F1]");
    expect(markdown.reading).toContain("La tabla muestra 8 unidades [C1]");
    expect(markdown.legalAnswer).toContain("Conclusión [F1]");
    expect(markdown.legalAnswer).not.toContain("Respuesta normativa");
  });

  it("rescata en fallback solo líneas C no mixtas y conserva texto-only entero", () => {
    const split = splitCaseReading("Descripción [C1]\nConclusión [F1]\nLínea mixta [C1] [F1]");
    expect(split.reading).toBe("Descripción [C1]");
    expect(split.legalAnswer).toContain("Conclusión [F1]");
    expect(split.legalAnswer).toContain("Línea mixta [C1] [F1]");
    const headedMixed = splitCaseReading("## Lectura del documento\nLínea mixta [C1] [F1]\n## Análisis\nConclusión [F1]");
    expect(headedMixed.reading).toBe("");
    expect(headedMixed.legalAnswer).toContain("Línea mixta [C1] [F1]");
    const textOnly = "**Respuesta**\nUna respuesta sin citas legales ni documentales.";
    expect(splitCaseReading(textOnly)).toEqual({ reading: "", legalAnswer: textOnly });
  });

  it("publica con C1 una lectura respaldada literalmente por su OCR, nunca F1", async () => {
    const quote = "Área usuaria: 8 unidades";
    const review = await auditCaseReading(`${quote} [C1]`, [doc(quote)], async () => verdict("supported", quote));
    expect(review.published).toContain(`${quote} [C1]`);
    expect(review.published).toContain("En el documento se lee:");
    expect(review.published).not.toContain("[F1]");
    expect(review.unverified).toBe("");
    expect(review.supported).toBe(1);
  });

  it("mapea C2 al segundo adjunto y no incluye OCR no citado en su auditoría", async () => {
    const quote = "El cuadro registra 12 filas";
    let payload = "";
    const review = await auditCaseReading(`${quote} [C2]`, [doc("Otro contenido no citado"), doc(quote)], async (_system, value) => {
      payload = value;
      return verdict("supported", quote);
    });
    expect(review.published).toContain(`${quote} [C2]`);
    const sources = JSON.parse(payload).sources as Array<{ excerpt: string }>;
    expect(sources).toHaveLength(1);
    expect(sources[0].excerpt).toBe(quote);
  });

  it("mantiene pendiente una lectura C válida que el revisor contradice", async () => {
    const quote = "El cuadro registra 12 filas";
    const review = await auditCaseReading(`${quote} [C1]`, [doc(quote)], async () => verdict("contradicted", quote));
    expect(review.published).not.toContain(quote);
    expect(review.unverified).toContain(`${quote} [C1]`);
    expect(review.warnings.join(" ")).toMatch(/OCR|transcripción/i);
  });

  it("no comprueba S/ 80 si el OCR dice S/ 8: conserva pendiente con aviso", async () => {
    const review = await auditCaseReading("Área usuaria: S/ 80 [C1]", [doc("Área usuaria: S/ 8")], async () => verdict("supported", "Área usuaria: S/ 8"));
    expect(review.published).not.toContain("S/ 80");
    expect(review.unverified).toContain("S/ 80");
    expect(review.warnings.join(" ")).toMatch(/original|transcripción|comprobar/i);
  });

  it("instruye no determinar si el contenido es una obligación vigente o aplicable", async () => {
    let reviewerPrompt = "";
    const quote = "En el documento se lee: se requiere autorización";
    await auditCaseReading(`${quote} [C1]`, [doc(quote)], async (system) => {
      reviewerPrompt = system;
      return verdict("supported", quote);
    });
    expect(reviewerPrompt).toContain("No determines si el contenido es una obligación jurídica vigente o aplicable");
  });

  it("omite marcadores C desconocidos sin presentar su afirmación", async () => {
    const review = await auditCaseReading("Área usuaria: 8 unidades [C2]", [doc("Área usuaria: 8 unidades")], async () => verdict("supported", "Área usuaria: 8 unidades"));
    expect(review.published).not.toContain("Área usuaria");
    expect(review.unverified).not.toContain("Área usuaria");
    expect(review.omitted).toBe(1);
  });
});
