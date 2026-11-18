import { describe, expect, it } from "vitest";
import { esQuiz, VIDEO_ESCENAS } from "@/lib/cursos/videos";
import { MAX_FRASE, frasesParaVoz, puntuarVoz, textoParaVoz, vocesEnEspanol, vozEsBasica } from "@/lib/cursos/voz";

const voz = (name: string, lang: string, localService = true) => ({ name, lang, localService });

/** Todo lo que el vídeo dice en voz alta: segmentos, preguntas y aclaraciones de todos los guiones. */
function textosHablados(): string[] {
  return Object.values(VIDEO_ESCENAS).flatMap((escenas) =>
    escenas.flatMap((e) => (esQuiz(e) ? [e.pregunta, e.aclaracion] : e.guion.map((s) => s.texto))),
  );
}

describe("elección de la voz", () => {
  it("prefiere la voz neuronal, luego la de Google, y deja las locales de Windows al final", () => {
    const voces = [
      voz("Microsoft Helena - Spanish (Spain)", "es-ES"),
      voz("Microsoft Sabina - Spanish (Mexico)", "es-MX"),
      voz("Google español de Estados Unidos", "es-US", false),
      voz("Microsoft Dalia Online (Natural) - Spanish (Mexico)", "es-MX", false),
      voz("Google UK English Female", "en-GB", false),
    ];
    expect(vocesEnEspanol(voces).map((v) => v.name)).toEqual([
      "Microsoft Dalia Online (Natural) - Spanish (Mexico)",
      "Google español de Estados Unidos",
      "Microsoft Sabina - Spanish (Mexico)",
      "Microsoft Helena - Spanish (Spain)",
    ]);
  });

  it("a igual motor, el acento peruano gana al latinoamericano y este al de España", () => {
    const pe = voz("Microsoft Camila Online (Natural) - Spanish (Peru)", "es-PE", false);
    const mx = voz("Microsoft Dalia Online (Natural) - Spanish (Mexico)", "es-MX", false);
    const es = voz("Microsoft Elvira Online (Natural) - Spanish (Spain)", "es-ES", false);
    expect(puntuarVoz(pe)).toBeGreaterThan(puntuarVoz(mx));
    expect(puntuarVoz(mx)).toBeGreaterThan(puntuarVoz(es));
  });

  it("avisa cuando solo hay voces básicas del sistema", () => {
    expect(vozEsBasica(voz("Microsoft Pablo - Spanish (Spain)", "es-ES"))).toBe(true);
    expect(vozEsBasica(null)).toBe(true);
    expect(vozEsBasica(voz("Google español", "es-ES", false))).toBe(false);
  });
});

describe("texto para la voz", () => {
  it("expande las citas y abreviaturas tal como se dicen", () => {
    expect(textoParaVoz("La conformidad la emite el área usuaria (Rgto., Art. 20). Ni la DEC ni el titular.")).toBe(
      "La conformidad la emite el área usuaria. Ni la DEC ni el titular.",
    );
    expect(textoParaVoz("Según el Rgto., Arts. 18 y 19, ≈3 de 72")).toBe(
      "Según el Reglamento, artículos 18 y 19, aproximadamente 3 de 72",
    );
    expect(textoParaVoz("Puede recibir TODAS las fases; la DEC no")).toBe("Puede recibir todas las fases; la DEC no");
    expect(textoParaVoz("hasta el 25 % del contrato")).toBe("hasta el 25 por ciento del contrato");
  });

  it("nada de lo que dicen los vídeos se lee como abreviatura, símbolo o palabra deletreada", () => {
    for (const t of textosHablados()) {
      const dicho = textoParaVoz(t);
      expect(dicho, t).not.toMatch(/Rgto|\bArts?\.|[≈%#«»()]/);
      expect(dicho, t).not.toMatch(/\b[A-ZÁÉÍÓÚÑ]{5,}\b/);
      expect(dicho.length, t).toBeGreaterThan(5);
    }
  });

  it("cada frase cabe en lo que Chrome dice sin cortarse, y entre todas dicen el texto entero", () => {
    for (const t of textosHablados()) {
      const dicho = textoParaVoz(t);
      const frases = frasesParaVoz(dicho);
      expect(frases.length, t).toBeGreaterThan(0);
      for (const f of frases) expect(f.length, f).toBeLessThanOrEqual(MAX_FRASE);
      expect(frases.join(" "), t).toBe(dicho);
    }
  });

  it("parte en comas una frase demasiado larga", () => {
    const larga = Array.from({ length: 12 }, (_, i) => `elemento número ${i + 1} de la lista`).join(", ") + ".";
    const frases = frasesParaVoz(larga);
    expect(frases.length).toBeGreaterThan(1);
    for (const f of frases) expect(f.length).toBeLessThanOrEqual(MAX_FRASE);
    expect(frases.join(" ")).toBe(larga);
  });
});
