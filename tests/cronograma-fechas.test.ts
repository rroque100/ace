import { describe, expect, it } from "vitest";
import {
  calcularFechasCronograma,
  diasHabilesEntre,
  duracionActividad,
  fechaDe,
  restarDiasCalendario,
  sumarDiasHabiles,
  validarCronograma,
} from "@/lib/cronograma-fechas";
import type { ActividadCronograma } from "@/lib/estrategia-formato";

describe("sumarDiasHabiles", () => {
  it("omite sábados y domingos", () => {
    // Viernes 2026-08-07 + 1 día hábil = lunes 2026-08-10.
    expect(sumarDiasHabiles("2026-08-07", 1)).toBe("2026-08-10");
  });

  it("0 días devuelve la misma fecha (si es hábil)", () => {
    expect(sumarDiasHabiles("2026-08-07", 0)).toBe("2026-08-07");
  });

  it("corre un ancla de fin de semana al lunes", () => {
    // Sábado 2026-08-08 → lunes 2026-08-10.
    expect(sumarDiasHabiles("2026-08-08", 0)).toBe("2026-08-10");
  });
});

describe("restarDiasCalendario", () => {
  it("resta días calendario (cuentan sábados y domingos)", () => {
    // El Art. 64.3 exige publicar el anuncio ≥40 días antes de la convocatoria.
    expect(restarDiasCalendario("2026-10-15", 40)).toBe("2026-09-05");
  });

  it("cruza el límite de mes", () => {
    expect(restarDiasCalendario("2026-08-01", 40)).toBe("2026-06-22");
  });

  it("0 días devuelve la misma fecha", () => {
    expect(restarDiasCalendario("2026-10-15", 0)).toBe("2026-10-15");
  });
});

describe("duracionActividad", () => {
  it("reconoce actividades conocidas por palabra clave", () => {
    expect(duracionActividad("Convocatoria")).toBe(1);
  });

  it("Art. 66.1: las consultas duran 7 días hábiles, 3 en las abreviadas", () => {
    expect(duracionActividad("Formulación de consultas y observaciones", "licitacion_publica")).toBe(7);
    expect(
      duracionActividad("Formulación de consultas y observaciones", "licitacion_publica_abreviada"),
    ).toBe(3);
    // Sin procedimiento se asume el plazo general (el mayor), no el abreviado.
    expect(duracionActividad("Formulación de consultas y observaciones")).toBe(7);
  });

  it("Art. 82.1: el consentimiento es el plazo de apelación (Art. 304) + 1 día hábil", () => {
    expect(duracionActividad("Consentimiento de la buena pro", "licitacion_publica")).toBe(9);
    expect(duracionActividad("Consentimiento de la buena pro", "licitacion_publica_abreviada")).toBe(6);
    expect(duracionActividad("Consentimiento de la buena pro")).toBe(9);
  });

  it("con la cuantía de A5, el plazo de apelación se toma del umbral de 485 000 (y +1 por el Art. 82.1)", () => {
    // < 485 000 → apelación 5 → consentimiento 6.
    expect(duracionActividad("Consentimiento de la buena pro", "licitacion_publica", 400_000)).toBe(6);
    expect(duracionActividad("Consentimiento de la buena pro", undefined, 484_999)).toBe(6);
    // ≥ 485 000 → apelación 8 → consentimiento 9.
    expect(duracionActividad("Consentimiento de la buena pro", undefined, 485_000)).toBe(9);
    expect(duracionActividad("Consentimiento de la buena pro", undefined, 1_000_000)).toBe(9);
    // La CUANTÍA manda sobre el procedimiento: abreviada con cuantía alta → 9, no 6.
    expect(duracionActividad("Consentimiento de la buena pro", "licitacion_publica_abreviada", 485_000)).toBe(9);
  });

  it("absolución, integración, evaluación y otorgamiento duran un solo día (inicio = fin)", () => {
    for (const act of [
      "Absolución de consultas y observaciones",
      "Integración de las Bases",
      "Evaluación y calificación de ofertas",
      "Otorgamiento de la buena pro",
    ]) {
      expect(duracionActividad(act), act).toBe(1);
    }
  });

  it("usa 2 días por defecto si no encaja", () => {
    expect(duracionActividad("Algo no listado")).toBe(2);
    expect(duracionActividad("")).toBe(2);
  });
});

describe("calcularFechasCronograma", () => {
  const filas: ActividadCronograma[] = [
    { fase: "seleccion", actividad: "Convocatoria" },
    { fase: "seleccion", actividad: "Formulación de consultas y observaciones" },
    { fase: "seleccion", actividad: "Otorgamiento de la buena pro" },
  ];

  it("encadena inicio y fin de todas desde el ancla, en días hábiles", () => {
    const r = calcularFechasCronograma(filas, "2026-08-12"); // miércoles
    // Convención de horas (tipo SEACE): inicio 00:01 / fin 23:59.
    expect(r[0]).toMatchObject({ inicio: "2026-08-12T00:01", fin: "2026-08-12T23:59" }); // 1 día
    // 7 días hábiles (Art. 66.1): 13,14,17,18,19,20,21 — salta el fin de semana.
    expect(r[1]).toMatchObject({ inicio: "2026-08-13T00:01", fin: "2026-08-21T23:59" });
    expect(r[2]).toMatchObject({ inicio: "2026-08-24T00:01", fin: "2026-08-24T23:59" }); // 1 día
  });

  it("cada actividad empieza el día hábil siguiente al fin de la anterior", () => {
    const r = calcularFechasCronograma(filas, "2026-08-12");
    // fin de la 1ª = 08-12; inicio de la 2ª = 08-13.
    expect(fechaDe(r[1].inicio)).toBe("2026-08-13");
  });

  it("sin ancla válida no toca las filas", () => {
    expect(calcularFechasCronograma(filas, undefined)).toBe(filas);
    expect(calcularFechasCronograma(filas, "no-es-fecha")).toBe(filas);
  });

  it("no muta la entrada", () => {
    const original = [{ actividad: "Convocatoria" }];
    calcularFechasCronograma(original, "2026-08-12");
    expect(original[0]).not.toHaveProperty("inicio");
  });
});

describe("cronograma con feriados", () => {
  it("sumarDiasHabiles omite feriados además de fines de semana", () => {
    // Jueves 2026-07-30 + 1 día hábil, con 2026-07-31 (viernes) feriado → lunes 08-03.
    const feriados = new Set(["2026-07-31"]);
    expect(sumarDiasHabiles("2026-07-30", 1, feriados)).toBe("2026-08-03");
  });

  it("calcularFechasCronograma salta el feriado al encadenar", () => {
    const filas: ActividadCronograma[] = [
      { fase: "seleccion", actividad: "Convocatoria" }, // 1 día
      { fase: "seleccion", actividad: "Integración de bases" }, // 1 día
    ];
    // 28 y 29 de julio (Fiestas Patrias) son feriado; ancla martes 2026-07-28.
    const feriados = new Set(["2026-07-28", "2026-07-29"]);
    const r = calcularFechasCronograma(filas, "2026-07-28", feriados);
    // El ancla feriado se corre al primer hábil: jueves 2026-07-30.
    expect(r[0]).toMatchObject({ inicio: "2026-07-30T00:01", fin: "2026-07-30T23:59" });
    expect(r[1]).toMatchObject({ inicio: "2026-07-31T00:01", fin: "2026-07-31T23:59" });
  });
});

describe("plazos del Reglamento en el cronograma calculado", () => {
  // La secuencia real de un competitivo, que es donde muerden los plazos.
  const competitivo: ActividadCronograma[] = [
    { fase: "seleccion", actividad: "Convocatoria" },
    { fase: "seleccion", actividad: "Registro de participantes" },
    { fase: "seleccion", actividad: "Formulación de consultas y observaciones" },
    { fase: "seleccion", actividad: "Absolución de consultas y observaciones" },
    { fase: "seleccion", actividad: "Integración de bases" },
    { fase: "seleccion", actividad: "Presentación de ofertas" },
    { fase: "seleccion", actividad: "Evaluación y calificación de ofertas" },
    { fase: "seleccion", actividad: "Otorgamiento de la buena pro" },
    { fase: "seleccion", actividad: "Consentimiento de la buena pro" },
  ];

  it("Art. 64.1: deja al menos 22 días hábiles entre convocatoria y ofertas", () => {
    const r = calcularFechasCronograma(competitivo, "2026-08-12", new Set(), {
      procedimiento: "licitacion_publica",
    });
    const convocatoria = r[0].inicio!;
    const ofertas = r[5].inicio!;
    expect(diasHabilesEntre(convocatoria, ofertas, new Set())).toBeGreaterThanOrEqual(22);
    expect(validarCronograma(r, new Set(), "licitacion_publica")).toEqual([]);
  });

  it("Art. 64.1: el mínimo no se impone a las modalidades abreviadas", () => {
    const r = calcularFechasCronograma(competitivo, "2026-08-12", new Set(), {
      procedimiento: "licitacion_publica_abreviada",
    });
    // El encadenado natural va muy por debajo de 22 y así debe quedarse.
    expect(diasHabilesEntre(r[0].inicio!, r[5].inicio!, new Set())).toBeLessThan(22);
    expect(validarCronograma(r, new Set(), "licitacion_publica_abreviada")).toEqual([]);
  });

  it("Art. 68.1: ofertas queda a ≥ 3 días hábiles de la integración en las ABREVIADAS", () => {
    const r = calcularFechasCronograma(competitivo, "2026-08-12", new Set(), {
      procedimiento: "licitacion_publica_abreviada",
    });
    const iIntegr = r.findIndex((f) => /integraci/i.test(f.actividad ?? ""));
    const iOfertas = r.findIndex((f) => /presentaci[oó]n de ofertas/i.test(f.actividad ?? ""));
    expect(diasHabilesEntre(r[iIntegr].fin!, r[iOfertas].inicio!, new Set())).toBeGreaterThanOrEqual(3);
    expect(validarCronograma(r, new Set(), "licitacion_publica_abreviada")).toEqual([]);
  });

  it("Art. 68.1: en los PLENOS exige ≥ 7 días hábiles de la integración a las ofertas", () => {
    const r = calcularFechasCronograma(competitivo, "2026-08-12", new Set(), {
      procedimiento: "licitacion_publica",
    });
    const iIntegr = r.findIndex((f) => /integraci/i.test(f.actividad ?? ""));
    const iOfertas = r.findIndex((f) => /presentaci[oó]n de ofertas/i.test(f.actividad ?? ""));
    expect(diasHabilesEntre(r[iIntegr].fin!, r[iOfertas].inicio!, new Set())).toBeGreaterThanOrEqual(7);
  });

  it("Art. 65.2: el registro de participantes es un rango, no un paso de un día", () => {
    const r = calcularFechasCronograma(competitivo, "2026-08-12", new Set(), {
      procedimiento: "licitacion_publica",
    });
    const registro = r[1];
    // Desde el día hábil siguiente a la convocatoria...
    expect(fechaDe(registro.inicio)).toBe(sumarDiasHabiles(r[0].fin!, 1));
    // ...hasta el día hábil anterior a la presentación de ofertas.
    expect(registro.fin! < r[5].inicio!).toBe(true);
    // Y no desplaza a las actividades que van detrás: corre en paralelo.
    expect(r[2].inicio).toBe(registro.inicio);
  });

  it("avisa cuando una fecha editada a mano incumple el mínimo del Art. 64.1", () => {
    const aMano: ActividadCronograma[] = [
      { fase: "seleccion", actividad: "Convocatoria", inicio: "2026-08-12", fin: "2026-08-12" },
      { fase: "seleccion", actividad: "Presentación de ofertas", inicio: "2026-08-20", fin: "2026-08-20" },
    ];
    const avisos = validarCronograma(aMano, new Set(), "licitacion_publica");
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toContain("Art. 64.1");
  });
});

describe("calcularVencimiento (reutilizable: A5, vencimientos, etc.)", () => {
  it("días hábiles descuenta fines de semana y feriados", async () => {
    const { calcularVencimiento } = await import("@/lib/cronograma-fechas");
    // Miércoles 2026-07-22 + 5 hábiles, con 28 y 29 (Fiestas Patrias) feriado.
    const feriados = new Set(["2026-07-28", "2026-07-29"]);
    // 23(J),24(V),27(L),30(J),31(V) → salta 25/26 (finde) y 28/29 (feriado).
    expect(calcularVencimiento("2026-07-22", 5, { habiles: true, feriados })).toBe("2026-07-31");
  });

  it("días calendario suma corrido (cuentan sábados y domingos)", async () => {
    const { calcularVencimiento } = await import("@/lib/cronograma-fechas");
    expect(calcularVencimiento("2026-07-22", 5, { habiles: false })).toBe("2026-07-27");
  });

  it("sin fecha o días inválidos devuelve cadena vacía", async () => {
    const { calcularVencimiento } = await import("@/lib/cronograma-fechas");
    expect(calcularVencimiento(undefined, 5, { habiles: true })).toBe("");
    expect(calcularVencimiento("no-fecha", 5, { habiles: true })).toBe("");
  });
});

describe("ejecución contractual: SEGÚN BASES (sin fecha cierta)", () => {
  it("SEGÚN BASES solo en la actividad 'Ejecución contractual'; el resto encadena", () => {
    const filas: ActividadCronograma[] = [
      { fase: "seleccion", actividad: "Otorgamiento de la buena pro" }, // 1 día
      { fase: "ejecucion", actividad: "Suscripción del contrato" }, // sí lleva fecha
      { fase: "ejecucion", actividad: "Ejecución contractual" }, // SEGÚN BASES
    ];
    const r = calcularFechasCronograma(filas, "2026-08-12");
    expect(r[0]).toMatchObject({ inicio: "2026-08-12T00:01", fin: "2026-08-12T23:59" });
    // La suscripción del contrato SÍ recibe fecha (encadena tras la buena pro).
    expect(fechaDe(r[1].inicio)).toBe("2026-08-13");
    expect(r[1].inicio).not.toBe("SEGÚN BASES");
    // Solo la ejecución contractual va SEGÚN BASES.
    expect(r[2]).toMatchObject({ inicio: "SEGÚN BASES", fin: "SEGÚN BASES" });
  });
});

describe("cronograma con fecha + hora (convención tipo SEACE)", () => {
  it("la primera actividad conserva la hora del anclaje; el resto va 00:01 / 23:59", () => {
    const filas: ActividadCronograma[] = [
      { fase: "seleccion", actividad: "Convocatoria" },
      { fase: "seleccion", actividad: "Otorgamiento de la buena pro" },
    ];
    const r = calcularFechasCronograma(filas, "2026-08-12T08:30");
    expect(r[0].inicio).toBe("2026-08-12T08:30"); // la hora que puso la DEC en el anclaje
    expect(r[0].fin).toBe("2026-08-12T23:59");
    expect(r[1].inicio).toBe("2026-08-13T00:01");
    expect(r[1].fin).toBe("2026-08-13T23:59");
  });

  it("un anclaje con hora sigue respetando los feriados en el encadenado", () => {
    const filas: ActividadCronograma[] = [
      { fase: "seleccion", actividad: "Convocatoria" },
      { fase: "seleccion", actividad: "Integración de las Bases" },
    ];
    const feriados = new Set(["2026-07-31"]); // viernes feriado
    const r = calcularFechasCronograma(filas, "2026-07-30T09:00", feriados);
    expect(r[0].inicio).toBe("2026-07-30T09:00");
    // La 2ª empieza el día hábil siguiente saltando el feriado (31) y el finde → lunes 03.
    expect(fechaDe(r[1].inicio)).toBe("2026-08-03");
    expect((r[1].inicio ?? "").endsWith("T00:01")).toBe(true);
  });
})

// o) Las etapas de la fase de selección deben ser EXACTAMENTE las de la columna
// "Etapas" del Reglamento (Arts. 93/94/95), más el hito que la norma fecha
// (presentación de ofertas). Termina en el otorgamiento de la buena pro. RAG-verificado.
describe("etapas del cronograma según el procedimiento (Art. 46.1.o)", () => {
  it("competitivos: registro + consultas y observaciones y absolución e integración por separado, sin las filas sueltas del formato viejo", async () => {
    const { actividadesSeleccionDe } = await import("@/lib/estrategia-formato");
    const lp = actividadesSeleccionDe("licitacion_publica");
    expect(lp).toContain("Registro de participantes");
    expect(lp).toContain("Consultas y observaciones");
    expect(lp).toContain("Absolución e integración");
    expect(lp).toContain("Evaluación y calificación de ofertas");
    // La fase de selección termina en el otorgamiento (el consentimiento es ejecución).
    expect(lp[lp.length - 1]).toBe("Otorgamiento de la buena pro");
    expect(lp).not.toContain("Consultas, observaciones e integración");
    expect(lp).not.toContain("Absolución de consultas y observaciones");
    expect(lp).not.toContain("Integración de las Bases");
  });

  it("subasta inversa: sin consultas ni fila de registro (Art. 95 + directiva SIE), con lances", async () => {
    const { actividadesSeleccionDe } = await import("@/lib/estrategia-formato");
    const s = actividadesSeleccionDe("subasta_inversa_electronica");
    // El registro va IMPLÍCITO en la ventana de 6 días hábiles: no se lista como fila.
    expect(s.some((a) => /registro de participantes/i.test(a))).toBe(false);
    expect(s.some((a) => /consultas/i.test(a))).toBe(false);
    expect(s.some((a) => /lances|puja/i.test(a))).toBe(true);
  });

  it("comparación de precios: sin registro de participantes ni consultas (Art. 95)", async () => {
    const { actividadesSeleccionDe } = await import("@/lib/estrategia-formato");
    const c = actividadesSeleccionDe("comparacion_precios");
    expect(c.some((a) => /registro de participantes/i.test(a))).toBe(false);
    expect(c.some((a) => /consultas/i.test(a))).toBe(false);
  });

  it("al fechar una licitación pública: el registro es un rango entre convocatoria y ofertas, y se cumplen los 22 hábiles (Art. 64.1/65.2)", async () => {
    const { construirCronogramaInicial } = await import("@/lib/estrategia-formato");
    const base = construirCronogramaInicial("licitacion_publica", 30, "calendario");
    const fechado = calcularFechasCronograma(base, "2026-08-12", new Set(), { procedimiento: "licitacion_publica" });
    const conv = fechado.find((f) => /^Convocatoria/.test(f.actividad ?? ""));
    const reg = fechado.find((f) => /Registro de participantes/.test(f.actividad ?? ""));
    const ofertas = fechado.find((f) => /Presentación de ofertas/.test(f.actividad ?? ""));
    // El registro quedó fechado como rango, entre la convocatoria y las ofertas.
    expect(fechaDe(reg?.inicio)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(fechaDe(reg?.inicio) > fechaDe(conv?.inicio)).toBe(true);
    expect(fechaDe(reg?.fin) < fechaDe(ofertas?.inicio)).toBe(true);
    // Art. 64.1: no menos de 22 días hábiles entre convocatoria y ofertas.
    expect(diasHabilesEntre(fechaDe(conv?.inicio), fechaDe(ofertas?.inicio))).toBeGreaterThanOrEqual(22);
  });
})

// En la subasta inversa el registro NO es una fila: va implícito en la ventana
// convocatoria→ofertas, que la directiva de Perú Compras / bases estándar fijan en
// un mínimo de 6 días hábiles. `MIN_HABILES_CONVOCATORIA_OFERTAS[subasta]` lo impone.
describe("subasta inversa: mínimo de 6 días hábiles convocatoria→ofertas, sin fila de registro", () => {
  it("subasta: las ofertas quedan al menos 6 días hábiles después de la convocatoria", async () => {
    const { construirCronogramaInicial } = await import("@/lib/estrategia-formato");
    const base = construirCronogramaInicial("subasta_inversa_electronica", 15, "calendario");
    const fechado = calcularFechasCronograma(base, "2026-08-24", new Set(), {
      procedimiento: "subasta_inversa_electronica",
    });
    const conv = fechado.find((f) => /^Convocatoria/.test(f.actividad ?? ""));
    const ofertas = fechado.find((f) => /Presentación de ofertas/.test(f.actividad ?? ""));
    // No hay fila de registro de participantes en la subasta.
    expect(fechado.some((f) => /registro de participantes/i.test(f.actividad ?? ""))).toBe(false);
    // Y entre convocatoria y ofertas median al menos 6 días hábiles.
    expect(diasHabilesEntre(fechaDe(conv?.inicio), fechaDe(ofertas?.inicio))).toBeGreaterThanOrEqual(6);
  });
})
