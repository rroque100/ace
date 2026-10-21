import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { generarExcelF1, type NecesidadExport, type ProcesoExport } from "@/lib/fase1-export";
import type { HitosMap } from "@/lib/procurement-fases";

const proceso: ProcesoExport = {
  nomenclature: "CP N° 001-2026 — Servicio de prueba",
  object_type: "servicios",
  procedure_type: "concurso_publico",
  amount: 95000,
  valor_estimado: 98000,
  entity: "Municipalidad de Prueba",
};

const hitos: HitosMap = {
  A1: { status: "hecho", data: { en_pac: true, procedimiento_pac: "concurso_publico", referencia_pac: "PAC-045" } },
  A2: {
    status: "hecho",
    data: { objeto: "bienes_servicios", cuantiaAlta: true, condicionesRiesgo: ["desierto_2anios"] },
  },
  A3: { status: "hecho", data: { descripcion: "Servicio integral de mantenimiento", no_objecion: "otorgada" } },
  A4: {
    status: "en_curso",
    data: {
      var_a_procedimiento: "concurso_publico_abreviado",
      var_a_sustento_cambio: "La cuantía actualizada baja del umbral.",
      var_i_sistema_entrega: "llave_en_mano",
    },
  },
  A5: {
    status: "hecho",
    data: {
      nivel: "consulta_mercado_avanzada",
      // Fuentes (Art. 48.2) y herramientas (Art. 50.1): casillas del Anexo
      // N° 1, no texto libre — una textarea no puede marcar una casilla.
      fuente_historica: true,
      fuente_pladicop: true,
      herr_reuniones_individuales: true,
      herr_talleres: true,
    },
  },
  // A6 · Designación de evaluadores · A7 · CCP (orden del Anexo N° 2).
  A6: { status: "hecho", data: { tipo_evaluador: "comite", documento_designacion: "RES-2026-77" } },
  A7: { status: "hecho", data: { tipo: "ccp", numero: "CCP-2026-123", meta_presupuestal: "0045", monto: 98000, fecha: "2026-05-10" } },
  A8: { status: "en_curso", data: { fecha_aprobacion: "2026-06-01" } },
};

async function cargar(buffer: Uint8Array, hoja: number) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  return wb.worksheets[hoja];
}

function texto(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v === "object" && "richText" in v) {
    return v.richText.map((r) => r.text).join("");
  }
  return String(v);
}

describe("fase1-export · Formato de Estrategia", () => {
  it("escribe el sustento del CAMBIO de procedimiento en B7 y marca el sistema de entrega", async () => {
    // B7 es "[Insertar sustento del CAMBIO del tipo de procedimiento]": solo se
    // imprime si la estrategia se aparta del procedimiento programado en el PAC.
    const { buffer, filename } = await generarExcelF1("estrategia", { proceso, hitos });
    expect(filename).toContain("Formato-Estrategia");
    const ws = await cargar(buffer, 0);
    expect(texto(ws.getCell("B7").value)).toContain("baja del umbral");
    expect(texto(ws.getCell("F74").value)).toBe("X"); // i) Llave en mano
  });

  // La tabla de g) se desplaza con las inserciones de f); se localiza por su
  // rótulo de cabecera ("Nombre del factor de evaluación:"), y la 1.ª fila de
  // factor es la siguiente.
  function primeraFilaFactor(ws: ExcelJS.Worksheet): number {
    for (let r = 1; r <= ws.rowCount; r += 1) {
      if (/^Nombre del factor de evaluaci/i.test(texto(ws.getCell(`B${r}`).value).trim())) return r + 1;
    }
    return -1;
  }

  it("g) sin factores: NO CORRESPONDE en la 1.ª fila y oculta las otras dos", async () => {
    // Sin `factores_items` (p. ej. subasta inversa / comparación de precios, que
    // van por menor monto sin factores técnicos, Art. 74.3), la tabla no debe
    // quedar con los marcadores "[Insertar…]" —que en el formato firmado se leen
    // como un olvido—: NO CORRESPONDE en nombre y sustento de la 1.ª fila, y las
    // dos filas restantes de la plantilla, ocultas.
    const { buffer } = await generarExcelF1("estrategia", { proceso, hitos });
    const ws = await cargar(buffer, 0);
    const primera = primeraFilaFactor(ws);
    expect(primera).toBeGreaterThan(0);
    expect(texto(ws.getCell(`B${primera}`).value)).toBe("NO CORRESPONDE");
    expect(texto(ws.getCell(`C${primera}`).value)).toBe("NO CORRESPONDE");
    expect(ws.getRow(primera + 1).hidden).toBe(true);
    expect(ws.getRow(primera + 2).hidden).toBe(true);
  });

  function conFactoresA4(items: Array<{ nombre: string; sustento: string }>): HitosMap {
    return { ...hitos, A4: { ...hitos.A4!, data: { ...hitos.A4!.data, factores_items: items } } };
  }

  it("g) con 1 factor: va a la 1.ª fila y oculta las otras dos de plantilla", async () => {
    const { buffer } = await generarExcelF1("estrategia", {
      proceso,
      hitos: conFactoresA4([{ nombre: "Mejora en las EE.TT.", sustento: "Sustento de prueba del factor." }]),
    });
    const ws = await cargar(buffer, 0);
    const primera = primeraFilaFactor(ws);
    expect(texto(ws.getCell(`B${primera}`).value)).toBe("Mejora en las EE.TT.");
    expect(texto(ws.getCell(`C${primera}`).value)).toContain("Sustento de prueba");
    expect(ws.getRow(primera).hidden).not.toBe(true);
    expect(ws.getRow(primera + 1).hidden).toBe(true); // 2.ª de plantilla, sin factor
    expect(ws.getRow(primera + 2).hidden).toBe(true); // 3.ª de plantilla, sin factor
  });

  it("g) con 2 factores: filas 1 y 2, y oculta la 3.ª de plantilla", async () => {
    const { buffer } = await generarExcelF1("estrategia", {
      proceso,
      hitos: conFactoresA4([
        { nombre: "Factor uno", sustento: "Sustento uno." },
        { nombre: "Factor dos", sustento: "Sustento dos." },
      ]),
    });
    const ws = await cargar(buffer, 0);
    const primera = primeraFilaFactor(ws);
    expect(texto(ws.getCell(`B${primera}`).value)).toBe("Factor uno");
    expect(texto(ws.getCell(`B${primera + 1}`).value)).toBe("Factor dos");
    expect(ws.getRow(primera).hidden).not.toBe(true);
    expect(ws.getRow(primera + 1).hidden).not.toBe(true);
    expect(ws.getRow(primera + 2).hidden).toBe(true); // 3.ª de plantilla, sin factor
  });

  it("g) con 4 factores: agrega una fila (56-59) y ninguna queda oculta ni con marcador", async () => {
    const { buffer } = await generarExcelF1("estrategia", {
      proceso,
      hitos: conFactoresA4([
        { nombre: "Factor uno", sustento: "S1." },
        { nombre: "Factor dos", sustento: "S2." },
        { nombre: "Factor tres", sustento: "S3." },
        { nombre: "Factor cuatro", sustento: "S4." },
      ]),
    });
    const ws = await cargar(buffer, 0);
    const primera = primeraFilaFactor(ws);
    const nombres = [0, 1, 2, 3].map((i) => texto(ws.getCell(`B${primera + i}`).value));
    expect(nombres).toEqual(["Factor uno", "Factor dos", "Factor tres", "Factor cuatro"]);
    for (let i = 0; i < 4; i += 1) expect(ws.getRow(primera + i).hidden).not.toBe(true);
  });

  // n) B129 · el sustento solo aplica si se eligió un nivel de interacción MÁS
  // avanzado que el mínimo de la segmentación (Art. 127.2). Se localiza por su
  // rótulo B128 ("Sustento de la elección de un nivel más avanzado…").
  function filaSustentoInteraccion(ws: ExcelJS.Worksheet): number {
    for (let r = 1; r <= ws.rowCount; r += 1) {
      if (/^Sustento de la elección de un nivel más avanzado/i.test(texto(ws.getCell(`B${r}`).value).trim())) {
        return r + 1;
      }
    }
    return -1;
  }

  it("n) B129: imprime el sustento cuando se eligió un nivel MÁS avanzado que el mínimo", async () => {
    const conNivelMasAlto: HitosMap = {
      ...hitos,
      A2: { status: "hecho", data: { objeto: "bienes_servicios", cuantiaAlta: false } }, // mínimo: indagación básica
      A5: { status: "hecho", data: { nivel: "consulta_mercado_avanzada" } }, // nivel más alto
      A4: {
        ...hitos.A4!,
        data: { ...hitos.A4!.data, var_n_tipo_interaccion: "Consulta avanzada por la complejidad del mercado." },
      },
    };
    const { buffer } = await generarExcelF1("estrategia", { proceso, hitos: conNivelMasAlto });
    const ws = await cargar(buffer, 0);
    const b129 = filaSustentoInteraccion(ws);
    expect(b129).toBeGreaterThan(0);
    expect(texto(ws.getCell(`B${b129}`).value)).toContain("Consulta avanzada por la complejidad");
  });

  it("n) B129: «NO CORRESPONDE» cuando el nivel elegido NO supera el mínimo", async () => {
    const sinSubirNivel: HitosMap = {
      ...hitos,
      A2: { status: "hecho", data: { objeto: "bienes_servicios", cuantiaAlta: false } }, // mínimo: indagación básica
      A5: { status: "hecho", data: { nivel: "indagacion_basica" } }, // = mínimo
      A4: {
        ...hitos.A4!,
        data: { ...hitos.A4!.data, var_n_tipo_interaccion: "Texto que NO debe imprimirse." },
      },
    };
    const { buffer } = await generarExcelF1("estrategia", { proceso, hitos: sinSubirNivel });
    const ws = await cargar(buffer, 0);
    const b129 = filaSustentoInteraccion(ws);
    expect(texto(ws.getCell(`B${b129}`).value)).toBe("NO CORRESPONDE");
  });

  // q) El sustento de la agrupación (celda bajo "Sustento de la agrupación de
  // prestaciones:") cae al fundamento normativo del mecanismo marcado si la DEC no
  // escribió texto propio.
  function filaSustentoAgrupacion(ws: ExcelJS.Worksheet): number {
    for (let r = 1; r <= ws.rowCount; r += 1) {
      if (/^Sustento de la agrupación de prestaciones/i.test(texto(ws.getCell(`B${r}`).value).trim())) return r + 1;
    }
    return -1;
  }

  it("q) sin texto propio pero con casilla marcada: B162 cae al Art. 52 del mecanismo", async () => {
    const conItems: HitosMap = {
      ...hitos,
      A4: { ...hitos.A4!, data: { ...hitos.A4!.data, agrupacion_tipo: "items" } }, // sin var_q_agrupar
    };
    const { buffer } = await generarExcelF1("estrategia", { proceso, hitos: conItems });
    const ws = await cargar(buffer, 0);
    const b = filaSustentoAgrupacion(ws);
    expect(b).toBeGreaterThan(0);
    expect(texto(ws.getCell(`B${b}`).value)).toContain("artículo 52.1.b");
  });

  it("q) sin agrupación ni texto: B162 queda «NO CORRESPONDE»", async () => {
    // Sin casilla ni texto, la limpieza de la plantilla convierte el marcador en
    // «NO CORRESPONDE.» (con punto), igual que el resto de sustentos sin dato.
    const { buffer } = await generarExcelF1("estrategia", { proceso, hitos });
    const ws = await cargar(buffer, 0);
    const b = filaSustentoAgrupacion(ws);
    expect(texto(ws.getCell(`B${b}`).value)).toContain("NO CORRESPONDE");
  });

  it("imprime en C258 la «fecha de elaboración» que editó la DEC, no siempre la de hoy", async () => {
    // El campo `fecha_elaboracion` de A4 prometía imprimirse al pie y era editable,
    // pero el exportador escribía siempre hoy(): la fecha editada no salía nunca.
    const conFecha: HitosMap = {
      ...hitos,
      A4: { ...hitos.A4!, data: { ...hitos.A4!.data, fecha_elaboracion: "2026-04-22" } },
    };
    const { buffer } = await generarExcelF1("estrategia", { proceso, hitos: conFecha });
    const ws = await cargar(buffer, 0);
    expect(texto(ws.getCell("C258").value)).toBe("22/04/2026");
  });

  it("la fecha VIAJA con su fila cuando el cronograma inserta filas por encima", async () => {
    // Regresión: la fecha se escribía en la dirección fija C258 DESPUÉS de que o)/p)
    // insertaran filas más arriba, así que caía en otra fila y la casilla real de la
    // fecha se quedaba con el marcador "[Insertar fecha…]". Con un cronograma real la
    // fila se desplaza; la fecha debe seguir apareciendo junto a "Fecha de elaboración:".
    const conCronograma: HitosMap = {
      ...hitos,
      A4: {
        ...hitos.A4!,
        data: {
          ...hitos.A4!.data,
          fecha_elaboracion: "2026-04-22",
          cronograma_items: Array.from({ length: 9 }, (_, i) => ({
            fase: "seleccion",
            actividad: `Actividad ${i + 1}`,
            inicio: "2026-05-01",
            fin: "2026-05-02",
          })),
          roles_items: Array.from({ length: 5 }, (_, i) => ({
            etapa: `Etapa ${i + 1}`,
            rol: "DEC",
            responsabilidad: "x",
          })),
        },
      },
    };
    const { buffer } = await generarExcelF1("estrategia", { proceso, hitos: conCronograma });
    const ws = await cargar(buffer, 0);
    // La fila de la fecha ya no es la 258: se localiza por su rótulo.
    let filaFecha = 0;
    for (let r = 1; r <= ws.rowCount; r += 1) {
      if (/Fecha de elaboraci/i.test(texto(ws.getCell(`B${r}`).value))) {
        filaFecha = r;
        break;
      }
    }
    expect(filaFecha).toBeGreaterThan(258); // se desplazó hacia abajo
    expect(texto(ws.getCell(`C${filaFecha}`).value)).toBe("22/04/2026");
    // Y en ninguna casilla queda el marcador sin rellenar.
    let quedaMarcador = false;
    for (let r = 1; r <= ws.rowCount; r += 1) {
      if (/Insertar fecha/i.test(texto(ws.getCell(`C${r}`).value))) quedaMarcador = true;
    }
    expect(quedaMarcador).toBe(false);
  });
});

describe("fase1-export · Anexo N° 1 (Interacción)", () => {
  it("marca el nivel de consulta avanzada y escribe los sustentos", async () => {
    const { buffer } = await generarExcelF1("anexo1", { proceso, hitos });
    const ws = await cargar(buffer, 0);
    expect(texto(ws.getCell("J16").value)).toBe("X"); // consulta al mercado avanzada
    expect(texto(ws.getCell("F24").value)).toBe("X"); // objeto = servicios
    expect(texto(ws.getCell("J18").value)).toBe("X"); // talleres con la industria
    expect(texto(ws.getCell("J22").value)).toBe("X"); // reuniones individuales
    expect(texto(ws.getCell("B26").value)).toContain("Talleres con la industria");
  });
});

describe("fase1-export · Anexo N° 2 (Aprobación del expediente)", () => {
  it("consolida datos generales, segmentación, evaluadores y CCP", async () => {
    const { buffer } = await generarExcelF1("anexo2", { proceso, hitos });
    // Cada anexo es ahora su propio libro de UNA hoja (antes salían los dos del
    // mismo libro y el Anexo N° 2 era la hoja 1).
    const ws = await cargar(buffer, 0);
    expect(texto(ws.getCell("C4").value)).toBe("Servicio de prueba"); // denominación sin el código
    expect(texto(ws.getCell("C6").value)).toBe("SÍ"); // programado en PAC
    expect(texto(ws.getCell("F16").value)).toBe("X"); // estratégico (cuantía alta + riesgo)
    // +3 filas: la sección "obras y consultoría de obras" (25-27) empuja hacia
    // abajo evaluadores (IV) y CCP (V).
    expect(texto(ws.getCell("F40").value)).toBe("X"); // comité
    expect(texto(ws.getCell("G40").value)).toContain("RES-2026-77");
    expect(texto(ws.getCell("C44").value)).toContain("CCP-2026-123");
  });

  it("la cuantía (E33/E35) sale de la «Cuantía actualizada» de A5, no del valor estimado", async () => {
    // A5 = 123456 debe ganar al valor_estimado del expediente (98000).
    const conCuantiaA5: HitosMap = {
      ...hitos,
      A5: { status: "hecho", data: { ...hitos.A5!.data, cuantia_actualizada: 123456 } },
    };
    const { buffer } = await generarExcelF1("anexo2", { proceso, hitos: conCuantiaA5 });
    const ws = await cargar(buffer, 0);
    expect(Number(texto(ws.getCell("E33").value))).toBe(123456);
    expect(Number(texto(ws.getCell("E35").value))).toBe(123456);
  });

  it("sin cuantía en A5, la del Anexo cae al valor estimado del expediente", async () => {
    const { buffer } = await generarExcelF1("anexo2", { proceso, hitos });
    const ws = await cargar(buffer, 0);
    expect(Number(texto(ws.getCell("E33").value))).toBe(98000); // proceso.valor_estimado
  });

  it("C11 antepone el tipo de procedimiento (de A4) y G37 el tipo de documento", async () => {
    const hitosDoc: HitosMap = {
      ...hitos,
      A4: { status: "en_curso", data: { var_a_procedimiento: "concurso_publico_abreviado", var_a_nomenclatura: "1-2026-DEC-MDCH-1" } },
      A6: { status: "hecho", data: { tipo_evaluador: "comite", documento_designacion: "100-2026-DEC-MDCH-2" } },
    };
    // procedure_type null a propósito: el tipo debe salir igual, desde A4.
    const sinTipoExpediente: ProcesoExport = { ...proceso, procedure_type: null };
    const { buffer } = await generarExcelF1("anexo2", { proceso: sinTipoExpediente, hitos: hitosDoc, necesidad: null });
    const ws = await cargar(buffer, 0);
    expect(texto(ws.getCell("C11").value)).toBe("Concurso Público Abreviado N° 1-2026-DEC-MDCH-1");
    // Comité → el documento de designación es un INFORME (no un memorándum).
    expect(texto(ws.getCell("G40").value)).toBe("INFORME N° 100-2026-DEC-MDCH-2");
  });

  it("C11 no duplica el «N°» cuando la nomenclatura de A4 ya lo trae", async () => {
    // Antes se pegaba «N° » a mano: un valor con «N°» salía como «N° N° 5-2026».
    const hitosDoc: HitosMap = {
      ...hitos,
      A4: { status: "en_curso", data: { var_a_procedimiento: "concurso_publico_abreviado", var_a_nomenclatura: "N° 5-2026" } },
    };
    const { buffer } = await generarExcelF1("anexo2", { proceso: { ...proceso, procedure_type: null }, hitos: hitosDoc, necesidad: null });
    const ws = await cargar(buffer, 0);
    expect(texto(ws.getCell("C11").value)).toBe("Concurso Público Abreviado N° 5-2026");
  });

  it("C11 cae a la nomenclatura del expediente si A4 no la tiene, pero no imprime el título como número", async () => {
    const hitosSinNomen: HitosMap = {
      ...hitos,
      A4: { status: "en_curso", data: { var_a_procedimiento: "concurso_publico_abreviado" } },
    };
    // Con una nomenclatura REAL en el expediente → se usa como respaldo.
    const conNomen: ProcesoExport = { ...proceso, procedure_type: null, nomenclature: "CP N° 9-2026" };
    const r1 = await generarExcelF1("anexo2", { proceso: conNomen, hitos: hitosSinNomen, necesidad: null });
    expect(texto((await cargar(r1.buffer, 0)).getCell("C11").value)).toBe("Concurso Público Abreviado CP N° 9-2026");

    // Cuando el `nomenclature` es en realidad el TÍTULO de la necesidad → no sale
    // como número (se detecta porque el nombre de la necesidad está contenido).
    const titulo = "REQ-2026-0024 — ADQUISICION E INSTALACION DE CESPED SINTETICO";
    const conTitulo: ProcesoExport = { ...proceso, procedure_type: null, nomenclature: titulo };
    const nec: NecesidadExport = { nombre: titulo, area_usuaria: null, monto_estimado: null, tipo_objeto: null };
    const r2 = await generarExcelF1("anexo2", { proceso: conTitulo, hitos: hitosSinNomen, necesidad: nec });
    expect(texto((await cargar(r2.buffer, 0)).getCell("C11").value)).toBe("Concurso Público Abreviado");
  });

  it("C4 muestra la denominación sin el código del expediente", async () => {
    const conCodigo: ProcesoExport = { ...proceso, nomenclature: "REQ-2026-0019 — Servicio de mantenimiento vehicular" };
    const { buffer } = await generarExcelF1("anexo2", { proceso: conCodigo, hitos, necesidad: null });
    const ws = await cargar(buffer, 0);
    expect(texto(ws.getCell("C4").value)).toBe("Servicio de mantenimiento vehicular");
    // Todo el Anexo N° 2 se centra (horizontal y vertical).
    expect(ws.getCell("C4").alignment?.horizontal).toBe("center");
    expect(ws.getCell("C4").alignment?.vertical).toBe("middle");
  });

  it("C4 toma la denominación de la necesidad, no una nomenclatura de procedimiento del expediente", async () => {
    // Cuando `nomenclature` guarda una nomenclatura de procedimiento real (sin la
    // «REQ-XXXX — »), recortarla dejaría esa nomenclatura como «denominación». La
    // fuente propia es el nombre de la necesidad.
    const conNomenProc: ProcesoExport = { ...proceso, nomenclature: "CP N° 001-2026" };
    const nec: NecesidadExport = {
      nombre: "Servicio de mantenimiento vehicular",
      area_usuaria: null,
      monto_estimado: null,
      tipo_objeto: null,
    };
    const { buffer } = await generarExcelF1("anexo2", { proceso: conNomenProc, hitos, necesidad: nec });
    const ws = await cargar(buffer, 0);
    expect(texto(ws.getCell("C4").value)).toBe("Servicio de mantenimiento vehicular");
  });

  it("trae datos de la necesidad a D20/B30/H41, marca la cuantía y ajusta el alto de 4/19/30", async () => {
    const textoLargo = (etiqueta: string) =>
      `${etiqueta} del servicio integral de mantenimiento preventivo y correctivo de la flota vehicular de la ` +
      "entidad, incluyendo repuestos, mano de obra especializada y disponibilidad de talleres en las tres " +
      "provincias del ámbito de intervención durante todo el ejercicio fiscal correspondiente.";
    const procesoLargo: ProcesoExport = { ...proceso, nomenclature: textoLargo("CP N° 001-2026 — Contratación") };
    const hitosNec: HitosMap = {
      ...hitos,
      A3: { status: "hecho", data: { descripcion: textoLargo("Alcance"), no_objecion: "otorgada" } },
      A4: { status: "en_curso", data: { ...hitos.A4?.data, si_cuantia_referencia: "no" } },
    };
    const necesidad = {
      // Larga a propósito: C4 sale del nombre de la necesidad, y una denominación
      // real arrastra objeto y localidades (Art. 44.6). Hace crecer la fila 4.
      nombre: textoLargo("Contratación"),
      area_usuaria: "GERENCIA DE SERVICIOS",
      monto_estimado: 98000,
      tipo_objeto: "servicios",
      summary: "pedido de compra SIGA N° 002972 (5 ítems).",
      fecha_requerida: "2026-09-15",
      descripcion_catalogo: textoLargo("Descripción de catálogo"),
      descripcion_detallada: "No usar: debe ganar la de catálogo.",
      clasificador_gasto: "2.3.2.4.1.1",
    };
    const { buffer } = await generarExcelF1("anexo2", { proceso: procesoLargo, hitos: hitosNec, necesidad });
    const ws = await cargar(buffer, 0);
    expect(texto(ws.getCell("D20").value)).toContain("SIGA N° 002972");
    // +3 filas por la sección de obras (25-27): ítem, cuantía y clasificador bajan.
    expect(texto(ws.getCell("B33").value)).toContain("Descripción de catálogo"); // catálogo gana al detallado
    expect(texto(ws.getCell("H44").value)).toBe("2.3.2.4.1.1");
    expect(texto(ws.getCell("H31").value)).toBe("X"); // NO es punto de referencia
    expect(texto(ws.getCell("F31").value)).toBe(""); // el SÍ queda sin marcar (casilla, no placeholder)
    // Ya no se escribe en L20 (quedaba fuera de la tabla).
    expect(texto(ws.getCell("L20").value)).toBe("");
    // Las filas 4, 19 y 33 (ítem) crecen para que su texto largo se lea completo.
    expect(ws.getRow(4).height ?? 0).toBeGreaterThan(39);
    expect(ws.getRow(19).height ?? 0).toBeGreaterThan(50.1);
    expect(ws.getRow(33).height ?? 0).toBeGreaterThan(30);
  });

  it("las celdas con marcador «[...]» sin dato salen con «-», no con la instrucción de la plantilla", async () => {
    const { buffer } = await generarExcelF1("anexo2", { proceso, hitos, necesidad: null });
    const ws = await cargar(buffer, 0);
    // Ningún marcador de plantilla sobrevive en el documento.
    const marcadores: string[] = [];
    ws.eachRow((row) =>
      row.eachCell({ includeEmpty: false }, (c) => {
        if (/^\s*\[[^\]]*\]\s*$/.test(texto(c.value))) marcadores.push(`${c.address}=${texto(c.value)}`);
      }),
    );
    expect(marcadores).toEqual([]);
    // La etiqueta y el dato real NO se tocan.
    expect(texto(ws.getCell("B4").value)).toBe("Denominación del requerimiento:");
    expect(texto(ws.getCell("C4").value)).not.toBe("-");
    // Un campo sin dato en esta corrida queda con «-» (p. ej. el objetivo/meta del POI).
    expect(texto(ws.getCell("C7").value)).toBe("-");
  });

  it("«Para el caso de obras y consultoría de obras»: llena especialidad/subespecialidad en obras y «-» en bienes", async () => {
    const base: NecesidadExport = { nombre: "Obra X", area_usuaria: null, monto_estimado: null, tipo_objeto: null };
    // Obras: se registran especialidad (D25) y subespecialidad (D26); la tipología
    // (D27) no tiene campo propio todavía → «-».
    const obra: NecesidadExport = { ...base, tipo_objeto: "obras", especialidad: "Edificaciones", subespecialidad: "Estructuras" };
    const r1 = await generarExcelF1("anexo2", { proceso, hitos, necesidad: obra });
    const w1 = await cargar(r1.buffer, 0);
    expect(texto(w1.getCell("B25").value)).toContain("Para el caso de obras y consultoría de obras");
    expect(texto(w1.getCell("C25").value)).toBe("Especialidad:");
    expect(texto(w1.getCell("D25").value)).toBe("Edificaciones");
    expect(texto(w1.getCell("D26").value)).toBe("Estructuras");
    expect(texto(w1.getCell("D27").value)).toBe("-"); // tipología sin dato

    // Bienes: la sección no aplica → las 3 celdas de valor quedan con «-».
    const bien: NecesidadExport = { ...base, tipo_objeto: "bienes", especialidad: "no debe salir" };
    const r2 = await generarExcelF1("anexo2", { proceso, hitos, necesidad: bien });
    const w2 = await cargar(r2.buffer, 0);
    expect(texto(w2.getCell("D25").value)).toBe("-");
    expect(texto(w2.getCell("D26").value)).toBe("-");
    expect(texto(w2.getCell("D27").value)).toBe("-");
  });

  it("centra TODAS las celdas con contenido y configura A4 a una sola página", async () => {
    const { buffer } = await generarExcelF1("anexo2", { proceso, hitos, necesidad: null });
    const ws = await cargar(buffer, 0);
    // Ninguna celda con contenido queda sin centrar (horizontal y vertical).
    const sinCentrar: string[] = [];
    ws.eachRow({ includeEmpty: false }, (row) =>
      row.eachCell({ includeEmpty: false }, (c) => {
        if (c.alignment?.horizontal !== "center" || c.alignment?.vertical !== "middle") {
          sinCentrar.push(`${c.address}(${c.alignment?.horizontal ?? "-"}/${c.alignment?.vertical ?? "-"})`);
        }
      }),
    );
    expect(sinCentrar).toEqual([]);
    // Página: A4, ajuste a una sola página, márgenes normales.
    expect(ws.pageSetup.paperSize).toBe(9); // A4
    expect(ws.pageSetup.fitToPage).toBe(true);
    expect(ws.pageSetup.fitToWidth).toBe(1);
    expect(ws.pageSetup.fitToHeight).toBe(0); // a lo alto crece las páginas necesarias
    expect(ws.pageSetup.horizontalCentered).toBe(true); // bloque centrado en la página
    expect(ws.pageSetup.verticalCentered).toBe(true);
    expect(ws.pageSetup.margins?.left).toBeCloseTo(0.7);
    expect(ws.pageSetup.margins?.top).toBeCloseTo(0.75);
  });

  it("lleva el pie de firma centrado al final de la hoja", async () => {
    const { buffer } = await generarExcelF1("anexo2", { proceso, hitos, necesidad: null });
    const ws = await cargar(buffer, 0);
    const firma = ws.getCell("B59");
    expect(texto(firma.value)).toBe(
      "Firma de la autoridad de gestión administrativa o de a quien se hubiera delegado para firma.",
    );
    expect(firma.isMerged).toBe(true); // ocupa el ancho (B59:J59)
    expect(firma.alignment?.horizontal).toBe("center");
  });
});
