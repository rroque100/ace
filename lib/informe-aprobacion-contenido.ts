// Contenido del informe de aprobación del expediente, en bloques.
//
// ── Por qué existe una capa intermedia ────────────────────────────────────────
//
// El informe se ve en dos sitios: la vista previa (HTML, antes de descargar) y
// el .docx. Si cada uno compusiera el texto por su cuenta, acabarían diciendo
// cosas distintas —alguien corrige un párrafo en uno y se olvida del otro— y la
// vista previa dejaría de servir para lo único que sirve: comprobar qué se va a
// firmar ANTES de generarlo.
//
// Así que el documento se describe UNA vez como una lista de bloques. El .docx
// los pinta con `docx`, la vista previa con HTML, y ninguno de los dos decide
// qué dice el informe.

import type { DatosInformeAprobacion } from "./informe-aprobacion-expediente";

/**
 * Un fragmento de texto con su énfasis.
 *
 * Las citas legales van en CURSIVA —son transcripción de la norma, no redacción
 * propia— y las etiquetas de la cabecera en negrita. Distinguirlo importa: en un
 * documento que se firma, quien lo lee tiene que ver de un vistazo qué es cita y
 * qué es afirmación de la entidad.
 */
export type Fragmento = { texto: string; negrita?: boolean; cursiva?: boolean };

export type Bloque =
  | { tipo: "titulo"; texto: string }
  | { tipo: "subtitulo"; texto: string }
  /** Línea de la cabecera: etiqueta, nombre y, debajo, el cargo. */
  | { tipo: "cabecera"; etiqueta: string; nombre: string; cargo: string }
  | { tipo: "parrafo"; fragmentos: Fragmento[] }
  | { tipo: "vinetas"; items: string[] }
  | { tipo: "tabla"; filas: Array<{ etiqueta: string; valor: string }> }
  /** Regla horizontal a todo el ancho del área de escritura. */
  | { tipo: "linea" }
  | { tipo: "espacio" }
  /**
   * Trazabilidad de quién generó el documento en el sistema —no una firma—:
   * va en el pie de página, no en el cuerpo que se imprime. Es un bloque
   * aparte (no "parrafo") para que quien arma el .docx sepa desviarlo al
   * `Footer` en vez de meterlo entre los párrafos del cuerpo.
   */
  | { tipo: "pie"; fragmentos: Fragmento[] };

const VACIO = "—";

/** Cita literal de la norma: cursiva, sin comillas (el modelo no las lleva). */
function cita(texto: string): Bloque {
  return { fragmentos: [{ cursiva: true, texto }], tipo: "parrafo" };
}

/** Texto propio de la entidad. */
function propio(texto: string): Bloque {
  return { fragmentos: [{ texto }], tipo: "parrafo" };
}

/** Encabezado de cita: la parte introductoria en redonda y la norma en cursiva. */
function introYCita(intro: string, textoCita: string): Bloque {
  return { fragmentos: [{ texto: intro }, { cursiva: true, texto: textoCita }], tipo: "parrafo" };
}

/**
 * Los siete literales del Art. 54.2, textuales.
 *
 * Verificados contra el Reglamento publicado. No reescribir: son el contenido
 * que la norma exige que tenga el expediente, y el informe los transcribe.
 */
const LITERALES_54_2 = [
  "El requerimiento final, indicando si se encuentra estandarizado.",
  "El documento que aprueba la compatibilización del requerimiento, cuando corresponda.",
  "La estrategia de contratación, que incluye la interacción con el mercado realizada, según corresponda.",
  "La cuantía de la contratación.",
  "El documento mediante el cual se han designado a los evaluadores.",
  "La certificación de crédito presupuestario y/o la previsión presupuestal, de acuerdo con la normativa vigente.",
  "Otra documentación necesaria conforme a la normativa que regula el objeto de la contratación.",
];

export function contenidoInformeAprobacion(d: DatosInformeAprobacion): Bloque[] {
  const bloques: Bloque[] = [
    { texto: d.numeroInforme || "INFORME N° ______", tipo: "titulo" },
    { cargo: d.destinatario.cargo, etiqueta: "A", nombre: d.destinatario.nombre, tipo: "cabecera" },
  ];

  if (d.copia) {
    bloques.push({
      cargo: d.copia.cargo,
      etiqueta: "ATENCION",
      nombre: d.copia.nombre,
      tipo: "cabecera",
    });
  }

  bloques.push(
    { cargo: d.emisor.cargo, etiqueta: "DE", nombre: d.emisor.nombre, tipo: "cabecera" },
    {
      fragmentos: [
        { negrita: true, texto: "Asunto: " },
        { negrita: true, texto: "SOLICITO APROBACION DE EXPEDIENTE DE CONTRATACIÓN" },
      ],
      tipo: "parrafo",
    },
    {
      fragmentos: [
        { negrita: true, texto: "REFERENCIA: " },
        { texto: d.referencia || VACIO },
      ],
      tipo: "parrafo",
    },
    {
      fragmentos: [
        { negrita: true, texto: "Fecha: " },
        { texto: [d.lugar, d.fecha].filter(Boolean).join(", ") || VACIO },
      ],
      tipo: "parrafo",
    },
    // Regla que cierra la cabecera y la separa del cuerpo, como en el membrete.
    { tipo: "linea" },
    { tipo: "espacio" },

    propio(
      "Me dirijo a usted, para informarle sobre el procedimiento de selección en referencia y de " +
        "acuerdo a lo dispuesto en el Artículo 51° de la Ley de Contratación Pública y el Artículo 54º " +
        "y el numeral 63.1 del Artículo 63 del Reglamento de la Ley de Contratación Pública Ley N° " +
        "32069, aprobado mediante el DECRETO SUPREMO Nº 009-2025-EF, lo siguiente:",
    ),
    introYCita(
      "De conformidad con el Artículo 51 de la Ley de Contratación Pública Ley N° 32069, señala: ",
      "El expediente de contratación contiene la información que respalda las actuaciones realizadas " +
        "desde la formulación del requerimiento del área usuaria (…)",
    ),
    introYCita(
      "De mismo modo, el Artículo 54° del Reglamento de la Ley N° 32069, señala: ",
      "Expediente de contratación.",
    ),
    cita(
      "54.1. El expediente de contratación incluye toda la información correspondiente al proceso de " +
        "contratación, privilegiándose el uso de medios electrónicos para su custodia y resguardo. La " +
        "DEC es responsable de que toda la información se encuentre en el expediente de contratación, " +
        "así como de su disponibilidad para aquellos que lo requieran.",
    ),
    cita(
      "54.2. La autoridad de la gestión administrativa, previo a la fase de selección, aprueba el " +
        "expediente de contratación, el cual contiene:",
    ),
    { items: LITERALES_54_2, tipo: "vinetas" },
    // Sin "(…)": el 54.3 es una sola frase completa.
    cita(
      "54.3. Para aprobar un expediente de contratación la necesidad debe encontrarse prevista en el " +
        "CMN aprobado del año fiscal correspondiente o su modificatoria.",
    ),
  );

  // El apoyo del cierre depende del procedimiento: el Art. 63 habla de CONVOCAR
  // y en los no competitivos no hay convocatoria (Art. 101.2).
  bloques.push(
    d.esNoCompetitivo
      ? introYCita(
          "Tratándose de un procedimiento de selección no competitivo, el numeral 101.2 del " +
            "Artículo 101° del Reglamento señala: ",
          "la fase de selección comienza luego de la aprobación del expediente de contratación y " +
            "consiste únicamente en la invitación al proveedor identificado. En estos procedimientos " +
            "no se designan evaluadores ni hay evaluación técnica ni económica de ofertas.",
        )
      : introYCita(
          "Asimismo, del Artículo 63° del Reglamento de la Ley N° 32069, señala: ",
          "Para convocar un procedimiento de selección se debe contar con el expediente de " +
            "contratación aprobado y las bases del procedimiento de selección elaboradas por los " +
            "evaluadores o la DEC, según corresponda.",
        ),
  );

  if (d.noCompetitivo) {
    bloques.push(
      propio(
        `Se deja constancia de que la aprobación del expediente es distinta de la aprobación del ` +
          `procedimiento de selección no competitivo, la cual se otorga por resolución conforme al ` +
          `${d.noCompetitivo.articuloAprobador} del Reglamento —corresponde al ` +
          `${d.noCompetitivo.aprobador}— y requiere obligatoriamente los informes técnico y legal ` +
          `respecto de la necesidad de la contratación y la procedencia del supuesto invocado ` +
          `(Art. 102.3). Causal invocada: ${d.noCompetitivo.causal || "por precisar"}.`,
      ),
    );
  }

  if (d.vieneDeDesierto) {
    bloques.push(
      propio(
        "El numeral 54.4 del Artículo 54° establece que, declarado desierto un procedimiento de " +
          "selección, la siguiente convocatoria no requiere una nueva aprobación del expediente de " +
          "contratación, salvo que el informe de evaluación de las razones que motivaron la " +
          "declaratoria advierta que se requiere modificar alguno de los documentos que motivó su " +
          "aprobación. La presente solicitud se formula por concurrir dicho supuesto.",
      ),
    );
  }

  // Art. 25.2 Ley: cuando la facultad de aprobar se ejerce por delegación, se deja
  // constancia de la resolución que la habilita, para la trazabilidad de la firma.
  if (d.delegacion) {
    const res = d.delegacion.resolucion.trim() ? `Resolución N° ${d.delegacion.resolucion.trim()}` : "resolución";
    const fecha = d.delegacion.fecha.trim() ? ` de fecha ${d.delegacion.fecha.trim()}` : "";
    bloques.push(
      propio(
        `Se deja constancia de que la facultad de aprobar el expediente de contratación se ejerce por ` +
          `delegación, mediante ${res}${fecha}, conforme al numeral 25.2 del Artículo 25° de la Ley N° 32069.`,
      ),
    );
  }

  bloques.push(
    propio(
      "Como se puede verificar la normativa de contratación pública, indica; que el expediente " +
        "contratación son las actuaciones realizadas desde la formulación del requerimiento del área " +
        "usuaria, que su aprobación es un requisito para convocar un procedimiento de selección, que " +
        "debe contar con el expediente de contratación aprobado. El expediente de contratación incluye " +
        "toda la información correspondiente al proceso de contratación, privilegiándose el uso de " +
        "medios electrónicos para su custodia y resguardo. La DEC es responsable de que toda la " +
        "información se encuentre en el expediente de contratación, así como de su disponibilidad para " +
        "aquellos que lo requieran.",
    ),
    {
      fragmentos: [
        {
          texto:
            "Por lo tanto, solicito la aprobación del expediente de contratación del procedimiento " +
            "de selección, según detalle:",
          negrita: true,
        },
      ],
      tipo: "parrafo",
    },
    { tipo: "espacio" },
    {
      filas: [
        { etiqueta: "OBJETO DE LA CONVOCATORIA", valor: d.objeto },
        { etiqueta: "AREA USUARIA", valor: d.areaUsuaria },
        { etiqueta: "REQUERIMIENTO ESTANDARIZADO", valor: d.requerimientoEstandarizado },
        // Literal b): "cuando corresponda", así que vacío se omite.
        ...(d.compatibilizacion.trim()
          ? [{ etiqueta: "COMPATIBILIZACIÓN DEL REQUERIMIENTO", valor: d.compatibilizacion }]
          : []),
        { etiqueta: "VALOR DE LA CUANTIA", valor: d.valorCuantia },
        { etiqueta: "CERTIFICACION CREDITO PRESUPUESTARIO", valor: d.certificacionCredito },
        // En los no competitivos no se designan evaluadores (Art. 101.2).
        ...(d.esNoCompetitivo
          ? []
          : [{ etiqueta: "DESIGNACIÓN DE EVALUADORES", valor: d.designacionEvaluadores }]),
        { etiqueta: "TIPO DEL PROCEDIMIENTO DE SELECCIÓN", valor: d.tipoProcedimiento },
        { etiqueta: "INCLUIDA EN EL CMN", valor: d.cmn },
        { etiqueta: "N° DE PAC", valor: d.numeroPac },
        { etiqueta: "MODALIDAD DE PAGO", valor: d.modalidadPago },
      ].map((f) => ({ etiqueta: f.etiqueta, valor: f.valor.trim() || VACIO })),
      tipo: "tabla",
    },
    { tipo: "espacio" },
    propio(
      "Es cuanto puedo informar a Ud., para su conocimiento y fines del caso sin otro particular me " +
        "suscribo de Ud.",
    ),
    { tipo: "espacio" },
    propio("Atentamente,"),
  );

  if (d.elaboradoPor) {
    bloques.push({ fragmentos: [{ texto: `Elaborado por: ${d.elaboradoPor}` }], tipo: "pie" });
  }

  return bloques;
}
