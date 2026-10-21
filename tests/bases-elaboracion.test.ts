import { describe, expect, it } from "vitest";
import { resolverBases } from "@/lib/bases-elaboracion";

const entidad = { nombre: "Municipalidad de Prueba", ruc: "20123456789" };

describe("resolverBases · factores_items (array real, no texto)", () => {
  it("con datos, expone `filas` y un resumen legible en `valor`", () => {
    const hitos = {
      A3: { data: { finalidad_publica: "Contar con el bien.", descripcion: "Descripción." } },
      A4: {
        data: {
          var_h_modalidad_pago: "Suma alzada.",
          factores_items: [
            { nombre: "Experiencia del postor", sustento: "Puntaje según monto facturado." },
            { nombre: "Mejoras a las condiciones previstas", sustento: "Hasta 10 puntos." },
          ],
        },
      },
    };
    const valores = resolverBases("Licitación Pública para bienes", hitos as never, entidad);
    const factores = valores!.find((v) => v.ruta === "cap4.factoresEvaluacion")!;
    expect(factores.resuelto).toBe(true);
    expect(factores.filas).toEqual([
      { factor: "Experiencia del postor", sustento: "Puntaje según monto facturado." },
      { factor: "Mejoras a las condiciones previstas", sustento: "Hasta 10 puntos." },
    ]);
    expect(factores.valor).toContain("Experiencia del postor: Puntaje según monto facturado.");
  });

  it("con el array vacío, queda sin resolver (igual que un campo vacío)", () => {
    const hitos = { A4: { data: { factores_items: [] } } };
    const valores = resolverBases("Licitación Pública para bienes", hitos as never, entidad);
    const factores = valores!.find((v) => v.ruta === "cap4.factoresEvaluacion")!;
    expect(factores.resuelto).toBe(false);
    expect(factores.filas).toBeUndefined();
  });

  it("un campoHito string normal no gana `filas` (sin regresión)", () => {
    const hitos = { A3: { data: { finalidad_publica: "Contar con el bien." } } };
    const valores = resolverBases("Licitación Pública para bienes", hitos as never, entidad);
    const finalidad = valores!.find((v) => v.ruta === "cap3.finalidadPublica")!;
    expect(finalidad.valor).toBe("Contar con el bien.");
    expect(finalidad.filas).toBeUndefined();
  });
});

describe("resolverBases · cap1.anioFiscal (de la necesidad de origen, no de un hito)", () => {
  it("con año fiscal, lo resuelve como texto", () => {
    const valores = resolverBases("Licitación Pública para bienes", {} as never, entidad, 2026);
    const anioFiscal = valores!.find((v) => v.ruta === "cap1.anioFiscal")!;
    expect(anioFiscal.resuelto).toBe(true);
    expect(anioFiscal.valor).toBe("2026");
  });

  it("sin año fiscal (expediente sin necesidad enlazada), queda sin resolver", () => {
    const valores = resolverBases("Licitación Pública para bienes", {} as never, entidad, null);
    const anioFiscal = valores!.find((v) => v.ruta === "cap1.anioFiscal")!;
    expect(anioFiscal.resuelto).toBe(false);
    expect(anioFiscal.valor).toBe("");
  });

  it("sin pasar el parámetro (llamador que no lo necesita), también queda sin resolver", () => {
    const valores = resolverBases("Licitación Pública para bienes", {} as never, entidad);
    const anioFiscal = valores!.find((v) => v.ruta === "cap1.anioFiscal")!;
    expect(anioFiscal.resuelto).toBe(false);
  });
});
