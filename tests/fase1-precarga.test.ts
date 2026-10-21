import { describe, expect, it } from "vitest";
import {
  COLUMNAS_SEED,
  mergeSeedIntoHitos,
  normalizarModalidadPago,
  refrescarProcedimientoA4,
  refrescarPropuestasA3,
  refrescarRequisitosEspejo,
  seedHitosFromNecesidad,
  type NecesidadSeedInput,
} from "@/lib/fase1-precarga";
import { requisitosNormaDeNecesidad } from "@/lib/requisitos-calificacion";
import type { HitosMap } from "@/lib/procurement-fases";

const base: NecesidadSeedInput = {
  version_cmn: null,
  cmn_verificado: false,
  periodo_programacion: null,
  trimestre: null,
  mes_programado: null,
  poi_actividad: null,
  cantidad: null,
  unidad_medida: null,
  departamento: null,
  provincia: null,
  distrito: null,
  lugar_entrega: null,
  recepcion_conformidad: null,
  penalidad_mora: null,
  subcontratacion: null,
  garantias: null,
  adelanto_directo: null,
  equipamiento_minimo: null,
  habilitaciones: null,
  metas_fisicas: null,
  disponibilidad_terreno: null,
  seguros: null,
  metodologia_bim: null,
  gestion_calidad: null,
  gestion_riesgos: null,
  anexos_tecnicos: null,
  prestaciones_accesorias: null,
  normas_tecnicas: null,
  otras_penalidades: null,
  solucion_controversias: null,
  personal_clave_experiencia: null,
  personal_clave_acreditacion: null,
  formacion_academica: null,
  formacion_academica_acreditacion: null,
  capacitacion_personal_clave: null,
  capacitacion_personal_clave_acreditacion: null,
  equipamiento_estrategico: null,
  equipamiento_estrategico_acreditacion: null,
  infraestructura_estrategica: null,
  infraestructura_estrategica_acreditacion: null,
  tipo_objeto: "bienes",
  tipo_proceso_seleccion: null,
  descripcion_detallada: null,
  finalidad_publica: null,
  fecha_remision_dec: null,
  no_objecion: "no_aplica",
  no_objecion_sustento: null,
  verificacion_ficha_tecnica: false,
  verificacion_almacen: false,
  requisitos_calificacion: null,
  sistema_entrega: null,
  frecuencia: null,
  ficha_tecnica_identificacion: null,
  forma_pago: null,
  forma_pago_tipo: null,
  forma_pago_detalle: null,
  cadena_funcional: null,
  cui: null,
  proyecto_inversion: null,
  ioarr: null,
  monto_estimado: null,
  meta_presupuestal: null,
  fuente_financiamiento: null,
  anio_fiscal: null,
  modalidad_pago: null,
  alcance: null,
  condiciones_ejecucion: null,
  formula_reajuste: null,
  plazo_ejecucion: null,
  plazo_ejecucion_unidad: null,
};

// Los endpoints piden estas columnas a PostgREST. El tipo NecesidadSeedInput es
// una aserción, no una comprobación: cuando el SELECT y el tipo eran dos listas
// separadas, un campo añadido solo al tipo llegaba undefined en silencio y el
// hito se sembraba a medias. Ahora el tipo se deriva de la lista.
describe("COLUMNAS_SEED", () => {
  it("incluye los campos que alimentan A3 (finalidad, plazo, fórmula)", () => {
    const columnas = COLUMNAS_SEED.split(",");
    expect(columnas).toContain("finalidad_publica");
    expect(columnas).toContain("plazo_ejecucion");
    expect(columnas).toContain("formula_reajuste");
    expect(columnas).toContain("requisitos_calificacion");
    expect(columnas).toContain("modalidad_pago");
    expect(columnas).toContain("sistema_entrega");
  });

  it("no tiene duplicados ni espacios (va literal en el select= de PostgREST)", () => {
    const columnas = COLUMNAS_SEED.split(",");
    expect(new Set(columnas).size).toBe(columnas.length);
    expect(COLUMNAS_SEED).not.toContain(" ");
  });
});

describe("seedHitosFromNecesidad", () => {
  it("precarga A1 y A3 con los datos de la Necesidad", () => {
    const seed = seedHitosFromNecesidad({
      ...base,
      version_cmn: "CMN 2026 v2",
      cmn_verificado: true,
      tipo_objeto: "servicios",
      descripcion_detallada: "Servicio de mantenimiento de vías",
      finalidad_publica: "Garantizar la transitabilidad",
      fecha_remision_dec: "2026-03-01",
      no_objecion: "otorgada",
    });
    // `verificado_cmn` ya NO se siembra en A3: duplicaba `en_cmn` de A1, que es
    // el paso del Art. 42 y el que comprueba el Art. 54.3 para aprobar.
    expect(seed.A3?.data?.verificado_cmn).toBeUndefined();
    expect(seed.A1?.data?.en_cmn).toBe(true);

    expect(seed.A1?.status).toBe("en_curso");
    expect(seed.A1?.data).toMatchObject({ en_cmn: true, version_cmn: "CMN 2026 v2" });

    expect(seed.A3?.status).toBe("en_curso");
    expect(seed.A3?.data).toMatchObject({
      objeto_contractual: "servicio",
      descripcion: "Servicio de mantenimiento de vías",
      finalidad_publica: "Garantizar la transitabilidad",
      fecha_recepcion_dec: "2026-03-01",
      no_objecion: "otorgada",
    });
  });

  it("precarga A4 (estrategia) y A7 (CCP) con datos del requerimiento", () => {
    const seed = seedHitosFromNecesidad({
      ...base,
      requisitos_calificacion: "OBLIGATORIOS:\n- Experiencia del postor en la especialidad: facturación de S/ 200,000",
      sistema_entrega: "Llave en mano",
      proyecto_inversion: "2661009",
      monto_estimado: 580600,
      meta_presupuestal: "186",
      fuente_financiamiento: "Canon y Sobrecanon",
      anio_fiscal: 2026,
      verificacion_ficha_tecnica: true,
    });

    // El campo de A3 es un select Sí/NO: verificada la ficha técnica → "si".
    expect(seed.A3?.data?.estandarizado).toBe("si");
    // El área usuaria propone en crudo (con su texto) en el requerimiento (A3)…
    expect(seed.A3?.data?.propuesta_requisitos_calificacion).toContain("facturación de S/ 200,000");
    expect(seed.A3?.data?.propuesta_sistema_entrega).toBe("Llave en mano");
    // …pero la estrategia (A4 f)) trae SOLO la CITA legal del tipo marcado, no el
    // texto crudo: la DEC concreta el detalle sobre la norma.
    const varF = String(seed.A4?.data?.var_f_requisitos_calificacion);
    expect(varF).toContain("Experiencia del postor en la especialidad");
    expect(varF).toContain("Art. 72.3");
    expect(varF).not.toContain("facturación de S/ 200,000");
    // El sistema de entrega (i) se precarga en A4 con la propuesta normalizada
    // ("Llave en mano" → llave_en_mano); mergeSeedIntoHitos solo rellena vacíos.
    expect(seed.A4?.data?.var_i_sistema_entrega).toBe("llave_en_mano");
    // La viabilidad sí: es un hecho del proyecto, no una decisión de la DEC.
    expect(String(seed.A4?.data?.var_c_viabilidad)).toContain("2661009");
    // k) La fuente de financiamiento se precarga en A4 con el valor NORMALIZADO al del
    // select ("Canon y Sobrecanon" → recursos_determinados), no solo en A7. Antes el
    // select de A4 salía vacío pese a que su ayuda promete la precarga.
    expect(seed.A4?.data?.fuente_financiamiento).toBe("recursos_determinados");
    expect(seed.A7?.data).toMatchObject({
      tipo: "ccp",
      monto: 580600,
      meta_presupuestal: "186",
      fuente_financiamiento: "Canon y Sobrecanon",
      vigencia: 2026,
    });
    // El mismo monto estimado alimenta el «Valor estimado (S/)» de A1, que solo
    // se muestra en la rama no programada (ahí no hay monto del PAC de partida).
    expect(seed.A1?.data?.valor_estimado).toBe(580600);
  });

  it("siembra `estandarizado` en AMBOS sentidos (obligatorio de A3, sin dejarlo en null)", () => {
    // Ficha técnica/homologación verificada → SÍ; no verificada → NO (la mayoría
    // de contrataciones no están estandarizadas, así que es el default correcto).
    expect(seedHitosFromNecesidad({ ...base, verificacion_ficha_tecnica: true }).A3?.data?.estandarizado).toBe("si");
    expect(seedHitosFromNecesidad({ ...base, verificacion_ficha_tecnica: false }).A3?.data?.estandarizado).toBe("no");
  });

  it("trae a A4 la forma de pago (h), la frecuencia (m) y la ficha técnica (r) del requerimiento", () => {
    const seed = seedHitosFromNecesidad({
      ...base,
      forma_pago_tipo: "Pago único",
      forma_pago_detalle: "Contra entrega y conformidad del área usuaria.",
      frecuencia: "Mensual",
      ficha_tecnica_identificacion: "Ficha técnica OSCE N° 0123",
    });
    // h) sustento: compone tipo + detalle (antes arrancaba vacío hasta cambiar el select).
    expect(String(seed.A4?.data?.var_h_sustento_pago)).toContain("Pago único");
    expect(String(seed.A4?.data?.var_h_sustento_pago)).toContain("Contra entrega");
    // m) consumo histórico: se siembra el texto; el SÍ/NO lo responde la DEC (no se presume).
    expect(String(seed.A4?.data?.var_m_consumo_historico)).toContain("Mensual");
    expect(seed.A4?.data?.si_consumo_historico).toBeUndefined();
    // r) estandarización: el texto lleva "ficha técnica"/"homologación", que es lo que el
    // export busca para marcar las casillas de estandarización.
    expect(String(seed.A4?.data?.var_r_estandarizado)).toContain("Ficha técnica");
  });

  it("trae la verificación de existencias/almacén (Art. 14.2.e) a A3", () => {
    // Marcada en la ficha → llega a A3 como la verificación de la DEC.
    expect(seedHitosFromNecesidad({ ...base, verificacion_almacen: true }).A3?.data?.verificacion_almacen).toBe(true);
    // Sin marcar, no se siembra: queda para que la DEC la responda en el paso.
    expect(seedHitosFromNecesidad({ ...base, verificacion_almacen: false }).A3?.data?.verificacion_almacen).toBeUndefined();
  });

  // Art. 44.2.a: las condiciones de ejecución son contenido del requerimiento,
  // no una variable de la estrategia. Antes se volcaban en var_t ("Otras
  // variables"), que es un cajón de sastre.
  // El 44.2.a agrupa alcance y condiciones de ejecución: A3 los recibe juntos,
  // en el orden del artículo. `alcance` no se sembraba y la ficha lo pedía como
  // obligatorio: se quedaba muerto en la base.
  it("compone el alcance de A3 con las tres piezas del 44.2.a, en orden", () => {
    const seed = seedHitosFromNecesidad({
      ...base,
      alcance: "Suministro a nivel distrital",
      descripcion_detallada: "Servidor de datos tipo rack, 64 GB RAM",
      condiciones_ejecucion: "Entrega en 30 días en almacén central",
    });
    const d = String(seed.A3?.data?.descripcion);
    expect(d).toContain("Suministro a nivel distrital");
    expect(d).toContain("Servidor de datos tipo rack");
    expect(d).toContain("Condiciones de ejecución: Entrega en 30 días");
    // Orden del artículo: alcance → detalle técnico (126.1) → condiciones.
    expect(d.indexOf("Suministro")).toBeLessThan(d.indexOf("Servidor de datos"));
    expect(d.indexOf("Servidor de datos")).toBeLessThan(d.indexOf("Condiciones de ejecución"));
  });

  it("las piezas ausentes no dejan huecos ni etiquetas sueltas", () => {
    const soloAlcance = seedHitosFromNecesidad({ ...base, alcance: "Suministro a nivel distrital" });
    expect(soloAlcance.A3?.data?.descripcion).toBe("Suministro a nivel distrital");
    // Sin ninguna de las tres, el campo no se siembra.
    expect(seedHitosFromNecesidad(base).A3?.data?.descripcion).toBeUndefined();
  });

  it("las condiciones de ejecución van al alcance de A3, no a var_t de A4", () => {
    const seed = seedHitosFromNecesidad({
      ...base,
      descripcion_detallada: "Adquisición de leche evaporada",
      modalidad_pago: "Suma Alzada",
      condiciones_ejecucion: "Entrega en 30 días calendario en almacén central",
    });
    expect(String(seed.A3?.data?.descripcion)).toContain("Adquisición de leche evaporada");
    expect(String(seed.A3?.data?.descripcion)).toContain("Entrega en 30 días");
    expect(seed.A4?.data?.var_t_otras).toBeUndefined();
    // La modalidad se normaliza: queda como propuesta en A3 Y precargada en A4
    // (mergeSeedIntoHitos solo rellenará si var_h está vacío).
    expect(seed.A3?.data?.propuesta_modalidad_pago).toBe("suma_alzada");
    expect(seed.A4?.data?.var_h_modalidad_pago).toBe("suma_alzada");
  });

  // Art. 44.2 (b, c, e): son PROPUESTAS del área usuaria. Se conservan en A3
  // aunque la DEC decida otra cosa en la estrategia; esa diferencia es lo que
  // sustenta la no objeción del Art. 44.7.
  it("las condiciones de contratación del 44.2 se siembran como propuesta en A3", () => {
    const seed = seedHitosFromNecesidad({
      ...base,
      requisitos_calificacion: "OBLIGATORIOS:\n- Capacidad legal",
      modalidad_pago: "Precios unitarios",
      sistema_entrega: "Llave en mano",
      formula_reajuste: "No aplica",
    });
    expect(seed.A3?.data?.propuesta_requisitos_calificacion).toContain("Capacidad legal");
    expect(seed.A3?.data?.propuesta_modalidad_pago).toBe("precios_unitarios");
    expect(seed.A3?.data?.propuesta_sistema_entrega).toBe("Llave en mano");
    expect(seed.A3?.data?.formula_reajuste).toBe("No aplica");

    // f) Requisitos: la estrategia (A4) trae la CITA legal del tipo marcado, no
    // el texto crudo del requerimiento.
    expect(seed.A4?.data?.var_f_requisitos_calificacion).toBe(
      "OBLIGATORIOS:\n- Capacidad legal: Art. 72.3 del Reglamento de la Ley N° 32069.",
    );
    // La modalidad de pago (h) y el sistema de entrega (i) se precargan en A4 con
    // la propuesta del área usuaria (normalizada al valor del select). La DEC
    // sigue pudiendo cambiarla; mergeSeedIntoHitos solo rellena si está vacío.
    expect(seed.A4?.data?.var_h_modalidad_pago).toBe("precios_unitarios");
    expect(seed.A4?.data?.var_i_sistema_entrega).toBe("llave_en_mano");
  });

  // El plazo alimenta la comprobación del Art. 126.2 en A3.
  it("siembra el plazo de ejecución y su cómputo en A3", () => {
    const seed = seedHitosFromNecesidad({ ...base, plazo_ejecucion: 365, plazo_ejecucion_unidad: "habiles" });
    expect(seed.A3?.data?.plazo_dias).toBe(365);
    expect(seed.A3?.data?.plazo_unidad).toBe("habiles"); // el cómputo no se pierde
    expect(seedHitosFromNecesidad(base).A3?.data?.plazo_dias).toBeUndefined();
    expect(seedHitosFromNecesidad(base).A3?.data?.plazo_unidad).toBeUndefined();
  });

  // Prestaciones accesorias (44.4) y normas técnicas (44.5): A3 tiene un campo
  // idéntico para cada una, y deben viajar a él sin transformar.
  it("siembra prestaciones accesorias y normas técnicas en su campo de A3", () => {
    const seed = seedHitosFromNecesidad({
      ...base,
      prestaciones_accesorias: "Mantenimiento preventivo por 24 meses.",
      normas_tecnicas: "NTP 350.043-1; Reglamento Nacional de Edificaciones.",
    });
    expect(seed.A3?.data?.prestaciones_accesorias).toBe("Mantenimiento preventivo por 24 meses.");
    expect(seed.A3?.data?.normas_tecnicas).toBe("NTP 350.043-1; Reglamento Nacional de Edificaciones.");
    // Vacías: no se siembran (no pisan con "" lo que la DEC pueda escribir).
    expect(seedHitosFromNecesidad(base).A3?.data?.prestaciones_accesorias).toBeUndefined();
    expect(seedHitosFromNecesidad(base).A3?.data?.normas_tecnicas).toBeUndefined();
  });

  // Penalidades distintas de la mora y solución de controversias: campo propio.
  it("siembra otras penalidades y solución de controversias en su campo de A3", () => {
    const seed = seedHitosFromNecesidad({
      ...base,
      otras_penalidades: "Por incumplir el plazo de reposición: 0.5 UIT por día.",
      solucion_controversias: "Arbitraje institucional. Cámara de Comercio de Lima (RUC 20112273922).",
    });
    expect(seed.A3?.data?.otras_penalidades).toContain("0.5 UIT por día");
    expect(seed.A3?.data?.solucion_controversias).toContain("Cámara de Comercio de Lima");
  });

  // Detalle del 72.3.b: se AGREGA a la propuesta de requisitos de A3 (lo que la
  // DEC revisa), pero A4 f) sigue siendo solo las citas de los tipos marcados.
  it("agrega el detalle de calificación (72.3.b) a la propuesta de A3, no a las citas de A4", () => {
    const seed = seedHitosFromNecesidad({
      ...base,
      requisitos_calificacion: "OBLIGATORIOS:\n- Capacidad técnica y profesional: personal clave",
      personal_clave_experiencia:
        "1. Actividad: Supervisión · Cantidad: 1 · Tiempo: tres (3) años · Prestaciones: montaje · Puesto: Residente",
      formacion_academica: "Título profesional de Ingeniero Civil · Residente",
    });
    const propuesta = String(seed.A3?.data?.propuesta_requisitos_calificacion);
    // El detalle del 72.3.b se compone DENTRO del tipo "Capacidad técnica",
    // fusionado con lo que la base ya traía; usa las claves del desglose (C.1…).
    expect(propuesta).toContain("Capacidad técnica y profesional");
    expect(propuesta).toContain("personal clave"); // lo que ya traía la base
    expect(propuesta).toContain("C.1 Experiencia del personal clave");
    expect(propuesta).toContain("Puesto: Residente");
    expect(propuesta).toContain("C.2.1 Formación académica");
    // A4 f) trae la cita del tipo marcado, NO el detalle del cuadro.
    const f = String(seed.A4?.data?.var_f_requisitos_calificacion);
    expect(f).toContain("Art. 72.3");
    expect(f).not.toContain("Puesto: Residente");
  });

  it("sin detalle 72.3.b la propuesta de A3 es el requisitos_calificacion crudo", () => {
    const seed = seedHitosFromNecesidad({
      ...base,
      requisitos_calificacion: "OBLIGATORIOS:\n- Capacidad legal: RNP",
    });
    expect(seed.A3?.data?.propuesta_requisitos_calificacion).toBe("OBLIGATORIOS:\n- Capacidad legal: RNP");
  });

  it("no precarga A4/A7 si la necesidad no trae esos datos", () => {
    const seed = seedHitosFromNecesidad(base);
    expect(seed.A4).toBeUndefined();
    expect(seed.A7).toBeUndefined();
  });

  it("mapea tipo_objeto → objeto_contractual del formulario A3", () => {
    const cases: Array<[NecesidadSeedInput["tipo_objeto"], string]> = [
      ["bienes", "bien"],
      ["servicios", "servicio"],
      ["obras", "obra"],
      ["consultoria_obra", "consultoria_obra"],
    ];
    for (const [tipo, esperado] of cases) {
      const seed = seedHitosFromNecesidad({ ...base, tipo_objeto: tipo });
      expect(seed.A3?.data?.objeto_contractual).toBe(esperado);
    }
  });

  it("mapea el estado de no objeción y deja 'solicitada' pendiente", () => {
    expect(seedHitosFromNecesidad({ ...base, no_objecion: "objetada" }).A3?.data?.no_objecion).toBe("objetado");
    expect(seedHitosFromNecesidad({ ...base, no_objecion: "otorgada" }).A3?.data?.no_objecion).toBe("otorgada");
    // "solicitada" no tiene equivalente resuelto: no se precarga.
    expect(seedHitosFromNecesidad({ ...base, no_objecion: "solicitada" }).A3?.data?.no_objecion).toBeUndefined();
  });

  it("no incluye campos vacíos (no sobrescribe con nulos)", () => {
    const seed = seedHitosFromNecesidad(base);
    // cmn_verificado es un boolean (false) → sí se precarga; los textos nulos no.
    expect(seed.A3?.data).not.toHaveProperty("descripcion");
    expect(seed.A3?.data).not.toHaveProperty("finalidad_publica");
    expect(seed.A1?.data).not.toHaveProperty("version_cmn");
  });
});

describe("normalizarModalidadPago", () => {
  it("mapea variantes de texto libre a los valores del select", () => {
    expect(normalizarModalidadPago("Suma alzada")).toBe("suma_alzada");
    expect(normalizarModalidadPago("PRECIOS UNITARIOS")).toBe("precios_unitarios");
    expect(normalizarModalidadPago("Esquema mixto")).toBe("esquema_mixto");
    expect(normalizarModalidadPago("Costo reembolsable")).toBe("costo_reembolsable");
    expect(normalizarModalidadPago("por tarifa")).toBe("tarifas");
    expect(normalizarModalidadPago("Honorario fijo + comisión")).toBe("honorario_fijo_comision");
  });

  it("devuelve undefined si no reconoce la modalidad", () => {
    expect(normalizarModalidadPago("algo raro")).toBeUndefined();
    expect(normalizarModalidadPago("")).toBeUndefined();
  });
});

describe("mergeSeedIntoHitos (sincronización retroactiva)", () => {
  const seed: HitosMap = {
    A1: { status: "en_curso", data: { en_cmn: true, version_cmn: "CMN 2026" } },
    A3: { status: "en_curso", data: { objeto_contractual: "bien", descripcion: "X", finalidad_publica: "Y" } },
  };

  it("rellena hitos vacíos y cuenta los campos llenados", () => {
    const { hitos, llenados } = mergeSeedIntoHitos({}, seed);
    expect(llenados).toBe(5);
    expect(hitos.A1?.status).toBe("en_curso");
    expect(hitos.A3?.data).toMatchObject({ objeto_contractual: "bien", descripcion: "X", finalidad_publica: "Y" });
  });

  it("NO sobrescribe lo que el usuario ya llenó", () => {
    const current: HitosMap = {
      A3: { status: "hecho", data: { descripcion: "Texto del usuario", objeto_contractual: "" } },
    };
    const { hitos, llenados } = mergeSeedIntoHitos(current, seed);
    // descripcion del usuario se respeta; objeto_contractual estaba vacío → se rellena.
    expect(hitos.A3?.data?.descripcion).toBe("Texto del usuario");
    expect(hitos.A3?.data?.objeto_contractual).toBe("bien");
    expect(hitos.A3?.data?.finalidad_publica).toBe("Y");
    // Solo se contaron los 2 campos vacíos de A3 + los 2 de A1.
    expect(llenados).toBe(4);
  });

  it("no degrada el avance: un paso 'hecho' sigue 'hecho'", () => {
    const current: HitosMap = { A3: { status: "hecho", data: {} } };
    const { hitos } = mergeSeedIntoHitos(current, seed);
    expect(hitos.A3?.status).toBe("hecho");
    // A1 no existía → queda "en_curso".
    expect(hitos.A1?.status).toBe("en_curso");
  });

  it("si no hay nada que rellenar, llenados = 0 y no toca el hito", () => {
    const current: HitosMap = {
      A1: { status: "hecho", data: { en_cmn: true, version_cmn: "CMN 2026" } },
      A3: { status: "hecho", data: { objeto_contractual: "bien", descripcion: "X", finalidad_publica: "Y" } },
    };
    const { hitos, llenados } = mergeSeedIntoHitos(current, seed);
    expect(llenados).toBe(0);
    expect(hitos).toEqual(current);
  });
});

describe("c) el CUI llega de la ficha a A4", () => {
  it("siembra el CUI y marca que ES una inversión", () => {
    // `act_proy` del pedido SIGA (2661009) es el NÚMERO del proyecto. Antes A4
    // lo sacaba del texto de la viabilidad y escribía el NOMBRE de la tarea
    // donde el formato pide el número.
    const seed = seedHitosFromNecesidad({
      ...base,
      cui: "2661009",
      proyecto_inversion: "186 MEJORAMIENTO Y AMPLIACION DE LOS SERVICIOS",
    });
    expect(seed.A4?.data?.cui).toBe("2661009");
    // El formato condiciona el CUI a la casilla c): sin sembrarla, el campo ni
    // se mostraría. Y que haya CUI no es opinión de la DEC: es un hecho.
    expect(seed.A4?.data?.si_es_inversion).toBe("si");
  });

  it("un IOARR también es una inversión", () => {
    const seed = seedHitosFromNecesidad({ ...base, ioarr: "IOARR-2026-12" });
    expect(seed.A4?.data?.si_es_inversion).toBe("si");
  });

  it("sin proyecto ni IOARR no afirma que sea una inversión", () => {
    const seed = seedHitosFromNecesidad(base);
    expect(seed.A4?.data?.si_es_inversion).toBeUndefined();
    expect(seed.A4?.data?.cui).toBeUndefined();
  });
});

describe("el CUI de las fichas anteriores al mapeo de act_proy", () => {
  it("se rescata de la cadena funcional del SIGA", () => {
    // La necesidad se importó antes de que el parser mapeara `act_proy`, así
    // que `cui` está vacío — pero el dato nunca se perdió: vive en el 4.º
    // segmento de la cadena funcional.
    const seed = seedHitosFromNecesidad({
      ...base,
      cadena_funcional: "03-006-0010-2661009-6000008",
    });
    expect(seed.A4?.data?.cui).toBe("2661009");
    expect(seed.A4?.data?.si_es_inversion).toBe("si");
  });

  it("el cui propio manda sobre el de la cadena", () => {
    const seed = seedHitosFromNecesidad({
      ...base,
      cadena_funcional: "03-006-0010-9999999-6000008",
      cui: "2661009",
    });
    expect(seed.A4?.data?.cui).toBe("2661009");
  });

  it("una cadena sin forma de SIGA no inventa un CUI", () => {
    const seed = seedHitosFromNecesidad({ ...base, cadena_funcional: "03-006" });
    expect(seed.A4?.data?.cui).toBeUndefined();
    expect(seed.A4?.data?.si_es_inversion).toBeUndefined();
  });
});

// "Traer datos" no solo rellena huecos: pone al día la propuesta de requisitos
// (b) del requerimiento) cuando la necesidad creció desde la última precarga,
// SIN pisar una edición de la DEC en A4 f).
describe("refrescarRequisitosEspejo", () => {
  const V1 = "OBLIGATORIOS:\n- Capacidad legal: RNP";
  const V2 = "OBLIGATORIOS:\n- Capacidad legal: RNP\n- Experiencia del postor en la especialidad: S/200,000";
  const OBJ = "bienes";
  // A4 f) guarda las CITAS de los tipos marcados; A3 propuesta, el crudo.
  const citas = (raw: string) => requisitosNormaDeNecesidad(raw, OBJ);

  it("refresca A3 (crudo) y A4 f) (citas) cuando f) es un espejo intacto", () => {
    const hitos: HitosMap = {
      A3: { status: "en_curso", data: { propuesta_requisitos_calificacion: V1 } },
      A4: { status: "en_curso", data: { var_f_requisitos_calificacion: citas(V1) } },
    };
    const { hitos: out, refrescado } = refrescarRequisitosEspejo(hitos, { ...base, requisitos_calificacion: V2 });
    expect(refrescado).toBe(true);
    expect(out.A3?.data?.propuesta_requisitos_calificacion).toBe(V2); // crudo al día
    expect(out.A4?.data?.var_f_requisitos_calificacion).toBe(citas(V2)); // citas al día
    // Las citas incorporan el nuevo tipo marcado, sin el texto crudo del monto.
    expect(String(out.A4?.data?.var_f_requisitos_calificacion)).toContain("Experiencia del postor");
    expect(String(out.A4?.data?.var_f_requisitos_calificacion)).not.toContain("S/200,000");
  });

  it("NO pisa A4 f) si la DEC lo editó (difiere de las citas), pero sí actualiza la propuesta", () => {
    const editadoDec = "OBLIGATORIOS:\n- Capacidad legal: RNP en bienes (decisión DEC)";
    const hitos: HitosMap = {
      A3: { status: "en_curso", data: { propuesta_requisitos_calificacion: V1 } },
      A4: { status: "en_curso", data: { var_f_requisitos_calificacion: editadoDec } },
    };
    const { hitos: out, refrescado } = refrescarRequisitosEspejo(hitos, { ...base, requisitos_calificacion: V2 });
    expect(refrescado).toBe(true);
    expect(out.A3?.data?.propuesta_requisitos_calificacion).toBe(V2); // propuesta al día
    expect(out.A4?.data?.var_f_requisitos_calificacion).toBe(editadoDec); // edición intacta
  });

  it("rellena A4 f) vacío con las citas", () => {
    const hitos: HitosMap = { A4: { status: "en_curso", data: {} } };
    const { hitos: out, refrescado } = refrescarRequisitosEspejo(hitos, { ...base, requisitos_calificacion: V2 });
    expect(refrescado).toBe(true);
    expect(out.A4?.data?.var_f_requisitos_calificacion).toBe(citas(V2));
  });

  it("no cambia nada si ya está al día", () => {
    const hitos: HitosMap = {
      A3: { status: "en_curso", data: { propuesta_requisitos_calificacion: V2 } },
      A4: { status: "en_curso", data: { var_f_requisitos_calificacion: citas(V2) } },
    };
    const { refrescado } = refrescarRequisitosEspejo(hitos, { ...base, requisitos_calificacion: V2 });
    expect(refrescado).toBe(false);
  });

  it("no hace nada si la necesidad no tiene requisitos", () => {
    const hitos: HitosMap = { A4: { status: "en_curso", data: { var_f_requisitos_calificacion: citas(V1) } } };
    const { refrescado } = refrescarRequisitosEspejo(hitos, { ...base, requisitos_calificacion: null });
    expect(refrescado).toBe(false);
  });

  it("al refrescar, A3 lleva el detalle 72.3.b y A4 f) solo las citas", () => {
    const nec = {
      ...base,
      requisitos_calificacion: V2,
      personal_clave_experiencia:
        "1. Actividad: Supervisión · Cantidad: 1 · Tiempo: tres (3) años · Prestaciones: montaje · Puesto: Residente",
    };
    const hitos: HitosMap = {
      A3: { status: "en_curso", data: { propuesta_requisitos_calificacion: V1 } },
      A4: { status: "en_curso", data: { var_f_requisitos_calificacion: citas(V1) } },
    };
    const { hitos: out } = refrescarRequisitosEspejo(hitos, nec);
    const propuesta = String(out.A3?.data?.propuesta_requisitos_calificacion);
    expect(propuesta).toContain("Experiencia del personal clave");
    expect(propuesta).toContain("Puesto: Residente");
    // A4 f) al día con las citas de V2, sin arrastrar el detalle del cuadro.
    expect(out.A4?.data?.var_f_requisitos_calificacion).toBe(citas(V2));
    expect(String(out.A4?.data?.var_f_requisitos_calificacion)).not.toContain("Puesto: Residente");
  });

  it("migra un f) que trae el CRUDO viejo (modelo anterior) a las citas nuevas", () => {
    // Expediente que hizo "Traer datos" con el código anterior: f) tiene el
    // texto crudo, idéntico a la propuesta. Debe migrarse a citas al re-traer.
    const hitos: HitosMap = {
      A3: { status: "en_curso", data: { propuesta_requisitos_calificacion: V1 } },
      A4: { status: "en_curso", data: { var_f_requisitos_calificacion: V1 } },
    };
    const { hitos: out, refrescado } = refrescarRequisitosEspejo(hitos, { ...base, requisitos_calificacion: V2 });
    expect(refrescado).toBe(true);
    expect(out.A4?.data?.var_f_requisitos_calificacion).toBe(citas(V2));
    expect(String(out.A4?.data?.var_f_requisitos_calificacion)).toContain("Art. 72.3");
  });
});

// Contenidos del Art. 44.2 que la ficha captura y que hasta ahora NO viajaban al
// expediente: el requerimiento llegaba a A3 sin sus condiciones de contratación,
// y la fase de ejecución heredaba (herencia-fases) de una estrategia que nunca
// las había recibido.
describe("seedHitosFromNecesidad · condiciones de contratación del Art. 44.2", () => {
  it("compone el lugar de entrega desde las cuatro columnas de la ficha", () => {
    const { A3 } = seedHitosFromNecesidad({
      ...base,
      departamento: "Apurímac",
      provincia: "Cotabambas",
      distrito: "Challhuahuacho",
      lugar_entrega: "Almacén central",
    });
    expect(A3?.data?.lugar_entrega).toBe("Apurímac - Cotabambas - Challhuahuacho (Almacén central)");
  });

  it("el lugar concreto sin ubicación también viaja", () => {
    const { A3 } = seedHitosFromNecesidad({ ...base, lugar_entrega: "Almacén central" });
    expect(A3?.data?.lugar_entrega).toBe("(Almacén central)");
  });

  it("agrupa equipamiento y habilitaciones en el campo del 44.2.d, con su rótulo", () => {
    const { A3 } = seedHitosFromNecesidad({
      ...base,
      equipamiento_minimo: "2 camionetas",
      habilitaciones: "Licencia municipal",
    });
    expect(A3?.data?.recursos_contratista).toBe(
      "Equipamiento mínimo: 2 camionetas\nHabilitaciones y permisos: Licencia municipal",
    );
  });

  it("compone cantidad y unidad de medida, que es lo que se cotiza en A5", () => {
    const { A3 } = seedHitosFromNecesidad({ ...base, cantidad: 500, unidad_medida: "UNIDAD" });
    expect(A3?.data?.cantidad_unidad).toBe("500 UNIDAD");
  });

  it("traslada recepción/conformidad, penalidad y subcontratación tal cual", () => {
    const { A3 } = seedHitosFromNecesidad({
      ...base,
      recepcion_conformidad: "Conformidad del Residente de Obra.",
      penalidad_mora: "0.10 × monto / (0.40 × plazo).",
      subcontratacion: "No se admite.",
    });
    expect(A3?.data?.recepcion_conformidad).toBe("Conformidad del Residente de Obra.");
    expect(A3?.data?.penalidad_mora).toBe("0.10 × monto / (0.40 × plazo).");
    expect(A3?.data?.subcontratacion).toBe("No se admite.");
  });

  it("l) el texto es la PROPUESTA; las casillas que siguen un hecho de la ficha se siembran, la de fiel cumplimiento no", () => {
    const { A4 } = seedHitosFromNecesidad({
      ...base,
      garantias: "Fiel cumplimiento 10%",
      adelanto_directo: "10% con carta fianza",
      prestaciones_accesorias: "Mantenimiento preventivo por 12 meses.",
    });
    expect(String(A4?.data?.var_l_garantias_adelantos)).toContain("Garantías (propuesta del área usuaria): Fiel cumplimiento 10%");
    expect(String(A4?.data?.var_l_garantias_adelantos)).toContain("Adelanto directo (propuesta del área usuaria): 10% con carta fianza");
    // Accesorias y adelantos SIGUEN un hecho de la ficha → se siembran como defecto.
    expect(A4?.data?.si_garantia_accesorias).toBe("si");
    expect(A4?.data?.si_garantia_adelantos).toBe("si");
    // Fiel cumplimiento es determinación legal (Art. 138), no dato del requerimiento: la decide la DEC.
    expect(A4?.data?.si_garantia_fiel_cumplimiento).toBeUndefined();
  });

  it("agrupa las condiciones específicas de obra en un solo campo", () => {
    const { A3 } = seedHitosFromNecesidad({
      ...base,
      metas_fisicas: "1 km de vía",
      seguros: "SCTR",
    });
    const texto = String(A3?.data?.condiciones_obra);
    expect(texto).toContain("Metas físicas / objetivos funcionales: 1 km de vía");
    expect(texto).toContain("Seguros: SCTR");
    // Lo que no está en la ficha no aparece con rótulo vacío.
    expect(texto).not.toContain("BIM");
  });

  it("una ficha sin condiciones no siembra campos vacíos", () => {
    const { A3, A4 } = seedHitosFromNecesidad(base);
    expect(A3?.data?.lugar_entrega).toBeUndefined();
    expect(A3?.data?.condiciones_obra).toBeUndefined();
    expect(A4?.data?.var_l_garantias_adelantos).toBeUndefined();
  });
});

// La matriz de riesgos ESTRUCTURADA (tabla `riesgo_necesidad`, una fila por riesgo)
// se retiró: duplicaba el campo de prosa `gestion_riesgos` (Art. 44.3), que es el que
// la IA redacta como matriz y el que va al Word oficial. Esa matriz viaja al campo
// DEDICADO de A3 `riesgos_asignacion` (Art. 44.3, todo objeto), no a `condiciones_obra`
// (solo obra): así también llega a A3 en bienes y servicios.
describe("seedHitosFromNecesidad · la gestión de riesgos llega a A3 (todo objeto)", () => {
  it("gestion_riesgos se vuelca en `riesgos_asignacion`, el campo dedicado del Art. 44.3", () => {
    const { A3 } = seedHitosFromNecesidad({
      ...base,
      gestion_riesgos: "Plan de gestión de riesgos del proyecto",
    });
    expect(String(A3?.data?.riesgos_asignacion)).toContain("Plan de gestión de riesgos del proyecto");
  });

  it("NO va a `condiciones_obra` (que solo se muestra en obra)", () => {
    const { A3 } = seedHitosFromNecesidad({
      ...base,
      gestion_riesgos: "Plan de gestión de riesgos del proyecto",
      anexos_tecnicos: "Planos y estudios básicos",
    });
    expect(String(A3?.data?.condiciones_obra ?? "")).not.toContain("Gestión de riesgos");
  });
});

describe("COLUMNAS_SEED · solo columnas de `necesidades`, sin embeds", () => {
  it("no incluye la tabla de riesgos ni ningún embed", () => {
    expect(COLUMNAS_SEED).not.toContain("riesgo_necesidad");
    expect(COLUMNAS_SEED).not.toContain("(");
  });
});

describe("refrescarProcedimientoA4 · «Traer datos» actualiza A4 a) desde objeto + proceso", () => {
  const nec = (tipo_objeto: NecesidadSeedInput["tipo_objeto"], tipo_proceso_seleccion: string | null): NecesidadSeedInput => ({
    ...base,
    tipo_objeto,
    tipo_proceso_seleccion,
  });
  const conA4 = (data: Record<string, unknown>): HitosMap => ({ A4: { status: "en_curso", data } });

  it("rellena a) vacío: pone el proceso ESPECÍFICO de la ficha + el genérico derivado", () => {
    const r = refrescarProcedimientoA4(conA4({}), nec("bienes", "Licitación Pública para bienes"));
    expect(r.refrescado).toBe(true);
    expect(r.hitos.A4?.data?.var_a_proceso).toBe("Licitación Pública para bienes");
    expect(r.hitos.A4?.data?.var_a_procedimiento).toBe("licitacion_publica");
  });

  it("sincroniza cuando la ficha cambió (a) es solo lectura: se pone al día siempre)", () => {
    const r = refrescarProcedimientoA4(
      conA4({ var_a_proceso: "Licitación Pública para bienes", var_a_procedimiento: "licitacion_publica" }),
      nec("bienes", "Licitación Pública abreviada para bienes"),
    );
    expect(r.refrescado).toBe(true);
    expect(r.hitos.A4?.data?.var_a_proceso).toBe("Licitación Pública abreviada para bienes");
    expect(r.hitos.A4?.data?.var_a_procedimiento).toBe("licitacion_publica_abreviada");
  });

  it("migra un expediente antiguo (tenía el genérico pero no el proceso específico)", () => {
    const r = refrescarProcedimientoA4(
      conA4({ var_a_procedimiento: "licitacion_publica" }),
      nec("bienes", "Licitación Pública para bienes"),
    );
    expect(r.refrescado).toBe(true);
    expect(r.hitos.A4?.data?.var_a_proceso).toBe("Licitación Pública para bienes");
  });

  it("limpia el marcador de origen del modelo anterior", () => {
    const r = refrescarProcedimientoA4(
      conA4({ var_a_procedimiento: "licitacion_publica", var_a_procedimiento_origen: "licitacion_publica" }),
      nec("bienes", "Licitación Pública para bienes"),
    );
    expect(r.hitos.A4?.data?.var_a_procedimiento_origen).toBeUndefined();
  });

  it("no hace nada si la ficha no tiene tipo de proceso (no competitivo / por definir)", () => {
    expect(refrescarProcedimientoA4(conA4({}), nec("bienes", null)).refrescado).toBe(false);
    expect(refrescarProcedimientoA4(conA4({}), nec("servicios", "Procedimiento de Selección No Competitivo")).refrescado).toBe(false);
  });

  it("es idempotente: ya sincronizado no marca cambios", () => {
    const r = refrescarProcedimientoA4(
      conA4({ var_a_proceso: "Concurso Público de servicios", var_a_procedimiento: "concurso_publico" }),
      nec("servicios", "Concurso Público de servicios"),
    );
    expect(r.refrescado).toBe(false);
  });
});

describe("refrescarPropuestasA3 · «Traer datos» pone al día c.1/c.2 desde la ficha", () => {
  const conA3 = (data: Record<string, unknown>): HitosMap => ({ A3: { status: "en_curso", data } });

  it("actualiza c.2) Sistema de entrega aunque ya tuviera otro valor (refleja el requerimiento)", () => {
    const r = refrescarPropuestasA3(
      conA3({ propuesta_sistema_entrega: "No aplica (bienes y servicios)" }),
      { ...base, sistema_entrega: "Llave en mano (bienes y servicios)" },
    );
    expect(r.refrescado).toBe(true);
    expect(r.hitos.A3?.data?.propuesta_sistema_entrega).toBe("Llave en mano (bienes y servicios)");
  });

  it("actualiza c.1) Modalidad de pago normalizada al valor del select", () => {
    const r = refrescarPropuestasA3(conA3({}), { ...base, modalidad_pago: "SUMA ALZADA" });
    expect(r.hitos.A3?.data?.propuesta_modalidad_pago).toBe("suma_alzada");
  });

  it("es idempotente: ya sincronizado no marca cambios", () => {
    const r = refrescarPropuestasA3(
      conA3({ propuesta_sistema_entrega: "Llave en mano (bienes y servicios)" }),
      { ...base, sistema_entrega: "Llave en mano (bienes y servicios)" },
    );
    expect(r.refrescado).toBe(false);
  });

  it("sin dato en la ficha no toca la propuesta", () => {
    const r = refrescarPropuestasA3(conA3({ propuesta_sistema_entrega: "Algo" }), { ...base, sistema_entrega: null });
    expect(r.refrescado).toBe(false);
    expect(r.hitos.A3?.data?.propuesta_sistema_entrega).toBe("Algo");
  });
});

describe("seedHitosFromNecesidad · variables de A4 heredadas de la necesidad", () => {
  it("s) guarda la gestión de riesgos en `riesgos_necesidad` (la ofrece un botón; s) arranca en NO CORRESPONDE)", () => {
    const { A4 } = seedHitosFromNecesidad({
      ...base,
      gestion_riesgos: "Riesgo de importación con plazos largos.",
    });
    // NO se vuelca directo a s): queda en `riesgos_necesidad` para el botón.
    expect(String(A4?.data?.riesgos_necesidad)).toContain("Riesgo de importación");
    expect(A4?.data?.var_s_objetivo).toBeUndefined();
  });

  it("obras b) y e) se siembran desde la ficha (BIM, terreno); el resto lo decide la DEC", () => {
    const { A4 } = seedHitosFromNecesidad({
      ...base,
      metodologia_bim: "BIM nivel 2 en ejecución.",
      disponibilidad_terreno: "Terreno saneado, partida registral 11-222.",
    });
    expect(A4?.data?.obra_b_bim).toBe("BIM nivel 2 en ejecución.");
    expect(A4?.data?.obra_e_terreno).toBe("Terreno saneado, partida registral 11-222.");
    expect(A4?.data?.obra_a_tipo_contrato).toBeUndefined();
  });

  it("q) agrupación por PAQUETE si algún ítem lleva paquete", () => {
    const { A4 } = seedHitosFromNecesidad({
      ...base,
      items: [{ nro_paquete: "1" }, { nro_paquete: "1" }, { nro_paquete: null }],
    });
    expect(A4?.data?.agrupacion_tipo).toBe("paquete");
  });

  it("q) agrupación por ÍTEMS con dos o más ítems y ninguno con paquete", () => {
    const { A4 } = seedHitosFromNecesidad({ ...base, items: [{ nro_paquete: null }, {}] });
    expect(A4?.data?.agrupacion_tipo).toBe("items");
  });

  it("q) un ítem suelto no se agrupa", () => {
    const { A4 } = seedHitosFromNecesidad({ ...base, items: [{}] });
    expect(A4?.data?.agrupacion_tipo).toBeUndefined();
  });
})
