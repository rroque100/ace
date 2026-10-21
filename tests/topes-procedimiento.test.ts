import { describe, expect, it } from "vitest";
import {
  TOPES_2026,
  familiaDeObjeto,
  procedimientosElegibles,
  topesDeConfiguracion,
} from "@/lib/topes-procedimiento";

// Solo los `value` del procedimiento, para comparar cómodo.
const vals = (objeto: string, cuantia: number | null, ficha = false) =>
  procedimientosElegibles(objeto, cuantia, ficha).map((p) => p.value);

describe("familiaDeObjeto", () => {
  it("mapea el enum de la ficha y los rótulos con acento", () => {
    expect(familiaDeObjeto("bienes")).toBe("bienes");
    expect(familiaDeObjeto("servicios")).toBe("servicio");
    expect(familiaDeObjeto("obras")).toBe("obra");
    expect(familiaDeObjeto("consultoria_obra")).toBe("consultoria");
    expect(familiaDeObjeto("Consultoría en general")).toBe("consultoria");
    expect(familiaDeObjeto("")).toBeNull();
    expect(familiaDeObjeto(null)).toBeNull();
  });
});

describe("procedimientosElegibles · sin datos suficientes", () => {
  it("sin objeto o sin cuantía devuelve vacío (no se afirma la modalidad)", () => {
    expect(procedimientosElegibles(null, 100_000, false)).toEqual([]);
    expect(procedimientosElegibles("bienes", null, false)).toEqual([]);
  });
});

describe("procedimientosElegibles · piso (contrato menor)", () => {
  it("cuantía ≤ piso → marcador de contrato menor", () => {
    const r = procedimientosElegibles("bienes", 44_000, false);
    expect(r).toHaveLength(1);
    expect(r[0].value).toBe("");
    expect(r[0].motivo).toContain("contrato menor");
  });
  it("justo por encima del piso ya NO es contrato menor", () => {
    expect(vals("bienes", 44_001)).not.toContain("");
  });
});

describe("procedimientosElegibles · BIENES (485k)", () => {
  it("≥ 485 000 → Licitación Pública para bienes", () => {
    expect(vals("bienes", 485_000)).toContain("Licitación Pública para bienes");
    expect(vals("bienes", 1_000_000)).toContain("Licitación Pública para bienes");
  });
  it("entre piso y 485k → Licitación Pública abreviada para bienes", () => {
    expect(vals("bienes", 200_000)).toContain("Licitación Pública abreviada para bienes");
    expect(vals("bienes", 484_999)).toContain("Licitación Pública abreviada para bienes");
  });
  it("≤ 100 000 añade Comparación de Precios como alternativa", () => {
    expect(vals("bienes", 90_000)).toEqual(
      expect.arrayContaining(["Licitación Pública abreviada para bienes", "Comparación de Precios"]),
    );
    // Por encima de 100k ya no cabe Comparación de Precios.
    expect(vals("bienes", 120_000)).not.toContain("Comparación de Precios");
  });
  it("con ficha técnica añade Subasta Inversa Electrónica (Art. 96.1)", () => {
    expect(vals("bienes", 90_000, true)).toContain("Subasta Inversa Electrónica");
    expect(vals("bienes", 90_000, false)).not.toContain("Subasta Inversa Electrónica");
  });
});

describe("procedimientosElegibles · SERVICIO en general (485k)", () => {
  it("≥ 485 000 → Concurso Público de servicios", () => {
    expect(vals("servicios", 485_000)).toContain("Concurso Público de servicios");
  });
  it("entre piso y 485k → Concurso Público abreviado", () => {
    expect(vals("servicios", 300_000)).toContain("Concurso Público abreviado");
  });
  it("≤ 100 000 añade Comparación de Precios", () => {
    expect(vals("servicios", 80_000)).toContain("Comparación de Precios");
  });
});

describe("procedimientosElegibles · CONSULTORÍA (485k, sin comparación de precios)", () => {
  it("≥ 485 000 → Concurso Público para consultorías", () => {
    expect(vals("consultoria_obra", 600_000)).toEqual([
      "Concurso Público para consultorías y servicios de mantenimiento vial",
    ]);
  });
  it("entre piso y 485k → Concurso Público abreviado (sin Comparación de Precios)", () => {
    const r = vals("consultoria_obra", 90_000);
    expect(r).toContain("Concurso Público abreviado");
    expect(r).not.toContain("Comparación de Precios");
  });
});

describe("procedimientosElegibles · OBRAS (5 millones)", () => {
  it("≥ 5 000 000 → Licitación Pública de obras", () => {
    expect(vals("obras", 5_000_000)).toEqual(["Licitación Pública de obras"]);
  });
  it("entre piso y 5M → Licitación Pública abreviada de obras", () => {
    expect(vals("obras", 4_999_999)).toEqual(["Licitación Pública abreviada de obras"]);
    expect(vals("obras", 100_000)).toEqual(["Licitación Pública abreviada de obras"]);
  });
  it("las obras NO ofrecen Comparación de Precios ni Subasta Inversa", () => {
    expect(vals("obras", 90_000, true)).toEqual(["Licitación Pública abreviada de obras"]);
  });
});

describe("topesDeConfiguracion", () => {
  it("cae al defecto 2026 cuando falta o es inválido", () => {
    expect(topesDeConfiguracion({})).toEqual(TOPES_2026);
    expect(topesDeConfiguracion({ topePiso: "", topeLicitacionConcurso: "abc" })).toEqual(TOPES_2026);
  });
  it("respeta los valores dados (tolerando separadores)", () => {
    const t = topesDeConfiguracion({
      topeAnio: "2027",
      topePiso: "45,000",
      topeLicitacionConcurso: "500000",
      topeLicitacionObras: "5,200,000",
      topeComparacionPrecios: "110000",
    });
    expect(t).toEqual({
      anio: 2027,
      piso: 45_000,
      licitacionConcurso: 500_000,
      licitacionObras: 5_200_000,
      comparacionPrecios: 110_000,
    });
  });
  it("los topes configurados cambian la clasificación", () => {
    const topes2027 = topesDeConfiguracion({ topeLicitacionConcurso: "500000" });
    // Un bien de 490k que en 2026 era Licitación Pública, con umbral 500k pasa a Abreviada.
    const r = procedimientosElegibles("bienes", 490_000, false, topes2027);
    expect(r.map((p) => p.value)).toContain("Licitación Pública abreviada para bienes");
  });
});
