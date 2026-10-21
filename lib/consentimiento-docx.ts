// Declaración de Consentimiento de la Buena Pro (B8) en Word.
//
// // VERIFICAR: el texto protocolar exacto debe confirmarse contra el formato
// que la entidad ya usa para esta declaración, o contra las bases estándar
// del OECE ya indexadas (consultar con la skill verificacion-legal-rag antes
// de dar este documento por listo para producción). Lo que sigue es un
// borrador estructural con las MISMAS convenciones tipográficas que
// lib/buena-pro-docx.ts (Arial 10pt), no un formato ya confirmado.

import { AlignmentType, Document, Packer, Paragraph, TextRun } from "docx";
import type { DatosConsentimiento } from "./consentimiento-docx-datos";

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

export async function generarConsentimiento(datos: DatosConsentimiento): Promise<Buffer> {
  const parrafos: Paragraph[] = [
    parrafo("DECLARACIÓN DE CONSENTIMIENTO DE LA BUENA PRO", { alineacion: AlignmentType.CENTER, negrita: true }),
    parrafo(`Procedimiento de selección: ${datos.nomenclatura}`),
  ];

  if (datos.ofertaUnica) {
    parrafos.push(
      parrafo(
        `Se declara CONSENTIDA la buena pro con fecha ${datos.fechaConsentimiento}, al haberse presentado ` +
          `una única oferta admitida, conforme a la excepción del Art. 82.2 del Reglamento.`,
      ),
    );
  } else if (datos.huboImpugnacion) {
    parrafos.push(
      parrafo(
        `Se interpuso recurso de impugnación contra el otorgamiento de la buena pro. ` +
          `Resultado: ${datos.resultadoImpugnacion ?? "no registrado"}.`,
      ),
      parrafo(
        `Resuelta la impugnación, se declara CONSENTIDA la buena pro con fecha ${datos.fechaConsentimiento}.`,
      ),
    );
  } else {
    parrafos.push(
      parrafo(
        `Vencido el plazo para interponer recursos impugnativos sin que se haya presentado alguno, ` +
          `se declara CONSENTIDA la buena pro con fecha ${datos.fechaConsentimiento}, conforme al Art. 82.1 del Reglamento.`,
      ),
    );
  }

  const doc = new Document({ sections: [{ children: parrafos }] });
  return Packer.toBuffer(doc);
}
