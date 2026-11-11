import { describe, expect, it } from "vitest";
import { auditEvidence } from "@/lib/chat-evidence-audit";
import { publishEvidence } from "@/lib/chat-evidence-publication";
import { isMultiPartQuestion } from "@/lib/chat-question-plan";
import { chatAnswerSections } from "@/lib/chat-review-presentation";

// Texto ficticio: aquí no se codifica ninguna regla de contratación pública.
const primera = "La comisión sintética se calcula sobre el importe original de prueba.";
const segunda = "La comisión sintética puede reducirse cuando el expediente de prueba se cierra.";
const fuentes = [{ documentTitle: "Documento de prueba", article: "X", pageStart: 2, pageEnd: 2, excerpt: `${primera} ${segunda}` }];
const borrador = `${primera} [F1]\n${segunda} [F1]`;
const aprobada = (id: number, texto: string) => ({ id, status: "supported", reason: "Coincide con el pasaje", evidence: [{ source: 1, quote: texto }] });
const veredicto = JSON.stringify({ claims: [aprobada(1, primera), aprobada(2, segunda)] });

describe("pregunta de varias partes", () => {
  it("reconoce las tres preguntas compuestas medidas en producción", () => {
    for (const pregunta of [
      "¿Qué porcentaje del monto del contrato debe tener la garantía de fiel cumplimiento y cuándo puede reducirse en un contrato de obra?",
      "Si una obra se atrasa por causas imputables al contratista, ¿quién asume el mayor costo de la extensión de la supervisión y qué debe ordenar el supervisor cuando la valorización acumulada es menor al 80% de la programada?",
      "¿Cuándo procede la resolución del contrato de obra por incumplimiento injustificado y cuál es la penalidad máxima por mora?",
    ]) expect(isMultiPartQuestion(pregunta), pregunta).toBe(true);
  });

  it("reconoce la coordinación con un verbo («y puede el contratista…») y varias preguntas escritas", () => {
    expect(isMultiPartQuestion("En un contrato de obra, ¿qué sucede con la diferencia de amortización y puede el contratista pedir reajustes?")).toBe(true);
    expect(isMultiPartQuestion("¿Qué es la garantía de fiel cumplimiento? ¿Cuánto debe valer en obras?")).toBe(true);
  });

  it("una pregunta de una sola parte no lo es, aunque lleve una «y» entre sustantivos", () => {
    for (const pregunta of [
      "¿Qué porcentaje debe tener la garantía de fiel cumplimiento?",
      "¿Qué plazos y condiciones tiene el recurso de apelación?",
      "¿Qué ley rige un procedimiento convocado en junio de 2026?",
      "Diferencias entre la Ley 30225 y la Ley 32069 en penalidades",
    ]) expect(isMultiPartQuestion(pregunta), pregunta).toBe(false);
  });
});

describe("dónde se publica lo verificado", () => {
  const compuesta = "¿Cuánto se calcula la comisión sintética y cuándo puede reducirse?";
  const simple = "¿Sobre qué importe se calcula la comisión sintética?";

  it("en una pregunta compuesta la segunda respuesta queda a la vista, antes de «Disposición y fuente», sin plegarse", async () => {
    const revision = await auditEvidence(borrador, fuentes, undefined, async () => veredicto);
    const publicada = publishEvidence(borrador, fuentes, revision, compuesta);
    expect(publicada).toContain(segunda.replace(/\.$/, ""));
    expect(publicada).not.toContain("**Desarrollo comprobado**");
    expect(publicada.indexOf("puede reducirse cuando")).toBeLessThan(publicada.indexOf("**Disposición y fuente**"));
    // Lo que la interfaz muestra sin abrir nada («main») trae las dos respuestas.
    const principal = chatAnswerSections(publicada, revision).main;
    expect(principal).toContain("se calcula sobre el importe");
    expect(principal).toContain("puede reducirse cuando");
  });

  it("en una pregunta de una sola parte todo sigue como antes: lo demás va a «Desarrollo comprobado»", async () => {
    const revision = await auditEvidence(borrador, fuentes, undefined, async () => veredicto);
    const publicada = publishEvidence(borrador, fuentes, revision, simple);
    expect(publicada).toContain("**Desarrollo comprobado**");
    expect(publicada.indexOf("puede reducirse cuando")).toBeGreaterThan(publicada.indexOf("**Disposición y fuente**"));
    expect(chatAnswerSections(publicada, revision).main).not.toContain("puede reducirse cuando");
  });

  it("lo no comprobado sigue sin publicarse aunque la pregunta sea compuesta", async () => {
    const revision = await auditEvidence(borrador, fuentes, undefined, async () => JSON.stringify({ claims: [aprobada(1, primera), { id: 2, status: "insufficient", reason: "No consta", evidence: [] }] }));
    const publicada = publishEvidence(borrador, fuentes, revision, compuesta);
    expect(publicada).toContain("se calcula sobre el importe");
    expect(publicada).not.toContain("puede reducirse cuando");
  });
});
