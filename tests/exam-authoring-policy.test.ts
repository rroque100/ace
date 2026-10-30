import { it, expect } from "vitest";
import { topicFocus, nearDuplicate } from "../lib/exam-authoring-policy";
it("no confunde planes institucionales con PAC o CMN", () => {
  expect(
    topicFocus("1.6", "Plan Multianual de Homologación de un ministerio"),
  ).toBe(0);
  expect(
    topicFocus("1.5", "Plan Anual de Supervisión y Asistencia Técnica"),
  ).toBe(0);
  expect(
    topicFocus("1.6", "inclusión de contrataciones en el PAC del CMN"),
  ).toBeGreaterThan(0);
  expect(topicFocus("1.5", "capacidades institucionales")).toBe(0);
});
it("no acepta profesionalización genérica como tipos de evaluador", () => {
  expect(
    topicFocus(
      "1.3",
      "estrategia nacional de profesionalización de compradores públicos",
    ),
  ).toBe(0);
  expect(topicFocus("1.3", "perfil de un oficial de compra")).toBeGreaterThan(
    0,
  );
});
it("detecta una repetición con prefijo hipotético", () => {
  expect(
    nearDuplicate(
      "Un Ministerio ha elaborado su Plan Multianual de Homologación. ¿Qué horizonte de tiempo debe abarcar este plan y qué metas debe fijar?",
      "En un caso hipotético, un Ministerio ha elaborado su Plan Multianual de Homologación. ¿Qué horizonte de tiempo debe abarcar este plan y qué metas debe fijar?",
    ),
  ).toBe(true);
});

it("no confunde hechos cuantitativos distintos con una paráfrasis", () => {
  const a =
    "Caso hipotético: una entidad registra una entrega después de 10 días. ¿Qué información debe comprobar el responsable para decidir sobre la actuación pendiente?";
  expect(nearDuplicate(a, a.replace("10 días", "20 días"))).toBe(false);
  expect(
    nearDuplicate(
      "¿Cuál actuación es correcta para completar la revisión del documento en este caso?",
      "¿Cuál actuación NO es correcta para completar la revisión del documento en este caso?",
    ),
  ).toBe(false);
});

it("conserva diferencias decimales en los hechos del caso", () => {
  const a =
    "Caso hipotético: el caso menciona un importe de 0,5 UIT para una actuación pendiente. ¿Qué información debe comprobar el responsable antes de decidir?";
  expect(nearDuplicate(a, a.replace("0,5 UIT", "10,5 UIT"))).toBe(false);
  expect(nearDuplicate(a, a.replace("0,5 UIT", "0.5 UIT"))).toBe(true);
});
