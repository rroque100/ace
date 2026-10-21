/**
 * Redacta el detalle de «Experiencia del postor en la especialidad» (Art. 72.3.c).
 *
 * El formato de las bases estándar fija el texto entero y deja UN hueco: el
 * monto facturado acumulado que se exige. Se compone en vez de generarse, por el
 * mismo motivo que la forma de pago o la recepción: es texto reglamentario con
 * un solo dato variable, y parafrasearlo en un documento que se firma sería un
 * defecto. El monto sí se registra —es un número con decimales— y de él sale
 * tanto la cifra como su versión en letras, en la moneda de la convocatoria.
 *
 * El formato pone además un tope: ese monto no puede superar TRES VECES la
 * cuantía de la contratación o del ítem. Eso NO se comprueba aquí —lo avisa
 * `avisosDeTopes` (lib/requisitos-topes.ts), que ya lee la cuantía— para no
 * partir en dos la misma regla.
 */

import { nombreMoneda, numeroALetras } from "./numero-a-letras";
import { importesDelTexto } from "./requisitos-topes";

/** El corchete del formato, cuando aún no se ha registrado el monto. */
export const HUECO_MONTO_EXPERIENCIA =
  "CONSIGNAR EL MONTO DE FACTURACIÓN EXPRESADO EN NÚMEROS Y LETRAS EN LA MONEDA DE LA " +
  "CONVOCATORIA, MONTO QUE NO PODRÁ SER MAYOR A TRES VECES LA CUANTÍA DE LA CONTRATACIÓN O DEL ÍTEM";

/** El corchete de la segunda frase: qué se considera similar al objeto. */
export const HUECO_SIMILARES = "CONSIGNAR LOS SERVICIOS SIMILARES AL OBJETO CONVOCADO";

/** El corchete del monto MYPE, cuando no se conoce la cuantía para calcular el 25%. */
export const HUECO_MONTO_MYPE =
  "CONSIGNAR EL MONTO DE FACTURACIÓN EXPRESADO EN NÚMEROS Y LETRAS EN LA MONEDA DE LA " +
  "CONVOCATORIA, MONTO QUE NO DEBE SUPERAR EL 25% DE LA CUANTÍA DE LA CONTRATACIÓN DEL ÍTEM";

/**
 * Cómo se acredita la experiencia del postor, texto literal de las bases estándar.
 *
 * Es fijo: no depende de nada que el área usuaria escriba, así que se pone entero
 * y no se deja a su criterio. Va en el campo «¿Con qué se acredita?».
 *
 * El último párrafo va en NEGRITA en el formato; se marca con `**…**`, la misma
 * convención que el Word entiende (lib/requerimiento-docx.ts). Los números de
 * nota al pie del original (15, 16, 17) NO se copian: remiten a notas que este
 * documento no lleva, y sueltos en el texto serían ruido.
 */
export const ACREDITACION_EXPERIENCIA = [
  "La experiencia del postor en la especialidad se acredita con un máximo de veinte (20) contrataciones, mediante copia simple de: (i) contratos u órdenes de servicios, y su respectiva conformidad o constancia de prestación; o (ii) comprobantes de pago cuya cancelación se acredite documental o fehacientemente, con constancia de depósito, reporte de estado de cuenta, cualquier otro documento emitido por entidad del sistema financiero que acredite el abono o mediante cancelación en el mismo comprobante de pago, o comprobante de retención electrónico emitido por SUNAT por la retención del IGV. En caso el postor sustente su experiencia en la especialidad mediante contrataciones realizadas con privados, para acreditarla debe presentar de forma obligatoria lo indicado en el numeral (ii) del presente párrafo; no es posible que acredite su experiencia únicamente con la presentación de contratos u órdenes de servicio con conformidad o constancia de prestación.",
  "En caso los postores presenten varios comprobantes de pago para acreditar una sola contratación, se debe acreditar que corresponden a dicha contratación; de lo contrario, se asumirá que los comprobantes acreditan contrataciones independientes, en cuyo caso solo se considerará, para la evaluación, las veinte (20) primeras contrataciones indicadas en el Anexo N° 11 referido a la Experiencia del Postor en la Especialidad.",
  "En el caso de servicios de ejecución periódica o continuada, solo se considera como experiencia la parte del contrato que haya sido ejecutada durante los quince años anteriores a la fecha de presentación de ofertas, debiendo adjuntarse copia de las conformidades correspondientes a tal parte o los respectivos comprobantes de pago cancelados.",
  "Si el titular de la experiencia no es el postor, consignar si dicha experiencia corresponde a la matriz en caso de que el postor sea sucursal, o fue transmitida por reorganización societaria, debiendo acompañar la documentación sustentatoria correspondiente.",
  "Si el postor acredita experiencia de otra persona jurídica como consecuencia de una reorganización societaria, debe presentar adicionalmente el Anexo N° 14.",
  "Las personas jurídicas resultantes de un proceso de reorganización societaria no pueden acreditar como experiencia del postor en la especialidad aquella que le hubieran transmitido como parte de dicha reorganización las personas jurídicas sancionadas con inhabilitación vigente o definitiva.",
  "Cuando en los contratos, órdenes de servicios o comprobantes de pago el monto facturado se encuentre expresado en moneda extranjera, debe indicarse el tipo de cambio venta publicado por la Superintendencia de Banca, Seguros y AFP correspondiente a la fecha de suscripción del contrato, de emisión de la orden de servicio o de cancelación del comprobante de pago, según corresponda.",
  "**Sin perjuicio de lo anterior, los postores deben llenar y presentar el Anexo N° 11 referido a la Experiencia del Postor en la Especialidad.**",
].join("\n\n");

/** Símbolo con el que se escribe la cifra: «S/» o «US$». */
function simboloMoneda(moneda?: string | null): string {
  return nombreMoneda(moneda) === "DÓLARES AMERICANOS" ? "US$" : "S/";
}

/**
 * El objeto en la frase «por la contratación de ___ iguales o similares».
 *
 * En bienes y servicios es directo. En obras y consultoría de obras la
 * experiencia se mide por especialidad y subespecialidad (Art. 157) y el texto
 * base difiere; se deja «obras»/«consultoría de obras» para no inventar la
 * redacción de un formato que ese objeto no usa igual.
 */
export function objetoConvocatoria(objeto?: string | null): string {
  switch ((objeto ?? "").toLowerCase()) {
    case "bienes":
      return "bienes";
    case "obras":
      return "obras";
    case "consultoria_obra":
    case "consultoria_obras":
      return "consultoría de obras";
    default:
      return "servicios";
  }
}

/**
 * La cifra con su versión en letras: «S/ 180,000.00 (CIENTO OCHENTA MIL CON
 * 00/100 SOLES)».
 *
 * Sin monto —o con uno que no es un número positivo— conserva el corchete del
 * formato: en un documento que se firma, lo que falta tiene que verse.
 */
export function importeConLetras(monto: string | number | null | undefined, moneda?: string | null): string {
  // Se conserva un signo «-» inicial: sin él, «-5» se limpiaría a «5» y un
  // monto negativo pasaría por positivo en vez de caer en el corchete.
  const bruto = typeof monto === "number" ? monto : Number.parseFloat(String(monto ?? "").replace(/(?!^-)[^0-9.,]/g, "").replace(/,/g, "."));
  if (!Number.isFinite(bruto) || bruto <= 0) return `[${HUECO_MONTO_EXPERIENCIA}]`;
  const enNumeros = `${simboloMoneda(moneda)} ${bruto.toLocaleString("es-PE", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
  return `${enNumeros} (${numeroALetras(bruto.toFixed(2), moneda)})`;
}

/**
 * Un monto en números y letras, o el corchete indicado si no hay importe válido.
 * La experiencia MYPE tiene su propio hueco (25% de la cuantía del ítem).
 */
function montoConHueco(
  monto: string | number | null | undefined,
  moneda: string | null | undefined,
  hueco: string,
): string {
  const bruto =
    typeof monto === "number"
      ? monto
      : Number.parseFloat(String(monto ?? "").replace(/(?!^-)[^0-9.,]/g, "").replace(/,/g, "."));
  if (!Number.isFinite(bruto) || bruto <= 0) return `[${hueco}]`;
  return importeConLetras(bruto, moneda);
}

/**
 * Cláusula de la MICRO Y PEQUEÑA EMPRESA (MYPE) del requisito de experiencia.
 *
 * El formato reduce la experiencia exigible a las MYPE: hasta el 25% de la
 * cuantía del ítem y con ventana de DIEZ años. `monto` es ese importe (el 25%):
 * en el requisito único lo registra el área usuaria; en el modo por ítems se
 * calcula sobre la cuantía de cada ítem. Aplica a bienes y servicios; en obras y
 * consultoría de obras la experiencia se mide por especialidad (Art. 157).
 */
export function clausulaMype(args: {
  monto?: string | number | null;
  moneda?: string | null;
  objeto?: string | null;
}): string {
  const palabra = objetoConvocatoria(args.objeto);
  // El formato de bienes dice «venta de bienes»; para el resto se usa el verbo
  // neutro del propio requisito («contratación de …»), que es gramatical.
  const frase = palabra === "bienes" ? "venta de bienes" : `contratación de ${palabra}`;
  return (
    `En el caso de postores que declaren en el Anexo N° 1 tener la condición de micro y pequeña empresa, ` +
    `se acredita una experiencia de ${montoConHueco(args.monto, args.moneda, HUECO_MONTO_MYPE)}, por la ${frase} ` +
    `iguales o similares al objeto de la convocatoria, durante los diez años anteriores a la fecha de la ` +
    `presentación de ofertas, que se computarán desde la fecha de la conformidad o emisión del comprobante ` +
    `de pago, según corresponda. En el caso de consorcios, todos los integrantes deben contar con la ` +
    `condición de micro y pequeña empresa.`
  );
}

/** Objetos a los que aplica la cláusula MYPE del requisito de experiencia. */
function aplicaMype(objeto?: string | null): boolean {
  const palabra = objetoConvocatoria(objeto);
  return palabra === "bienes" || palabra === "servicios";
}

/**
 * La primera frase del requisito, según el objeto.
 *
 * En BIENES el formato usa «venta de bienes» y ventana de DIEZ años; el resto
 * conserva «contratación de …» y los quince años del régimen general (mismo tope
 * que vigila `avisosDeTopes`).
 */
function requisitoGeneral(args: {
  monto?: string | number | null;
  moneda?: string | null;
  objeto?: string | null;
}): string {
  const palabra = objetoConvocatoria(args.objeto);
  const importe = importeConLetras(args.monto, args.moneda);
  if (palabra === "bienes") {
    return (
      `El postor debe acreditar un monto facturado acumulado equivalente a ${importe}, ` +
      `por la venta de bienes iguales o similares al objeto de la convocatoria, durante los diez años ` +
      `anteriores a la fecha de la presentación de ofertas, que se computan desde la fecha de la ` +
      `conformidad o emisión del comprobante de pago, según corresponda.`
    );
  }
  return (
    `El postor debe acreditar un monto facturado acumulado equivalente a ${importe}, ` +
    `por la contratación de ${palabra} iguales o similares al objeto de la convocatoria, ` +
    "durante los quince (15) años anteriores a la fecha de la presentación de ofertas que se computa desde la fecha " +
    `de la conformidad o emisión del comprobante de pago, según corresponda.`
  );
}

/**
 * El texto completo del requisito, en párrafos: requisito general, cláusula MYPE
 * (bienes y servicios) y frase de similares —esta al final, para no romper su
 * relectura—. `montoMype` es el importe de la experiencia MYPE (el 25%).
 */
export function componerExperienciaPostor(args: {
  monto?: string | number | null;
  /** Monto de la experiencia MYPE (el 25% de la cuantía del ítem). */
  montoMype?: string | number | null;
  moneda?: string | null;
  objeto?: string | null;
  /** Qué se considera similar al objeto convocado. Vacío conserva el corchete. */
  similares?: string | null;
}): string {
  const palabra = objetoConvocatoria(args.objeto);
  const similar = (args.similares ?? "").trim();
  const segunda = `Se consideran ${palabra} similares a los siguientes: ${similar || `[${HUECO_SIMILARES}]`}.`;

  const partes = [requisitoGeneral(args)];
  if (aplicaMype(args.objeto)) {
    partes.push(clausulaMype({ monto: args.montoMype, moneda: args.moneda, objeto: args.objeto }));
  }
  partes.push(segunda);
  return partes.join("\n\n");
}

/**
 * El requisito de experiencia rotulado POR ÍTEM (procedimientos por relación de
 * ítems, Art. 53).
 *
 * Un bloque por ítem, cada uno con la cláusula MYPE calculada sobre el 25% de la
 * CUANTÍA DE ESE ÍTEM. El monto de la experiencia general queda en corchete: es
 * el exigido —hasta 3× la cuantía del ítem— que el área usuaria fija por ítem.
 * Sin ítems devuelve cadena vacía.
 */
export function componerExperienciaPorItems(
  items: ReadonlyArray<{ nro: number; cuantia?: number | null }>,
  args: { moneda?: string | null; objeto?: string | null; similares?: string | null },
): string {
  return items
    .map((it) => {
      const cuerpo = componerExperienciaPostor({
        moneda: args.moneda,
        objeto: args.objeto,
        similares: args.similares,
        montoMype:
          typeof it.cuantia === "number" && Number.isFinite(it.cuantia) ? it.cuantia * 0.25 : null,
      });
      return `Ítem N° ${it.nro}: ${cuerpo}`;
    })
    .join("\n\n");
}

/**
 * Rescata lo que se consideró similar, de un detalle ya redactado.
 *
 * Como el monto, no tiene columna: se relee del propio texto. El corchete sin
 * rellenar no es un valor, así que devuelve vacío.
 */
export function similaresDeExperiencia(detalle: string | null | undefined): string {
  const m = (detalle ?? "").match(/similares a los siguientes:\s*([\s\S]*)$/i);
  if (!m) return "";
  const v = m[1].trim().replace(/\.\s*$/, "").trim();
  return v.startsWith("[") ? "" : v;
}

/** Primer importe que aparece tras `ancla` (y antes de `hasta`, si se indica). */
function importeTras(detalle: string, ancla: string, hasta?: string): string {
  const i = detalle.indexOf(ancla);
  if (i < 0) return "";
  let trozo = detalle.slice(i + ancla.length);
  if (hasta) {
    const j = trozo.indexOf(hasta);
    if (j >= 0) trozo = trozo.slice(0, j);
  }
  const [primero] = importesDelTexto(trozo);
  return primero ? String(primero) : "";
}

/**
 * Rescata el monto EXIGIDO (experiencia general) de un detalle ya redactado, para
 * volver a mostrarlo al reabrir la ficha. Se ancla en «equivalente a» y se corta
 * antes de la cláusula MYPE, para no confundirlo con el 25%. No hay columna
 * aparte: el detalle es la fuente de verdad.
 */
export function montoDeExperiencia(detalle: string | null | undefined): string {
  return importeTras(detalle ?? "", "equivalente a", "micro y pequeña empresa");
}

/** Rescata el monto de la experiencia MYPE (el 25%), anclado en su frase propia. */
export function montoMypeDeExperiencia(detalle: string | null | undefined): string {
  return importeTras(detalle ?? "", "se acredita una experiencia de");
}
