import { describe, expect, it } from "vitest";
import { auditEvidence } from "@/lib/chat-evidence-audit";
import { parseAlternatives } from "@/lib/chat-alternatives";

// Texto ficticio: aquí no se codifica ninguna regla de contratación pública.
const fuentes = [
  { documentTitle: "Documento sintético A", article: "7", excerpt: "Artículo 7. La constancia sintética equivale al diez por ciento del monto del expediente de prueba." },
  { documentTitle: "Documento sintético B", article: "9", excerpt: "Artículo 9. La constancia sintética puede reducirse a la mitad cuando concluye la etapa de prueba." },
];
const borrador = "La constancia sintética equivale al diez por ciento del monto del expediente de prueba [F1]\nLa constancia sintética puede reducirse a la mitad cuando concluye la etapa de prueba [F2]";
const aprobado = async () => JSON.stringify({ claims: [
  { id: 1, status: "supported", reason: "Coincide", evidence: [{ source: 1, passage: 1 }] },
  { id: 2, status: "supported", reason: "Coincide", evidence: [{ source: 2, passage: 1 }] },
] });

describe("el auditor juzga la fidelidad a la fuente, no si la frase contesta la pregunta (caso real: la reducción de la garantía)", () => {
  it("en una pregunta abierta no recibe la pregunta: solo afirmaciones y fuentes", async () => {
    let carga: Record<string, unknown> = {};
    let sistema = "";
    await auditEvidence(borrador, fuentes, undefined, async (system, input) => { sistema = system; carga = JSON.parse(input); return aprobado(); },
      "¿Qué porcentaje del monto debe tener la constancia sintética?");
    expect(carga).not.toHaveProperty("question");
    expect(carga).not.toHaveProperty("alternatives");
    expect(carga.claims).toHaveLength(2);
    expect(sistema).not.toMatch(/contra la pregunta original/);
  });

  it("en una pregunta de alternativas sí la recibe, con sus opciones, para juzgar la elección", async () => {
    const pregunta = "¿Qué documento corresponde? a) la constancia sintética b) el acta sintética";
    expect(parseAlternatives(pregunta)).not.toBeNull();
    let carga: Record<string, unknown> = {};
    await auditEvidence(borrador, fuentes, undefined, async (_system, input) => { carga = JSON.parse(input); return aprobado(); }, pregunta);
    expect(carga.question).toBe(pregunta);
    expect(carga.alternatives).toEqual(parseAlternatives(pregunta));
  });
});
