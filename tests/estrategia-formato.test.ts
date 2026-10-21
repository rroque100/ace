import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import {
  OPCIONES_MODALIDAD_PAGO,
  OPCIONES_TIPO_EVALUADOR,
  pasoF1,
} from "@/lib/actuaciones-preparatorias";
import {
  CELDA_MODALIDAD_PAGO,
  NORMA_MODALIDAD_PAGO,
  CELDA_TIPO_EVALUADOR,
  capitalizarProceso,
  ETIQUETAS_ESTRATEGIA,
  FACTOR_OTRO,
  OPCIONES_FACTOR_EVALUACION,
  SI_NO_ESTANDARIZADO,
  SI_NO_ESTRATEGIA,
  SUSTENTO_EVALUADOR_SUGERIDO,
  NORMA_SISTEMA_ENTREGA,
  NORMA_AGRUPACION,
  sustentoAlElegirModalidadPago,
  sustentoAlElegirSistemaEntrega,
  sustentoAlElegirAgrupacion,
} from "@/lib/estrategia-formato";
import { generarExcelF1, type ProcesoExport } from "@/lib/fase1-export";
import { PROCESO_NO_COMPETITIVO, PROCESO_CONCURSO_ARQUITECTONICO, PROCESO_EXPERTOS_GERENTES_PROYECTO } from "@/lib/procesos-seleccion";
import type { HitosMap } from "@/lib/procurement-fases";

const proceso: ProcesoExport = {
  amount: 98_000,
  entity: "Municipalidad de Prueba",
  nomenclature: "CP N° 001-2026",
  object_type: "servicios",
  procedure_type: null,
  valor_estimado: 98_000,
};

async function hoja(a4: Record<string, unknown>) {
  const hitos: HitosMap = { A4: { data: a4, status: "hecho" } };
  const { buffer } = await generarExcelF1("estrategia", { hitos, proceso });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  return (addr: string) => {
    const c = ws.getCell(addr);
    const t = c.isMerged ? c.master : c;
    const v = t.value as { richText?: { text: string }[] } | null | undefined;
    if (v == null) return "";
    if (typeof v === "object" && "richText" in v && v.richText) return v.richText.map((r) => r.text).join("").trim();
    return String(v).trim();
  };
}

// l) Tabla de adelantos (Art. 46.1.l). El `proceso` de prueba es de servicios, así
// que "materiales" y "avance" son solo-obras y no aplican.
describe("l) tabla de adelantos · volcado al formato", () => {
  it("un adelanto marcado escribe su mecanismo, su % y la X", async () => {
    const leer = await hoja({
      adelantos_items: [
        { prefijo: "adelanto_directo", marcar: true, mecanismo: "Carta fianza", pct: "20%" },
      ],
    });
    expect(leer("D108")).toBe("X");
    expect(leer("E108")).toBe("Carta fianza");
    expect(leer("I108")).toBe("20%");
  });

  it("las filas sin marcar salen «NO CORRESPONDE», no el marcador de la plantilla", async () => {
    const leer = await hoja({ adelantos_items: [] });
    for (const celda of ["E108", "I108", "E109", "I109", "E110", "I110"]) {
      expect(leer(celda), celda).toBe("NO CORRESPONDE");
      expect(leer(celda), celda).not.toContain("Insertar");
    }
  });
});

// o) Cronograma: al ampliar un bloque de fase, el rótulo de la izquierda (columna
// B) debe recombinarse en TODAS sus filas. `duplicateRow` deja el modelo de merges
// desincronizado y el merge fallaba en silencio (el rótulo salía solo en la 1.ª
// fila y el resto vacío).
describe("o) cronograma · el rótulo de fase se combina en todo su bloque", () => {
  async function mergesDe(a4: Record<string, unknown>): Promise<string[]> {
    const hitos: HitosMap = { A4: { data: a4, status: "hecho" } };
    const { buffer } = await generarExcelF1("estrategia", { hitos, proceso });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    return (wb.worksheets[0].model.merges ?? []) as string[];
  }

  it("8 actividades de selección → «Fase de selección:» combinada en B135:B142", async () => {
    const sel = Array.from({ length: 8 }, (_, i) => ({ fase: "seleccion", actividad: `Act ${i + 1}` }));
    expect(await mergesDe({ cronograma_items: sel })).toContain("B135:B142");
  });

  it("con las 3 filas de plantilla, la selección se combina en B135:B137", async () => {
    const sel = Array.from({ length: 3 }, (_, i) => ({ fase: "seleccion", actividad: `Act ${i + 1}` }));
    expect(await mergesDe({ cronograma_items: sel })).toContain("B135:B137");
  });
});

// p) Roles: el bloque va a la izquierda y el rótulo (hasta ":") en negrita. Se
// localiza por texto porque el cronograma lo desplaza.
describe("p) roles · alineado a la izquierda y rótulos en negrita", () => {
  it("los rótulos van a la izquierda con la parte «…:» en negrita", async () => {
    const hitos: HitosMap = {
      A4: {
        data: {
          cronograma_items: Array.from({ length: 8 }, (_, i) => ({ fase: "seleccion", actividad: `Act ${i + 1}` })),
          roles_items: [{ rol: "Área usuaria: valida el requerimiento", etapa: "actos_preparatorios" }],
        },
        status: "hecho",
      },
    };
    const { buffer } = await generarExcelF1("estrategia", { hitos, proceso });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    // Localiza el rótulo de la tabla de roles (la fila se desplaza con el cronograma).
    let rHeader = 0;
    for (let r = 1; r <= ws.rowCount; r++) {
      const c = ws.getCell(`B${r}`);
      const v = (c.isMerged ? c.master : c).value as { richText?: { text: string }[] } | string | null;
      const t = (v && typeof v === "object" && v.richText ? v.richText.map((x) => x.text).join("") : String(v ?? "")).replace(/\s+/g, " ").trim();
      if (t === "Rol y responsabilidad:") rHeader = r;
    }
    expect(rHeader).toBeGreaterThan(0);
    const master = (r: number) => {
      const c = ws.getCell(`B${r}`);
      return c.isMerged ? c.master : c;
    };
    // Rótulo: izquierda + negrita.
    expect(master(rHeader).alignment?.horizontal).toBe("left");
    const rt = master(rHeader).value as { richText?: { text: string; font?: { bold?: boolean } }[] };
    expect(rt.richText?.every((run) => run.font?.bold)).toBe(true);
    // La fila de rol con "Área usuaria: …": izquierda, y solo la parte antes de ":" en negrita.
    const rol = master(rHeader + 1).value as { richText?: { text: string; font?: { bold?: boolean } }[] };
    const bolds = (rol.richText ?? []).filter((run) => run.font?.bold).map((run) => run.text).join("");
    expect(bolds).toContain("Área usuaria:");
    expect(bolds).not.toContain("valida");
  });

  it("q) agrupación y r) estandarizado: sus rótulos de tabla van izquierda + negrita", async () => {
    const hitos: HitosMap = {
      A4: {
        data: {
          cronograma_items: Array.from({ length: 8 }, (_, i) => ({ fase: "seleccion", actividad: `Act ${i + 1}` })),
        },
        status: "hecho",
      },
    };
    const { buffer } = await generarExcelF1("estrategia", { hitos, proceso });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    const texto = (r: number) => {
      const c = ws.getCell(`B${r}`);
      const m = c.isMerged ? c.master : c;
      const v = m.value as { richText?: { text: string }[] } | string | null;
      return (v && typeof v === "object" && v.richText ? v.richText.map((x) => x.text).join("") : String(v ?? "")).replace(/\s+/g, " ").trim();
    };
    const buscar = (t: string) => {
      for (let r = 1; r <= ws.rowCount; r++) if (texto(r) === t) return r;
      return 0;
    };
    for (const rotulo of [
      "Seleccionar el tipo de agrupación de prestaciones:",
      "Señalar si el requerimiento se encuentra estandarizado:",
    ]) {
      const r = buscar(rotulo);
      expect(r, rotulo).toBeGreaterThan(0);
      const c = ws.getCell(`B${r}`);
      const m = c.isMerged ? c.master : c;
      expect(m.alignment?.horizontal, rotulo).toBe("left");
      const rt = m.value as { richText?: { font?: { bold?: boolean } }[] };
      expect(rt.richText?.every((run) => run.font?.bold), rotulo).toBe(true);
    }
  });
});

describe("capitalizarProceso · normaliza el nombre del proceso al imprimir", () => {
  it("capitaliza la modalidad pero deja el objeto (bienes/obras/servicios) en minúscula", () => {
    expect(capitalizarProceso("Licitación Pública abreviada para bienes")).toBe(
      "Licitación Pública Abreviada para bienes",
    );
    expect(capitalizarProceso("Concurso Público de servicios")).toBe("Concurso Público de servicios");
    expect(capitalizarProceso("Licitación Pública de obras con negociación")).toBe(
      "Licitación Pública de obras con Negociación",
    );
  });

  it("respeta la primera palabra aunque sea conector/objeto, y tolera vacío", () => {
    expect(capitalizarProceso("de obras")).toBe("De obras");
    expect(capitalizarProceso("")).toBe("");
    expect(capitalizarProceso(null)).toBe("");
  });
});

// Los mapas casilla↔celda son una segunda lista paralela a las opciones del
// select. Si divergen no falla nada: la casilla sencillamente no se marca y el
// formato sale en blanco, en silencio. Es el mismo fallo que COLUMNAS_SEED.
describe("los mapas de casillas cubren TODAS las opciones del select", () => {
  it("h) modalidad de pago: las 11 opciones tienen celda", () => {
    for (const o of OPCIONES_MODALIDAD_PAGO) {
      expect(CELDA_MODALIDAD_PAGO[o.value], `falta la celda de "${o.value}"`).toBeTruthy();
    }
    expect(Object.keys(CELDA_MODALIDAD_PAGO)).toHaveLength(OPCIONES_MODALIDAD_PAGO.length);
  });

  it("e) tipo de evaluador: las 3 opciones tienen celda", () => {
    for (const o of OPCIONES_TIPO_EVALUADOR) {
      expect(CELDA_TIPO_EVALUADOR[o.value], `falta la celda de "${o.value}"`).toBeTruthy();
    }
    expect(Object.keys(CELDA_TIPO_EVALUADOR)).toHaveLength(OPCIONES_TIPO_EVALUADOR.length);
  });

  it("ninguna celda se repite entre opciones", () => {
    for (const mapa of [CELDA_MODALIDAD_PAGO, CELDA_TIPO_EVALUADOR]) {
      const celdas = Object.values(mapa);
      expect(new Set(celdas).size, `celdas duplicadas en ${JSON.stringify(mapa)}`).toBe(celdas.length);
    }
  });

  // La normativa de h) va a B70 (contrastada verbatim contra el RAG del
  // Reglamento). Solo `costo_reembolsable` queda fuera a propósito: no se localizó
  // una cita que lo defina como modalidad de pago.
  it("h) cada modalidad de pago (salvo costo reembolsable) tiene su normativa citada", () => {
    for (const o of OPCIONES_MODALIDAD_PAGO) {
      if (o.value === "costo_reembolsable") continue;
      expect(NORMA_MODALIDAD_PAGO[o.value], `falta la normativa de "${o.value}"`).toBeTruthy();
    }
  });

  it("las 7 de bienes/servicios citan el Art. 130 (a–g) y las 3 de contingencia el Art. 286", () => {
    for (const v of ["suma_alzada", "precios_unitarios", "esquema_mixto", "tarifas", "porcentajes", "honorario_fijo_comision", "pago_consumo"]) {
      expect(NORMA_MODALIDAD_PAGO[v], v).toContain("artículo 130.");
    }
    for (const v of ["pago_disponibilidad", "pago_activacion", "pago_mixto"]) {
      expect(NORMA_MODALIDAD_PAGO[v], v).toContain("artículo 286.");
    }
  });

  it("sustentoAlElegirModalidadPago precarga la norma pero respeta lo que escribió la DEC", () => {
    // Campo vacío → trae la norma de la modalidad.
    expect(sustentoAlElegirModalidadPago("suma_alzada", "")).toBe(NORMA_MODALIDAD_PAGO.suma_alzada);
    // Traía la norma de OTRA modalidad (sin editar) → la reemplaza por la nueva.
    expect(sustentoAlElegirModalidadPago("tarifas", NORMA_MODALIDAD_PAGO.suma_alzada)).toBe(
      NORMA_MODALIDAD_PAGO.tarifas,
    );
    // La DEC escribió algo propio → no se pisa.
    expect(sustentoAlElegirModalidadPago("suma_alzada", "Prestación única, precio cerrado.")).toBeNull();
    // Modalidad sin norma (obras: costo_reembolsable) → no propone nada.
    expect(sustentoAlElegirModalidadPago("costo_reembolsable", "")).toBeNull();
  });

  // La normativa de i) va a B83 (contrastada verbatim contra el RAG). `no_aplica`
  // y los de consultoría de obras (formulación/diseño) quedan fuera a propósito.
  it("i) los sistemas de entrega de bienes/servicios citan el Art. 129 y los de obras el Art. 158", () => {
    for (const v of ["llave_en_mano", "llave_en_mano_mantenimiento", "suministro_comodato", "diseno_operacion_mantenimiento", "gestion_instalaciones"]) {
      expect(NORMA_SISTEMA_ENTREGA[v], v).toContain("artículo 129.");
    }
    for (const v of ["solo_construccion", "diseno_construccion", "diseno_construccion_operacion_mantenimiento", "gestion_diseno_construccion_riesgo", "gestion_diseno_construccion_agencia", "entrega_integrada_alianza"]) {
      expect(NORMA_SISTEMA_ENTREGA[v], v).toContain("artículo 158.1.");
    }
  });

  it("sustentoAlElegirSistemaEntrega precarga la norma pero respeta lo que escribió la DEC", () => {
    expect(sustentoAlElegirSistemaEntrega("llave_en_mano", "")).toBe(NORMA_SISTEMA_ENTREGA.llave_en_mano);
    // Traía la norma de OTRO sistema (sin editar) → la reemplaza por la nueva.
    expect(sustentoAlElegirSistemaEntrega("solo_construccion", NORMA_SISTEMA_ENTREGA.llave_en_mano)).toBe(
      NORMA_SISTEMA_ENTREGA.solo_construccion,
    );
    // Texto propio de la DEC → no se pisa.
    expect(sustentoAlElegirSistemaEntrega("llave_en_mano", "Se oferta instalación y puesta en marcha.")).toBeNull();
    // Sistema sin norma (no_aplica) → no propone nada.
    expect(sustentoAlElegirSistemaEntrega("no_aplica", "")).toBeNull();
  });

  // q) El sustento de la agrupación cita el Art. 52 del Reglamento según la casilla
  // marcada: 52.1.a el paquete; 52.1.b los ítems/lotes/tramos; 52.2 la obligación
  // de sustentar el agrupamiento en la estrategia.
  it("q) el sustento de cada mecanismo de agrupación cita el Art. 52", () => {
    expect(NORMA_AGRUPACION.paquete).toContain("artículo 52.1.a");
    expect(NORMA_AGRUPACION.items).toContain("artículo 52.1.b");
    expect(NORMA_AGRUPACION.lotes).toContain("artículo 52.1.b");
    expect(NORMA_AGRUPACION.tramos).toContain("artículo 52.1.b");
    expect(NORMA_AGRUPACION.items).toContain("ítems");
    expect(NORMA_AGRUPACION.lotes).toContain("lotes");
    expect(NORMA_AGRUPACION.tramos).toContain("tramos");
    // 52.2: la DEC sustenta que agrupar es más eficiente que contratar por separado.
    for (const v of ["paquete", "items", "lotes", "tramos"]) {
      expect(NORMA_AGRUPACION[v], v).toContain("artículo 52.2");
    }
  });

  it("sustentoAlElegirAgrupacion precarga la norma pero respeta lo que escribió la DEC", () => {
    expect(sustentoAlElegirAgrupacion("paquete", "")).toBe(NORMA_AGRUPACION.paquete);
    // Traía la norma de OTRO mecanismo (sin editar) → la reemplaza por la nueva.
    expect(sustentoAlElegirAgrupacion("items", NORMA_AGRUPACION.paquete)).toBe(NORMA_AGRUPACION.items);
    // Texto propio de la DEC → no se pisa.
    expect(sustentoAlElegirAgrupacion("paquete", "Se agrupan por economía de escala.")).toBeNull();
  });

  it("sustentoAlElegirAgrupacion: sin tipo seleccionado ('Seleccionar'), el sustento pasa a NO CORRESPONDE", () => {
    // Vacío al elegir "Seleccionar" (nunca se tocó el campo) → se completa solo.
    expect(sustentoAlElegirAgrupacion("", "")).toBe("NO CORRESPONDE");
    // Volvió a "Seleccionar" desde un mecanismo (traía su norma, sin editar) → se refresca.
    expect(sustentoAlElegirAgrupacion("", NORMA_AGRUPACION.paquete)).toBe("NO CORRESPONDE");
    // Texto propio de la DEC con "Seleccionar" → no se pisa.
    expect(sustentoAlElegirAgrupacion("", "No aplica, se explica en el requerimiento.")).toBeNull();
  });
});

describe("Formato de Estrategia · casillas y campos perdidos", () => {
  it("marca la modalidad de pago y el tipo de evaluador", async () => {
    // Antes no se marcaba NI UNA casilla en todo el formato.
    const c = await hoja({ var_e_tipo_evaluador: "comite", var_h_modalidad_pago: "suma_alzada" });
    expect(c("F62")).toBe("X"); // Suma alzada
    expect(c("F37")).toBe("X"); // Comité
    expect(c("J62")).toBe(""); // y no otra
  });

  it("escribe el CUI que siembra la precarga desde el pedido SIGA", async () => {
    const c = await hoja({ cui: "2661009", si_es_inversion: "si" });
    expect(c(SI_NO_ESTRATEGIA.es_inversion.si)).toBe("X");
    expect(c("C19")).toBe("2661009");
  });

  it("no mete el texto de viabilidad en C19: ese campo pide solo el número", async () => {
    // C19 pide el CUI (número). El texto libre de var_c_viabilidad arrastra el
    // NOMBRE del proyecto ("186 MEJORAMIENTO…"), que no cabe en un campo de
    // número. Sin CUI real, C19 cae en el "NO CORRESPONDE." de los sustentos.
    const c = await hoja({
      si_es_inversion: "si",
      var_c_viabilidad: "Proyecto de inversión: 186 MEJORAMIENTO Y AMPLIACION DE LOS SERVICIOS",
    });
    expect(c("C19")).not.toContain("MEJORAMIENTO");
    expect(c("C19")).toBe("NO CORRESPONDE.");
  });

  it("marca los SÍ/NO tal y como se elijan en A4", async () => {
    // En el formato firmado por la entidad están TODOS marcados.
    const c = await hoja({ si_consumo_historico: "no", si_es_inversion: "si" });
    expect(c(SI_NO_ESTRATEGIA.es_inversion.si)).toBe("X");
    expect(c(SI_NO_ESTRATEGIA.es_inversion.no)).toBe("");
    expect(c(SI_NO_ESTRATEGIA.consumo_historico.no)).toBe("X");
  });

  it("no marca nada cuando el SÍ/NO se queda sin responder", async () => {
    // Las dos en blanco no significan "no": significan "sin analizar", y es la
    // vista previa la que debe delatarlo.
    const c = await hoja({});
    expect(c(SI_NO_ESTRATEGIA.es_inversion.si)).toBe("");
    expect(c(SI_NO_ESTRATEGIA.es_inversion.no)).toBe("");
  });

  it("r) se hereda de A3 y no se vuelve a preguntar en A4", async () => {
    // El área usuaria verifica la ficha técnica, la precarga la siembra en A3 y
    // A4 solo la imprime. Antes el mismo hecho tenía tres dueños.
    const { generarExcelF1 } = await import("@/lib/fase1-export");
    const { buffer } = await generarExcelF1("estrategia", {
      hitos: { A3: { data: { estandarizado: true }, status: "hecho" }, A4: { data: {}, status: "hecho" } },
      proceso,
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    const leer = (a: string) => String(ws.getCell(a).value ?? "").trim();
    expect(leer(SI_NO_ESTANDARIZADO.si)).toBe("X");
    expect(leer("H162")).toBe("X"); // Ficha técnica
    expect(leer("H163")).toBe(""); // y no la de homologación
  });

  it("A4 ya no tiene el campo si_estandarizado", () => {
    const campos = pasoF1("A4")!.campos.map((c) => c.name);
    expect(campos).not.toContain("si_estandarizado");
  });

  it("escribe NO CORRESPONDE en los sustentos que no aplican", async () => {
    // El formato firmado no deja el marcador "[Insertar sustento…]" ni la celda
    // vacía: escribe "NO CORRESPONDE".
    const c = await hoja({ var_s_objetivo: "Continuidad del SIAF" });
    expect(c("B7")).toBe("NO CORRESPONDE.");
    expect(c("B7")).not.toContain("[Insertar");
    expect(c("B166")).toBe("Continuidad del SIAF"); // el que sí se llenó, intacto
  });

  it("marca la clasificación de la segmentación desde A2, sin volver a preguntarla", async () => {
    // El 46.1.n solo manda VERIFICAR el tipo que determinó la segmentación:
    // pedirla otra vez en A4 invitaría a que los dos documentos se contradigan.
    const { generarExcelF1 } = await import("@/lib/fase1-export");
    const { buffer } = await generarExcelF1("estrategia", {
      hitos: {
        A2: { data: { condicionesRiesgo: [], cuantiaAlta: false, objeto: "bienes_servicios" }, status: "hecho" },
        A4: { data: {}, status: "hecho" },
      },
      proceso,
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    // Cuantía baja + sin riesgo → Rutinaria → D121.
    expect(String(ws.getCell("D121").value ?? "").trim()).toBe("X");
    expect(String(ws.getCell("D124").value ?? "").trim()).toBe("");
  });

});

describe("fallos que destapó la vista previa", () => {
  it("B70 antepone la NORMATIVA de la modalidad al sustento libre (nunca el value crudo)", async () => {
    // B70 es "[Insertar sustento de la elección de la modalidad de pago]": lleva la
    // normativa de la modalidad seleccionada (Art. 130.a para suma alzada) y el
    // sustento que escribió la DEC. La modalidad en sí ya se marca en su casilla.
    const c = await hoja({ var_h_modalidad_pago: "suma_alzada", var_h_sustento_pago: "Prestación única y precio cerrado." });
    expect(c("F62")).toBe("X");
    expect(c("B70")).toBe(
      "La modalidad de pago se rige por la modalidad de Suma alzada de conformidad con el artículo 130.a del Reglamento.\nPrestación única y precio cerrado.",
    );
    expect(c("B70")).not.toBe("suma_alzada");
  });

  it("B70 no duplica la norma cuando el sustento ya la trae (auto-carga de A4)", async () => {
    // Al elegir la modalidad, el sustento se auto-carga con su norma. Si la DEC la
    // deja tal cual, B70 la consigna UNA vez, no dos.
    const norma =
      "La modalidad de pago se rige por la modalidad de Suma alzada de conformidad con el artículo 130.a del Reglamento.";
    const c = await hoja({ var_h_modalidad_pago: "suma_alzada", var_h_sustento_pago: norma });
    expect(c("B70")).toBe(norma);
  });

  it("B70 sin sustento libre lleva solo la normativa de la modalidad", async () => {
    const c = await hoja({ var_h_modalidad_pago: "precios_unitarios" });
    expect(c("B70")).toBe(
      "La modalidad de pago se rige por la modalidad de Precios unitarios de conformidad con el artículo 130.b del Reglamento.",
    );
  });

  it("B83 antepone la NORMATIVA del sistema de entrega al sustento libre (nunca el value crudo)", async () => {
    // Antes B83 recibía el value crudo del select ("llave_en_mano"). Ahora lleva la
    // norma (Art. 129.a) y, debajo, lo que escribió la DEC.
    const c = await hoja({ var_i_sistema_entrega: "llave_en_mano", var_i_sustento_entrega: "El proveedor instala y pone en marcha." });
    expect(c("B83")).toBe(
      "El sistema de entrega se rige por el sistema de Llave en mano de conformidad con el artículo 129.a del Reglamento.\nEl proveedor instala y pone en marcha.",
    );
    expect(c("B83")).not.toBe("llave_en_mano");
  });

  it("B83 no duplica la norma cuando el sustento ya la trae (auto-carga de A4)", async () => {
    const norma =
      "El sistema de entrega se rige por el sistema de Llave en mano de conformidad con el artículo 129.a del Reglamento.";
    const c = await hoja({ var_i_sistema_entrega: "llave_en_mano", var_i_sustento_entrega: norma });
    expect(c("B83")).toBe(norma);
  });

  it("B83 sin sustento libre lleva solo la normativa del sistema de entrega", async () => {
    const c = await hoja({ var_i_sistema_entrega: "solo_construccion" });
    expect(c("B83")).toBe(
      "El sistema de entrega se rige por el sistema de Solo construcción de conformidad con el artículo 158.1.a del Reglamento.",
    );
  });

  it("lee el texto enriquecido de la plantilla sin imprimir [object Object]", async () => {
    // Las plantillas traen celdas con richText: `String(cell.value)` da
    // "[object Object]" y ensuciaba la vista previa.
    const { previewEstrategia } = await import("@/lib/fase1-export");
    const r = await previewEstrategia({
      hitos: { A4: { data: { var_s_objetivo: "Continuidad del SIAF" }, status: "hecho" } },
      proceso,
    });
    for (const s of r.sustentos) {
      expect(s.texto, `${s.titulo} trae un objeto sin serializar`).not.toContain("[object Object]");
    }
  });
});

describe("los SÍ/NO del formato tienen su campo en A4", () => {
  it("cada clave de SI_NO_ESTRATEGIA existe como campo si_<clave>", () => {
    // El exportador busca `si_${clave}` en A4. Si la clave del mapa y el nombre
    // del campo divergen, no falla nada: la casilla sencillamente no se marca,
    // en silencio. Pasó de verdad con `usa_modalidad_eficiente` vs
    // `si_modalidad_eficiente`, y lo cazó la vista previa, no un test.
    const campos = new Set(pasoF1("A4")!.campos.map((c) => c.name));
    for (const clave of Object.keys(SI_NO_ESTRATEGIA)) {
      expect(campos.has(`si_${clave}`), `falta el campo "si_${clave}" en A4`).toBe(true);
    }
  });

  it("cada SÍ/NO tiene sus dos etiquetas para la vista previa", () => {
    for (const [clave, celdas] of Object.entries(SI_NO_ESTRATEGIA)) {
      expect(ETIQUETAS_ESTRATEGIA[celdas.si], `falta la etiqueta SÍ de ${clave}`).toBeTruthy();
      expect(ETIQUETAS_ESTRATEGIA[celdas.no], `falta la etiqueta NO de ${clave}`).toBeTruthy();
    }
  });

  it("ninguna casilla SÍ/NO comparte celda con otra", () => {
    const celdas = Object.values(SI_NO_ESTRATEGIA).flatMap((c) => [c.si, c.no]);
    expect(new Set(celdas).size).toBe(celdas.length);
  });
});

describe("d), q), t), l): los mapas nuevos no divergen", () => {
  it("cada opción de modalidad eficiente y agrupación tiene celda", async () => {
    const { CELDA_AGRUPAR, CELDA_MODALIDAD_EFICIENTE, OPCIONES_AGRUPACION, OPCIONES_MODALIDAD_EFICIENTE } =
      await import("@/lib/estrategia-formato");
    for (const o of OPCIONES_MODALIDAD_EFICIENTE) {
      expect(CELDA_MODALIDAD_EFICIENTE[o.value], o.value).toBeTruthy();
    }
    for (const o of OPCIONES_AGRUPACION) expect(CELDA_AGRUPAR[o.value], o.value).toBeTruthy();
  });

  it("cada campo de t) existe en A4, y l) es la tabla de adelantos consolidada", async () => {
    // Si el nombre del campo y el del mapa divergen, la casilla no se marca y
    // no falla nada: el fallo COLUMNAS_SEED otra vez.
    const { OTRAS_VARIABLES_CAMPOS } = await import("@/lib/estrategia-formato");
    const campos = pasoF1("A4")!.campos;
    const nombres = new Set(campos.map((c) => c.name));
    for (const v of OTRAS_VARIABLES_CAMPOS) expect(nombres.has(v.campo), v.campo).toBe(true);
    // l) ya no son campos planos por fila: es un solo campo `adelantos_items` (tabla).
    expect(campos.find((c) => c.name === "adelantos_items")?.tipo).toBe("adelantos");
  });

  it("marca la fila de adelanto (desde adelantos_items) con su mecanismo y porcentaje", async () => {
    const c = await hoja({
      si_garantia_adelantos: "si",
      adelantos_items: [
        { prefijo: "adelanto_directo", marcar: true, mecanismo: "Carta fianza", pct: "10%" },
        { prefijo: "adelanto_materiales", marcar: false },
      ],
    });
    expect(c("D108")).toBe("X");
    expect(c("E108")).toBe("Carta fianza");
    expect(c("I108")).toBe("10%");
    expect(c("D109")).toBe(""); // las filas no marcadas quedan libres
  });

  it("respaldo: un expediente antiguo con campos planos de adelanto sigue exportando", async () => {
    const c = await hoja({
      si_garantia_adelantos: "si",
      adelanto_directo: true,
      adelanto_directo_mecanismo: "Carta fianza",
      adelanto_directo_pct: "10%",
    });
    expect(c("D108")).toBe("X");
    expect(c("E108")).toBe("Carta fianza");
    expect(c("I108")).toBe("10%");
  });

  it("el sustento de B112 se DERIVA de los adelantos marcados en la tabla", async () => {
    const { sustentoAdelantos } = await import("@/lib/estrategia-formato");
    const t = sustentoAdelantos([
      { prefijo: "adelanto_directo", marcar: true, mecanismo: "Carta fianza", pct: "10%" },
      { prefijo: "adelanto_materiales", marcar: false },
    ]);
    expect(t).toBe("Adelanto directo: Carta fianza, 10%.");
    // Sin ninguno marcado, vacío (el exportador cae al respaldo / NO CORRESPONDE).
    expect(sustentoAdelantos([{ prefijo: "adelanto_directo", marcar: false }])).toBe("");
    // Una fila "solo obras" no cuenta fuera de obras (esObras=false).
    expect(
      sustentoAdelantos([{ prefijo: "adelanto_materiales", marcar: true, mecanismo: "Carta fianza" }], false),
    ).toBe("");
  });

  it("las filas «solo obras» solo se marcan en obras (nota (*) del formato)", async () => {
    const items = [{ prefijo: "adelanto_materiales", marcar: true, mecanismo: "Carta fianza", pct: "20%" }];
    // Servicios (objeto por defecto de `hoja`): el adelanto de materiales NO se vuelca.
    expect((await hoja({ adelantos_items: items }))("D109")).toBe("");
    // Obras: el mismo adelanto SÍ se vuelca.
    const { buffer } = await generarExcelF1("estrategia", {
      hitos: { A4: { data: { adelantos_items: items }, status: "hecho" } },
      proceso: { ...proceso, object_type: "obra" },
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    const cell = (a: string) => {
      const c = ws.getCell(a);
      return String((c.isMerged ? c.master : c).value ?? "").trim();
    };
    expect(cell("D109")).toBe("X");
    expect(cell("E109")).toBe("Carta fianza");
  });

  it("B112: la tabla manda; si no hay adelantos marcados, cae a la propuesta sembrada", async () => {
    const conTabla = await hoja({
      adelantos_items: [{ prefijo: "adelanto_directo", marcar: true, mecanismo: "Carta fianza", pct: "10%" }],
      var_l_garantias_adelantos: "Propuesta del área usuaria: No corresponde.",
    });
    expect(conTabla("B112")).toBe("Adelanto directo: Carta fianza, 10%.");
    const sinTabla = await hoja({ var_l_garantias_adelantos: "Propuesta del área usuaria: No corresponde." });
    expect(sinTabla("B112")).toBe("Propuesta del área usuaria: No corresponde.");
  });
});

// e) Sustento de la elección del tipo de evaluador (celda B40 del formato). Se
// sugiere un texto por tipo (oficial de compra / comité / jurado) que la DEC
// adopta con un botón; una vez en el campo, debe exportarse a B40.
describe("sustento sugerido del tipo de evaluador", () => {
  it("hay un sustento para cada uno de los tres tipos del select", () => {
    for (const o of OPCIONES_TIPO_EVALUADOR) {
      expect(SUSTENTO_EVALUADOR_SUGERIDO[o.value], o.value).toBeTruthy();
    }
  });

  it("el sustento adoptado se exporta a B40 (rótulo de la elección del evaluador)", async () => {
    const c = await hoja({
      var_e_tipo_evaluador: "oficial_compra",
      var_e_perfil_evaluador: SUSTENTO_EVALUADOR_SUGERIDO.oficial_compra,
    });
    expect(c("B40")).toContain("Oficial de Compra");
    expect(c("F36")).toBe("X"); // y marca la casilla del oficial de compra
  });

  it("cada tipo trae su propio fundamento, no un texto genérico", () => {
    expect(SUSTENTO_EVALUADOR_SUGERIDO.comite).toContain("Comité");
    expect(SUSTENTO_EVALUADOR_SUGERIDO.jurado).toContain("Jurado");
    expect(SUSTENTO_EVALUADOR_SUGERIDO.oficial_compra).not.toContain("Comité");
  });
});

// g) Nombre del factor: desplegable de opciones estándar + "Otro (especificar)".
describe("opciones del factor de evaluación (g)", () => {
  it("la lista tiene opciones, sin duplicados", () => {
    expect(OPCIONES_FACTOR_EVALUACION.length).toBeGreaterThan(0);
    expect(new Set(OPCIONES_FACTOR_EVALUACION).size).toBe(OPCIONES_FACTOR_EVALUACION.length);
  });

  it("incluye Precio (factor típico)", () => {
    expect(OPCIONES_FACTOR_EVALUACION).toContain("Precio");
  });

  it("FACTOR_OTRO no es un factor real (es el escape para texto libre)", () => {
    expect((OPCIONES_FACTOR_EVALUACION as readonly string[]).includes(FACTOR_OTRO)).toBe(false);
  });

  it("incluye los factores de las bases estándar OECE que faltaban", async () => {
    const { OPCIONES_FACTOR_EVALUACION } = await import("@/lib/estrategia-formato");
    for (const f of ["Integridad en la contratación pública", "Mantenimiento preventivo", "Sostenibilidad social"]) {
      expect(OPCIONES_FACTOR_EVALUACION as readonly string[], f).toContain(f);
    }
  });

  it("cada factor de la lista tiene su sustento sugerido (no se añade uno sin él)", async () => {
    const { OPCIONES_FACTOR_EVALUACION, SUSTENTO_FACTOR_SUGERIDO } = await import("@/lib/estrategia-formato");
    for (const f of OPCIONES_FACTOR_EVALUACION) {
      expect(SUSTENTO_FACTOR_SUGERIDO[f], `falta el sustento de "${f}"`).toBeTruthy();
    }
  });

  it("un factor elegido de la lista se exporta a la tabla g) del formato", async () => {
    const c = await hoja({ factores_items: [{ nombre: "Precio", sustento: "Menor precio ofertado" }] });
    expect(c("B56")).toBe("Precio");
    expect(c("C56")).toBe("Menor precio ofertado");
  });

  it("reconoce el factor aunque el nombre se escriba a mano (sin distinguir mayúsculas ni tildes)", async () => {
    const { factorCanonicoDeNombre } = await import("@/lib/estrategia-formato");
    // El caso pedido: "Mejora en las EE.TT." tecleado a mano, con variaciones.
    expect(factorCanonicoDeNombre("mejora en las ee.tt.")).toBe("Mejora en las EE.TT.");
    expect(factorCanonicoDeNombre("  MEJORA  EN LAS EE.TT. ")).toBe("Mejora en las EE.TT.");
    // Con tildes de por medio: "Metodología" escrito sin tilde igual reconoce.
    expect(factorCanonicoDeNombre("metodologia o plan de trabajo")).toBe("Metodología o plan de trabajo");
    // Un factor libre que no está en el catálogo no se reconoce.
    expect(factorCanonicoDeNombre("Cercanía del proveedor")).toBeNull();
    expect(factorCanonicoDeNombre("")).toBeNull();
  });

  it("el nombre canónico reconocido es SIEMPRE una opción del desplegable (para salir del modo «Otro»)", async () => {
    // Al normalizar el nombre a mano, la fila vuelve al desplegable: el canónico
    // debe existir en la lista o el editor lo dejaría como texto libre vacío.
    const { factorCanonicoDeNombre, OPCIONES_FACTOR_EVALUACION } = await import("@/lib/estrategia-formato");
    for (const escrito of ["mejora en las ee.tt.", "PRECIO", "sostenibilidad ambiental"]) {
      const canonico = factorCanonicoDeNombre(escrito);
      expect(canonico, escrito).not.toBeNull();
      expect(OPCIONES_FACTOR_EVALUACION as readonly string[]).toContain(canonico!);
    }
  });

  it("el nombre escrito a mano precarga el sustento oficial (respetando lo ya escrito)", async () => {
    const { factorCanonicoDeNombre, sustentoAlElegirFactor, SUSTENTO_FACTOR_SUGERIDO } = await import(
      "@/lib/estrategia-formato"
    );
    // Reproduce lo que hace el editor al salir del campo (onBlur) con el sustento vacío.
    const canonico = factorCanonicoDeNombre("mejora en las EE.TT.")!;
    expect(sustentoAlElegirFactor(canonico, "")).toBe(SUSTENTO_FACTOR_SUGERIDO["Mejora en las EE.TT."]);
    // Si la DEC ya escribió su propio sustento, no se pisa.
    expect(sustentoAlElegirFactor(canonico, "Mi sustento propio")).toBeNull();
  });
});

// j) Puntos no negociables: tabla de 2 columnas → puntos a C87, sustentos a C88.
describe("j) puntos no negociables (2 columnas)", () => {
  it("vuelca los puntos a C87 y los sustentos a C88, numerados y correspondidos", async () => {
    const c = await hoja({
      var_j_puntos_no_negociables: [
        { punto: "Plazo de entrega de 30 días", sustento: "Continuidad del servicio" },
        { punto: "Garantía mínima de 12 meses", sustento: "Periodo de operación inicial" },
      ],
    });
    expect(c("C87")).toBe("1. Plazo de entrega de 30 días\n2. Garantía mínima de 12 meses");
    expect(c("C88")).toBe("1. Continuidad del servicio\n2. Periodo de operación inicial");
  });

  it("con un solo punto no numera", async () => {
    const c = await hoja({ var_j_puntos_no_negociables: [{ punto: "Único punto", sustento: "Su razón" }] });
    expect(c("C87")).toBe("Único punto");
    expect(c("C88")).toBe("Su razón");
  });

  it("migra un valor de texto heredado (j) era textarea) a un solo punto", async () => {
    const c = await hoja({ var_j_puntos_no_negociables: "El precio no es negociable" });
    expect(c("C87")).toBe("El precio no es negociable");
  });

  it("j) es una tabla de puntos en A4, no un textarea", () => {
    const campo = pasoF1("A4")!.campos.find((x) => x.name === "var_j_puntos_no_negociables");
    expect(campo?.tipo).toBe("puntos");
  });

  it("al elegir «NO CORRESPONDE» el sustento también es «NO CORRESPONDE»; un punto real no trae plantilla", async () => {
    const { sustentoAlElegirPunto, PUNTO_NO_CORRESPONDE } = await import("@/lib/estrategia-formato");
    expect(sustentoAlElegirPunto(PUNTO_NO_CORRESPONDE)).toBe("NO CORRESPONDE");
    expect(sustentoAlElegirPunto("El plazo de entrega no es negociable")).toBeNull();
  });

  it("una fila «NO CORRESPONDE» se exporta tal cual a C87/C88 (sin numerar)", async () => {
    const c = await hoja({
      var_j_puntos_no_negociables: [{ punto: "NO CORRESPONDE", sustento: "NO CORRESPONDE" }],
    });
    expect(c("C87")).toBe("NO CORRESPONDE");
    expect(c("C88")).toBe("NO CORRESPONDE");
  });
});

// La vista previa lista las casillas marcadas en orden de variable (a→t), no en
// orden de celda: sin ordenar salían jumbled (l, m, n, c, c, d…).
describe("orden de la vista previa (marcas)", () => {
  it("las casillas marcadas se ordenan por letra de variable", async () => {
    const { previewEstrategia } = await import("@/lib/fase1-export");
    const p = await previewEstrategia({
      proceso,
      hitos: {
        A4: { data: { si_es_inversion: "si", var_e_tipo_evaluador: "comite", si_consumo_historico: "no", agrupacion_tipo: "paquete" }, status: "hecho" },
      },
    });
    const letras = p.marcas.map((m) => m.etiqueta.match(/^([a-z])\)/i)?.[1] ?? "z");
    const ordenado = [...letras].sort();
    expect(letras).toEqual(ordenado);
  });
});

// p) Roles y responsabilidades (Art. 46.1.p): desplegable de involucrados y
// siembra de roles habituales, que se vuelcan a la tabla del formato (B145+/F).
describe("p) roles y responsabilidades", () => {
  it("hay roles habituales con involucrado, responsabilidad y etapa válida", async () => {
    const { ROLES_HABITUALES, ETAPAS_ROL } = await import("@/lib/estrategia-formato");
    expect(ROLES_HABITUALES.length).toBeGreaterThan(0);
    const etapas = new Set(ETAPAS_ROL.map((e) => e.value));
    for (const r of ROLES_HABITUALES) {
      expect(r.involucrado.trim().length).toBeGreaterThan(0);
      expect(r.responsabilidad.trim().length).toBeGreaterThan(0);
      expect(etapas.has(r.etapa), `etapa "${r.etapa}"`).toBe(true);
    }
  });

  it("un rol sembrado se exporta a la tabla del formato (B145, etapa en F145)", async () => {
    const { ROLES_HABITUALES, ETAPAS_ROL, textoRolHabitual } = await import("@/lib/estrategia-formato");
    const rol = ROLES_HABITUALES[0];
    const c = await hoja({ roles_items: [{ rol: textoRolHabitual(rol), etapa: rol.etapa }] });
    expect(c("B145")).toContain(rol.involucrado);
    expect(c("F145")).toBe(ETAPAS_ROL.find((e) => e.value === rol.etapa)!.label);
  });

  it("rolesDe especializa la fila del EVALUADOR según el tipo de e) (Cuadro N° 6)", async () => {
    const { rolesDe } = await import("@/lib/estrategia-formato");
    const evaluadorDe = (tipo?: string) => rolesDe(tipo).find((r) => r.involucrado.startsWith("Evaluador"))!;
    expect(evaluadorDe("oficial_compra").involucrado).toContain("Oficial de compra");
    expect(evaluadorDe("comite").involucrado).toContain("Comité");
    const jurado = evaluadorDe("jurado");
    expect(jurado.involucrado).toContain("Jurado");
    // Regla propia del jurado: solo evalúa; la DEC hace el resto.
    expect(jurado.responsabilidad.toLowerCase()).toContain("solo");
    // Sin tipo, la fila queda genérica (los tres tipos).
    expect(evaluadorDe().involucrado.toLowerCase()).toContain("oficial de compra / comité");
  });

  it("modeloRolesP arma el modelo por etapa, adaptado a proceso/objeto/evaluador", async () => {
    const { modeloRolesP } = await import("@/lib/estrategia-formato");
    const m = modeloRolesP({
      proceso: "Licitación Pública abreviada para bienes",
      objeto: "bienes",
      tipoEvaluador: "oficial_compra",
    });
    // Las cuatro etapas de la fase de selección, en orden (ejecución contractual
    // trae dos filas: área usuaria y DEC, Art. 14.2.i/k del Reglamento).
    expect(m.map((r) => r.etapa)).toEqual([
      "actos_preparatorios",
      "actos_preparatorios",
      "convocatoria",
      "post_convocatoria",
      "ejecucion_contractual",
      "ejecucion_contractual",
    ]);
    // Área usuaria: cita el proceso y, en bienes, las Fichas Técnicas del LBSC.
    expect(m[0].rol).toContain("Licitación Pública abreviada para bienes");
    expect(m[0].rol).toContain("Especificaciones Técnicas");
    expect(m[0].rol).toContain("Listado de Bienes y Servicios Comunes");
    // Convocatoria: el oficial de compra conduce el procedimiento.
    expect(m[2].rol).toContain("Oficial de compra");
    expect(m[2].rol).toContain("Conducción del procedimiento");
    // Ejecución contractual: la DEC también monitorea/evalúa TODOS los contratos.
    expect(m[5].rol).toContain("Dependencia Encargada de las Contrataciones (DEC)");
    expect(m[5].rol).toContain("Monitoreo de la ejecución");
  });

  it("modeloRolesP: en servicios usa TDR, y el jurado solo evalúa (la DEC conduce)", async () => {
    const { modeloRolesP } = await import("@/lib/estrategia-formato");
    const serv = modeloRolesP({ proceso: "Concurso Público de servicios", objeto: "servicios" });
    expect(serv[0].rol).toContain("Términos de Referencia");
    expect(serv[0].rol).not.toContain("Fichas Técnicas");
    const jurado = modeloRolesP({ objeto: "servicios", tipoEvaluador: "jurado" });
    expect(jurado[2].rol).toContain("Jurado");
    expect(jurado[2].rol.toLowerCase()).toContain("solo");
    expect(jurado[2].rol).toContain("DEC");
  });

  it("esModeloRolesP reconoce el modelo sin editar y rechaza uno editado (para refrescar el proceso de a))", async () => {
    const { modeloRolesP, esModeloRolesP } = await import("@/lib/estrategia-formato");
    const m = modeloRolesP({ proceso: "Concurso Público abreviado", objeto: "servicios", tipoEvaluador: "comite" });
    // Recién generado con esos mismos objeto/evaluador: se reconoce como nuestro.
    expect(esModeloRolesP(m, "servicios", "comite")).toBe(true);
    // Si la DEC edita cualquier fila, deja de reconocerse (se respeta).
    const editado = m.map((r, i) => (i === 2 ? { ...r, rol: "Mi redacción propia del evaluador." } : r));
    expect(esModeloRolesP(editado, "servicios", "comite")).toBe(false);
    // La fila 0 sigue extrayendo el proceso: un modelo con OTRO proceso también es nuestro
    // (permitirá refrescar la mención de a) sin pisar lo editado).
    const otroProceso = modeloRolesP({ proceso: "Licitación Pública abreviada para bienes", objeto: "servicios", tipoEvaluador: "comite" });
    expect(esModeloRolesP(otroProceso, "servicios", "comite")).toBe(true);
  });
});

describe("A4 · variable de obras 154.1.i) metodologías colaborativas", () => {
  it("la variable i) existe en el catálogo con su base legal", () => {
    const campo = pasoF1("A4")!.campos.find((c) => c.name === "obra_i_metodologias_colaborativas");
    expect(campo, "falta la variable i)").toBeTruthy();
    expect(campo!.baseLegal).toContain("154.1.i");
  });

  it("i) se vuelca a la celda B249 del formato", async () => {
    const c = await hoja({ obra_i_metodologias_colaborativas: "Se empleará Lean Construction y VDC." });
    expect(c("B249")).toContain("Lean Construction");
  });
});

describe("A4 · sustentos de obra (Art. 154): vacío → NO CORRESPONDE., nunca el marcador", () => {
  it("un expediente sin datos de obra no arrastra los marcadores '[Insertar…]'", async () => {
    const c = await hoja({});
    for (const celda of ["B197", "B203", "B211", "B216", "B221", "B230", "B236", "B241", "B249"]) {
      expect(c(celda), `${celda}`).toBe("NO CORRESPONDE.");
    }
  });

  it("un sustento de obra realmente escrito NO se pisa con NO CORRESPONDE.", async () => {
    const c = await hoja({ obra_a_tipo_contrato: "Contrato a suma alzada.", obra_i_metodologias_colaborativas: "VDC." });
    expect(c("B197")).toContain("suma alzada");
    expect(c("B249")).toContain("VDC");
  });
});

describe("A4 · k) la cuantía actualizada se hereda de A5 (Art. 47.1)", () => {
  async function conHitos(hitos: HitosMap) {
    const { buffer } = await generarExcelF1("estrategia", { hitos, proceso });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    return (addr: string) => {
      const c = ws.getCell(addr);
      const t = c.isMerged ? c.master : c;
      return t.value == null ? "" : String(t.value).trim();
    };
  }

  it("si A4 no reescribe k), B98 cae al sustento de A5 y marca k)=SÍ (F96)", async () => {
    const c = await conHitos({
      A4: { data: {}, status: "hecho" },
      A5: {
        data: { nivel: "indagacion_basica", cuantia_actualizada: 118500, resultado_cuantia: "El estimado baja tras tres cotizaciones." },
        status: "hecho",
      },
    });
    expect(c("B98")).toContain("tres cotizaciones");
    expect(c("F96")).toBe("X"); // k) La cuantía se actualizó: SÍ
  });

  it("si A4 ya escribió su k), manda A4 (no lo pisa A5)", async () => {
    const c = await conHitos({
      A4: { data: { var_k_financiamiento_cuantia: "Sustento propio de la DEC." }, status: "hecho" },
      A5: { data: { nivel: "indagacion_basica", cuantia_actualizada: 118500, resultado_cuantia: "Texto de A5." }, status: "hecho" },
    });
    expect(c("B98")).toContain("Sustento propio de la DEC");
    expect(c("B98")).not.toContain("Texto de A5");
  });
})

describe("o) cronograma · la fila de ejecución contractual anota el plazo del requerimiento", () => {
  it("compone el plazo con su unidad, enriquece SOLO la ejecución y sigue siendo 'según bases'", async () => {
    const { textoEjecucionConPlazo, actividadesEjecucionDe, esActividadSegunBases } = await import(
      "@/lib/estrategia-formato"
    );
    expect(textoEjecucionConPlazo(60, "calendario")).toBe("Ejecución contractual (plazo: 60 días calendario)");
    expect(textoEjecucionConPlazo(45, "habiles")).toBe("Ejecución contractual (plazo: 45 días hábiles)");
    // Sin plazo (o 0), el rótulo queda como estaba.
    expect(textoEjecucionConPlazo(null, "calendario")).toBe("Ejecución contractual");
    expect(textoEjecucionConPlazo(0, "habiles")).toBe("Ejecución contractual");

    const acts = actividadesEjecucionDe(60, "calendario");
    const ejec = acts.find((a) => a.includes("Ejecución contractual"))!;
    expect(ejec).toContain("plazo: 60 días calendario");
    // El export sigue poniendo SEGÚN BASES en inicio/fin de esa fila.
    expect(esActividadSegunBases(ejec)).toBe(true);
    // Las demás actividades de ejecución no se tocan.
    expect(acts).toContain("Suscripción del contrato");
  });
})

describe("Formato de Estrategia · el bloque de obras (Art. 154) se oculta si no es obra", () => {
  async function wsDe(objectType: string) {
    const { buffer } = await generarExcelF1("estrategia", {
      hitos: { A4: { data: {}, status: "hecho" } },
      proceso: { ...proceso, object_type: objectType },
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    return wb.worksheets[0];
  }
  const norm = (v: unknown) =>
    (v == null ? "" : typeof v === "object" ? ((v as { richText?: { text?: string }[]; text?: string }).richText?.map((r) => r.text).join("") ?? (v as { text?: string }).text ?? "") : String(v))
      .replace(/\s+/g, " ")
      .toUpperCase();
  const filaDe = (ws: ExcelJS.Worksheet, frag: string) => {
    for (let r = 1; r <= ws.rowCount; r++) for (let c = 1; c <= 3; c++) if (norm(ws.getCell(r, c).value).includes(frag)) return r;
    return -1;
  };

  it("en un BIEN: se oculta desde 'II. SOLO PARA OBRAS' hasta antes de 'III. OTRAS CONSIDERACIONES'", async () => {
    const ws = await wsDe("bienes");
    const ini = filaDe(ws, "SOLO PARA OBRAS Y CONSULTOR");
    const fin = filaDe(ws, "III. OTRAS CONSIDERACIONES");
    expect(ini).toBeGreaterThan(0);
    expect(fin).toBeGreaterThan(ini);
    expect(ws.getRow(ini).hidden).toBe(true); // el encabezado del bloque
    expect(ws.getRow(fin - 1).hidden).toBe(true); // la última fila de obras
    expect(Boolean(ws.getRow(fin).hidden)).toBe(false); // III. Otras consideraciones NO se oculta
    expect(Boolean(ws.getRow(filaDe(ws, "FECHA DE ELABORACI")).hidden)).toBe(false); // la fecha tampoco
  });

  it("en una OBRA: el bloque se muestra (no se oculta)", async () => {
    const ws = await wsDe("obra");
    const ini = filaDe(ws, "SOLO PARA OBRAS Y CONSULTOR");
    expect(Boolean(ws.getRow(ini).hidden)).toBe(false);
  });

  it("en una CONSULTORÍA DE OBRA: el bloque se muestra", async () => {
    const ws = await wsDe("consultoria_obra");
    const ini = filaDe(ws, "SOLO PARA OBRAS Y CONSULTOR");
    expect(Boolean(ws.getRow(ini).hidden)).toBe(false);
  });
})

describe("II) ¿la cuantía es punto de referencia? (Art. 48.2 Ley · 165 · 166 · 98)", () => {
  async function celda(objectType: string, a4: Record<string, unknown>) {
    const { buffer } = await generarExcelF1("estrategia", {
      hitos: { A4: { data: a4, status: "hecho" } },
      proceso: { ...proceso, object_type: objectType },
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    return (a: string) => String(ws.getCell(a).value ?? "").trim();
  }

  it("OBRA bajo 'solo construcción' → SÍ (Art. 165)", async () => {
    const c = await celda("obra", { var_i_sistema_entrega: "solo_construccion" });
    expect(c(SI_NO_ESTRATEGIA.cuantia_referencia.si)).toBe("X");
    expect(c(SI_NO_ESTRATEGIA.cuantia_referencia.no)).toBe("");
  });

  it("OBRA bajo 'diseño y construcción' → SÍ (Art. 166.1/166.2: el rubro ejecución queda fijo al 100%)", async () => {
    const c = await celda("obra", { var_i_sistema_entrega: "diseno_construccion" });
    expect(c(SI_NO_ESTRATEGIA.cuantia_referencia.si)).toBe("X");
    expect(c(SI_NO_ESTRATEGIA.cuantia_referencia.no)).toBe("");
  });

  it("OBRA bajo 'diseño, construcción, operación y mantenimiento' → SÍ (Art. 166.2 último párrafo)", async () => {
    const c = await celda("obra", { var_i_sistema_entrega: "diseno_construccion_operacion_mantenimiento" });
    expect(c(SI_NO_ESTRATEGIA.cuantia_referencia.si)).toBe("X");
    expect(c(SI_NO_ESTRATEGIA.cuantia_referencia.no)).toBe("");
  });

  it("CONSULTORÍA DE OBRA 'solo formulación o solo diseño' → SÍ (Art. 166.4, mínimo 90%)", async () => {
    const c = await celda("consultoria_obra", { var_i_sistema_entrega: "solo_formulacion_o_diseno" });
    expect(c(SI_NO_ESTRATEGIA.cuantia_referencia.si)).toBe("X");
    expect(c(SI_NO_ESTRATEGIA.cuantia_referencia.no)).toBe("");
  });

  it("Concurso Público abreviado para expertos y gerentes de proyecto → SÍ (Art. 134.1), aunque el objeto sea servicios", async () => {
    const c = await celda("servicios", { var_a_proceso: PROCESO_EXPERTOS_GERENTES_PROYECTO });
    expect(c(SI_NO_ESTRATEGIA.cuantia_referencia.si)).toBe("X");
    expect(c(SI_NO_ESTRATEGIA.cuantia_referencia.no)).toBe("");
  });

  it("Concurso de Proyectos Arquitectónicos y Urbanísticos → SÍ (Art. 135.1), aunque i) no se haya llenado", async () => {
    const c = await celda("obra", { var_a_proceso: PROCESO_CONCURSO_ARQUITECTONICO });
    expect(c(SI_NO_ESTRATEGIA.cuantia_referencia.si)).toBe("X");
    expect(c(SI_NO_ESTRATEGIA.cuantia_referencia.no)).toBe("");
  });

  it("un BIEN (comparación de precios se evalúa por menor monto, Art. 98) → NO", async () => {
    const c = await celda("bienes", {});
    expect(c(SI_NO_ESTRATEGIA.cuantia_referencia.no)).toBe("X");
    expect(c(SI_NO_ESTRATEGIA.cuantia_referencia.si)).toBe("");
  });

  it(
    "OBRA en gestión al riesgo/de agencia o entrega integrada → NO (Art. 166.3: reglas generales)",
    async () => {
      for (const sistema of ["gestion_diseno_construccion_riesgo", "gestion_diseno_construccion_agencia", "entrega_integrada_alianza"]) {
        const c = await celda("obra", { var_i_sistema_entrega: sistema });
        expect(c(SI_NO_ESTRATEGIA.cuantia_referencia.no), sistema).toBe("X");
        expect(c(SI_NO_ESTRATEGIA.cuantia_referencia.si), sistema).toBe("");
      }
    },
    15000,
  );

  it("si la DEC ya respondió, manda su respuesta (no la deriva)", async () => {
    const c = await celda("obra", { var_i_sistema_entrega: "solo_construccion", si_cuantia_referencia: "no" });
    expect(c(SI_NO_ESTRATEGIA.cuantia_referencia.no)).toBe("X");
    expect(c(SI_NO_ESTRATEGIA.cuantia_referencia.si)).toBe("");
  });
})

describe("a) B3 imprime el tipo de procedimiento con 'N°' antes del número", () => {
  it("nomenclaturaConNumero antepone N° sin duplicarlo", async () => {
    const { nomenclaturaConNumero } = await import("@/lib/estrategia-formato");
    expect(nomenclaturaConNumero("44-DEC-MDCH-1")).toBe("N° 44-DEC-MDCH-1");
    expect(nomenclaturaConNumero("N° 42-2026-DEC")).toBe("N° 42-2026-DEC");
    expect(nomenclaturaConNumero("CP N° 001-2026")).toBe("CP N° 001-2026");
    expect(nomenclaturaConNumero("")).toBe("");
    expect(nomenclaturaConNumero(null)).toBe("");
  });

  it("B3 = 'TIPO N° número' (el número de A4 sale con su N°)", async () => {
    const c = await hoja({ var_a_proceso: "Licitación Pública para bienes", var_a_nomenclatura: "44-DEC-MDCH-1" });
    expect(c("B3")).toContain("LICITACIÓN PÚBLICA PARA BIENES N° 44-DEC-MDCH-1");
  });
})

describe("e) el perfil del evaluador sale con los rótulos en negrita", () => {
  it("cada rótulo ('Especialización Técnica:', etc.) va en bold; el cuerpo no", async () => {
    const perfil =
      "Especialización Técnica: La naturaleza requiere un experto.\n" +
      "Eficiencia Operativa: Gestión más ágil (Art. 58.2).\n" +
      "Facultad Consultiva: Puede solicitar opiniones (Art. 56.4).";
    const { buffer } = await generarExcelF1("estrategia", {
      hitos: { A4: { data: { var_e_perfil_evaluador: perfil }, status: "hecho" } },
      proceso,
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const v = wb.worksheets[0].getCell("B40").value as { richText?: { text: string; font?: { bold?: boolean; size?: number } }[] };
    expect(v.richText).toBeTruthy();
    const negritas = v.richText!.filter((r) => r.font?.bold).map((r) => r.text);
    expect(negritas).toContain("Especialización Técnica:");
    expect(negritas).toContain("Eficiencia Operativa:");
    expect(negritas).toContain("Facultad Consultiva:");
    const cuerpo = v.richText!.filter((r) => !r.font?.bold).map((r) => r.text).join("");
    expect(cuerpo).toContain("La naturaleza requiere un experto");
    expect(cuerpo).not.toContain("Especialización Técnica:"); // el rótulo no está en el cuerpo
  });
})

describe("g) factores por procedimiento y su sustento recomendado", () => {
  it("subasta inversa y comparación de precios: sin factores técnicos (Art. 74.3)", async () => {
    const { factoresDeProcedimiento } = await import("@/lib/estrategia-formato");
    expect(factoresDeProcedimiento("subasta_inversa_electronica")).toEqual([]);
    expect(factoresDeProcedimiento("comparacion_precios")).toEqual([]);
  });

  it("licitación/concurso ofrecen el catálogo de factores", async () => {
    const { factoresDeProcedimiento, OPCIONES_FACTOR_EVALUACION } = await import("@/lib/estrategia-formato");
    expect(factoresDeProcedimiento("licitacion_publica")).toBe(OPCIONES_FACTOR_EVALUACION);
    expect(factoresDeProcedimiento("concurso_publico")).toEqual(OPCIONES_FACTOR_EVALUACION);
    // Sin procedimiento definido, se ofrece el catálogo completo (la DEC filtra).
    expect(factoresDeProcedimiento(null)).toEqual(OPCIONES_FACTOR_EVALUACION);
  });

  it("cada factor del catálogo tiene su sustento recomendado", async () => {
    const { OPCIONES_FACTOR_EVALUACION, SUSTENTO_FACTOR_SUGERIDO } = await import("@/lib/estrategia-formato");
    for (const factor of OPCIONES_FACTOR_EVALUACION) {
      expect(SUSTENTO_FACTOR_SUGERIDO[factor], `falta el sustento de "${factor}"`).toBeTruthy();
    }
  });

  it("el sustento del Precio cita el articulado (Art. 74/75)", async () => {
    const { SUSTENTO_FACTOR_SUGERIDO } = await import("@/lib/estrategia-formato");
    expect(SUSTENTO_FACTOR_SUGERIDO["Precio"]).toContain("Art. 74");
    expect(SUSTENTO_FACTOR_SUGERIDO["Precio"]).toContain("40");
  });
})

describe("o) construirCronogramaInicial: fases y actividades según el procedimiento (Art. 46.1.o)", () => {
  it("competitivo: preparatorias + selección del procedimiento + ejecución con plazo", async () => {
    const { construirCronogramaInicial } = await import("@/lib/estrategia-formato");
    const c = construirCronogramaInicial("licitacion_publica", 60, "calendario");
    const fases = new Set(c.map((f) => f.fase));
    expect(fases).toEqual(new Set(["preparatorias", "seleccion", "ejecucion"]));
    const sel = c.filter((f) => f.fase === "seleccion").map((f) => f.actividad);
    expect(sel).toContain("Convocatoria");
    expect(sel).toContain("Otorgamiento de la buena pro");
    const ejec = c.find((f) => f.fase === "ejecucion" && (f.actividad ?? "").includes("Ejecución contractual"));
    expect(ejec?.actividad).toContain("plazo: 60 días calendario");
  });

  it("comparación de precios: su fase de selección es la propia (menor monto), sin consultas/observaciones", async () => {
    const { construirCronogramaInicial } = await import("@/lib/estrategia-formato");
    const sel = construirCronogramaInicial("comparacion_precios")
      .filter((f) => f.fase === "seleccion")
      .map((f) => f.actividad ?? "");
    expect(sel.some((a) => /cotizaci/i.test(a))).toBe(true);
    expect(sel).not.toContain("Formulación de consultas y observaciones");
  });
})

describe("b) análisis del no competitivo: NO CORRESPONDE si se respondió que NO se sustenta", () => {
  it("b)=no fuerza B13 a 'NO CORRESPONDE.' aunque quede texto residual, y marca la casilla NO", async () => {
    const c = await hoja({ si_sustenta_no_competitivo: "no", var_b_no_competitivo: "texto residual de un borrador" });
    expect(c("B13")).toBe("NO CORRESPONDE.");
    expect(c(SI_NO_ESTRATEGIA.sustenta_no_competitivo.no)).toBe("X"); // H11, la casilla NO de b)
  });

  it("b)=si escribe el análisis registrado (no lo pisa)", async () => {
    const c = await hoja({
      si_sustenta_no_competitivo: "si",
      var_b_no_competitivo: "El desabastecimiento acredita la contratación directa.",
    });
    expect(c("B13")).toContain("desabastecimiento");
  });

  // En un procedimiento COMPETITIVO (la regla general, Art. 54.3) b) no aplica:
  // no hay un no competitivo cuyo uso sustentar. La casilla NO se marca sola,
  // como se deduce la de a); dejarla en blanco leería "sin analizar".
  it("competitivo: b) en blanco marca la casilla NO (H11) y B13 sale 'NO CORRESPONDE.'", async () => {
    const c = await hoja({ var_a_proceso: "Licitación Pública para bienes" });
    expect(c(SI_NO_ESTRATEGIA.sustenta_no_competitivo.no)).toBe("X"); // H11
    expect(c(SI_NO_ESTRATEGIA.sustenta_no_competitivo.si)).toBe(""); // F11 sin marcar
    expect(c("B13")).toBe("NO CORRESPONDE.");
  });

  // En un NO competitivo sí aplica: la casilla no se auto-marca, la DEC debe
  // responder SÍ/NO tras analizar el sustento (Art. 46.1.b).
  it("no competitivo: b) en blanco NO se auto-marca (queda a la DEC responder)", async () => {
    const c = await hoja({ var_a_proceso: PROCESO_NO_COMPETITIVO });
    expect(c(SI_NO_ESTRATEGIA.sustenta_no_competitivo.no)).toBe(""); // H11 en blanco
    expect(c(SI_NO_ESTRATEGIA.sustenta_no_competitivo.si)).toBe(""); // F11 en blanco
  });
})

describe("c) C19 muestra SOLO el número de CUI, nunca el nombre del proyecto", () => {
  it("con CUI, C19 es solo el número aunque haya declaración de viabilidad", async () => {
    const c = await hoja({ cui: "2661009", var_c_viabilidad: "Viabilidad N° 123 del 01/01/2026", si_es_inversion: "si" });
    expect(c("C19")).toBe("2661009");
  });

  it("el texto de viabilidad no contamina C19 con el nombre del proyecto", async () => {
    const c = await hoja({ cui: "2661009", var_c_viabilidad: "Proyecto de inversión: 2661009 MEJORAMIENTO DE VÍAS", si_es_inversion: "si" });
    expect(c("C19")).toBe("2661009");
    expect(c("C19")).not.toContain("MEJORAMIENTO");
  });

  it("solo CUI (sin declaración) queda solo el número", async () => {
    const c = await hoja({ cui: "2661009", si_es_inversion: "si" });
    expect(c("C19")).toBe("2661009");
  });
})

describe("f) experiencia del postor en la especialidad como obligatorio (R.D. 0001-2026)", () => {
  it("en un competitivo, B45 lleva el texto de la R.D. y no duplica la experiencia", async () => {
    const c = await hoja({
      var_a_proceso: "Licitación Pública para bienes",
      var_f_requisitos_calificacion: "OBLIGATORIOS:\n- Capacidad legal\n- Experiencia del postor en la especialidad",
    });
    expect(c("B44")).toContain("Capacidad legal");
    expect(c("B45")).toContain("0001-2026-EF/54.01");
    expect(c("B45")).toContain("Obligatorio por bases estándar");
    // La experiencia marcada por el usuario se sustituye por el texto de la R.D.:
    // no aparece un segundo renglón repetido.
    expect(c("B46")).not.toContain("Experiencia del postor");
  });

  it("aunque el usuario no la marque, en un competitivo se añade en B45", async () => {
    const c = await hoja({
      var_a_proceso: "Licitación Pública para bienes",
      var_f_requisitos_calificacion: "OBLIGATORIOS:\n- Capacidad legal",
    });
    expect(c("B44")).toContain("Capacidad legal");
    expect(c("B45")).toContain("0001-2026-EF/54.01");
  });

  it("subasta inversa NO lleva la experiencia del postor obligatoria (solo capacidad legal)", async () => {
    const c = await hoja({ var_a_proceso: "Subasta Inversa Electrónica" });
    const todo = ["B44", "B45", "B46"].map((a) => c(a)).join(" | ");
    // Todos los obligatorios citan la R.D., pero la experiencia del postor no es
    // uno de ellos en subasta inversa: solo la capacidad legal.
    expect(todo).not.toContain("experiencia del postor");
    expect(c("B44")).toContain("Capacidad legal");
  });

  it("comparación de precios SÍ lleva la experiencia del postor obligatoria (R.D.)", async () => {
    const c = await hoja({ var_a_proceso: "Comparación de Precios" });
    expect(c("B44")).toContain("Capacidad legal");
    expect(c("B45")).toContain("0001-2026-EF/54.01");
  });
})

describe("f) facultativos: la plantilla no deja los marcadores '[Insertar…]' si no hay", () => {
  it("sin facultativos → deja constancia y limpia las filas restantes", async () => {
    const c = await hoja({ var_a_proceso: "Licitación Pública para bienes", var_f_requisitos_calificacion: "" });
    expect(c("B49")).toBe("No se establecen requisitos de calificación facultativos.");
    expect(c("B50")).toBe("");
    expect(c("B51")).toBe("");
    expect(c("C49")).toBe("");
  });

  it("con un facultativo → va en la 1.ª fila y las demás quedan limpias", async () => {
    const c = await hoja({
      var_a_proceso: "Licitación Pública para bienes",
      var_f_requisitos_calificacion: "FACULTATIVOS:\n- Capacidad técnica y profesional — Sustento: un ingeniero con tres años",
    });
    expect(c("B49")).toContain("Capacidad técnica");
    expect(c("C49")).toContain("ingeniero");
    expect(c("B50")).toBe("");
    expect(c("B50")).not.toContain("Insertar");
  });
})

describe("g) sustentoAlElegirFactor · precarga automática al elegir/cambiar de factor", () => {
  it("factor con sustento vacío → carga el recomendado", async () => {
    const { sustentoAlElegirFactor, SUSTENTO_FACTOR_SUGERIDO } = await import("@/lib/estrategia-formato");
    expect(sustentoAlElegirFactor("Precio", "")).toBe(SUSTENTO_FACTOR_SUGERIDO["Precio"]);
  });

  it("cambiar de factor sobrescribe la plantilla del anterior por la del nuevo", async () => {
    const { sustentoAlElegirFactor, SUSTENTO_FACTOR_SUGERIDO } = await import("@/lib/estrategia-formato");
    // La fila traía la plantilla de "Precio"; al elegir "Garantía comercial…" se
    // reemplaza por la suya.
    const actual = SUSTENTO_FACTOR_SUGERIDO["Precio"];
    expect(sustentoAlElegirFactor("Garantía comercial del postor", actual)).toBe(
      SUSTENTO_FACTOR_SUGERIDO["Garantía comercial del postor"],
    );
  });

  it("un texto escrito por la DEC (no plantilla) se respeta → null", async () => {
    const { sustentoAlElegirFactor } = await import("@/lib/estrategia-formato");
    expect(sustentoAlElegirFactor("Precio", "Sustento propio de la DEC para este expediente.")).toBeNull();
  });

  it("un factor sin recomendado (libre) no precarga nada → null", async () => {
    const { sustentoAlElegirFactor } = await import("@/lib/estrategia-formato");
    expect(sustentoAlElegirFactor("Factor personalizado X", "")).toBeNull();
  });
})
