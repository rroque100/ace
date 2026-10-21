import { describe, expect, it } from "vitest";
import { checkCitationFaithfulness } from "@/lib/citation-faithfulness";

describe("checkCitationFaithfulness", () => {
  it("acepta cuando el dato citado SI aparece en el fragmento", () => {
    const answer = "El procedimiento aplica hasta 8 UIT [F1].";
    const sources = [{ excerpt: "Es aplicable para montos por debajo de las 8 UIT." }];
    const r = checkCitationFaithfulness(answer, sources);
    expect(r.ok).toBe(true);
    expect(r.issues).toHaveLength(0);
  });

  it("detecta dato NO sustentado por el fragmento citado (misatribucion)", () => {
    // Reproduce el caso real: "8 UIT [F1]" pero F1 trata de otro tema.
    const answer = "El monto maximo para comparacion de precios es 8 UIT [F1].";
    const sources = [{ excerpt: "Tabla de sanciones: multas de 1 a 3 UIT por infraccion." }];
    const r = checkCitationFaithfulness(answer, sources);
    expect(r.ok).toBe(false);
    expect(r.issues[0].datum.toLowerCase()).toContain("8 uit");
  });

  it("busca el dato en CUALQUIERA de los fragmentos citados", () => {
    const answer = "El tope es 8 UIT [F1], [F2].";
    const sources = [
      { excerpt: "Fragmento sin la cifra." },
      { excerpt: "El limite es de 8 UIT para este supuesto." },
    ];
    expect(checkCitationFaithfulness(answer, sources).ok).toBe(true);
  });

  it("NO marca numeros de norma (son identidad del documento, no del fragmento)", () => {
    // El numero de la norma viene del titulo/metadata (contexto), no del texto del
    // chunk; citar "Ley 32069" no debe marcarse infiel aunque el excerpt no lo traiga.
    // (Citar una norma derogada lo cubre el chequeo de grounding aparte.)
    const r = checkCitationFaithfulness("Regulado por la Ley 32069 [F1].", [
      { excerpt: "Articulo 4. Definiciones del procedimiento de seleccion." },
    ]);
    expect(r.checked).toBe(0);
    expect(r.ok).toBe(true);
  });

  it("no marca afirmaciones sin datos especificos", () => {
    const answer = "La comparacion de precios es un procedimiento competitivo [F1].";
    const sources = [{ excerpt: "Comparacion de precios: procedimiento de seleccion competitivo." }];
    const r = checkCitationFaithfulness(answer, sources);
    expect(r.checked).toBe(0);
    expect(r.ok).toBe(true);
  });

  it("ignora datos en texto sin cita", () => {
    const r = checkCitationFaithfulness("Hay un tope de 8 UIT en general.", [{ excerpt: "x" }]);
    expect(r.checked).toBe(0);
  });

  it("acepta otra letra de marcador (expedientes-archivo cita con [E#], no [F#])", () => {
    const answer = "Se pagó el 8% de adelanto [E1].";
    const sources = [{ excerpt: "Se otorgó un adelanto del 8% del monto contractual." }];
    const r = checkCitationFaithfulness(answer, sources, "E");
    expect(r.ok).toBe(true);
    expect(r.checked).toBe(1);
  });

  it("con otra letra de marcador, tambien detecta la misatribucion", () => {
    const answer = "El adelanto fue del 8% [E1].";
    const sources = [{ excerpt: "El expediente no menciona ningún porcentaje de adelanto." }];
    const r = checkCitationFaithfulness(answer, sources, "E");
    expect(r.ok).toBe(false);
    expect(r.issues[0].reason).toContain("E1");
  });
});
