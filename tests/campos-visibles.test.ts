import { describe, expect, it } from "vitest";
import { pasoF1 } from "@/lib/actuaciones-preparatorias";

/** El mismo filtro que usa el panel para decidir qué se ve sin desplegar. */
const debeVerse = (c: { required?: boolean; recomendado?: boolean }) =>
  Boolean(c.required || c.recomendado);

describe("los campos que deciden el documento no pueden estar ocultos", () => {
  it("los SÍ/NO del Art. 46.1 se ven al abrir A4", () => {
    // Estuvieron ocultos: el filtro solo miraba `required`, así que marcarlos
    // "de corresponder" les cambiaba la etiqueta y los dejaba igual de
    // escondidos tras "Mostrar N campos opcionales".
    const campos = pasoF1("A4")!.campos;
    const siNo = campos.filter((c) => c.name.startsWith("si_"));
    expect(siNo.length).toBeGreaterThanOrEqual(10);
    for (const c of siNo) expect(debeVerse(c), `${c.name} sale oculto`).toBe(true);
  });

  it("b) el sustento del no competitivo se ve al abrir A4", () => {
    const c = pasoF1("A4")!.campos.find((x) => x.name === "var_b_no_competitivo");
    expect(c, "falta el campo").toBeTruthy();
    expect(debeVerse(c!)).toBe(true);
  });

  it("lo que manda sobre la fase se ve al abrir A1", () => {
    // `causal_art_55` determina el régimen y excluye A2 y A5 (Art. 101.1);
    // `procedimiento_pac` decide la casilla a) del formato de estrategia.
    const campos = pasoF1("A1")!.campos;
    for (const name of ["causal_art_55", "procedimiento_pac", "referencia_pac"]) {
      const c = campos.find((x) => x.name === name);
      expect(c, `falta ${name}`).toBeTruthy();
      expect(debeVerse(c!), `${name} sale oculto`).toBe(true);
    }
  });

  it("el documento del no competitivo se ve siempre y depende de la causal", () => {
    // Se muestra "NO CORRESPONDE." (solo lectura) mientras no haya causal del
    // Art. 55, y se vuelve editable al elegir una: por eso apunta a `causal_art_55`
    // y es visible sin desplegar opcionales.
    const c = pasoF1("A1")!.campos.find((x) => x.name === "documento_causal_art_55");
    expect(c, "falta el documento del no competitivo").toBeTruthy();
    expect(debeVerse(c!)).toBe(true);
    expect(c!.noCorrespondeSalvoQue).toEqual({ campo: "causal_art_55" });
  });
});

describe("c) el CUI aparece solo si es una inversión", () => {
  /** El mismo filtro del panel, con la condición incluida. */
  const visible = (
    c: { required?: boolean; recomendado?: boolean; dependeDe?: { campo: string; valor: string | string[] } },
    data: Record<string, unknown>,
  ) =>
    (!c.dependeDe ||
      (Array.isArray(c.dependeDe.valor)
        ? c.dependeDe.valor.includes(String(data[c.dependeDe.campo] ?? ""))
        : data[c.dependeDe.campo] === c.dependeDe.valor)) &&
    Boolean(c.required || c.recomendado);

  const campo = (name: string) => pasoF1("A4")!.campos.find((x) => x.name === name)!;

  it("con c) sin responder, el CUI no se muestra", () => {
    // El formato lo condiciona: "Si seleccionó SÍ, debe registrar lo siguiente".
    expect(visible(campo("cui"), {})).toBe(false);
  });

  it("con c) = NO tampoco", () => {
    expect(visible(campo("cui"), { si_es_inversion: "no" })).toBe(false);
  });

  it("con c) = SÍ aparece el CUI y la pregunta de viabilidad", () => {
    const data = { si_es_inversion: "si" };
    expect(visible(campo("cui"), data), "CUI").toBe(true);
    expect(visible(campo("si_inversion_viable"), data), "viabilidad").toBe(true);
  });

  it("e) el sustento del evaluador aparece al elegir el tipo, no antes", () => {
    // Estaba oculto (opcional): elegías el tipo, la verificación pedía su
    // sustento y no había dónde escribirlo. Ahora sale al elegir cualquier tipo.
    const perfil = campo("var_e_perfil_evaluador");
    expect(visible(perfil, {}), "sin tipo no se muestra").toBe(false);
    for (const t of ["oficial_compra", "comite", "jurado"]) {
      expect(visible(perfil, { var_e_tipo_evaluador: t }), `con ${t} se muestra`).toBe(true);
    }
  });
});

describe("A5: la referencia de la difusión aparece solo si se usó la difusión", () => {
  const visible = (
    c: { required?: boolean; recomendado?: boolean; dependeDe?: { campo: string; valor: string | string[] } },
    data: Record<string, unknown>,
  ) =>
    (!c.dependeDe ||
      (Array.isArray(c.dependeDe.valor)
        ? c.dependeDe.valor.includes(String(data[c.dependeDe.campo] ?? ""))
        : data[c.dependeDe.campo] === c.dependeDe.valor)) &&
    Boolean(c.required || c.recomendado);
  const campoA5 = (name: string) => pasoF1("A5")!.campos.find((x) => x.name === name)!;
  const campos = ["difusion_acta_numero", "difusion_acta_fecha", "difusion_consultas_resumen"];

  it("sin marcar la difusión, la referencia del acta NO se muestra", () => {
    for (const n of campos) {
      expect(visible(campoA5(n), {}), `${n} sin difusión`).toBe(false);
      // El campo es booleano: false tampoco la muestra.
      expect(visible(campoA5(n), { herr_difusion: false }), `${n} con difusión=false`).toBe(false);
    }
  });

  it("con la difusión marcada (booleano true), la referencia SÍ se muestra", () => {
    for (const n of campos) {
      expect(visible(campoA5(n), { herr_difusion: true }), `${n} con difusión`).toBe(true);
    }
  });
});

describe("A5: la tabla de proveedores sigue al nivel de interacción", () => {
  const visible = (
    c: { required?: boolean; recomendado?: boolean; dependeDe?: { campo: string; valor: string | string[] } },
    data: Record<string, unknown>,
  ) =>
    (!c.dependeDe ||
      (Array.isArray(c.dependeDe.valor)
        ? c.dependeDe.valor.includes(String(data[c.dependeDe.campo] ?? ""))
        : data[c.dependeDe.campo] === c.dependeDe.valor)) &&
    Boolean(c.required || c.recomendado);
  const campoA5 = (name: string) => pasoF1("A5")!.campos.find((x) => x.name === name)!;

  it("se ve en consulta al mercado y en indagación avanzada; NO en la básica ni sin nivel", () => {
    for (const n of ["proveedores", "criterio_cuantia"]) {
      // Art. 49 (consulta) y Art. 48.2 (indagación avanzada: cotizar con proveedores).
      expect(visible(campoA5(n), { nivel: "consulta_mercado_basica" }), `${n} consulta básica`).toBe(true);
      expect(visible(campoA5(n), { nivel: "consulta_mercado_avanzada" }), `${n} consulta avanzada`).toBe(true);
      expect(visible(campoA5(n), { nivel: "indagacion_avanzada" }), `${n} indagación avanzada`).toBe(true);
      // La indagación básica se apoya en fuentes secundarias: no cotiza.
      expect(visible(campoA5(n), { nivel: "indagacion_basica" }), `${n} indagación básica`).toBe(false);
      expect(visible(campoA5(n), {}), `${n} sin nivel`).toBe(false);
    }
  });
});
