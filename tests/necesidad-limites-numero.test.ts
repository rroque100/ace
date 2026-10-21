import { describe, expect, it } from "vitest";
import { acotarNumero, necesidadUpdateSchema } from "@/lib/necesidades";
import { FICHA_SECCIONES } from "@/lib/necesidad-ficha-secciones";

// Campos numéricos de la ficha que DECLARAN rango (min/max). Son los que el
// cliente acota antes de mandar el PATCH; su rango DEBE coincidir con el schema,
// o el capado dejaría pasar un valor que el servidor rechaza con 400.
const CAMPOS_CON_RANGO = FICHA_SECCIONES.flatMap((s) => s.fields).filter(
  (f) => f.kind === "number" && (f.min !== undefined || f.max !== undefined),
);

describe("el rango de cada campo numérico de la ficha coincide con el schema", () => {
  it("hay campos con rango (la lista no está vacía por un cambio de forma)", () => {
    expect(CAMPOS_CON_RANGO.map((f) => f.api)).toEqual(
      expect.arrayContaining(["trimestre", "mesProgramado", "plazoRespuestas", "conformidadPlazo", "conformidadPlazoSubsanacion"]),
    );
  });

  for (const f of CAMPOS_CON_RANGO) {
    it(`${f.api}: el schema acepta el rango [${f.min ?? "—"}, ${f.max ?? "—"}] y rechaza fuera`, () => {
      if (f.max !== undefined) {
        expect(necesidadUpdateSchema.safeParse({ [f.api]: f.max }).success, `acepta max=${f.max}`).toBe(true);
        expect(necesidadUpdateSchema.safeParse({ [f.api]: f.max + 1 }).success, `rechaza max+1=${f.max + 1}`).toBe(false);
      }
      if (f.min !== undefined) {
        expect(necesidadUpdateSchema.safeParse({ [f.api]: f.min }).success, `acepta min=${f.min}`).toBe(true);
        expect(necesidadUpdateSchema.safeParse({ [f.api]: f.min - 1 }).success, `rechaza min-1=${f.min - 1}`).toBe(false);
      }
    });
  }
});

describe("acotarNumero mantiene la ficha guardable", () => {
  it("recorta por encima del máximo y por debajo del mínimo", () => {
    expect(acotarNumero(500, 1, 365)).toBe(365);
    expect(acotarNumero(0, 1, 365)).toBe(1);
    expect(acotarNumero(9, 1, 4)).toBe(4);
  });

  it("redondea a entero (el schema pide `.int()` en estos campos)", () => {
    expect(acotarNumero(10.7, 1, 365)).toBe(11);
    expect(acotarNumero(2.4, 1, 12)).toBe(2);
  });

  it("un valor ya válido no se altera", () => {
    expect(acotarNumero(200, 1, 365)).toBe(200);
    expect(acotarNumero(7, 1, 999)).toBe(7);
  });

  it("el valor acotado SIEMPRE pasa el schema, venga como venga", () => {
    for (const f of CAMPOS_CON_RANGO) {
      for (const bruto of [-999, 0, 0.5, f.max ?? 0, (f.max ?? 0) + 1000, 1e9]) {
        const v = acotarNumero(bruto, f.min, f.max);
        expect(necesidadUpdateSchema.safeParse({ [f.api]: v }).success, `${f.api} con bruto=${bruto} → ${v}`).toBe(true);
      }
    }
  });
});
