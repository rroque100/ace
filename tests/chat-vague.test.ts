import { describe, expect, it } from "vitest";
import { isVagueQuestion, vagueQuestionAnswer } from "@/lib/chat-vague";

describe("preguntas que piden ayuda sin decir sobre qué", () => {
  it("se piden aclaraciones en vez de dar un ensayo genérico (caso real: «los contratos son aquellos celebrados entre…»)", () => {
    for (const pregunta of [
      "no sé qué hacer con mi contrato", "necesito ayuda con una compra", "Necesito ayuda", "ayuda", "¿Qué hago?", "hola", "Buenas tardes",
      "tengo un problema con mi contrato", "tengo una duda", "quiero saber algo sobre mi proceso", "no sé por dónde empezar", "¿Me pueden ayudar con una consulta?",
      "Hola, tengo una consulta",
    ]) expect(isVagueQuestion(pregunta), pregunta).toBe(true);
  });

  it("una pregunta con tema propio se contesta aunque pida ayuda", () => {
    for (const pregunta of [
      "necesito ayuda con la penalidad por mora", "no sé cómo calcular la garantía de fiel cumplimiento", "¿Qué hago si el contratista no cumple?",
      "tengo un problema con el contratista: no entregó a tiempo", "hola, ¿qué plazo hay para subsanar observaciones?", "quiero saber qué es la subasta inversa",
      "necesito saber los requisitos de una licitación pública", "¿Qué hago si me piden una ampliación de plazo?",
    ]) expect(isVagueQuestion(pregunta), pregunta).toBe(false);
  });

  it("las preguntas directas o definitorias no son vagas, por amplias que sean", () => {
    for (const pregunta of [
      "¿Qué es un contrato?", "garantías", "¿Qué es una compra pública?", "Ley 32069", "¿Cuáles son los requisitos para una compra por comparación de precios?",
      "Opinión 007-2024", "artículo 120 del reglamento", "¿Cuál es el plazo de pago?",
    ]) expect(isVagueQuestion(pregunta), pregunta).toBe(false);
  });

  it("un texto largo nunca es vago: trae contenido", () => {
    expect(isVagueQuestion("necesito ayuda " + "con mi caso ".repeat(8))).toBe(false);
  });

  it("la respuesta pide lo mínimo y no afirma nada jurídico ni cita normas", () => {
    const respuesta = vagueQuestionAnswer();
    expect(respuesta).toContain("Qué quieres resolver");
    expect(respuesta).toContain("Cuándo se convocó");
    expect(respuesta).toContain("Añadir datos del caso");
    // Es una respuesta fija: ninguna cita de fuente ni artículo.
    expect(respuesta).not.toMatch(/\[F\d+\]|artículo \d|Ley \d{4,5}/);
  });
});
