import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { generarExcelF1, type ProcesoExport } from "@/lib/fase1-export";
import { CITAS_ART_48 } from "@/lib/anexo1-interaccion";
import type { HitosMap } from "@/lib/procurement-fases";

const proceso: ProcesoExport = {
  amount: 125_000,
  entity: "MUNICIPALIDAD DISTRITAL DE CHALLHUAHUACHO",
  nomenclature: "REQ-2026-0004",
  object_type: "bienes",
  procedure_type: null,
  valor_estimado: 125_000,
};

/** Lee una celda del Anexo N° 1 del .xlsx generado. */
async function anexo1(hitos: HitosMap, necesidad?: Parameters<typeof generarExcelF1>[1]["necesidad"]) {
  const { buffer } = await generarExcelF1("anexo1", { hitos, necesidad, proceso });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  return (addr: string) => {
    const cell = ws.getCell(addr);
    const target = cell.isMerged ? cell.master : cell;
    // Los rótulos de la plantilla oficial traen espacios de sobra ("INDAGACIÓN ").
    return target.value == null ? "" : String(target.value).trim();
  };
}

const A5_COMPLETO: HitosMap = {
  A5: {
    data: {
      cuantia_actualizada: 118_500,
      // Fuentes del Art. 48.2: casillas, no texto libre.
      fuente_historica: true,
      fuente_pladicop: true,
      nivel: "indagacion_avanzada",
      resultado_competencia: "Cuatro proveedores con RNP vigente",
      resultado_cuantia: "El estimado baja tras contrastar tres cotizaciones",
      resultado_perfeccionamiento: "Se precisó la garantía a 36 meses",
      resultado_riesgos: "Plazo de importación de 60 días",
    },
    status: "hecho",
  },
};

describe("Anexo N° 1 · Interacción con el mercado", () => {
  it("sale con una sola hoja: la del Anexo N° 1", async () => {
    // Antes los dos anexos salían de un libro de dos hojas y se devolvía el
    // libro entero: al descargar el Anexo N° 1 te llevabas también la hoja del
    // Anexo N° 2 en blanco. Son documentos distintos del expediente.
    const { buffer } = await generarExcelF1("anexo1", { hitos: A5_COMPLETO, proceso });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["1. Interacción con el mercado"]);
  });

  it("el Anexo N° 2 tampoco arrastra la hoja del Anexo N° 1", async () => {
    const { buffer } = await generarExcelF1("anexo2", { hitos: A5_COMPLETO, proceso });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    expect(wb.worksheets).toHaveLength(1);
    expect(wb.worksheets[0].name.trim()).toBe("2.Expediente de contratación");
  });

  it("respeta el formato oficial: no toca los rótulos de la plantilla", async () => {
    const c = await anexo1(A5_COMPLETO);
    expect(c("B1")).toContain("ANEXO N° 1");
    expect(c("B6")).toBe("INDAGACIÓN");
    expect(c("B14")).toBe("CONSULTA AL MERCADO");
    expect(c("B24")).toBe("Señalar el objeto contractual:");
  });

  it("marca el tipo, el nivel, las fuentes y el objeto contractual", async () => {
    const c = await anexo1(A5_COMPLETO);
    expect(c("D3")).toBe("X"); // Indagación
    expect(c("J8")).toBe("X"); // Indagación avanzada
    expect(c("F9")).toBe("X"); // Información histórica de la entidad
    expect(c("J9")).toBe("X"); // Pladicop
    expect(c("F10")).toBe(""); // "Otras" no se marcó
    expect(c("D24")).toBe("X"); // Bien
  });

  it("vuelca las conclusiones de A5 en el sustento de la indagación", async () => {
    // Este es el fallo real: el exportador leía una clave `resultado` que no
    // existe en A5 (los campos son `resultado_perfeccionamiento`,
    // `_competencia`, `_riesgos` y `_cuantia`), así que el sustento salía con
    // las fuentes y sin una sola conclusión.
    const c = await anexo1(A5_COMPLETO);
    const sustento = c("B12");
    expect(sustento).toContain("Pladicop");
    expect(sustento).toContain("garantía a 36 meses");
    expect(sustento).toContain("Cuatro proveedores");
    expect(sustento).toContain("Plazo de importación");
    expect(sustento).toContain("tres cotizaciones");
  });

  it("identifica la contratación con los datos de la necesidad", async () => {
    // El Anexo N° 1 no tiene encabezado de identificación, así que sin esto el
    // formato sale anónimo: no se sabe de qué contratación es.
    const c = await anexo1(A5_COMPLETO, {
      area_usuaria: "OFICINA DE LOGISTICA",
      monto_estimado: 125_000,
      nombre: "ADQUISICION DE SERVIDOR PARA LA MUNICIPALIDAD",
      tipo_objeto: "bienes",
    });
    expect(c("B12")).toContain("ADQUISICION DE SERVIDOR");
    expect(c("B12")).toContain("OFICINA DE LOGISTICA");
  });

  it("el objeto contractual manda desde la necesidad", async () => {
    const c = await anexo1(A5_COMPLETO, {
      area_usuaria: null,
      monto_estimado: null,
      nombre: "CONSULTORIA PARA EL EXPEDIENTE TECNICO",
      tipo_objeto: "consultoria_obra",
    });
    // La necesidad usa "consultoria_obra"; el expediente, "consultoria".
    expect(c("J24")).toBe("X"); // Consultoría de obra
    expect(c("D24")).toBe(""); // y NO el "Bien" del expediente
  });

  it("no deja rastro del sustento en la sección que no aplica", async () => {
    // Con una indagación, la sección de CONSULTA AL MERCADO no se llena.
    const c = await anexo1(A5_COMPLETO);
    expect(c("B26")).toBe("NO CORRESPONDE.");
  });
});

// ===== Reproducción del Anexo N° 1 real de la entidad =====
//
// Fuente: actuaciones-preparatorias/SKM_651i26071503420.pdf — el Anexo N° 1
// firmado para ESTE expediente (ADQUISICIÓN DE SERVIDOR). Cada aserción es una
// celda de ese documento, no una invención.
const A5_SERVIDOR: HitosMap = {
  A2: {
    // Cuantía baja + riesgo alto → CRÍTICO → consulta al mercado básica.
    data: { condicionesRiesgo: ["no_contratado_antes"], cuantiaAlta: false, objeto: "bienes_servicios" },
    status: "hecho",
  },
  A5: {
    data: {
      fecha_elaboracion: "2026-07-10",
      herr_solicitud: true,
      nivel: "consulta_mercado_basica",
      // La tabla de proveedores es lo que determina la cuantía (Art. 47.1).
      proveedores: [
        {
          documento: "PEDIDO DE COMPRA N° 1838-2026",
          monto: 285_924,
          razonSocial: "DISTRIBUIDORA VIPASA S.A.",
          ruc: "20100055237",
        },
      ],
      responsable_dec: "ROJAS MAYTAN JUAN — JEFE DE LA OFICINA DE ABASTECIMIENTO (E)",
      sustento_citas: CITAS_ART_48,
    },
    status: "hecho",
  },
};

const NEC_SERVIDOR = {
  area_usuaria: "OFICINA DE ABASTECIMIENTO",
  monto_estimado: 285_924,
  nombre:
    "ADQUISICIÓN DE SERVIDOR, PARA EL SISTEMA INTEGRADO DE ADMINISTRACIÓN FINANCIERA (SIAF), PARA LA MUNICIPALIDAD DISTRITAL DE CHALLHUAHUACHO",
  tipo_objeto: "bienes",
};

describe("Anexo N° 1 · reproduce el documento real de la entidad", () => {
  it("marca las mismas casillas que el Anexo firmado", async () => {
    const c = await anexo1(A5_SERVIDOR, NEC_SERVIDOR);
    expect(c("J3")).toBe("X"); // Consulta al mercado
    expect(c("D3")).toBe(""); // y NO indagación
    expect(c("F16")).toBe("X"); // Consulta al mercado básica
    expect(c("F18")).toBe("X"); // Solicitud de información a los proveedores
    expect(c("D24")).toBe("X"); // Bien
  });

  it("escribe NO CORRESPONDE en la indagación, no el marcador de la plantilla", async () => {
    const c = await anexo1(A5_SERVIDOR, NEC_SERVIDOR);
    expect(c("B12")).toBe("NO CORRESPONDE.");
    expect(c("B12")).not.toContain("[INSERTAR");
  });

  it("cita los Arts. 48.1-48.3 y ata el nivel a la segmentación", async () => {
    const c = await anexo1(A5_SERVIDOR, NEC_SERVIDOR);
    const s = c("B26");
    expect(s).toContain("48.1. La indagación se basa en el análisis de datos");
    expect(s).toContain("CRÍTICO");
    expect(s).toContain("CONSULTA AL MERCADO BÁSICA");
  });

  it("documenta a quién se consultó, con qué documento y por cuánto", async () => {
    const c = await anexo1(A5_SERVIDOR, NEC_SERVIDOR);
    const s = c("B26");
    expect(s).toContain("DISTRIBUIDORA VIPASA S.A.");
    expect(s).toContain("PEDIDO DE COMPRA N° 1838-2026");
    expect(s).toContain("S/ 285,924.00");
  });

  it("cierra con la determinación de la cuantía y el monto EN LETRAS", async () => {
    const c = await anexo1(A5_SERVIDOR, NEC_SERVIDOR);
    const s = c("B26");
    expect(s).toContain("DETERMINACIÓN DE LA CUANTÍA DE LA CONTRATACIÓN");
    expect(s.toUpperCase()).toContain("DOSCIENTOS OCHENTA Y CINCO MIL NOVECIENTOS VEINTICUATRO");
  });

  it("lleva la fecha de elaboración y la firma del responsable de la DEC", async () => {
    const c = await anexo1(A5_SERVIDOR, NEC_SERVIDOR);
    expect(c("D28")).toBe("10/07/2026");
    expect(c("B32")).toContain("ROJAS MAYTAN JUAN");
    expect(c("B33")).toBe("Firma del responsable de la DEC");
  });
});

describe("Anexo N° 1 · el nivel manda sobre el tipo", () => {
  it("con una consulta, la sección INDAGACIÓN queda entera libre", async () => {
    // El bug: "tipo_interaccion" era un select aparte del nivel y podían
    // contradecirse. Con Tipo=consulta y Nivel=indagación se marcaban las DOS
    // casillas y se rellenaban las DOS secciones — el Anexo afirmaba que se
    // hizo una indagación Y una consulta. Ahora el tipo se deduce del nivel.
    const c = await anexo1({
      A5: { data: { nivel: "consulta_mercado_basica", tipo_interaccion: "indagacion" }, status: "hecho" },
    });
    expect(c("J3")).toBe("X"); // Consulta al mercado
    expect(c("D3")).toBe(""); // Indagación: libre
    expect(c("F8")).toBe(""); // Indagación básica: libre
    expect(c("J8")).toBe(""); // Indagación avanzada: libre
    expect(c("B12")).toBe("NO CORRESPONDE.");
  });

  it("con una indagación, la sección CONSULTA queda entera libre", async () => {
    const c = await anexo1({
      A5: { data: { nivel: "indagacion_basica", tipo_interaccion: "consulta_mercado" }, status: "hecho" },
    });
    expect(c("D3")).toBe("X");
    expect(c("J3")).toBe("");
    expect(c("F16")).toBe("");
    expect(c("B26")).toBe("NO CORRESPONDE.");
  });

  it("determina la cuantía con la MENOR propuesta de la tabla", async () => {
    const c = await anexo1({
      A5: {
        data: {
          criterio_cuantia: "menor",
          nivel: "consulta_mercado_avanzada",
          proveedores: [
            { monto: 300_000, razonSocial: "ALFA S.A." },
            { monto: 285_924, razonSocial: "VIPASA S.A." },
            { monto: 310_000, razonSocial: "GAMMA S.A." },
          ],
        },
        status: "hecho",
      },
    });
    const s = c("B26");
    expect(s).toContain("Se consultó a 3 proveedor(es)");
    expect(s).toContain("ALFA S.A.");
    expect(s).toContain("S/ 285,924.00 (DOSCIENTOS OCHENTA Y CINCO MIL");
    expect(s).not.toContain("asciende a la suma de S/ 310,000.00");
  });

  it("determina la cuantía con el PROMEDIO cuando se elige ese criterio", async () => {
    const c = await anexo1({
      A5: {
        data: {
          criterio_cuantia: "promedio",
          nivel: "consulta_mercado_basica",
          proveedores: [{ monto: 100 }, { monto: 200 }],
        },
        status: "hecho",
      },
    });
    expect(c("B26")).toContain("S/ 150.00");
  });
});

describe("Anexo N° 1 · proveedores cotizados en la indagación avanzada (Art. 48.2)", () => {
  it("los proveedores salen en el sustento de la INDAGACIÓN (B12), con el encabezado de su artículo", async () => {
    const c = await anexo1({
      A5: {
        data: {
          nivel: "indagacion_avanzada",
          fuente_historica: true,
          fuente_pladicop: true,
          proveedores: [
            { razonSocial: "VIPASA S.A.", ruc: "20100047218", documento: "CARTA N° 12-2026", fecha: "2026-03-10", monto: 64680 },
          ],
        },
        status: "hecho",
      },
    });
    const s = c("B12");
    expect(s).toContain("Se solicitó información a 1 proveedor(es)");
    expect(s).toContain("Art. 48.2");
    expect(s).toContain("VIPASA S.A.");
    expect(s).toContain("CARTA N° 12-2026");
    // No debe colarse el encabezado de la CONSULTA al mercado (otra sección).
    expect(s).not.toContain("Se consultó a");
    expect(c("B26")).toBe("NO CORRESPONDE.");
  });
});

describe("Anexo N° 1 · responsable de la DEC = quien descarga", () => {
  async function b32(hitos: HitosMap, responsable: string) {
    const { buffer } = await generarExcelF1("anexo1", { hitos, proceso, responsable });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const cell = wb.worksheets[0].getCell("B32");
    return cell.value == null ? "" : String(cell.value).trim();
  }
  const A5 = (extra: Record<string, unknown>): HitosMap => ({
    A5: { data: { nivel: "indagacion_basica", ...extra }, status: "hecho" },
  });

  it("el nombre del usuario que descarga firma el Anexo", async () => {
    expect(await b32(A5({}), "PEREZ QUISPE ANA")).toBe("PEREZ QUISPE ANA");
  });

  it("el que descarga manda sobre un valor heredado en A5", async () => {
    expect(await b32(A5({ responsable_dec: "NOMBRE VIEJO" }), "PEREZ QUISPE ANA")).toBe("PEREZ QUISPE ANA");
  });

  it("si el que descarga no tiene nombre, cae al valor heredado", async () => {
    expect(await b32(A5({ responsable_dec: "NOMBRE VIEJO" }), "")).toBe("NOMBRE VIEJO");
  });
});

describe("Anexo N° 1 · el sustento legal es opcional: se deriva del nivel si falta", () => {
  it("indagación sin sustento_citas: B12 trae el Art. 48 de la norma", async () => {
    const c = await anexo1({ A5: { data: { nivel: "indagacion_basica", fuente_historica: true }, status: "hecho" } });
    expect(c("B12")).toContain("48.1.");
    expect(c("B12")).toContain("48.3.");
  });

  it("consulta sin sustento_citas: B26 trae los Arts. 49-50 de la norma", async () => {
    const c = await anexo1({ A5: { data: { nivel: "consulta_mercado_basica", herr_solicitud: true }, status: "hecho" } });
    expect(c("B26")).toContain("49.1.");
    expect(c("B26")).toContain("50.1.");
  });

  it("si el usuario redactó su propio sustento, ese manda (no lo pisa la norma)", async () => {
    const c = await anexo1({
      A5: { data: { nivel: "indagacion_basica", fuente_historica: true, sustento_citas: "Lo redacté yo con mis palabras." }, status: "hecho" },
    });
    expect(c("B12")).toContain("Lo redacté yo con mis palabras.");
    expect(c("B12")).not.toContain("48.1.");
  });
});

describe("Anexo N° 1 · huecos cerrados: difusión (Art. 51) y fecha de la interacción", () => {
  it("la difusión con su acta sale en el sustento de la CONSULTA (B26)", async () => {
    const c = await anexo1({
      A5: {
        data: {
          nivel: "consulta_mercado_basica",
          herr_difusion: true,
          difusion_acta_numero: "ACTA N° 003-2026-DEC",
          difusion_acta_fecha: "2026-05-20",
          difusion_consultas_resumen: "Se ajustó la garantía a 24 meses.",
        },
        status: "hecho",
      },
    });
    const s = c("B26");
    expect(s).toContain("Difusión del requerimiento (Art. 51)");
    expect(s).toContain("ACTA N° 003-2026-DEC");
    expect(s).toContain("Se ajustó la garantía a 24 meses.");
  });

  it("la reunión de confirmación (Art. 51.4-51.5), si se realizó, sale con SU PROPIA acta", async () => {
    const c = await anexo1({
      A5: {
        data: {
          nivel: "consulta_mercado_basica",
          herr_difusion: true,
          difusion_acta_numero: "ACTA N° 003-2026-DEC",
          difusion_acta_fecha: "2026-05-20",
          difusion_reunion_acta_numero: "ACTA N° 004-2026-DEC",
          difusion_reunion_acta_fecha: "2026-05-22",
        },
        status: "hecho",
      },
    });
    const s = c("B26");
    // Las dos actas conviven: la de la absolución (51.3) y la de la reunión (51.5).
    expect(s).toContain("ACTA N° 003-2026-DEC");
    expect(s).toContain("Reunión de confirmación y/o aclaración (Art. 51.4-51.5)");
    expect(s).toContain("ACTA N° 004-2026-DEC");
  });

  it("sin reunión de confirmación registrada, el sustento no la menciona", async () => {
    const c = await anexo1({
      A5: {
        data: {
          nivel: "consulta_mercado_basica",
          herr_difusion: true,
          difusion_acta_numero: "ACTA N° 003-2026-DEC",
          difusion_acta_fecha: "2026-05-20",
        },
        status: "hecho",
      },
    });
    expect(c("B26")).not.toContain("Reunión de confirmación");
  });

  it("una reunión (Reuniones informativas / Talleres / Eventos, sin acta como la difusión) sale con fecha y resumen", async () => {
    const c = await anexo1({
      A5: {
        data: {
          nivel: "consulta_mercado_basica",
          herr_talleres: true,
          herr_talleres_fecha: "2026-05-18",
          herr_talleres_resumen: "Se convocó a la industria para exponer el proyecto.",
        },
        status: "hecho",
      },
    });
    const s = c("B26");
    expect(s).toContain("Talleres con la industria (18/05/2026): Se convocó a la industria para exponer el proyecto.");
  });

  it("una reunión marcada sin fecha ni resumen no queda pelada con paréntesis vacíos", async () => {
    const c = await anexo1({
      A5: { data: { nivel: "consulta_mercado_basica", herr_reuniones_individuales: true }, status: "hecho" },
    });
    const s = c("B26");
    expect(s).toContain("Reuniones individuales");
    expect(s).not.toContain("Reuniones individuales (");
  });

  it("la fecha de la interacción sale en el sustento", async () => {
    const c = await anexo1({
      A5: { data: { nivel: "indagacion_basica", fuente_historica: true, interaccion_fecha: "2026-05-10" }, status: "hecho" },
    });
    expect(c("B12")).toContain("Fecha(s) de la interacción con el mercado");
    expect(c("B12")).toContain("10/05/2026");
  });
})
