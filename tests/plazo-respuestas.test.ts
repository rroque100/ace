import { describe, expect, it } from "vitest";
import { componerPlazoRespuestas, estaCompuesto, plazoDe } from "@/lib/plazo-respuestas";

/**
 * El apartado j) tiene un texto fijo del formato y un solo hueco: el plazo.
 *
 * El plazo y el texto compiten por el MISMO campo, así que el botón se puede
 * pulsar dos veces. La segunda vez el valor ya es el apartado entero, y sin
 * cuidado se acabaría anidando el texto dentro de sí mismo.
 */
describe("compone el apartado con el plazo dentro", () => {
  const texto = componerPlazoRespuestas("diez (10) días calendario");

  it("lleva el encabezado del formato", () => {
    expect(texto).toContain("PLAZO PARA RESPUESTAS ENTRE LAS PARTES");
  });

  it("lleva el párrafo que remite al Reglamento", () => {
    expect(texto).toContain("no han sido específicamente previstos en el Reglamento");
  });

  it("el plazo va en su línea, como en el cuadro del formato", () => {
    expect(texto).toContain("Plazo máximo de respuesta: diez (10) días calendario");
  });

  it("y cierra con la prórroga que las partes pueden acordar", () => {
    expect(texto).toContain("las partes pueden acordar su prórroga para cada situación específica");
    expect(texto).toContain("cláusula de notificaciones del contrato");
  });
});

describe("pulsar el botón dos veces no anida el texto", () => {
  it("la segunda vez recupera el plazo de dentro", () => {
    const una = componerPlazoRespuestas("quince (15) días");
    const dos = componerPlazoRespuestas(una);
    expect(dos).toBe(una);
  });

  it("y una tercera tampoco cambia nada", () => {
    const una = componerPlazoRespuestas("quince (15) días");
    expect(componerPlazoRespuestas(componerPlazoRespuestas(una))).toBe(una);
  });

  it("`plazoDe` saca el plazo tanto suelto como de dentro del texto", () => {
    expect(plazoDe("diez (10) días")).toBe("diez (10) días");
    expect(plazoDe(componerPlazoRespuestas("diez (10) días"))).toBe("diez (10) días");
  });
});

describe("un plazo sin poner se VE", () => {
  it("conserva el corchete del formato", () => {
    expect(componerPlazoRespuestas("")).toContain("[CONSIGNAR EL PLAZO EN DÍAS CALENDARIO]");
    expect(componerPlazoRespuestas(null)).toContain("[CONSIGNAR EL PLAZO EN DÍAS CALENDARIO]");
  });

  it("recomponer un texto con el hueco vacío NO toma el corchete por un plazo", () => {
    const vacio = componerPlazoRespuestas("");
    expect(plazoDe(vacio)).toBe("");
    expect(componerPlazoRespuestas(vacio)).toBe(vacio);
  });
});

describe("saber si ya está compuesto", () => {
  it("distingue el plazo suelto del apartado entero", () => {
    expect(estaCompuesto("diez (10) días")).toBe(false);
    expect(estaCompuesto(componerPlazoRespuestas("diez (10) días"))).toBe(true);
    expect(estaCompuesto("")).toBe(false);
  });
});

describe("el plazo y el texto son campos distintos", () => {
  it("el plazo se declara número y el esquema lo acepta como número", async () => {
    // El desajuste —ficha `kind: "number"`, esquema `optionalText`— hacía que
    // cada guardado respondiera 400 en cuanto alguien escribía algo aquí.
    const { necesidadUpdateSchema } = await import("@/lib/necesidades");
    expect(necesidadUpdateSchema.safeParse({ plazoRespuestas: 10 }).success).toBe(true);
    expect(necesidadUpdateSchema.safeParse({ plazoRespuestas: "10" }).success).toBe(false);
  });

  it("el texto compuesto cabe en su campo", async () => {
    const { necesidadUpdateSchema } = await import("@/lib/necesidades");
    const texto = componerPlazoRespuestas("trescientos sesenta y cinco (365) días calendario");
    expect(necesidadUpdateSchema.safeParse({ plazoRespuestasTexto: texto }).success).toBe(true);
  });

  it("los dos existen en el apartado j) de la ficha", async () => {
    const { FICHA_SECCIONES } = await import("@/lib/necesidad-ficha-secciones");
    const j = FICHA_SECCIONES.flatMap((s) => s.fields).filter(
      (f) => f.subgrupo === "j) Plazo para respuestas entre las partes",
    );
    expect(j.map((f) => f.api).sort()).toEqual(["plazoRespuestas", "plazoRespuestasTexto"]);
  });
});
