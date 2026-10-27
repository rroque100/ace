import { describe, expect, it } from "vitest";
import { legalCenterHref, legalValidity, legalSearchEmptyState } from "@/lib/legal-center";
import { NAVEGACION } from "@/lib/navegacion";

describe("navegación del Centro Jurídico", () => {
  it("agrupa solo las tres herramientas y mantiene Archivo accesible fuera del grupo", () => {
    const center = NAVEGACION.find((section) => section.label === "Centro Jurídico");
    expect(center?.items.map((item) => item.href)).toEqual(["/chat", "/busqueda", "/normas"]);
    expect(NAVEGACION.some((section) => section.label !== "Centro Jurídico" && section.items.some((item) => item.href === "/archivo"))).toBe(true);
    const ids = NAVEGACION.flatMap((section) => section.items.map((item) => item.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("conserva rutas y filtros documentales sin trasladar datos del caso", () => {
    expect(legalCenterHref("chat")).toBe("/chat");
    const url = legalCenterHref("normas", { documentId: "abc", documentType: "opinion", year: 2026, question: "privado", facts: "privado", sessionId: "privado", q: "privado", regime: "privado" });
    expect(url).toBe("/normas?documentType=opinion&documentId=abc&year=2026");
    expect(url).not.toContain("privado");
  });
  it("omite valores vacíos y codifica parámetros sin convertirlos en instrucciones", () => {
    expect(legalCenterHref("busqueda", { sourceEntity: "OECE & DGA", year: "", article: null })).toBe("/busqueda?sourceEntity=OECE+%26+DGA");
  });
});
describe("vigencia registrada", () => {
  it.each([null, "", "desconocida", "no_determinado", "por confirmar", "vigente por confirmar"])("no presenta %s como vigente", (value) => {
    expect(legalValidity(value).state).toBe("unknown");
    expect(legalValidity(value).tone).not.toBe("ok");
  });
  it.each(["no vigente", "no_vigente", "derogada", "sin vigencia"])("reconoce %s antes de vigente", (value) => {
    expect(legalValidity(value).state).toBe("not_current");
  });
  it("separa vigencia registrada de revisión pendiente", () => {
    expect(legalValidity("vigente").state).toBe("current");
    expect(legalValidity("vigente", "revision_pendiente").state).toBe("unknown");
    expect(legalValidity("modificada").state).toBe("unknown");
    expect(legalValidity(null, "indexed").state).toBe("unknown");
  });
});

it("no presenta fallos ni búsquedas pendientes como ausencia de evidencia", () => {
  expect(legalSearchEmptyState(true, "", false).title).toBe("Buscando fuentes…");
  expect(legalSearchEmptyState(false, "Error", true).title).toBe("La búsqueda no se completó");
  expect(legalSearchEmptyState(false, "", true).title).toBe("Sin coincidencias con esta consulta");
  expect(legalSearchEmptyState(false, "", false).title).toBe("Listo para buscar");
});
