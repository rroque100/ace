import { describe, expect, it } from "vitest";
import { ganador, leerPuntajes } from "@/lib/puntajes-seleccion";

describe("leerPuntajes", () => {
  it("con valor vacío o inválido, devuelve []", () => {
    expect(leerPuntajes(undefined)).toEqual([]);
    expect(leerPuntajes("texto viejo de un formulario anterior")).toEqual([]);
  });

  it("lee filas válidas, ignora las que no tienen forma de PuntajePostor", () => {
    const filas = leerPuntajes([
      { orden: 1, razonSocial: "ACME SAC", puntaje: 95, admitida: true },
      { orden: 2, razonSocial: "OTRA SAC", puntaje: 80, admitida: true },
      "basura",
    ]);
    expect(filas).toHaveLength(2);
  });
});

describe("ganador", () => {
  it("devuelve el de orden 1 entre las admitidas", () => {
    const puntajes = [
      { admitida: true, orden: 2, puntaje: 80, razonSocial: "SEGUNDO" },
      { admitida: true, orden: 1, puntaje: 95, razonSocial: "PRIMERO" },
    ];
    expect(ganador(puntajes)?.razonSocial).toBe("PRIMERO");
  });

  it("ignora el orden 1 si esa oferta no fue admitida", () => {
    const puntajes = [
      { admitida: false, orden: 1, puntaje: 99, razonSocial: "DESCALIFICADO" },
      { admitida: true, orden: 2, puntaje: 80, razonSocial: "SEGUNDO" },
    ];
    expect(ganador(puntajes)).toBeNull();
  });

  it("sin postores, devuelve null", () => {
    expect(ganador([])).toBeNull();
  });
});
