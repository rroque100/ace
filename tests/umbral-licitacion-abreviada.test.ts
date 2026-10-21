import { describe, expect, it } from "vitest";
import {
  enRangoLpAbreviadaBienes,
  rangoLpAbreviadaConfigurado,
} from "@/lib/umbral-licitacion-abreviada";

/**
 * El rango de la LP abreviada para bienes es un dato anual de Configuración. La
 * clasificación distingue "no cae" de "no se sabe" (rango sin registrar), igual
 * que el resto de umbrales por cuantía.
 */
describe("rango de la Licitación Pública abreviada para bienes", () => {
  const rango = { min: 500_000, max: 5_000_000 };

  it("está configurado solo con ambos extremos coherentes", () => {
    expect(rangoLpAbreviadaConfigurado(rango)).toBe(true);
    expect(rangoLpAbreviadaConfigurado({ min: 500_000, max: null })).toBe(false);
    expect(rangoLpAbreviadaConfigurado({ min: null, max: 5_000_000 })).toBe(false);
    expect(rangoLpAbreviadaConfigurado(null)).toBe(false);
    // Máximo por debajo del mínimo: rango incoherente, no configurado.
    expect(rangoLpAbreviadaConfigurado({ min: 5_000_000, max: 500_000 })).toBe(false);
  });

  it("una cuantía dentro de la banda corresponde a LP abreviada", () => {
    expect(enRangoLpAbreviadaBienes(500_000, rango)).toBe(true);
    expect(enRangoLpAbreviadaBienes(2_000_000, rango)).toBe(true);
    expect(enRangoLpAbreviadaBienes(5_000_000, rango)).toBe(true);
  });

  it("por debajo del mínimo o por encima del máximo, no corresponde", () => {
    expect(enRangoLpAbreviadaBienes(499_999, rango)).toBe(false);
    expect(enRangoLpAbreviadaBienes(5_000_001, rango)).toBe(false);
  });

  it("sin rango configurado devuelve null (no se sabe)", () => {
    expect(enRangoLpAbreviadaBienes(2_000_000, { min: null, max: null })).toBeNull();
    expect(enRangoLpAbreviadaBienes(2_000_000, null)).toBeNull();
  });

  it("con rango pero cuantía desconocida, no cae (no es null)", () => {
    expect(enRangoLpAbreviadaBienes(null, rango)).toBe(false);
  });
});
