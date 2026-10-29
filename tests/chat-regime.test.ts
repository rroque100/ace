import { describe, expect, it } from "vitest";
import {
  LEY_32069_VIGENCIA,
  comparisonInstruction,
  extractConvocatoria,
  extractDates,
  isRegimeComparison,
  isTemporalApplicabilityQuestion,
  pickTemporalEvidence,
  questionRegimeIntent,
  regimeForDate,
  regimeRankAdjustment,
  sourceRegime,
  temporalApplicationBlock,
  temporalInstruction,
  temporalRetrievalQueries,
} from "../lib/chat-regime";

const day = (iso: string) => ({ iso, precision: "dia" as const, raw: iso });
const month = (iso: string) => ({ iso, precision: "mes" as const, raw: iso });
const year = (iso: string) => ({ iso, precision: "anio" as const, raw: iso });

describe("fechas en la pregunta (caso real: «junio de 2026» no se reconocía y el chat la volvía a pedir)", () => {
  const CASOS: Array<[string, string, string]> = [
    ["se convocó el 15 de marzo de 2025", "2025-03-15", "dia"],
    ["convocado el 3 de septiembre del 2026", "2026-09-03", "dia"],
    ["se convocó en junio de 2026", "2026-06-01", "mes"],
    ["convocatoria de marzo del 2025", "2025-03-01", "mes"],
    ["se convocó el 22/04/2025", "2025-04-22", "dia"],
    ["convocatoria 05-11-2024", "2024-11-05", "dia"],
    ["se convocó en 2026", "2026-01-01", "anio"],
    ["durante el año 2024", "2024-01-01", "anio"],
    ["publicado en setiembre 2025", "2025-09-01", "mes"],
  ];
  it("las reconoce con su precisión", () => {
    for (const [texto, iso, precision] of CASOS) {
      const [fecha] = extractDates(texto);
      expect(fecha, texto).toBeDefined();
      expect([fecha.iso, fecha.precision], texto).toEqual([iso, precision]);
    }
  });

  it("el número de una norma no es una fecha", () => {
    for (const texto of ["según el Decreto Supremo 009-2025-EF", "Ley 32069 y la Directiva 001-2025-OECE-CD", "la Resolución 3857-2025-TCP-S1"]) {
      expect(extractDates(texto), texto).toEqual([]);
    }
  });
});

describe("régimen según la fecha de convocatoria (vigencia: 22 de abril de 2025)", () => {
  it("la fecha de corte es la verificada en el corpus", () => expect(LEY_32069_VIGENCIA).toBe("2025-04-22"));

  it("fecha exacta: el día anterior es la ley antigua; el día de la vigencia, la nueva", () => {
    expect(regimeForDate(day("2025-04-21"))).toBe("30225");
    expect(regimeForDate(day("2025-04-22"))).toBe("32069");
    expect(regimeForDate(day("2026-06-10"))).toBe("32069");
    expect(regimeForDate(day("2019-01-01"))).toBe("30225");
  });
  it("solo mes y año: decide salvo el mes que contiene el corte", () => {
    expect(regimeForDate(month("2025-03-01"))).toBe("30225");
    expect(regimeForDate(month("2025-05-01"))).toBe("32069");
    expect(regimeForDate(month("2025-04-01"))).toBeNull();
    expect(regimeForDate(month("2026-06-01"))).toBe("32069");
  });
  it("solo el año: 2025 no alcanza para decidir", () => {
    expect(regimeForDate(year("2024-01-01"))).toBe("30225");
    expect(regimeForDate(year("2025-01-01"))).toBeNull();
    expect(regimeForDate(year("2026-01-01"))).toBe("32069");
  });
});

describe("fecha de convocatoria dentro de la pregunta", () => {
  it("toma la fecha pegada a la señal de convocatoria", () => {
    expect(extractConvocatoria("Mi procedimiento de selección se convocó en junio de 2026. ¿Puedo aplicar la Ley 30225?")?.iso).toBe("2026-06-01");
    expect(extractConvocatoria("La convocatoria fue el 3 de marzo de 2025 y el contrato se firmó el 10 de julio de 2025")?.iso).toBe("2025-03-03");
  });
  it("una fecha sin señal de convocatoria (p. ej. de suscripción) no cuenta como tal", () => {
    expect(extractConvocatoria("Firmé el contrato en junio de 2026, ¿qué ley aplica?")).toBeNull();
    expect(extractConvocatoria("¿Qué ley aplica?")).toBeNull();
  });
});

describe("qué régimen pide la pregunta", () => {
  const intent = (q: string) => questionRegimeIntent(q);

  it("las tres preguntas que fallaron en producción", () => {
    const temporal = intent("Mi procedimiento de selección se convocó en junio de 2026. ¿Puedo aplicar la Ley 30225?");
    expect([temporal.regime, temporal.basis, temporal.ambiguous]).toEqual(["32069", "fecha", false]);
    const comparacion = intent("¿Qué cambió entre la Ley 30225 y la Ley 32069 en las garantías de fiel cumplimiento?");
    expect([comparacion.regime, comparacion.basis]).toEqual(["ambos", "comparacion"]);
    const vigencia = intent("¿La Ley 30225 sigue vigente?");
    expect(vigencia.regime).toBe("ambos");
  });

  it("sin pista de régimen: lo vigente; con una ley nombrada para consultar su contenido: esa ley", () => {
    expect(intent("¿Qué plazo tiene la entidad para pagar al contratista?").regime).toBeNull();
    expect(intent("¿Qué dice el artículo 50 de la Ley 30225 sobre infracciones?").regime).toBe("30225");
    expect(intent("¿Qué dice el artículo 113 del Reglamento de la Ley 32069?").regime).toBe("32069");
  });

  it("fecha ambigua (2025 o abril de 2025): no sesga y lo marca", () => {
    for (const q of ["Se convocó en 2025, ¿qué ley aplica?", "El procedimiento se convocó en abril de 2025"]) {
      const i = intent(q);
      expect([i.regime, i.ambiguous], q).toEqual(["ambos", true]);
    }
  });
});

describe("preguntas de aplicación en el tiempo y de comparación", () => {
  it("aplicación en el tiempo", () => {
    for (const q of [
      "Mi procedimiento de selección se convocó en junio de 2026. ¿Puedo aplicar la Ley 30225?",
      "¿Qué ley se aplica a un procedimiento convocado en 2024?",
      "¿Desde cuándo rige la Ley 32069?",
      "¿Todavía se aplica la Ley 30225 a mi contrato?",
      "¿Qué norma corresponde a mi proceso?",
    ]) expect(isTemporalApplicabilityQuestion(q), q).toBe(true);
  });

  it("no lo es: preguntas de contenido, de vigencia pura o de comparación", () => {
    for (const q of [
      "¿Qué porcentaje debe tener la garantía de fiel cumplimiento?",
      "¿La Ley 30225 sigue vigente?",
      "¿Qué cambió entre la Ley 30225 y la Ley 32069 en garantías?",
      "¿Cuál es el plazo de vigencia de la garantía?",
    ]) expect(isTemporalApplicabilityQuestion(q), q).toBe(false);
  });

  it("comparación de regímenes, con «cambió» (que antes no se reconocía) y sin números de ley", () => {
    for (const q of [
      "¿Qué cambió entre la Ley 30225 y la Ley 32069 en las garantías de fiel cumplimiento?",
      "Diferencias entre la ley anterior y la nueva ley sobre penalidades",
      "Compara las garantías de la Ley 32069 con las del régimen anterior",
      "¿Qué novedades trae la Ley 32069 respecto a la 30225?",
    ]) expect(isRegimeComparison(q), q).toBe(true);
  });

  it("no toda pregunta con «nuevo» o «cambió» es una comparación de regímenes", () => {
    for (const q of [
      "¿Qué dice la nueva ley sobre garantías?",
      "¿Qué cambió en el plazo de pago?",
      "¿Cuáles son las novedades del SEACE?",
    ]) expect(isRegimeComparison(q), q).toBe(false);
  });
});

describe("a qué régimen pertenece una fuente", () => {
  const src = (documentType: string, documentNumber: string | null, documentTitle = "", extra: object = {}) => ({ documentType, documentNumber, documentTitle, ...extra });

  it("leyes, reglamentos y decretos de cada régimen", () => {
    expect(sourceRegime(src("ley", "32069", "Ley general de contrataciones publicas"))).toBe("32069");
    expect(sourceRegime(src("reglamento", "009-2025-EF", "Reglamento de la Ley N.° 32069"))).toBe("32069");
    expect(sourceRegime(src("ley", "30225", "Ley N.° 30225"))).toBe("30225");
    expect(sourceRegime(src("ley", "1341", "Decreto Legislativo N.° 1341"))).toBe("30225");
    expect(sourceRegime(src("ley", "1444", "Decreto Legislativo N.° 1444"))).toBe("30225");
    expect(sourceRegime(src("reglamento", "344-2018-EF", "Decreto Supremo N.° 344-2018-EF"))).toBe("30225");
    expect(sourceRegime(src("ley", "082-2019-EF", "Decreto Supremo N.° 082-2019-EF"))).toBe("30225");
  });
  it("otras leyes no se clasifican por error", () => {
    expect(sourceRegime(src("ley", "32187", "Ley N.° 32187"))).toBeNull();
    expect(sourceRegime(src("ley", "27444", "Ley general de procedimiento administrativo"))).toBeNull();
  });
  it("directivas: por emisor y época; criterios: solo si son anteriores a la vigencia", () => {
    expect(sourceRegime(src("directiva", "001-2025-OECE-CD", "Directiva N.° 001-2025-OECE-CD"))).toBe("32069");
    expect(sourceRegime(src("directiva", "004-2019-OSCE-CD"))).toBe("30225");
    expect(sourceRegime(src("opinion", "004-2014/DTN", "Opinión N° 004-2014/DTN"))).toBe("30225");
    expect(sourceRegime(src("resolucion", "1234-2021-TCE-S2", "Resolución N.° 1234-2021-TCE-S2"))).toBe("30225");
    // Una opinión de 2026 del OECE puede tratar un procedimiento de cualquiera de los dos regímenes.
    expect(sourceRegime(src("opinion", "D000099-2026-OECE-DTN", "Opinión N.° D000099-2026-OECE-DTN"))).toBeNull();
    expect(sourceRegime(src("pronunciamiento", "320-2026/OECE-DSAT", "Pronunciamiento N° 320-2026/OECE-DSAT"))).toBeNull();
  });
  it("manda el régimen revisado por una persona", () => {
    expect(sourceRegime(src("opinion", "D000099-2026-OECE-DTN", "", { regime: "30225" }))).toBe("30225");
  });
});

describe("ajuste de puntaje", () => {
  const intent = (regime: "32069" | "30225" | "ambos" | null) => ({ regime, basis: "actual" as const, convocatoria: null, ambiguous: false });
  it("lo del régimen pedido sube y lo del otro baja bastante más de lo que sube", () => {
    expect(regimeRankAdjustment(intent("32069"), "32069")).toBeGreaterThan(0);
    expect(regimeRankAdjustment(intent("32069"), "30225")).toBeLessThan(-0.1);
    expect(regimeRankAdjustment(intent("30225"), "30225")).toBeGreaterThan(0);
  });
  it("sin pista, lo vigente primero; en comparación o sin clasificar, nada", () => {
    expect(regimeRankAdjustment(intent(null), "32069")).toBeGreaterThan(0);
    expect(regimeRankAdjustment(intent(null), "30225")).toBeLessThan(0);
    expect(regimeRankAdjustment(intent("ambos"), "30225")).toBe(0);
    expect(regimeRankAdjustment(intent("32069"), null)).toBe(0);
  });
});

describe("evidencia de la regla de transición", () => {
  const fuente = (chunkId: string, documentType: string, article: string | null, excerpt: string) => ({ chunkId, documentType, article, excerpt });
  it("elige la regla, la vigencia de la ley y la fecha dicha por una fuente, en ese orden", () => {
    const elegidas = pickTemporalEvidence([
      fuente("a", "opinion", null, "…entró en vigencia el 22 de abril de 2025…"),
      fuente("b", "ley", "50", "Artículo 50. Infracciones"),
      fuente("c", "ley", "DCF-29", "Vigencia de la ley. La presente norma entra en vigor a los noventa días…"),
      fuente("d", "ley", "DCT-4", "Aplicación de la norma en el tiempo. Los procedimientos iniciados antes de la vigencia…"),
    ]);
    expect(elegidas.map((s) => s.chunkId)).toEqual(["d", "c", "a"]);
  });
  it("las copias de la misma disposición cuentan una vez", () => {
    const igual = "Aplicación de la norma en el tiempo. Los procedimientos iniciados antes de la vigencia";
    expect(pickTemporalEvidence([fuente("x", "ley", "DCT-4", igual), fuente("y", "ley", "DCT-4", igual)])).toHaveLength(1);
  });
});

describe("instrucciones al generador", () => {
  it("temporal: concluye primero, nombra la regla y distingue convocatoria de suscripción", () => {
    const i = questionRegimeIntent("Mi procedimiento se convocó en junio de 2026. ¿Puedo aplicar la Ley 30225?");
    const texto = temporalInstruction(i);
    expect(texto).toContain("Ley 32069");
    expect(texto).toMatch(/conclusión directa/);
    expect(texto).toMatch(/Transitoria Cuarta/);
    expect(texto).toMatch(/CONVOCATORIA/);
    expect(texto).toContain("22 de abril de 2025");
  });
  it("temporal sin fecha o con fecha ambigua: pide la fecha exacta en vez de decidir", () => {
    expect(temporalInstruction(questionRegimeIntent("¿Qué ley aplica a mi proceso?"))).toMatch(/pídela/);
    expect(temporalInstruction(questionRegimeIntent("Se convocó en 2025, ¿qué ley aplica?"))).toMatch(/pide la fecha exacta/);
  });
  it("comparación: tabla con cita en cada celda y sin inventar", () => {
    const texto = comparisonInstruction();
    expect(texto).toMatch(/Aspecto \| Ley 30225 \| Ley 32069/);
    expect(texto).toMatch(/no consta en las fuentes recuperadas/);
  });
  it("las consultas dirigidas nombran la regla y la fecha de vigencia", () => {
    const [regla, fecha] = temporalRetrievalQueries();
    expect(regla).toMatch(/convocatoria/);
    expect(fecha).toContain("22 de abril de 2025");
  });
});

describe("conclusión directa calculada en código", () => {
  const regla = { documentType: "ley", article: "DCT-4", excerpt: "Aplicación de la norma en el tiempo. Los procedimientos de selección iniciados antes de la vigencia de la presente ley se rigen por las normas vigentes al momento de su convocatoria." };
  const otra = { documentType: "ley", article: "50", excerpt: "Artículo 50. Infracciones" };
  const fecha = { documentType: "acuerdo_sala_plena", article: null, excerpt: "El 22 de abril de 2025 entraron en vigencia las disposiciones de la Ley N° 32069" };
  const Q = "Mi procedimiento de selección se convocó en junio de 2026. ¿Puedo aplicar la Ley 30225?";

  it("convocatoria posterior a la vigencia: corresponde la Ley 32069 y cita la regla por su posición [F#]", () => {
    const bloque = temporalApplicationBlock(Q, [otra, regla])!;
    expect(bloque).toContain("**Aplicación a tu caso**");
    expect(bloque).toContain("junio de 2026");
    expect(bloque).toContain("**Ley 32069**");
    expect(bloque).toContain("[F2]");
    expect(bloque).toMatch(/fecha de convocatoria, no por la del contrato/);
  });
  it("convocatoria anterior: corresponde la Ley 30225", () => {
    const bloque = temporalApplicationBlock("El procedimiento se convocó el 3 de marzo de 2025. ¿Qué ley se aplica?", [regla])!;
    expect(bloque).toContain("**Ley 30225**");
    expect(bloque).toMatch(/anterior/);
  });
  it("nombra la fecha de vigencia solo si una fuente recuperada la dice", () => {
    expect(temporalApplicationBlock(Q, [regla])).not.toContain("22 de abril de 2025");
    const conFecha = temporalApplicationBlock(Q, [regla, fecha])!;
    expect(conFecha).toContain("22 de abril de 2025");
    expect(conFecha).toContain("[F2]");
  });
  it("no emite nada sin la regla recuperada, sin fecha de convocatoria o con fecha ambigua", () => {
    expect(temporalApplicationBlock(Q, [otra])).toBeNull();
    expect(temporalApplicationBlock("¿Qué ley aplica a mi proceso?", [regla])).toBeNull();
    expect(temporalApplicationBlock("Se convocó en 2025, ¿qué ley aplica?", [regla])).toBeNull();
    expect(temporalApplicationBlock("¿Qué porcentaje es la garantía?", [regla])).toBeNull();
  });
});
