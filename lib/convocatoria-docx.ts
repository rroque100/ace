// Aviso de Convocatoria (B1) en Word.
//
// // VERIFICAR: el texto protocolar exacto (membrete, fórmula de apertura,
// orden de las cláusulas) debe confirmarse contra el formato que la entidad
// ya usa para este aviso en PLADICOP/SEACE, o contra las bases estándar del
// OECE ya indexadas (consultar con la skill verificacion-legal-rag antes de
// dar este documento por listo para producción). Lo que sigue es un borrador
// estructural con las MISMAS convenciones tipográficas que
// lib/buena-pro-docx.ts (Arial 10pt), no un formato ya confirmado.

import { AlignmentType, Document, Packer, Paragraph, TextRun } from "docx";
import { objectTypeLabel } from "./legal-taxonomy";
import type { DatosConvocatoria } from "./convocatoria-docx-datos";

const FUENTE = "Arial";
const TAM = 20; // 10 pt

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

export async function generarAvisoConvocatoria(datos: DatosConvocatoria): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        children: [
          parrafo("AVISO DE CONVOCATORIA", { alineacion: AlignmentType.CENTER, negrita: true }),
          parrafo(`Convocatoria N° ${datos.numeroConvocatoria}`),
          parrafo(`Procedimiento de selección: ${datos.nomenclatura}`),
          parrafo(`Objeto de la contratación: ${objectTypeLabel(datos.objectType)}`),
          parrafo(
            datos.amount != null
              ? `Valor referencial: S/ ${datos.amount.toLocaleString("es-PE")}.`
              : "Valor referencial: no registrado en el expediente.",
          ),
          parrafo(`Fecha de convocatoria: ${datos.fechaConvocatoria}`),
          parrafo(`Plazo para la presentación de ofertas: ${datos.plazoPresentacion} día(s) calendario.`),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}
