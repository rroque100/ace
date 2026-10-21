import { describe, expect, it } from "vitest";
import {
  APP_ROLES,
  ROLE_CAPABILITIES,
  type AppRole,
  areasForRole,
  capabilitiesForRole,
  isAppRole,
  roleHasCapability,
} from "@/lib/permisos-contratacion";

describe("permisos-contratacion", () => {
  it("incluye los 8 actores de la Ley 32069 + consulta/legal/admin", () => {
    const values = APP_ROLES.map((r) => r.value);
    for (const role of [
      "titular",
      "aga",
      "area_usuaria",
      "ate",
      "dec",
      "oficial_compra",
      "comite",
      "jurado",
      "legal",
      "consulta",
      "admin",
    ] as AppRole[]) {
      expect(values).toContain(role);
    }
  });

  it("admin tiene todas las capacidades; consulta ninguna", () => {
    expect(capabilitiesForRole("admin")).toEqual(ROLE_CAPABILITIES.admin);
    expect(capabilitiesForRole("admin").length).toBeGreaterThanOrEqual(5);
    expect(capabilitiesForRole("consulta")).toHaveLength(0);
  });

  it("respeta los permisos por acción de cada actor", () => {
    // Solo evaluadores pueden evaluar ofertas.
    expect(roleHasCapability("comite", "expediente.evaluate")).toBe(true);
    expect(roleHasCapability("jurado", "expediente.evaluate")).toBe(true);
    expect(roleHasCapability("area_usuaria", "expediente.evaluate")).toBe(false);

    // Solo roles de gestión administran/estado del expediente.
    expect(roleHasCapability("dec", "expediente.manage")).toBe(true);
    expect(roleHasCapability("aga", "expediente.manage")).toBe(true);
    expect(roleHasCapability("titular", "expediente.manage")).toBe(true);
    expect(roleHasCapability("oficial_compra", "expediente.manage")).toBe(false);

    // El área usuaria carga documentos (requerimiento, conformidad).
    expect(roleHasCapability("area_usuaria", "expediente.upload")).toBe(true);
    expect(roleHasCapability("consulta", "expediente.upload")).toBe(false);
  });

  it("isAppRole valida y normaliza la pertenencia", () => {
    expect(isAppRole("oficial_compra")).toBe(true);
    expect(isAppRole("editor")).toBe(false);
    expect(isAppRole(null)).toBe(false);
  });

  it("areasForRole: admin ve todas las áreas; consulta solo lectura", () => {
    const adminAreas = areasForRole("admin").map((a) => a.area);
    expect(adminAreas).toContain("Configuración");
    expect(adminAreas).toContain("Expedientes");

    const consultaAreas = areasForRole("consulta").map((a) => a.area);
    expect(consultaAreas).toContain("Consulta documental");
    expect(consultaAreas).not.toContain("Expedientes");
    expect(consultaAreas).not.toContain("Configuración");
  });
});
