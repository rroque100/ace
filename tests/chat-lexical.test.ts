import { describe, expect, it } from "vitest";
import {
  accentTolerantPattern,
  dedupeArticleCopies,
  fillWithDocumentCap,
  lexicalFilter,
  lexicalPlan,
  pickKeyTokens,
} from "../lib/chat-lexical";

describe("palabras clave de la consulta", () => {
  it("la garantía de fiel cumplimiento (caso real): elige lo específico y no lo genérico", () => {
    const tokens = ["porcentaje", "monto", "contrato", "original", "debe", "tener", "garantia", "fiel", "cumplimiento"];
    const claves = pickKeyTokens(tokens);
    expect(claves).toEqual(["cumplimiento", "porcentaje", "garantia"]);
    for (const generica of ["monto", "contrato", "original", "debe", "tener"]) {
      expect(claves).not.toContain(generica);
    }
  });

  it("respeta el máximo, no repite y conserva el orden ante empates de longitud", () => {
    expect(pickKeyTokens(["retencion", "retencion", "pago", "bienes"], 2)).toEqual(["retencion", "bienes"]);
    expect(pickKeyTokens(["abcd", "efgh", "ijkl"], 2)).toEqual(["abcd", "efgh"]);
  });

  it("si todo es genérico devuelve vacío (y el llamador cae al respaldo OR)", () => {
    expect(pickKeyTokens(["contrato", "monto", "entidad", "debe"])).toEqual([]);
  });
});

describe("patrón tolerante a tildes", () => {
  it("las palabras largas llevan comodín en las vocales y así casan con la tilde", () => {
    const patron = accentTolerantPattern("garantia");
    expect(patron).toBe("g_r_nt__");
    // Equivalente de ilike: `_` = un carácter cualquiera.
    const regex = new RegExp(`^${patron.replaceAll("_", ".")}$`, "i");
    expect(regex.test("garantía")).toBe(true);
    expect(regex.test("GARANTIA")).toBe(true);
  });

  it("las cortas se dejan exactas: «fiel» no puede pasar a ser cualquier palabra de 4 letras", () => {
    expect(accentTolerantPattern("fiel")).toBe("fiel");
    expect(accentTolerantPattern("pago")).toBe("pago");
  });

  it("no deja pasar comodines ni separadores que rompan el filtro de PostgREST", () => {
    const patron = accentTolerantPattern("a*b,c_d\\e");
    for (const prohibido of ["*", ",", "\\"]) expect(patron).not.toContain(prohibido);
  });
});

describe("filtro PostgREST", () => {
  it("AND exige todas las palabras y OR basta con una; va codificado", () => {
    const and = decodeURIComponent(lexicalFilter(["garantia", "fiel"], "and"));
    expect(and).toBe("and=(content.ilike.*g_r_nt__*,content.ilike.*fiel*)");
    expect(decodeURIComponent(lexicalFilter(["garantia", "fiel"], "or")).startsWith("or=(")).toBe(true);
    expect(lexicalFilter(["garantia"], "and")).not.toContain(",");
  });
});

describe("relleno con tope por documento", () => {
  const f = (documentId: string, n: number) => ({ documentId, chunkId: `${documentId}-${n}` });

  it("una norma extensa ya no ocupa casi todas las plazas (caso real: 7 de 8 eran de la LPAG)", () => {
    const lpag = [1, 2, 3, 4, 5, 6, 7].map((n) => f("lpag", n));
    const reglamento = [f("reg", 1), f("reg", 2)];
    const out = fillWithDocumentCap([f("ley", 1)], [...lpag, ...reglamento], 8);
    const porDoc = out.reduce<Record<string, number>>((m, x) => ({ ...m, [x.documentId]: (m[x.documentId] ?? 0) + 1 }), {});
    expect(out).toHaveLength(8);
    expect(porDoc.lpag).toBe(5);
    expect(porDoc.reg).toBe(2);
  });

  it("es un tope blando: si no hay otros documentos, rellena igualmente", () => {
    const solo = [1, 2, 3, 4, 5, 6].map((n) => f("lpag", n));
    expect(fillWithDocumentCap([], solo, 6)).toHaveLength(6);
  });

  it("conserva la selección jerárquica intacta y no repite fragmentos", () => {
    const seleccion = [f("ley", 1), f("ley", 2), f("ley", 3)];
    const out = fillWithDocumentCap(seleccion, [f("ley", 2), f("reg", 1), f("ley", 4)], 5);
    expect(out.slice(0, 3)).toEqual(seleccion);
    expect(new Set(out.map((x) => x.chunkId)).size).toBe(out.length);
  });

  it("no pasa del límite", () => {
    const muchos = Array.from({ length: 20 }, (_, n) => f(`d${n}`, 1));
    expect(fillWithDocumentCap([], muchos, 8)).toHaveLength(8);
  });
});

describe("plan léxico por niveles", () => {
  it("elige las claves sobre TODA la consulta, no sobre las 8 primeras palabras (caso real: «cumplimiento»)", () => {
    const tokens = ["porcentaje", "monto", "contrato", "original", "debe", "tener", "garantia", "fiel", "cumplimiento"];
    const [primero] = lexicalPlan(tokens);
    expect(primero).toEqual({ mode: "and", tokens: ["cumplimiento", "porcentaje", "garantia"] });
  });

  it("va de AND de 3 a AND de 2 y termina en OR de las específicas, sin las genéricas", () => {
    const plan = lexicalPlan(["porcentaje", "monto", "contrato", "garantia", "fiel", "cumplimiento"]);
    expect(plan.map((p) => p.mode)).toEqual(["and", "and", "or"]);
    expect(plan[1].tokens).toHaveLength(2);
    expect(plan[2].tokens).not.toContain("monto");
    expect(plan[2].tokens).not.toContain("contrato");
  });

  it("con una sola palabra específica cae directo al OR; sin ninguna usa las primeras 8", () => {
    expect(lexicalPlan(["retencion", "monto", "debe"])).toEqual([{ mode: "or", tokens: ["retencion"] }]);
    const solo = lexicalPlan(["monto", "contrato", "debe"]);
    expect(solo).toEqual([{ mode: "or", tokens: ["monto", "contrato", "debe"] }]);
  });
});

describe("copias del mismo artículo", () => {
  const f = (documentId: string, article: string | null, documentNumber: string | null = "009-2025-EF") => ({
    documentType: "reglamento", documentNumber, article, documentId,
  });

  it("el art. 97 de las dos copias del Reglamento cuenta una vez, y el art. 68 recupera su plaza", () => {
    const out = dedupeArticleCopies([f("copiaA", "97"), f("copiaB", "97"), f("copiaA", "68"), f("copiaB", "68")]);
    expect(out.map((x) => `${x.documentId}:${x.article}`)).toEqual(["copiaA:97", "copiaA:68"]);
  });

  it("varios fragmentos del mismo documento y artículo se conservan (es texto troceado)", () => {
    expect(dedupeArticleCopies([f("copiaA", "97"), f("copiaA", "97")])).toHaveLength(2);
  });

  it("sin artículo o sin número de norma no se deduplica nada", () => {
    expect(dedupeArticleCopies([f("a", null), f("b", null), f("a", "5", null), f("b", "5", null)])).toHaveLength(4);
  });

  it("no mezcla tipos ni normas distintas con el mismo número de artículo", () => {
    const ley = { documentType: "ley", documentNumber: "32069", article: "97", documentId: "L" };
    expect(dedupeArticleCopies([f("A", "97"), ley, { ...f("Z", "97"), documentNumber: "otra" }])).toHaveLength(3);
  });
});
