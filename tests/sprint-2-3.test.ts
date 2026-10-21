import { describe, expect, it } from "vitest";
import { parsearMarcas } from "@/app/components/expedientes-archivo/respuesta/cuerpo-con-marcas";

describe("parsearMarcas (Sprint 3 — marcar normativa citada)", () => {
  it("no detecta marcas si no hay [E#]", () => {
    const result = parsearMarcas("La solicitud procede conforme a la ley.");
    expect(result.marcadas).toBe(0);
    expect(result.partes.every((p) => p.type === "text")).toBe(true);
  });

  it("detecta una marca [E1]", () => {
    const result = parsearMarcas("El plazo es de 5 dias [E1].");
    expect(result.marcadas).toBe(1);
    expect(result.partes.some((p) => p.type === "mark" && p.index === 1)).toBe(true);
  });

  it("detecta multiples marcas [E1], [E2], [E3]", () => {
    const result = parsearMarcas(
      "La ley establece [E1] que el plazo es de 5 dias [E2] y se computa [E3] desde la notificacion.",
    );
    expect(result.marcadas).toBe(3);
    const indices = result.partes
      .filter((p) => p.type === "mark")
      .map((p) => p.index)
      .sort();
    expect(indices).toEqual([1, 2, 3]);
  });

  it("preserva el texto entre marcas", () => {
    const body = "Inicio [E1] medio [E2] final";
    const result = parsearMarcas(body);
    const textOnly = result.partes
      .filter((p) => p.type === "text")
      .map((p) => p.content)
      .join("");
    expect(textOnly).toBe("Inicio  medio  final");
  });

  it("ignora numeros invalidos en la marca", () => {
    const result = parsearMarcas("texto [Enull] mas texto [E1]");
    expect(result.marcadas).toBe(1);
  });

  it("maneja cuerpo vacio", () => {
    const result = parsearMarcas("");
    expect(result.marcadas).toBe(0);
    expect(result.partes).toEqual([]);
  });

  it("detecta la misma marca repetida como varias", () => {
    const result = parsearMarcas("[E1] y otra vez [E1] y otra mas [E1].");
    expect(result.marcadas).toBe(3);
  });

  it("respeta mayusculas y minusculas en la marca", () => {
    // El regex es case-sensitive por defecto: [e1] no se detecta
    const result = parsearMarcas("[E1] vs [e1]");
    expect(result.marcadas).toBe(1);
  });
});

describe("makeExcerpt (busqueda semantica en respuestas)", () => {
  // Replicamos la logica del endpoint /api/respuesta/search
  function makeExcerpt(text: string, query: string): string {
    if (!text) return "";
    const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length >= 3);
    const lower = text.toLowerCase();
    let bestIndex = -1;
    for (const term of terms) {
      const idx = lower.indexOf(term);
      if (idx !== -1 && (bestIndex === -1 || idx < bestIndex)) {
        bestIndex = idx;
      }
    }
    if (bestIndex === -1) {
      return text.slice(0, 200);
    }
    const start = Math.max(0, bestIndex - 60);
    const end = Math.min(text.length, start + 200);
    return (start > 0 ? "..." : "") + text.slice(start, end) + (end < text.length ? "..." : "");
  }

  it("devuelve excerpt alrededor de la primera coincidencia", () => {
    const text = "Inicio del documento. La solicitud procede conforme a la ley X. Mas texto.";
    const excerpt = makeExcerpt(text, "procede");
    expect(excerpt).toContain("procede");
    expect(excerpt.length).toBeLessThanOrEqual(206);
  });

  it("devuelve los primeros 200 chars si no hay coincidencia", () => {
    const text = "a".repeat(500);
    const excerpt = makeExcerpt(text, "palabra_inexistente");
    expect(excerpt.length).toBe(200);
  });

  it("ignora terminos de busqueda < 3 chars", () => {
    const text = "ab";
    const excerpt = makeExcerpt(text, "a b");
    // Como "a" y "b" son <3 chars, no hay match. Devuelve primeros 200.
    expect(excerpt.length).toBe(2);
  });
});
