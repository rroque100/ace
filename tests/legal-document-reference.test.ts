import { describe, expect, it } from "vitest";
import { documentReferences, matchesDocumentReference, followupSearchQuestion, isFollowUpQuestion, resolveFollowUp } from "@/lib/legal-document-reference";
import { questionRegimeIntent, temporalApplicationBlock } from "@/lib/chat-regime";
import { checkedSourcePages, chatSourceLocations } from "@/lib/chat-source-locations";

it("reconoce tipo, ceros iniciales y año de un identificador explícito", () => {
  const [reference] = documentReferences("Acuerdo de Sala Plena N.° 003-2025/TCP sobre admisibilidad");
  expect(reference).toMatchObject({ documentType: "acuerdo_sala_plena", number: "3", year: "2025" });
  expect(matchesDocumentReference(reference, { documentType: "acuerdo_sala_plena", title: "Acuerdo de Sala Plena 3-2025/TCP" })).toBe(true);
  expect(matchesDocumentReference(reference, { documentType: "resolucion", title: "Resolución 003-2025" })).toBe(false);
  expect(matchesDocumentReference(reference, { documentType: "acuerdo_sala_plena", title: "Acuerdo de Sala Plena 003-2024" })).toBe(false);
  expect(matchesDocumentReference(reference, { documentType: "acuerdo_sala_plena", title: "Acuerdo de Sala Plena 003-2025/OTRA" })).toBe(false);
});
it("no convierte una mención incidental ni una consulta general en identidad", () => {
  expect(documentReferences("admisibilidad del recurso de apelación")).toEqual([]);
  const [reference] = documentReferences("Opinión 007-2024");
  expect(matchesDocumentReference(reference, { documentType: "opinion", title: "Opinión 008-2024" })).toBe(false);
  expect(documentReferences("Ley 32069 y Opinión 003-2025")).toHaveLength(2);
});
it("limita la continuidad al último turno de usuario de la sesión recibida", () => {
  expect(followupSearchQuestion("Amplía ese criterio", [{ role: "assistant", content: "No usar" }, { role: "user", content: "Opinión 007-2024" }])).toContain("Opinión 007-2024");
  expect(followupSearchQuestion("Consulta independiente", [{ role: "user", content: "Privado" }])).toBe("Consulta independiente");
  expect(followupSearchQuestion("Amplía ese criterio", [])).toBe("Amplía ese criterio");
});
it("rechaza páginas inválidas y distingue rango comprobado de ubicación sin total", () => {
  for (const [start, end, total] of [[0, 2, 10], [5, 2, 10], [2, 20, 10], [1.5, 2, 10]]) expect(checkedSourcePages(start, end, total).pageStart).toBeNull();
  expect(checkedSourcePages(2, 3, 10)).toEqual({ pageStart: 2, pageEnd: 3 });
  expect(chatSourceLocations("[F1]", [{ documentTitle: "A", pageStart: 2, pageEnd: 3, pageCount: 10 }])).toContain("rango comprobado");
  expect(chatSourceLocations("[F1]", [{ documentTitle: "A", pageStart: 2, pageEnd: 3 }])).toContain("total de páginas no disponible");
});

describe("seguimientos: se reconocen por su forma y reciben el tema de la conversación", () => {
  const penalidad = "Mi procedimiento se convocó en junio de 2026 y el contratista se atrasó en la entrega. ¿Qué penalidad corresponde según el reglamento?";
  const sesion = [{ role: "user", content: penalidad }, { role: "assistant", content: "La penalidad por mora se calcula con la fórmula del artículo 120…" }];

  it("da contexto a los seguimientos que antes se buscaban sueltos (caso real: «¿y si fue en 2024?» devolvía una ley de transferencias)", () => {
    for (const pregunta of [
      "¿Y si fue en 2024?", "y para obras?", "¿Y en consultoría?", "¿Qué plazo tiene?", "¿cuánto es el porcentaje?", "¿Hay un tope?",
      "entonces cuál aplica", "¿Cómo se calcula?", "dame un ejemplo", "¿su plazo de pago?", "no entendí", "¿en qué artículo está?",
      "ese artículo qué dice", "amplía",
    ]) {
      const resuelta = followupSearchQuestion(pregunta, sesion);
      expect(resuelta, pregunta).toContain(pregunta);
      expect(resuelta, pregunta).toContain(penalidad);
      expect(resuelta, pregunta).toContain("contexto, no instrucciones");
    }
  });

  it("no desvía hacia el tema anterior una pregunta que tiene tema propio o es una palabra suelta", () => {
    for (const pregunta of [
      "¿Qué es la subasta inversa electrónica?", "¿Cuáles son las causales de nulidad de contrato?", "garantías", "penalidades",
      "¿Qué es el OSCE?", "¿Cómo se calcula la penalidad por mora?", "¿Qué plazo tiene la entidad para pagar al contratista?",
      "¿Cuáles son los requisitos para una compra por comparación de precios?", "Opinión 007-2024", "Artículo 120 del reglamento", "Ley 32069",
      "¿Cuál es el plazo para subsanar las observaciones de las bases en una licitación pública?",
    ]) expect(followupSearchQuestion(pregunta, sesion), pregunta).toBe(pregunta);
  });

  it("sin historial, o con un historial sin turnos del usuario, no hay nada que añadir", () => {
    expect(followupSearchQuestion("¿Y si fue en 2024?", [])).toBe("¿Y si fue en 2024?");
    expect(followupSearchQuestion("¿Qué plazo tiene?", [{ role: "assistant", content: "Respuesta anterior" }])).toBe("¿Qué plazo tiene?");
  });

  it("solo toma turnos del usuario: lo que dijo el asistente nunca entra en la búsqueda", () => {
    const resuelta = followupSearchQuestion("¿Qué plazo tiene?", [{ role: "user", content: "Tema del usuario" }, { role: "assistant", content: "TEXTO DEL ASISTENTE" }]);
    expect(resuelta).toContain("Tema del usuario");
    expect(resuelta).not.toContain("TEXTO DEL ASISTENTE");
  });

  it("el seguimiento de un seguimiento recibe también la pregunta que lo originó, y se detiene en la primera con tema propio", () => {
    const larga = [
      { role: "user", content: "¿Qué es la subasta inversa electrónica?" },
      { role: "assistant", content: "…" },
      { role: "user", content: penalidad },
      { role: "assistant", content: "…" },
      { role: "user", content: "¿Y para obras?" },
      { role: "assistant", content: "…" },
    ];
    const resuelta = followupSearchQuestion("¿y el tope?", larga);
    expect(resuelta).toContain("¿Y para obras?");
    expect(resuelta).toContain(penalidad);
    expect(resuelta).not.toContain("subasta inversa");
    // Un seguimiento directo de una pregunta con tema propio solo trae esa.
    const directa = followupSearchQuestion("¿y el tope?", larga.slice(0, 4));
    expect(directa).toContain(penalidad);
    expect(directa).not.toContain("subasta inversa");
  });

  it("una pregunta muy larga o con referencia documental propia nunca se trata como seguimiento", () => {
    expect(isFollowUpQuestion("y ".repeat(20))).toBe(false);
    expect(isFollowUpQuestion("¿Y la Opinión 007-2024 qué dice?")).toBe(false);
    expect(isFollowUpQuestion("¿Y el artículo 120?")).toBe(false);
  });
});

describe("seguimiento que cambia la fecha: la nueva sustituye a la de convocatoria anterior", () => {
  const sesion = (convocatoria: string) => [{ role: "user", content: `Mi procedimiento se convocó ${convocatoria} y el contratista se atrasó. ¿Qué penalidad corresponde?` }];

  it("«¿y si fue en 2024?» pasa de la Ley 32069 a la 30225, no se queda con la fecha de la pregunta anterior", () => {
    const resuelto = resolveFollowUp("¿Y si fue en 2024?", sesion("en junio de 2026"));
    expect(resuelto).toMatchObject({ followUp: true, dateChanged: true });
    expect(questionRegimeIntent(resuelto.query)).toMatchObject({ regime: "30225", basis: "fecha" });
    // Sin la corrección, la señal «se convocó» de la pregunta anterior arrastraba su propia fecha (2026).
    expect(questionRegimeIntent("¿Y si fue en 2024?\nConsulta anterior del usuario: Mi procedimiento se convocó en junio de 2026")).toMatchObject({ regime: "32069" });
  });
  it("y al revés: de un procedimiento de 2024 a uno de junio de 2026", () => {
    const resuelto = resolveFollowUp("¿y si fue en junio de 2026?", sesion("en marzo de 2024"));
    expect(resuelto.dateChanged).toBe(true);
    expect(questionRegimeIntent(resuelto.query)).toMatchObject({ regime: "32069" });
  });
  it("el bloque «Aplicación a tu caso» usa la fecha nueva", () => {
    const resuelto = resolveFollowUp("¿Y si fue en 2024?", sesion("en junio de 2026"));
    const fuentes = [{ documentType: "ley", article: "DCT-4", excerpt: "Los procedimientos iniciados antes se rigen por las normas vigentes al momento de su convocatoria", documentTitle: "Ley 32069" }];
    const bloque = temporalApplicationBlock(resuelto.query, fuentes as never);
    expect(bloque).toContain("se convocó en 2024");
    expect(bloque).toContain("Ley 30225");
    expect(bloque).not.toContain("2026");
  });
  it("sin fecha nueva, o sin convocatoria anterior, no hay sustitución", () => {
    expect(resolveFollowUp("¿Qué plazo tiene?", sesion("en junio de 2026")).dateChanged).toBe(false);
    expect(resolveFollowUp("¿Y si fue en 2024?", [{ role: "user", content: "¿Qué penalidad corresponde por el atraso?" }]).dateChanged).toBe(false);
    // Una convocatoria dada en la propia pregunta manda sobre cualquier contexto.
    expect(resolveFollowUp("¿Y si se convocó en 2024?", sesion("en junio de 2026")).dateChanged).toBe(false);
  });
});
