import { describe, expect, it } from "vitest";
import { searchRankFactor } from "../lib/search-ranking";

const fila = (document_type: string, title: string, number: string | null = null, year: number | null = null) => ({
  document_type, title, metadata: { ...(number ? { documentNumber: number } : {}), ...(year ? { year } : {}) },
});
const LEY_32069 = fila("ley", "Ley N.° 32069 — texto actualizado", "32069");
const LEY_30225 = fila("ley", "Ley N.° 30225", "30225");
const REGLAMENTO_32069 = fila("reglamento", "Reglamento de la Ley N.° 32069", "009-2025-EF");
const DS_071 = fila("reglamento", "Decreto Supremo N.° 071-2018-PCM", "071-2018-PCM");
const OPINION_2014 = fila("opinion", "Opinión N° 004-2014/DTN", "004-2014/DTN", 2014);
const OPINION_2026 = fila("opinion", "Opinión N° D000099-2026-OECE-DTN", "D000099-2026-OECE-DTN", 2026);
const PRONUNCIAMIENTO = fila("pronunciamiento", "Pronunciamiento N° 020-2026/OECE-DSAT", "020-2026/OECE-DSAT", 2026);

// Rank que la fusión da a un documento que sale primero en una sola lista, frente a uno que sale
// primero en las dos (el caso medido: la ley derogada duplicaba los puntos de la vigente).
const UNA_LISTA = 1 / 61;
const DOS_LISTAS = 2 / 61;

describe("orden de la búsqueda por significado (caso real: salía primero la Ley 30225)", () => {
  const Q = "qué pasa si el contratista se atrasa en la entrega";

  it("sin pista de régimen, la ley vigente gana a la derogada aunque ella salga en las dos listas", () => {
    expect(UNA_LISTA * searchRankFactor(LEY_32069, Q)).toBeGreaterThan(DOS_LISTAS * searchRankFactor(LEY_30225, Q));
  });
  it("lo mismo con el reglamento vigente frente a un decreto del régimen anterior", () => {
    expect(UNA_LISTA * searchRankFactor(REGLAMENTO_32069, Q)).toBeGreaterThan(DOS_LISTAS * searchRankFactor(DS_071, Q));
  });
  it("la jerarquía: una ley vigente pesa más que una opinión y que un pronunciamiento", () => {
    expect(searchRankFactor(LEY_32069, Q)).toBeGreaterThan(searchRankFactor(OPINION_2026, Q));
    expect(searchRankFactor(OPINION_2026, Q)).toBeGreaterThan(searchRankFactor(PRONUNCIAMIENTO, Q));
  });
  it("los criterios del régimen anterior solo bajan un poco (siguen siendo jurisprudencia útil)", () => {
    const antigua = searchRankFactor(OPINION_2014, Q);
    expect(antigua).toBeGreaterThan(0.7);
    expect(antigua).toBeLessThan(searchRankFactor(OPINION_2026, Q));
  });
});

describe("cuando la consulta pide un régimen, manda ese régimen", () => {
  it("nombrar la Ley 30225 para consultar su contenido sube sus artículos y baja los de la vigente", () => {
    const Q = "artículo 50 de la Ley 30225 infracciones";
    expect(searchRankFactor(LEY_30225, Q)).toBeGreaterThan(searchRankFactor(LEY_32069, Q));
  });
  it("nombrar la Ley 32069 hace lo contrario", () => {
    const Q = "plazo de pago en la Ley 32069";
    expect(searchRankFactor(LEY_32069, Q)).toBeGreaterThan(searchRankFactor(LEY_30225, Q));
  });
  it("en una comparación o consulta de vigencia no se sesga: cada una conserva su jerarquía", () => {
    for (const Q of ["qué cambió entre la Ley 30225 y la Ley 32069", "¿la Ley 30225 sigue vigente?"]) {
      expect(searchRankFactor(LEY_30225, Q), Q).toBeCloseTo(searchRankFactor(LEY_32069, Q), 5);
    }
  });
  it("con la fecha de convocatoria manda la ley que corresponde a esa fecha", () => {
    const antes = "procedimiento convocado el 3 de marzo de 2025, garantías";
    const despues = "procedimiento convocado en junio de 2026, garantías";
    expect(searchRankFactor(LEY_30225, antes)).toBeGreaterThan(searchRankFactor(LEY_32069, antes));
    expect(searchRankFactor(LEY_32069, despues)).toBeGreaterThan(searchRankFactor(LEY_30225, despues));
  });
});

describe("lo que no se puede clasificar no se toca", () => {
  it("una ley ajena a contrataciones no se penaliza ni se premia por régimen", () => {
    const procedimiento = fila("ley", "Ley general de procedimiento administrativo del Estado", "27444");
    expect(searchRankFactor(procedimiento, "garantías")).toBeCloseTo(1.3, 5);
  });
  it("un tipo desconocido pesa 1", () => {
    expect(searchRankFactor(fila("otro", "Documento"), "garantías")).toBe(1);
  });
});
