import { describe, expect, it } from "vitest";
import { markdownAHtmlSeguro } from "@/lib/markdown-seguro";

describe("markdownAHtmlSeguro", () => {
  it("convierte una tabla Markdown en una <table> real", () => {
    const html = markdownAHtmlSeguro("| Categoría | Riesgo |\n|---|---|\n| Técnico | Deficiencias |");
    expect(html).toContain("<table");
    expect(html).toContain("<td>Técnico</td>");
    expect(html).toContain("<td>Deficiencias</td>");
  });

  it("elimina un <script> inyectado", () => {
    const html = markdownAHtmlSeguro("Hola <script>alert(1)</script> mundo");
    expect(html).not.toContain("<script");
    expect(html).toContain("Hola");
  });

  it("elimina manejadores de eventos (onerror) y URLs javascript:", () => {
    const html = markdownAHtmlSeguro('<img src="x" onerror="alert(1)"> [click](javascript:alert(1))');
    expect(html).not.toContain("onerror");
    expect(html.toLowerCase()).not.toContain("javascript:");
  });

  it("conserva el formato benigno (negrita, viñetas)", () => {
    const html = markdownAHtmlSeguro("**fuerte**\n\n- uno\n- dos");
    expect(html).toContain("<strong>fuerte</strong>");
    expect(html).toContain("<li>uno</li>");
  });
});
