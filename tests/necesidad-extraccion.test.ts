import { describe, expect, it } from "vitest";
import { mapExtractedToNecesidad } from "@/lib/necesidad-extraccion";

describe("mapExtractedToNecesidad (EETT/TDR → campos de Necesidad)", () => {
  it("mapea los campos detectados a claves camelCase del schema", () => {
    const { campos } = mapExtractedToNecesidad({
      nombre: "Adquisición de servidor de red",
      finalidadPublica: "Fortalecer la infraestructura tecnológica",
      objetivoContratacion: "Contar con un servidor de alta disponibilidad",
      descripcionDetallada: "Servidor rack con 2 procesadores, 128 GB RAM",
      cantidad: 1,
      unidadMedida: "UNIDAD",
      plazoEjecucion: "30",
      lugarEntrega: "Sede central",
      requisitosCalificacion: "RNP vigente, experiencia 3 años",
      resumen: "Requerimiento de un servidor para el centro de datos.",
    });

    expect(campos.nombre).toBe("Adquisición de servidor de red");
    expect(campos.finalidadPublica).toContain("infraestructura");
    expect(campos.cantidad).toBe(1);
    expect(campos.plazoEjecucion).toBe(30); // string "30" → número
    expect(campos.unidadMedida).toBe("UNIDAD");
    expect(campos.summary).toContain("servidor");
  });

  it("ignora null, vacíos y claves desconocidas", () => {
    const { campos } = mapExtractedToNecesidad({
      nombre: "Compra X",
      finalidadPublica: null,
      descripcionDetallada: "   ",
      cantidad: "no aplica",
      campoInexistente: "algo",
    });
    expect(campos.nombre).toBe("Compra X");
    expect(campos).not.toHaveProperty("finalidadPublica");
    expect(campos).not.toHaveProperty("descripcionDetallada");
    expect(campos).not.toHaveProperty("cantidad");
    expect(campos).not.toHaveProperty("campoInexistente");
  });

  it("extrae número de una cantidad con texto (ej. '500 millares')", () => {
    const { campos } = mapExtractedToNecesidad({ nombre: "Papel", cantidad: "500 millares" });
    expect(campos.cantidad).toBe(500);
  });
});
