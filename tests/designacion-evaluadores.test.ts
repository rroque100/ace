import { describe, expect, it } from "vitest";
import { pasoF1 } from "@/lib/actuaciones-preparatorias";
import {
  cantidadDefaultPorTipoEvaluador,
  etiquetaDesignacion,
  herenciaEvaluadorA4,
  identificacion,
  prefijoDesignacion,
  soloNumeroDesignacion,
  INTEGRANTES_POR_TIPO,
  type IntegranteEvaluador,
  leerIntegrantes,
  problemasComposicionPanel,
  ROL_DE_TIPO_EVALUADOR,
  soloTieneCorreo,
} from "@/lib/designacion-evaluadores";

describe("número de integrantes que se autoselecciona por tipo", () => {
  it("oficial→1, comité→3, jurado→5 (editable a 3); desconocido→''", () => {
    expect(cantidadDefaultPorTipoEvaluador("oficial_compra")).toBe("1");
    expect(cantidadDefaultPorTipoEvaluador("comite")).toBe("3");
    expect(cantidadDefaultPorTipoEvaluador("jurado")).toBe("5");
    expect(cantidadDefaultPorTipoEvaluador("")).toBe("");
  });
});

describe("documento de designación según el tipo de evaluador", () => {
  it("oficial de compra → Memorándum; comité y jurado → Informe", () => {
    expect(prefijoDesignacion("oficial_compra")).toBe("Memorándum N° ");
    expect(prefijoDesignacion("comite")).toBe("INFORME N° ");
    expect(prefijoDesignacion("jurado")).toBe("INFORME N° ");
    expect(etiquetaDesignacion("oficial_compra")).toMatch(/memorándum/i);
    expect(etiquetaDesignacion("comite")).toMatch(/informe/i);
  });

  it("soloNumeroDesignacion quita un prefijo Memorándum o Informe ya escrito", () => {
    expect(soloNumeroDesignacion("Memorándum N° 52-2026")).toBe("52-2026");
    expect(soloNumeroDesignacion("INFORME N° 100-2026")).toBe("100-2026");
    expect(soloNumeroDesignacion("MEMORADUN NRO 7-2026")).toBe("7-2026");
    expect(soloNumeroDesignacion("113-2026")).toBe("113-2026");
  });
});

const T = (rol: string, condicion: "titular" | "suplente" = "titular"): IntegranteEvaluador => ({
  nombre: "X",
  dni: "12345678",
  rol,
  condicion,
});

describe("composición del panel evaluador (Art. 56.1, 59.1, 60.1)", () => {
  it("oficial de compra: exactamente 1 integrante (Art. 58.1)", () => {
    expect(problemasComposicionPanel("oficial_compra", [T("Oficial de compra")])).toEqual([]);
    expect(problemasComposicionPanel("oficial_compra", [T("Oficial de compra"), T("Oficial de compra")]).length)
      .toBeGreaterThan(0);
  });

  it("comité válido: 3 titulares (≥1 comprador DEC, ≥1 experto) + suplente", () => {
    const ok = problemasComposicionPanel("comite", [
      T("Comprador público (DEC)"),
      T("Experto/profesional"),
      T("Experto/profesional"),
      T("Experto/profesional", "suplente"),
    ]);
    expect(ok).toEqual([]);
  });

  it("comité sin comprador público de la DEC → lo señala (Art. 56.1.b)", () => {
    const p = problemasComposicionPanel("comite", [
      T("Experto/profesional"),
      T("Experto/profesional"),
      T("Experto/profesional"),
      T("Experto/profesional", "suplente"),
    ]);
    expect(p.some((m) => /comprador público/i.test(m))).toBe(true);
  });

  it("comité sin suplentes → lo señala (Art. 59.1)", () => {
    const p = problemasComposicionPanel("comite", [
      T("Comprador público (DEC)"),
      T("Experto/profesional"),
      T("Experto/profesional"),
    ]);
    expect(p.some((m) => /suplente/i.test(m))).toBe(true);
  });

  it("las filas en blanco NO cuentan como miembros, aunque traigan rol y condición", () => {
    // La plantilla crea las filas con su rol/condición por defecto pero sin
    // nombre; hasta que no se rellenen, la composición sigue incompleta.
    const vacias: IntegranteEvaluador[] = [
      { rol: "Comprador público (DEC)", condicion: "titular" },
      { rol: "Comprador público (DEC)", condicion: "suplente" },
      { rol: "Experto/profesional", condicion: "titular" },
      { rol: "Experto/profesional", condicion: "suplente" },
    ];
    const p = problemasComposicionPanel("comite", vacias);
    expect(p.some((m) => /3 titular/i.test(m) || /titular\(es\)/i.test(m))).toBe(true);
  });

  it("jurado: 3 o 5 titulares y un suplente (Arts. 56.1.c, 60.1)", () => {
    const tres = problemasComposicionPanel("jurado", [
      T("Experto"),
      T("Experto"),
      T("Experto"),
      T("Experto", "suplente"),
    ]);
    expect(tres).toEqual([]);
    const cuatro = problemasComposicionPanel("jurado", [T("Experto"), T("Experto"), T("Experto"), T("Experto")]);
    expect(cuatro.some((m) => /3 o 5/i.test(m))).toBe(true);
  });
});

/**
 * A6 designa lo que A4 decidió (Art. 46.1.e → Art. 54.2.e). No vuelve a
 * preguntar el tipo: lo hereda, para que la estrategia y la designación no se
 * contradigan.
 */
describe("herenciaEvaluadorA4 · A6 hereda de A4", () => {
  it("oficial de compra: un solo integrante, cantidad fija", () => {
    const h = herenciaEvaluadorA4({ var_e_tipo_evaluador: "oficial_compra" })!;
    expect(h.tipo).toBe("oficial_compra");
    expect(h.integrantesPosibles).toEqual([1]);
    expect(h.cantidadFija).toBe(1);
  });

  it("comité: tres integrantes, cantidad fija", () => {
    const h = herenciaEvaluadorA4({ var_e_tipo_evaluador: "comite" })!;
    expect(h.cantidadFija).toBe(3);
  });

  it("jurado: 3 o 5, así que la cantidad NO se fija (se elige)", () => {
    const h = herenciaEvaluadorA4({ var_e_tipo_evaluador: "jurado" })!;
    expect(h.integrantesPosibles).toEqual([3, 5]);
    expect(h.cantidadFija).toBeNull();
  });

  it("sin tipo en A4 no hay nada que heredar", () => {
    expect(herenciaEvaluadorA4({})).toBeNull();
    expect(herenciaEvaluadorA4(null)).toBeNull();
    expect(herenciaEvaluadorA4({ var_e_tipo_evaluador: "" })).toBeNull();
  });

  it("un tipo desconocido no se hereda a ciegas", () => {
    expect(herenciaEvaluadorA4({ var_e_tipo_evaluador: "otro_invento" })).toBeNull();
  });

  it("los tres tipos del evaluador están cubiertos, y cada uno tiene su rol", () => {
    for (const tipo of ["oficial_compra", "comite", "jurado"]) {
      expect(INTEGRANTES_POR_TIPO[tipo], `faltan integrantes de ${tipo}`).toBeDefined();
      expect(ROL_DE_TIPO_EVALUADOR[tipo], `falta el rol de ${tipo}`).toBeDefined();
    }
  });
});

describe("A6 · el campo de integrantes usa el editor estructurado", () => {
  const a6 = pasoF1("A6")!;

  it("el campo 'integrantes' es del tipo que trae usuarios, no un textarea", () => {
    const campo = a6.campos.find((c) => c.name === "integrantes")!;
    expect(campo.tipo).toBe("evaluadores");
    expect(campo.required).toBe(true);
  });

  it("el tipo y el número de integrantes siguen ahí para heredarse de A4", () => {
    expect(a6.campos.find((c) => c.name === "tipo_evaluador")).toBeDefined();
    expect(a6.campos.find((c) => c.name === "cantidad_integrantes")).toBeDefined();
  });

  it("la cabecera del comité: AL desplegable de oficinas, ATENCIÓN autoridad (AGA por defecto), DE oculto", () => {
    // AL: se elige la oficina del catálogo (por defecto la OGA en el documento).
    const al = a6.campos.find((c) => c.name === "destinatario")!;
    expect(al.tipo).toBe("select");
    expect(al.opcionesOficinas).toBe(true);
    expect(al.required).toBe(true);
    // ATENCIÓN: desplegable de autoridad con la AGA como opción, obligatorio (no es
    // una oficina del catálogo).
    const atencion = a6.campos.find((c) => c.name === "atencion")!;
    expect(atencion.tipo).toBe("select");
    expect(atencion.required).toBe(true);
    expect(atencion.opcionesOficinas).toBeFalsy();
    expect(atencion.opciones?.map((o) => o.value)).toContain("aga");
    // DE: oculto, siempre la DEC.
    expect(a6.campos.find((c) => c.name === "remitente")!.oculto).toBe(true);
  });
});

describe("integrantes · identificación y aviso de nombre faltante", () => {
  it("lee solo objetos, tolera basura", () => {
    expect(leerIntegrantes([{ nombre: "Ana" }, "x", null, 3])).toEqual([{ nombre: "Ana" }]);
    expect(leerIntegrantes("no-es-lista")).toEqual([]);
  });

  it("identifica por el nombre; si falta, por el correo", () => {
    expect(identificacion({ nombre: "Ana Pérez", correo: "ana@x.pe" })).toBe("Ana Pérez");
    expect(identificacion({ correo: "dec@ace.local" })).toBe("dec@ace.local");
    expect(identificacion({})).toBe("");
  });

  it("detecta al designado que solo tiene correo (el caso real: dec@ace.local)", () => {
    expect(soloTieneCorreo({ correo: "dec@ace.local" })).toBe(true);
    expect(soloTieneCorreo({ nombre: "Ana", correo: "ana@x.pe" })).toBe(false);
    // Sin correo tampoco es "solo correo": no hay nada que avisar.
    expect(soloTieneCorreo({})).toBe(false);
  });
});
