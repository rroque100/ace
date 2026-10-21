// Acta de Otorgamiento de la Buena Pro (B7) en Word.
//
// // VERIFICAR: el texto protocolar exacto (membrete, fórmula de apertura,
// orden de las cláusulas) debe confirmarse contra el formato que la entidad
// ya usa para esta acta, o contra el formato de las bases estándar del OECE
// (ver "Bases_estandar_de_Subasta_inversa_electronica" en el corpus indexado —
// consultar con la skill verificacion-legal-rag antes de dar este documento
// por listo para producción). Lo que sigue es un borrador estructural con las
// MISMAS convenciones tipográficas que lib/evaluadores-docx.ts (Arial 10pt),
// no un formato ya confirmado.

import { AlignmentType, Document, Packer, Paragraph, TextRun } from "docx";
import type { DatosActaBuenaPro } from "./buena-pro-docx-datos";

const FUENTE = "Arial";
const TAM = 20; // 10 pt, como los formatos de la entidad.

function parrafo(
  texto: string,
  opts?: { negrita?: boolean; alineacion?: (typeof AlignmentType)[keyof typeof AlignmentType] },
): Paragraph {
  return new Paragraph({
    alignment: opts?.alineacion ?? AlignmentType.JUSTIFIED,
    children: [new TextRun({ bold: opts?.negrita, font: FUENTE, size: TAM, text: texto })],
    spacing: { after: 200 },
  });
}

export async function generarActaBuenaPro(datos: DatosActaBuenaPro): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        children: [
          parrafo("ACTA DE OTORGAMIENTO DE LA BUENA PRO", { alineacion: AlignmentType.CENTER, negrita: true }),
          parrafo(`Procedimiento de selección: ${datos.nomenclatura}`),
          parrafo(`Fecha de otorgamiento: ${datos.fechaOtorgamiento}`),
          parrafo(
            `El Comité de Selección, en atención a los resultados de la evaluación y calificación de ofertas, ` +
              `otorga la Buena Pro del presente procedimiento a favor de ${datos.ganadorRazonSocial}, ` +
              `por el monto de S/ ${datos.montoAdjudicado.toLocaleString("es-PE")}.`,
          ),
          parrafo("Postores admitidos:", { negrita: true }),
          ...datos.postoresAdmitidos.map((p) => parrafo(`- ${p.razonSocial} (RUC ${p.ruc})`)),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}
