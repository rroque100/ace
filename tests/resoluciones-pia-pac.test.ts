import { describe, expect, it } from "vitest";
import {
  avisosResoluciones,
  pareceTextoDePlantilla,
} from "@/lib/configuracion-entidad";

// Estos dos campos se citan LITERALMENTE como antecedente en los informes que
// se exportan y se firman. Un resto de la plantilla que nadie quitó acaba
// impreso en un documento oficial.

describe("pareceTextoDePlantilla", () => {
  it("detecta el caso real: la anotación de la plantilla sigue ahí", () => {
    expect(pareceTextoDePlantilla("Resolución de Alcaldía N° 238-2025 (MODELO — reemplazar)")).toBe(true);
  });

  it("detecta huecos sin rellenar y rellenos de ejemplo", () => {
    expect(pareceTextoDePlantilla("Resolución N° [COMPLETAR]")).toBe(true);
    expect(pareceTextoDePlantilla("Resolución N° XXX-2026")).toBe(true);
    expect(pareceTextoDePlantilla("Ejemplo: Resolución de Alcaldía")).toBe(true);
  });

  it("un documento real no se marca, aunque no sea una resolución", () => {
    expect(pareceTextoDePlantilla("Resolución de Alcaldía N° 238-2025-MDP/ALC")).toBe(false);
    // El PAC puede aprobarse por memorando; el campo no debe protestar por eso.
    expect(pareceTextoDePlantilla("MEMORANDUN NRO 0070-2026-GM-MDCH/A")).toBe(false);
  });

  it("un campo vacío no es texto de plantilla: simplemente falta", () => {
    expect(pareceTextoDePlantilla("")).toBe(false);
    expect(pareceTextoDePlantilla("   ")).toBe(false);
  });
});

describe("avisosResoluciones", () => {
  const REAL = {
    piaNumero: "Resolución de Alcaldía N° 238-2025 (MODELO — reemplazar)",
    piaFecha: "2025-12-31",
    pacNumero: "MEMORANDUN NRO 0070-2026-GM-MDCH/A",
    pacFecha: "2026-01-19",
    ejercicio: "2026",
  };

  it("señala el texto de plantilla del PIA en los datos reales", () => {
    const avisos = avisosResoluciones(REAL);
    expect(avisos).toHaveLength(1);
    expect(avisos[0].tono).toBe("error");
    expect(avisos[0].texto).toContain("PIA");
  });

  it("unos datos coherentes no generan ningún aviso", () => {
    expect(
      avisosResoluciones({ ...REAL, piaNumero: "Resolución de Alcaldía N° 238-2025-MDP/ALC" }),
    ).toEqual([]);
  });

  it("avisa si el PAC se aprobó antes que el PIA", () => {
    const avisos = avisosResoluciones({
      ...REAL,
      piaNumero: "Resolución de Alcaldía N° 238-2025-MDP/ALC",
      pacFecha: "2025-11-01",
    });
    expect(avisos.map((a) => a.tono)).toEqual(["aviso"]);
    expect(avisos[0].texto).toContain("anterior a la del PIA");
  });

  it("un PAC aprobado en diciembre del año anterior es normal: no avisa", () => {
    // El PAC del ejercicio siguiente se aprueba a fin de año. Avisar aquí sería
    // enseñar a ignorar los avisos.
    expect(
      avisosResoluciones({
        ...REAL,
        piaNumero: "Resolución de Alcaldía N° 238-2025-MDP/ALC",
        piaFecha: "2025-12-01",
        pacFecha: "2025-12-30",
      }),
    ).toEqual([]);
  });

  it("avisa si el año del PAC no encaja con el ejercicio registrado", () => {
    const avisos = avisosResoluciones({
      ...REAL,
      piaNumero: "Resolución de Alcaldía N° 238-2025-MDP/ALC",
      pacFecha: "2024-01-19",
    });
    expect(avisos.some((a) => a.texto.includes("2024") && a.texto.includes("2026"))).toBe(true);
  });

  it("con campos vacíos no inventa avisos", () => {
    expect(avisosResoluciones({})).toEqual([]);
  });

  it("ningún aviso bloquea: son datos que la entidad conoce mejor que una regla", () => {
    const avisos = avisosResoluciones({ ...REAL, pacFecha: "2020-01-01" });
    expect(avisos.every((a) => a.tono === "error" || a.tono === "aviso")).toBe(true);
  });
});
