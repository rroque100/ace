import { describe, expect, it } from "vitest";
import { feriadosNacionalesFijos, parseFeriados, setDeFeriados } from "@/lib/feriados";

describe("parseFeriados", () => {
  it("descarta lo inválido, deduplica y ordena por fecha", () => {
    const r = parseFeriados([
      { fecha: "2026-12-25", nombre: "Navidad" },
      { fecha: "2026-01-01", nombre: "Año Nuevo" },
      { fecha: "2026-01-01", nombre: "dup" }, // duplicado
      { fecha: "no-fecha", nombre: "x" }, // inválido
      { nombre: "sin fecha" }, // inválido
      "texto", // inválido
    ]);
    expect(r.map((f) => f.fecha)).toEqual(["2026-01-01", "2026-12-25"]);
  });

  it("devuelve [] si no es un array", () => {
    expect(parseFeriados(null)).toEqual([]);
    expect(parseFeriados("x")).toEqual([]);
  });
});

describe("feriadosNacionalesFijos", () => {
  it("genera los feriados de fecha fija del año dado", () => {
    const f = feriadosNacionalesFijos(2026);
    const fechas = f.map((x) => x.fecha);
    expect(fechas).toContain("2026-01-01"); // Año Nuevo
    expect(fechas).toContain("2026-07-28"); // Fiestas Patrias
    expect(fechas).toContain("2026-12-25"); // Navidad
    // No incluye los variables (Semana Santa): la entidad los agrega.
    expect(f.every((x) => x.fecha.startsWith("2026-"))).toBe(true);
  });
});

describe("setDeFeriados", () => {
  it("arma un Set de fechas ISO para el cálculo", () => {
    const s = setDeFeriados([{ fecha: "2026-07-28", nombre: "FP" }]);
    expect(s.has("2026-07-28")).toBe(true);
  });
});
