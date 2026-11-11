import { describe, expect, it } from "vitest";
import { dropDanglingConnector, renderCheckedAnswer } from "@/lib/chat-answer-layout";
import { auditEvidence } from "@/lib/chat-evidence-audit";
import { publishEvidence } from "@/lib/chat-evidence-publication";

// Texto ficticio: aquí no se codifica ninguna regla de contratación pública.
const ausencia = "Las fuentes no contienen el documento sintético 999.";
const relacionada = "Sin embargo, las fuentes recuperadas describen el documento sintético 009 de prueba. [F1]";

describe("conector suelto al quitar la frase anterior (caso real: «Sin embargo,» al inicio)", () => {
  it("quita el conector y pone la mayúscula", () => {
    for (const conector of ["Sin embargo,", "No obstante,", "Además,", "Asimismo,", "Por otro lado,", "En consecuencia,", "Por lo tanto,", "Pero"]) {
      expect(dropDanglingConnector(`${conector} la regla sintética se aplica. [F1]`), conector).toBe("La regla sintética se aplica. [F1]");
    }
  });

  it("no toca frases que solo empiezan por una palabra parecida", () => {
    for (const texto of ["Además del pago sintético, se exige la constancia. [F1]", "Así lo dispone el documento de prueba. [F1]", "Peruano o extranjero, el postor sintético firma. [F1]", "La regla sintética se aplica. [F1]"]) {
      expect(dropDanglingConnector(texto)).toBe(texto);
    }
  });

  it("al renderizar: si la frase anterior no se publica, el conector se quita", () => {
    expect(renderCheckedAnswer(`${ausencia}\n${relacionada}`, new Set([2]))).toBe("Las fuentes recuperadas describen el documento sintético 009 de prueba. [F1]");
  });

  it("si la frase anterior sí se publica, el conector se respeta", () => {
    const texto = `La regla sintética fija un plazo. [F1]\n${relacionada}`;
    expect(renderCheckedAnswer(texto, new Set([1, 2]))).toBe(`La regla sintética fija un plazo. [F1]\n\n${relacionada}`);
  });

  it("dentro de la misma línea también: la parte anterior descartada deja el conector suelto", () => {
    const linea = "La regla sintética fija un plazo inventado. [F2] No obstante, el documento de prueba fija diez días. [F1]";
    expect(renderCheckedAnswer(linea, new Set([2]))).toBe("El documento de prueba fija diez días. [F1]");
  });

  it("un título entre medias no cuenta: lo que decide es la frase anterior al título", () => {
    const texto = `La regla sintética fija un plazo. [F1]\n**Excepción sintética**\n${relacionada}`;
    const publicado = renderCheckedAnswer(texto, new Set([1, 3]));
    expect(publicado).toContain(relacionada);
  });

  it("caso real de punta a punta: la respuesta publicada ya no empieza por «Sin embargo,»", async () => {
    const fuentes = [{ documentTitle: "Documento de prueba", article: "1", pageStart: 2, pageEnd: 2, excerpt: "El documento sintético 009 de prueba describe las fuentes recuperadas." }];
    const borrador = `${ausencia}\n${relacionada}`;
    const revision = await auditEvidence(borrador, fuentes, undefined, async () => JSON.stringify({
      claims: [
        { id: 1, status: "unsupported", reason: "Ningún pasaje lo dice", evidence: [] },
        { id: 2, status: "supported", reason: "Coincide", evidence: [{ source: 1, quote: "El documento sintético 009 de prueba" }] },
      ],
    }));
    const publicada = publishEvidence(borrador, fuentes, revision, "¿Qué dice el documento sintético 999?");
    expect(publicada).not.toMatch(/Sin embargo/i);
    expect(publicada).toContain("Las fuentes recuperadas describen el documento sintético 009 de prueba.");
  });
});
