import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import {
  buildSolicitudComite,
  previewSolicitudComite,
  type SolicitudComiteInput,
} from "@/lib/solicitud-comite-xlsx";

const INPUT: SolicitudComiteInput = {
  numeroInforme: "INFORME N° 113-2026-JRM-UA-OGA/MDCH",
  destinatario: "CPC. SAUL QUISPE CHIPANA\nOFICINA GENERAL DE ADMINISTRACIÓN JEFATURA",
  atencion: "ING. WELLINTONG LOPEZ PILLCO\nAUTORIDAD DE GESTIÓN ADMINISTRATIVA",
  remitente: "CPC. JUAN ROJAS MAYTAN\nDEPENDENCIA ENCARGADA DE CONTRATACIONES",
  dependenciaSolicitada: "GERENCIA",
  dependenciaSolicitante: "DEC",
  denominacion: "ADQUISICIÓN X",
  nomenclatura: "LP 46",
  monto: 1000,
  numeroRequerimiento: "REQ-1",
  fechaRequerimientoISO: "2026-08-05",
  miembrosDec: [],
  miembrosAreaUsuaria: [],
};

describe("cabecera de la solicitud de comité", () => {
  it("fusiona el número (A1:I1) centrado y el enrutamiento (C2:I2, C3:I3, C4:I4)", async () => {
    // spliceRows dejaba el índice de fusiones de exceljs desfasado y estas
    // fusiones fallaban en silencio; el arreglo las recupera.
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await buildSolicitudComite(INPUT)) as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    const merges = ws.model.merges ?? [];
    for (const rango of ["A1:I1", "A2:B2", "C2:I2", "A3:B3", "C3:I3", "A4:B4", "C4:I4"]) {
      expect(merges, `falta fusión ${rango}`).toContain(rango);
    }
    // El número va centrado (al medio de la hoja, no pegado a la izquierda).
    expect(ws.getCell("A1").alignment?.horizontal).toBe("center");
    // Las fusiones del CUERPO de la plantilla siguen intactas.
    expect(merges.some((m) => m.includes("54"))).toBe(true);
  });

  it("la previa muestra el número centrado y las etiquetas AL/ATENCIÓN/DE", async () => {
    const { filas } = await previewSolicitudComite(INPUT);
    const a1 = filas[0].find((c) => c.celda === "A1");
    expect(a1?.texto).toContain("INFORME N° 113-2026");
    expect(a1?.alineacion).toBe("center");
    const texto = filas.slice(0, 4).flat().map((c) => c.texto).join(" | ");
    expect(texto).toContain("AL:");
    expect(texto).toContain("ATENCIÓN:");
    expect(texto).toContain("DE:");
  });
});
