import { componerAreaConformidad } from "./forma-pago";
import type { ObjetoFilter } from "./procesos-seleccion";

/**
 * Redacta el apartado de recepción y conformidad (Art. 144 del Reglamento).
 *
 * El texto NO es el mismo para bienes que para servicios, y la diferencia no es
 * de estilo:
 *
 *   * en BIENES hay dos actos, la RECEPCIÓN —que da almacén— y la CONFORMIDAD
 *     —que da el área usuaria—, y el plazo se cuenta desde la recepción;
 *   * en SERVICIOS solo hay conformidad, así que el apartado ni siquiera se
 *     titula igual.
 *
 * Por eso se elige la plantilla según el objeto en vez de tener un texto único
 * con frases condicionales: cada formato es el que el OECE publica para su
 * objeto, y mezclarlos daba un apartado que no era ninguno de los dos.
 *
 * Como con la forma de pago, se compone y no se genera: es texto reglamentario
 * con huecos, y parafrasearlo en un documento que se firma sería un defecto.
 */

export type HuecosRecepcion = {
  /** Área que otorga la conformidad. En los dos objetos. */
  areaConformidad: string;
  /** Área o unidad de almacén que efectúa la recepción. Solo bienes. */
  areaRecepcion: string;
  /** Plazo máximo para la conformidad: siete días, o veinte si hay pruebas. */
  plazoConformidad: string;
  /** Plazo para subsanar observaciones. Solo servicios: en bienes es el 30% fijo. */
  plazoSubsanacion: string;
  /**
   * Nombre del proyecto de inversión y su CUI, de «b) Inversión a la que se
   * imputa». No son huecos del formato: acompañan al área que otorga la
   * conformidad, igual que en la forma de pago, para decir a qué inversión
   * pertenece quien firma. Vacíos, el apartado sale sin ellos.
   */
  proyectoInversion: string;
  cui: string;
};

function hueco(valor: string, textoOriginal: string): string {
  const v = valor.trim();
  return v || `[${textoOriginal}]`;
}

/**
 * ¿Qué plantilla toca?
 *
 * La consultoría de obra es un servicio y usa su misma redacción. Las OBRAS no:
 * su recepción se rige por su propio procedimiento (comisión de recepción,
 * pliego de observaciones) y el formato que la entidad facilitó no lo cubre, así
 * que no se inventa: devuelve `null` y el campo se queda para redactar a mano.
 */
export function plantillaPara(objeto: string | null | undefined): "bienes" | "servicios" | null {
  if (objeto === "bienes") return "bienes";
  if (objeto === "servicios" || objeto === "consultoria_obra") return "servicios";
  return null;
}

/**
 * Quién otorga la conformidad, cuando el área de recepción hace sus veces.
 *
 * En SERVICIOS no hay recepción que dar —el formato ni siquiera la nombra—, así
 * que «Área que efectúa la recepción» queda libre para decir quién firma de
 * verdad la conformidad. En una inversión ejecutada por administración directa
 * eso es el RESIDENTE, no la sub gerencia que tramita el pago, y así se registra.
 *
 * En BIENES no se sustituye: ahí la recepción y la conformidad son dos actos y
 * dos áreas —almacén recibe, el área usuaria conforma— y cambiar una por otra
 * haría que el apartado dijera dos veces el mismo nombre. En OBRAS tampoco: su
 * recepción la hace una comisión, con un régimen que este formato no cubre.
 *
 * Sin área de recepción registrada, manda la de conformidad: es lo que había y
 * lo que sigue valiendo para todo lo ya escrito.
 */
export function areaQueOtorgaLaConformidad(
  objeto: ObjetoFilter | string | null | undefined,
  d: { areaConformidad?: string; areaRecepcion?: string },
): string {
  const conformidad = (d.areaConformidad ?? "").trim();
  if (plantillaPara(objeto) !== "servicios") return conformidad;
  return (d.areaRecepcion ?? "").trim() || conformidad;
}

/** Los huecos que pide cada plantilla, para no enseñar los que no aplican. */
export function huecosDePlantilla(objeto: ObjetoFilter | string | null | undefined): Array<keyof HuecosRecepcion> {
  const p = plantillaPara(objeto);
  if (p === "bienes") return ["areaRecepcion", "areaConformidad", "plazoConformidad"];
  if (p === "servicios") return ["areaConformidad", "plazoConformidad", "plazoSubsanacion"];
  return [];
}

const OBSERVACIONES_COMUN =
  "Si pese al plazo otorgado, EL CONTRATISTA no cumpliese a cabalidad con la subsanación, LA ENTIDAD " +
  "CONTRATANTE puede otorgar al CONTRATISTA periodos adicionales para las correcciones pertinentes. En " +
  "este supuesto corresponde aplicar la penalidad por mora desde el vencimiento del plazo para subsanar " +
  "sin considerar los días en los que pudiera incurrir la entidad contratante para efectuar las revisiones " +
  "y notificar las observaciones correspondientes.";

/** Último párrafo: solo cambia la palabra «bienes» / «servicios». */
function noEjecutada(que: string): string {
  return (
    `Este procedimiento no resulta aplicable cuando los ${que} manifiestamente no cumplan con las ` +
    "características y condiciones ofrecidas, en cuyo caso LA ENTIDAD CONTRATANTE no efectúa la recepción " +
    "o no otorga la conformidad, según corresponda, debiendo considerarse como no ejecutada la prestación, " +
    "aplicándose la penalidad que corresponda por cada día de atraso."
  );
}

/**
 * El texto del apartado para este objeto.
 *
 * Devuelve `null` cuando no hay plantilla (obras): quien llama debe dejar el
 * campo como está en vez de escribir algo aproximado.
 */
export function componerRecepcionConformidad(
  objeto: ObjetoFilter | string | null | undefined,
  h: Partial<HuecosRecepcion>,
): string | null {
  const plantilla = plantillaPara(objeto);
  if (!plantilla) return null;

  // El área se acompaña del proyecto de inversión y su CUI cuando los hay, igual
  // que en la forma de pago: dice a qué inversión pertenece quien firma. El
  // hueco sigue siendo el ÁREA —sin ella, el corchete del formato tiene que
  // verse, no una inversión sin nadie que la conforme—.
  const area = hueco(
    componerAreaConformidad({ area: h.areaConformidad, cui: h.cui, proyectoInversion: h.proyectoInversion }),
    "CONSIGNAR EL ÁREA O UNIDAD ORGÁNICA QUE OTORGA LA CONFORMIDAD",
  );

  if (plantilla === "bienes") {
    return [
      "RECEPCIÓN Y CONFORMIDAD DE LA PRESTACIÓN",
      "",
      "La recepción y conformidad de la prestación se regula por lo dispuesto en el artículo 144 del " +
        "Reglamento de la Ley N° 32069, Ley General de Contrataciones Públicas. La recepción será otorgada por " +
        `${hueco(h.areaRecepcion ?? "", "CONSIGNAR EL ÁREA O UNIDAD ORGÁNICA DE ALMACÉN O LA QUE HAGA SUS VECES")} ` +
        `y la conformidad será otorgada por ${area} en el plazo máximo de ` +
        `${hueco(h.plazoConformidad ?? "", "CONSIGNAR PLAZO MÁXIMO DE SIETE (7) DÍAS O DE VEINTE (20) DÍAS, ESTO ÚLTIMO EN CASO SE REQUIERA EFECTUAR PRUEBAS QUE PERMITAN VERIFICAR EL CUMPLIMIENTO DE LA OBLIGACIÓN")} ` +
        "días computados desde el día siguiente de producida la recepción.",
      "",
      "De existir observaciones, LA ENTIDAD CONTRATANTE las comunica al CONTRATISTA, indicando claramente el " +
        "sentido de estas, otorgándole un plazo para subsanar el cual no debe ser mayor al 30% del plazo del " +
        `entregable correspondiente, dependiendo de la complejidad o sofisticación de las subsanaciones a realizar. ${OBSERVACIONES_COMUN}`,
      "",
      noEjecutada("bienes"),
    ].join("\n");
  }

  return [
    "CONFORMIDAD DE LA PRESTACIÓN",
    "",
    "La conformidad de la prestación se regula por lo dispuesto en el artículo 144 del Reglamento de la Ley " +
      "32069, Ley General de Contrataciones Públicas, aprobado mediante Decreto Supremo N° 009-2025-EF. La " +
      `conformidad es otorgada por ${area} en el plazo máximo de ` +
      `${hueco(h.plazoConformidad ?? "", "CONSIGNAR SIETE (7) DÍAS O MÁXIMO VEINTE (20) DÍAS, EN CASO SE REQUIERA EFECTUAR PRUEBAS QUE PERMITAN VERIFICAR EL CUMPLIMIENTO DE LA OBLIGACIÓN")} ` +
      "días computados desde el día siguiente de producida la recepción.",
    "",
    "De existir observaciones, LA ENTIDAD CONTRATANTE las comunica al CONTRATISTA, indicando claramente el " +
      "sentido de estas, otorgándole un plazo para subsanar, " +
      `${hueco(h.plazoSubsanacion ?? "", "CONSIGNAR EL PLAZO EL CUAL NO DEBE SER MAYOR AL 30% DEL PLAZO DEL ENTREGABLE CORRESPONDIENTE, DEPENDIENDO DE LA COMPLEJIDAD O SOFISTICACIÓN DE LAS SUBSANACIONES A REALIZAR")}. ` +
      OBSERVACIONES_COMUN,
    "",
    noEjecutada("servicios"),
  ].join("\n");
}
