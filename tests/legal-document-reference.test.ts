import { expect, it } from "vitest";
import { documentReferences, matchesDocumentReference, followupSearchQuestion } from "@/lib/legal-document-reference";
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
