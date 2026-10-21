import { describe, expect, it } from "vitest";
import { datosActaBuenaPro } from "@/lib/buena-pro-docx-datos";
import type { HitosMap } from "@/lib/procurement-fases";

describe("datosActaBuenaPro", () => {
  it("sin B7 hecho, devuelve null (no se genera un acta de algo que no ocurrió)", () => {
    expect(datosActaBuenaPro("PROC-2026-001", {})).toBeNull();
  });

  it("con B7 hecho, arma los datos del acta", () => {
    const hitos: HitosMap = {
      B7: {
        status: "hecho",
        data: {
          fecha_otorgamiento: "2026-06-10",
          ganador: "ACME SAC",
          monto_adjudicado: 80000,
        },
      },
      B2: {
        status: "hecho",
        data: { relacion_admitidos: [{ admitido: true, razonSocial: "ACME SAC", ruc: "20123456789" }] },
      },
    };
    const datos = datosActaBuenaPro("PROC-2026-001", hitos);
    expect(datos).not.toBeNull();
    expect(datos?.ganadorRazonSocial).toBe("ACME SAC");
    expect(datos?.montoAdjudicado).toBe(80000);
    expect(datos?.postoresAdmitidos).toHaveLength(1);
  });
});
