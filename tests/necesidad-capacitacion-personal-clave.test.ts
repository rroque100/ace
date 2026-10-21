import { describe, expect, it } from "vitest";
import {
  type FilaCapacitacion,
  capacitacionExcedeHoras,
  capacitacionIncompletas,
  componerRequisitoCapacitacion,
  formatFilasCapacitacion,
  parseFilasCapacitacion,
} from "@/lib/capacitacion-personal-clave";

const fila = (extra: Partial<FilaCapacitacion>): FilaCapacitacion => ({
  actividad: "",
  horas: "",
  materia: "",
  puesto: "",
  ...extra,
});

describe("componerRequisitoCapacitacion", () => {
  it("compone con los tres datos", () => {
    expect(
      componerRequisitoCapacitacion({ horas: "40", materia: "seguridad de obra", puesto: "residente" }),
    ).toBe("40 horas en seguridad de obra del personal clave requerido como residente.");
  });

  it("pone los huecos en mayusculas cuando falta un dato", () => {
    const t = componerRequisitoCapacitacion({ horas: "40" });
    expect(t).toContain("40 horas en [CONSIGNAR LA MATERIA");
    expect(t).toContain("del personal clave requerido como [CONSIGNAR EL PERSONAL CLAVE");
  });
});

describe("parse/format reversibles", () => {
  it("format y luego parse devuelve las filas con contenido", () => {
    const filas = [
      fila({ actividad: "Supervision", horas: "24", materia: "BIM", puesto: "residente" }),
      fila({ actividad: "Calidad", horas: "12", materia: "ISO 9001", puesto: "especialista" }),
    ];
    expect(parseFilasCapacitacion(formatFilasCapacitacion(filas))).toEqual(filas);
  });

  it("una fila vacia no se serializa", () => {
    expect(formatFilasCapacitacion([fila({})])).toBe("");
  });
});

describe("capacitacionIncompletas", () => {
  it("marca la fila a la que le falta horas, materia o puesto (la actividad no cuenta)", () => {
    const filas = [
      fila({ actividad: "A", horas: "40", materia: "X", puesto: "P" }),
      fila({ actividad: "B", horas: "40" }),
    ];
    expect(capacitacionIncompletas(filas)).toEqual([2]);
  });

  it("una fila SOLO con la actividad heredada no se marca: aún no se ha tocado", () => {
    // Era el bug: las filas heredadas del cuadro de experiencia salían todas
    // marcadas nada más aparecer, antes de escribir horas/materia/puesto.
    const filas = [fila({ actividad: "A" }), fila({ actividad: "B" })];
    expect(capacitacionIncompletas(filas)).toEqual([]);
  });
});

describe("el marcador [POR DEFINIR] no se lee como dato", () => {
  it("parseFilasCapacitacion devuelve vacio donde el serializador dejo el marcador", () => {
    // format deja «[POR DEFINIR]» en horas y puesto; al leer vuelven a ser "".
    const texto = formatFilasCapacitacion([fila({ actividad: "JEFE", horas: "", materia: "X", puesto: "" })]);
    expect(parseFilasCapacitacion(texto)).toEqual([fila({ actividad: "JEFE", materia: "X" })]);
  });

  it("el requisito compuesto muestra la guia OECE, no el marcador", () => {
    const [f] = parseFilasCapacitacion(
      formatFilasCapacitacion([fila({ actividad: "JEFE", horas: "40", materia: "BIM", puesto: "" })]),
    );
    const t = componerRequisitoCapacitacion(f);
    expect(t).toContain("del personal clave requerido como [CONSIGNAR EL PERSONAL CLAVE");
    expect(t).not.toContain("[POR DEFINIR]");
  });
});

describe("capacitacionExcedeHoras", () => {
  it("corta en 120: 120 no excede, 121 si, no-numerico no cuenta", () => {
    const filas = [
      fila({ horas: "120", materia: "X", puesto: "P" }),
      fila({ horas: "121", materia: "X", puesto: "P" }),
      fila({ horas: "muchas", materia: "X", puesto: "P" }),
    ];
    expect(capacitacionExcedeHoras(filas)).toEqual([2]);
  });
});
