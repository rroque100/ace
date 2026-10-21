import { describe, expect, it } from "vitest";
import { esMarcador } from "@/lib/necesidad-copiloto";

// Guardarraíl del traslado propuesta IA → ficha de necesidad.
//
// La propuesta deja marcadores [ENTRE CORCHETES] donde no puede inventar un dato
// concreto (montos, plazos, nombres). Eso es correcto en el documento, que se
// completa a mano en Word; pero trasladarlo a la ficha llenaría columnas con
// texto que no es un dato y que después viajaría al expediente. Un campo cuyo
// único contenido es un marcador se OMITE del traslado.

describe("esMarcador · qué no se traslada a la ficha", () => {
  it("un marcador solo no es un dato", () => {
    expect(esMarcador("[CONSIGNAR EL PLAZO]")).toBe(true);
    expect(esMarcador("[COMPLETAR]")).toBe(true);
    expect(esMarcador("[...]")).toBe(true);
  });

  it("varios marcadores con puntuación entre ellos tampoco", () => {
    expect(esMarcador("[DEPARTAMENTO] - [PROVINCIA] - [DISTRITO]")).toBe(true);
    expect(esMarcador("[MONTO], [PLAZO].")).toBe(true);
  });

  it("vacío o solo espacios se omite", () => {
    expect(esMarcador("")).toBe(true);
    expect(esMarcador("   \n ")).toBe(true);
  });

  it("un valor real SÍ se traslada, aunque lleve un marcador dentro", () => {
    // Lo habitual: texto útil con un hueco puntual. Se traslada: el área usuaria
    // completa el hueco en la ficha, que es justo donde debe hacerlo.
    expect(esMarcador("Se efectuará en un único pago dentro de [10] días hábiles.")).toBe(false);
    expect(esMarcador("Almacén central de la Municipalidad Distrital de Challhuahuacho")).toBe(false);
  });

  it("un número suelto es un dato", () => {
    expect(esMarcador("30")).toBe(false);
  });
});
