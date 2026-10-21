import { describe, expect, it } from "vitest";
import { camposExigidosRequestSchema } from "@/lib/necesidad-copiloto";

// La ficha tiene ~70 campos y ningún procedimiento los pide todos. En vez de que
// el área usuaria decida campo por campo si le toca, se le pregunta al MODELO
// OFICIAL del proceso (el PDF cargado en Configuración → Unidad de
// abastecimiento) y se muestra solo lo que ese modelo exige.

describe("camposExigidosRequestSchema", () => {
  const base = {
    tipoProcesoSeleccion: "Subasta Inversa Electrónica",
    tipoObjeto: "bienes",
    camposObjetivo: [{ api: "finalidadPublica", label: "Finalidad pública" }],
  };

  it("acepta una solicitud con proceso, objeto y catálogo de campos", () => {
    const r = camposExigidosRequestSchema.safeParse(base);
    expect(r.success).toBe(true);
  });

  it("exige el procedimiento: sin él no hay modelo al que preguntar", () => {
    expect(camposExigidosRequestSchema.safeParse({ ...base, tipoProcesoSeleccion: "" }).success).toBe(false);
    expect(camposExigidosRequestSchema.safeParse({ ...base, tipoProcesoSeleccion: "   " }).success).toBe(false);
  });

  it("exige al menos un campo objetivo: la respuesta se acota a esa lista", () => {
    expect(camposExigidosRequestSchema.safeParse({ ...base, camposObjetivo: [] }).success).toBe(false);
  });

  it("el objeto es opcional: sin él la caché usa la clave «sin_objeto»", () => {
    const r = camposExigidosRequestSchema.safeParse({ ...base, tipoObjeto: undefined });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.tipoObjeto).toBe("");
  });

  it("rellena los opcionales del catálogo para que el prompt no reciba undefined", () => {
    const r = camposExigidosRequestSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.camposObjetivo[0].seccion).toBe("");
      expect(r.data.camposObjetivo[0].obligatorio).toBe(false);
    }
  });
});
