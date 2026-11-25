import { describe, expect, it } from "vitest";
import { calcularExposicionMatriz, desdeMatrizRiesgos } from "@/lib/matriz-riesgos";

it("recalcula la exposición de cada fila según la escala de la matriz", () => {
  const matriz = [
    "| Categoría | Riesgo | Evaluación | Responsable |",
    "|---|---|---|---|",
    "| Seguridad | Póliza vencida | P1 × I3 = 9 · Muy alta | Contratista |",
    "| Técnico | Falla hidráulica | P2 × I3 = 5 · Media | Contratista |",
  ].join("\n");
  const resultado = calcularExposicionMatriz(matriz);
  expect(resultado).toContain("| P1 × I3 = 3 · Media |");
  expect(resultado).toContain("| P2 × I3 = 6 · Alta |");
  expect(resultado).toContain("| Categoría | Riesgo | Evaluación | Responsable |");
});

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
