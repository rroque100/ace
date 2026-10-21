import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import {
  buildSolicitudCertificacion,
  previewSolicitudCertificacion,
} from "@/lib/solicitud-certificacion-xlsx";

const INPUT = {
  informeNumero: "INFORME N° 001-2026",
  al: { nombre: "SAUL QUISPE", oficina: "OGA JEFATURA" },
  atencion: { nombre: "WELLINTONG LOPEZ", oficina: "GERENCIA MUNICIPAL" },
  del: { grado: "MAG.", nombre: "JUAN ROJAS" },
  ciudad: "Challhuahuacho",
  fechaISO: "2026-07-23",
  objeto: "ADQUISICION DE BARRAS",
  proyectoInversion: "CREACION CENTRO",
  cui: "2426949",
  esObra: true,
  esCompetitivo: true,
  monto: 77700.6,
  procedimientoLabel: "Subasta Inversa Electrónica",
  nomenclatura: "44-2026-DEC-MDCH-1",
  areaUsuaria: "SUB GERENCIA DE INVERSIONES",
  nroCmn: "3",
  referenciaPac: "140",
  plazoEjecucion: "30 días",
  anioCertificacion: "2026",
  clasificadorGasto: "2.6",
  montoCertificacion: 77700.6,
  mostrarPrevision: false,
  anioPrevision: "",
  montoPrevision: 0,
  fuenteFinanciamiento: "RECURSOS DETERMINADOS",
  rubro: "18 CANON Y SOBRECANON",
  metaPresupuestal: "0140",
  cadenaFuncional: "9002.3999999.5000276",
};

async function hojaDe(buf: Buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  return wb.worksheets[0];
}
function texto(ws: ExcelJS.Worksheet, addr: string) {
  const v = ws.getCell(addr).value;
  if (v && typeof v === "object" && "richText" in v) {
    return (v as { richText: { text?: string }[] }).richText.map((x) => x.text ?? "").join("");
  }
  return String(v ?? "");
}

describe("A7 · Solicitud de certificación (Ley 32069)", () => {
  it("oculta las filas 19 y 20 (sub-encabezados de valor estimado/referencial)", async () => {
    const ws = await hojaDe(await buildSolicitudCertificacion(INPUT as never));
    expect(ws.getRow(19).hidden).toBe(true);
    expect(ws.getRow(20).hidden).toBe(true);
    // La 36 ya no se oculta: dejó de ser el banner y ahora aloja los datos
    // presupuestales (ver el bloque de tests de más abajo).
    expect(ws.getRow(36).hidden).not.toBe(true);
  });

  it("renombra la etiqueta a CUANTÍA DE LA CONTRATACIÓN", async () => {
    // La Ley 32069 sustituyó "valor estimado o valor referencial" por "cuantía
    // de la contratación": el rótulo se mueve a una fila visible (21) para que
    // no desaparezca al ocultar su fila original.
    const ws = await hojaDe(await buildSolicitudCertificacion(INPUT as never));
    expect(texto(ws, "C21")).toBe("CUANTÍA DE LA CONTRATACIÓN");
    expect(texto(ws, "B21")).toBe("4");
  });

  it("no deja rastro visible de VALOR ESTIMADO / REFERENCIAL", async () => {
    const ws = await hojaDe(await buildSolicitudCertificacion(INPUT as never));
    for (let r = 1; r <= 45; r++) {
      if (ws.getRow(r).hidden) continue;
      for (let c = 1; c <= 11; c++) {
        const t = texto(ws, ws.getCell(r, c).address);
        expect(t, `R${r}`).not.toContain("VALOR ESTIMADO");
        expect(t, `R${r}`).not.toContain("VALOR REFER");
      }
    }
  });

  it("conserva los datos: eliminar filas NO desplazó las celdas de abajo", async () => {
    // El riesgo de tocar filas era romper las direcciones fijas del llenado.
    // Ocultar (no splice) las mantiene: monto, moneda, área, CMN, año y monto de
    // la certificación siguen donde el código los escribe.
    const ws = await hojaDe(await buildSolicitudCertificacion(INPUT as never));
    expect(texto(ws, "G21")).toBe("X"); // moneda soles
    expect(texto(ws, "F22")).toContain("S/. 77,700.60");
    expect(texto(ws, "E28")).toBe("SUB GERENCIA DE INVERSIONES");
    expect(texto(ws, "E30")).toContain("N° CMN: 3");
    expect(texto(ws, "E37")).toBe("2026");
    expect(texto(ws, "J37")).toContain("S/. 77,700.60");
    expect(texto(ws, "B37")).toBe("10");
  });

  it("la vista previa dice lo mismo que la hoja descargada", async () => {
    const previa = (await previewSolicitudCertificacion(INPUT as never)).filas
      .flat()
      .map((c) => c.texto)
      .join(" ");
    expect(previa).toContain("CUANTÍA DE LA CONTRATACIÓN");
    expect(previa).not.toContain("VALOR ESTIMADO");
    expect(previa).not.toContain("TRATÁNDOSE DE EJECUCIONES");
  });
});

describe("A7 · altura responsiva de las filas 14, 16, 18", () => {
  async function alturas(objeto: string, inversion: string) {
    const ws = await hojaDe(
      await buildSolicitudCertificacion({ ...INPUT, objeto, proyectoInversion: inversion } as never),
    );
    return { r14: ws.getRow(14).height ?? 0, r16: ws.getRow(16).height ?? 0, r18: ws.getRow(18).height ?? 0 };
  }

  const LARGO =
    "ADQUISCION DE BARRAS PARA CONTRUCCIÓN PARA EL PROYECTO: CREACION DEL CENTRO INTEGRAL " +
    "PARA LA PRESTACION DE SERVICIOS CULTURALES Y DEPORTIVOS EN EL SECTOR TIKARY COMUNIDAD DE " +
    "QUEUÑA DEL DISTRITO DE CHALLHUAHUACHO, PROVINCIA DE COTABAMBAS Y DEPARTAMENTO DE APURIMAC";

  it("un texto largo hace la fila más alta que uno corto", async () => {
    const corto = await alturas("COMPRA DE PAPEL", "PROYECTO X");
    const largo = await alturas(LARGO, LARGO);
    expect(largo.r14).toBeGreaterThan(corto.r14);
    expect(largo.r16).toBeGreaterThan(corto.r16);
    expect(largo.r18).toBeGreaterThan(corto.r18);
  });

  it("la altura da para todas las líneas que el texto necesita", async () => {
    // Con Arial 11 y las columnas de la plantilla, ~79 caracteres por línea en
    // E..K. El texto largo (263 chars) necesita ≥4 líneas ≈ 63pt.
    const { r14 } = await alturas(LARGO, "");
    expect(r14).toBeGreaterThanOrEqual(60);
  });

  it("la fila 18 (objeto) es la más alta: su texto lleva un prefijo", async () => {
    // E18 = "Emisión de la certificación… para " + objeto, así que es más largo
    // que E14 (solo el objeto) y necesita al menos tantas líneas.
    const { r14, r18 } = await alturas(LARGO, "");
    expect(r18).toBeGreaterThanOrEqual(r14);
  });

  it("un objeto corto deja la fila a una sola línea (se reduce)", async () => {
    // Responsivo en los dos sentidos: no solo crece, también baja.
    const { r14 } = await alturas("COMPRA DE PAPEL A4", "");
    expect(r14).toBeLessThanOrEqual(20);
  });
});


describe("A7 · datos presupuestales de la certificación (conforme a la norma)", () => {
  it("añade las coordenadas que Presupuesto necesita para afectar el crédito", async () => {
    // Art. 54.2.f y 53.1 del Reglamento: el expediente contiene la certificación
    // y la DEC la gestiona. El detalle presupuestal lo gobierna el DL 1440. Sin
    // fuente, meta y clasificador, Presupuesto recibe un monto sin partida.
    const ws = await hojaDe(await buildSolicitudCertificacion(INPUT as never));
    expect(texto(ws, "C36")).toBe("DATOS PRESUPUESTALES");
    const coord = texto(ws, "E36");
    expect(coord).toContain("Fuente de financiamiento: RECURSOS DETERMINADOS");
    expect(coord).toContain("Meta presupuestaria: 0140");
    expect(coord).toContain("Clasificador de gasto: 2.6");
    expect(coord).toContain("Rubro: 18 CANON Y SOBRECANON");
    expect(coord).toContain("Cadena funcional: 9002");
  });

  it("marca con guion las coordenadas obligatorias que falten", async () => {
    // Fuente, meta y clasificador salen con "-" si no están: Presupuesto ve el
    // hueco en vez de un dato ausente sin avisar. Rubro y cadena son opcionales.
    const ws = await hojaDe(
      await buildSolicitudCertificacion({
        ...INPUT,
        fuenteFinanciamiento: "",
        metaPresupuestal: "",
        clasificadorGasto: "",
        rubro: "",
        cadenaFuncional: "",
      } as never),
    );
    const coord = texto(ws, "E36");
    expect(coord).toContain("Fuente de financiamiento: -");
    expect(coord).toContain("Meta presupuestaria: -");
    expect(coord).toContain("Clasificador de gasto: -");
    // Los opcionales sin valor no aparecen.
    expect(coord).not.toContain("Rubro:");
    expect(coord).not.toContain("Cadena funcional:");
  });

  it("ya no muestra el banner redundante 'TRATÁNDOSE DE EJECUCIONES… DEVENGUEN'", async () => {
    const ws = await hojaDe(await buildSolicitudCertificacion(INPUT as never));
    for (let r = 1; r <= 48; r++) {
      if (ws.getRow(r).hidden) continue;
      for (let c = 1; c <= 11; c++) {
        expect(texto(ws, ws.getCell(r, c).address), `R${r}`).not.toContain(
          "QUE SE DEVENGUEN",
        );
      }
    }
  });

  it("restaura la nota legal (DL 1440 Art. 41.4), base de la previsión", async () => {
    // Antes se ocultaba siempre; es lo que sustenta la previsión ante Presupuesto.
    const ws = await hojaDe(await buildSolicitudCertificacion(INPUT as never));
    expect(ws.getRow(47).hidden).not.toBe(true);
    expect(ws.getRow(48).hidden).not.toBe(true);
    expect(texto(ws, "B48")).toContain("41.4");
    expect(texto(ws, "B48")).toContain("previsión presupuestaria");
  });

  it("la fila de coordenadas se ajusta de alto a su contenido", async () => {
    const ws = await hojaDe(await buildSolicitudCertificacion(INPUT as never));
    expect(ws.getRow(36).height ?? 0).toBeGreaterThan(15);
  });

  it("la vista previa incluye las coordenadas presupuestales", async () => {
    const previa = (await previewSolicitudCertificacion(INPUT as never)).filas
      .flat()
      .map((c) => c.texto)
      .join(" ");
    expect(previa).toContain("DATOS PRESUPUESTALES");
    expect(previa).toContain("RECURSOS DETERMINADOS");
    expect(previa).toContain("41.4");
  });
});
