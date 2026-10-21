import { describe, expect, it } from "vitest";
import { necesidadCreateSchema, necesidadDocKinds, necesidadUpdateSchema } from "@/lib/necesidades";

describe("necesidades schema", () => {
  it("acepta una necesidad mínima válida y aplica el tipo por defecto", () => {
    const r = necesidadCreateSchema.safeParse({ nombre: "Adquisición de equipos" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.tipoObjeto).toBe("bienes");
    }
  });

  it("rechaza nombre demasiado corto", () => {
    expect(necesidadCreateSchema.safeParse({ nombre: "ab" }).success).toBe(false);
  });

  it("solo admite los tipos de contratación de la Ley 32069", () => {
    expect(necesidadCreateSchema.safeParse({ nombre: "Servicio X", tipoObjeto: "servicios" }).success).toBe(true);
    expect(necesidadCreateSchema.safeParse({ nombre: "Servicio X", tipoObjeto: "otro" }).success).toBe(false);
  });

  it("el update valida el estado de la necesidad (workflow del requerimiento)", () => {
    expect(necesidadUpdateSchema.safeParse({ status: "conforme" }).success).toBe(true);
    expect(necesidadUpdateSchema.safeParse({ status: "no_objecion_pendiente" }).success).toBe(true);
    expect(necesidadUpdateSchema.safeParse({ status: "aprobado_area_usuaria" }).success).toBe(false);
    expect(necesidadUpdateSchema.safeParse({ status: "inexistente" }).success).toBe(false);
  });

  it("acepta el tipo de área (área usuaria / ATE)", () => {
    expect(necesidadCreateSchema.safeParse({ nombre: "Compra X", tipoArea: "ate" }).success).toBe(true);
    const def = necesidadCreateSchema.safeParse({ nombre: "Compra X" });
    expect(def.success && def.data.tipoArea).toBe("area_usuaria");
    expect(necesidadCreateSchema.safeParse({ nombre: "Compra X", tipoArea: "otro" }).success).toBe(false);
  });

  it("define las clases de documento de la necesidad", () => {
    expect(necesidadDocKinds).toContain("requerimiento");
    expect(necesidadDocKinds).toContain("expediente_tecnico");
  });
});
