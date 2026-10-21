import { describe, expect, it } from "vitest";
import { avisosA10, cronogramaRequerimientosDetalle } from "@/lib/actuaciones-preparatorias";

// El anuncio de contratación futura es discrecional (Art. 43), pero si se publica
// con al menos 40 días calendario de anticipación a la convocatoria habilita la
// reducción del plazo entre convocatoria y presentación de ofertas (Art. 64.3).
// El módulo lo calcula y lo avisa; no lo decide por la DEC.
describe("avisosA10 · beneficio de los 40 días (Art. 64.3)", () => {
  it("sin fecha de convocatoria no hay nada que calcular", () => {
    expect(avisosA10({})).toEqual([]);
    expect(avisosA10(undefined)).toEqual([]);
  });

  it("con convocatoria pero sin publicación avisa cuál es la fecha límite", () => {
    const avisos = avisosA10({ fecha_aprox_convocatoria: "2026-10-15" });
    expect(avisos).toHaveLength(1);
    // 2026-10-15 menos 40 días calendario = 2026-09-05.
    expect(avisos[0].mensaje).toContain("05/09/2026");
    expect(avisos[0].mensaje).toContain("64.3");
    expect(avisos[0].nivel).toBe("warn");
  });

  it("con publicación que cumple los 40 días no avisa si el beneficio está marcado", () => {
    // 2026-09-05 → 2026-10-15 son exactamente 40 días.
    expect(
      avisosA10({
        fecha_aprox_convocatoria: "2026-10-15",
        fecha_publicacion_anuncio: "2026-09-05",
        aplica_beneficio_40dias: true,
      }),
    ).toEqual([]);
  });

  it("con publicación que cumple pero sin marcar, sugiere marcarlo", () => {
    const avisos = avisosA10({
      fecha_aprox_convocatoria: "2026-10-15",
      fecha_publicacion_anuncio: "2026-09-01",
    });
    expect(avisos).toHaveLength(1);
    expect(avisos[0].mensaje).toContain("cumple el mínimo");
  });

  it("con publicación que NO cumple el mínimo avisa que no corresponde el beneficio", () => {
    // 2026-10-01 → 2026-10-15 son solo 14 días.
    const avisos = avisosA10({
      fecha_aprox_convocatoria: "2026-10-15",
      fecha_publicacion_anuncio: "2026-10-01",
    });
    expect(avisos).toHaveLength(1);
    expect(avisos[0].mensaje).toContain("no corresponde reducir el plazo");
  });

  it("si marcó el beneficio pero no cumple el mínimo, avisa en nivel error", () => {
    const avisos = avisosA10({
      fecha_aprox_convocatoria: "2026-10-15",
      fecha_publicacion_anuncio: "2026-10-01",
      aplica_beneficio_40dias: true,
    });
    expect(avisos.map((a) => a.nivel)).toEqual(["warn", "error"]);
    expect(avisos[1].mensaje).toContain("desmarca");
  });
});

describe("cronogramaRequerimientosDetalle · comunicación a las áreas usuarias (Art. 42.2)", () => {
  it("sin cronograma se queda en el mensaje genérico", () => {
    const r = cronogramaRequerimientosDetalle(undefined);
    expect(r.filas).toEqual([]);
    expect(r.mensaje).toContain("está listo para las áreas usuarias");
  });

  it("enumera las áreas usuarias con sus fechas", () => {
    const r = cronogramaRequerimientosDetalle([
      { area: "Oficina de Abastecimiento", fecha: "2026-08-20" },
      { area: "Oficina de Logística", fecha: "2026-09-03" },
    ]);
    expect(r.filas).toHaveLength(2);
    expect(r.mensaje).toContain("Oficina de Abastecimiento: 2026-08-20");
    expect(r.mensaje).toContain("Oficina de Logística: 2026-09-03");
  });

  it("ignora filas vacías o incompletas", () => {
    const r = cronogramaRequerimientosDetalle([
      { area: "Oficina de Abastecimiento", fecha: "2026-08-20" },
      { area: "", fecha: "2026-09-03" },
      { area: "Oficina Legal", fecha: "" },
    ]);
    expect(r.filas).toHaveLength(1);
    expect(r.mensaje).not.toContain("Oficina Legal");
  });
});
