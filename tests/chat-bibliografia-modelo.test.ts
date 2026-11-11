import { describe, expect, it } from "vitest";
import { stripModelSourceList, tidyModelPunctuation } from "@/lib/chat-answer-layout";
import { auditEvidence } from "@/lib/chat-evidence-audit";
import { publishEvidence } from "@/lib/chat-evidence-publication";

// Texto ficticio: aquí no se codifica ninguna regla de contratación pública.
const primera = "La comisión sintética se calcula sobre el importe original de prueba.";
const segunda = "La comisión sintética puede reducirse cuando el expediente de prueba se cierra.";
const cuerpo = `${primera} [F1]\n${segunda} [F1]`;

// Lo que escribió el modelo en producción (2 de 14 corridas), con los nombres cambiados.
const bibliografia = [
  "**Fuentes Citadas:**",
  "* [F1]",
  "Ley general de contrataciones publicas (N.° 32069), Artículo 61, páginas 18-19.",
  "* [F2]",
  "Reglamento de la ley general de contrataciones publicas 32069 (N.° 009-2025-EF), Artículo 183, páginas 43-44.",
].join("\n");

describe("bibliografía que añade el modelo", () => {
  it("se quita entera, y el cuerpo queda intacto", () => {
    expect(stripModelSourceList(`${cuerpo}\n\n${bibliografia}`)).toBe(cuerpo);
  });

  it("reconoce las variantes del título", () => {
    for (const titulo of ["Fuentes:", "**Fuentes consultadas**", "## Referencias", "Referencias normativas:", "**Bibliografía**", "Documentos citados:"]) {
      expect(stripModelSourceList(`${cuerpo}\n${titulo}\n- [F1]\n- [F2]`), titulo).toBe(cuerpo);
    }
  });

  it("no toca nada si tras el título hay prosa: entonces es contenido, no una lista", () => {
    const conProsa = `${cuerpo}\n**Fuentes**\nLa comisión sintética se regula en el documento de prueba. Además, se aplica a todos los expedientes. [F1]`;
    expect(stripModelSourceList(conProsa)).toBe(conProsa);
  });

  it("no toca nada si no hay título de fuentes, ni si el título está vacío al final", () => {
    expect(stripModelSourceList(cuerpo)).toBe(cuerpo);
    expect(stripModelSourceList(`${cuerpo}\n**Fuentes:**`)).toBe(`${cuerpo}\n**Fuentes:**`);
  });

  it("una sección «Fuentes» en medio de la respuesta, con contenido después, se respeta", () => {
    const enMedio = `**Fuentes**\n* [F1]\n${primera} [F1]`;
    expect(stripModelSourceList(enMedio)).toBe(enMedio);
  });

  it("caso real: con la bibliografía, la respuesta completa ya no sale «parcial» ni cuenta 10 omisiones", async () => {
    const fuentes = [{ documentTitle: "Documento de prueba", article: "X", pageStart: 2, pageEnd: 2, excerpt: `${primera} ${segunda}` }];
    const pregunta = "¿Sobre qué importe se calcula la comisión sintética?";
    const borrador = stripModelSourceList(`${cuerpo}\n\n${bibliografia}`);
    const aprobada = (id: number, texto: string) => ({ id, status: "supported", reason: "Coincide", evidence: [{ source: 1, quote: texto }] });
    const revision = await auditEvidence(borrador, fuentes, undefined, async () => JSON.stringify({ claims: [aprobada(1, primera), aprobada(2, segunda)] }));
    const publicada = publishEvidence(borrador, fuentes, revision, pregunta);
    expect(revision.presentation).toBe("verified");
    expect(revision.omittedCount).toBe(0);
    expect(publicada).not.toContain("Fuentes Citadas");
    expect(publicada).not.toContain("páginas 18-19");
  });
});

describe("puntuación suelta del modelo dentro de una cita (caso real: «(Artículo 113.1;)»)", () => {
  it("quita el punto y coma o la coma que quedan justo antes de cerrar el paréntesis", () => {
    expect(tidyModelPunctuation("equivalente al 10% del monto (Artículo 113.1;) [F3]")).toBe("equivalente al 10% del monto (Artículo 113.1) [F3]");
    expect(tidyModelPunctuation("(Artículo 207.1, ) [F1]")).toBe("(Artículo 207.1) [F1]");
  });

  it("no toca cifras, referencias ni la puntuación fuera de un cierre de paréntesis", () => {
    const texto = "Plazo de 10 días (Art. 122.1; numeral a) [F2]; y el 5% (art. 183) [F1].";
    expect(tidyModelPunctuation(texto)).toBe(texto);
  });
});
