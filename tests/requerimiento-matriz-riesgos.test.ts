import { describe, expect, it } from "vitest";
import { segmentarParrafoMd } from "@/lib/markdown-tabla";
import { estructuraDelRequerimiento } from "@/lib/requerimiento-estructura";

/**
 * La matriz de riesgos (Art. 44.3) la redacta el copiloto como tabla Markdown
 * con pipes. `segmentarParrafoMd` separa esa tabla del texto para que el .docx la
 * pinte como TABLA nativa y no como líneas de «|».
 */
describe("segmentarParrafoMd", () => {
  it("texto suelto es un párrafo", () => {
    expect(segmentarParrafoMd("Hola mundo")).toEqual([{ tipo: "parrafo", texto: "Hola mundo" }]);
  });

  it("una línea con guion o viñeta es viñeta", () => {
    expect(segmentarParrafoMd("- uno\n• dos")).toEqual([
      { tipo: "vineta", texto: "uno" },
      { tipo: "vineta", texto: "dos" },
    ]);
  });

  it("detecta una tabla Markdown, descarta el separador y trima las celdas", () => {
    const md = [
      "Sustento previo de la matriz.",
      "",
      "| Categoría | Identificación del Riesgo |",
      "|---|---|",
      "| Técnico | Deficiencias en el expediente |",
      "| Financiero | Desabastecimiento de materiales |",
    ].join("\n");
    expect(segmentarParrafoMd(md)).toEqual([
      { tipo: "parrafo", texto: "Sustento previo de la matriz." },
      {
        tipo: "tabla",
        filas: [
          ["Categoría", "Identificación del Riesgo"],
          ["Técnico", "Deficiencias en el expediente"],
          ["Financiero", "Desabastecimiento de materiales"],
        ],
      },
    ]);
  });

  it("un pipe suelto en prosa NO es tabla (hace falta la fila separadora)", () => {
    expect(segmentarParrafoMd("coste a | b sin separador")).toEqual([
      { tipo: "parrafo", texto: "coste a | b sin separador" },
    ]);
  });

  it("texto después de la tabla vuelve a ser párrafo", () => {
    const md = ["| A | B |", "|---|---|", "| 1 | 2 |", "", "Nota final."].join("\n");
    expect(segmentarParrafoMd(md)).toEqual([
      { tipo: "tabla", filas: [["A", "B"], ["1", "2"]] },
      { tipo: "parrafo", texto: "Nota final." },
    ]);
  });
});

describe("gestión de riesgos en el requerimiento: solo la matriz", () => {
  it("el Word recorta el sustento y arranca en el encabezado de la matriz", () => {
    const ficha: Record<string, string> = {
      gestionRiesgos: [
        "La Municipalidad… inicia la identificación y evaluación de riesgos…",
        "",
        "A continuación, se presenta la matriz…",
        "",
        "MATRIZ DE GESTIÓN DE RIESGOS",
        "| Categoría | Riesgo |",
        "|---|---|",
        "| Técnico | Deficiencias |",
      ].join("\n"),
    };
    const campo = estructuraDelRequerimiento([], ficha)
      .flatMap((s) => s.campos)
      .find((c) => c.api === "gestionRiesgos");
    expect(campo).toBeDefined();
    expect(campo!.valor.startsWith("MATRIZ DE GESTIÓN DE RIESGOS")).toBe(true);
    expect(campo!.valor).not.toContain("La Municipalidad");
  });
});
