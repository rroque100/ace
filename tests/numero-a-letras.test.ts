import { describe, expect, it } from "vitest";
import { numeroALetras } from "@/lib/numero-a-letras";

/** Solo la parte en letras, sin el "CON xx/100 SOLES". */
const letras = (n: string) => numeroALetras(n).replace(/ CON \d\d\/100 SOLES$/, "");

describe("numeroALetras", () => {
  it("pone la Y entre decena y unidad", () => {
    // El bug: salía "OCHENTA CINCO". En español la conjunción es obligatoria.
    // Afectaba a toda cantidad con decena 30-90 y unidad ≠ 0, incluidos los
    // montos de los contratos.
    expect(letras("85")).toBe("OCHENTA Y CINCO");
    expect(letras("31")).toBe("TREINTA Y UN");
    expect(letras("99")).toBe("NOVENTA Y NUEVE");
    expect(letras("46")).toBe("CUARENTA Y SEIS");
  });

  it("NO pone la Y donde no toca", () => {
    expect(letras("205")).toBe("DOSCIENTOS CINCO"); // centena + unidad, sin decena
    expect(letras("80")).toBe("OCHENTA"); // decena sola
    expect(letras("100")).toBe("CIEN");
    expect(letras("300")).toBe("TRESCIENTOS");
  });

  it("respeta las formas irregulares del 11 al 29", () => {
    expect(letras("11")).toBe("ONCE");
    expect(letras("15")).toBe("QUINCE");
    expect(letras("16")).toBe("DIECISEIS");
    expect(letras("21")).toBe("VEINTIUN");
    expect(letras("24")).toBe("VEINTICUATRO");
    expect(letras("20")).toBe("VEINTE");
  });

  it("reproduce el monto del Anexo N° 1 firmado", () => {
    // actuaciones-preparatorias/SKM_651i26071503420.pdf:
    // "S/. 285,924.00 (Doscientos Ochenta Y Cinco Mil Novecientos
    //  Veinticuatro Con 00/100 Soles)"
    expect(numeroALetras("285,924.00")).toBe(
      "DOSCIENTOS OCHENTA Y CINCO MIL NOVECIENTOS VEINTICUATRO CON 00/100 SOLES",
    );
  });

  it("mantiene el ejemplo de la cabecera del módulo", () => {
    expect(numeroALetras("603,806.00")).toBe(
      "SEISCIENTOS TRES MIL OCHOCIENTOS SEIS CON 00/100 SOLES",
    );
  });

  it("conserva los céntimos", () => {
    expect(numeroALetras("1,234.56")).toBe("UN MIL DOSCIENTOS TREINTA Y CUATRO CON 56/100 SOLES");
  });

  it("maneja millones y el cero", () => {
    expect(letras("1000000")).toBe("UN MILLON");
    expect(letras("2500000")).toBe("DOS MILLONES QUINIENTOS MIL");
    expect(letras("0")).toBe("CERO");
  });
});
