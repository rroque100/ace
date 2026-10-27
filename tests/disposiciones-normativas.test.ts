import { describe, expect, it } from "vitest";
import {
  dispositionSectionTitle,
  dispositionZoneStart,
  ordinalValue,
  segmentDispositions,
  type DispositionKind,
} from "../lib/disposiciones-normativas";
import { segmentArticlesFromPages } from "../lib/pdf-processing";

describe("ordinales legales en español", () => {
  const CASOS: Array<[string, number | null]> = [
    ["ÚNICA", 1], ["PRIMERA", 1], ["SEGUNDA", 2], ["TERCERA", 3], ["CUARTA", 4], ["QUINTA", 5],
    ["SEXTA", 6], ["SÉPTIMA", 7], ["OCTAVA", 8], ["NOVENA", 9], ["DÉCIMA", 10], ["UNDÉCIMA", 11],
    ["DUODÉCIMA", 12], ["DÉCIMA PRIMERA", 11], ["DECIMO PRIMERA", 11], ["DECIMOPRIMERA", 11],
    ["DECIMOSEGUNDA", 12], ["DÉCIMA TERCERA", 13], ["DECIMOTERCERA", 13], ["DECIMOCTAVA", 18],
    ["DECIMOSÉPTIMA", 17], ["VIGÉSIMA", 20], ["VIGESIMOPRIMERA", 21], ["VIGÉSIMA SEGUNDA", 22],
    ["VIGESIMONOVENA", 29], ["TRIGÉSIMA", 30],
    // No son ordinales: siglas y palabras sueltas que preceden a un punto.
    ["OECE", null], ["EF", null], ["SUNAT", null], ["ARTÍCULO", null], ["DE ERRATAS", null],
  ];

  it("convierte cada ordinal y rechaza lo que no lo es", () => {
    for (const [palabra, valor] of CASOS) expect(ordinalValue(palabra), palabra).toBe(valor);
  });
});

const KINDS: DispositionKind[] = ["final", "transitoria", "modificatoria", "derogatoria"];

describe("títulos de sección", () => {
  it("cada tipo tiene el suyo", () => {
    for (const kind of KINDS) expect(dispositionSectionTitle(kind)).toMatch(/^Disposiciones Complementarias /);
  });
});

// Estructura mínima, calcada de la Ley 32069: artículos, luego las secciones en
// MAYÚSCULAS y cada disposición con su ordinal.
const NORMA = [
  "Artículo 99. Último artículo. Se aplica conforme a la Décima Disposición Complementaria Final de la presente Ley.",
  "Artículo 100. Vigencia. La presente Ley entra en vigencia en 2026.",
  "DISPOSICIONES COMPLEMENTARIAS FINALES",
  "PRIMERA. Reglamento El Poder Ejecutivo aprueba el Reglamento en 90 días.",
  "SEGUNDA. Plataforma Se implementa la plataforma conforme a la Primera Disposición Complementaria Transitoria.",
  "TERCERA. Capacitación El OECE capacita a los operadores.",
  "DISPOSICIÓN COMPLEMENTARIA MODIFICATORIA",
  "ÚNICA. Modificación Modifícase el artículo 8 del Decreto Legislativo 1071.",
  "DISPOSICIONES COMPLEMENTARIAS TRANSITORIAS",
  "PRIMERA. Procedimientos en trámite Continúan regulados por la norma anterior.",
  "SEGUNDA. Contratos vigentes Los contratos vigentes se rigen por la Ley 30225.",
  "DISPOSICIÓN COMPLEMENTARIA DEROGATORIA",
  "ÚNICA. Derogación Derógase la Ley 30225, Ley de Contrataciones del Estado.",
  "Comuníquese al señor Presidente de la República para su promulgación.",
  "POR TANTO: Mando se publique y cumpla. Dado en Lima, a los 9 días de junio de 2025.",
].join("\n");

describe("segmentación de las disposiciones complementarias", () => {
  const segmentos = segmentDispositions(NORMA);
  const porEtiqueta = new Map(segmentos.map((s) => [s.label, s]));

  it("cada disposición numerada es un segmento, con etiqueta estable", () => {
    expect(segmentos.map((s) => s.label)).toEqual([
      "DCF-1", "DCF-2", "DCF-3", "DCM-1", "DCT-1", "DCT-2", "DCD-1",
    ]);
    for (const s of segmentos) expect(s.content.startsWith(s.heading + "."), s.label).toBe(true);
  });

  it("la derogatoria conserva la mención de la norma derogada (la que no llegaba al índice)", () => {
    expect(porEtiqueta.get("DCD-1")!.content).toContain("Derógase la Ley 30225");
    expect(porEtiqueta.get("DCD-1")!.heading).toBe("Disposición Complementaria Derogatoria Única");
  });

  it("no mezcla el contenido de una disposición con el de la siguiente", () => {
    expect(porEtiqueta.get("DCF-1")!.content).toContain("Reglamento en 90 días");
    expect(porEtiqueta.get("DCF-1")!.content).not.toContain("plataforma");
    expect(porEtiqueta.get("DCT-2")!.content).not.toContain("Derógase");
  });

  it("la zona termina en la firma: «Comuníquese» y «POR TANTO» no entran en la última", () => {
    const ultima = porEtiqueta.get("DCD-1")!.content;
    expect(ultima).not.toContain("Comuníquese");
    expect(ultima).not.toContain("POR TANTO");
  });

  it("las referencias en minúsculas del cuerpo no abren una sección", () => {
    // «Décima Disposición Complementaria Final» (artículo 99) y «Primera
    // Disposición Complementaria Transitoria» (DCF-2) no son encabezados.
    expect(dispositionZoneStart(NORMA)).toBe(NORMA.indexOf("DISPOSICIONES COMPLEMENTARIAS FINALES"));
    expect(segmentos.filter((s) => s.kind === "final")).toHaveLength(3);
  });

  it("un texto sin disposiciones no produce nada", () => {
    expect(segmentDispositions("Artículo 1. Objeto. Esta norma regula la compra.")).toEqual([]);
    expect(dispositionZoneStart("Artículo 1. Objeto.")).toBe(-1);
  });

  it("copias SPIJ: los encabezados repetidos al citar textos modificatorios no duplican la sección", () => {
    const spij = `${NORMA}\nNOTA SPIJ: Texto citado: DISPOSICIONES COMPLEMENTARIAS FINALES PRIMERA. Texto antiguo.`;
    expect(segmentDispositions(spij).map((s) => s.label)).toEqual(segmentos.map((s) => s.label));
  });
});

describe("ordinales con formatos reales distintos", () => {
  it("«SEGUNDA. - Ficha Única…»: guion tras el punto", () => {
    const texto = "DISPOSICIONES COMPLEMENTARIAS FINALES\nPRIMERA. - Reglamento Se aprueba.\nSEGUNDA. - Ficha Única de Proveedor Se crea.";
    const s = segmentDispositions(texto);
    expect(s.map((x) => x.label)).toEqual(["DCF-1", "DCF-2"]);
    expect(s[1].content).toContain("Ficha Única de Proveedor");
  });

  it("ordinales compuestos y con prefijo «decimo»", () => {
    const palabras = ["PRIMERA", "SEGUNDA", "TERCERA", "CUARTA", "QUINTA", "SEXTA", "SÉPTIMA", "OCTAVA", "NOVENA", "DÉCIMA",
      "DECIMOPRIMERA", "DECIMOSEGUNDA", "DÉCIMA TERCERA", "DECIMOCUARTA"];
    const texto =
      "DISPOSICIONES COMPLEMENTARIAS FINALES\n" + palabras.map((p) => `${p}. Tema de ${p.toLowerCase()} Texto de la disposición.`).join("\n");
    expect(segmentDispositions(texto).map((x) => x.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
  });

  it("copia SPIJ: la nota «(*)RECTIFICADO POR FE DE ERRATAS» pegada al ordinal no lo oculta ni ensucia la anterior", () => {
    const texto =
      "DISPOSICIONES COMPLEMENTARIAS TRANSITORIAS\n" +
      "SEGUNDA. Registro Continúa vigente el Decreto Supremo 344-2018-EF. (*)RECTIFICADO POR FE DE ERRATAS TERCERA. Reinscripción Los ejecutores se reinscriben.";
    const s = segmentDispositions(texto);
    expect(s.map((x) => x.label)).toEqual(["DCT-2", "DCT-3"]);
    expect(s[0].content.endsWith("344-2018-EF.")).toBe(true);
    expect(s[1].content).toContain("Reinscripción");
  });

  it("tolera un ordinal perdido por la extracción, pero no acepta saltos absurdos", () => {
    const texto =
      "DISPOSICIONES COMPLEMENTARIAS TRANSITORIAS\nPRIMERA. Uno Texto.\nTERCERA. Tres Texto.\nVIGÉSIMA. Veinte Texto que no es un encabezado real.";
    expect(segmentDispositions(texto).map((x) => x.label)).toEqual(["DCT-1", "DCT-3"]);
  });

  it("«ÚNICA» solo abre una sección; dentro de otra es texto", () => {
    const texto =
      "DISPOSICIONES COMPLEMENTARIAS FINALES\nPRIMERA. Uno Texto.\nÚNICA. Esto es una frase suelta del cuerpo.";
    expect(segmentDispositions(texto).map((x) => x.label)).toEqual(["DCF-1"]);
  });

  it("un anexo corta la zona (Reglamento oficial)", () => {
    const texto =
      "DISPOSICIÓN COMPLEMENTARIA DEROGATORIA\nÚNICA. Derogatoria Derogar el Decreto Supremo 344-2018-EF.\nANEXO I. Formulario de solicitud. Nombre del proveedor.";
    const s = segmentDispositions(texto);
    expect(s).toHaveLength(1);
    expect(s[0].content).not.toContain("Formulario");
  });
});

describe("integración con la segmentación por artículos", () => {
  const paginas = [
    { pageNumber: 1, text: "Artículo 1. Objeto. Esta Ley regula las contrataciones públicas. ".repeat(3) + "Artículo 2. Ámbito. Se aplica a las entidades del Estado y a sus proveedores." },
    { pageNumber: 2, text: "Artículo 3. Principios. Rigen la libertad de concurrencia, la transparencia y la competencia efectiva." },
    { pageNumber: 3, text: "Artículo 4. Vigencia. La presente Ley entra en vigencia el 22 de abril de 2026. " + "x".repeat(40) },
    { pageNumber: 4, text: "DISPOSICIONES COMPLEMENTARIAS FINALES\nPRIMERA. Reglamento El Poder Ejecutivo aprueba el Reglamento." },
    { pageNumber: 5, text: "DISPOSICIÓN COMPLEMENTARIA DEROGATORIA\nÚNICA. Derogación Derógase la Ley 30225, Ley de Contrataciones del Estado.\nComuníquese al señor Presidente." },
  ];

  it("el último artículo ya no absorbe las disposiciones (era lo que enterraba la derogatoria)", () => {
    const segmentos = segmentArticlesFromPages(paginas);
    const ultimoArticulo = segmentos.filter((s) => /^\d+$/.test(s.articleNumber)).at(-1)!;
    expect(ultimoArticulo.articleNumber).toBe("4");
    expect(ultimoArticulo.content).not.toContain("Ley 30225");
    expect(ultimoArticulo.content).not.toContain("DISPOSICIONES");
    expect(ultimoArticulo.pageEnd).toBe(3);
  });

  it("las disposiciones salen como segmentos propios, con su página y su sección", () => {
    const segmentos = segmentArticlesFromPages(paginas);
    const derogatoria = segmentos.find((s) => s.articleNumber === "DCD-1")!;
    expect(derogatoria).toBeDefined();
    expect(derogatoria.content).toContain("Derógase la Ley 30225");
    expect(derogatoria.pageStart).toBe(5);
    expect(derogatoria.sectionTitle).toBe("Disposiciones Complementarias Derogatorias");
    expect(segmentos.map((s) => s.ordinal)).toEqual(segmentos.map((_, i) => i));
  });

  it("una norma sin disposiciones se segmenta como antes", () => {
    const sin = segmentArticlesFromPages(paginas.slice(0, 3));
    expect(sin.map((s) => s.articleNumber)).toEqual(["1", "2", "3", "4"]);
  });
});
