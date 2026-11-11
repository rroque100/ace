import { describe, expect, it } from "vitest";
import { baseArticle, frameAsRelatedSources, missingArticleNotice, missingRequestedArticles, requestedArticles } from "@/lib/chat-article-check";

const fuente = (article: string | null) => ({ article });

describe("artículo pedido por su número", () => {
  it("lo reconoce en las formas habituales, sin partir los numerales", () => {
    expect(requestedArticles("¿Qué dice el artículo 9999 de la Ley 32069?")).toEqual(["9999"]);
    expect(requestedArticles("Explica el Artículo 113.1 del Reglamento")).toEqual(["113"]);
    expect(requestedArticles("según el art. 61 y el artículo N.° 120")).toEqual(["61", "120"]);
    expect(requestedArticles("artículo 61-A de la ley")).toEqual(["61a"]);
    expect(requestedArticles("el artículo 5 y otra vez el artículo 5")).toEqual(["5"]);
  });
  it("no inventa artículos: sin número no hay petición", () => {
    for (const pregunta of ["¿Qué es un artículo?", "artículos de la ley", "¿Qué garantía se exige?", "la ley 32069 de 2025"]) expect(requestedArticles(pregunta), pregunta).toEqual([]);
  });
  it("«113.1», «113» y «0113» son el mismo artículo; «61-A» y «61a», también", () => {
    expect(baseArticle("113.1")).toBe("113");
    expect(baseArticle("0113")).toBe("113");
    expect(baseArticle("61-A")).toBe("61a");
    expect(baseArticle("61a")).toBe("61a");
    expect(baseArticle("DCT-4")).toBe("");
    expect(baseArticle(null)).toBe("");
  });
});

describe("artículo pedido que no se recuperó (caso real: «artículo 9999» recibía la respuesta del artículo 99)", () => {
  it("avisa cuando ninguna fuente es el artículo pedido", () => {
    const fuentes = [fuente("99"), fuente("94"), fuente("99")];
    const faltan = missingRequestedArticles("¿Qué dice el artículo 9999 de la Ley 32069?", fuentes);
    expect(faltan).toEqual(["9999"]);
    const aviso = missingArticleNotice(faltan)!;
    expect(aviso).toContain("No se recuperó el artículo 9999");
    expect(aviso).toContain("no a lo que pediste");
    // No afirma que no exista: solo que no se recuperó.
    expect(aviso).not.toMatch(/no existe/i);
  });
  it("no avisa cuando el artículo pedido está entre las fuentes, aunque sea con numeral", () => {
    expect(missingRequestedArticles("¿Qué dice el artículo 120 del reglamento?", [fuente("120"), fuente("61")])).toEqual([]);
    expect(missingRequestedArticles("Explica el artículo 113.1", [fuente("113.1")])).toEqual([]);
    expect(missingRequestedArticles("Explica el artículo 113.1", [fuente("113")])).toEqual([]);
  });
  it("con varios artículos, avisa solo de los que faltan", () => {
    expect(missingRequestedArticles("compara el artículo 61 y el artículo 9999", [fuente("61")])).toEqual(["9999"]);
    expect(missingArticleNotice(["9999", "8888"])).toContain("No se recuperaron los artículos 9999 y 8888");
    expect(missingArticleNotice(["9999", "8888", "61a"])).toContain("los artículos 9999, 8888 y 61A");
  });
  it("no avisa cuando no hay fuentes (ya hay otro aviso) ni cuando la pregunta nombra un documento concreto", () => {
    expect(missingRequestedArticles("artículo 9999", [])).toEqual([]);
    expect(missingRequestedArticles("la Opinión 007-2024 cita el artículo 5, ¿qué dice?", [fuente(null)])).toEqual([]);
  });
  it("una pregunta sin artículo nunca genera aviso", () => {
    expect(missingRequestedArticles("¿Qué garantía se exige?", [fuente("61")])).toEqual([]);
    expect(missingArticleNotice([])).toBeNull();
  });
});

describe("encabezado cuando lo pedido no se recuperó (caso real: «¿Qué dice el Decreto Supremo 999-2099-EF?»)", () => {
  const publicada = "**Respuesta documental**\nSegún «Reglamento de la Ley N.° 32069 — texto actualizado al 09.01.2026»:\n\nEl Decreto Supremo N.° 009-2025-EF aprueba el Reglamento [F5]";

  it("«Según «X»:» pasa a decir que es lo que consta en las fuentes recuperadas", () => {
    const reencuadrada = frameAsRelatedSources(publicada);
    expect(reencuadrada.startsWith("**Respuesta documental**\nLo que consta en las fuentes recuperadas, según «Reglamento")).toBe(true);
    expect(reencuadrada).toContain("El Decreto Supremo N.° 009-2025-EF aprueba el Reglamento [F5]");
  });

  it("también con «parcial» y con la lectura literal", () => {
    expect(frameAsRelatedSources(publicada.replace("documental**", "documental parcial**"))).toContain("parcial**\nLo que consta en las fuentes recuperadas, según");
    expect(frameAsRelatedSources("**Lectura del documento**\nSegún Reglamento · artículo 3:\n\n> texto [F1]")).toContain("**Lectura del documento**\nLo que consta en las fuentes recuperadas, según Reglamento");
  });

  it("no toca un «Según» que no sea el encabezado de la respuesta", () => {
    const otro = "Texto previo.\nSegún el artículo 3, la norma aplica. [F1]";
    expect(frameAsRelatedSources(otro)).toBe(otro);
  });
});
