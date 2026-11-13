// Verificación determinista de cifras atribuidas a IMÁGENES del caso ([C#]).
// Con visión activa el modelo lee los píxeles, pero el ancho de banda de la
// revisión de evidencia es texto: el ancla disponible es la transcripción OCR
// guardada en la subida. Si una cifra específica (UIT, S/, %) atribuida a una
// imagen NO aparece en esa transcripción, se declara la advertencia en
// «Verificación y límites» en lugar de certificar el dato. Los PDFs del caso
// (texto extraído directamente) no se verifican aquí: su texto ES el original.

import { extractSpecificData } from "./citation-faithfulness";
import type { SelectedCaseAttachment } from "./chat-case-attachments";

const esImagen = (mime: string) => mime === "image/png" || mime === "image/jpeg";
const MARCADOR = /\[C(\d+)\]/g;
const GRUPO = /((?:\s*,?\s*\[C\d+\])+)/;
const canonical = (value: string) => value.toLowerCase().replace(/\s+/g, "").replace(/,/g, ".");

export function checkImageFaithfulness(
  answer: string,
  caseDocuments: SelectedCaseAttachment[],
): string[] {
  const advertencias: string[] = [];
  const segmentos = answer.split(GRUPO).filter(Boolean);
  for (let index = 0; index < segmentos.length; index += 1) {
    const segmento = segmentos[index];
    const numeros = [...segmento.matchAll(MARCADOR)].map((m) => Number(m[1]));
    const esGrupoMarcadores =
      numeros.length > 0 && segmento.replace(/[\s,]|\[C\d+\]/g, "") === "";
    if (!esGrupoMarcadores) continue;
    // La afirmación es el texto inmediatamente anterior al grupo de marcadores.
    const afirmacion = segmentos[index - 1] ?? "";
    const datos = extractSpecificData(afirmacion);
    if (!datos.length) continue;
    for (const dato of datos) {
      const imagenesCitadas = numeros
        .map((numero) => caseDocuments[numero - 1])
        .filter((documento): documento is SelectedCaseAttachment => Boolean(documento) && esImagen(documento.mime));
      if (!imagenesCitadas.length) continue;
      const soportado = imagenesCitadas.some((documento) =>
        extractSpecificData(documento.lectura.text).some(
          (item) => canonical(item.raw) === canonical(dato.raw),
        ),
      );
      if (!soportado) {
        const referencias = numeros
          .filter((numero) => caseDocuments[numero - 1] && esImagen(caseDocuments[numero - 1].mime))
          .map((numero) => `C${numero}`)
          .join(", ");
        advertencias.push(
          `El dato "${dato.raw}" atribuido a la imagen ${referencias} no aparece en su transcripción; revisa la imagen original antes de apoyar una decisión en ese valor.`,
        );
      }
    }
  }
  return [...new Set(advertencias)];
}
