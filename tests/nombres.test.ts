import { describe, expect, it } from "vitest";
import { conGradoAcademico, mismaPersona, nombreEnOrdenNatural } from "@/lib/nombres";

// En la base conviven dos órdenes: `necesidades.responsable` y
// `expedientes_oficinas.responsable_nombre` guardan APELLIDOS primero, como el
// padrón; `profiles.nombre_completo` guarda NOMBRES primero, como se firma. En
// la cabecera de un memorando manda el segundo.

describe("nombreEnOrdenNatural", () => {
  it("mueve los dos apellidos al final", () => {
    expect(nombreEnOrdenNatural("ROJAS MAYTAN JUAN")).toBe("JUAN ROJAS MAYTAN");
    expect(nombreEnOrdenNatural("CAHUANA MENDOZA NILDO")).toBe("NILDO CAHUANA MENDOZA");
  });

  it("respeta los nombres compuestos: todo lo que sigue a los apellidos", () => {
    expect(nombreEnOrdenNatural("QUISPE CHIPANA SAUL ANTONIO")).toBe("SAUL ANTONIO QUISPE CHIPANA");
  });

  it("con menos de tres palabras no reordena: no se sabe qué es qué", () => {
    // Inventar un orden aquí saldría impreso en un documento que se firma.
    expect(nombreEnOrdenNatural("ROJAS JUAN")).toBe("ROJAS JUAN");
    expect(nombreEnOrdenNatural("JUAN")).toBe("JUAN");
  });

  it("normaliza los espacios sobrantes", () => {
    expect(nombreEnOrdenNatural("  ROJAS   MAYTAN  JUAN ")).toBe("JUAN ROJAS MAYTAN");
  });

  it("vacío se queda vacío", () => {
    expect(nombreEnOrdenNatural("")).toBe("");
    expect(nombreEnOrdenNatural(null)).toBe("");
  });
});

describe("mismaPersona", () => {
  it("reconoce el mismo nombre en los dos órdenes", () => {
    expect(mismaPersona("ROJAS MAYTAN JUAN", "JUAN ROJAS MAYTAN")).toBe(true);
  });

  it("ignora tildes y espacios", () => {
    expect(mismaPersona("PÉREZ QUISPE JUAN", "juan  perez  quispe")).toBe(true);
  });

  it("no confunde a dos personas que comparten apellidos", () => {
    expect(mismaPersona("ROJAS MAYTAN JUAN", "ROJAS MAYTAN PEDRO")).toBe(false);
  });

  it("no da por iguales nombres de distinta longitud", () => {
    expect(mismaPersona("ROJAS MAYTAN JUAN", "JUAN ROJAS")).toBe(false);
  });

  it("exige al menos dos palabras: un apellido suelto no identifica", () => {
    expect(mismaPersona("ROJAS", "ROJAS")).toBe(false);
  });

  it("vacíos no son la misma persona", () => {
    expect(mismaPersona("", "")).toBe(false);
    expect(mismaPersona(null, "JUAN ROJAS MAYTAN")).toBe(false);
  });
});

describe("conGradoAcademico", () => {
  it("antepone el grado con su punto", () => {
    expect(conGradoAcademico("CPC", "JUAN ROJAS MAYTAN")).toBe("CPC. JUAN ROJAS MAYTAN");
  });

  it("no duplica el punto si el grado ya lo trae", () => {
    expect(conGradoAcademico("ABG.", "WALTER CCANA")).toBe("ABG. WALTER CCANA");
  });

  it("sin grado devuelve el nombre solo", () => {
    expect(conGradoAcademico("", "JUAN ROJAS MAYTAN")).toBe("JUAN ROJAS MAYTAN");
    expect(conGradoAcademico(null, "JUAN ROJAS MAYTAN")).toBe("JUAN ROJAS MAYTAN");
  });

  it("sin nombre no imprime un grado suelto", () => {
    expect(conGradoAcademico("CPC", "")).toBe("");
  });
});
