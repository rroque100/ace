// Detalle de dominio de la FASE 2 · Selección (Ley N° 32069).
//
// Fuente: Ley N° 32069, Ley General de Contrataciones Públicas; Reglamento
// D.S. 009-2025-EF modificado por D.S. 001-2026-EF. Abarca desde la
// convocatoria hasta el consentimiento de la buena pro.

import type { PasoDetalle } from "./actuaciones-preparatorias";
import { DIAS_HABILES_CONSENTIMIENTO } from "./estrategia-formato";

export const PASOS_F2: Record<string, PasoDetalle> = {
  B1: {
    code: "B1",
    accionGuia: "Convocatoria",
    baseLegal: "Arts. 63 y 64 del Reglamento",
    objetivo:
      "Publicar la convocatoria del procedimiento de selección en el SEACE/PLADICOP junto con las bases y documentos del expediente. La convocatoria marca el inicio formal de la fase de selección.",
    responsables: "DEC / Oficial de Compra",
    formatos: ["Convocatoria en PLADICOP", "Bases del procedimiento"],
    campos: [
      { name: "publicado_seace", label: "Convocatoria publicada en SEACE/PLADICOP", tipo: "boolean", required: true, baseLegal: "Art. 63.1 Reglamento" },
      { name: "fecha_convocatoria", label: "Fecha de convocatoria", tipo: "date", required: true },
      { name: "numero_convocatoria", label: "Número de convocatoria", tipo: "text", required: true },
      { name: "plazo_presentacion", label: "Plazo para presentación de ofertas (días calendario)", tipo: "number", required: true, baseLegal: "Arts. 64-65 Reglamento" },
      { name: "observaciones", label: "Observaciones", tipo: "textarea", ancho: "full" },
    ],
  },
  B2: {
    code: "B2",
    accionGuia: "Registro de participantes",
    baseLegal: "Arts. 67 al 70 del Reglamento",
    objetivo:
      "Registrar a los proveedores interesados que adquieren las bases (o se registran electrónicamente) y presentan ofertas. Verificar que cumplen los requisitos de admisión.",
    responsables: "Oficial de Compra",
    formatos: ["Registro de participantes", "Lista de admitidos / no admitidos"],
    campos: [
      { name: "cantidad_postores", label: "Número de postores registrados", tipo: "number", required: true },
      { name: "cantidad_admitidos", label: "Número de postores admitidos", tipo: "number", required: true },
      { name: "relacion_admitidos", label: "Relación de postores admitidos / no admitidos", tipo: "postores", ancho: "full", required: true, baseLegal: "Arts. 67-70 del Reglamento" },
      { name: "subsanaciones", label: "¿Se otorgó plazo de subsanación?", tipo: "boolean", baseLegal: "Art. 90.3 Reglamento" },
      { name: "observaciones", label: "Observaciones", tipo: "textarea", ancho: "full" },
    ],
  },
  B3: {
    code: "B3",
    accionGuia: "Consultas y observaciones",
    baseLegal: "Arts. 71 al 73 del Reglamento",
    objetivo:
      "Recibir, absolver e integrar las consultas y observaciones que los participantes formulan a las bases, dentro del plazo legal. El comité emite el pliego absolutorio.",
    responsables: "Comité",
    formatos: ["Pliego absolutorio de consultas y observaciones"],
    campos: [
      { name: "cantidad_consultas", label: "Número de consultas recibidas", tipo: "number" },
      { name: "cantidad_observaciones", label: "Número de observaciones recibidas", tipo: "number" },
      { name: "pliego_absolutorio", label: "Pliego absolutorio emitido y notificado", tipo: "boolean", required: true, baseLegal: "Art. 73 Reglamento" },
      { name: "fecha_absolucion", label: "Fecha de absolución", tipo: "date", required: true },
      { name: "observaciones", label: "Observaciones", tipo: "textarea", ancho: "full" },
    ],
  },
  B4: {
    code: "B4",
    accionGuia: "Bases integradas",
    baseLegal: "Art. 74 del Reglamento",
    objetivo:
      "Publicar las bases integradas (versión definitiva que incorpora las modificaciones del pliego absolutorio) y fijar la nueva fecha de presentación de ofertas si corresponde.",
    responsables: "Comité",
    formatos: ["Bases integradas publicadas en PLADICOP"],
    campos: [
      { name: "bases_integradas", label: "Bases integradas publicadas en PLADICOP", tipo: "boolean", required: true, baseLegal: "Art. 74.1 Reglamento" },
      { name: "fecha_publicacion", label: "Fecha de publicación", tipo: "date", required: true },
      { name: "nueva_fecha_ofertas", label: "Nueva fecha de presentación de ofertas (si aplica)", tipo: "date", baseLegal: "Art. 74.2 Reglamento" },
      { name: "observaciones", label: "Observaciones", tipo: "textarea", ancho: "full" },
    ],
  },
  B5: {
    code: "B5",
    accionGuia: "Presentación de ofertas",
    baseLegal: "Arts. 75 al 77 del Reglamento",
    objetivo:
      "Recibir y registrar las ofertas de los postores admitidos en el acto público (o electrónico) de presentación. Verificar la integridad y confidencialidad de las ofertas recibidas.",
    responsables: "Comité",
    formatos: ["Acta de presentación de ofertas"],
    campos: [
      { name: "acta_presentacion", label: "Acta de presentación de ofertas suscrita", tipo: "boolean", required: true },
      { name: "fecha_presentacion", label: "Fecha de presentación", tipo: "date", required: true },
      { name: "ofertas_recibidas", label: "Número de ofertas recibidas", tipo: "number", required: true },
      { name: "modalidad", label: "Modalidad de presentación", tipo: "select", required: true, opciones: [
        { value: "presencial", label: "Presencial" },
        { value: "electronica", label: "Electrónica (SEACE/PLADICOP)" },
        { value: "mixta", label: "Mixta" },
      ]},
      { name: "observaciones", label: "Observaciones", tipo: "textarea", ancho: "full" },
    ],
  },
  B6: {
    code: "B6",
    accionGuia: "Evaluación y calificación",
    baseLegal: "Arts. 78 al 82 del Reglamento",
    objetivo:
      "Evaluar las ofertas según los factores establecidos en las bases: admisión, calificación técnica y evaluación económica. Emitir el informe o acta de evaluación que determina el orden de prelación.",
    responsables: "Comité / Jurado",
    formatos: ["Acta de evaluación y calificación", "Informe de evaluación"],
    campos: [
      { name: "acta_evaluacion", label: "Acta/informe de evaluación emitido", tipo: "boolean", required: true },
      { name: "fecha_evaluacion", label: "Fecha de evaluación", tipo: "date", required: true },
      { name: "total_ofertas_validas", label: "Ofertas válidas (que cumplen requisitos)", tipo: "number", required: true },
      { name: "orden_prelacion", label: "Orden de prelación", tipo: "puntajes", ancho: "full", required: true, baseLegal: "Art. 82 Reglamento" },
      { name: "observaciones", label: "Observaciones", tipo: "textarea", ancho: "full" },
    ],
  },
  B7: {
    code: "B7",
    accionGuia: "Otorgamiento de la Buena Pro",
    baseLegal: "Arts. 83 al 86 del Reglamento",
    objetivo:
      "Otorgar la buena pro al postor que obtuvo el primer lugar en la evaluación, mediante acto público (o notificación electrónica). Notificar el resultado a todos los postores.",
    responsables: "Comité",
    formatos: ["Acta de otorgamiento de la buena pro"],
    campos: [
      { name: "acta_buena_pro", label: "Acta de otorgamiento de la buena pro suscrita", tipo: "boolean", required: true },
      { name: "fecha_otorgamiento", label: "Fecha de otorgamiento", tipo: "date", required: true },
      { name: "ganador", label: "Postor ganador", tipo: "text", required: true },
      { name: "monto_adjudicado", label: "Monto adjudicado (S/)", tipo: "number", required: true },
      { name: "notificado", label: "Notificado a todos los postores", tipo: "boolean", required: true, baseLegal: "Art. 85 Reglamento" },
      { name: "observaciones", label: "Observaciones", tipo: "textarea", ancho: "full" },
    ],
  },
  B8: {
    code: "B8",
    accionGuia: "Consentimiento de la Buena Pro",
    baseLegal: "Art. 82 del Reglamento",
    objetivo:
      "Declarar consentida la buena pro una vez vencido el plazo para interponer recursos impugnativos (o resueltos los mismos). El consentimiento habilita el perfeccionamiento del contrato.",
    responsables: "DEC",
    formatos: ["Declaración de consentimiento de la buena pro"],
    campos: [
      { name: "consentida", label: "Buena pro consentida", tipo: "boolean", required: true, baseLegal: "Art. 82.1 Reglamento" },
      {
        name: "fecha_consentimiento",
        label: "Fecha de consentimiento",
        tipo: "date",
        required: true,
        ayuda:
          "Art. 82.1: la buena pro queda consentida al día hábil siguiente de vencido el plazo para apelar (Art. 304), contado desde el otorgamiento (B7). Excepción del Art. 82.2: si se presentó UNA sola oferta, queda consentida el mismo día de su otorgamiento.",
        calcularDesde: {
          hito: "B7",
          campo: "fecha_otorgamiento",
          dias: 9,
          habiles: true,
          etiqueta: "Calcular desde el otorgamiento (plazo de apelación + 1 día hábil)",
          diasPorProcedimiento: DIAS_HABILES_CONSENTIMIENTO,
        },
      },
      { name: "hubo_impugnacion", label: "¿Se interpuso recurso de impugnación?", tipo: "boolean", baseLegal: "Art. 304 Reglamento" },
      { name: "resultado_impugnacion", label: "Resultado de la impugnación (si aplica)", tipo: "textarea", ancho: "full" },
      { name: "observaciones", label: "Observaciones", tipo: "textarea", ancho: "full" },
    ],
  },
};

export function pasoF2(code: string): PasoDetalle | undefined {
  return PASOS_F2[code];
}
