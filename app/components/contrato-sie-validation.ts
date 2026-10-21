"use client";

import { useMemo } from "react";
import { parseSoles } from "@/lib/parse-soles";

// Hook de validacion por seccion del formulario SIE.
// Devuelve un mapa de seccion -> { done, total, fields } para mostrar
// indicadores visuales de "visto bueno" por cada paso.

export type SectionStatus = {
  done: number;
  total: number;
  fields: Array<{ key: string; label: string; valid: boolean }>;
  isComplete: boolean;
};

type ProcesoLike = {
  nomenclatura: string;
  denominacion: string;
  entidadNombre: string;
  entidadRuc: string;
  entidadDomicilio: string;
  fechaBuenaPro: string;
};

type PostorLike = {
  razonSocial: string;
  ruc: string;
  domicilio: string;
  representante: string;
  docNumero: string;
  correo: string;
  montoOferta: string;
};

type BienLike = { paquete: string; descripcion: string; unidad: string; cantidad: string };

type GarantiaLike = { monto: string; nroCartaFianza: string; banco: string; vencimiento: string };

type EntregaLike = { nro: number; lugarEntrega: string; plazoEntrega: string; tipoDias: string };

export function useContratoValidation(args: {
  proceso: ProcesoLike;
  postor: PostorLike;
  bienes: BienLike[];
  monto: string;
  entregas: EntregaLike[];
  formaPago: string;
  nroPagos: number;
  garantiaAplica: boolean;
  garantia: GarantiaLike;
  institucionArbitral: string;
  ciudadFirma: string;
  preciosItems: unknown[];
  preciosTotalGeneral: string;
}) {
  const { proceso, postor, bienes, monto, entregas, formaPago, garantiaAplica, garantia, institucionArbitral, ciudadFirma, preciosItems, preciosTotalGeneral } = args;

  return useMemo(() => {
    const sections: Record<string, SectionStatus> = {};

    // Seccion 1: Datos del proceso
    const procesoFields = [
      { key: "nomenclatura", label: "Nomenclatura del procedimiento", valid: proceso.nomenclatura.trim().length >= 5 },
      { key: "denominacion", label: "Objeto de la convocatoria", valid: proceso.denominacion.trim().length >= 5 },
      { key: "entidadNombre", label: "Nombre de la entidad", valid: proceso.entidadNombre.trim().length >= 3 },
      { key: "entidadRuc", label: "RUC de la entidad", valid: /^\d{11}$/.test(proceso.entidadRuc.trim()) },
      { key: "entidadDomicilio", label: "Domicilio de la entidad", valid: proceso.entidadDomicilio.trim().length >= 5 },
      { key: "fechaBuenaPro", label: "Fecha de buena pro", valid: proceso.fechaBuenaPro.trim().length > 0 },
    ];
    const procesoDone = procesoFields.filter((f) => f.valid).length;
    sections.proceso = { done: procesoDone, total: procesoFields.length, fields: procesoFields, isComplete: procesoDone === procesoFields.length };

    // Seccion 2: Oferta del postor
    const postorFields = [
      { key: "razonSocial", label: "Razon social del postor", valid: postor.razonSocial.trim().length >= 3 },
      { key: "ruc", label: "RUC del postor", valid: /^\d{11}$/.test(postor.ruc.trim()) },
      { key: "domicilio", label: "Domicilio legal", valid: postor.domicilio.trim().length >= 5 },
      { key: "representante", label: "Representante legal", valid: postor.representante.trim().length >= 3 },
      { key: "docNumero", label: "Documento del representante", valid: postor.docNumero.trim().length >= 8 },
      { key: "correo", label: "Correo electronico", valid: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(postor.correo.trim()) },
      { key: "montoOferta", label: "Monto ofertado", valid: parseSoles(postor.montoOferta) > 0 },
    ];
    const postorDone = postorFields.filter((f) => f.valid).length;
    sections.postor = { done: postorDone, total: postorFields.length, fields: postorFields, isComplete: postorDone === postorFields.length };

    // Seccion 3: Detalle de precios
    const preciosFields = [
      { key: "items", label: "Items de precios cargados", valid: preciosItems.length > 0 },
      { key: "totalGeneral", label: "Total general", valid: parseSoles(preciosTotalGeneral) > 0 },
    ];
    const preciosDone = preciosFields.filter((f) => f.valid).length;
    sections.precios = { done: preciosDone, total: preciosFields.length, fields: preciosFields, isComplete: preciosDone === preciosFields.length };

    // Seccion 4: Condiciones del contrato
    const contratoFields = [
      { key: "monto", label: "Monto contractual", valid: parseSoles(monto || postor.montoOferta) > 0 },
      { key: "formaPago", label: "Forma de pago", valid: formaPago.length > 0 },
      { key: "institucionArbitral", label: "Institucion arbitral", valid: institucionArbitral.trim().length > 0 },
      { key: "ciudadFirma", label: "Ciudad de firma", valid: ciudadFirma.trim().length > 0 },
    ];
    // Entregas: validar que cada entrega tenga lugar y plazo
    entregas.forEach((ent) => {
      contratoFields.push(
        { key: `entrega.${ent.nro}.lugar`, label: `Entrega ${ent.nro}: lugar de entrega`, valid: ent.lugarEntrega.trim().length >= 5 },
        { key: `entrega.${ent.nro}.plazo`, label: `Entrega ${ent.nro}: plazo de entrega`, valid: ent.plazoEntrega.trim().length >= 3 },
      );
    });
    // Garantia: si aplica, validar campos
    if (garantiaAplica) {
      contratoFields.push(
        { key: "garantia.monto", label: "Monto de garantia", valid: parseSoles(garantia.monto) > 0 },
        { key: "garantia.nroCartaFianza", label: "N carta fianza", valid: garantia.nroCartaFianza.trim().length > 0 },
        { key: "garantia.banco", label: "Banco emisor", valid: garantia.banco.trim().length > 0 },
        { key: "garantia.vencimiento", label: "Vencimiento de garantia", valid: garantia.vencimiento.trim().length > 0 },
      );
    }
    // Cronograma: si hay bienes, validar que tengan descripcion
    if (bienes.length > 0) {
      contratoFields.push(
        { key: "cronograma", label: "Cronograma con bienes", valid: bienes.every((b) => b.descripcion.trim().length > 0 && b.cantidad.trim().length > 0) },
      );
    }
    const contratoDone = contratoFields.filter((f) => f.valid).length;
    sections.contrato = { done: contratoDone, total: contratoFields.length, fields: contratoFields, isComplete: contratoDone === contratoFields.length };

    return sections;
  }, [proceso, postor, bienes, monto, entregas, formaPago, garantiaAplica, garantia, institucionArbitral, ciudadFirma, preciosItems, preciosTotalGeneral]);
}
