import { describe, expect, it } from "vitest";
import { actualizarSeguimientoMatriz, calcularExposicionMatriz, COLUMNAS_MATRIZ, desdeMatrizRiesgos, filasMatriz, revisarMatrizGenerada } from "@/lib/matriz-riesgos";

it("comprueba la escala, la cita del TDR y las referencias normativas antes de insertar", () => {
  const tdr = "Entrega física del terreno según el acta.";
  const tabla = [
    `| ${COLUMNAS_MATRIZ.join(" | ")} |`,
    `|${COLUMNAS_MATRIZ.map(() => "---").join("|")}|`,
    "| Técnico | Entrega tardía | P2 × I3 = 6 | Entidad | Recorrido | Por verificar | Terreno «Entrega física del terreno» | [F1] Asignación | Días | Acta | Verificar frentes | Área usuaria |",
  ].join("\n");
  expect(revisarMatrizGenerada(tabla, 1, tdr)).toEqual([]);
  const penalidad = tabla.replace("Por verificar", "Supuesto: atraso · Obligación: «Entrega física del terreno» · Evidencia: acta");
  expect(revisarMatrizGenerada(penalidad, 1, tdr)).toEqual([]);
  expect(revisarMatrizGenerada(penalidad.replace("Obligación: «Entrega física del terreno»", "Obligación: «Plazo de pago inexistente»"), 1, tdr)[0]).toContain("penalidad");
  expect(revisarMatrizGenerada(tabla.replace("P2", "P5").replace("[F1]", "[F2]"), 1, "Otro documento")).toHaveLength(1);
  const actualizado = actualizarSeguimientoMatriz(tabla, 2, 9, "Acta 01 | firmada");
  expect(filasMatriz(actualizado)[0].valores[9]).toBe("Acta 01   firmada");
  expect(filasMatriz(actualizado)[0].valores[6]).toBe("Terreno «Entrega física del terreno»");
});

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
