// Qué columnas de `procurement_processes` alimenta cada paso de la Fase 1.
//
// ── Por qué esto en lugar de un formulario ────────────────────────────────────
//
// La ficha "Datos Técnicos y Mercado" del detalle del expediente enseñaba doce
// campos de los que ocho no los escribía NADIE: el endpoint PATCH los aceptaba,
// pero ninguna pantalla los enviaba, así que salían en "—" para siempre.
//
// La salida fácil era ponerles un formulario. Sería un error: los ocho ya tienen
// dueño en un paso de la Fase 1, y ese paso es el registro que se firma y se
// exporta al Formato 1. Un segundo sitio donde escribir el sistema de entrega
// crearía dos verdades sobre el mismo dato, y la de la ficha —la que no se
// exporta— acabaría ganando en pantalla mientras el documento oficial dice otra
// cosa.
//
// Así que la ficha se alimenta de su dueño y sigue siendo de solo lectura. Es un
// resumen del expediente, no un formulario paralelo.
//
// ── Qué NO está aquí ──────────────────────────────────────────────────────────
//
// `tipo_cambio`, `resumen_ejecutivo` y `factores_evaluacion` no aparecen porque
// no tienen dueño en ningún paso: el Art. 46 no enumera factores de evaluación
// (van en las bases, Art. 70) y los otros dos no los pide ningún formato. Se
// quitaron de la ficha en vez de cablearlos desde ningún sitio.

/** Valores de un paso, tal como se guardan en el jsonb `hitos`. */
export type DatosHito = Record<string, unknown>;

function texto(data: DatosHito, campo: string): string {
  const v = data[campo];
  return typeof v === "string" ? v.trim() : "";
}

/**
 * A4 · Estrategia de contratación (Art. 46.1).
 *
 * Cada variable del artículo va a la columna que le corresponde. `procedure_type`
 * sale de la variable a) porque el tipo de procedimiento lo DETERMINA la
 * estrategia, después de conocer requerimiento, segmentación y mercado; al
 * derivar la necesidad todavía no se sabe.
 *
 * La modalidad de pago (h) y el sistema de entrega (i) NO se reflejan a columna a
 * propósito: `modalidad_ejecucion` y `sistema_contratacion` arrastran un CHECK con
 * el vocabulario de la Ley 30225 (llave_en_mano/concurso_oferta; suma_alzada… sin
 * los del Art. 130), y los valores del Art. 46.1 —pago_consumo,
 * honorario_fijo_comision, no_aplica, las modalidades de obra— lo violan. Al
 * escribirlos, el PATCH del paso caía con 500 (constraint) y NADA de A4 se
 * guardaba. La ficha ya toma ambos del hito (resumenDelExpediente lee A4 y deja la
 * columna solo de respaldo), así que quitarlos no pierde nada. Reflejarlos exige
 * antes migrar el CHECK al vocabulario de la Ley 32069.
 */
const A4_A_COLUMNAS: Record<string, string> = {
  var_a_procedimiento: "procedure_type",
  var_e_tipo_evaluador: "tipo_evaluador_perfil",
  var_f_requisitos_calificacion: "requisitos_calificacion",
  var_l_garantias_adelantos: "garantias_adelantos",
  var_n_tipo_interaccion: "tipo_interaccion_mercado",
};

/** A3 · Requerimiento: lo que el área usuaria fijó y la ficha resume. */
const A3_A_COLUMNAS: Record<string, string> = {
  formula_reajuste: "formula_reajuste",
};

/**
 * A7 · Certificación presupuestal.
 *
 * Se compone en una línea legible ("CCP N° 123 — S/ 45,000.00") porque la ficha
 * tiene una sola fila para esto, mientras que el paso guarda número, monto y
 * fecha por separado. Se prefiere la CCP sobre el documento genérico: es la
 * certificación de verdad, el otro puede ser una previsión.
 */
function columnasDeA7(data: DatosHito): Record<string, string> {
  const numero = texto(data, "numero_ccp") || texto(data, "numero");
  const monto = texto(data, "monto_ccp") || texto(data, "monto");
  if (!numero && !monto) return {};
  const partes = [numero ? `N° ${numero}` : "", monto ? `S/ ${monto}` : ""].filter(Boolean);
  return { certificacion_presupuestal: partes.join(" — ") };
}

/** A8 · Aprobación del expediente (Art. 54): quién aprueba y con qué documento. */
function columnasDeA8(data: DatosHito): Record<string, string> {
  const out: Record<string, string> = {};
  const autoridad = texto(data, "autoridad");
  if (autoridad) out.autoridad_aprobacion = autoridad;
  const documento = texto(data, "numero_documento");
  if (documento) out.doc_aprobacion_expediente = documento;
  return out;
}

/**
 * Columnas que hay que actualizar tras guardar un paso.
 *
 * Solo devuelve lo que TIENE valor: un campo que el usuario aún no llenó no debe
 * borrar lo que ya hubiera en la columna. Vaciar un dato es una decisión, y se
 * toma en el paso, no de rebote al autoguardar un formulario a medias.
 */
export function columnasDesdeHito(code: string, data: DatosHito | null): Record<string, string> {
  if (!data) return {};
  if (code === "A7") return columnasDeA7(data);
  if (code === "A8") return columnasDeA8(data);

  const mapa = code === "A4" ? A4_A_COLUMNAS : code === "A3" ? A3_A_COLUMNAS : null;
  if (!mapa) return {};

  const patch: Record<string, string> = {};
  for (const [campo, columna] of Object.entries(mapa)) {
    const valor = texto(data, campo);
    if (valor) patch[columna] = valor;
  }
  return patch;
}

/** Pasos que alimentan alguna columna, para documentarlo en un solo sitio. */
export const PASOS_QUE_ALIMENTAN_COLUMNAS = ["A3", "A4", "A7", "A8"] as const;

// ─── Lectura para la ficha ───────────────────────────────────────────────────
//
// La ficha del detalle NO lee las columnas: lee `hitos`, que es donde el paso
// guarda el dato y de donde ya lee el exportador del Formato 1.
//
// El motivo es práctico además de conceptual. Las columnas solo se rellenan
// cuando alguien vuelve a guardar el paso, así que todos los expedientes creados
// antes de cablearlas se quedarían en "—" hasta que un humano reabriera A4, A7 y
// A8 uno por uno. Leyendo del jsonb, la ficha sale correcta desde el primer
// momento y no hay copia que pueda quedarse vieja.
//
// La columna sigue como respaldo por si un dato se escribió ahí y no en el paso.

/** Estado de los pasos tal como llega del expediente. */
export type HitosDelExpediente = Record<string, { data?: Record<string, unknown> | null }> | null;

function delHito(hitos: HitosDelExpediente, code: string, campo: string): string {
  const v = hitos?.[code]?.data?.[campo];
  return typeof v === "string" ? v.trim() : "";
}

/** Valor de la ficha: primero el paso, luego la columna. Vacío → null. */
function preferido(delPaso: string, deColumna: string | null | undefined): string | null {
  if (delPaso) return delPaso;
  const c = (deColumna ?? "").trim();
  return c || null;
}

export type ProcesoParaResumen = {
  certificacion_presupuestal?: string | null;
  formula_reajuste?: string | null;
  garantias_adelantos?: string | null;
  modalidad_ejecucion?: string | null;
  requisitos_calificacion?: string | null;
  sistema_contratacion?: string | null;
  tipo_evaluador_perfil?: string | null;
  tipo_interaccion_mercado?: string | null;
  autoridad_aprobacion?: string | null;
  doc_aprobacion_expediente?: string | null;
};

export type ResumenExpediente = {
  certificacionPresupuestal: string | null;
  sistemaEntrega: string | null;
  modalidadPago: string | null;
  formulaReajuste: string | null;
  interaccionMercado: string | null;
  requisitosCalificacion: string | null;
  tipoEvaluador: string | null;
  garantiasAdelantos: string | null;
  aprobacion: string | null;
};

export function resumenDelExpediente(
  proceso: ProcesoParaResumen,
  hitos: HitosDelExpediente,
): ResumenExpediente {
  const a7 = columnasDeA7(hitos?.A7?.data ?? {});
  const a8 = columnasDeA8(hitos?.A8?.data ?? {});

  // La aprobación se compone igual que en la columna, para que el respaldo y el
  // dato del paso se lean idénticos y no parezcan dos cosas distintas.
  const autoridad = a8.autoridad_aprobacion || (proceso.autoridad_aprobacion ?? "");
  const documento = a8.doc_aprobacion_expediente || (proceso.doc_aprobacion_expediente ?? "");

  return {
    aprobacion: autoridad
      ? `${autoridad.toUpperCase()}${documento ? ` — ${documento}` : ""}`
      : null,
    certificacionPresupuestal: preferido(
      a7.certificacion_presupuestal ?? "",
      proceso.certificacion_presupuestal,
    ),
    formulaReajuste: preferido(delHito(hitos, "A3", "formula_reajuste"), proceso.formula_reajuste),
    garantiasAdelantos: preferido(
      delHito(hitos, "A4", "var_l_garantias_adelantos"),
      proceso.garantias_adelantos,
    ),
    interaccionMercado: preferido(
      delHito(hitos, "A4", "var_n_tipo_interaccion"),
      proceso.tipo_interaccion_mercado,
    ),
    modalidadPago: preferido(
      delHito(hitos, "A4", "var_h_modalidad_pago"),
      proceso.modalidad_ejecucion,
    ),
    requisitosCalificacion: preferido(
      delHito(hitos, "A4", "var_f_requisitos_calificacion"),
      proceso.requisitos_calificacion,
    ),
    sistemaEntrega: preferido(
      delHito(hitos, "A4", "var_i_sistema_entrega"),
      proceso.sistema_contratacion,
    ),
    tipoEvaluador: preferido(
      delHito(hitos, "A4", "var_e_tipo_evaluador"),
      proceso.tipo_evaluador_perfil,
    ),
  };
}
