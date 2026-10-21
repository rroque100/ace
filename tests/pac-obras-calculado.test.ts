import { describe, expect, it } from "vitest";
import {
  calcularPacObras,
  formatearImporte,
  posicionTrasDigitos,
  soloImporte,
} from "@/lib/configuracion-entidad";
import { parseMonto } from "@/lib/configuracion-types";
import { PORCENTAJE_LINEA_CORTE } from "@/lib/segmentacion-parametros";

// El PAC se reparte entre bienes y servicios y obras. Antes se pedían los tres
// montos a mano y la única defensa contra que no cuadraran era un aviso de
// descuadre que nadie estaba obligado a resolver. Ahora obras es el resto.

describe("calcularPacObras", () => {
  it("resta el PAC de bienes y servicios del total", () => {
    expect(calcularPacObras("6099061.68", "1226465.70")).toBe("4872595.98");
  });

  it("acepta montos escritos como se publican, con S/ y separadores", () => {
    expect(calcularPacObras("S/ 6'099,061.68", "S/ 1'226,465.70")).toBe("4872595.98");
  });

  it("redondea a céntimos: el PAC se publica en soles con dos decimales", () => {
    expect(calcularPacObras("100.005", "0.001")).toBe("100");
  });

  it("sin alguno de los dos sumandos no hay resto que calcular", () => {
    expect(calcularPacObras("6099061.68", "")).toBe("");
    expect(calcularPacObras("", "1226465.70")).toBe("");
    expect(calcularPacObras(undefined, undefined)).toBe("");
  });

  it("un texto sin cifras no se interpreta como cero", () => {
    // Si "no aplica" valiera 0, el PAC de obras saldría igual al total.
    expect(calcularPacObras("6099061.68", "no aplica")).toBe("");
  });

  it("si bienes y servicios excede el total NO se guarda un negativo", () => {
    // Un PAC de obras negativo no es un dato: es un error de captura, y la UI
    // lo señala en vez de registrarlo.
    expect(calcularPacObras("1000", "2500")).toBe("");
  });

  it("un PAC íntegramente de bienes y servicios deja obras en cero", () => {
    expect(calcularPacObras("1226465.70", "1226465.70")).toBe("0");
  });
});

describe("línea de corte por cuantía (Art. 125.2)", () => {
  it("es el 10% del PAC de bienes y servicios, no del total", () => {
    expect(PORCENTAJE_LINEA_CORTE).toBe(0.1);
    const bienesServicios = 1226465.7;
    expect(Math.round(bienesServicios * PORCENTAJE_LINEA_CORTE * 100) / 100).toBe(122646.57);
  });
});

// Los tres montos del PAC son importes en soles. No se usa `<input
// type="number">`: rechaza el formato en que el PAC se publica ("S/ 1'226,465.70"),
// muestra flechas que alteran la cifra con la rueda del ratón y en varios
// navegadores admite "e" y signos. Se filtra la entrada.
describe("soloImporte · entrada de un monto en soles", () => {
  it("deja pasar una cifra con decimales", () => {
    expect(soloImporte("1226465.70")).toBe("1226465.70");
  });

  it("no impone límite de dígitos: el PAC de una entidad son millones", () => {
    // El síntoma reportado era que el campo "solo aceptaba 5 caracteres"; no
    // venía del filtro sino del autoguardado, pero conviene dejarlo fijado.
    expect(soloImporte("123456789012.34")).toBe("123456789012.34");
  });

  it("conserva los separadores de miles tal como se publican", () => {
    expect(soloImporte("1,226,465.70")).toBe("1,226,465.70");
  });

  it("descarta el símbolo de moneda y el apóstrofo de millones", () => {
    // El "S/" es un prefijo fijo del campo, no parte del valor.
    expect(soloImporte("S/ 1'226,465.70")).toBe("1226,465.70");
  });

  it("descarta letras y signos que no forman parte de una cifra", () => {
    expect(soloImporte("1e5")).toBe("15");
    expect(soloImporte("-2500")).toBe("2500");
    expect(soloImporte("abc")).toBe("");
  });

  it("admite un solo separador decimal: el primero manda", () => {
    expect(soloImporte("1226.465.70")).toBe("1226.46570");
  });

  it("deja escribir el punto mientras se teclea", () => {
    // Sin esto, no se podría llegar a "1226465.70": el punto desaparecería.
    expect(soloImporte("1226465.")).toBe("1226465.");
  });
});

// El PAC son cifras de siete u ocho dígitos: sin separadores no se distingue un
// millón de diez, y ese número decide la línea de corte del Art. 125.2.
describe("formatearImporte", () => {
  it("agrupa los miles y conserva los decimales", () => {
    expect(formatearImporte("1226465.70")).toBe("1,226,465.70");
    expect(formatearImporte("6099061.68")).toBe("6,099,061.68");
  });

  it("llega a los millones y más allá", () => {
    expect(formatearImporte("1000000")).toBe("1,000,000");
    expect(formatearImporte("123456789012.34")).toBe("123,456,789,012.34");
  });

  it("deja escribir el punto decimal: sin esto no se podrían teclear céntimos", () => {
    expect(formatearImporte("1226465")).toBe("1,226,465");
    expect(formatearImporte("1226465.")).toBe("1,226,465.");
    expect(formatearImporte("1226465.7")).toBe("1,226,465.7");
  });

  it("recorta a céntimos: el PAC no se publica con milésimas", () => {
    expect(formatearImporte("1000.999")).toBe("1,000.99");
  });

  it("reformatea un valor que ya traía separadores (recarga de la página)", () => {
    expect(formatearImporte("1,226,465.70")).toBe("1,226,465.70");
    // Separadores mal puestos se recolocan en vez de conservarse.
    expect(formatearImporte("12,26,465.70")).toBe("1,226,465.70");
  });

  it("quita los ceros a la izquierda, pero respeta el cero solo", () => {
    expect(formatearImporte("007")).toBe("7");
    expect(formatearImporte("0")).toBe("0");
    expect(formatearImporte("0.50")).toBe("0.50");
  });

  it("un campo vacío se queda vacío: no se convierte en 0", () => {
    expect(formatearImporte("")).toBe("");
    expect(formatearImporte("no aplica")).toBe("");
  });

  it("lo formateado sigue siendo legible para parseMonto y para el cálculo", () => {
    // Es la cadena que se guarda y la que alimenta la resta del PAC de obras.
    expect(parseMonto(formatearImporte("6099061.68"))).toBe(6099061.68);
    expect(calcularPacObras(formatearImporte("6099061.68"), formatearImporte("1226465.70"))).toBe(
      "4872595.98",
    );
  });
});

// Al insertar separadores el texto crece por la izquierda del cursor. Sin
// recolocarlo, saltaría al final y corregir el medio de una cifra sería
// imposible.
describe("posicionTrasDigitos", () => {
  it("sitúa el cursor tras el mismo dígito, aunque se haya insertado una coma", () => {
    // "1226|465" (4 dígitos a la izquierda) → "1,226|,465"
    expect(posicionTrasDigitos("1,226,465", 4)).toBe(5);
  });

  it("al principio del campo se queda al principio", () => {
    expect(posicionTrasDigitos("1,226,465", 0)).toBe(0);
  });

  it("si se contaron más dígitos de los que hay, va al final", () => {
    expect(posicionTrasDigitos("1,226", 99)).toBe(5);
  });

  it("cuenta dígitos, no caracteres: los separadores no desplazan la cuenta", () => {
    expect(posicionTrasDigitos("1,226,465.70", 7)).toBe(9);
  });
});
