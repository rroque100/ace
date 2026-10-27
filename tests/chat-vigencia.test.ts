import { describe, expect, it } from "vitest";
import {
  detectValidityTarget,
  pickValidityEvidence,
  validityInstruction,
  validityRetrievalQueries,
} from "../lib/chat-vigencia";
import { hasConfirmedValidity, reconcileAssessment } from "../lib/chat-signals";
import { isRegimeComparison, selectCoherentEvidence } from "../lib/chat-evidence-audit";

describe("detección de preguntas de vigencia de una norma", () => {
  const SI: Array<[string, string[]]> = [
    ["¿La Ley 30225 sigue vigente?", ["30225"]],
    ["¿Está vigente la Ley N.° 30225?", ["30225"]],
    ["¿Sigue vigente la Ley Nº 30225, Ley de Contrataciones del Estado?", ["30225"]],
    ["¿Qué norma deroga la Ley 30225?", ["30225"]],
    ["¿El D.S. 344-2018-EF fue derogado?", ["344-2018-ef"]],
    ["¿Sigue vigente el Decreto Supremo 344-2018-EF?", ["344-2018-ef"]],
    ["¿Fue reemplazado el Decreto Legislativo 1341?", ["1341"]],
    ["¿La Ley 30225 ya no se aplica?", ["30225"]],
    ["¿Se derogó la Ley 30225 y la Ley 27444?", ["30225", "27444"]],
    // Sin número: se reconoce por el nombre con que se conoce la norma en el corpus.
    ["¿Sigue vigente la Ley de Contrataciones del Estado?", ["30225"]],
    ["¿Qué deroga la Ley General de Contrataciones Públicas?", ["32069"]],
  ];
  const NO = [
    "¿Cuál es el plazo de vigencia de la garantía de fiel cumplimiento?",
    "¿Qué dice el artículo 50 de la Ley 30225 sobre infracciones?",
    "¿Qué contratos vigentes se rigen por la Ley 30225?",
    "¿Cuánto dura la vigencia de la oferta?",
    "¿Sigue vigente el contrato?",
    "¿Qué porcentaje es la garantía según el Reglamento?",
    "Quién deroga",
    "",
  ];

  it("reconoce la intención y la norma concreta", () => {
    for (const [pregunta, numeros] of SI) {
      expect(detectValidityTarget(pregunta)?.norms.map((n) => n.number), pregunta).toEqual(numeros);
    }
  });

  it("no se activa con vigencias de contratos, ofertas o garantías, ni sin norma concreta", () => {
    for (const pregunta of NO) expect(detectValidityTarget(pregunta), pregunta).toBeNull();
  });

  it("etiqueta la norma como se nombra en las consultas", () => {
    expect(detectValidityTarget("¿Sigue vigente la Ley N.° 30225?")!.norms[0].label).toBe("Ley 30225");
    expect(detectValidityTarget("¿Está derogado el D.S. 344-2018-EF?")!.norms[0].label).toBe("Decreto Supremo 344-2018-EF");
    expect(detectValidityTarget("¿Sigue vigente el D. Leg. 1341?")!.norms[0].label).toBe("Decreto Legislativo 1341");
  });

  it("como mucho dos normas", () => {
    expect(detectValidityTarget("¿Siguen vigentes la Ley 30225, la Ley 27444 y la Ley 28411?")!.norms).toHaveLength(2);
  });
});

describe("consultas dirigidas", () => {
  it("una a la derogatoria y otra a las transitorias, nombrando la norma", () => {
    const [derogatoria, transitorias, ...resto] = validityRetrievalQueries([{ label: "Ley 30225", number: "30225" }]);
    expect(resto).toEqual([]);
    expect(derogatoria).toMatch(/Derogatorias/);
    expect(transitorias).toMatch(/Transitorias/);
    for (const consulta of [derogatoria, transitorias]) expect(consulta).toContain("Ley 30225");
    expect(validityRetrievalQueries([])).toEqual([]);
  });
});

describe("selección de las disposiciones que sí hablan de la norma", () => {
  const norms = [{ label: "Ley 30225", number: "30225" }];
  const fuente = (chunkId: string, article: string | null, excerpt: string, over: Record<string, string> = {}) => ({
    article, chunkId, excerpt, documentNumber: "32069", documentType: "ley", ...over,
  });
  const DEROGA = "Disposición Complementaria Derogatoria Única. Derógase la Ley N.° 30225, Ley de Contrataciones del Estado.";

  it("descarta lo que no es una disposición o no nombra la norma preguntada", () => {
    const elegidas = pickValidityEvidence([
      fuente("a", "50", "Artículo 50. Infracciones. La Ley 30225 establece sanciones."),
      fuente("b", "DCD-1", "Disposición Complementaria Derogatoria Única. Derógase la Ley 27444."),
      fuente("c", "DCD-1", DEROGA),
    ], norms);
    expect(elegidas.map((s) => s.chunkId)).toEqual(["c"]);
  });

  it("ordena derogatoria, transitoria, final y modificatoria; y ley antes que reglamento", () => {
    const base = "menciona la Ley 30225.";
    const elegidas = pickValidityEvidence([
      fuente("final", "DCF-10", `Disposición final ${base}`),
      fuente("modif", "DCM-1", `Disposición modificatoria ${base}`),
      fuente("reg", "DCD-1", `Derogatoria del reglamento ${base}`, { documentType: "reglamento", documentNumber: "009-2025-EF" }),
      fuente("trans", "DCT-2", `Disposición transitoria ${base}`),
      fuente("ley", "DCD-1", `Derogatoria de la ley ${base}`),
    ], norms);
    expect(elegidas.map((s) => s.chunkId)).toEqual(["ley", "reg", "trans", "final"]);
  });

  it("las copias oficial y SPIJ de la misma disposición cuentan una vez", () => {
    const elegidas = pickValidityEvidence([fuente("oficial", "DCD-1", DEROGA), fuente("spij", "DCD-1", DEROGA)], norms);
    expect(elegidas).toHaveLength(1);
  });

  it("reconoce el número aunque la copia SPIJ lo escriba con espacios («344 - 2018 - EF»)", () => {
    const ds = [{ label: "Decreto Supremo 344-2018-EF", number: "344-2018-ef" }];
    const elegidas = pickValidityEvidence([fuente("x", "DCD-1", "Derogar el Decreto Supremo Nº 344 - 2018 - EF, Reglamento.")], ds);
    expect(elegidas).toHaveLength(1);
  });

  it("respeta el máximo", () => {
    const muchas = Array.from({ length: 9 }, (_, i) => fuente(`c${i}`, `DCT-${i + 1}`, "norma 30225", { documentNumber: String(i) }));
    expect(pickValidityEvidence(muchas, norms, 3)).toHaveLength(3);
  });
});

describe("instrucción al generador", () => {
  it("nombra la norma y prohíbe inferir la vigencia de que el texto exista", () => {
    const texto = validityInstruction([{ label: "Ley 30225", number: "30225" }]);
    expect(texto).toContain("Ley 30225");
    expect(texto).toMatch(/derogatorias, transitorias y finales/);
    expect(texto).toMatch(/No afirmes que una norma sigue vigente/);
  });
});

describe("el resto del chat trata estas preguntas como lo que son", () => {
  it("una pregunta de vigencia es una comparación de regímenes: no se descarta una familia", () => {
    expect(isRegimeComparison("¿La Ley 30225 sigue vigente?")).toBe(true);
    expect(isRegimeComparison("¿Cuál es el plazo de vigencia de la garantía?")).toBe(false);

    const fuentes = [
      { documentTitle: "Ley N.° 30225", excerpt: "Artículo 2. Principios", article: "2" },
      { documentTitle: "Ley N.° 32069", excerpt: "Derógase la Ley 30225", article: "DCD-1" },
    ];
    expect(selectCoherentEvidence(fuentes, "¿La Ley 30225 sigue vigente?")).toHaveLength(2);
    // Fuera de la vigencia se conserva el comportamiento: una sola familia.
    expect(selectCoherentEvidence(fuentes, "¿Qué principios rigen?")).toHaveLength(1);
  });

  it("la derogatoria que nombra la norma confirma su suerte aunque el registro diga «desconocida»", () => {
    const registro = { vigencia: "desconocida", documentNumber: "32069" };
    const derogatoria = { ...registro, article: "DCD-1", excerpt: "Derógase la Ley N.° 30225, Ley de Contrataciones." };
    const pregunta = "¿La Ley 30225 sigue vigente?";
    expect(hasConfirmedValidity([registro], pregunta)).toBe(false);
    expect(hasConfirmedValidity([derogatoria], pregunta)).toBe(true);
    // No vale para otra norma ni para una disposición que no la nombra.
    expect(hasConfirmedValidity([{ ...derogatoria, excerpt: "Derógase la Ley 27444." }], pregunta)).toBe(false);
    expect(hasConfirmedValidity([{ ...derogatoria, article: "DCF-3" }], pregunta)).toBe(false);
  });

  it("con la derogatoria recuperada ya no se añade «la vigencia no se puede confirmar»", () => {
    const evaluacion = { confidence: "media" as const, reason: "ok", evidenceWarnings: [] as string[] };
    const sin = reconcileAssessment(evaluacion, { question: "¿La Ley 30225 sigue vigente?", sources: [{ vigencia: "desconocida", documentNumber: "32069" }] });
    expect(sin.confidence).toBe("baja");
    const con = reconcileAssessment(evaluacion, {
      question: "¿La Ley 30225 sigue vigente?",
      sources: [{ vigencia: "desconocida", documentNumber: "32069", article: "DCD-1", excerpt: "Derógase la Ley 30225." }],
    });
    expect(con.confidence).toBe("media");
    expect(con.evidenceWarnings).toEqual([]);
  });
});
