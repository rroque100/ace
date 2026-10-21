import { describe, expect, it } from "vitest";
import { filasTextarea } from "@/lib/textarea-alto";

// Todos los textarea de la ficha estaban fijos a rows={2}. Desde que 3.4 puede
// recibir el EETT/TDR completo y el traslado de la propuesta IA rellena las
// condiciones de contratación, revisar lo que se va a firmar obligaba a
// desplazarse dentro de una caja de dos líneas.

describe("filasTextarea", () => {
  it("un campo vacío se queda en su mínimo", () => {
    expect(filasTextarea("")).toBe(2);
    expect(filasTextarea("", true)).toBe(4);
  });

  it("crece con los saltos de línea", () => {
    expect(filasTextarea("a\nb\nc\nd\ne", true)).toBe(6);
  });

  it("crece también con un párrafo largo SIN saltos", () => {
    // Un texto corrido de ~600 caracteres no tiene saltos, pero necesita alto.
    expect(filasTextarea("x".repeat(600), true)).toBeGreaterThan(4);
  });

  it("tiene tope: un campo enorme no empuja el formulario fuera de pantalla", () => {
    // Topes altos a proposito: lo que redacta la IA son parrafos largos y hay
    // que poder leerlos sin desplazarse dentro de la caja. Mas alla de eso el
    // navegador ajusta con `field-sizing:content` y corta en max-h.
    expect(filasTextarea("x".repeat(50000), true)).toBe(28);
    expect(filasTextarea("x".repeat(50000))).toBe(20);
  });

  it("cuenta el envolvimiento de CADA linea, no el maximo", () => {
    // Un texto que mezcla parrafos largos con lineas sueltas necesita la SUMA
    // de lo que envuelve cada uno. Con el maximo, el bloque de penalidad por
    // mora que redacta la IA pedia 11 filas y necesitaba 14: se leia con scroll.
    const salto = String.fromCharCode(10);
    const mezcla = ["x".repeat(300), "", "corta", "y".repeat(220)].join(salto);
    const porMaximo = Math.max(4, Math.ceil(mezcla.length / 105)) + 1;
    expect(filasTextarea(mezcla, true)).toBeGreaterThan(porMaximo);
  });

  it("un campo estrecho necesita MÁS filas para el mismo texto", () => {
    // No es una errata: en una columna angosta caben menos caracteres por fila,
    // así que el mismo párrafo ocupa más líneas. Es el caso del editor de
    // requisitos, cuyos textarea viven dentro de la tarjeta de cada tipo.
    const parrafo = "y".repeat(400);
    expect(filasTextarea(parrafo, false)).toBeGreaterThan(filasTextarea(parrafo, true));
  });

  it("un párrafo real de requisitos se ve entero, no en dos líneas", () => {
    const requisito =
      "Monto facturado acumulado equivalente a hasta S/ 18,750.00 por la venta de bienes iguales o " +
      "similares al objeto de la convocatoria, durante los últimos cinco (5) años.";
    expect(filasTextarea(requisito)).toBeGreaterThanOrEqual(4);
  });
});
