import { describe, expect, it } from "vitest";
import { datosConvocatoria } from "@/lib/convocatoria-docx-datos";
import type { HitosMap } from "@/lib/procurement-fases";

describe("datosConvocatoria", () => {
  it("sin B1 hecho, devuelve null (no se genera la convocatoria de algo que no se publicó)", () => {
    expect(datosConvocatoria({ amount: 50000, nomenclature: "PROC-2026-001", objectType: "bienes" }, {})).toBeNull();
  });

  it("con B1 hecho, arma los datos de la convocatoria", () => {
    const hitos: HitosMap = {
      B1: {
        status: "hecho",
        data: { fecha_convocatoria: "2026-05-01", numero_convocatoria: "CP-001-2026", plazo_presentacion: 10 },
      },
    };
    const datos = datosConvocatoria({ amount: 50000, nomenclature: "PROC-2026-001", objectType: "bienes" }, hitos);
    expect(datos).not.toBeNull();
    expect(datos?.numeroConvocatoria).toBe("CP-001-2026");
    expect(datos?.plazoPresentacion).toBe(10);
    expect(datos?.amount).toBe(50000);
  });
});
