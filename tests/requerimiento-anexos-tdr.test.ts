import { describe, expect, it } from "vitest";
import { lineasAnexoTdr } from "@/lib/requerimiento-docx";
import { FICHA_SECCIONES } from "@/lib/necesidad-ficha-secciones";

describe("lineasAnexoTdr", () => {
  it("sin adjuntos no produce ninguna línea", () => {
    expect(lineasAnexoTdr([])).toEqual([]);
  });

  it("con adjuntos: encabezado, intro y un nombre por línea", () => {
    expect(lineasAnexoTdr(["TDR_techo.pdf", "EETT_cobertura.pdf"])).toEqual([
      "Anexos",
      "Se adjuntan como anexo los siguientes términos de referencia / especificaciones técnicas:",
      "TDR_techo.pdf",
      "EETT_cobertura.pdf",
    ]);
  });

  it("descarta nombres vacíos", () => {
    expect(lineasAnexoTdr(["", "  ", "TDR.pdf"])).toEqual([
      "Anexos",
      "Se adjuntan como anexo los siguientes términos de referencia / especificaciones técnicas:",
      "TDR.pdf",
    ]);
  });
});

describe("orden de secciones del requerimiento", () => {
  it("el 3.4 (Términos de referencia) precede al 3.5 (Requisitos de calificación)", () => {
    const titulos = FICHA_SECCIONES.map((s) => s.title);
    const i34 = titulos.findIndex((t) => t.startsWith("3.4"));
    const i35 = titulos.findIndex((t) => t.startsWith("3.5 Requisitos"));
    expect(i34).toBeGreaterThanOrEqual(0);
    expect(i35).toBeGreaterThan(i34);
  });
});
