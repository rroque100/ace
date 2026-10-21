import { describe, expect, it } from "vitest";
import { pedidoDeResumen } from "@/lib/anexo1-interaccion";

describe("pedidoDeResumen", () => {
  it("extrae el pedido del resumen real de la necesidad", () => {
    expect(pedidoDeResumen("Importado del pedido de compra SIGA N° 001838")).toBe(
      "PEDIDO DE COMPRA SIGA N° 001838",
    );
  });

  it("corta en el punto y en el salto de línea", () => {
    expect(pedidoDeResumen("Importado del pedido de compra SIGA N° 001838. Servidor para el SIAF.")).toBe(
      "PEDIDO DE COMPRA SIGA N° 001838",
    );
    expect(pedidoDeResumen("pedido SIGA 1838-2026\nOtra línea")).toBe("PEDIDO SIGA 1838-2026");
  });

  it("reconoce otras formas de nombrarlo", () => {
    expect(pedidoDeResumen("Según PECOSA N° 12-2026")).toBe("PECOSA N° 12-2026");
    expect(pedidoDeResumen("Deriva de la orden de compra 456")).toBe("ORDEN DE COMPRA 456");
  });

  it("no inventa un documento cuando el resumen no lo menciona", () => {
    // Un número de documento inventado en un formato que se firma es mucho peor
    // que un campo vacío.
    expect(pedidoDeResumen("Adquisición de servidor para el área de sistemas")).toBe("");
    expect(pedidoDeResumen("")).toBe("");
    expect(pedidoDeResumen(null)).toBe("");
  });
});

describe("el pedido llega al Anexo N° 1", () => {
  it("el documento sugerido se imprime en el sustento de la consulta", async () => {
    const { generarExcelF1 } = await import("@/lib/fase1-export");
    const ExcelJS = (await import("exceljs")).default;
    // Tal y como queda la fila al pulsar "Añadir proveedor" con el resumen
    // "Importado del pedido de compra SIGA N° 001838".
    const documento = pedidoDeResumen("Importado del pedido de compra SIGA N° 001838");
    const { buffer } = await generarExcelF1("anexo1", {
      hitos: {
        A5: {
          data: {
            nivel: "consulta_mercado_basica",
            proveedores: [{ documento, monto: 285_924, razonSocial: "DISTRIBUIDORA VIPASA S.A." }],
          },
          status: "hecho",
        },
      },
      necesidad: { area_usuaria: null, monto_estimado: null, nombre: "ADQUISICIÓN DE SERVIDOR", tipo_objeto: "bienes" },
      proceso: { amount: null, entity: null, nomenclature: "REQ-2026-0004", object_type: "bienes", procedure_type: null, valor_estimado: null },
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const cell = wb.worksheets[0].getCell("B26");
    const texto = String((cell.isMerged ? cell.master : cell).value ?? "");
    expect(texto).toContain("PEDIDO DE COMPRA SIGA N° 001838");
    // Y NO el código interno de ACE, que no es un documento de la entidad.
    expect(texto).not.toContain("mediante REQ-2026-0004");
  });
});
