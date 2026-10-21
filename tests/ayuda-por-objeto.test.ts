import { describe, expect, it } from "vitest";
import { ayudaPorObjeto, TIPOS_REQUISITO_ART72 } from "@/lib/requisitos-calificacion";

const base = (key: string) => TIPOS_REQUISITO_ART72.find((t) => t.key === key)!.ayuda;

describe("ayudaPorObjeto (Art. 72.3.b + Art. 157)", () => {
  it("en obras, capacidad técnica menciona la especialidad y el Art. 157", () => {
    const r = ayudaPorObjeto("capacidad_tecnica", base("capacidad_tecnica"), "obras");
    expect(r).toContain("Art. 157");
    expect(r).toContain("especialidad");
    // Conserva la ayuda base.
    expect(r).toContain(base("capacidad_tecnica"));
  });

  it("en consultoría de obra también aplica el matiz", () => {
    expect(ayudaPorObjeto("experiencia_postor", base("experiencia_postor"), "consultoria_obra")).toContain("Art. 157");
  });

  it("en bienes y servicios la ayuda NO cambia", () => {
    // El matiz del 72.3.b es SOLO para obras: añadirlo en bienes sería falso.
    for (const objeto of ["bienes", "servicios"]) {
      expect(ayudaPorObjeto("capacidad_tecnica", base("capacidad_tecnica"), objeto)).toBe(base("capacidad_tecnica"));
    }
  });

  it("sin objeto conocido devuelve la ayuda base", () => {
    expect(ayudaPorObjeto("capacidad_tecnica", base("capacidad_tecnica"), null)).toBe(base("capacidad_tecnica"));
    expect(ayudaPorObjeto("capacidad_tecnica", base("capacidad_tecnica"), "")).toBe(base("capacidad_tecnica"));
  });

  it("los tipos sin matiz de objeto no se tocan, ni en obras", () => {
    for (const key of ["capacidad_legal", "consorcio", "capacidad_economica"] as const) {
      expect(ayudaPorObjeto(key, base(key), "obras")).toBe(base(key));
    }
  });
});
