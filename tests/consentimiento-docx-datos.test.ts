import { describe, expect, it } from "vitest";
import { datosConsentimiento } from "@/lib/consentimiento-docx-datos";
import type { HitosMap } from "@/lib/procurement-fases";

describe("datosConsentimiento", () => {
  it("sin B8 hecho, devuelve null (no se declara consentido algo que no se ha declarado)", () => {
    expect(datosConsentimiento("PROC-2026-001", {})).toBeNull();
  });

  it("con B8 hecho y varios postores admitidos, ofertaUnica es false", () => {
    const hitos: HitosMap = {
      B2: {
        status: "hecho",
        data: {
          relacion_admitidos: [
            { admitido: true, razonSocial: "A", ruc: "1" },
            { admitido: true, razonSocial: "B", ruc: "2" },
          ],
        },
      },
      B8: { status: "hecho", data: { fecha_consentimiento: "2026-06-20", hubo_impugnacion: false } },
    };
    const datos = datosConsentimiento("PROC-2026-001", hitos);
    expect(datos?.ofertaUnica).toBe(false);
    expect(datos?.huboImpugnacion).toBe(false);
  });

  it("con un solo postor admitido, ofertaUnica es true (excepción Art. 82.2)", () => {
    const hitos: HitosMap = {
      B2: { status: "hecho", data: { relacion_admitidos: [{ admitido: true, razonSocial: "A", ruc: "1" }] } },
      B8: { status: "hecho", data: { fecha_consentimiento: "2026-06-11", hubo_impugnacion: false } },
    };
    expect(datosConsentimiento("PROC-2026-001", hitos)?.ofertaUnica).toBe(true);
  });

  it("incluye el resultado de la impugnación cuando hubo una", () => {
    const hitos: HitosMap = {
      B8: {
        status: "hecho",
        data: { fecha_consentimiento: "2026-06-25", hubo_impugnacion: true, resultado_impugnacion: "Declarada infundada" },
      },
    };
    const datos = datosConsentimiento("PROC-2026-001", hitos);
    expect(datos?.huboImpugnacion).toBe(true);
    expect(datos?.resultadoImpugnacion).toBe("Declarada infundada");
  });
});
