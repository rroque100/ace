import { describe, expect, it } from "vitest";
import { estructuraDelRequerimiento } from "@/lib/requerimiento-estructura";
import {
  ACREDITACION_CAPACITACION,
  filasCapacitacionParaDocumento,
  formatFilasCapacitacion,
} from "@/lib/capacitacion-personal-clave";

/**
 * La capacitación del personal clave está `oculto` en la ficha (la pinta el
 * editor de requisitos), pero SÍ va al Word como cuadro. Esta prueba fija que
 * la estructura del requerimiento la deja pasar con el formato de tabla propio.
 */
describe("la capacitación del personal clave entra en el requerimiento", () => {
  it("el campo del cuadro sale con formato tablaCapacitacion", () => {
    const ficha: Record<string, string> = {
      capacitacionPersonalClave: formatFilasCapacitacion([
        { actividad: "Supervisión", horas: "40", materia: "BIM", puesto: "residente" },
      ]),
    };
    const secciones = estructuraDelRequerimiento([], ficha);
    const campos = secciones.flatMap((s) => s.campos);
    const cuadro = campos.find((c) => c.api === "capacitacionPersonalClave");
    expect(cuadro?.formato).toBe("tablaCapacitacion");
  });
});

describe("el texto de acreditación de la capacitación es el del formato", () => {
  it("ya no es un marcador y trae el hueco de documentos y las tres advertencias", () => {
    expect(ACREDITACION_CAPACITACION).not.toContain("PENDIENTE");
    expect(ACREDITACION_CAPACITACION).toContain(
      "Se acredita con copia simple de [CONSIGNAR CONSTANCIAS, CERTIFICADOS U OTROS DOCUMENTOS, SEGÚN CORRESPONDA]",
    );
    expect(ACREDITACION_CAPACITACION).toContain("lectivas, académicas y/o pedagógicas");
    expect(ACREDITACION_CAPACITACION).toContain("vinculado con las actividades que va a desempeñar el personal clave");
    expect(ACREDITACION_CAPACITACION).toContain("cada crédito del curso que acredita la capacitación equivale a dieciséis horas");
  });

  it("las tres advertencias van en viñetas: el Word las convierte en bullets", () => {
    const bullets = ACREDITACION_CAPACITACION.split("\n").filter((l) => l.startsWith("- "));
    expect(bullets).toHaveLength(3);
  });
});

describe("una fila de capacitación vacía no viaja al Word", () => {
  it("filasCapacitacionParaDocumento descarta las filas que solo llevan la actividad heredada", () => {
    // El cuadro hereda una fila por puesto del cuadro de experiencia; la del
    // MONTAJISTA se dejó sin horas/materia/puesto (se serializa como [POR DEFINIR]).
    const texto = formatFilasCapacitacion([
      { actividad: "JEFE DE EQUIPO", horas: "40", materia: "BIM", puesto: "residente" },
      { actividad: "MONTAJISTA", horas: "", materia: "", puesto: "" },
    ]);
    const filas = filasCapacitacionParaDocumento(texto);
    expect(filas.map((f) => f.actividad)).toEqual(["JEFE DE EQUIPO"]);
  });

  it("una capacitación con solo filas heredadas no genera apartado en el requerimiento", () => {
    const ficha: Record<string, string> = {
      capacitacionPersonalClave: formatFilasCapacitacion([
        { actividad: "JEFE DE EQUIPO", horas: "", materia: "", puesto: "" },
        { actividad: "MONTAJISTA", horas: "", materia: "", puesto: "" },
      ]),
    };
    const campos = estructuraDelRequerimiento([], ficha).flatMap((s) => s.campos);
    expect(campos.find((c) => c.api === "capacitacionPersonalClave")).toBeUndefined();
  });
});
