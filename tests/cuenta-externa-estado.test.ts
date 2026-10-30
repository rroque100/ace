import { describe, expect, it } from "vitest";
import { DIAS_AVISO_VIGENCIA, UMBRAL_IA_ALTO, estadoCuentaExterna, fechaFin, textoDias } from "@/lib/cuenta-externa-estado";

const AHORA = Date.UTC(2026, 9, 29, 15, 0, 0);
const DIA = 86_400_000;
const estado = (extra: Partial<Parameters<typeof estadoCuentaExterna>[0]> = {}) => estadoCuentaExterna({ cuota: 100_000, usados: 0, vigenteHasta: null, ahora: AHORA, ...extra });

describe("cuánta IA le queda a una cuenta externa este mes", () => {
  it("sin tope no hay porcentaje ni aviso, por mucho que consuma", () => {
    expect(estado({ cuota: null, usados: 5_000_000 })).toMatchObject({ nivelIA: "sin_tope", porcentajeIA: null });
  });

  it("recorre los niveles: normal, alto al llegar al umbral y agotado al llegar al tope", () => {
    expect(estado({ usados: 0 })).toMatchObject({ nivelIA: "normal", porcentajeIA: 0 });
    expect(estado({ usados: 79_999 })).toMatchObject({ nivelIA: "normal", porcentajeIA: 79 });
    expect(estado({ usados: 80_000 })).toMatchObject({ nivelIA: "alto", porcentajeIA: UMBRAL_IA_ALTO });
    expect(estado({ usados: 99_999 })).toMatchObject({ nivelIA: "alto", porcentajeIA: 99 });
    expect(estado({ usados: 100_000 })).toMatchObject({ nivelIA: "agotado", porcentajeIA: 100 });
  });

  it("pasarse del tope no da más de 100 %: la barra no se desborda", () => {
    expect(estado({ usados: 250_000 })).toMatchObject({ nivelIA: "agotado", porcentajeIA: 100 });
  });

  it("cuota 0 significa «sin IA»: agotada desde el primer día, no «0 de 0»", () => {
    expect(estado({ cuota: 0, usados: 0 })).toMatchObject({ nivelIA: "agotado", porcentajeIA: 100 });
  });

  it("un consumo ilegible o negativo cuenta como cero en vez de romper la barra", () => {
    for (const usados of [-5, Number.NaN, Number.POSITIVE_INFINITY * 0]) expect(estado({ usados }).usados, String(usados)).toBe(0);
  });
});

describe("cuánto le queda de acceso", () => {
  it("sin fecha de fin no hay aviso", () => {
    expect(estado({ vigenteHasta: null })).toMatchObject({ nivelVigencia: "sin_fin", diasRestantes: null });
  });

  it("avisa cuando faltan los días del umbral o menos, y no antes", () => {
    expect(estado({ vigenteHasta: AHORA + (DIAS_AVISO_VIGENCIA + 1) * DIA })).toMatchObject({ nivelVigencia: "normal", diasRestantes: DIAS_AVISO_VIGENCIA + 1 });
    expect(estado({ vigenteHasta: AHORA + DIAS_AVISO_VIGENCIA * DIA })).toMatchObject({ nivelVigencia: "por_vencer", diasRestantes: DIAS_AVISO_VIGENCIA });
  });

  it("el día en curso cuenta como uno: lo que queda de hoy no es «0 días» para quien aún puede entrar", () => {
    expect(estado({ vigenteHasta: AHORA + 3 * 3_600_000 }).diasRestantes).toBe(1);
    expect(estado({ vigenteHasta: AHORA + DIA + 1 }).diasRestantes).toBe(2);
  });

  it("una fecha ya pasada no da días negativos", () => {
    expect(estado({ vigenteHasta: AHORA - 5 * DIA })).toMatchObject({ diasRestantes: 0, nivelVigencia: "por_vencer" });
  });
});

describe("cómo se dicen los días y la fecha", () => {
  it("hoy, mañana o en N días", () => {
    expect(textoDias(0)).toBe("hoy");
    expect(textoDias(1)).toBe("mañana");
    expect(textoDias(5)).toBe("en 5 días");
  });

  it("la fecha sale en hora de Lima, sin puntos de abreviatura", () => {
    // 2 de noviembre 23:59 en Lima es ya 3 de noviembre en UTC: no debe correrse un día.
    expect(fechaFin(Date.parse("2026-11-02T23:59:59-05:00"))).toBe("2 nov 2026");
  });
});
