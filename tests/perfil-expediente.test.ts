import { describe, expect, it } from "vitest";
import { perfilDelExpediente } from "@/lib/aplicabilidad-fases";

describe("perfil del expediente", () => {
  it("sin datos no dice nada, para no dejar un cartel vacío", () => {
    expect(perfilDelExpediente({})).toBe("");
    expect(perfilDelExpediente({ objeto: "", tipoProceso: "" })).toBe("");
  });

  it("junta objeto y procedimiento", () => {
    expect(perfilDelExpediente({ objeto: "obra", tipoProceso: "Licitación Pública de Obras" })).toBe(
      "Obra · Licitación Pública de Obras.",
    );
  });

  it("con solo el objeto no inventa procedimiento", () => {
    expect(perfilDelExpediente({ objeto: "servicio" })).toBe("Servicios.");
  });

  it("la causal del Art. 55 desplaza a la referencia de la ficha, y se explica", () => {
    const p = perfilDelExpediente({
      causalArt55: "b",
      objeto: "bien",
      tipoProceso: "Licitación Pública para Bienes",
    });
    expect(p).toContain("no competitivo");
    expect(p).toContain("causal b");
    expect(p).not.toContain("Licitación");
  });

  it("el contrato menor manda sobre todo lo demás", () => {
    expect(perfilDelExpediente({ contratoMenor: true, objeto: "bien", tipoProceso: "x" })).toBe(
      "Bienes · contrato menor.",
    );
  });

  it("dice el CEAM en vez del procedimiento anticipado", () => {
    expect(
      perfilDelExpediente({ acuerdoMarco: true, objeto: "bien", tipoProceso: "Licitación Pública para Bienes" }),
    ).toBe("Bienes · catálogo electrónico de acuerdo marco.");
  });
});
