/**
 * Redacta el apartado FORMA DE PAGO a partir de lo que registra el área usuaria.
 *
 * El texto NO es libre: lo fija el Art. 67 de la Ley y el formato del OECE, y
 * solo tiene cinco huecos. Por eso se compone con una plantilla y no se le pide
 * a un modelo de lenguaje: parafrasear un artículo de la Ley en un documento que
 * se firma es un defecto, no una ayuda. Igual que con los apartados del modelo,
 * lo que tiene una respuesta exacta se calcula, no se genera.
 *
 * Este apartado no está en los PDF-modelo cargados; lo pide la entidad.
 */

/** Los cinco huecos del formato, en el orden en que aparecen en el texto. */
export type HuecosFormaPago = {
  /** Área que otorga la conformidad de la prestación. */
  areaConformidad: string;
  /** Dirección exacta de la dependencia donde se presenta la documentación. */
  direccion: string;
  /** Otra documentación exigible para el pago, además de los dos fijos. */
  documentacionAdicional: string;
  /** Dependencia donde se presenta: mesa de partes u otra. */
  lugarPresentacion: string;
  /** Pago único o pagos a cuenta. Se elige de una lista de dos. */
  tipoPago: string;
  /**
   * El detalle de los pagos a cuenta, que el formato pide en el mismo hueco.
   *
   * Va aparte porque el tipo se ELIGE y el detalle se ESCRIBE. Solo entra en el
   * texto cuando el pago es a cuenta: en un pago único no hay nada que detallar.
   */
  detallePagosACuenta: string;
  /**
   * Nombre del proyecto de inversión, de «b) Inversión a la que se imputa».
   *
   * No es un hueco del formato: acompaña al área en el texto cuando la
   * contratación se imputa a una inversión, y se trae de donde ya está.
   */
  proyectoInversion: string;
  /** Código Único de Inversión, del mismo subgrupo. Tampoco es un hueco. */
  cui: string;
};

/** De dónde sale el área que otorga la conformidad, ya registrado en la ficha. */
export type DatosAreaConformidad = {
  /** «Área que otorga la conformidad», el único sitio donde se pide. */
  area: string;
  /** Código Único de Inversión, de «b) Inversión a la que se imputa». */
  cui: string;
  /** Nombre del proyecto de inversión, del mismo subgrupo. */
  proyectoInversion: string;
};

/**
 * El área que otorga la conformidad, con la inversión a la que pertenece.
 *
 * Va ENTERO y no solo el nombre del área: la misma sub gerencia otorga
 * conformidades de varios proyectos a la vez, y quien paga necesita saber
 * contra cuál se firma esta. El proyecto y su CUI ya están registrados en «b)
 * Inversión a la que se imputa», así que se traen de ahí.
 *
 * Se compone AQUÍ, al redactar el apartado, y no en el propio campo de la
 * ficha: ese campo es de donde sale el área, y escribir en él el resultado de
 * leerlo sería morderse la cola.
 *
 * Sin área no se compone nada: el hueco del formato tiene que seguir viéndose
 * como lo que es. El proyecto y el CUI se añaden por separado —una ficha puede
 * tener el nombre del proyecto y aún no el código, o al revés—.
 */
export function componerAreaConformidad(d: Partial<DatosAreaConformidad>): string {
  const area = (d.area ?? "").trim();
  if (!area) return "";
  // Si en el área ya está escrita la inversión, no se vuelve a añadir.
  //
  // Pasó de verdad: alguien tecleó «SUB GERENCIA …, para el proyecto de
  // inversión "CREACION DEL SERVICIO …"» y el apartado salió nombrando el
  // proyecto DOS veces seguidas, una con las palabras del usuario y otra con
  // las de aquí. Se mira si lo MENCIONA, no si lo contiene entero: el campo
  // tiene tope y el nombre que se tecleó puede estar cortado.
  const yaDicho = area.toLowerCase();
  const partes = [area];
  const proyecto = (d.proyectoInversion ?? "").trim();
  if (proyecto && !yaDicho.includes("proyecto de inversión")) {
    partes.push(`del proyecto de inversión «${proyecto}»`);
  }
  const cui = (d.cui ?? "").trim();
  if (cui && !yaDicho.includes("cui")) partes.push(`con CUI ${cui}`);
  return partes.join(", ");
}

/**
 * Lo que se deja escrito cuando un hueco sigue vacío.
 *
 * Se conserva el corchete del formato original a propósito: el requerimiento se
 * firma, y un hueco sin rellenar tiene que verse como lo que es —algo que falta—
 * y no disolverse en una frase que parece completa.
 */
function hueco(valor: string, textoOriginal: string): string {
  const v = valor.trim();
  return v || `[${textoOriginal}]`;
}

/** El texto de los corchetes del formato, tal como los publica la base estándar. */
const HUECO_TIPO_PAGO =
  "CONSIGNAR SI SE TRATA DE PAGO ÚNICO O PAGOS A CUENTA, ASÍ COMO EL DETALLE QUE CORRESPONDE EN EL CASO DE PAGO A CUENTA";
const HUECO_DETALLE = "CONSIGNAR EL DETALLE QUE CORRESPONDE EN EL CASO DE PAGO A CUENTA";
const HUECO_LUGAR =
  "CONSIGNAR MESA DE PARTES O LA DEPENDENCIA ESPECÍFICA DE LA ENTIDAD CONTRATANTE DONDE SE DEBE PRESENTAR LA DOCUMENTACIÓN";

/** ¿Es este un pago a cuenta? Es lo único que hace falta el detalle. */
function esPagoACuenta(tipoPago: string | undefined): boolean {
  return (tipoPago ?? "").trim().toLowerCase().includes("a cuenta");
}

/**
 * Cómo termina la frase «…a favor del contratista en ___.».
 *
 * El formato mete dos cosas en un solo corchete: el TIPO de pago y, si es a
 * cuenta, su detalle. En la ficha están separados —el tipo se elige de una lista
 * de dos y el detalle se escribe—, así que aquí se vuelven a juntar.
 *
 * Un pago a cuenta sin detalle conserva su corchete: es lo que el formato exige
 * y lo que falta tiene que verse. Un pago único no lleva detalle aunque haya
 * algo escrito, porque no hay pagos que detallar.
 */
function frasePago(h: Partial<HuecosFormaPago>): string {
  const tipo = (h.tipoPago ?? "").trim();
  if (!tipo) return `[${HUECO_TIPO_PAGO}]`;
  if (!esPagoACuenta(tipo)) return tipo;
  const detalle = (h.detallePagosACuenta ?? "").trim();
  return `${tipo}, según el siguiente detalle: ${detalle || `[${HUECO_DETALLE}]`}`;
}

/**
 * ¿Queda algún hueco sin rellenar? Para avisar antes de firmar.
 *
 * El detalle solo cuenta cuando el pago es a cuenta: en un pago único no es un
 * hueco pendiente, es un campo que no aplica.
 */
export function huecosPendientes(h: Partial<HuecosFormaPago>): number {
  const huecos = [h.tipoPago, h.areaConformidad, h.documentacionAdicional, h.lugarPresentacion, h.direccion];
  if (esPagoACuenta(h.tipoPago)) huecos.push(h.detallePagosACuenta);
  return huecos.filter((v) => !(v ?? "").trim()).length;
}

/**
 * El texto completo del apartado, tal como lo publica la base estándar.
 *
 * El primer párrafo, el del consorcio y los dos documentos fijos son literales
 * de la Ley y del formato: no dependen de nada que el área usuaria escriba, así
 * que no se dejan a su criterio.
 */
export function componerFormaPago(h: Partial<HuecosFormaPago>): string {
  const lugar = (h.lugarPresentacion ?? "").trim();
  const lineas = [
    // Un solo párrafo, como en la base estándar. Estaban partidos en dos y esa
    // no es una decisión de estilo: el formato se coteja contra el publicado.
    "El pago se realiza de conformidad con lo establecido en el artículo 67 de la Ley. " +
      "La entidad contratante paga las contraprestaciones pactadas a favor del contratista dentro de los diez " +
      "días hábiles siguientes de otorgada la conformidad por parte del área usuaria y es prorrogable, previa " +
      "justificación de la demora, por cinco días hábiles.",
    "",
    "En el caso que se haya suscrito contrato con un consorcio, el pago se realiza, a quien corresponda, de acuerdo con lo que se indique en el contrato de consorcio.",
    "",
    `La entidad contratante realiza el pago de la contraprestación pactada a favor del contratista en ${frasePago(h)}.`,
    "",
    "Para efectos del pago de las contraprestaciones ejecutadas por el contratista, la entidad contratante debe contar con la siguiente documentación:",
    // El área se acompaña del proyecto de inversión y su CUI cuando los hay. El
    // hueco sigue siendo el ÁREA: sin ella no hay nada que componer y lo que
    // debe verse es el corchete, no una inversión sin nadie que firme.
    `- Documento en el que conste la conformidad de la prestación efectuada suscrita por el servidor responsable del ${hueco(
      componerAreaConformidad({ area: h.areaConformidad, cui: h.cui, proyectoInversion: h.proyectoInversion }),
      "REGISTRAR LA DENOMINACIÓN DEL ÁREA RESPONSABLE DE OTORGAR LA CONFORMIDAD",
    )}.`,
    "- Comprobante de pago.",
    `- ${hueco(h.documentacionAdicional ?? "", "CONSIGNAR OTRA DOCUMENTACIÓN NECESARIA A SER PRESENTADA PARA EL PAGO ÚNICO O LOS PAGOS A CUENTA, SEGÚN CORRESPONDA")}.`,
    "",
    // La base estándar escribe «…la documentación restante [CONSIGNAR MESA DE
    // PARTES…]», sin la preposición: la espera dentro de lo que se consigne.
    // Vacío se deja igual que el formato; relleno se añade el «en», porque «la
    // documentación restante Mesa de Partes» no es una frase.
    `Salvo los documentos de conformidad, el contratista debe presentar la documentación restante ${
      lugar ? `en ${lugar}` : `[${HUECO_LUGAR}]`
    }, sito en ${hueco(h.direccion ?? "", "CONSIGNAR LA DIRECCIÓN EXACTA")}.`,
  ];
  return lineas.join("\n");
}
