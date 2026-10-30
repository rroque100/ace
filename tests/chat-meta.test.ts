import { describe, expect, it } from "vitest";
import { isMetaQuestion, metaQuestionAnswer } from "@/lib/chat-meta";
import { isVagueQuestion } from "@/lib/chat-vague";
import { esRespuestaFija, MODELO_ACLARACION, MODELO_GUIA } from "@/lib/chat-respuesta-fija";

describe("preguntas sobre el propio asistente", () => {
  it("se reconocen las que piden saber qué hace o cómo se usa (caso real: «que sabes hacer?»)", () => {
    for (const pregunta of [
      "que sabes hacer?", "¿Qué sabes hacer?", "Qué puedes hacer", "¿Qué haces?", "¿Quién eres?", "¿Para qué sirves?", "¿Cómo funcionas?",
      "¿Cómo te uso?", "¿Cómo puedo usarte?", "¿Cómo me puedes ayudar?", "¿En qué me puedes ayudar?", "¿Qué tipo de preguntas puedo hacer?",
      "¿Qué es ACE?", "hola", "Hola!", "Buenas tardes", "Buenos días", "hola, ¿qué puedes hacer?",
    ]) expect(isMetaQuestion(pregunta), pregunta).toBe(true);
  });

  it("una pregunta con tema propio es una pregunta de verdad, aunque empiece como una de estas", () => {
    for (const pregunta of [
      "¿Cómo funciona la subasta inversa electrónica?", "¿Qué puedes hacer si el contratista no cumple?", "¿Cómo se usa la garantía de fiel cumplimiento?",
      "hola, ¿qué plazo hay para subsanar observaciones?", "¿Qué sabes de la penalidad por mora?", "¿Para qué sirve el expediente de contratación?",
      "¿Cómo funciona el arbitraje en contrataciones?", "¿Qué es un contrato?", "Ley 32069", "artículo 120 del reglamento",
    ]) expect(isMetaQuestion(pregunta), pregunta).toBe(false);
  });

  it("un texto largo nunca es una pregunta sobre el asistente: trae contenido", () => {
    expect(isMetaQuestion("hola " + "tengo un caso con un contrato de servicios ".repeat(4))).toBe(false);
    expect(isMetaQuestion("")).toBe(false);
    expect(isMetaQuestion("   ")).toBe(false);
  });

  it("saludar ya no cae en el pedido de aclaración: el chat lo atiende antes con la guía", () => {
    // La guarda de preguntas vagas sigue reconociendo el saludo (su función no cambia); lo que cambia es que el chat evalúa
    // primero esta, así que quien saluda recibe qué puede hacer en lugar de «necesito más contexto».
    expect(isVagueQuestion("hola")).toBe(true);
    expect(isMetaQuestion("hola")).toBe(true);
  });

  it("la guía dice qué cubre, da ejemplos como preguntas y no afirma nada jurídico ni cita fuentes", () => {
    const guia = metaQuestionAnswer();
    for (const parte of ["Soy el asistente jurídico de ACE", "Ley 32069", "Puedes preguntarme", "qué se contrata", "cuándo se convocó", "Añadir datos del caso", "Búsqueda documental"]) {
      expect(guia, parte).toContain(parte);
    }
    // Los ejemplos son preguntas: ninguno afirma un plazo, un porcentaje o un artículo.
    expect(guia).not.toMatch(/\[F\d+\]|artículo \d|\d+ ?%|\d+ días/i);
    // Promete no inventar, que es lo que distingue a este asistente.
    expect(guia).toMatch(/en lugar de inventar/);
  });

  it("servidor y pantalla coinciden en qué son respuestas fijas", () => {
    expect(esRespuestaFija(MODELO_ACLARACION)).toBe(true);
    expect(esRespuestaFija(MODELO_GUIA)).toBe(true);
    for (const modelo of ["gpt-4o", "glm-4.5-flash", "gemini-2.5-flash", "", null, undefined]) expect(esRespuestaFija(modelo), String(modelo)).toBe(false);
  });
});
