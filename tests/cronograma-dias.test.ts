import { describe, expect, it } from "vitest";
import { duracionActividad, calcularFechasCronograma, diasHabilesEntre, fechaDe } from "@/lib/cronograma-fechas";
import {
  DIAS_CRONOGRAMA_DEFAULT,
  PROCEDIMIENTOS_CRONOGRAMA,
  diasParaProcedimiento,
  parseDiasPorProcedimiento,
  saneaDias,
} from "@/lib/cronograma-dias";
import { construirCronogramaInicial } from "@/lib/estrategia-formato";

describe("días estimados del cronograma por procedimiento", () => {
  it("duracionActividad usa los días de la config para las preparatorias/ejecución", () => {
    const cfg = { ...DIAS_CRONOGRAMA_DEFAULT, aprobacionExpediente: 10, suscripcionContrato: 7 };
    expect(duracionActividad("Aprobación del expediente de contratación", undefined, null, cfg)).toBe(10);
    expect(duracionActividad("Suscripción del contrato", undefined, null, cfg)).toBe(7);
    // Sin config → defecto de siempre.
    expect(duracionActividad("Aprobación del expediente de contratación")).toBe(3);
  });

  it("parseDiasPorProcedimiento saneam a un mapa COMPLETO por procedimiento", () => {
    const m = parseDiasPorProcedimiento(
      JSON.stringify({ subasta_inversa_electronica: { aprobacionExpediente: 6, elaboracionBases: 0 } }),
    );
    // Todos los procedimientos vigentes presentes.
    for (const p of PROCEDIMIENTOS_CRONOGRAMA) expect(m[p], p).toBeTruthy();
    expect(m.subasta_inversa_electronica.aprobacionExpediente).toBe(6); // configurado
    // 0 se descarta → defecto.
    expect(m.subasta_inversa_electronica.elaboracionBases).toBe(DIAS_CRONOGRAMA_DEFAULT.elaboracionBases);
    // Procedimiento no tocado → todo defecto.
    expect(m.licitacion_publica).toEqual(DIAS_CRONOGRAMA_DEFAULT);
  });

  it("parseDiasPorProcedimiento tolera JSON inválido (todo a defecto)", () => {
    const m = parseDiasPorProcedimiento("{no es json");
    expect(m.concurso_publico).toEqual(DIAS_CRONOGRAMA_DEFAULT);
  });

  it("saneaDias descarta valores no positivos", () => {
    expect(saneaDias({ aprobacionExpediente: -2, elaboracionBases: 9 })).toMatchObject({
      aprobacionExpediente: DIAS_CRONOGRAMA_DEFAULT.aprobacionExpediente,
      elaboracionBases: 9,
    });
  });

  it("diasParaProcedimiento devuelve el set del procedimiento o el defecto", () => {
    const m = parseDiasPorProcedimiento(JSON.stringify({ concurso_publico: { aprobacionExpediente: 4 } }));
    expect(diasParaProcedimiento(m, "concurso_publico").aprobacionExpediente).toBe(4);
    expect(diasParaProcedimiento(m, "inexistente")).toEqual(DIAS_CRONOGRAMA_DEFAULT);
    expect(diasParaProcedimiento(null, "concurso_publico")).toEqual(DIAS_CRONOGRAMA_DEFAULT);
  });

  it("los días editables de la config solo mueven las preparatorias/ejecución, no los plazos legales", () => {
    const base = construirCronogramaInicial("licitacion_publica", 30, "calendario");
    const opts = { procedimiento: "licitacion_publica" } as const;
    const conDefecto = calcularFechasCronograma(base, "2026-08-24", new Set(), opts);
    const conMas = calcularFechasCronograma(base, "2026-08-24", new Set(), {
      ...opts,
      dias: { ...DIAS_CRONOGRAMA_DEFAULT, aprobacionExpediente: 20 },
    });
    // La aprobación del expediente (preparatorias) dura más → su fin se corre.
    const aprobDef = conDefecto.find((f) => /Aprobación del expediente/.test(f.actividad ?? ""));
    const aprobMas = conMas.find((f) => /Aprobación del expediente/.test(f.actividad ?? ""));
    expect(fechaDe(aprobMas?.fin) > fechaDe(aprobDef?.fin)).toBe(true);
    // Pero el plazo legal convocatoria→ofertas (Art. 64.1) sigue siendo ≥ 22 en ambos.
    for (const r of [conDefecto, conMas]) {
      const conv = r.find((f) => /^Convocatoria/.test(f.actividad ?? ""));
      const ofertas = r.find((f) => /Presentación de ofertas/.test(f.actividad ?? ""));
      expect(diasHabilesEntre(fechaDe(conv?.inicio), fechaDe(ofertas?.inicio))).toBeGreaterThanOrEqual(22);
    }
  });
});
