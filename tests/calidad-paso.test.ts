import { describe, expect, it } from "vitest";
import { esRelleno, problemasDelPaso } from "@/lib/calidad-paso";

/**
 * El caso real de REQ-2026-0004: llegaron a la base un objetivo "NOLOSE", tres
 * sustentos de factores "1"/"1"/"11" y una fila de cronograma sin fecha, con el
 * paso marcado como hecho. Todo eso se firma y se publica.
 */
describe("esRelleno", () => {
  it("detecta lo que se escribe para pasar de pantalla", () => {
    expect(esRelleno("11")).toBe(true);
    expect(esRelleno("1")).toBe(true);
    expect(esRelleno("NOLOSE")).toBe(true);
    expect(esRelleno("")).toBe(true);
    expect(esRelleno("   ")).toBe(true);
    expect(esRelleno("...")).toBe(true);
    expect(esRelleno("-")).toBe(true);
    expect(esRelleno(undefined)).toBe(true);
  });

  it("acepta un sustento real, aunque sea corto", () => {
    expect(esRelleno("Reduce el riesgo de desabastecimiento del sistema.")).toBe(false);
    expect(esRelleno("Garantiza la continuidad operativa.")).toBe(false);
  });
});

describe("problemasDelPaso · A4", () => {
  it("un factor con nombre y sin sustento real no deja cerrar el paso", () => {
    const p = problemasDelPaso("A4", {
      factores_items: [
        { nombre: "Plazo de entrega o ejecución de la prestación", sustento: "1" },
        { nombre: "Experiencia del postor", sustento: "11" },
      ],
    });
    expect(p).toHaveLength(2);
    expect(p[0].mensaje).toContain("Plazo de entrega");
    expect(p[1].mensaje).toContain("Experiencia del postor");
  });

  it("un factor todavía sin nombre no se reprocha: es una fila recién añadida", () => {
    expect(problemasDelPaso("A4", { factores_items: [{}, { sustento: "" }] })).toEqual([]);
  });

  it("detecta el objetivo de s) relleno", () => {
    const p = problemasDelPaso("A4", { var_s_objetivo: "NOLOSE" });
    expect(p).toHaveLength(1);
    expect(p[0].campo).toBe("var_s_objetivo");
  });

  it("s) admite \"NO CORRESPONDE\" como respuesta (su valor por defecto), no como relleno", () => {
    // 14 caracteres: caía por debajo del mínimo de esRelleno y saltaba un aviso falso.
    expect(problemasDelPaso("A4", { var_s_objetivo: "NO CORRESPONDE" })).toEqual([]);
  });

  it("detecta el evaluador elegido sin su sustento", () => {
    const p = problemasDelPaso("A4", { var_e_tipo_evaluador: "oficial_compra" });
    expect(p).toHaveLength(1);
    expect(p[0].campo).toBe("var_e_perfil_evaluador");
  });

  it("sin tipo de evaluador elegido no se pide su sustento", () => {
    expect(problemasDelPaso("A4", { var_e_tipo_evaluador: "" })).toEqual([]);
  });

  it("\"NO CORRESPONDE\" en los puntos no negociables es una respuesta, no relleno", () => {
    expect(
      problemasDelPaso("A4", {
        var_j_puntos_no_negociables: [{ punto: "NO CORRESPONDE", sustento: "NO CORRESPONDE" }],
      }),
    ).toEqual([]);
  });

  it("detecta una actividad que termina antes de empezar", () => {
    const p = problemasDelPaso("A4", {
      cronograma_items: [{ actividad: "Convocatoria", inicio: "2026-08-20", fin: "2026-08-12" }],
    });
    expect(p).toHaveLength(1);
    expect(p[0].mensaje).toContain("antes de empezar");
  });

  it("SEGÚN BASES no es una fecha imposible: es la ejecución contractual", () => {
    expect(
      problemasDelPaso("A4", {
        cronograma_items: [{ actividad: "Ejecución contractual", inicio: "SEGÚN BASES", fin: "SEGÚN BASES" }],
      }),
    ).toEqual([]);
  });

  it("un A4 bien rellenado no tiene nada que objetar", () => {
    expect(
      problemasDelPaso("A4", {
        var_e_tipo_evaluador: "oficial_compra",
        var_e_perfil_evaluador: "Corresponde al oficial de compra conforme al perfil requerido.",
        var_s_objetivo: "El principal factor externo es la disponibilidad limitada de proveedores.",
        factores_items: [{ nombre: "Plazo de entrega", sustento: "Se evaluará el plazo ofertado." }],
        cronograma_items: [{ actividad: "Convocatoria", inicio: "2026-08-12", fin: "2026-08-12" }],
      }),
    ).toEqual([]);
  });

  it("Cuadro N° 7: rechaza un evaluador que el proceso de a) no admite", () => {
    // Subasta inversa electrónica solo admite oficial de compra: "jurado" es error.
    const malo = problemasDelPaso("A4", {
      var_a_proceso: "Subasta Inversa Electrónica",
      var_e_tipo_evaluador: "jurado",
      var_e_perfil_evaluador: "Sustento del jurado suficientemente redactado para el objeto.",
    });
    expect(malo.some((p) => p.campo === "var_e_tipo_evaluador" && /Cuadro N° 7/.test(p.mensaje))).toBe(true);
    // Con un evaluador admisible no salta la objeción del Cuadro N° 7.
    const bueno = problemasDelPaso("A4", {
      var_a_proceso: "Subasta Inversa Electrónica",
      var_e_tipo_evaluador: "oficial_compra",
      var_e_perfil_evaluador: "Sustento del oficial de compra suficientemente redactado.",
    });
    expect(bueno.some((p) => /Cuadro N° 7/.test(p.mensaje))).toBe(false);
  });

  it("o) el gate bloquea un cronograma que incumple el mínimo del Art. 64.1", () => {
    // Licitación pública: entre convocatoria y presentación de ofertas exige 22 días
    // hábiles. Aquí median ~3: el editor ya lo avisa, pero antes no impedía el «hecho».
    const p = problemasDelPaso("A4", {
      var_a_procedimiento: "licitacion_publica",
      cronograma_items: [
        { fase: "seleccion", actividad: "Convocatoria", inicio: "2026-05-01", fin: "2026-05-01" },
        { fase: "seleccion", actividad: "Presentación de ofertas", inicio: "2026-05-06", fin: "2026-05-06" },
      ],
    });
    expect(p.some((x) => x.campo === "cronograma_items" && /Art\. 64\.1/.test(x.mensaje))).toBe(true);
  });

  it("o) una modalidad abreviada (excepción del 64.1) no dispara ese mínimo", () => {
    const p = problemasDelPaso("A4", {
      var_a_procedimiento: "licitacion_publica_abreviada",
      cronograma_items: [
        { fase: "seleccion", actividad: "Convocatoria", inicio: "2026-05-01", fin: "2026-05-01" },
        { fase: "seleccion", actividad: "Presentación de ofertas", inicio: "2026-05-06", fin: "2026-05-06" },
      ],
    });
    expect(p.some((x) => /Art\. 64\.1/.test(x.mensaje))).toBe(false);
  });

  it("a) avisa cuando el procedimiento no aplica al objeto de la contratación", () => {
    // Licitación Pública de obras sobre un objeto "bien": incoherencia Arts. 93/94/95.
    const p = problemasDelPaso("A4", { var_a_proceso: "Licitación Pública de obras" }, { objeto: "bien" });
    expect(p.some((x) => x.campo === "var_a_proceso" && /no aplica al objeto/.test(x.mensaje))).toBe(true);
  });

  it("a) no avisa cuando el objeto sí corresponde al procedimiento", () => {
    const p = problemasDelPaso("A4", { var_a_proceso: "Licitación Pública de obras" }, { objeto: "obra" });
    expect(p.some((x) => /no aplica al objeto/.test(x.mensaje))).toBe(false);
  });
});

describe("problemasDelPaso · A6 · blindaje del tipo de evaluador (A4↔A6)", () => {
  const divergencia = (p: { mensaje: string }[]) =>
    p.some((x) => /no coincide con el de la Estrategia A4/i.test(x.mensaje));

  it("bloquea cuando el tipo de A6 (comité) no coincide con el de A4 (oficial de compra)", () => {
    const p = problemasDelPaso("A6", { tipo_evaluador: "comite" }, { a4: { var_e_tipo_evaluador: "oficial_compra" } });
    expect(divergencia(p)).toBe(true);
  });

  it("no bloquea cuando A4 y A6 coinciden", () => {
    const p = problemasDelPaso("A6", { tipo_evaluador: "comite" }, { a4: { var_e_tipo_evaluador: "comite" } });
    expect(divergencia(p)).toBe(false);
  });

  it("no bloquea si A4 aún no fijó el tipo (no hay contradicción)", () => {
    expect(divergencia(problemasDelPaso("A6", { tipo_evaluador: "comite" }, { a4: {} }))).toBe(false);
    expect(divergencia(problemasDelPaso("A6", { tipo_evaluador: "comite" }))).toBe(false);
  });
});

describe("problemasDelPaso · A2", () => {
  it("una fila del cronograma sin fecha no deja cerrar el paso", () => {
    const p = problemasDelPaso("A2", {
      cronogramaItems: [{ area: "GERENCIA DE SERVICIOS MUNICIPALES", fecha: "" }],
    });
    expect(p).toHaveLength(1);
    expect(p[0].mensaje).toContain("GERENCIA DE SERVICIOS MUNICIPALES");
  });

  it("con su fecha, nada que objetar", () => {
    expect(
      problemasDelPaso("A2", { cronogramaItems: [{ area: "GERENCIA", fecha: "2026-08-12" }] }),
    ).toEqual([]);
  });
});

describe("problemasDelPaso · pasos sin reglas", () => {
  it("no inventa problemas donde no hay reglas definidas", () => {
    expect(problemasDelPaso("A1", { lo_que_sea: "11" })).toEqual([]);
    expect(problemasDelPaso("B8", {})).toEqual([]);
  });
});

describe("problemasDelPaso · A1 horizonte del CMN (≥ 3 años)", () => {
  it("un rango de 3 años no objeta nada", () => {
    expect(problemasDelPaso("A1", { periodo_programacion: "2026-2028" })).toEqual([]);
  });

  it("un rango menor a 3 años avisa (y bloquea marcar hecho, no guardar)", () => {
    const p = problemasDelPaso("A1", { periodo_programacion: "2026-2027" });
    expect(p).toHaveLength(1);
    expect(p[0].campo).toBe("periodo_programacion");
    expect(p[0].mensaje).toContain("2 año");
  });

  it("un solo año también avisa", () => {
    expect(problemasDelPaso("A1", { periodo_programacion: "2026" })[0]?.mensaje).toContain("1 año");
  });

  it("sin periodo, o con texto sin años parseables, no inventa problemas", () => {
    expect(problemasDelPaso("A1", {})).toEqual([]);
    expect(problemasDelPaso("A1", { periodo_programacion: "por definir" })).toEqual([]);
  });

  it("tolera separadores distintos (año a año)", () => {
    expect(problemasDelPaso("A1", { periodo_programacion: "2026 al 2028" })).toEqual([]);
    expect(problemasDelPaso("A1", { periodo_programacion: "2026, 2027, 2028" })).toEqual([]);
  });
});

describe("problemasDelPaso · A1 causal no competitivo (Art. 55) sin documento", () => {
  it("con causal elegida y sin documento, avisa", () => {
    const p = problemasDelPaso("A1", { causal_art_55: "desabastecimiento", periodo_programacion: "2026-2028" });
    expect(p).toHaveLength(1);
    expect(p[0].campo).toBe("documento_causal_art_55");
    expect(p[0].mensaje).toContain("Art. 55");
  });

  it("con causal y su documento, nada que objetar", () => {
    expect(
      problemasDelPaso("A1", {
        causal_art_55: "desabastecimiento",
        documento_causal_art_55: "INFORME N° 012-2026-AU-MDCH",
        periodo_programacion: "2026-2028",
      }),
    ).toEqual([]);
  });

  it("sin causal, no exige el documento", () => {
    expect(problemasDelPaso("A1", { documento_causal_art_55: "", periodo_programacion: "2026-2028" })).toEqual([]);
  });
});

describe("problemasDelPaso · A5 interacción con el mercado", () => {
  it("consulta al mercado sin proveedores (ni cuantía) avisa: falta la base de la cuantía", () => {
    const p = problemasDelPaso("A5", { nivel: "consulta_mercado_basica", proveedores: [] });
    expect(p.some((x) => x.campo === "proveedores")).toBe(true);
  });

  it("consulta con una herramienta y un proveedor con monto: nada que objetar", () => {
    expect(
      problemasDelPaso("A5", {
        nivel: "consulta_mercado_basica",
        herr_solicitud: true,
        proveedores: [{ razonSocial: "VIPASA S.A.", monto: 64680 }],
      }),
    ).toEqual([]);
  });

  it("una fila a medias (monto sin razón social, o al revés) avisa", () => {
    const sinNombre = problemasDelPaso("A5", {
      nivel: "consulta_mercado_basica",
      proveedores: [{ monto: 100 }],
    });
    expect(sinNombre.some((x) => /razón social/.test(x.mensaje))).toBe(true);

    const sinMonto = problemasDelPaso("A5", {
      nivel: "consulta_mercado_avanzada",
      proveedores: [{ razonSocial: "VIPASA S.A.", monto: 64680 }, { razonSocial: "OTRA S.A." }],
    });
    expect(sinMonto.some((x) => /falta el monto/.test(x.mensaje))).toBe(true);
  });

  it("una consulta con la cuantía puesta a mano (sin tabla) no avisa por la cuantía", () => {
    expect(
      problemasDelPaso("A5", {
        nivel: "consulta_mercado_basica",
        herr_solicitud: true,
        proveedores: [],
        cuantia_actualizada: 50000,
      }),
    ).toEqual([]);
  });

  it("indagación sin cuantía actualizada avisa; con ella, no", () => {
    expect(problemasDelPaso("A5", { nivel: "indagacion_basica", fuente_historica: true }).some((x) => x.campo === "cuantia_actualizada")).toBe(true);
    expect(
      problemasDelPaso("A5", {
        nivel: "indagacion_avanzada",
        fuente_historica: true,
        fuente_pladicop: true,
        cuantia_actualizada: 30000,
      }),
    ).toEqual([]);
  });
});

describe("problemasDelPaso · A5 RUC de proveedores", () => {
  it("un RUC que no tiene 11 dígitos avisa; uno de 11 dígitos no", () => {
    const malo = problemasDelPaso("A5", {
      nivel: "consulta_mercado_basica",
      proveedores: [{ ruc: "2010", razonSocial: "VIPASA S.A.", monto: 100 }],
    });
    expect(malo.some((x) => /11 dígitos/.test(x.mensaje))).toBe(true);

    const bueno = problemasDelPaso("A5", {
      nivel: "consulta_mercado_basica",
      proveedores: [{ ruc: "20100047218", razonSocial: "VIPASA S.A.", monto: 100 }],
    });
    expect(bueno.some((x) => /11 dígitos/.test(x.mensaje))).toBe(false);
  });

  it("el mismo RUC en dos filas avisa de la repetición", () => {
    const p = problemasDelPaso("A5", {
      nivel: "consulta_mercado_avanzada",
      proveedores: [
        { ruc: "20100047218", razonSocial: "VIPASA S.A.", monto: 100 },
        { ruc: "20100047218", razonSocial: "VIPASA S.A.", monto: 120 },
      ],
    });
    expect(p.some((x) => /se repite/.test(x.mensaje))).toBe(true);
  });

  it("una fila sin RUC no dispara ni formato ni duplicado", () => {
    const p = problemasDelPaso("A5", {
      nivel: "consulta_mercado_basica",
      proveedores: [{ razonSocial: "VIPASA S.A.", monto: 100 }],
    });
    expect(p.some((x) => /RUC/.test(x.mensaje))).toBe(false);
  });
});

describe("problemasDelPaso · A5 mínimo de fuentes/herramientas por nivel", () => {
  it("indagación avanzada con una sola fuente avisa (exige 2+, Art. 48.3)", () => {
    const p = problemasDelPaso("A5", {
      nivel: "indagacion_avanzada",
      cuantia_actualizada: 1000, // aísla: sin esto saltaría también el aviso de cuantía
      fuente_historica: true,
    });
    expect(p.some((x) => /dos o más fuentes/.test(x.mensaje))).toBe(true);
  });

  it("indagación avanzada con dos fuentes no avisa por el mínimo", () => {
    const p = problemasDelPaso("A5", {
      nivel: "indagacion_avanzada",
      cuantia_actualizada: 1000,
      fuente_historica: true,
      fuente_pladicop: true,
    });
    expect(p.some((x) => /fuente/.test(x.mensaje))).toBe(false);
  });

  it("indagación básica sin ninguna fuente avisa (mínimo 1)", () => {
    const p = problemasDelPaso("A5", { nivel: "indagacion_basica", cuantia_actualizada: 1000 });
    expect(p.some((x) => /al menos una fuente/.test(x.mensaje))).toBe(true);
  });

  it("consulta avanzada con una sola herramienta avisa (exige 2+, Art. 49.2)", () => {
    const p = problemasDelPaso("A5", {
      nivel: "consulta_mercado_avanzada",
      cuantia_actualizada: 1000,
      herr_solicitud: true,
    });
    expect(p.some((x) => /dos o más herramientas/.test(x.mensaje))).toBe(true);
  });

  it("consulta básica con una herramienta no avisa por el mínimo", () => {
    const p = problemasDelPaso("A5", {
      nivel: "consulta_mercado_basica",
      cuantia_actualizada: 1000,
      herr_solicitud: true,
    });
    expect(p.some((x) => /herramienta/.test(x.mensaje))).toBe(false);
  });
})

describe("problemasDelPaso · A5 difusión del requerimiento (Art. 51.3)", () => {
  it("difusión marcada sin el N° de acta avisa", () => {
    const p = problemasDelPaso("A5", {
      nivel: "consulta_mercado_basica",
      herr_difusion: true,
      cuantia_actualizada: 1000,
    });
    expect(p.some((x) => x.campo === "difusion_acta_numero")).toBe(true);
  });

  it("difusión con su acta no avisa", () => {
    const p = problemasDelPaso("A5", {
      nivel: "consulta_mercado_basica",
      herr_difusion: true,
      difusion_acta_numero: "ACTA N° 1",
      cuantia_actualizada: 1000,
    });
    expect(p.some((x) => x.campo === "difusion_acta_numero")).toBe(false);
  });
})

describe("problemasDelPaso · A4 coherencia con la causal del Art. 55 de A1", () => {
  it("causal en A1 pero b) no confirma el no competitivo: avisa", () => {
    const p = problemasDelPaso("A4", { si_sustenta_no_competitivo: "" }, { a1: { causal_art_55: "desabastecimiento" } });
    expect(p.some((x) => x.campo === "si_sustenta_no_competitivo")).toBe(true);
  });

  it("causal en A1 y b)='si': coherente, no avisa", () => {
    const p = problemasDelPaso("A4", { si_sustenta_no_competitivo: "si" }, { a1: { causal_art_55: "desabastecimiento" } });
    expect(p.some((x) => x.campo === "si_sustenta_no_competitivo")).toBe(false);
  });

  it("b) sustenta un no competitivo pero A1 no trae causal: avisa (inverso)", () => {
    const p = problemasDelPaso("A4", { si_sustenta_no_competitivo: "si" }, { a1: {} });
    expect(p.some((x) => /no consta ninguna causal/.test(x.mensaje))).toBe(true);
  });

  it("sin causal y con b)='no' (competitivo, la regla): nada que objetar", () => {
    expect(problemasDelPaso("A4", { si_sustenta_no_competitivo: "no" }, { a1: {} })).toEqual([]);
  });

  it("sin el contexto de A1 no se juzga la coherencia (se calla)", () => {
    expect(problemasDelPaso("A4", { si_sustenta_no_competitivo: "si" })).toEqual([]);
  });
})

describe("problemasDelPaso · A4 cronograma con fecha+hora", () => {
  it("detecta 'termina antes de empezar' también con fecha+hora", () => {
    const p = problemasDelPaso("A4", {
      cronograma_items: [{ actividad: "Convocatoria", inicio: "2026-08-20T00:01", fin: "2026-08-12T23:59" }],
    });
    expect(p.some((x) => /antes de empezar/.test(x.mensaje))).toBe(true);
  });

  it("con fecha+hora coherente del mismo día (00:01 → 23:59) no avisa", () => {
    const p = problemasDelPaso("A4", {
      cronograma_items: [{ actividad: "Convocatoria", inicio: "2026-08-12T00:01", fin: "2026-08-12T23:59" }],
    });
    expect(p.some((x) => /antes de empezar/.test(x.mensaje))).toBe(false);
  });
})

describe("A4 · f) requisitos de calificación", () => {
  const avisosF = (proc: string, req: string) =>
    problemasDelPaso("A4", { var_a_proceso: proc, var_f_requisitos_calificacion: req }).filter(
      (p) => p.campo === "var_f_requisitos_calificacion",
    );

  it("avisa de un facultativo activo sin sustento real", () => {
    const avisos = avisosF("Licitación Pública para bienes", "FACULTATIVOS:\n- Capacidad técnica y profesional");
    expect(avisos.length).toBe(1);
    expect(avisos[0].mensaje).toContain("sustento");
  });

  it("no avisa si el facultativo tiene un sustento real", () => {
    const avisos = avisosF(
      "Licitación Pública para bienes",
      "FACULTATIVOS:\n- Capacidad técnica y profesional — Sustento: personal clave especializado en el montaje",
    );
    expect(avisos).toEqual([]);
  });

  it("avisa de la capacidad económica marcada sin precalificación", () => {
    const avisos = avisosF(
      "Licitación Pública para bienes",
      "FACULTATIVOS:\n- Capacidad económica — Sustento: ratio de liquidez corriente mayor a uno",
    );
    expect(avisos.some((p) => /precalificaci/i.test(p.mensaje))).toBe(true);
  });

  it("no avisa de la capacidad económica si el procedimiento tiene precalificación", () => {
    const avisos = avisosF(
      "Concurso Público con precalificación",
      "FACULTATIVOS:\n- Capacidad económica — Sustento: ratio de liquidez corriente mayor a uno",
    );
    expect(avisos.some((p) => /precalificaci/i.test(p.mensaje))).toBe(false);
  });
});

describe("A4 · no objeción por excluir un facultativo propuesto (Art. 44.8)", () => {
  const A4 = { var_a_proceso: "Licitación Pública para bienes", var_f_requisitos_calificacion: "" };
  // El área usuaria propuso capacidad técnica como facultativo (A3); la DEC no la
  // incluye en A4 (var_f vacío) → exclusión.
  const a3ConPropuesta = (noObjecion: string) => ({
    propuesta_requisitos_calificacion: "FACULTATIVOS:\n- Capacidad técnica y profesional — Sustento: personal clave",
    no_objecion: noObjecion,
  });
  const avisos = (a3: Record<string, unknown>) =>
    problemasDelPaso("A4", A4, { a3 }).filter((p) => p.campo === "var_f_requisitos_calificacion");

  it("avisa si se excluye un facultativo propuesto y no consta la no objeción", () => {
    const a = avisos(a3ConPropuesta(""));
    expect(a.some((p) => /no objeci/i.test(p.mensaje))).toBe(true);
  });

  it("no avisa si la no objeción está otorgada", () => {
    const a = avisos(a3ConPropuesta("otorgada"));
    expect(a.some((p) => /no objeci/i.test(p.mensaje))).toBe(false);
  });

  it("no avisa si el área usuaria no había propuesto ese facultativo", () => {
    const a = avisos({ propuesta_requisitos_calificacion: "", no_objecion: "" });
    expect(a.some((p) => /no objeci/i.test(p.mensaje))).toBe(false);
  });
});
