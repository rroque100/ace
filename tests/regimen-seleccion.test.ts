import { describe, expect, it } from "vitest";
import {
  CAUSALES_ART_55,
  procedimientoSugerido,
  procedimientosParaObjeto,
  regimenDe,
} from "@/lib/regimen-seleccion";
import type { HitosMap } from "@/lib/procurement-fases";
import { aplicabilidadHito } from "@/lib/aplicabilidad-fases";

/** El régimen se deduce de la causal del Art. 55 registrada en A1. */
const a4 = (regimen?: string): HitosMap => ({
  A1: { data: regimen === "no_competitivo" ? { causal_art_55: "d" } : {}, status: "en_curso" },
});

describe("régimen del procedimiento", () => {
  it("por defecto es competitivo", () => {
    // Art. 54.3: "las entidades contratantes realizan procedimientos de
    // selección competitivos, salvo las excepciones establecidas en la ley".
    expect(regimenDe({})).toBe("competitivo");
    expect(regimenDe(a4())).toBe("competitivo");
    expect(regimenDe(a4("competitivo"))).toBe("competitivo");
  });

  it("reconoce el no competitivo", () => {
    expect(regimenDe(a4("no_competitivo"))).toBe("no_competitivo");
  });
});

describe("qué pasos no corresponden sin competencia (Arts. 101-102)", () => {
  it("en competitivo no excluye ningún paso de la Fase 1", () => {
    for (const code of ["A1", "A2", "A3", "A4", "A5", "A6", "A7"]) {
      expect(aplicabilidadHito(code, { causalArt55: null }).estado, code).toBe("aplica");
    }
  });

  it("en no competitivo caen la segmentación (101.1) y los evaluadores (101.2)", () => {
    // El 101.1 dice que el RESTO de las disposiciones generales sí aplican: no
    // es que la fase preparatoria entera sea solo para competitivos.
    //
    // Este test exigía antes que A2 citara un "Art. 42.5" que no existe —el
    // Art. 42 termina en 42.3—, así que fijaba el error en vez de detectarlo.
    const ctx = { causalArt55: "d" };
    expect(aplicabilidadHito("A2", ctx).estado).toBe("no_aplica");
    expect(aplicabilidadHito("A6", ctx).estado).toBe("no_aplica");
    for (const code of ["A1", "A3", "A4", "A7", "A8", "A9", "A10"]) {
      expect(aplicabilidadHito(code, ctx).estado, `${code} sí debe seguir aplicando`).toBe("aplica");
    }
  });

  it("la fase de selección se reduce a invitar y recibir la oferta (101.2)", () => {
    const ctx = { causalArt55: "d" };
    for (const code of ["B2", "B3", "B4", "B6", "B7", "B8"]) {
      expect(aplicabilidadHito(code, ctx).estado, code).toBe("no_aplica");
    }
    // B1 sí ocurre, pero como invitación, no como convocatoria pública.
    const b1 = aplicabilidadHito("B1", ctx);
    expect(b1.estado).toBe("aplica");
    expect(b1.nota).toContain("invitación");
  });

  it("la ejecución contractual avisa de sus dos exclusiones (Art. 103)", () => {
    const c5 = aplicabilidadHito("C5", { causalArt55: "b" });
    expect(c5.estado).toBe("aplica");
    expect(c5.nota).toContain("complementarias");
  });
});

describe("el régimen se deduce de la causal del Art. 55 (A1), no se elige en A4", () => {
  it("sin causal es competitivo: es la regla general del Art. 54.3", () => {
    expect(regimenDe({ A1: { data: {}, status: "hecho" } })).toBe("competitivo");
    expect(regimenDe({ A1: { data: { causal_art_55: "" }, status: "hecho" } })).toBe("competitivo");
  });

  it("con causal es no competitivo", () => {
    expect(regimenDe({ A1: { data: { causal_art_55: "b" }, status: "hecho" } })).toBe("no_competitivo");
  });

  it("lo que diga A4 es irrelevante: se sabe antes de A2", () => {
    // El Art. 42.5 excluye la segmentación de los no competitivos, así que el
    // régimen tiene que conocerse ANTES del paso 2, no en el 4.
    const h: HitosMap = {
      A1: { data: { causal_art_55: "d" }, status: "hecho" },
      A4: { data: { regimen_procedimiento: "competitivo" }, status: "hecho" },
    };
    expect(regimenDe(h)).toBe("no_competitivo");
  });

  it("las causales son las 13 del Art. 55.1, de la a) a la m)", () => {
    expect(CAUSALES_ART_55).toHaveLength(13);
    expect(CAUSALES_ART_55.map((c) => c.value)).toEqual("abcdefghijklm".split(""));
    expect(CAUSALES_ART_55[3].label).toContain("Proveedor único");
  });
});

describe("el tipo de procedimiento se filtra por el objeto (Art. 54.1)", () => {
  it("servicios y consultoría → concurso público, nunca licitación", () => {
    const vals = procedimientosParaObjeto("servicio").map((p) => p.value);
    expect(vals).toContain("concurso_publico");
    expect(vals).toContain("concurso_publico_abreviado");
    expect(vals).not.toContain("licitacion_publica");
  });

  it("bienes y obras → licitación pública, nunca concurso", () => {
    for (const objeto of ["bien", "obra"]) {
      const vals = procedimientosParaObjeto(objeto).map((p) => p.value);
      expect(vals, objeto).toContain("licitacion_publica");
      expect(vals, objeto).not.toContain("concurso_publico");
    }
  });

  it("las modalidades diferenciadas se ofrecen para cualquier objeto", () => {
    // Subasta inversa, comparación de precios y compra pública de innovación
    // no dependen de la familia del 54.1.
    for (const objeto of ["bien", "servicio", "obra"]) {
      expect(procedimientosParaObjeto(objeto).map((p) => p.value), objeto).toContain(
        "subasta_inversa_electronica",
      );
    }
  });

  it("sin objeto conocido ofrece todos, sin adivinar", () => {
    expect(procedimientosParaObjeto("")).toHaveLength(7);
    expect(procedimientosParaObjeto(null)).toHaveLength(7);
  });
});

describe("procedimiento sugerido", () => {
  it("bienes y obras → licitación pública (Art. 54.1.a)", () => {
    expect(procedimientoSugerido("bien", false)?.value).toBe("licitacion_publica");
    expect(procedimientoSugerido("obra", false)?.value).toBe("licitacion_publica");
  });

  it("servicios y consultoría → concurso público (Art. 54.1.b)", () => {
    expect(procedimientoSugerido("servicio", false)?.value).toBe("concurso_publico");
    expect(procedimientoSugerido("consultoria_obra", false)?.value).toBe("concurso_publico");
  });

  it("con ficha técnica manda la subasta inversa (Art. 96.1)", () => {
    // ACE ya sabe si hay ficha técnica: lo verifica el área usuaria en la ficha
    // y A3 lo hereda.
    expect(procedimientoSugerido("bien", true)?.value).toBe("subasta_inversa_electronica");
    expect(procedimientoSugerido("servicio", true)?.value).toBe("subasta_inversa_electronica");
  });

  it("una obra con ficha técnica NO va a subasta inversa", () => {
    // El 96.1 habla de bienes y servicios comunes, no de obras.
    expect(procedimientoSugerido("obra", true)?.value).toBe("licitacion_publica");
  });

  it("sin objeto no sugiere nada", () => {
    expect(procedimientoSugerido("", false)).toBeNull();
    expect(procedimientoSugerido(null, false)).toBeNull();
  });

  it("siempre sugiere con un motivo citando su artículo", () => {
    for (const o of ["bien", "servicio", "obra"]) {
      expect(procedimientoSugerido(o, false)!.motivo, o).toMatch(/Art\. \d+/);
    }
  });
});
