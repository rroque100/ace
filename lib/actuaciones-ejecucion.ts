// Detalle de dominio de la FASE 3 · Ejecución Contractual (Ley N° 32069).
//
// Fuente: Ley N° 32069, Ley General de Contrataciones Públicas; Reglamento
// D.S. 009-2025-EF modificado por D.S. 001-2026-EF. Abarca desde el
// perfeccionamiento del contrato hasta la liquidación y cierre.

import type { PasoDetalle } from "./actuaciones-preparatorias";

export const PASOS_F3: Record<string, PasoDetalle> = {
  C1: {
    code: "C1",
    accionGuia: "Perfeccionamiento del contrato",
    baseLegal: "Arts. 74 de la Ley; Arts. 116 al 118 del Reglamento",
    objetivo:
      "Suscribir el contrato entre la entidad contratante y el contratista ganador de la buena pro, dentro del plazo legal. El contrato se perfecciona con la suscripción y, de corresponder, con la presentación de garantías.",
    responsables: "DEC / Legal",
    formatos: ["Contrato suscrito", "Garantía de fiel cumplimiento (de corresponder)"],
    campos: [
      { name: "contrato_suscrito", label: "Contrato suscrito", tipo: "boolean", required: true, baseLegal: "Art. 117 Reglamento" },
      { name: "fecha_suscripcion", label: "Fecha de suscripción", tipo: "date", required: true },
      { name: "numero_contrato", label: "Número de contrato", tipo: "text", required: true },
      { name: "garantia_fiel_cumplimiento", label: "Garantía de fiel cumplimiento presentada", tipo: "boolean", baseLegal: "Art. 119 Reglamento" },
      { name: "monto_contratado", label: "Monto contratado (S/)", tipo: "number", required: true },
      { name: "plazo_ejecucion", label: "Plazo de ejecución", tipo: "text", required: true, placeholder: "Ej: 90 días calendario" },
      { name: "observaciones", label: "Observaciones", tipo: "textarea", ancho: "full" },
    ],
  },
  C2: {
    code: "C2",
    accionGuia: "Verificación posterior",
    baseLegal: "Art. 119 de la Ley; Arts. 120 y 121 del Reglamento",
    objetivo:
      "Verificar que el contratista cumple con los requisitos y condiciones exigidas para la ejecución del contrato (garantías, licencias, personal, equipos, etc.) antes del inicio formal.",
    responsables: "DEC",
    formatos: ["Acta de verificación posterior", "Informe de verificación"],
    campos: [
      { name: "verificado", label: "Verificación posterior realizada", tipo: "boolean", required: true, baseLegal: "Art. 120 Reglamento" },
      { name: "fecha_verificacion", label: "Fecha de verificación", tipo: "date", required: true },
      { name: "resultado", label: "Resultado de la verificación", tipo: "select", required: true, opciones: [
        { value: "conforme", label: "Conforme" },
        { value: "observado", label: "Observado" },
        { value: "no_conforme", label: "No conforme" },
      ]},
      { name: "sustento", label: "Sustento / detalle", tipo: "textarea", ancho: "full" },
    ],
  },
  C3: {
    code: "C3",
    accionGuia: "Suscripción o notificación de orden",
    baseLegal: "Art. 122 del Reglamento",
    objetivo:
      "Emitir y notificar la orden de compra/servicio o suscribir el acta de inicio para obras. Formalizar el inicio del plazo de ejecución contractual.",
    responsables: "DEC",
    formatos: ["Orden de compra / servicio", "Acta de inicio de obra"],
    campos: [
      { name: "orden_emitida", label: "Orden/acta de inicio emitida", tipo: "boolean", required: true },
      { name: "fecha_inicio", label: "Fecha de inicio del plazo contractual", tipo: "date", required: true },
      { name: "tipo_orden", label: "Tipo", tipo: "select", required: true, opciones: [
        { value: "orden_compra", label: "Orden de compra" },
        { value: "orden_servicio", label: "Orden de servicio" },
        { value: "acta_inicio_obra", label: "Acta de inicio de obra" },
      ]},
      { name: "notificado", label: "Notificado al contratista", tipo: "boolean", required: true },
      { name: "observaciones", label: "Observaciones", tipo: "textarea", ancho: "full" },
    ],
  },
  C4: {
    code: "C4",
    accionGuia: "Inicio de ejecución",
    baseLegal: "Arts. 123 al 127 del Reglamento",
    objetivo:
      "Iniciar la ejecución de la prestación contratada. El área usuaria (o el inspector/supervisor) da conformidad al inicio y monitorea el cumplimiento del objeto contractual.",
    responsables: "Área usuaria / DEC",
    formatos: ["Informe de inicio de ejecución"],
    campos: [
      { name: "inicio_ejecucion", label: "Ejecución iniciada", tipo: "boolean", required: true },
      { name: "fecha_inicio_real", label: "Fecha de inicio real", tipo: "date", required: true },
      { name: "inspector_supervisor", label: "Inspector / supervisor designado", tipo: "text", baseLegal: "Art. 124 Reglamento" },
      { name: "condiciones_cumplidas", label: "Condiciones previas cumplidas (licencias, terreno, etc.)", tipo: "textarea", ancho: "full", baseLegal: "Art. 123 Reglamento" },
      { name: "observaciones", label: "Observaciones", tipo: "textarea", ancho: "full" },
    ],
  },
  C5: {
    code: "C5",
    accionGuia: "Gestión de modificaciones",
    baseLegal: "Arts. 128 al 133 del Reglamento",
    objetivo:
      "Gestionar las modificaciones contractuales durante la ejecución: ampliaciones de plazo, reducciones, adicionales (hasta 25% del monto), mejoras, y otras variaciones autorizadas por la normativa.",
    responsables: "DEC / Legal",
    formatos: ["Adendas", "Resoluciones de ampliación/adicional", "Informe de sustento"],
    campos: [
      { name: "hubo_modificaciones", label: "¿Hubo modificaciones contractuales?", tipo: "boolean" },
      { name: "tipo_modificacion", label: "Tipo de modificación", tipo: "select", opciones: [
        { value: "ampliacion_plazo", label: "Ampliación de plazo" },
        { value: "adicional", label: "Adicional de obra/servicio" },
        { value: "reduccion", label: "Reducción de prestaciones" },
        { value: "mejora", label: "Mejora técnica" },
        { value: "otro", label: "Otro" },
      ]},
      { name: "documento_modificacion", label: "Documento que aprueba la modificación", tipo: "text" },
      { name: "sustento", label: "Sustento de la modificación", tipo: "textarea", ancho: "full", baseLegal: "Art. 128 Reglamento" },
      { name: "observaciones", label: "Observaciones", tipo: "textarea", ancho: "full" },
    ],
  },
  C6: {
    code: "C6",
    accionGuia: "Recepción y conformidad",
    baseLegal: "Arts. 134 al 136 del Reglamento",
    objetivo:
      "Recibir la prestación ejecutada y emitir la conformidad (total o parcial) por parte del área usuaria, verificando que cumple con las especificaciones técnicas, condiciones contractuales y plazos.",
    responsables: "Área usuaria",
    formatos: ["Acta de recepción", "Informe de conformidad"],
    campos: [
      { name: "recepcion_realizada", label: "Recepción realizada", tipo: "boolean", required: true, baseLegal: "Art. 134 Reglamento" },
      { name: "fecha_recepcion", label: "Fecha de recepción", tipo: "date", required: true },
      { name: "conformidad", label: "Conformidad emitida", tipo: "boolean", required: true, baseLegal: "Art. 136 Reglamento" },
      { name: "tipo_conformidad", label: "Tipo de conformidad", tipo: "select", opciones: [
        { value: "total", label: "Total" },
        { value: "parcial", label: "Parcial" },
      ]},
      { name: "observaciones", label: "Observaciones / pendientes", tipo: "textarea", ancho: "full" },
    ],
  },
  C7: {
    code: "C7",
    accionGuia: "Pago de la contraprestación",
    baseLegal: "Arts. 137 al 139 del Reglamento",
    objetivo:
      "Efectuar el pago al contratista contra la conformidad emitida y la presentación del comprobante de pago correspondiente, dentro del plazo legal (15 días hábiles según Art. 138).",
    responsables: "DEC",
    formatos: ["Comprobante de pago", "Orden de pago"],
    campos: [
      { name: "pago_realizado", label: "Pago realizado", tipo: "boolean", required: true },
      { name: "fecha_pago", label: "Fecha de pago", tipo: "date", required: true },
      { name: "monto_pagado", label: "Monto pagado (S/)", tipo: "number", required: true },
      { name: "numero_comprobante", label: "Número de comprobante / orden de pago", tipo: "text", required: true },
      { name: "observaciones", label: "Observaciones", tipo: "textarea", ancho: "full" },
    ],
  },
  C8: {
    code: "C8",
    accionGuia: "Liquidación y cierre",
    baseLegal: "Arts. 140 al 143 del Reglamento",
    objetivo:
      "Realizar la liquidación final del contrato, verificando el cumplimiento total de las obligaciones y determinando el saldo económico. Cerrar formalmente el expediente de contratación.",
    responsables: "DEC",
    formatos: ["Acta de liquidación", "Resolución de cierre del expediente"],
    campos: [
      { name: "liquidacion_realizada", label: "Liquidación realizada", tipo: "boolean", required: true, baseLegal: "Art. 140 Reglamento" },
      { name: "fecha_liquidacion", label: "Fecha de liquidación", tipo: "date", required: true },
      { name: "saldo_final", label: "Saldo final (S/)", tipo: "number" },
      { name: "archivado", label: "Expediente archivado / cerrado", tipo: "boolean", required: true },
      { name: "observaciones_finales", label: "Observaciones finales / lecciones aprendidas", tipo: "textarea", ancho: "full" },
    ],
  },
};

export function pasoF3(code: string): PasoDetalle | undefined {
  return PASOS_F3[code];
}
