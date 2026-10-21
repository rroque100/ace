import { describe, expect, it } from "vitest";
import { runsConFormato } from "@/lib/segmentacion-informe";

// Los apartados narrativos del informe (PARA/DE, justificación, gestión de
// riesgos) los escribe una persona y acaban en un .docx que se firma. Antes
// viajaban como texto plano: los asteriscos salían impresos tal cual.

const partes = (t: string) =>
  runsConFormato(t).map((r) => JSON.parse(JSON.stringify(r)));

describe("runsConFormato", () => {
  it("un texto sin marcas produce un solo trozo", () => {
    expect(runsConFormato("Texto normal")).toHaveLength(1);
  });

  it("separa la negrita del resto", () => {
    // "El monto **S/ 18,750.00** supera" → 3 trozos.
    expect(runsConFormato("El monto **S/ 18,750.00** supera")).toHaveLength(3);
  });

  it("admite cursiva y subrayado", () => {
    expect(runsConFormato("un *matiz* y un __énfasis__")).toHaveLength(4);
  });

  it("no deja los marcadores dentro del texto impreso", () => {
    const json = JSON.stringify(partes("El monto **S/ 18,750.00** supera"));
    expect(json).not.toContain("**");
    expect(json).toContain("S/ 18,750.00");
  });

  it("varias marcas en la misma línea no se pisan", () => {
    expect(runsConFormato("**a** normal *b* y **c**")).toHaveLength(5);
  });

  it("un asterisco suelto no rompe nada: se imprime tal cual", () => {
    const r = runsConFormato("2 * 3 = 6");
    expect(r).toHaveLength(1);
  });

  it("un texto vacío devuelve un trozo vacío, no una lista vacía", () => {
    // Devolver [] dejaría el párrafo sin hijos y Word lo colapsa.
    expect(runsConFormato("")).toHaveLength(1);
  });

  it("tolera null y undefined: las celdas de tabla se arman con datos que faltan", () => {
    // Sin esta coerción, una celda vacía tumbaba la generación entera del .docx.
    expect(runsConFormato(null)).toHaveLength(1);
    expect(runsConFormato(undefined)).toHaveLength(1);
  });
});
