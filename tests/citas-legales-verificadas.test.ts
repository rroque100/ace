import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { aplicabilidadHito } from "@/lib/aplicabilidad-fases";
import { PROCESO_NO_COMPETITIVO } from "@/lib/procesos-seleccion";
import { pasoF1 } from "@/lib/actuaciones-preparatorias";

// Guardarraíl contra citas legales inventadas.
//
// Se encontró un "Art. 42.5" citado en cinco sitios —dos de ellos VISIBLES para
// el usuario— con hasta un texto entrecomillado que no está en la norma. El
// Art. 42 del Reglamento (D.S. 009-2025-EF) termina en 42.3:
//
//   42.1  segmentación de las contrataciones del PAC del CMN, "con excepción de
//         aquellas que correspondan a contratos menores".
//   42.2  aprobado el CMN, la DEC informa la clasificación en categorías
//         "adjuntando un cronograma para la presentación de los requerimientos".
//   42.3  no planificadas: se segmentan "una vez que el área usuaria haya
//         solicitado la modificación del CMN".
//
// La exclusión de los NO COMPETITIVOS viene del Art. 101.1: "No corresponde
// realizar la segmentación de contrataciones".
//
// Una cita falsa es peor que ninguna: se muestra bajo el campo y se copia a un
// informe que alguien firma.

const FUENTES = [
  "lib/actuaciones-preparatorias.ts",
  "lib/regimen-seleccion.ts",
  "app/components/fase-panel.tsx",
];

describe("no se cita ningún numeral inexistente del Art. 42", () => {
  it("el Art. 42 termina en 42.3: no hay 42.4 ni 42.5", () => {
    for (const ruta of FUENTES) {
      const src = readFileSync(ruta, "utf8")
        // La nota que documenta el error SÍ puede nombrarlo.
        .split("\n")
        .filter((l) => !l.includes("NO EXISTE") && !l.includes("inexistente"))
        .join("\n");
      expect(src, `${ruta} cita un numeral inexistente`).not.toMatch(/Art\.?\s*42\.[45]/);
    }
  });
});

describe("la exclusión de la segmentación se atribuye al artículo correcto", () => {
  const noComp = { tipoProceso: PROCESO_NO_COMPETITIVO };

  it("A2 no aplica en los no competitivos por el Art. 101.1", () => {
    const a = aplicabilidadHito("A2", noComp);
    expect(a.estado).toBe("no_aplica");
    expect(a.motivo).toContain("101.1");
    expect(a.motivo).not.toContain("42.5");
  });

  it("A5 queda facultativo, porque los dos textos del 101.1 no dicen lo mismo", () => {
    const a = aplicabilidadHito("A5", noComp);
    expect(a.estado).toBe("facultativo");
    expect(a.motivo).toContain("101.1");
    expect(a.motivo).toContain("001-2026-EF");
  });

  it("los contratos menores se excluyen por el 42.1, y así lo dice A1", () => {
    expect(pasoF1("A1")?.nota).toContain("contratos menores");
    expect(pasoF1("A1")?.nota).toContain("42.1");
  });
});
