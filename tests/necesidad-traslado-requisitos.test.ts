import { describe, expect, it } from "vitest";
import { parseRequisitos, repartirRequisitos } from "@/lib/requisitos-calificacion";

// El traslado de la propuesta IA escribía los requisitos como PROSA. El editor
// de la ficha reparte el texto entre los CINCO tipos del Art. 72.3 reconociendo
// su etiqueta exacta: con prosa, todo caía en "otros" y ningún tipo quedaba
// marcado — el campo se veía lleno pero sin registrar como obligatorio.
//
// Por eso la extracción impone el formato canónico. Esto comprueba el contrato
// entre las dos piezas: lo que la IA emite es lo que el editor sabe leer.

// Salida real de la extracción (verificada contra el modelo).
const DE_LA_IA =
  "OBLIGATORIOS:\n" +
  "- Capacidad legal: El postor debe contar con inscripción vigente en el RNP, capítulo de bienes.\n" +
  "- Experiencia del postor en la especialidad: Monto facturado acumulado de hasta S/ 18,750.00 en bienes iguales o similares.";

describe("el traslado deja los requisitos REGISTRADOS en sus tipos del 72.3", () => {
  const reparto = repartirRequisitos(parseRequisitos(DE_LA_IA));

  it("reconoce los tipos por su etiqueta exacta", () => {
    expect(reparto.porTipo.has("capacidad_legal")).toBe(true);
    expect(reparto.porTipo.has("experiencia_postor")).toBe(true);
  });

  it("quedan marcados como OBLIGATORIOS, no como facultativos", () => {
    expect(reparto.porTipo.get("capacidad_legal")?.estado).toBe("obligatorio");
    expect(reparto.porTipo.get("experiencia_postor")?.estado).toBe("obligatorio");
  });

  it("conserva el detalle de cada tipo", () => {
    expect(reparto.porTipo.get("experiencia_postor")?.detalle).toContain("S/ 18,750.00");
  });

  it("no deja nada en el cajón de «otros»", () => {
    expect(reparto.otrosObligatorios).toEqual([]);
    expect(reparto.otrosFacultativos).toEqual([]);
  });

  it("los tipos no tratados por la propuesta no se inventan", () => {
    expect(reparto.porTipo.has("capacidad_economica")).toBe(false);
  });

  it("REGRESIÓN: en prosa, ningún tipo se registra (el fallo que se corrigió)", () => {
    const prosa = "El postor debe contar con RNP vigente y experiencia acreditada en el rubro.";
    const malo = repartirRequisitos(parseRequisitos(prosa));
    expect(malo.porTipo.size).toBe(0);
    expect(malo.otrosObligatorios.length).toBe(1);
  });
});
