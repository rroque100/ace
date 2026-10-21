import { describe, expect, it } from "vitest";
import { contarAdmitidos, leerPostores } from "@/lib/postores-seleccion";

describe("leerPostores", () => {
  it("con valor vacío o inválido, devuelve []", () => {
    expect(leerPostores(undefined)).toEqual([]);
    expect(leerPostores("texto viejo de un formulario anterior")).toEqual([]);
  });

  it("lee filas válidas, ignora las que no tienen forma de Postor", () => {
    const filas = leerPostores([
      { ruc: "20123456789", razonSocial: "ACME SAC", admitido: true },
      { ruc: "20999999999", razonSocial: "OTRA SAC", admitido: false, motivoNoAdmision: "No presentó garantía" },
      "basura",
    ]);
    expect(filas).toHaveLength(2);
  });
});

describe("contarAdmitidos", () => {
  it("cuenta solo los admitidos", () => {
    const postores = [
      { admitido: true, razonSocial: "A", ruc: "1" },
      { admitido: false, razonSocial: "B", ruc: "2" },
      { admitido: true, razonSocial: "C", ruc: "3" },
    ];
    expect(contarAdmitidos(postores)).toBe(2);
  });
});
