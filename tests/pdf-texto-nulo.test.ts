import { describe, expect, it } from "vitest";
import { segmentArticlesFromPages } from "../lib/pdf-processing";

describe("caracteres nulos en el texto extraído de un PDF", () => {
  // Caso real: 4 de 100 pronunciamientos del OECE cayeron al indexarse con
  // «\u0000 cannot be converted to text» (Postgres no admite el nulo en text ni en jsonb).
  const paginas = [
    { pageNumber: 1, text: "Artículo 1. Objeto.\u0000 Esta norma regula\u0000 las contrataciones públicas del Estado." },
    { pageNumber: 2, text: "Artículo 2. Ámbito. Se aplica a las entidades\u0000 y a sus proveedores en todo el país." },
    { pageNumber: 3, text: "Artículo 3. Principios. Rigen la libertad de concurrencia y la transparencia.\u0000" },
  ];

  it("ningún fragmento segmentado conserva el carácter nulo", () => {
    const segmentos = segmentArticlesFromPages(paginas);
    expect(segmentos.length).toBeGreaterThanOrEqual(3);
    for (const segmento of segmentos) {
      expect(segmento.content, segmento.articleNumber).not.toContain("\u0000");
      expect(segmento.title, segmento.articleNumber).not.toContain("\u0000");
    }
  });

  it("el texto útil se conserva y queda unido sin huecos raros", () => {
    const [primero] = segmentArticlesFromPages(paginas);
    expect(primero.content).toContain("Esta norma regula las contrataciones públicas");
  });
});
