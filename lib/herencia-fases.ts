// Herencia entre fases: lo que la Fase 1 (Actuaciones Preparatorias) ya decidió
// y las fases de Selección (F2) y Ejecución (F3) necesitan como INSUMO.
//
// El criterio es el mismo de toda la Fase 1: "un hecho, un dueño". La estrategia
// (A4) determina el procedimiento, los factores de evaluación, las garantías y
// el cronograma; la fase de selección los EJECUTA, no los vuelve a decidir. Que
// cada dato tenga un único origen evita que dos documentos del mismo expediente
// se contradigan.
//
// No se auto-rellena: se OFRECE como insumo con su origen citado, igual que
// A5→A4. Un dato heredado en silencio que luego alguien edita a mano rompe la
// trazabilidad; un insumo visible con "viene de A4" la conserva.

import type { HitosMap } from "./procurement-fases";

export type Insumo = {
  /** Paso destino (B1, C1…) al que alimenta. */
  destino: string;
  /** Campo del paso destino que recibe el insumo. */
  campo: string;
  /** Etiqueta legible del dato. */
  label: string;
  /** Valor heredado (texto ya legible). */
  valor: string;
  /** De dónde viene, citado para la trazabilidad. */
  origen: string;
};

function texto(hitos: HitosMap, code: string, key: string): string {
  const v = hitos[code]?.data?.[key];
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v);
}

/**
 * Insumos de la Fase 1 hacia la fase de SELECCIÓN (F2).
 *
 * - El procedimiento (A4) define B1 Convocatoria: qué se convoca.
 * - Los factores de evaluación (A4 g) definen B6 Evaluación: con qué se evalúa.
 * - El cronograma de selección (A4 o) define las fechas de B1–B8.
 * - Los requisitos de calificación (A4 f) definen a quién se admite en B6.
 */
export function insumosParaSeleccion(hitos: HitosMap): Insumo[] {
  const out: Insumo[] = [];

  const procedimiento = texto(hitos, "A4", "var_a_procedimiento");
  const nomenclatura = texto(hitos, "A4", "var_a_nomenclatura");
  if (procedimiento) {
    out.push({
      campo: "numero_convocatoria",
      destino: "B1",
      label: "Procedimiento y nomenclatura",
      origen: "A4 · a) Tipo de procedimiento (Art. 46.1.a)",
      valor: [procedimiento, nomenclatura].filter(Boolean).join(" "),
    });
  }

  const factores = texto(hitos, "A4", "factores_items");
  // factores_items es un array serializado; se cuenta, no se vuelca crudo.
  const nFactores = (() => {
    try {
      const arr = JSON.parse(factores || "[]");
      return Array.isArray(arr) ? arr.length : 0;
    } catch {
      return 0;
    }
  })();
  if (nFactores > 0) {
    out.push({
      campo: "observaciones",
      destino: "B6",
      label: "Factores de evaluación definidos",
      origen: "A4 · g) Factores de evaluación (Art. 46.1.g)",
      valor: `${nFactores} factor(es) de evaluación establecidos en la estrategia.`,
    });
  }

  const requisitos = texto(hitos, "A4", "var_f_requisitos_calificacion");
  if (requisitos) {
    out.push({
      campo: "relacion_admitidos",
      destino: "B6",
      label: "Requisitos de calificación",
      origen: "A4 · f) Requisitos de calificación (Art. 46.1.f)",
      valor: "La admisión se verifica contra los requisitos de calificación de la estrategia.",
    });
  }

  return out;
}

/**
 * Insumos de la Fase 1 hacia la fase de EJECUCIÓN (F3).
 *
 * - Las garantías y adelantos (A4 l) definen C1 Perfeccionamiento del contrato.
 * - La modalidad de pago (A4 h) define C7 Pago de la contraprestación.
 * - El sistema de entrega (A4 i) define C6 Recepción y conformidad.
 */
export function insumosParaEjecucion(hitos: HitosMap): Insumo[] {
  const out: Insumo[] = [];

  const garantia = texto(hitos, "A4", "si_garantia_fiel_cumplimiento");
  if (garantia === "si") {
    out.push({
      campo: "observaciones",
      destino: "C1",
      label: "Garantía de fiel cumplimiento",
      origen: "A4 · l) Garantías (Art. 46.1.l)",
      valor: "La estrategia determinó que corresponde garantía de fiel cumplimiento.",
    });
  }

  const modalidadPago = texto(hitos, "A4", "var_h_modalidad_pago");
  if (modalidadPago) {
    out.push({
      campo: "observaciones",
      destino: "C7",
      label: "Modalidad de pago",
      origen: "A4 · h) Modalidad de pago (Art. 46.1.h)",
      valor: `Modalidad de pago establecida en la estrategia: ${modalidadPago}.`,
    });
  }

  const sistema = texto(hitos, "A4", "var_i_sistema_entrega");
  if (sistema) {
    out.push({
      campo: "observaciones",
      destino: "C6",
      label: "Sistema de entrega",
      origen: "A4 · i) Sistema de entrega (Art. 46.1.i)",
      valor: `Sistema de entrega definido en la estrategia: ${sistema}.`,
    });
  }

  return out;
}

/** Todos los insumos que un paso concreto (Bx/Cx) recibe de la Fase 1. */
export function insumosDePaso(code: string, hitos: HitosMap): Insumo[] {
  const fuente = code.startsWith("B") ? insumosParaSeleccion(hitos) : insumosParaEjecucion(hitos);
  return fuente.filter((i) => i.destino === code);
}
