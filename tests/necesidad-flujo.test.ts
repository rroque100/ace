import { describe, expect, it } from "vitest";
import { construirPasosFlujo, hitosEstadoDesdeAuditoria, ramaFlujo } from "@/lib/necesidad-flujo";

const estadoDe = (pasos: ReturnType<typeof construirPasosFlujo>, state: string) =>
  pasos.find((p) => p.state === state)?.estado;

describe("hitosEstadoDesdeAuditoria · primera vez que se alcanzó cada estado", () => {
  it("mapea create→borrador y cada transición a su estado destino", () => {
    const hitos = hitosEstadoDesdeAuditoria([
      { action: "necesidad.create", created_at: "2026-07-01T10:00:00Z" },
      { action: "necesidad.remitir", created_at: "2026-07-02T10:00:00Z" },
      { action: "necesidad.iniciar_revision", created_at: "2026-07-03T10:00:00Z" },
    ]);
    expect(hitos.borrador).toBe("2026-07-01T10:00:00Z");
    expect(hitos.remitido_dec).toBe("2026-07-02T10:00:00Z");
    expect(hitos.en_revision_dec).toBe("2026-07-03T10:00:00Z");
  });

  it("conserva la PRIMERA fecha cuando un estado se alcanza más de una vez", () => {
    const hitos = hitosEstadoDesdeAuditoria([
      { action: "necesidad.remitir", created_at: "2026-07-02T10:00:00Z" },
      { action: "necesidad.remitir", created_at: "2026-07-09T10:00:00Z" }, // reenvío tras observación
    ]);
    expect(hitos.remitido_dec).toBe("2026-07-02T10:00:00Z");
  });
});

describe("construirPasosFlujo · estado de cada hito", () => {
  it("un borrador nuevo: borrador es el actual, el resto pendiente", () => {
    const pasos = construirPasosFlujo("borrador", "2026-07-01T10:00:00Z", {});
    expect(estadoDe(pasos, "borrador")).toBe("current");
    expect(estadoDe(pasos, "remitido_dec")).toBe("pending");
    expect(pasos.find((p) => p.state === "borrador")?.fecha).toBe("2026-07-01T10:00:00Z");
  });

  it("en revisión: los previos hechos, revisión actual, los siguientes pendientes", () => {
    const hitos = { borrador: "a", remitido_dec: "b", en_revision_dec: "c" };
    const pasos = construirPasosFlujo("en_revision_dec", "a", hitos);
    expect(estadoDe(pasos, "borrador")).toBe("done");
    expect(estadoDe(pasos, "remitido_dec")).toBe("done");
    expect(estadoDe(pasos, "en_revision_dec")).toBe("current");
    expect(estadoDe(pasos, "conforme")).toBe("pending");
  });

  it("observada: se ancla en «En revisión» como actual, con su rama", () => {
    const hitos = { borrador: "a", remitido_dec: "b", en_revision_dec: "c", observado: "d" };
    const pasos = construirPasosFlujo("observado", "a", hitos);
    expect(estadoDe(pasos, "en_revision_dec")).toBe("current");
    expect(ramaFlujo("observado")?.tipo).toBe("observado");
  });

  it("conforme: todo lo anterior hecho, conforme actual", () => {
    const hitos = { borrador: "a", remitido_dec: "b", en_revision_dec: "c", conforme: "e" };
    const pasos = construirPasosFlujo("conforme", "a", hitos);
    expect(estadoDe(pasos, "en_revision_dec")).toBe("done");
    expect(estadoDe(pasos, "conforme")).toBe("current");
    expect(estadoDe(pasos, "incorporado_cmn")).toBe("pending");
  });

  it("anulada: ningún hito es actual; los alcanzados quedan hechos; hay rama de término", () => {
    const hitos = { borrador: "a", remitido_dec: "b" };
    const pasos = construirPasosFlujo("anulada", "a", hitos);
    expect(pasos.some((p) => p.estado === "current")).toBe(false);
    expect(estadoDe(pasos, "remitido_dec")).toBe("done");
    expect(estadoDe(pasos, "conforme")).toBe("pending");
    expect(ramaFlujo("anulada")?.tipo).toBe("anulada");
  });
});
