import { describe, expect, it } from "vitest";
import { archivoDocKindLabel, extractFecha, extractResolutionNumber, normalizeArchivoDocKind } from "@/lib/archivo";
import { archivoSearchSchema } from "@/lib/archivo-schema";

describe("extractResolutionNumber", () => {
  it("detecta el número anclado al tipo de acto desde el título", () => {
    expect(
      extractResolutionNumber("RESOLUCION DE ALCALDIA N°004-2024-MDCH-A", "cuerpo cualquiera"),
    ).toBe("004-2024-MDCH-A");
  });

  it("detecta el número desde el cuerpo cuando el título no lo trae", () => {
    expect(
      extractResolutionNumber(
        "documento",
        "RESOLUCIÓN DE ALCALDÍA N° 123-2025-MDCH/A\nVISTOS...",
      ),
    ).toBe("123-2025-MDCH/A");
  });

  it("no captura números que no son del acto", () => {
    expect(extractResolutionNumber("acta sin numeración", "texto sin resolución ni número")).toBeNull();
  });
});

describe("extractFecha", () => {
  it("parsea fecha textual en español a ISO", () => {
    expect(extractFecha("Chao, 15 de enero de 2024\nEl alcalde...")).toBe("2024-01-15");
  });

  it("tolera ausencia de tildes y 'setiembre'", () => {
    expect(extractFecha("Dado el 3 de setiembre del 2023")).toBe("2023-09-03");
  });

  it("parsea fecha numérica dd/mm/yyyy", () => {
    expect(extractFecha("Fecha: 07/03/2022 ref")).toBe("2022-03-07");
  });

  it("devuelve null si no hay fecha reconocible", () => {
    expect(extractFecha("sin fecha alguna")).toBeNull();
  });
});

describe("archivo helpers", () => {
  it("normaliza tipos desconocidos a 'otros'", () => {
    expect(normalizeArchivoDocKind("resolucion_alcaldia")).toBe("resolucion_alcaldia");
    expect(normalizeArchivoDocKind("desconocido")).toBe("otros");
    expect(normalizeArchivoDocKind(null)).toBe("otros");
  });

  it("etiqueta los tipos conocidos", () => {
    expect(archivoDocKindLabel("ordenanza")).toBe("Ordenanza");
    expect(archivoDocKindLabel("xxx")).toBe("Otros");
  });

  it("valida el schema de búsqueda", () => {
    expect(archivoSearchSchema.safeParse({ query: "presupuesto" }).success).toBe(true);
    expect(archivoSearchSchema.safeParse({ query: "a" }).success).toBe(false);
  });
});
