import { describe, expect, it } from "vitest";
import {
  hasConfirmedValidity,
  hasMissingCritical,
  isValidityQuestion,
  materialWarnings,
  reconcileAssessment,
  type SignalAssessment,
} from "../lib/chat-signals";

const SUFICIENTES = "Fuentes suficientes: hay evidencia documental trazable y coincidencia semantica/lexical util.";
const FALTA_REGLAMENTO = "Faltan fuentes criticas del procedimiento: Reglamento vigente.";
const BASES = "Se excluyeron bases integradas porque son esquemas de implementacion y no fundamento normativo de respuesta.";

const evaluacion = (over: Partial<SignalAssessment> = {}): SignalAssessment => ({
  confidence: "media",
  reason: SUFICIENTES,
  evidenceWarnings: [],
  ...over,
});

describe("fuentes críticas ausentes", () => {
  it("la garantía de fiel cumplimiento (caso real): sin Reglamento ya no es «media/suficientes»", () => {
    const out = reconcileAssessment(
      evaluacion({ evidenceWarnings: [FALTA_REGLAMENTO, BASES] }),
      { question: "¿Qué porcentaje del monto del contrato original debe tener la garantía de fiel cumplimiento?", sources: [{ vigencia: "vigente" }] },
    );
    expect(out.confidence).toBe("baja");
    expect(out.reason).not.toContain("Fuentes suficientes");
    expect(out.reason).toContain("Faltan fuentes criticas");
  });

  it("reconoce la advertencia con y sin tilde", () => {
    expect(hasMissingCritical(["Faltan fuentes criticas del procedimiento: Reglamento."])).toBe(true);
    expect(hasMissingCritical(["Faltan fuentes críticas del procedimiento: Reglamento."])).toBe(true);
    expect(hasMissingCritical([BASES, "La similitud semantica no es fuerte."])).toBe(false);
  });

  it("sin esa advertencia no toca la evaluación", () => {
    const entrada = evaluacion({ evidenceWarnings: [BASES] });
    const out = reconcileAssessment(entrada, { question: "¿Cuál es el tope del adelanto directo?", sources: [{ vigencia: "vigente" }] });
    expect(out).toEqual(entrada);
  });
});

describe("preguntas de vigencia", () => {
  const PREGUNTAS = [
    "¿Sigue vigente la Ley 30225, Ley de Contrataciones del Estado?",
    "¿Fue derogada la Directiva 004-2025-OECE-CD?",
    "¿Cuál es la vigencia del Reglamento?",
    "¿Está en vigor el artículo 61?",
  ];
  const NO_SON = [
    "¿Qué porcentaje del monto debe tener la garantía de fiel cumplimiento?",
    "¿Cuál es el plazo mínimo para presentar ofertas en una comparación de precios?",
    "Explica el principio de irretroactividad",
  ];

  it("detecta las preguntas sobre si una norma sigue en pie", () => {
    for (const q of PREGUNTAS) expect(isValidityQuestion(q), q).toBe(true);
    for (const q of NO_SON) expect(isValidityQuestion(q), q).toBe(false);
  });

  it("la Ley 30225 con vigencia «desconocida» (caso real) ya no sale con confianza «alta»", () => {
    const out = reconcileAssessment(evaluacion({ confidence: "alta" }), {
      question: PREGUNTAS[0],
      sources: [{ vigencia: "desconocida" }, { vigencia: "desconocida" }],
    });
    expect(out.confidence).toBe("baja");
    expect(out.evidenceWarnings.join(" ")).toContain("La vigencia no se puede confirmar");
  });

  it("si una fuente declara la vigencia, la confianza se respeta", () => {
    for (const vigencia of ["vigente", "derogado", "derogada"]) {
      const out = reconcileAssessment(evaluacion({ confidence: "alta" }), {
        question: PREGUNTAS[0],
        sources: [{ vigencia, documentNumber: "30225" }],
      });
      expect(out.confidence, vigencia).toBe("alta");
    }
    expect(hasConfirmedValidity([{ vigencia: null }, { vigencia: "desconocida" }, {}])).toBe(false);
  });

  it("la vigencia de OTRA norma no confirma la preguntada (caso real: el Reglamento «vigente» y la Ley 30225)", () => {
    const fuentes = [
      { vigencia: "vigente", documentNumber: "009-2025-EF" },
      { vigencia: "desconocida", documentNumber: "30225" },
    ];
    const out = reconcileAssessment(evaluacion({ confidence: "alta" }), { question: PREGUNTAS[0], sources: fuentes });
    expect(out.confidence).toBe("baja");
    // Pero sí confirma la suya.
    const propia = reconcileAssessment(evaluacion({ confidence: "alta" }), {
      question: "¿Sigue vigente la Ley 32069?",
      sources: [{ vigencia: "vigente", documentNumber: "32069" }, ...fuentes],
    });
    expect(propia.confidence).toBe("alta");
    expect(hasConfirmedValidity(fuentes, "¿Sigue vigente la Ley 30225?")).toBe(false);
    expect(hasConfirmedValidity(fuentes, "¿Sigue vigente el reglamento?")).toBe(true);
  });

  it("no duplica el aviso si se reconcilia dos veces", () => {
    const una = reconcileAssessment(evaluacion(), { question: PREGUNTAS[0], sources: [] });
    const dos = reconcileAssessment(una, { question: PREGUNTAS[0], sources: [] });
    expect(dos.evidenceWarnings.filter((w) => w.startsWith("La vigencia no se puede"))).toHaveLength(1);
  });
});

describe("solo corrige hacia abajo", () => {
  it("nunca sube la confianza ni muta la evaluación original", () => {
    const entrada = evaluacion({ confidence: "baja", evidenceWarnings: [BASES] });
    const copia = JSON.parse(JSON.stringify(entrada));
    const out = reconcileAssessment(entrada, { question: "¿Sigue vigente la Ley 32069?", sources: [{ vigencia: "vigente" }] });
    expect(out.confidence).toBe("baja");
    expect(entrada).toEqual(copia);
  });
});

describe("advertencias que se muestran en la tarjeta", () => {
  it("solo las que cambian cómo usar la respuesta, con tope", () => {
    const todas = [
      "La similitud semantica no es fuerte.",
      FALTA_REGLAMENTO,
      BASES,
      "Recuperación parcial: una de las vías de búsqueda no estuvo disponible.",
      "Existen fuentes marcadas como derogadas, modificadas o no plenamente vigentes; revisar vigencia antes de usar la respuesta.",
      "La vigencia no se puede confirmar con las fuentes recuperadas: el registro la marca como desconocida o no la declara.",
    ];
    const vistas = materialWarnings(todas);
    expect(vistas).toHaveLength(3);
    expect(vistas[0]).toBe(FALTA_REGLAMENTO);
    expect(vistas.join(" ")).not.toContain("similitud");
    expect(vistas.join(" ")).not.toContain("bases integradas");
    expect(materialWarnings(undefined)).toEqual([]);
  });
});
