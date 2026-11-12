import { describe, expect, it } from "vitest";
import { analyzeAnswerLayout, claimTextForCheck } from "@/lib/chat-answer-layout";
import { auditEvidence } from "@/lib/chat-evidence-audit";
import { publishEvidence } from "@/lib/chat-evidence-publication";

// Texto ficticio: aquí no se codifica ninguna regla de contratación pública.
const fuentes = [
  { documentTitle: "Documento sintético", article: "7", excerpt: "Artículo 7. La comisión sintética se calcula con la siguiente fórmula: Comisión = 0.10 x importe / factor. El factor toma los valores siguientes: para expedientes de prueba, factor = 0.40; para expedientes ordinarios, factor = 0.25." },
  { documentTitle: "Otro documento sintético", article: "9", excerpt: "Artículo 9. La oficina sintética revisa el expediente antes del cierre del periodo de prueba." },
];
const intro = "La comisión sintética se calcula con la siguiente fórmula (Artículo 7) [F1]:";
const borrador = [intro, "Comisión = 0.10 x importe / factor", "*   **Para expedientes de prueba**: factor = 0.40", "*   **Para expedientes ordinarios**: factor = 0.25"].join("\n");
const pregunta = "¿Cómo se calcula la comisión sintética?";
// El auditor respalda cada afirmación con el único pasaje de la fuente que cita (o hereda).
const auditorQueRespalda = (rechazar: number[] = []) => async (_system: string, input: string) => JSON.stringify({
  claims: (JSON.parse(input).claims as Array<{ id: number; markers: number[] }>).map((claim) => rechazar.includes(claim.id)
    ? { id: claim.id, status: "insufficient", reason: "Sintético", evidence: [] }
    : { id: claim.id, status: "supported", reason: "Coincide", evidence: claim.markers.map((source) => ({ source, passage: 1 })) }),
});

describe("cita heredada (caso real: la fórmula de la penalidad bajo «…siguiente fórmula (Artículo 120.1) [F4]:»)", () => {
  it("las líneas sin cita que siguen a una frase citada terminada en «:» toman sus marcadores", () => {
    const { claims } = analyzeAnswerLayout(borrador);
    expect(claims[0].markers).toEqual([1]);
    for (const claim of claims.slice(1)) {
      expect(claim.markers, claim.text).toEqual([1]);
      expect(claim.inheritedFrom, claim.text).toBe(1);
    }
  });

  it("reconoce los dos puntos antes de la referencia: «fórmula: (Artículo 7) [F1]»", () => {
    const { claims } = analyzeAnswerLayout("La comisión sintética se calcula con la siguiente fórmula: (Artículo 7) [F1]\nComisión = 0.10 x importe / factor");
    expect(claims[1].inheritedFrom).toBe(1);
  });

  it("los rótulos de una lista anidada mantienen la cadena", () => {
    const { claims } = analyzeAnswerLayout(`${intro}\n*   **Para expedientes de prueba:**\n*   Plazo corto: factor = 0.40\n*   Plazo largo: factor = 0.25`);
    expect(claims.slice(1).map((claim) => claim.inheritedFrom)).toEqual([1, 1, 1]);
  });

  it("no hereda: sin «:», tras un párrafo, tras un título o con cita propia", () => {
    const sinDosPuntos = analyzeAnswerLayout("La comisión sintética se calcula sobre el importe (Artículo 7) [F1].\n*   factor = 0.40");
    expect(sinDosPuntos.claims[1].markers).toEqual([]);
    const parrafo = analyzeAnswerLayout(`${intro}\nComisión = 0.10 x importe / factor\nLa oficina sintética revisa el expediente.\n*   factor = 0.40`);
    expect(parrafo.claims[2].markers).toEqual([]);
    expect(parrafo.claims[3].markers).toEqual([]);
    const titulo = analyzeAnswerLayout(`${intro}\n**Revisión del expediente**\n*   La oficina sintética revisa el expediente.`);
    expect(titulo.claims[2].markers).toEqual([]);
    const propia = analyzeAnswerLayout(`${intro}\n*   La oficina sintética revisa el expediente antes del cierre [F2]\n*   factor = 0.40`);
    expect(propia.claims[1]).toMatchObject({ markers: [2] });
    expect(propia.claims[1].inheritedFrom).toBeUndefined();
    expect(propia.claims[2]).toMatchObject({ markers: [1], inheritedFrom: 1 });
  });

  it("de punta a punta: la fórmula se publica y la respuesta ya no sale «parcial»", async () => {
    const revision = await auditEvidence(borrador, fuentes, undefined, auditorQueRespalda());
    const publicada = publishEvidence(borrador, fuentes, revision, pregunta);
    expect(revision.omittedCount).toBe(0);
    expect(revision.presentation).toBe("verified");
    expect(publicada).toContain("Comisión = 0.10 x importe / factor");
    expect(publicada).toContain("factor = 0.25");
  });

  it("sin la frase que la introduce no se publica, aunque el auditor la respalde", async () => {
    // Otra frase respaldada para que haya respuesta publicada (sin ninguna, el chat muestra el pasaje literal de la fuente).
    const conOtra = `${borrador}\nLa oficina sintética revisa el expediente antes del cierre del periodo de prueba [F2]`;
    const revision = await auditEvidence(conOtra, fuentes, undefined, auditorQueRespalda([1]));
    const publicada = publishEvidence(conOtra, fuentes, revision, pregunta);
    expect(publicada).toContain("La oficina sintética revisa el expediente");
    expect(publicada).not.toContain("Comisión = 0.10");
    expect(publicada).not.toContain("factor = 0.40");
    expect(revision.presentation).toBe("partial");
  });

  it("la cifra de una línea heredada se sigue comprobando contra la fuente heredada", async () => {
    const conCifra = `${intro}\n*   Recargo adicional: 30% del importe`;
    expect(claimTextForCheck(analyzeAnswerLayout(conCifra).claims[1])).toBe("*   Recargo adicional: 30% del importe [F1]");
    const revision = await auditEvidence(conCifra, fuentes, undefined, auditorQueRespalda());
    expect(revision.claims[1].status).toBe("insufficient");
    expect(revision.claims[1].reason).toMatch(/cifra/);
  });

  it("el auditor recibe los marcadores heredados de cada línea", async () => {
    let carga: { claims: Array<{ markers: number[]; inheritedFrom?: number }> } = { claims: [] };
    await auditEvidence(borrador, fuentes, undefined, async (system, input) => { carga = JSON.parse(input); return auditorQueRespalda()(system, input); });
    expect(carga.claims[1]).toMatchObject({ markers: [1], inheritedFrom: 1 });
  });
});
