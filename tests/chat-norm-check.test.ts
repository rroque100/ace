import { describe, expect, it } from "vitest";
import { missingNormNotice, missingRequestedNorms, requestedNorms } from "@/lib/chat-article-check";

const fuente = (documentTitle: string, documentNumber: string | null = null, excerpt = "") => ({ documentTitle, documentNumber, excerpt });
const REGLAMENTO = fuente("Reglamento de la Ley N.° 32069 — texto actualizado al 09.01.2026", "009-2025-EF", "El Decreto Supremo N.° 009-2025-EF consta de trece títulos");
const LEY_32069 = fuente("Ley N.° 32069 — texto actualizado al 19.07.2026", "32069", "La Ley N.° 32069, Ley General de Contrataciones Públicas");
const LEY_30225 = fuente("Ley N.° 30225", "30225", "Ley de Contrataciones del Estado");
const DS_344 = fuente("Decreto Supremo N.° 344-2018-EF — Reglamento de la Ley N.° 30225", "344-2018-EF");

describe("norma pedida por su número", () => {
  it("la reconoce en las formas habituales de citarla", () => {
    expect(requestedNorms("¿Qué dice el Decreto Supremo 999-2099-EF?").map((n) => n.label)).toEqual(["Decreto Supremo N.° 999-2099-EF"]);
    expect(requestedNorms("según el D.S. N.° 009-2025-EF").map((n) => n.label)).toEqual(["Decreto Supremo N.° 009-2025-EF"]);
    expect(requestedNorms("el D.Leg. 1444 y la Ley N.° 30225").map((n) => n.label)).toEqual(["Decreto Legislativo N.° 1444", "Ley N.° 30225"]);
    expect(requestedNorms("¿Qué establece la Ley 99999 sobre contrataciones?").map((n) => n.label)).toEqual(["Ley N.° 99999"]);
  });
  it("no inventa normas: sin número no hay petición", () => {
    for (const pregunta of ["¿Qué ley regula las contrataciones?", "la ley anterior y la nueva ley", "decreto supremo sobre garantías", "¿Qué garantía se exige?", "artículo 120 del reglamento"]) {
      expect(requestedNorms(pregunta), pregunta).toEqual([]);
    }
  });
});

describe("norma pedida que ninguna fuente lleva (caso real: «Decreto Supremo 999-2099-EF» recibía la respuesta del 009-2025-EF)", () => {
  it("avisa cuando ninguna fuente lleva el número", () => {
    const faltan = missingRequestedNorms("¿Qué dice el Decreto Supremo 999-2099-EF?", [LEY_32069, REGLAMENTO]);
    expect(faltan).toEqual(["Decreto Supremo N.° 999-2099-EF"]);
    const aviso = missingNormNotice(faltan)!;
    expect(aviso).toContain("No se recuperó la norma «Decreto Supremo N.° 999-2099-EF»");
    expect(aviso).toContain("no a lo que pediste");
    expect(aviso).not.toMatch(/no existe/i);
    expect(missingRequestedNorms("¿Qué establece la Ley 99999?", [LEY_32069, LEY_30225])).toEqual(["Ley N.° 99999"]);
  });

  it("no avisa cuando la norma pedida sí está, aunque venga en el número, en el título o solo en el fragmento", () => {
    expect(missingRequestedNorms("¿Qué dice el D.S. 009-2025-EF?", [REGLAMENTO])).toEqual([]);
    expect(missingRequestedNorms("¿Qué dice el D.S. 344-2018-EF sobre penalidades?", [DS_344])).toEqual([]);
    expect(missingRequestedNorms("¿Qué dice la Ley 32069?", [LEY_32069])).toEqual([]);
    expect(missingRequestedNorms("¿Qué dice el Decreto Supremo 009-2025-EF?", [fuente("Reglamento de la Ley 32069", null, "El D.S. N.° 009-2025-EF aprueba el Reglamento")])).toEqual([]);
    // Con ceros a la izquierda o sin ellos es el mismo decreto.
    expect(missingRequestedNorms("¿Qué dice el D.S. 9-2025-EF?", [REGLAMENTO])).toEqual([]);
  });

  it("no confunde un número que es parte de otro (la Ley 3225 no es la 30225, ni 32069 la 2069)", () => {
    expect(missingRequestedNorms("¿Qué dice la Ley 3225?", [LEY_30225])).toEqual(["Ley N.° 3225"]);
    expect(missingRequestedNorms("¿Qué dice la Ley 2069?", [LEY_32069])).toEqual(["Ley N.° 2069"]);
    expect(missingRequestedNorms("¿Qué dice el D.S. 44-2018-EF?", [DS_344])).toEqual(["Decreto Supremo N.° 044-2018-EF"]);
  });

  it("con varias, avisa solo de las que faltan; sin fuentes o sin norma pedida no avisa", () => {
    expect(missingRequestedNorms("compara la Ley 30225 y la Ley 99999", [LEY_30225])).toEqual(["Ley N.° 99999"]);
    expect(missingRequestedNorms("¿Qué dice el Decreto Supremo 999-2099-EF?", [])).toEqual([]);
    expect(missingRequestedNorms("¿Qué garantía se exige?", [LEY_32069])).toEqual([]);
    expect(missingNormNotice([])).toBeNull();
    expect(missingNormNotice(["Ley N.° 99999", "Decreto Legislativo N.° 9999"])).toContain("No se recuperaron las normas «Ley N.° 99999», «Decreto Legislativo N.° 9999»");
  });
});
