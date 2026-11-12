import { describe, expect, it } from "vitest";
import { answerSourceLimit, questionParts } from "@/lib/chat-question-plan";
import { bestCoveringSource, uncoveredParts, widenToArticles, type ArticleRow } from "@/lib/chat-article-window";
import { EXCERPT_LIMIT } from "@/lib/chat-excerpt";

describe("cuántas fuentes recibe la respuesta", () => {
  it("ocho para una pregunta puntual", () => {
    for (const pregunta of [
      "¿Qué porcentaje del monto del contrato original debe tener la garantía de fiel cumplimiento?",
      "¿La Ley 30225 sigue vigente?",
      "¿Qué es la conformidad de la prestación?",
      "¿Qué plazos y condiciones tiene la garantía de adelanto?",
    ]) expect(answerSourceLimit(pregunta), pregunta).toBe(8);
  });

  it("doce para procedimiento, requisitos, varias partes o alternativas", () => {
    for (const pregunta of [
      "¿Cómo se solicita una ampliación de plazo durante la ejecución del contrato?",
      "¿Cuáles son los requisitos para una compra por comparación de precios?",
      "¿Qué porcentaje debe tener la garantía de fiel cumplimiento y cuándo puede reducirse en obras?",
      "¿Qué es la conformidad? ¿Quién la otorga?",
      "¿Qué documento corresponde? a) la constancia b) el acta",
    ]) expect(answerSourceLimit(pregunta), pregunta).toBe(12);
  });
});

describe("partes de una pregunta compuesta", () => {
  it("parte la coordinación «y cuándo…» y le añade el tema de la primera parte", () => {
    const partes = questionParts("¿Qué porcentaje del monto del contrato debe tener la garantía de fiel cumplimiento y cuándo puede reducirse en obras?");
    expect(partes).toHaveLength(2);
    expect(partes[0]).toBe("Qué porcentaje del monto del contrato debe tener la garantía de fiel cumplimiento");
    expect(partes[1]).toMatch(/^cuándo puede reducirse en obras /);
    expect(partes[1]).toMatch(/garantía/);
    expect(partes[1]).toMatch(/cumplimiento/);
  });

  it("las preguntas escritas por separado llegan ya partidas", () => {
    expect(questionParts("¿Qué es la conformidad de la prestación? ¿Quién la otorga en una obra?")).toEqual([
      "Qué es la conformidad de la prestación?", "Quién la otorga en una obra?",
    ]);
  });

  it("no parte una pregunta simple, una enumeración ni una de alternativas", () => {
    for (const pregunta of [
      "¿Qué garantía se exige para recibir un adelanto de pago?",
      "¿Qué plazos y condiciones tiene la garantía de adelanto?",
      "¿Qué documento corresponde? a) la constancia b) el acta",
    ]) expect(questionParts(pregunta), pregunta).toEqual([]);
  });
});

describe("segunda vuelta: qué parte quedó sin fuente", () => {
  const partes = ["Qué porcentaje debe tener la garantía de fiel cumplimiento", "cuándo puede reducirse en obras garantía fiel cumplimiento"];

  it("el tema compartido no basta: hace falta que alguna fuente hable de lo propio de la parte", () => {
    const soloTema = ["La garantía de fiel cumplimiento equivale al diez por ciento del monto del contrato original."];
    expect(uncoveredParts(partes, soloTema)).toEqual([partes[1]]);
    const conReduccion = [...soloTema, "En obras, la garantía de fiel cumplimiento puede reducirse a partir de la recepción de la obra."];
    expect(uncoveredParts(partes, conReduccion)).toEqual([]);
  });

  it("sin partes, o con una sola, no hay segunda vuelta", () => {
    expect(uncoveredParts([], ["x"])).toEqual([]);
    expect(uncoveredParts([partes[0]], [])).toEqual([]);
  });

  it("elige la fuente que más cubre la parte; con empate, la primera del ranking", () => {
    const a = { excerpt: "La garantía de fiel cumplimiento se presenta al firmar." };
    const b = { excerpt: "En obras la garantía puede reducirse desde la recepción." };
    expect(bestCoveringSource([a, b], partes[1])).toBe(b);
    expect(bestCoveringSource([a, { ...a }], partes[1])).toBe(a);
    expect(bestCoveringSource([], partes[1])).toBeUndefined();
  });
});

// Texto ficticio: aquí no se codifica ninguna regla de contratación pública.
describe("ventana del artículo completo (caso real: la fórmula en un fragmento y la tabla de valores en el siguiente)", () => {
  const consulta = "¿Qué valores toma el factor sintético en la fórmula de la comisión?";
  const fragmento = { documentId: "doc-1", article: "7", excerpt: "Artículo 7. La comisión sintética se calcula con la fórmula: comisión = importe / factor.", pageStart: 3, pageEnd: 3 };
  const articulo: ArticleRow = { document_id: "doc-1", article_number: "7", page_start: 3, page_end: 4,
    content: "Artículo 7. La comisión sintética se calcula con la fórmula: comisión = importe / factor. El factor sintético toma estos valores: para expedientes de prueba, factor = 0.40; para expedientes ordinarios, factor = 0.25." };

  it("si el artículo cubre más de la pregunta, la ventana sale del artículo y las páginas se ensanchan", () => {
    const [ampliada] = widenToArticles([fragmento], [articulo], consulta);
    expect(ampliada.excerpt).toContain("factor = 0.25");
    expect(ampliada).toMatchObject({ pageStart: 3, pageEnd: 4, widenedToArticle: true });
  });

  it("no crece por encima del extracto de siempre", () => {
    const largo = { ...articulo, content: `${articulo.content} ${"Texto sintético de relleno sin relación. ".repeat(80)}` };
    const [ampliada] = widenToArticles([fragmento], [largo], consulta);
    expect(ampliada.excerpt.length).toBeLessThanOrEqual(EXCERPT_LIMIT);
  });

  it("si no cubre más, queda el extracto del fragmento", () => {
    const igual = { ...articulo, content: fragmento.excerpt };
    expect(widenToArticles([fragmento], [igual], consulta)[0]).toBe(fragmento);
  });

  it("no toca un artículo con dos filas para el mismo número (dos cuerpos) ni una fuente sin artículo", () => {
    expect(widenToArticles([fragmento], [articulo, { ...articulo, content: "Otro cuerpo, artículo 7." }], consulta)[0]).toBe(fragmento);
    const sinArticulo = { ...fragmento, article: null };
    expect(widenToArticles([sinArticulo], [articulo], consulta)[0]).toBe(sinArticulo);
  });

  it("dos fragmentos del mismo artículo con la misma ventana dejan una sola fuente", () => {
    const otraMitad = { ...fragmento, excerpt: "factor = 0.40; para expedientes ordinarios", pageStart: 4, pageEnd: 4 };
    const resultado = widenToArticles([fragmento, otraMitad, { ...fragmento, documentId: "doc-2" }], [articulo], consulta);
    expect(resultado).toHaveLength(2);
    expect(resultado[1].documentId).toBe("doc-2");
  });

  it("ignora filas incompletas de la base de datos en vez de romper la respuesta", () => {
    const filas = [{ id: "x" }, { ...articulo, article_number: null }, { ...articulo, content: undefined }] as unknown as ArticleRow[];
    expect(widenToArticles([fragmento], filas, consulta)[0]).toBe(fragmento);
  });

  it("limpia el texto del artículo con la función que se le pase (marcas de página)", () => {
    const [ampliada] = widenToArticles([fragmento], [{ ...articulo, content: `[[pagina 4]] ${articulo.content}` }], consulta, (texto) => texto.replace(/\[\[pagina \d+\]\]\s*/g, ""));
    expect(ampliada.excerpt).not.toContain("[[pagina");
  });
});
