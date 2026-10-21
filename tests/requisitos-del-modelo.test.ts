import { describe, expect, it } from "vitest";
import { tiposDelModelo, tiposDelModeloComoLista } from "@/lib/requisitos-del-modelo";

/**
 * La ficha ofrece los cinco tipos del Art. 72.3 a todas las necesidades por
 * igual, y los modelos declaran entre cero y cuatro según el objeto y el
 * procedimiento. Esto detecta cuáles pide el formato, para poder decirlo.
 *
 * La primera versión de esta detección buscaba la frase en cualquier parte del
 * documento y daba falsos positivos DE LOS GORDOS: varios modelos citan
 * «capacidad legal» dentro de una nota que dice que ese dato NO va en esa
 * sección. Por eso solo cuenta lo que aparece como título.
 */
describe("solo cuenta lo que es un título", () => {
  it("con letra delante, como en el formato", () => {
    expect(tiposDelModelo("a) CAPACIDAD LEGAL").has("capacidad_legal")).toBe(true);
    expect(tiposDelModelo("b. EXPERIENCIA DEL POSTOR").has("experiencia_postor")).toBe(true);
  });

  it("con numeración de sección, como en los de obras", () => {
    expect(tiposDelModelo("3.5.1.2 CAPACIDAD TÉCNICA Y PROFESIONAL").has("capacidad_tecnica")).toBe(true);
  });

  it("una mención dentro de una nota NO cuenta", () => {
    // Caso REAL del corpus, y es el que invalidaba la primera medición.
    const nota =
      "En esta sección no corresponde precisar la documentación de capacidad legal del " +
      "proveedor ni ninguna que corresponda a sus capacidades o calificaciones.";
    expect(tiposDelModelo(nota).has("capacidad_legal")).toBe(false);
  });

  it("tampoco cuenta dentro de una frase corrida", () => {
    expect(tiposDelModelo("se evaluará la capacidad económica del postor").size).toBe(0);
  });
});

describe("las variantes que usan los formatos", () => {
  it("la capacidad técnica aparece con y sin «y profesional»", () => {
    expect(tiposDelModelo("c) CAPACIDAD TÉCNICA").has("capacidad_tecnica")).toBe(true);
    expect(tiposDelModelo("c) CAPACIDAD TÉCNICA Y PROFESIONAL").has("capacidad_tecnica")).toBe(true);
  });

  it("el consorcio, con y sin «condiciones de»", () => {
    expect(tiposDelModelo("d) PARTICIPACIÓN EN CONSORCIO").has("consorcio")).toBe(true);
    expect(tiposDelModelo("d) CONDICIONES DE PARTICIPACIÓN EN CONSORCIO").has("consorcio")).toBe(true);
    expect(tiposDelModelo("d) PARTICIPACIÓN DE POSTORES EN CONSORCIO").has("consorcio")).toBe(true);
  });

  it("absorbe el acento perdido del OCR", () => {
    expect(tiposDelModelo("e) CAPACIDAD ECONOMICA").has("capacidad_economica")).toBe(true);
    expect(tiposDelModelo("c) CAPACIDAD TECNICA").has("capacidad_tecnica")).toBe(true);
  });
});

describe("el resultado es estable y reproducible", () => {
  const modelo = [
    "3.5.1 REQUISITOS DE CALIFICACIÓN",
    "a) CAPACIDAD LEGAL",
    "b) EXPERIENCIA DEL POSTOR EN LA ESPECIALIDAD",
    "c) CONDICIONES DE PARTICIPACIÓN EN CONSORCIO",
  ].join("\n");

  it("devuelve siempre el mismo orden", () => {
    const primera = tiposDelModeloComoLista(modelo);
    for (let i = 0; i < 5; i++) expect(tiposDelModeloComoLista(modelo)).toEqual(primera);
  });

  it("el orden es el del Art. 72.3, no el del documento", () => {
    expect(tiposDelModeloComoLista(modelo)).toEqual([
      "capacidad_legal",
      "experiencia_postor",
      "consorcio",
    ]);
  });

  it("un modelo que no declara ninguno devuelve lista vacía", () => {
    // Le pasa al procedimiento no competitivo: su 3.5 no trae ningún tipo.
    expect(tiposDelModeloComoLista("3.1 FINALIDAD PÚBLICA\n3.2 DESCRIPCIÓN GENERAL")).toEqual([]);
  });
});
