import { describe, expect, it, vi } from "vitest";
import { auditEvidence, evidenceClaims, initialEvidenceReview, selectCoherentEvidence, validateEvidenceVerdict, isRegimeComparison } from "@/lib/chat-evidence-audit";
import { publishEvidence } from "@/lib/chat-evidence-publication";
import { checkCitationFaithfulness } from "@/lib/citation-faithfulness";

// Synthetic rules only: these are NOT statements of Peruvian law.
const sources = [{ documentTitle: "Documento sintético A", excerpt: "La comisión de evaluación será del 10% del importe de prueba. No se exige garantía en el supuesto sintético.", regime: "sintético A", regimeReviewed: true }];
const claim = "La comisión de evaluación será del 10% del importe de prueba. [F1]";
const verdict = (status: string = "supported", quote = sources[0].excerpt) => JSON.stringify({ claims: [{ id: 1, status, reason: "Veredicto sintético", evidence: [{ source: 1, quote }] }] });

describe("publicación con respaldo documental", () => {
  it("comprueba todas las líneas, incluidas las que no tienen cita", () => {
    expect(evidenceClaims(`**Respuesta directa**\n${claim}\nUna segunda conclusión sin cita.`)).toHaveLength(2);
    expect(validateEvidenceVerdict(verdict(), evidenceClaims(`${claim}\nUna segunda conclusión sin cita.`), sources)[1].status).toBe("insufficient");
  });
  it("rechaza pasajes inventados, marcadores ajenos y revisiones duplicadas", () => {
    expect(validateEvidenceVerdict(verdict("supported", "Este pasaje no figura en el documento"), evidenceClaims(claim), sources)[0].status).toBe("insufficient");
    expect(validateEvidenceVerdict(verdict(), evidenceClaims("Otra regla [F99]"), sources)[0].status).toBe("insufficient");
    expect(validateEvidenceVerdict(JSON.stringify({ claims: Array(2).fill(JSON.parse(verdict()).claims[0]) }), evidenceClaims(claim), sources)[0].status).toBe("insufficient");
  });
  it("distingue respaldo automático de aplicación incluso con contexto completo", async () => {
    const review = await auditEvidence(claim, sources, { regime: "declarado", dates: "fecha declarada", facts: "hechos declarados", object: "objeto declarado" }, async () => verdict());
    expect(review.documentary).toBe("checked");
    expect(review.applicability).toBe("pending");
    expect(review.missing).toEqual([]);
  });
  it("no publica un porcentaje correcto cuando el revisor encuentra otro sujeto", async () => {
    const wrong = "La garantía será del 10% del importe de prueba. [F1]";
    expect(checkCitationFaithfulness(wrong, sources).ok).toBe(true); // numeric presence alone is insufficient
    const review = await auditEvidence(wrong, sources, undefined, async () => verdict("contradicted"));
    expect(review.documentary).toBe("unchecked");
    expect(publishEvidence(wrong, sources, review, "¿Qué garantía corresponde?")).not.toContain(wrong);
  });
  it("cierra ante error o JSON inválido y conserva límites explícitos", async () => {
    for (const complete of [async () => "{}", async () => { throw new Error("provider unavailable"); }]) {
      const review = await auditEvidence(claim, sources, undefined, complete);
      expect(review.documentary).toBe("unchecked");
      expect(review.warnings.length).toBeGreaterThan(0);
    }
  });
  it("limita el trabajo y no inicia una revisión sin fuentes", async () => {
    const complete = vi.fn();
    await auditEvidence(Array(25).fill(claim).join("\n"), sources, undefined, complete);
    await auditEvidence(claim, [], undefined, complete);
    expect(complete).not.toHaveBeenCalled();
    expect(initialEvidenceReview().missing).toContain("objeto contractual");
  });
  it("avisa mezcla de regímenes revisados sin deducir aplicación por fecha", async () => {
    const review = await auditEvidence(claim, [...sources, { ...sources[0], regime: "sintético B" }], undefined, async () => verdict());
    expect(review.warnings.join(" ")).toContain("distintos regímenes");
    expect(review.applicability).toBe("pending");
  });
  it("no concatena cifras ni confunde unidades al comprobar datos", () => {
    expect(checkCitationFaithfulness("Dato 10% [F1]", [{ excerpt: "Página 1 y artículo 0; valor 10 UIT, porcentaje 1.0%." }]).ok).toBe(false);
    expect(checkCitationFaithfulness("Dato 8 UIT [F1]", [{ excerpt: "El valor de prueba es 18 UIT." }]).ok).toBe(false);
    expect(checkCitationFaithfulness("Dato 10 % [F1]", sources).ok).toBe(true);
  });
  it("rechaza el traslado de servicios a obras aun si el modelo declara respaldo", () => {
    const scoped = [{ documentTitle: "Regla sintética", excerpt: "La comisión en servicios será del 10% del importe de prueba." }];
    const raw = JSON.stringify({ claims: [{ id: 1, status: "supported", reason: "Misma cifra", evidence: [{ source: 1, quote: scoped[0].excerpt }] }] });
    expect(validateEvidenceVerdict(raw, evidenceClaims("La comisión en obras será del 10% del importe de prueba. [F1]"), scoped)[0].status).toBe("insufficient");
  });
  it("no asigna a una frase sin cita la referencia de la afirmación anterior", () => {
    const claims = evidenceClaims("Una afirmación citada [F1]. Otra conclusión sin respaldo.");
    expect(claims).toHaveLength(2);
    expect(claims[1].markers).toEqual([]);
  });
  it("separa familias documentales sin convertirlas en régimen confirmado", () => {
    const old = { ...sources[0], documentTitle: "Ley 30225" };
    const other = { ...sources[0], documentTitle: "Reglamento de la Ley 32069" };
    expect(selectCoherentEvidence([old, other], "Consulta general")).toEqual([old]);
    expect(selectCoherentEvidence([old, other], "Consulta general", { regime: "Ley 32069", dates: "", facts: "" })).toEqual([other]);
    expect(selectCoherentEvidence([old, other], "Compara la Ley 30225 y 32069")).toHaveLength(2);
    expect(isRegimeComparison("Comparación de precios según la Ley 32069")).toBe(false);
  });
  it("comprueba cifras con marcadores anotados y agrupados", () => {
    expect(checkCitationFaithfulness("Dato 11% [F1, Artículo de prueba]", sources).ok).toBe(false);
    expect(checkCitationFaithfulness("Dato 10% [F1, F2]", sources).ok).toBe(true);
  });
});
