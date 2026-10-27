import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { stripPageMarkers, stripPageMarkersInExcerpts } from "../lib/page-markers";
import { readableSearchPreview } from "../lib/search-assistant";

describe("marcadores de página en los fragmentos", () => {
  it("caso real de producción: el marcador en mitad del pasaje desaparece y el texto queda unido", () => {
    const real =
      "… sustentado, 11 Documento obrante en el Toma Razón Electrónico del Tribunal. 12 Dicho decreto fue notificado " +
      "el 26 de mayo de 2025.\n\n=== PAGINA 6 ===\nPágina 6 de 29 Tribunal de Contrataciones Públicas Resolución Nº 03857-2025-TCP-S1";
    const out = stripPageMarkers(real);
    expect(out).not.toContain("===");
    expect(out).not.toMatch(/PAGINA\s+6/);
    // Lo que es contenido del documento (su propio encabezado de página) se conserva.
    expect(out).toContain("2025. Página 6 de 29 Tribunal de Contrataciones");
  });

  it("reconoce el marcador con y sin tilde, en cualquier número de página y varias veces", () => {
    for (const marcador of ["=== PAGINA 1 ===", "=== PÁGINA 12 ===", "==== pagina 103 ====", "===PAGINA 7==="]) {
      expect(stripPageMarkers(`antes ${marcador} después`), marcador).toBe("antes después");
    }
    expect(stripPageMarkers("a === PAGINA 1 === b === PÁGINA 2 === c")).toBe("a b c");
  });

  it("recortes por la mitad: marcador cortado al final o al principio del fragmento", () => {
    expect(stripPageMarkers("El plazo vence el 5 de mayo === PAGI")).toBe("El plazo vence el 5 de mayo");
    expect(stripPageMarkers("El plazo vence el 5 de mayo === PAGINA 6 =")).toBe("El plazo vence el 5 de mayo");
    expect(stripPageMarkers("INA 6 === y continúa el texto")).toBe("y continúa el texto");
    expect(stripPageMarkers("6 === y continúa el texto")).toBe("y continúa el texto");
  });

  it("no toca el texto legal, ni el signo igual suelto, ni los números", () => {
    const textos = [
      "Artículo 113. Garantía de fiel cumplimiento por una suma equivalente al 10% del monto del contrato.",
      "El valor X = 5 UIT y la fórmula P = 0,10 x M / (F x plazo)",
      "Página 6 de 29",
      "Se cumple a === b solo en notación de código",
      "Resolución N.° 03857-2025-TCP-S1 del 26 de mayo",
      "",
    ];
    for (const t of textos) expect(stripPageMarkers(t), t).toBe(t);
  });

  it("es idempotente", () => {
    const una = stripPageMarkers("x === PAGINA 3 === y");
    expect(stripPageMarkers(una)).toBe(una);
  });

  it("limpia solo los campos excerpt de una respuesta de formato desconocido", () => {
    const entrada = {
      title: "=== PAGINA 1 === no se toca porque no es un excerpt",
      matches: [{ chunkId: "a", excerpt: "uno === PAGINA 2 === dos", pageStart: 2 }],
      otros: { excerpt: "tres === PÁGINA 9 === cuatro" },
    };
    const salida = stripPageMarkersInExcerpts(entrada);
    expect(salida.matches[0].excerpt).toBe("uno dos");
    expect(salida.matches[0].pageStart).toBe(2);
    expect(salida.otros.excerpt).toBe("tres cuatro");
    expect(salida.title).toBe(entrada.title);
    expect(entrada.matches[0].excerpt).toContain("===");
    expect(stripPageMarkersInExcerpts(null)).toBeNull();
    expect(stripPageMarkersInExcerpts("texto")).toBe("texto");
  });

  it("la vista previa de la búsqueda (la que pinta la tarjeta) ya no muestra el marcador", () => {
    expect(readableSearchPreview("… apelación === PAGINA 6 ===\nPágina 6 de 29")).not.toContain("PAGINA");
  });
});

describe("el marcador sigue existiendo donde debe: el almacenamiento", () => {
  it("pdf-processing.ts sigue escribiéndolo (se limpia al mostrar, no al guardar)", () => {
    expect(readFileSync("lib/pdf-processing.ts", "utf8")).toContain("=== PAGINA ${page.pageNumber} ===");
  });
});
