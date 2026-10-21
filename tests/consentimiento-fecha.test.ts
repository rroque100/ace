import { describe, expect, it } from "vitest";
import { pasoF2 } from "@/lib/actuaciones-seleccion";
import { calcularVencimiento } from "@/lib/cronograma-fechas";

describe("B8 · fecha de consentimiento calculada desde el otorgamiento", () => {
  const paso = pasoF2("B8")!;
  const campo = paso.campos.find((c) => c.name === "fecha_consentimiento")!;

  it("cita el artículo que regula el consentimiento (Art. 82)", () => {
    expect(paso.baseLegal).toContain("82");
  });

  it("apunta a la fecha de otorgamiento de B7, en días hábiles", () => {
    expect(campo.calcularDesde).toMatchObject({
      hito: "B7",
      campo: "fecha_otorgamiento",
      habiles: true,
    });
  });

  it("Art. 82.1 + Art. 304: el plazo es el de apelación + 1 día hábil, por procedimiento", () => {
    const cd = campo.calcularDesde!;
    // Competitivos: 8 hábiles para apelar (Art. 304.1) + 1.
    expect(cd.diasPorProcedimiento?.licitacion_publica).toBe(9);
    expect(cd.diasPorProcedimiento?.concurso_publico).toBe(9);
    // Abreviados, subasta inversa y comparación de precios: 5 (Art. 304.2/304.3) + 1.
    expect(cd.diasPorProcedimiento?.licitacion_publica_abreviada).toBe(6);
    expect(cd.diasPorProcedimiento?.subasta_inversa_electronica).toBe(6);
    expect(cd.diasPorProcedimiento?.comparacion_precios).toBe(6);
    // Sin procedimiento elegido cae en el plazo de los competitivos.
    expect(cd.dias).toBe(9);
  });

  it("el cálculo desde el otorgamiento descuenta fines de semana y feriados", () => {
    const cd = campo.calcularDesde!;
    // Otorgamiento miércoles 2026-07-22 + 9 hábiles, con 28-29 jul feriado.
    const feriados = new Set(["2026-07-28", "2026-07-29"]);
    const dias = cd.diasPorProcedimiento!.licitacion_publica;
    const fecha = calcularVencimiento("2026-07-22", dias, { habiles: cd.habiles, feriados });
    // 23,24,27,30,31,03,04,05,06 hábiles → 2026-08-06.
    expect(fecha).toBe("2026-08-06");
  });
});
