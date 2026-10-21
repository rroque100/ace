import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { generarExcelF1, type ProcesoExport } from "@/lib/fase1-export";
import { CITAS_ART_48 } from "@/lib/anexo1-interaccion";
import type { HitosMap } from "@/lib/procurement-fases";

const proceso: ProcesoExport = {
  amount: 285_924,
  entity: "MUNICIPALIDAD DISTRITAL DE CHALLHUAHUACHO",
  nomenclature: "REQ-2026-0004",
  object_type: "bienes",
  procedure_type: null,
  valor_estimado: 285_924,
};

async function hoja(hitos: HitosMap) {
  const { buffer } = await generarExcelF1("anexo1", {
    hitos,
    necesidad: { area_usuaria: "OFICINA DE ABASTECIMIENTO", monto_estimado: 285_924, nombre: "ADQUISICIÓN DE SERVIDOR", tipo_objeto: "bienes" },
    proceso,
  });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  return wb.worksheets[0];
}

const maestra = (ws: ExcelJS.Worksheet, a: string) => {
  const c = ws.getCell(a);
  return c.isMerged ? c.master : c;
};

const LARGO: HitosMap = {
  A2: { data: { condicionesRiesgo: ["no_contratado_antes"], cuantiaAlta: false, objeto: "bienes_servicios" }, status: "hecho" },
  A5: {
    data: {
      herr_solicitud: true,
      nivel: "consulta_mercado_basica",
      proveedores: [{ documento: "PEDIDO DE COMPRA SIGA N° 001838", monto: 285_924, razonSocial: "DISTRIBUIDORA VIPASA S.A." }],
      sustento_citas: CITAS_ART_48,
    },
    status: "hecho",
  },
};

describe("Anexo N° 1 · legibilidad del formato", () => {
  it("parte el texto del sustento en líneas", async () => {
    // La plantilla trae B26 SIN wrapText: sin activarlo el texto no ajusta y
    // solo se lee el principio, por muy alta que se ponga la fila.
    const ws = await hoja(LARGO);
    expect(maestra(ws, "B26").alignment?.wrapText).toBe(true);
    expect(maestra(ws, "B12").alignment?.wrapText).toBe(true);
  });

  it("sube el alto de la fila 26 para que quepa todo el sustento", async () => {
    // Excel NO autoajusta filas con celdas combinadas, así que hay que
    // calcularlo. La plantilla la deja fija en 77,1 puntos.
    const ws = await hoja(LARGO);
    const alto = ws.getRow(26).height ?? 0;
    expect(alto).toBeGreaterThan(77.1);
    const texto = String(maestra(ws, "B26").value ?? "");
    // Comprobación honesta: al menos una línea por cada 135 caracteres.
    const lineasMin = texto.split("\n").reduce((n, p) => n + Math.max(1, Math.ceil(p.length / 135)), 0);
    expect(alto).toBeGreaterThanOrEqual(lineasMin * 14.5);
  });

  it("nunca pasa del tope de alto de fila de Excel", async () => {
    // Excel ignora un alto mayor de 409 puntos: pasarse no rompe, pero el
    // cálculo dejaría de significar nada.
    const ws = await hoja({
      A5: { data: { nivel: "indagacion_basica", resultado_riesgos: "R. ".repeat(3000) }, status: "hecho" },
    });
    expect(ws.getRow(12).height).toBeLessThanOrEqual(409);
  });

  it("no encoge la fila cuando el texto es corto", async () => {
    const ws = await hoja({ A5: { data: { nivel: "consulta_mercado_basica" }, status: "hecho" } });
    // B12 = "NO CORRESPONDE." — la fila conserva el alto de la plantilla.
    expect(ws.getRow(12).height).toBeGreaterThanOrEqual(90);
  });

  it("centra las X en horizontal y en vertical", async () => {
    // La plantilla no las trae homogéneas: D3 tenía vertical middle pero sin
    // centrar, y F18 no tenía alineación ninguna, así que la X salía pegada a
    // la izquierda y abajo.
    const ws = await hoja(LARGO);
    for (const addr of ["J3", "F16", "F18", "D24"]) {
      const a = maestra(ws, addr).alignment;
      expect(a?.horizontal, `${addr} horizontal`).toBe("center");
      expect(a?.vertical, `${addr} vertical`).toBe("middle");
    }
  });
});

describe("k) sustento de la cuantía actualizada · precargado desde las fuentes de A5", () => {
  it("enumera solo las fuentes marcadas, con su etiqueta exacta", async () => {
    const { sustentoCuantiaActualizada } = await import("@/lib/anexo1-interaccion");
    const t = sustentoCuantiaActualizada({ fuente_historica: true, fuente_pladicop: true });
    expect(t).toContain("Fuente: Información histórica de la entidad contratante");
    expect(t).toContain("Fuente: Información de otras entidades obtenidas de la Pladicop");
    // "Otras" no estaba marcada: no aparece.
    expect(t).not.toContain("Fuente: Otras");
    expect(t).toContain("Art. 47.1"); // sustento base de la actualización
  });

  it("«Otras» incluye su detalle cuando se registró", async () => {
    const { sustentoCuantiaActualizada } = await import("@/lib/anexo1-interaccion");
    const t = sustentoCuantiaActualizada({ fuente_otras: true, fuente_otras_detalle: "Cotizaciones directas" });
    expect(t).toContain("Fuente: Otras (Cotizaciones directas)");
  });

  it("en una CONSULTA lista las HERRAMIENTAS marcadas, no fuentes", async () => {
    const { sustentoCuantiaActualizada } = await import("@/lib/anexo1-interaccion");
    const t = sustentoCuantiaActualizada({ herr_talleres: true, herr_reuniones_individuales: true });
    expect(t).toContain("Herramienta: Talleres con la industria");
    expect(t).toContain("Herramienta: Reuniones individuales");
    expect(t).toContain("herramientas de consulta al mercado");
    expect(t).not.toContain("Fuente:");
  });

  it("la herramienta «Otro» de la consulta incluye su detalle", async () => {
    const { sustentoCuantiaActualizada } = await import("@/lib/anexo1-interaccion");
    const t = sustentoCuantiaActualizada({ herr_escrita_otro: true, herr_escrita_otro_detalle: "Nota a proveedores" });
    expect(t).toContain("Herramienta: Otro (escrita) (Nota a proveedores)");
  });

  it("una reunión (sin acta como la difusión) incluye fecha y resumen si se registraron", async () => {
    const { sustentoCuantiaActualizada } = await import("@/lib/anexo1-interaccion");
    const t = sustentoCuantiaActualizada({
      herr_reuniones_informativas: true,
      herr_reuniones_informativas_fecha: "2026-05-20",
      herr_reuniones_informativas_resumen: "Se explicaron los alcances del proyecto a 5 proveedores.",
    });
    expect(t).toContain("Herramienta: Reuniones informativas (20/05/2026): Se explicaron los alcances del proyecto a 5 proveedores.");
  });

  it("una reunión marcada sin fecha ni resumen sale con solo la etiqueta (no queda pelada de más)", async () => {
    const { sustentoCuantiaActualizada } = await import("@/lib/anexo1-interaccion");
    const t = sustentoCuantiaActualizada({ herr_talleres: true });
    expect(t).toContain("Herramienta: Talleres con la industria");
    expect(t).not.toContain("Talleres con la industria (");
  });

  it("sin casillas marcadas trae solo la frase base (k=SÍ nunca queda sin sustento)", async () => {
    const { sustentoCuantiaActualizada, INTRO_CUANTIA_ACTUALIZADA } = await import("@/lib/anexo1-interaccion");
    // A5 existe pero sin fuentes/herramientas marcadas: la frase base, sin lista.
    const t = sustentoCuantiaActualizada({ nivel: "consulta_mercado_basica" });
    expect(t).toBe(`${INTRO_CUANTIA_ACTUALIZADA}.`);
    expect(t).not.toContain("- ");
    // Sin datos de A5 en absoluto: nada que precargar.
    expect(sustentoCuantiaActualizada(null)).toBe("");
  });
});
