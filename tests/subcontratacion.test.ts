import { describe, expect, it } from "vitest";
import {
  componerSubcontratacion,
  faltaSustentoProhibicion,
  parseSubcontratacion,
  type Subcontratacion,
  TEXTO_NO_CORRESPONDE,
  TEXTO_PERMITIDA,
  TEXTO_PROHIBIDA,
} from "@/lib/subcontratacion";

/**
 * Apartado g): las tres opciones del modelo son mutuamente excluyentes y el par
 * componer/parse debe ser reversible: lo que se guarda se vuelve a leer con la
 * misma modalidad, o el editor perdería la elección al reabrir la ficha.
 */
describe("subcontratación · componer ↔ parse", () => {
  it("«No corresponde» va y vuelve como su propia modalidad", () => {
    const datos: Subcontratacion = { modalidad: "no_corresponde", prestacionesExcluidas: "", sustento: "" };
    const texto = componerSubcontratacion(datos);
    expect(texto).toBe(TEXTO_NO_CORRESPONDE);
    expect(parseSubcontratacion(texto).modalidad).toBe("no_corresponde");
  });

  it("permitida conserva las prestaciones excluidas", () => {
    const datos: Subcontratacion = {
      modalidad: "permitida",
      prestacionesExcluidas: "La instalación de los equipos de comunicaciones.",
      sustento: "",
    };
    const leido = parseSubcontratacion(componerSubcontratacion(datos));
    expect(leido.modalidad).toBe("permitida");
    expect(leido.prestacionesExcluidas).toBe(datos.prestacionesExcluidas);
    expect(componerSubcontratacion(datos)).toContain(TEXTO_PERMITIDA);
  });

  it("prohibida conserva el sustento (Art. 108.1)", () => {
    const datos: Subcontratacion = {
      modalidad: "prohibida",
      prestacionesExcluidas: "",
      sustento: "La prestación es indivisible por su naturaleza especializada.",
    };
    const leido = parseSubcontratacion(componerSubcontratacion(datos));
    expect(leido.modalidad).toBe("prohibida");
    expect(leido.sustento).toBe(datos.sustento);
    expect(componerSubcontratacion(datos)).toContain(TEXTO_PROHIBIDA);
  });

  it("prohibir sin sustento avisa; «No corresponde» y permitida no", () => {
    expect(faltaSustentoProhibicion({ modalidad: "prohibida", prestacionesExcluidas: "", sustento: "" })).toBe(true);
    expect(faltaSustentoProhibicion({ modalidad: "no_corresponde", prestacionesExcluidas: "", sustento: "" })).toBe(false);
    expect(faltaSustentoProhibicion({ modalidad: "permitida", prestacionesExcluidas: "", sustento: "" })).toBe(false);
  });

  it("un texto vacío no tiene modalidad", () => {
    expect(parseSubcontratacion("").modalidad).toBeNull();
    expect(parseSubcontratacion(null).modalidad).toBeNull();
  });
});
