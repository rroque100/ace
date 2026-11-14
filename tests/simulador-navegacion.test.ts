import { expect, it } from "vitest";
import { leerNavegacion, urlNavegacion, resumirBanco, resumirBalotarios } from "@/lib/simulador-navegacion";

it("conserva enlaces antiguos a práctica, examen e historial", () => {
  expect(leerNavegacion(new URLSearchParams())).toEqual({ seccion: "balotarios", modo: "practicar" });
  expect(leerNavegacion(new URLSearchParams("vista=examen"))).toEqual({ seccion: "balotarios", modo: "examen" });
  expect(leerNavegacion(new URLSearchParams("vista=resultados"))).toEqual({ seccion: "historial", modo: "practicar" });
  expect(leerNavegacion(new URLSearchParams("attempt=abc&vista=resultados"))).toEqual({ seccion: "banco", modo: "practicar", attempt: "abc" });
});

it("cada sección tiene enlace propio y limpia intentos ajenos a su contenido", () => {
  const nav = { seccion: "banco" as const, modo: "examen" as const, attempt: "abc" };
  const url = urlNavegacion(new URL("https://ace.test/simulador?otro=1&vista=examen#q=3"), nav);
  expect(leerNavegacion(url.searchParams)).toEqual({ ...nav, modo: "practicar" });
  expect(url.hash).toBe("");
  expect(url.searchParams.get("otro")).toBe("1");
  const history = urlNavegacion(url, { ...nav, seccion: "historial" });
  expect(history.searchParams.has("attempt")).toBe(false);
  expect(leerNavegacion(history.searchParams).seccion).toBe("historial");
  expect(leerNavegacion(new URLSearchParams("seccion=balotarios&attempt=antiguo")).seccion).toBe("balotarios");
});

it("un valor desconocido vuelve a balotarios sin perder los enlaces válidos", () => {
  expect(leerNavegacion(new URLSearchParams("seccion=otro&vista=examen"))).toEqual({ seccion: "balotarios", modo: "examen" });
});

it("las publicadas con fuentes no elegibles siguen pendientes; las retiradas se separan", () => {
  expect(resumirBanco([{ published: 7 }, { published: 4 }], 100, 3)).toEqual({ total: 103, reviewed: 11, pending: 89, retired: 3 });
  expect(() => resumirBanco([{ published: 11 }], 10, 0)).toThrow();
  expect(() => resumirBanco([], null, 0)).toThrow();
});

it("cuenta las revisiones registradas de cada balotario, sin asumir que importar es revisar", () => {
  expect(resumirBalotarios([{ balotario: 1, preguntas: [{ revisada: true }, { revisada: false }] }, { balotario: 2, preguntas: [{ revisada: false }] }])).toEqual({ total: 3, reviewed: 1, pending: 2 });
});
