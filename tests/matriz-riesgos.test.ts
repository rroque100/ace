import { describe, expect, it } from "vitest";
import { desdeMatrizRiesgos } from "@/lib/matriz-riesgos";

describe("desdeMatrizRiesgos", () => {
  it("recorta el sustento previo y arranca en el encabezado de la matriz", () => {
    const texto = [
      "La Municipalidad distrital de Challhuahuacho, en cumplimiento del Art. 46…",
      "",
      "A continuación, se presenta la matriz de riesgos identificados…",
      "",
      "MATRIZ DE GESTIÓN DE RIESGOS",
      "Nombre de la contratación: Confección e instalación…",
      "| Categoría | Riesgo |",
      "|---|---|",
      "| Técnico | Deficiencias |",
    ].join("\n");
    const out = desdeMatrizRiesgos(texto);
    expect(out.startsWith("MATRIZ DE GESTIÓN DE RIESGOS")).toBe(true);
    expect(out).not.toContain("La Municipalidad distrital");
    expect(out).not.toContain("A continuación");
    expect(out).toContain("| Técnico | Deficiencias |");
  });

  it("si no hay encabezado, devuelve el texto completo", () => {
    expect(desdeMatrizRiesgos("solo sustento, sin matriz")).toBe("solo sustento, sin matriz");
  });

  it("tolera la falta de tilde en «GESTION»", () => {
    const out = desdeMatrizRiesgos("intro\nMATRIZ DE GESTION DE RIESGOS\ncuerpo");
    expect(out.startsWith("MATRIZ DE GESTION DE RIESGOS")).toBe(true);
  });

  it("vacío o undefined devuelven cadena vacía", () => {
    expect(desdeMatrizRiesgos("")).toBe("");
    expect(desdeMatrizRiesgos(undefined)).toBe("");
  });
});
