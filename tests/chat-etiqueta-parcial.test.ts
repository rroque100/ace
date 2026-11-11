import { describe, expect, it } from "vitest";
import { isStructuralClaim } from "@/lib/chat-answer-layout";
import { auditEvidence } from "@/lib/chat-evidence-audit";
import { publishEvidence } from "@/lib/chat-evidence-publication";
import { reviewFooter } from "@/lib/chat-review-presentation";

// Texto ficticio: aquí no se codifica ninguna regla de contratación pública.
const primera = "La comisión sintética se calcula sobre el importe original de prueba.";
const segunda = "La comisión sintética puede reducirse cuando el expediente de prueba se cierra.";
const fuentes = [{ documentTitle: "Documento de prueba", article: "X", pageStart: 2, pageEnd: 2, excerpt: `${primera} ${segunda}` }];
const pregunta = "¿Sobre qué importe se calcula la comisión sintética?";
const aprobada = (id: number, texto: string) => ({ id, status: "supported", reason: "Coincide con el pasaje", evidence: [{ source: 1, quote: texto }] });
const rechazada = (id: number) => ({ id, status: "insufficient", reason: "No hay información en las fuentes que respalde esta afirmación.", evidence: [] });

describe("afirmación estructural (encabezado o frase de enlace)", () => {
  it("reconoce los encabezados en negrita y los títulos medidos en producción", () => {
    for (const texto of [
      "**Reducción de la garantía de fiel cumplimiento en contratos de obra**",
      "**Aplicación en el tiempo**",
      "**Acciones del supervisor ante atraso en la valorización acumulada**",
      "**Procedimiento para la Resolución del Contrato**:",
      "## Procedimiento",
      "  **Penalidad Máxima por Mora y Otras Penalidades**  ",
    ]) expect(isStructuralClaim(texto), texto).toBe(true);
  });

  it("reconoce la frase que solo anuncia lo siguiente", () => {
    expect(isStructuralClaim("El procedimiento general para la resolución del contrato por incumplimiento del contratista es el siguiente:")).toBe(true);
  });

  it("nunca lo es lo que lleva una cita, aunque parezca un título", () => {
    expect(isStructuralClaim("**La garantía equivale al 10% del monto** [F3]")).toBe(false);
    expect(isStructuralClaim("Las condiciones son estas: [F2]")).toBe(false);
  });

  it("una afirmación normal sin cita sigue contando (hay que respaldarla o se omite)", () => {
    for (const texto of [
      "La resolución del contrato procede cuando el contratista incumple sus obligaciones contractuales.",
      "La garantía puede reducirse en un **5%** desde la recepción.",
      "Los requisitos son los siguientes: presentar el formato 3.",
      "",
    ]) expect(isStructuralClaim(texto), texto).toBe(false);
  });
});

describe("la etiqueta «parcial»", () => {
  const conTitulo = `**Cálculo de la comisión**\n${primera} [F1]\n**Reducción**\n${segunda} [F1]`;

  it("un título rechazado por el auditor ya no vuelve «parcial» una respuesta completa", async () => {
    const revision = await auditEvidence(conTitulo, fuentes, undefined, async () => JSON.stringify({ claims: [rechazada(1), aprobada(2, primera), rechazada(3), aprobada(4, segunda)] }));
    const publicada = publishEvidence(conTitulo, fuentes, revision, pregunta);
    expect(revision.presentation).toBe("verified");
    expect(revision.omittedCount).toBe(0);
    expect(publicada).toContain("**Respuesta documental**");
    expect(publicada).not.toContain("Respuesta documental parcial");
    expect(reviewFooter(revision, publicada)).toContain("La respuesta mostrada está respaldada por las fuentes citadas.");
  });

  it("una afirmación REAL no respaldada sigue volviéndola «parcial»", async () => {
    const borrador = `${primera} [F1]\nLa comisión sintética se duplica cada año. [F1]`;
    const revision = await auditEvidence(borrador, fuentes, undefined, async () => JSON.stringify({ claims: [aprobada(1, primera), rechazada(2)] }));
    const publicada = publishEvidence(borrador, fuentes, revision, pregunta);
    expect(revision.presentation).toBe("partial");
    expect(revision.omittedCount).toBe(1);
    expect(publicada).toContain("Respuesta documental parcial");
    expect(publicada).not.toContain("se duplica");
  });

  it("el título rechazado sigue sin publicarse (solo deja de contar como omisión)", async () => {
    const revision = await auditEvidence(conTitulo, fuentes, undefined, async () => JSON.stringify({ claims: [rechazada(1), aprobada(2, primera), rechazada(3), aprobada(4, segunda)] }));
    const publicada = publishEvidence(conTitulo, fuentes, revision, pregunta);
    expect(publicada).not.toContain("Cálculo de la comisión");
    expect(publicada).toContain("se calcula sobre el importe");
  });

  it("si además hay una afirmación real omitida junto a los títulos, cuenta solo esa", async () => {
    const borrador = `**Título**\n${primera} [F1]\nLa comisión sintética se duplica cada año. [F1]\n${segunda} [F1]`;
    const revision = await auditEvidence(borrador, fuentes, undefined, async () => JSON.stringify({ claims: [rechazada(1), aprobada(2, primera), rechazada(3), aprobada(4, segunda)] }));
    publishEvidence(borrador, fuentes, revision, pregunta);
    expect(revision.presentation).toBe("partial");
    expect(revision.omittedCount).toBe(1);
  });

  it("si la revisión quedó incompleta no se declara verificada aunque lo omitido sean títulos", async () => {
    const revision = await auditEvidence(conTitulo, fuentes, undefined, async () => JSON.stringify({ claims: [aprobada(2, primera)] }));
    publishEvidence(conTitulo, fuentes, revision, pregunta);
    expect(revision.reviewStatus).toBe("incomplete");
    expect(revision.presentation).toBe("partial");
  });
});
