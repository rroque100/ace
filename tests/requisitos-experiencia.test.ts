import { describe, expect, it } from "vitest";
import {
  ACREDITACION_EXPERIENCIA,
  HUECO_MONTO_EXPERIENCIA,
  HUECO_MONTO_MYPE,
  HUECO_SIMILARES,
  clausulaMype,
  componerExperienciaPorItems,
  componerExperienciaPostor,
  importeConLetras,
  montoDeExperiencia,
  montoMypeDeExperiencia,
  similaresDeExperiencia,
} from "@/lib/requisitos-experiencia";
import { formatRequisitos, parseRequisitos, repartirRequisitos } from "@/lib/requisitos-calificacion";
import { numeroALetras, nombreMoneda } from "@/lib/numero-a-letras";

/**
 * «Experiencia del postor en la especialidad» (Art. 72.3.c). El formato fija el
 * texto entero y deja un hueco: el monto facturado. Se compone con él, y de él
 * salen la cifra y su versión en letras, en la moneda de la convocatoria.
 */
describe("el número a letras respeta la moneda", () => {
  it("por defecto, soles (no rompe a los llamadores de siempre)", () => {
    expect(numeroALetras("180000.00")).toBe("CIENTO OCHENTA MIL CON 00/100 SOLES");
  });

  it("en dólares lo dice", () => {
    expect(numeroALetras("250000.50", "USD")).toBe("DOSCIENTOS CINCUENTA MIL CON 50/100 DÓLARES AMERICANOS");
  });

  it("reconoce la moneda por código, etiqueta o símbolo", () => {
    expect(nombreMoneda("PEN")).toBe("SOLES");
    expect(nombreMoneda("USD · Dólares americanos ($)")).toBe("DÓLARES AMERICANOS");
    expect(nombreMoneda("US$")).toBe("DÓLARES AMERICANOS");
    expect(nombreMoneda(null)).toBe("SOLES");
  });
});

describe("la cifra se escribe con su símbolo y sus letras", () => {
  it("soles", () => {
    expect(importeConLetras("180000", "PEN")).toBe("S/ 180,000.00 (CIENTO OCHENTA MIL CON 00/100 SOLES)");
  });

  it("dólares, con decimales", () => {
    expect(importeConLetras("250000.50", "USD")).toBe(
      "US$ 250,000.50 (DOSCIENTOS CINCUENTA MIL CON 50/100 DÓLARES AMERICANOS)",
    );
  });

  it("acepta un número, no solo texto", () => {
    expect(importeConLetras(180000, "PEN")).toContain("S/ 180,000.00");
  });

  it("sin monto, conserva el corchete del formato", () => {
    // En un documento que se firma, lo que falta tiene que verse.
    expect(importeConLetras("", "PEN")).toBe(`[${HUECO_MONTO_EXPERIENCIA}]`);
    expect(importeConLetras("0", "PEN")).toBe(`[${HUECO_MONTO_EXPERIENCIA}]`);
    expect(importeConLetras("-5", "PEN")).toBe(`[${HUECO_MONTO_EXPERIENCIA}]`);
  });
});

describe("el requisito completo es el del formato", () => {
  const t = componerExperienciaPostor({ monto: "180000", moneda: "PEN", objeto: "servicios" });

  it("abre con la fórmula exacta y el monto dentro", () => {
    expect(t).toContain(
      "El postor debe acreditar un monto facturado acumulado equivalente a S/ 180,000.00 (CIENTO OCHENTA MIL CON 00/100 SOLES),",
    );
  });

  it("cierra con los quince años y el cómputo del formato", () => {
    expect(t).toContain(
      "durante los quince (15) años anteriores a la fecha de la presentación de ofertas que se computa desde la fecha de la conformidad o emisión del comprobante de pago, según corresponda.",
    );
  });

  it("el objeto de la frase sigue al objeto de la contratación", () => {
    const p = (objeto: string) => componerExperienciaPostor({ monto: "1", moneda: "PEN", objeto });
    // Bienes usa el texto propio de su formato: «venta de bienes» y diez años.
    const bienes = componerExperienciaPostor({ monto: "180000", objeto: "bienes" });
    expect(bienes).toContain("por la venta de bienes iguales o similares");
    expect(bienes).toContain("durante los diez años anteriores");
    expect(t).toContain("por la contratación de servicios iguales o similares");
    expect(p("obras")).toContain("por la contratación de obras iguales o similares");
    expect(p("consultoria_obra")).toContain("por la contratación de consultoría de obras iguales o similares");
    // Objeto desconocido: cae en servicios, que es el caso más común.
    expect(p("")).toContain("por la contratación de servicios iguales o similares");
  });

  it("sin monto, el requisito sigue saliendo con su corchete", () => {
    const vacio = componerExperienciaPostor({ moneda: "PEN", objeto: "servicios" });
    expect(vacio).toContain(`[${HUECO_MONTO_EXPERIENCIA}]`);
    expect(vacio).toContain("por la contratación de servicios iguales o similares");
  });
});

describe("la segunda frase: qué se considera similar", () => {
  it("acompaña siempre al requisito, con lo registrado dentro", () => {
    const t = componerExperienciaPostor({
      monto: "180000",
      moneda: "PEN",
      objeto: "servicios",
      similares: "mantenimiento de áreas verdes y jardinería",
    });
    expect(t).toContain(
      "Se consideran servicios similares a los siguientes: mantenimiento de áreas verdes y jardinería.",
    );
  });

  it("sin registrar, conserva el corchete del formato", () => {
    const t = componerExperienciaPostor({ monto: "180000", objeto: "servicios" });
    expect(t).toContain(`Se consideran servicios similares a los siguientes: [${HUECO_SIMILARES}].`);
  });

  it("la palabra del objeto es coherente en las frases", () => {
    const t = componerExperienciaPostor({ monto: "1", objeto: "bienes", similares: "equipos de cómputo" });
    expect(t).toContain("por la venta de bienes iguales o similares");
    expect(t).toContain("Se consideran bienes similares a los siguientes: equipos de cómputo.");
  });

  it("se relee del detalle, y el corchete no cuenta como valor", () => {
    const conValor = componerExperienciaPostor({ monto: "1", objeto: "servicios", similares: "jardinería y afines" });
    expect(similaresDeExperiencia(conValor)).toBe("jardinería y afines");
    const sinValor = componerExperienciaPostor({ monto: "1", objeto: "servicios" });
    expect(similaresDeExperiencia(sinValor)).toBe("");
    expect(similaresDeExperiencia("texto sin la frase")).toBe("");
  });
});

describe("el monto se relee del detalle al reabrir", () => {
  it("porque no tiene columna propia: es la fuente de verdad", () => {
    const detalle = componerExperienciaPostor({ monto: "180000", moneda: "PEN", objeto: "servicios" });
    expect(montoDeExperiencia(detalle)).toBe("180000");
  });

  it("sin importe en el texto, devuelve vacío", () => {
    expect(montoDeExperiencia("El postor debe acreditar experiencia.")).toBe("");
    expect(montoDeExperiencia("")).toBe("");
    expect(montoDeExperiencia(null)).toBe("");
  });
});

describe("la acreditación es el texto fijo del formato", () => {
  it("es el literal de las bases estándar, no un resumen", () => {
    expect(ACREDITACION_EXPERIENCIA).toContain(
      "La experiencia del postor en la especialidad se acredita con un máximo de veinte (20) contrataciones",
    );
    expect(ACREDITACION_EXPERIENCIA).toContain("comprobante de retención electrónico emitido por SUNAT por la retención del IGV");
    expect(ACREDITACION_EXPERIENCIA).toContain("Anexo N° 14");
  });

  it("no arrastra los números de nota al pie del original (15, 16, 17)", () => {
    // Remiten a notas que este documento no lleva; sueltos serían ruido.
    expect(ACREDITACION_EXPERIENCIA).not.toContain("pago15");
    expect(ACREDITACION_EXPERIENCIA).not.toContain("IGV 16");
    expect(ACREDITACION_EXPERIENCIA).not.toContain("privados 17");
  });

  it("el cierre del Anexo 11 va marcado en negrita, y nada más", () => {
    const enNegrita = ACREDITACION_EXPERIENCIA.match(/\*\*([^*]+)\*\*/g) ?? [];
    expect(enNegrita).toHaveLength(1);
    expect(enNegrita[0]).toContain("los postores deben llenar y presentar el Anexo N° 11");
  });

  it("sobrevive intacta al round-trip del texto canónico de requisitos", () => {
    // Va en el campo «acreditación» de un obligatorio, que se serializa pegado
    // al nombre; los saltos de párrafo y la marca de negrita deben volver.
    const canonico = formatRequisitos({
      obligatorios: [`Experiencia del postor en la especialidad — Acredita: ${ACREDITACION_EXPERIENCIA}`],
      facultativos: [],
    });
    const vuelta = repartirRequisitos(parseRequisitos(canonico)).porTipo.get("experiencia_postor");
    expect(vuelta?.acreditacion).toBe(ACREDITACION_EXPERIENCIA);
  });
});

describe("la cláusula MYPE (Anexo N° 1, monto registrado, diez años)", () => {
  it("se incluye tras el requisito general en bienes, con el monto MYPE dentro", () => {
    const t = componerExperienciaPostor({ monto: "180000", montoMype: "50000", moneda: "PEN", objeto: "bienes" });
    expect(t).toContain("micro y pequeña empresa");
    expect(t).toContain("Anexo N° 1 ");
    expect(t).toContain("durante los diez años");
    expect(t).toContain("todos los integrantes deben contar con la condición de micro y pequeña empresa");
    // El monto MYPE que registró el área usuaria, en números y letras.
    expect(t).toContain("S/ 50,000.00 (CINCUENTA MIL CON 00/100 SOLES)");
    // En bienes el formato dice «venta de bienes».
    expect(t).toContain("por la venta de bienes iguales o similares");
  });

  it("en servicios usa el verbo neutro del requisito", () => {
    const t = componerExperienciaPostor({ monto: "1", montoMype: "10000", objeto: "servicios" });
    expect(t).toContain("por la contratación de servicios iguales o similares al objeto de la convocatoria, durante los diez años");
  });

  it("sin monto MYPE conserva el corchete del 25%", () => {
    const t = componerExperienciaPostor({ monto: "1", objeto: "bienes" });
    expect(t).toContain(`[${HUECO_MONTO_MYPE}]`);
  });

  it("NO se incluye en obras ni consultoría de obras", () => {
    for (const objeto of ["obras", "consultoria_obra"]) {
      const t = componerExperienciaPostor({ monto: "1", montoMype: "50000", objeto });
      expect(t, objeto).not.toContain("micro y pequeña empresa");
    }
  });

  it("relee cada monto por separado, y lo similar queda intacto", () => {
    const t = componerExperienciaPostor({
      monto: "180000",
      montoMype: "50000",
      moneda: "PEN",
      objeto: "bienes",
      similares: "equipos de cómputo",
    });
    // El monto general y el MYPE se releen cada uno de su frase, sin confundirse.
    expect(montoDeExperiencia(t)).toBe("180000");
    expect(montoMypeDeExperiencia(t)).toBe("50000");
    // La frase de similares queda al final y se relee intacta.
    expect(similaresDeExperiencia(t)).toBe("equipos de cómputo");
  });

  it("clausulaMype es reutilizable de forma aislada", () => {
    const c = clausulaMype({ monto: "50000", moneda: "PEN", objeto: "bienes" });
    expect(c).toMatch(/^En el caso de postores que declaren en el Anexo N° 1/);
    expect(c).toContain("S/ 50,000.00");
  });
});

describe("por relación de ítems: un bloque por ítem con su cuantía", () => {
  const items = [
    { nro: 1, cuantia: 200000 },
    { nro: 2, cuantia: 80000 },
  ];
  const t = componerExperienciaPorItems(items, { moneda: "PEN", objeto: "bienes", similares: "equipos de cómputo" });

  it("rotula cada ítem con su número", () => {
    expect(t).toContain("Ítem N° 1: El postor debe acreditar");
    expect(t).toContain("Ítem N° 2: El postor debe acreditar");
  });

  it("el 25% MYPE se calcula sobre la cuantía DE CADA ítem", () => {
    // 25% de 200,000 = 50,000; 25% de 80,000 = 20,000.
    expect(t).toContain("S/ 50,000.00 (CINCUENTA MIL CON 00/100 SOLES)");
    expect(t).toContain("S/ 20,000.00 (VEINTE MIL CON 00/100 SOLES)");
  });

  it("el monto general de cada ítem queda en corchete (lo fija el área usuaria por ítem)", () => {
    expect(t).toContain(`[${HUECO_MONTO_EXPERIENCIA}]`);
  });

  it("un ítem sin cuantía conserva el corchete del 25%", () => {
    const s = componerExperienciaPorItems([{ nro: 1, cuantia: null }], { objeto: "bienes" });
    expect(s).toContain(`[${HUECO_MONTO_MYPE}]`);
  });

  it("sin ítems devuelve cadena vacía", () => {
    expect(componerExperienciaPorItems([], { objeto: "bienes" })).toBe("");
  });
});

describe("cabe en el tope del campo de requisitos", () => {
  it("el detalle compuesto no rebasa el esquema", async () => {
    // El requisito viaja dentro del texto canónico de `requisitos_calificacion`.
    const { necesidadUpdateSchema } = await import("@/lib/necesidades");
    const detalle = componerExperienciaPostor({ monto: "999999999", moneda: "USD", objeto: "consultoria_obra" });
    // Se guarda como parte del texto de requisitos; aquí basta con que un
    // requisito solo quepa de sobra en el tope de esa columna.
    expect(necesidadUpdateSchema.safeParse({ requisitosCalificacion: detalle }).success).toBe(true);
  });
});
