import { describe, expect, it } from "vitest";
import { penalidadesDesdeMatriz } from "@/lib/penalidades-matriz";

const MATRIZ = [
  "MATRIZ DE GESTIÓN DE RIESGOS",
  "| Categoría | Identificación del Riesgo | Análisis | Asignación | Estrategia | Relación con Penalidades |",
  "|---|---|---|---|---|---|",
  "| Técnico | Deficiencias en el montaje | Media/Alto | Contratista | Supervisión | Otras penalidades |",
  "| Financiero | Desabastecimiento | Media/Alto | Contratista | Stock | Penalidad por mora |",
  "| Seguridad | Accidente en altura | Baja/Crítico | Contratista | EPP | Otras penalidades: 0.5 UIT |",
  "| Legal | Demora en licencias | Media/Medio | Entidad | Gestión previa | No aplica |",
].join("\n");

describe("penalidadesDesdeMatriz", () => {
  it("trae solo las filas «otras penalidad», con el riesgo como supuesto y el resto vacío", () => {
    expect(penalidadesDesdeMatriz(MATRIZ)).toEqual([
      { supuesto: "Deficiencias en el montaje", calculo: "", verificacion: "" },
      { supuesto: "Accidente en altura", calculo: "", verificacion: "" },
    ]);
  });

  it("sin tabla devuelve lista vacía", () => {
    expect(penalidadesDesdeMatriz("solo sustento, sin tabla")).toEqual([]);
    expect(penalidadesDesdeMatriz("")).toEqual([]);
    expect(penalidadesDesdeMatriz(undefined)).toEqual([]);
  });

  it("usa la última columna como penalidades y la 2.ª como riesgo si la cabecera no coincide", () => {
    const sinCabeceraClara = [
      "| A | B | C |",
      "|---|---|---|",
      "| x | El riesgo | otras penalidades |",
    ].join("\n");
    expect(penalidadesDesdeMatriz(sinCabeceraClara)).toEqual([
      { supuesto: "El riesgo", calculo: "", verificacion: "" },
    ]);
  });
});
