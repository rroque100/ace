import { describe, expect, it } from "vitest";
import { auditEvidence, evidenceClaims, validateEvidenceVerdict } from "@/lib/chat-evidence-audit";
import { publishEvidence } from "@/lib/chat-evidence-publication";
import { tidyModelPunctuation } from "@/lib/chat-answer-layout";

// Texto ficticio: aquí no se codifica ninguna regla de contratación pública.
const fuentes = [
  { documentTitle: "Documento sintético A", article: "7", excerpt: "Artículo 7. La constancia sintética se entrega en un plazo de prueba de veinte días desde el cierre del expediente." },
  { documentTitle: "Documento sintético B", article: null, excerpt: "Si el titular no entrega la constancia sintética, la oficina de prueba puede otorgar un plazo adicional al titular." },
];
const frase = "Si el titular no entrega la constancia sintética, la oficina puede otorgar un plazo adicional [F2]";
const veredicto = (evidence: Array<{ source: number; passage?: number; quote?: string }>, status = "supported") =>
  JSON.stringify({ claims: [{ id: 1, status, reason: "Veredicto sintético", evidence }] });

describe("pasaje de una fuente que la frase no cita (caso real: «plazo adicional [F7]» con un pasaje extra de F4)", () => {
  it("el pasaje sobrante se descarta y la frase queda respaldada por su fuente citada", () => {
    const [revision] = validateEvidenceVerdict(veredicto([{ source: 1, passage: 1 }, { source: 2, passage: 1 }]), evidenceClaims(frase), fuentes);
    expect(revision.status).toBe("supported");
    expect(revision.evidence).toEqual([{ source: 2, quote: fuentes[1].excerpt }]);
  });

  it("sin ningún pasaje de una fuente citada, la frase sigue sin publicarse", () => {
    const [revision] = validateEvidenceVerdict(veredicto([{ source: 1, passage: 1 }]), evidenceClaims(frase), fuentes);
    expect(revision.status).toBe("insufficient");
    expect(revision.reason).toMatch(/carece de citas válidas/);
  });

  it("un pasaje inventado de la fuente citada no cuenta, aunque haya otro de una fuente no citada", () => {
    const [revision] = validateEvidenceVerdict(veredicto([{ source: 1, passage: 1 }, { source: 2, quote: "la oficina puede otorgar cualquier plazo que estime" }]), evidenceClaims(frase), fuentes);
    expect(revision.status).toBe("insufficient");
  });

  it("la cifra (porcentaje, UIT, soles) se sigue comprobando contra la fuente citada", () => {
    const conCifra = "La oficina puede otorgar un plazo adicional con un recargo del 30% [F2]";
    const [revision] = validateEvidenceVerdict(veredicto([{ source: 2, passage: 1 }]), evidenceClaims(conCifra), fuentes);
    expect(revision.status).toBe("insufficient");
  });

  it("de punta a punta: la respuesta ya no sale «parcial» por ese pasaje sobrante", async () => {
    const borrador = `La constancia sintética se entrega en un plazo de prueba de veinte días desde el cierre del expediente [F1]\n${frase}`;
    const revision = await auditEvidence(borrador, fuentes, undefined, async () => JSON.stringify({ claims: [
      { id: 1, status: "supported", reason: "Coincide", evidence: [{ source: 1, passage: 1 }] },
      { id: 2, status: "supported", reason: "Coincide", evidence: [{ source: 1, passage: 1 }, { source: 2, passage: 1 }] },
    ] }));
    publishEvidence(borrador, fuentes, revision, "¿En qué plazo se entrega la constancia sintética?");
    expect(revision.omittedCount).toBe(0);
    expect(revision.presentation).toBe("verified");
  });
});

describe("«; ,» entre referencias de una cita (caso real: «(Artículo 61.2.a; , Artículo 113.1.i)»)", () => {
  it("deja solo la coma", () => {
    expect(tidyModelPunctuation("Fideicomiso (Artículo 61.2.a; , Artículo 113.1.i) [F1]")).toBe("Fideicomiso (Artículo 61.2.a, Artículo 113.1.i) [F1]");
    expect(tidyModelPunctuation("(Artículo 113.1; , página 2) [F3]")).toBe("(Artículo 113.1, página 2) [F3]");
    expect(tidyModelPunctuation("(Artículo 61.2.d; , Artículo 113.1.iv; , página 2)")).toBe("(Artículo 61.2.d, Artículo 113.1.iv, página 2)");
    expect(tidyModelPunctuation("(Artículo 113.1; ,)")).toBe("(Artículo 113.1)");
  });

  it("no toca un punto y coma seguido de texto", () => {
    const texto = "Plazo de 10 días (Art. 122.1; numeral a) [F2]; y el 5% (art. 183) [F1].";
    expect(tidyModelPunctuation(texto)).toBe(texto);
  });
});
