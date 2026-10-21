import { describe, expect, it } from "vitest";
import { aColumna, columnasSelect, construirColumnas } from "@/lib/necesidad-columnas";
import { necesidadCreateSchema } from "@/lib/necesidades";

describe("aColumna (camelCase → snake_case)", () => {
  it("convierte los nombres reales de la ficha", () => {
    expect(aColumna("tipoObjeto")).toBe("tipo_objeto");
    expect(aColumna("anioFiscal")).toBe("anio_fiscal");
    expect(aColumna("descripcionCatalogo")).toBe("descripcion_catalogo");
    expect(aColumna("cui")).toBe("cui"); // sin mayúsculas, no cambia
    expect(aColumna("nombre")).toBe("nombre");
  });
});

describe("construirColumnas", () => {
  it("mapea solo las claves presentes (PATCH parcial no pisa columnas)", () => {
    // El bug opuesto: un PATCH de un solo campo no debe poner el resto a null.
    const patch = construirColumnas({ cui: "2661009" });
    expect(patch).toEqual({ cui: "2661009" });
    expect("nombre" in patch).toBe(false);
  });

  it("convierte cadena vacía a null (columna text)", () => {
    expect(construirColumnas({ cui: "" })).toEqual({ cui: null });
  });

  it("excluye los campos que no son columnas", () => {
    // status lo gobierna la máquina de estados; nroPedido vincula pedidos_siga.
    const patch = construirColumnas({
      nombre: "ADQ. SERVIDOR",
      nroPedido: "001838",
      pedidoSecuencia: "1",
      status: "conforme",
    });
    expect(patch).toEqual({ nombre: "ADQ. SERVIDOR" });
  });

  it("mapea el campo que rompió tres veces: cui llega a su columna", () => {
    // La razón de existir de todo esto.
    expect(construirColumnas({ cui: "2661009" })).toHaveProperty("cui", "2661009");
  });
});

describe("columnasSelect", () => {
  it("incluye todas las columnas de la ficha, sin los transitorios", () => {
    const cols = columnasSelect();
    expect(cols).toContain("cui");
    expect(cols).toContain("tipo_objeto");
    expect(cols).toContain("cadena_funcional");
    expect(cols).not.toContain("status");
    expect(cols).not.toContain("nro_pedido");
  });

  it("cubre TODOS los campos del schema (el guardián contra el olvido)", () => {
    // Si mañana se añade un campo al schema, aparece solo aquí. Este test
    // garantiza que el conversor no deja fuera ninguno silenciosamente.
    const delSchema = Object.keys(necesidadCreateSchema.shape).filter(
      (k) => !["status", "nroPedido", "pedidoSecuencia"].includes(k),
    );
    const cols = columnasSelect();
    for (const campo of delSchema) {
      expect(cols).toContain(aColumna(campo));
    }
    expect(cols.length).toBe(delSchema.length);
  });
});
