import { describe, expect, it } from "vitest";
import { EXCERPT_HEAD, EXCERPT_LIMIT, queryStems, relevantExcerpt } from "../lib/chat-excerpt";

const relleno = (n: number, palabra = "tema ajeno de apoyo") => Array.from({ length: n }, (_, i) => `${palabra} ${i}.`).join(" ");
const FRASE = "El mayor costo se hace efectivo deduciendo dicho monto de las valorizaciones y de la liquidación del contrato.";
const largo = `Artículo 210. Mayor costo de la supervisión. ${relleno(70)} ${FRASE} ${relleno(20)}`;
const PREGUNTA = "¿Quién asume el mayor costo de la extensión de la supervisión y cómo se deduce de las valorizaciones?";

describe("raíces de la pregunta", () => {
  it("quita las palabras vacías y las genéricas, sin tildes, recortadas a 6 letras (valorización ~ valorizaciones)", () => {
    const raices = queryStems(PREGUNTA);
    expect(raices).toContain("valori");
    expect(raices).toContain("superv");
    expect(raices).not.toContain("quien");
    expect(raices).not.toContain("contra");
  });
});

describe("extracto que ve el modelo", () => {
  it("un fragmento corto se entrega entero", () => {
    expect(relevantExcerpt("Artículo 1. Objeto de la norma.", PREGUNTA)).toBe("Artículo 1. Objeto de la norma.");
  });

  it("caso real (art. 210): la frase que responde cae DESPUÉS del carácter 1 400 y ahora llega al modelo", () => {
    expect(largo.indexOf(FRASE)).toBeGreaterThan(EXCERPT_LIMIT);
    expect(largo.slice(0, EXCERPT_LIMIT)).not.toContain("deduciendo");
    const extracto = relevantExcerpt(largo, PREGUNTA);
    expect(extracto).toContain("deduciendo dicho monto");
    expect(extracto.startsWith("Artículo 210. Mayor costo de la supervisión.")).toBe(true);
  });

  it("casi no crece: a lo sumo 130 caracteres sobre el recorte de siempre (el separador y el retroceso hasta el inicio de la frase)", () => {
    expect(relevantExcerpt(largo, PREGUNTA).length).toBeLessThanOrEqual(EXCERPT_LIMIT + 130);
  });

  it("si lo relevante ya estaba en el recorte de siempre, queda idéntico (la gran mayoría de los fragmentos no cambia)", () => {
    const temprano = `Artículo 113. Garantía de fiel cumplimiento. La garantía equivale al 10% del monto del contrato original. ${relleno(120)}`;
    expect(relevantExcerpt(temprano, "¿Qué porcentaje debe tener la garantía de fiel cumplimiento?")).toBe(temprano.slice(0, EXCERPT_LIMIT));
  });

  it("sin palabras con contenido en la pregunta, el recorte de siempre", () => {
    expect(relevantExcerpt(largo, "¿Y eso cuándo?")).toBe(largo.slice(0, EXCERPT_LIMIT));
  });

  it("empieza en el inicio de una frase, no a mitad de una oración", () => {
    const extracto = relevantExcerpt(largo, PREGUNTA);
    const ventana = extracto.slice(extracto.indexOf("…") + 2);
    expect(ventana).toMatch(/^[A-ZÁÉÍÓÚ0-9]|^tema/);
  });

  it("conserva el encabezado aunque la ventana esté muy lejos", () => {
    expect(relevantExcerpt(largo, PREGUNTA).slice(0, EXCERPT_HEAD - 50)).toBe(largo.slice(0, EXCERPT_HEAD - 50));
  });

  it("con ventanas empatadas toma la del medio: la respuesta que viene después de las palabras de la pregunta no queda fuera (art. 210)", () => {
    // Las raíces de la pregunta están juntas y la frase que responde empieza ~150 caracteres después de la última.
    const bloque = "En caso de atrasos por causas imputables, el contratista asume el mayor costo de la extensión de la supervisión";
    const cola = "y se hace efectivo deduciendo dicho monto de las valorizaciones.";
    const contenido = `Artículo 210. Pago de obras. ${relleno(60)} ${bloque}, ${relleno(3, "otro asunto")} ${cola} ${relleno(40)}`;
    expect(contenido.indexOf(cola)).toBeGreaterThan(EXCERPT_LIMIT);
    const extracto = relevantExcerpt(contenido, "¿Quién asume el mayor costo de la extensión de la supervisión por atrasos imputables?");
    expect(extracto).toContain("deduciendo dicho monto");
    expect(extracto).toContain("asume el mayor costo");
  });
});
