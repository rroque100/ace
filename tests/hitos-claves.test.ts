import { describe, expect, it } from "vitest";
import {
  CLAVES_HEREDADAS,
  clavesDeclaradas,
  clavesHuerfanas,
  migrarClavesHeredadas,
} from "@/lib/hitos-claves";
import { pasoF1 } from "@/lib/actuaciones-preparatorias";

/**
 * El jsonb de los hitos no valida nada: acepta cualquier clave y la conserva
 * para siempre. Cuando un campo se renombra, lo que la gente ya había escrito se
 * queda con la clave vieja — invisible para el formulario y para el exportador,
 * y sin un solo error en ninguna parte.
 *
 * Estos son los datos REALES de REQ-2026-0004 leídos de Supabase. Sirven de
 * regresión: los dos huérfanos que costó descubrir a mano ya están registrados,
 * y el tercero fallará aquí en vez de aparecer en un Excel firmado.
 */
const REAL_A4 = {
  cui: "2661009",
  roles_items: [],
  var_t_otras: "NO CORRESPONDE",
  factores_items: [],
  var_s_objetivo: "NOLOSE",
  agrupacion_tipo: "items",
  si_es_inversion: "si",
  cronograma_items: [],
  var_c_viabilidad: "Proyecto de inversión: 186 MEJORAMIENTO…",
  fecha_elaboracion: "2026-07-13",
  si_inversion_viable: "si",
  var_a_procedimiento: "licitacion_publica_abreviada",
  si_consumo_historico: "no",
  var_e_tipo_evaluador: "oficial_compra",
  var_h_modalidad_pago: "suma_alzada",
  fuente_financiamiento: "recursos_determinados",
  si_cuantia_referencia: "no",
  si_garantia_adelantos: "no",
  var_i_sistema_entrega: "no_aplica",
  si_cuantia_actualizada: "no",
  si_garantia_accesorias: "no",
  si_modalidad_eficiente: "no",
  var_n_tipo_interaccion: "Se realizó: Consulta al mercado básica.",
  var_a_tipo_procedimiento: "04-2026-DEC-MDCH-1", // ← la clave heredada
  si_sustenta_no_competitivo: "no",
  var_j_puntos_no_negociables: [],
  si_garantia_fiel_cumplimiento: "no",
  var_f_requisitos_calificacion: "OBLIGATORIOS:…",
  otra_var_documentos_perfeccionamiento: true,
};

const REAL_A5 = {
  nivel: "consulta_mercado_basica",
  proveedores: [],
  herr_solicitud: true,
  sustento_citas: "48.1…",
  criterio_cuantia: "menor",
  tipo_interaccion: "consulta_mercado", // ← retirada sin sustituto
  fecha_elaboracion: "2026-07-10",
};

const REAL_A2 = {
  objeto: "bienes_servicios",
  remitente: "ROJAS MAYTAN JUAN — OFICINA DE LOGISTICA",
  cuantiaAlta: false,
  destinatario: "QUISPE CHIPANA SAUL — Jefe de la OGA",
  cronogramaItems: [{ area: "GERENCIA", fecha: "" }],
  condicionesRiesgo: ["disponibilidad_limitada", "no_contratado_antes"],
};

const REAL_A1 = {
  en_cmn: true,
  en_pac: false,
  programada: false,
  version_cmn: "4768",
  procedimiento_pac: "",
};

const REAL_A7 = {
  tipo: "ccp",
  monto: 90_000,
  vigencia: 2026,
  meta_presupuestal: "186",
  fuente_financiamiento: "Canon y Sobrecanon…",
};

describe("clavesHuerfanas · el expediente real no tiene datos sin dueño", () => {
  it.each([
    ["A1", REAL_A1],
    ["A2", REAL_A2],
    ["A4", REAL_A4],
    ["A5", REAL_A5],
    ["A7", REAL_A7],
  ])("%s", (code, data) => {
    expect(clavesHuerfanas(code, data)).toEqual([]);
  });

  it("detecta una clave que ningún campo declara (el próximo renombrado)", () => {
    expect(clavesHuerfanas("A4", { ...REAL_A4, var_a_lo_que_sea: "dato perdido" })).toEqual([
      "var_a_lo_que_sea",
    ]);
  });

  it("las claves heredadas registradas NO se reportan como huérfanas", () => {
    // Están declaradas en CLAVES_HEREDADAS: se conocen y se tratan.
    expect(clavesHuerfanas("A4", { var_a_tipo_procedimiento: "04-2026" })).toEqual([]);
    expect(clavesHuerfanas("A5", { tipo_interaccion: "consulta_mercado" })).toEqual([]);
    // A8: las siete casillas de contenido se retiraron (las verifica el Art. 54.2).
    expect(
      clavesHuerfanas("A8", {
        req_cmn: true,
        req_requerimiento: true,
        req_estrategia: true,
        req_interaccion: true,
        req_cuantia: true,
        req_evaluadores: true,
        req_ccp: true,
        autoridad: "AGA",
      }),
    ).toEqual([]);
  });

  it("sin datos no hay nada que reprochar", () => {
    expect(clavesHuerfanas("A4", null)).toEqual([]);
    expect(clavesHuerfanas("A4", {})).toEqual([]);
  });
});

describe("clavesDeclaradas", () => {
  it("toma los campos que el paso declara", () => {
    const a4 = clavesDeclaradas("A4");
    expect(a4.has("var_a_proceso")).toBe(true);
    expect(a4.has("var_e_tipo_evaluador")).toBe(true);
    // El genérico DERIVADO (var_a_procedimiento) no es campo del formulario: va en
    // CLAVES_HEREDADAS. Y la clave vieja tampoco está declarada.
    expect(a4.has("var_a_procedimiento")).toBe(false);
    expect(a4.has("var_a_tipo_procedimiento")).toBe(false);
  });

  it("A2 usa un formulario especial: sus campos no están en `campos`", () => {
    expect(pasoF1("A2")?.campos).toEqual([]);
    expect(pasoF1("A2")?.especial).toBe("segmentacion");
    // Aun así se conocen, declarados aparte.
    expect(clavesDeclaradas("A2").has("condicionesRiesgo")).toBe(true);
    expect(clavesDeclaradas("A2").has("cuantiaAlta")).toBe(true);
  });

  it("un paso inexistente no declara nada", () => {
    expect(clavesDeclaradas("ZZ").size).toBe(0);
  });
});

describe("el registro de claves heredadas es coherente", () => {
  it("cada destino de un renombrado es un campo que existe hoy", () => {
    const rotos: string[] = [];
    for (const [code, mapa] of Object.entries(CLAVES_HEREDADAS)) {
      const declaradas = clavesDeclaradas(code);
      for (const [vieja, nueva] of Object.entries(mapa)) {
        if (nueva && !declaradas.has(nueva)) rotos.push(`${code}.${vieja} → ${nueva} (no existe)`);
      }
    }
    expect(rotos, "un renombrado que apunta a un campo inexistente no migra nada").toEqual([]);
  });

  it("ninguna clave heredada colisiona con un campo vivo", () => {
    const colisiones: string[] = [];
    for (const [code, mapa] of Object.entries(CLAVES_HEREDADAS)) {
      const declaradas = clavesDeclaradas(code);
      for (const vieja of Object.keys(mapa)) {
        if (declaradas.has(vieja)) colisiones.push(`${code}.${vieja}`);
      }
    }
    expect(colisiones, "una clave declarada viva no puede estar además marcada como heredada").toEqual([]);
  });
});

describe("migrarClavesHeredadas · recupera el dato atrapado", () => {
  it("mueve la nomenclatura de la clave vieja a la nueva (el caso real)", () => {
    const r = migrarClavesHeredadas("A4", { var_a_tipo_procedimiento: "04-2026-DEC-MDCH-1" });
    expect(r.var_a_nomenclatura).toBe("04-2026-DEC-MDCH-1");
  });

  it("no pisa lo que ya está escrito en el campo nuevo", () => {
    const r = migrarClavesHeredadas("A4", {
      var_a_tipo_procedimiento: "viejo",
      var_a_nomenclatura: "N° 7-2026",
    });
    expect(r.var_a_nomenclatura).toBe("N° 7-2026");
  });

  it("una retirada sin sustituto no migra nada", () => {
    const r = migrarClavesHeredadas("A5", { tipo_interaccion: "consulta_mercado" });
    expect(r).toEqual({ tipo_interaccion: "consulta_mercado" });
  });

  it("sin nada que migrar devuelve el MISMO objeto (no fuerza guardados)", () => {
    const data = { var_a_procedimiento: "licitacion_publica" };
    expect(migrarClavesHeredadas("A4", data)).toBe(data);
    expect(migrarClavesHeredadas("A1", data)).toBe(data);
  });

  it("un valor vacío en la clave vieja no ensucia el campo nuevo", () => {
    const r = migrarClavesHeredadas("A4", { var_a_tipo_procedimiento: "" });
    expect(r.var_a_nomenclatura).toBeUndefined();
  });
});
