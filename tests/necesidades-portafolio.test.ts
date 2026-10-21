import { describe, expect, it } from "vitest";
import {
  DIAS_ESTANCADA,
  DIAS_POR_VENCER,
  ESTADOS_ACTIVOS,
  ESTADOS_ESPERA,
  fechaLimiteEstancada,
  fechaLimitePorVencer,
} from "@/lib/necesidades-portafolio";
import { NECESIDAD_ESTADOS } from "@/lib/necesidad-workflow";

/**
 * Los umbrales y estados del portafolio los comparten la LISTA (route) y el
 * CONTADOR del chip (facetas). Antes estaban copiados en los dos ficheros; estas
 * pruebas fijan la fuente única para que no vuelvan a divergir.
 */
describe("estados del portafolio", () => {
  it("«en espera» son exactamente los de tono progreso o atención", () => {
    const esperado = NECESIDAD_ESTADOS.filter((e) => e.tono === "progreso" || e.tono === "atencion").map((e) => e.value);
    expect([...ESTADOS_ESPERA].sort()).toEqual([...esperado].sort());
  });

  it("«activos» son todos menos los terminales (incorporado / anulada)", () => {
    expect(ESTADOS_ACTIVOS).not.toContain("incorporado_cmn");
    expect(ESTADOS_ACTIVOS).not.toContain("anulada");
    const terminales = NECESIDAD_ESTADOS.filter((e) => e.value === "incorporado_cmn" || e.value === "anulada");
    expect(ESTADOS_ACTIVOS.length).toBe(NECESIDAD_ESTADOS.length - terminales.length);
  });
});

describe("umbrales de fecha", () => {
  const hoy = new Date("2026-07-15T12:00:00Z");

  it("«por vencer» es hoy + DIAS_POR_VENCER en YYYY-MM-DD", () => {
    expect(DIAS_POR_VENCER).toBe(15);
    expect(fechaLimitePorVencer(hoy)).toBe("2026-07-30");
  });

  it("«estancada» es hoy − DIAS_ESTANCADA", () => {
    expect(DIAS_ESTANCADA).toBe(7);
    expect(fechaLimiteEstancada(hoy).toISOString().slice(0, 10)).toBe("2026-07-08");
  });
});
