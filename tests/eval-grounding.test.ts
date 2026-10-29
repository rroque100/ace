import { describe, expect, it } from "vitest";
import { allowsPreviousRegime, detectGroundingViolations, groundingTexts } from "@/lib/eval-grounding";

describe("citar el régimen anterior: falla en una pregunta común, correcto cuando la pregunta trata de él", () => {
  const respuesta = "Para un procedimiento convocado antes de abril de 2025 se aplica la Ley 30225 [F1], según la DCT-4 [F2].";

  it("preguntas que exigen nombrar la Ley 30225 (caso real: la respuesta correcta a «convoqué en 2024» suspendía)", () => {
    for (const pregunta of [
      "Mi procedimiento se convocó en 2024, ¿qué ley le corresponde?",
      "Se convocó el 3 de marzo de 2025: ¿rige la Ley 30225 o la 32069?",
      "¿Qué cambió entre la Ley 30225 y la Ley 32069 en garantías?",
      "¿La Ley 30225 sigue vigente?",
      "Mi procedimiento se convocó en junio de 2026, ¿puedo aplicar la Ley 30225?",
      "¿Desde cuándo rige la Ley 32069 y qué pasa con lo iniciado antes?",
    ]) {
      expect(allowsPreviousRegime(pregunta), pregunta).toBe(true);
      expect(detectGroundingViolations(respuesta, 3, [], pregunta), pregunta).toEqual([]);
    }
  });

  it("en una pregunta común sigue siendo una falla de grounding", () => {
    for (const pregunta of [
      "¿Qué garantía se exige para el fiel cumplimiento?",
      "¿Qué pasa si el contratista se atrasa en la entrega?",
      "Cuál es el monto máximo exacto en UIT para usar comparación de precios",
      "¿Qué ley regula las contrataciones públicas y cuál es su reglamento vigente?",
    ]) {
      expect(allowsPreviousRegime(pregunta), pregunta).toBe(false);
      const fallas = detectGroundingViolations(respuesta, 3, [], pregunta);
      expect(fallas.some((falla) => /30225/.test(falla)), pregunta).toBe(true);
    }
    // Sin pregunta se conserva el comportamiento estricto de siempre.
    expect(detectGroundingViolations(respuesta, 3, []).some((falla) => /30225/.test(falla))).toBe(true);
  });

  it("aunque la pregunta trate del régimen anterior, los términos vetados y las citas inexistentes siguen fallando", () => {
    const pregunta = "Mi procedimiento se convocó en 2024, ¿qué ley le corresponde?";
    expect(detectGroundingViolations(respuesta + " Además aplica la 344-2018.", 3, ["344-2018"], pregunta).some((f) => /vetado/.test(f))).toBe(true);
    expect(detectGroundingViolations("Se aplica la Ley 30225 [F9].", 3, [], pregunta).some((f) => /fuera de rango/.test(f))).toBe(true);
    expect(detectGroundingViolations("Se aplica la Ley 30225 [F1].", 3, [], pregunta)).toEqual([]);
  });

  it("una respuesta sin mención al régimen anterior no falla en ningún caso", () => {
    for (const pregunta of ["¿Qué garantía se exige?", "¿La Ley 30225 sigue vigente?"]) {
      expect(detectGroundingViolations("La garantía de fiel cumplimiento es del 10 % [F1].", 2, [], pregunta)).toEqual([]);
    }
  });
});

describe("una mención al régimen anterior que respaldan las fuentes recuperadas no es una alucinación", () => {
  const pregunta = "¿Qué ley regula las contrataciones públicas y cuál es su reglamento vigente?";
  const respuesta = "El Reglamento 009-2025-EF deroga el D.S. 344-2018-EF, Reglamento de la Ley 30225, Ley de Contrataciones del Estado [F7].";
  const disposicion = "Deróguese el Decreto Supremo N.° 344-2018-EF, Reglamento de la Ley N.° 30225, Ley de Contrataciones del Estado.";

  it("caso real del banco de regresión: lo dice la Disposición Derogatoria y la regla antigua lo suspendía", () => {
    expect(detectGroundingViolations(respuesta, 7, [], pregunta, ["texto sin relación", disposicion])).toEqual([]);
  });
  it("si ninguna fuente lo menciona, sigue siendo una falla", () => {
    const fallas = detectGroundingViolations(respuesta, 7, [], pregunta, ["texto sin relación"]);
    expect(fallas.some((f) => /30225/.test(f))).toBe(true);
    expect(fallas.some((f) => /344-2018/.test(f))).toBe(true);
    expect(detectGroundingViolations(respuesta, 7, [], pregunta)).not.toEqual([]);
  });
  it("lo que la pregunta veta expresamente falla aunque una fuente lo contenga", () => {
    expect(detectGroundingViolations(respuesta, 7, ["344-2018"], pregunta, [disposicion]).some((f) => /vetado/.test(f))).toBe(true);
  });
});

describe("el régimen que el chat le muestra al modelo respalda su mención (caso real: «impedimentos» citaba el D.Leg. 1444 como contexto)", () => {
  it("el D.Leg. 1444 lleva el régimen «Ley 30225» aunque su fragmento no repita el número", () => {
    const textos = groundingTexts([{ excerpt: "Están impedidos de ser participantes…", documentType: "ley", documentNumber: "1444", documentTitle: "Decreto Legislativo N.° 1444" }]);
    expect(textos[0]).toContain("Ley 30225");
    const respuesta = "Los Decretos Legislativos 1444 y 1341 modificaron la Ley N.° 30225 y también establecían impedimentos [F3].";
    expect(detectGroundingViolations(respuesta, 4, [], "¿Quiénes están impedidos de ser contratistas del Estado?", textos)).toEqual([]);
  });
  it("una fuente del régimen vigente no respalda una mención a la Ley 30225", () => {
    const textos = groundingTexts([{ excerpt: "Impedimentos para contratar", documentType: "ley", documentNumber: "32069", documentTitle: "Ley N.° 32069" }]);
    expect(textos[0]).not.toContain("Ley 30225");
    expect(detectGroundingViolations("Rige la Ley 30225 [F1].", 1, [], "¿Quiénes están impedidos?", textos).some((f) => /30225/.test(f))).toBe(true);
  });
});
