import { describe, expect, it } from "vitest";
import { auditEvidence } from "@/lib/chat-evidence-audit";

// Texto ficticio: aquí no se codifica ninguna regla de contratación pública.
const frases = [
  "La constancia sintética se entrega al cierre del expediente de prueba",
  "La oficina sintética revisa el expediente antes del cierre",
  "El titular sintético firma el acta de conformidad de prueba",
  "El registro sintético se actualiza al día siguiente del cierre",
];
const fuentes = [{ documentTitle: "Documento sintético", article: "7", excerpt: `Artículo 7. ${frases.join(". ")}.` }];
const borrador = frases.map((frase) => `${frase} [F1]`).join("\n");
const respalda = (input: string) => JSON.stringify({ claims: (JSON.parse(input).claims as Array<{ id: number }>).map((claim) =>
  ({ id: claim.id, status: "supported", reason: "Coincide", evidence: [{ source: 1, passage: 1 }] })) });

describe("reintento del lote del auditor (caso real: el segundo lote de la penalidad por mora quedaba «No se pudo revisar»)", () => {
  it("un lote que agota el tiempo se reintenta en dos mitades y queda revisado", async () => {
    const tamaños: number[] = [];
    const revision = await auditEvidence(borrador, fuentes, undefined, async (_system, input) => {
      tamaños.push(JSON.parse(input).claims.length);
      if (tamaños.length === 1) throw new Error("timeout");
      return respalda(input);
    });
    expect(tamaños).toEqual([4, 2, 2]);
    expect(revision.reviewStatus).toBe("complete");
    expect(revision.claims.map((claim) => claim.status)).toEqual(["supported", "supported", "supported", "supported"]);
    expect(revision.claims.map((claim) => claim.id)).toEqual([1, 2, 3, 4]);
  });

  it("también si el auditor devuelve JSON roto la primera vez", async () => {
    let llamadas = 0;
    const revision = await auditEvidence(borrador, fuentes, undefined, async (_system, input) => (++llamadas === 1 ? "{\"claims\": [" : respalda(input)));
    expect(llamadas).toBe(3);
    expect(revision.reviewStatus).toBe("complete");
  });

  it("si una mitad vuelve a fallar, el lote entero queda sin revisar (no se publica a medias)", async () => {
    let llamadas = 0;
    const revision = await auditEvidence(borrador, fuentes, undefined, async (_system, input) => {
      llamadas++;
      if (llamadas === 1 || JSON.parse(input).claims[0].id === 3) throw new Error("timeout");
      return respalda(input);
    });
    expect(revision.reviewStatus).toBe("failed");
    expect(revision.claims.every((claim) => claim.status === "insufficient" && /No se pudo revisar/.test(claim.reason))).toBe(true);
  });

  it("con el proveedor caído no insiste más de una vez por lote", async () => {
    let llamadas = 0;
    const revision = await auditEvidence(borrador, fuentes, undefined, async () => { llamadas++; throw new Error("402"); });
    expect(llamadas).toBe(3);
    expect(revision.reviewStatus).toBe("failed");
    expect(revision.failureReason).toBe("provider_error");
  });
});
