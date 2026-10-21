import { describe, expect, it } from "vitest";
import { avisosDeTopes, importesDelTexto, FACTOR_MAXIMO_EXPERIENCIA } from "@/lib/requisitos-topes";
import { tienePrecalificacion, PROCESOS_SELECCION } from "@/lib/procesos-seleccion";

describe("topes del modelo en los requisitos de calificación", () => {
  const cuantia = 500_000;

  it("avisa cuando la experiencia exigida supera 3 veces la cuantía", () => {
    // El tope no es de estilo: unas bases que lo superan se observan.
    const avisos = avisosDeTopes("monto facturado acumulado de S/ 2,500,000.00", cuantia, "experiencia_postor");
    expect(avisos).toHaveLength(1);
    expect(avisos[0].mensaje).toContain("1,500,000.00");
  });

  it("no avisa dentro del tope", () => {
    expect(avisosDeTopes("monto facturado de S/ 1 200 000.00", cuantia, "experiencia_postor")).toHaveLength(0);
  });

  it("sin cuantía NO inventa un tope", () => {
    // Distinguir «no cumple» de «no se sabe»: comparar contra cero dejaría pasar
    // o rechazaría cifras sin base ninguna.
    expect(avisosDeTopes("monto de S/ 9 000 000.00", null, "experiencia_postor")).toHaveLength(0);
  });

  it("controla el máximo de contrataciones y de horas de capacitación", () => {
    expect(avisosDeTopes("máximo de 35 contrataciones", cuantia, "experiencia_postor")).toHaveLength(1);
    expect(avisosDeTopes("200 horas de capacitación", cuantia, "capacidad_tecnica")).toHaveLength(1);
    expect(avisosDeTopes("80 horas de capacitación", cuantia, "capacidad_tecnica")).toHaveLength(0);
  });

  it("lee importes escritos como la gente los escribe, e ignora los que no lo son", () => {
    const n = importesDelTexto("S/ 1 500 000.00 y 2,300,000 soles, 20 contrataciones, 15 años");
    expect(n).toEqual([1_500_000, 2_300_000]);
  });

  it("el factor del modelo es 3", () => {
    expect(FACTOR_MAXIMO_EXPERIENCIA).toBe(3);
  });
});

describe("precalificación por procedimiento (Art. 72.3.e)", () => {
  it("solo tres de los procedimientos la tienen", () => {
    const con = PROCESOS_SELECCION.filter((p) => p.precalificacion);
    expect(con).toHaveLength(3);
  });

  it("el Concurso Público de servicios NO la tiene", () => {
    // De ahí que su modelo no traiga capacidad económica.
    expect(tienePrecalificacion("Concurso Público de servicios")).toBe(false);
    expect(tienePrecalificacion("Concurso Público con precalificación")).toBe(true);
  });
});
