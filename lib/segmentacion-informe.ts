import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  PageNumber,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import {
  CONDICIONES_RIESGO_BS,
  CRITERIOS_OBRA_BASICA,
  clasificarSegmentacion,
  type SegmentacionInput,
} from "./actuaciones-preparatorias";
import {
  calcularParametrosSegmentacion,
  type ParametrosSegmentacion,
} from "./segmentacion-parametros";

// Genera el "Informe de Segmentación para la contratación" en formato Word,
// siguiendo el formato institucional (ANTECEDENTES · ANÁLISIS · CONCLUSIONES).
// La lógica de clasificación es la de la Ley 32069 y su Reglamento (Art. 42,
// 125 para bienes/servicios, 153 para obras). Es un documento de apoyo que
// debe revisarse y firmarse; su resultado se traslada al Anexo N° 2 (A8).

export type SegmentacionInformeInput = {
  entidad: string;
  areaUsuaria: string | null;
  // Descripción del objeto de la contratación (ítem).
  objeto: string;
  // Etiqueta legible del tipo de objeto (Bien, Servicio, Obra, Consultoría de obra).
  tipoObjetoLabel: string;
  valorEstimado: number | null;
  plazoDias: number | null;
  programada: boolean;
  referenciaPac: string | null;
  // Verificación del CMN registrada en A1. En las no programadas el Art. 42.3
  // la exige como precondición de la segmentación, así que el informe declara
  // su estado real en vez de darla por supuesta.
  enCmn?: boolean;
  versionCmn?: string | null;
  // Documento con que el área usuaria solicita la modificación del CMN (A1,
  // Art. 42.3). Precondición de la segmentación en las no programadas; si
  // consta, el informe lo deja dicho.
  documentoModificacionCmn?: string | null;
  documentoRequerimiento: string | null;
  // Insumos capturados en el paso A2 (SegmentacionForm).
  seg: SegmentacionInput;
  // Cronograma de presentación de requerimientos registrado en A2.
  cronograma?: Array<{ area: string; fecha: string }>;
  // Sumandos de la base del 10% capturados en A2 (Guía): las no programadas ya
  // convocadas y las otras que se segmentan en el mismo acto.
  noProgramadasConvocadas?: number | null;
  otrasNoProgramadasASegmentar?: number | null;
  // La propia contratación se registró DENTRO de "otras no programadas a
  // segmentar" (decisión de la entidad): no se suma ni se imprime aparte como
  // "Nueva Contratación", y aquella fila se rotula "(+ Esta contratación)".
  contratacionEnOtras?: boolean;
  // Ciudad de la entidad (Configuración): "Lugar" de la fecha del memorando.
  lugar?: string | null;
  // Campos narrativos capturados en A2. Van firmados, así que no se generan
  // automáticamente: si están vacíos, su bloque se omite.
  narrativa?: {
    // Cabecera (PARA/DE/ATENCIÓN) que A6 hereda para su memorando. El .docx de A2
    // ya NO la imprime; se conservan aquí porque el route los pasa desde A2.
    destinatario?: string | null;
    /** Área usuaria a cuya atención va el memorando (Art. 42.2). */
    atencion?: string | null;
    remitente?: string | null;
    // Sustento de la categoría asignada (columna "Justificación" de la matriz).
    justificacion?: string | null;
    // Sustento adicional del resumen de clasificación.
    continuidad?: string | null;
    // Gestión de riesgos.
    riesgoMercado?: string | null;
    estrategiaMitigacion?: string | null;
    puntoControl?: string | null;
  } | null;
  // PIA y PAC del ejercicio, registrados una vez al año en Configuración.
  // Se citan como antecedentes y dan la base para la línea de corte.
  institucional?: {
    pacAnio: number | null;
    pacMontoBienesServicios: number | null;
    pacMontoObras: number | null;
    pacMontoTotal: number | null;
    pacResolucionFecha: string | null;
    pacResolucionNumero: string | null;
    piaResolucionFecha: string | null;
    piaResolucionNumero: string | null;
  } | null;
  /** Nombre completo del usuario en sesión que generó el informe. */
  elaboradoPor?: string | null;
};

const CELL_MARGIN = { top: 60, bottom: 60, left: 90, right: 90 };

// Tipografía institucional. docx mide en medios puntos (22 = 11pt) y en twips
// para el espaciado (567 twips = 1 cm; line: 276 ≈ interlineado 1.15).
//
// Arial 11 justificado es el estándar de facto de la administración pública
// peruana. Sin esto, Word aplica su plantilla por defecto (Calibri y títulos en
// azul), que desentona en un documento que se imprime y se firma.
const FUENTE = "Arial";
const CUERPO_SIZE = 21; // 10.5pt (medios puntos: 21 = 10.5)
const ESTILOS = {
  default: {
    document: {
      run: { font: FUENTE, size: CUERPO_SIZE },
      paragraph: {
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 120, line: 276 },
      },
    },
    // Título del documento.
    heading1: {
      run: { font: FUENTE, size: 28, bold: true, color: "000000" }, // 14pt
      paragraph: { alignment: AlignmentType.CENTER, spacing: { after: 240 } },
    },
    // Secciones I / II / III.
    heading2: {
      run: { font: FUENTE, size: 24, bold: true, color: "000000" }, // 12pt
      paragraph: { alignment: AlignmentType.LEFT, spacing: { before: 300, after: 140 } },
    },
  },
};

// Márgenes normales: 2.5 cm superior/inferior, 3 cm izquierda/derecha.
const MARGENES = { top: 1418, right: 1701, bottom: 1418, left: 1701 };

// Categorías del numeral 125.1 del Reglamento. Se imprimen como CITA LITERAL
// (cursiva y entrecomilladas), así que deben coincidir palabra por palabra con
// el texto publicado, incluida la coma del literal d) y el singular
// "Estratégico". No reformular.
const CATEGORIAS_ART_125 = [
  "a) Rutinarios: contrataciones de baja cuantía y bajo riesgo.",
  "b) Operacionales: contrataciones de alta cuantía y bajo riesgo.",
  "c) Críticos: contrataciones de baja cuantía y alto riesgo.",
  "d) Estratégico: contrataciones de alta cuantía, y alto riesgo.",
];

// Orientación de la estrategia según el numeral 125.4 del Reglamento.
function estrategiaArt1254(categoria: string): string {
  return categoria === "rutinaria" || categoria === "operacional"
    ? "la atención oportuna y la reducción de costos"
    : "disminuir los riesgos en el proceso de contratación";
}

function money(value: number | null): string {
  if (value == null) return "—";
  return `S/ ${value.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre",
];

// "2025-12-31" → "31 de diciembre de 2025". Se parsea a mano: new Date(iso)
// interpreta la fecha en UTC y en Perú (UTC-5) devolvería el día anterior.
// Si el texto no es ISO se devuelve tal cual (pudo escribirse a mano).
function fechaLarga(value: string | null | undefined): string | null {
  const texto = (value ?? "").trim();
  if (!texto) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (!iso) return texto;
  const mes = Number(iso[2]) - 1;
  if (mes < 0 || mes > 11) return texto;
  return `${Number(iso[3])} de ${MESES[mes]} de ${iso[1]}`;
}

function bullet(text: string) {
  return new Paragraph({ spacing: { after: 90 }, bullet: { level: 0 }, children: [new TextRun(text)] });
}

/**
 * Cita literal de la norma: sangrada, en cursiva y entrecomillada.
 * Es lo que permite al lector distinguir de un vistazo qué dice el Reglamento
 * y qué es criterio de la entidad. Solo debe usarse con texto literal.
 */
function cita(text: string) {
  return new Paragraph({
    spacing: { after: 120 },
    indent: { left: 567 },
    children: [new TextRun({ italics: true, text: `“${text}”` })],
  });
}

// Rótulo de apartado dentro de una sección ("Parámetros de Segmentación").
function subtitulo(text: string) {
  return new Paragraph({
    spacing: { before: 200, after: 80 },
    alignment: AlignmentType.LEFT,
    children: [new TextRun({ bold: true, text })],
  });
}

/**
 * Trozos con formato de un texto libre: **negrita**, *cursiva* y __subrayado__.
 *
 * Los apartados narrativos del informe (justificación, gestión de riesgos, el
 * PARA/DE) los escribe una persona y acaban en un documento que se firma. Antes
 * viajaban como texto plano, así que resaltar una cifra o un nombre no era
 * posible: los asteriscos salían impresos tal cual.
 */
export function runsConFormato(
  valor: string | null | undefined,
  opciones?: { bold?: boolean; size?: number },
): TextRun[] {
  // Las celdas de tabla se construyen a partir de datos que pueden faltar; sin
  // esta coerción, una celda vacía tumbaba la generación entera del documento.
  const texto = valor ?? "";
  const out: TextRun[] = [];
  // Un solo recorrido con alternancia: los marcadores no se anidan.
  const re = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*)/g;
  let ultimo = 0;
  let m: RegExpExecArray | null;
  const size = opciones?.size;
  const plano = (t: string) => {
    if (t) out.push(new TextRun({ bold: opciones?.bold, size, text: t }));
  };
  while ((m = re.exec(texto)) !== null) {
    plano(texto.slice(ultimo, m.index));
    const token = m[0];
    if (token.startsWith("**")) {
      out.push(new TextRun({ bold: true, size, text: token.slice(2, -2) }));
    } else if (token.startsWith("__")) {
      out.push(new TextRun({ bold: opciones?.bold, size, text: token.slice(2, -2), underline: {} }));
    } else {
      out.push(new TextRun({ italics: true, bold: opciones?.bold, size, text: token.slice(1, -1) }));
    }
    ultimo = m.index + token.length;
  }
  plano(texto.slice(ultimo));
  return out.length > 0 ? out : [new TextRun({ bold: opciones?.bold, size, text: texto })];
}

function texto(value: string | null | undefined): string | null {
  const t = (value ?? "").trim();
  return t ? t : null;
}

// Párrafo "ETIQUETA: contenido" con la etiqueta en negrita (cabecera del memo).
// Alineado a la izquierda: justificar una línea corta como "PARA: X" separa las
// palabras de forma antinatural.
function campoMemo(etiqueta: string, valor: string) {
  // El valor puede traer varias líneas (el PARA lleva el responsable y, debajo,
  // su área usuaria). Se respetan como saltos dentro del mismo párrafo para que
  // la cabecera del memo no se descuadre.
  const lineas = valor.split(/\r?\n/);
  const children: TextRun[] = [new TextRun({ bold: true, text: `${etiqueta}: ` })];
  lineas.forEach((linea, i) => {
    if (i === 0) {
      children.push(...runsConFormato(linea));
      return;
    }
    children.push(new TextRun({ break: 1, text: "" }), ...runsConFormato(linea));
  });
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { after: 60 },
    children,
  });
}

// Viñeta "Título: cuerpo" del Resumen de la Clasificación / Gestión de Riesgos.
function bulletTitulado(titulo: string, cuerpo: string) {
  return new Paragraph({
    spacing: { after: 90 },
    bullet: { level: 0 },
    // El cuerpo lo escribe una persona: admite **negrita**, *cursiva* y
    // __subrayado__ para poder resaltar una cifra o un nombre.
    children: [new TextRun({ bold: true, text: `${titulo}: ` }), ...runsConFormato(cuerpo)],
  });
}

// Conclusión numerada (3.1, 3.2…) como en el modelo institucional.
function conclusion(numero: string, cuerpo: string) {
  return new Paragraph({
    spacing: { after: 90 },
    indent: { left: 360, hanging: 360 },
    children: [new TextRun({ bold: true, text: `${numero}. ` }), new TextRun(cuerpo)],
  });
}

function heading(text: string) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 220, after: 90 }, text });
}

// Las tablas van a 9pt (18 medios puntos) y sin justificar: a tamaño de cuerpo
// la matriz de 8 columnas queda ilegible. La cabecera va sombreada para que se
// distinga del contenido al hojear.
const TABLE_FONT_SIZE = 18;
const HEADER_FILL = "E7E9EC";

function cell(text: string, opts?: { bold?: boolean; width?: number; header?: boolean }) {
  return new TableCell({
    margins: CELL_MARGIN,
    shading: opts?.header ? { fill: HEADER_FILL } : undefined,
    width: opts?.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    children: [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 0, line: 240 },
        // El texto de una celda puede venir del usuario (la justificación de la
        // matriz), así que admite las mismas marcas que el resto del informe.
        // El tamaño va como OPCIÓN: reconstruir los TextRun desde su interior
        // perdía el texto y las celdas salían vacías.
        children: runsConFormato(text, { bold: opts?.bold, size: TABLE_FONT_SIZE }),
      }),
    ],
  });
}

function tabla(headers: string[], filas: string[][], anchos?: number[]): Table {
  const headerRow = new TableRow({
    // Si la tabla parte de página, Word repite la cabecera en la siguiente.
    tableHeader: true,
    children: headers.map((h, i) => cell(h, { bold: true, header: true, width: anchos?.[i] })),
  });
  const dataRows = filas.map(
    (fila) => new TableRow({ children: fila.map((c, i) => cell(c, { width: anchos?.[i] })) }),
  );
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: "999999" },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: "999999" },
      left: { style: BorderStyle.SINGLE, size: 2, color: "999999" },
      right: { style: BorderStyle.SINGLE, size: 2, color: "999999" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "999999" },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: "999999" },
    },
    rows: [headerRow, ...dataRows],
  });
}

function esObra(seg: SegmentacionInput): boolean {
  return seg.objeto === "obras_consultoria_obras";
}

// Bloque "Parámetros de Segmentación": la aritmética que sustenta la cuantía.
// Solo puede construirse si el PAC de bienes y servicios está registrado en
// Configuración y la contratación tiene valor estimado.
function parametrosBloque(
  input: SegmentacionInformeInput,
  parametros: ParametrosSegmentacion,
): (Paragraph | Table)[] {
  const filas = [
    ["Monto Inicial PAC (Bienes/Servicios)", money(parametros.montoInicialPac)],
  ];
  // Sumandos de la Guía: solo se imprimen si existen, para no ensuciar el
  // informe del caso simple con filas en cero.
  if (parametros.noProgramadasConvocadas > 0) {
    filas.push([
      "No programadas ya convocadas",
      money(parametros.noProgramadasConvocadas),
    ]);
  }
  if (parametros.otrasNoProgramadasASegmentar > 0) {
    filas.push([
      input.contratacionEnOtras
        ? "Otras no programadas a segmentar (+ Esta contratación)"
        : "Otras no programadas a segmentar",
      money(parametros.otrasNoProgramadasASegmentar),
    ]);
  }
  // "Nueva Contratación" solo si se suma aparte: con `contratacionEnOtras` su
  // monto ya va dentro de la fila de "otras", así que imprimirla la duplicaría.
  if (!input.programada && !input.contratacionEnOtras) {
    filas.push(["Nueva Contratación", money(parametros.nuevaContratacion)]);
  }
  filas.push(
    ["Monto Total Actualizado", money(parametros.montoActualizado)],
    ["Línea de Corte (10%)", money(parametros.lineaCorte)],
  );
  const bloques: (Paragraph | Table)[] = [
    subtitulo("Parámetros de Segmentación"),
    new Paragraph({
      spacing: { after: 90 },
      children: [
        new TextRun(
          input.programada
            ? "La contratación se encuentra programada en el PAC, por lo que su monto ya está considerado en la cuantía de bienes y servicios aprobada. La línea de corte es el 10% de dicho monto:"
            : "Para segmentar una contratación no programada, se suma la cuantía de los bienes y servicios del PAC inicial más el monto del nuevo requerimiento para establecer la línea de corte:",
        ),
      ],
    }),
    tabla(["Concepto", "Monto"], filas, [65, 35]),
  ];

  // Matiz normativo: el UMBRAL del 10% es el numeral 125.2; pero la BASE sobre la
  // que se aplica (el «monto total actualizado») no es el literal del 125.2 —que
  // habla del monto total del PAC—, sino el método de la Guía, que le suma lo no
  // programado. Se aclara solo cuando la base se ha actualizado con esos sumandos.
  const baseActualizada =
    parametros.noProgramadasConvocadas > 0 ||
    parametros.otrasNoProgramadasASegmentar > 0 ||
    !input.programada;
  if (baseActualizada) {
    bloques.push(
      new Paragraph({
        spacing: { before: 90 },
        children: [
          new TextRun({
            italics: true,
            text:
              "El umbral del 10% aplicado a la cuantía corresponde al numeral 125.2 del Reglamento. El " +
              "monto total actualizado sobre el que se aplica se determina conforme al método de la Guía de " +
              "Actuaciones Preparatorias, que suma a la cuantía de bienes y servicios del PAC las contrataciones " +
              "no programadas ya convocadas, las demás no programadas que se segmenten de forma simultánea y, " +
              "de no estar programada, la propia contratación.",
          }),
        ],
      }),
    );
  }

  return bloques;
}

// Bloque de ANÁLISIS para bienes y servicios: tablas de cuantía y riesgo.
function analisisBienesServicios(
  input: SegmentacionInformeInput,
  cuantiaAlta: boolean,
  riesgoAlto: boolean,
  parametros: ParametrosSegmentacion | null,
): (Paragraph | Table)[] {
  const marcadas = new Set(input.seg.condicionesRiesgo ?? []);
  // Se numeran i) ii) iii) iv) como en la norma y se declara la fuente de cada
  // una: las tres primeras son del Reglamento, la cuarta de la Guía.
  const ROMANOS = ["i)", "ii)", "iii)", "iv)"];
  const filasRiesgo = CONDICIONES_RIESGO_BS.map((c, i) => [
    `${ROMANOS[i] ?? ""} ${c.label}`.trim(),
    c.fuente === "reglamento" ? "Art. 125.3 Reglamento" : "Guía de Act. Preparatorias",
    marcadas.has(c.key) ? "SÍ" : "NO",
  ]);
  // Con el PAC registrado la condición se sustenta con cifras; sin él solo
  // puede enunciarse la regla del 10%.
  const condicion = parametros
    ? `La cuantía de la contratación (${money(parametros.valorEstimado)}) representa el ${parametros.porcentaje}% del monto total actualizado de bienes y servicios y ${
        cuantiaAlta ? "supera" : "no supera"
      } la línea de corte del 10% (${money(parametros.lineaCorte)}).`
    : cuantiaAlta
      ? "Mayor al 10% del monto total del PAC para el objeto."
      : "Menor o igual al 10% del monto total del PAC para el objeto.";
  return [
    new Paragraph({
      spacing: { after: 90 },
      children: [new TextRun("Asimismo, el numeral 125.1 del referido Reglamento señala que:")],
    }),
    cita(
      "En el caso de bienes y servicios, incluyendo las consultorías en general, la entidad contratante realiza la segmentación de las contrataciones según su cuantía y riesgos, considerando las siguientes categorías:",
    ),
    ...CATEGORIAS_ART_125.map(
      (c) =>
        new Paragraph({
          spacing: { after: 40 },
          indent: { left: 567 },
          children: [new TextRun({ italics: true, text: c })],
        }),
    ),
    subtitulo("a) Evaluación de la cuantía"),
    ...(parametros ? parametrosBloque(input, parametros) : []),
    tabla(
      ["Descripción del ítem", "Cuantía", "Condición"],
      [[input.objeto, cuantiaAlta ? "ALTA" : "BAJA", condicion]],
      [40, 12, 48],
    ),
    // El rótulo no puede decir solo "125.3": la cuarta condición es de la Guía.
    subtitulo("b) Evaluación del riesgo (numeral 125.3 del Reglamento y Guía de Actuaciones Preparatorias)"),
    tabla(["Condición de riesgo", "Fuente", "¿Aplica?"], filasRiesgo, [64, 22, 14]),
    new Paragraph({
      spacing: { before: 40, after: 60 },
      children: [
        new TextRun({
          italics: true,
          size: 16,
          text: "Las condiciones i) a iii) corresponden al numeral 125.3 del Reglamento; la condición iv) la incorpora la Guía de Actuaciones Preparatorias. Basta que se cumpla una para que la contratación sea de alto riesgo.",
        }),
      ],
    }),
    new Paragraph({ spacing: { before: 60 }, children: [new TextRun({ bold: true, text: `Nivel de riesgo: ${riesgoAlto ? "ALTO" : "BAJO"}` })] }),
  ];
}

// Bloque de ANÁLISIS para obras y consultoría de obras: criterios concurrentes.
function analisisObras(input: SegmentacionInformeInput, esBasica: boolean): (Paragraph | Table)[] {
  const cumplidos = new Set(input.seg.criteriosBasica ?? []);
  const filas = CRITERIOS_OBRA_BASICA.map((c) => [c.label, cumplidos.has(c.key) ? "SÍ" : "NO"]);
  return [
    new Paragraph({ spacing: { after: 90 }, children: [new TextRun("La segmentación de obras y consultoría de obras se realiza según los criterios concurrentes del Capítulo I, Título V del Reglamento (Art. 153). La contratación es básica solo si se cumplen todos; si falta alguno, es avanzada.")] }),
    tabla(["Criterio concurrente", "¿Se cumple?"], filas, [82, 18]),
    new Paragraph({ spacing: { before: 60 }, children: [new TextRun({ bold: true, text: `Cumplimiento de criterios concurrentes: ${esBasica ? "SÍ (todos)" : "NO (falta al menos uno)"}` })] }),
  ];
}

export async function buildSegmentacionInformeDocx(input: SegmentacionInformeInput): Promise<Buffer> {
  const hoy = new Date().toLocaleDateString("es-PE", { year: "numeric", month: "long", day: "numeric" });
  const obra = esObra(input.seg);

  // La línea de corte solo aplica a bienes y servicios: las obras se clasifican
  // por criterios concurrentes (Art. 153), sin umbral de cuantía.
  const parametros = obra
    ? null
    : calcularParametrosSegmentacion({
        pacBienesServicios: input.institucional?.pacMontoBienesServicios,
        noProgramadasConvocadas: input.noProgramadasConvocadas,
        otrasNoProgramadasASegmentar: input.otrasNoProgramadasASegmentar,
        programada: input.programada,
        valorEstimado: input.valorEstimado,
        contratacionEnOtras: input.contratacionEnOtras,
      });

  // Con el PAC registrado la cuantía es una operación, no una apreciación: manda
  // el cálculo sobre lo guardado en A2, para que el documento no pueda
  // contradecir su propia aritmética.
  const resultado = clasificarSegmentacion(
    parametros ? { ...input.seg, cuantiaAlta: parametros.cuantiaAlta } : input.seg,
  );

  const inst = input.institucional ?? null;
  const ejercicio = inst?.pacAnio ? String(inst.pacAnio) : null;

  // PIA: solo se cita si la resolución está registrada en Configuración.
  const antecedentePia: Paragraph[] = inst?.piaResolucionNumero
    ? [
        bullet(
          `Que, mediante ${inst.piaResolucionNumero}${
            fechaLarga(inst.piaResolucionFecha) ? ` de fecha ${fechaLarga(inst.piaResolucionFecha)}` : ""
          }, se aprobó el Presupuesto Institucional de Apertura (PIA)${
            ejercicio ? ` correspondiente al Año Fiscal ${ejercicio}` : ""
          }.`,
        ),
      ]
    : [];

  // PAC: la resolución y el desagregado de montos aprobados.
  const antecedentePac: Paragraph[] = inst?.pacResolucionNumero
    ? [
        bullet(
          `Que, mediante ${inst.pacResolucionNumero}${
            fechaLarga(inst.pacResolucionFecha) ? ` de fecha ${fechaLarga(inst.pacResolucionFecha)}` : ""
          }, se aprobó el Plan Anual de Contrataciones${ejercicio ? ` – PAC ${ejercicio}` : ""} de ${input.entidad}${
            inst.pacMontoTotal
              ? `, el cual asciende a un monto total de ${money(inst.pacMontoTotal)}`
              : ""
          }${
            inst.pacMontoBienesServicios
              ? `, desagregado en bienes y servicios por el monto de ${money(inst.pacMontoBienesServicios)}`
              : ""
          }${inst.pacMontoObras ? ` y para obras el monto de ${money(inst.pacMontoObras)}` : ""}.`,
        ),
      ]
    : [];

  const antecedentes: Paragraph[] = [
    bullet("Que, mediante la Ley N° 32069, Ley General de Contrataciones Públicas, se establece el marco normativo para la contratación oportuna de bienes, servicios y obras bajo el Sistema Nacional de Abastecimiento."),
    bullet("Que, mediante el Decreto Supremo N° 009-2025-EF, se aprueba el Reglamento de la Ley General de Contrataciones Públicas, modificado por el D.S. N° 001-2026-EF."),
    bullet("Que, mediante la Directiva N° 0002-2025-EF/54.01, se establecen las disposiciones para la elaboración del Plan Anual de Contrataciones, regulando el procedimiento para su formulación y aprobación."),
    bullet("Que, mediante la Resolución Directoral N° 0006-2025-EF/54.01, se aprueban los Lineamientos para la actualización del Plan Anual de Contrataciones (PAC), conforme a la Ley N° 32069 y su Reglamento."),
    ...antecedentePia,
    ...antecedentePac,
    bullet(
      `Que, ${input.documentoRequerimiento ? `mediante ${input.documentoRequerimiento}` : "mediante el requerimiento correspondiente"}${input.areaUsuaria ? ` de ${input.areaUsuaria}` : ""}, se solicita ${input.objeto}${input.plazoDias ? `, con un plazo de ejecución de ${input.plazoDias} días calendario` : ""}.`,
    ),
  ];

  const analisisIntro: Paragraph[] = [
    subtitulo("Marco normativo de la segmentación"),
    new Paragraph({
      spacing: { after: 90 },
      children: [
        new TextRun("El numeral 42.1 del Reglamento de la Ley General de Contrataciones Públicas señala que:"),
      ],
    }),
    // Cita literal del Reglamento (D.S. 009-2025-EF).
    cita(
      "Mediante la segmentación la entidad contratante clasifica las contrataciones, consideradas en el PAC del CMN del ejercicio presupuestal en curso, con excepción de aquellas que correspondan a contratos menores. La segmentación de contrataciones tiene como objetivo coadyuvar a la determinación de la estrategia de contratación, incluyendo el tipo de interacción con el mercado a utilizarse, así como organizar y optimizar los recursos de la DEC y las áreas usuarias.",
    ),
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun(
          input.programada
            ? `La contratación se encuentra programada en el PAC${input.referenciaPac ? ` (referencia: ${input.referenciaPac})` : ""}, por lo que la segmentación se realiza sobre las contrataciones programadas.`
            : "La contratación NO se encuentra programada en el PAC; se trata de un procedimiento de selección no programado. Conforme al numeral 42.3 del Reglamento, la segmentación se efectúa luego de la recepción del requerimiento.",
        ),
      ],
    }),
    // Precondición del 42.3: se declara su estado REAL. El Reglamento la
    // condiciona a que el área usuaria haya SOLICITADO la modificación del CMN;
    // el documento de A1 es la constancia de esa solicitud. Si no consta, el
    // informe lo dice en vez de afirmar un cumplimiento que nadie verificó.
    ...(input.programada
      ? []
      : input.documentoModificacionCmn
        ? [
            new Paragraph({
              spacing: { after: 120 },
              children: [
                new TextRun(
                  `Se deja constancia de que consta en el expediente el documento con que el área usuaria solicita la modificación del Cuadro Multianual de Necesidades (${input.documentoModificacionCmn}). El numeral 42.3 del Reglamento condiciona la segmentación de las contrataciones no programadas a que el área usuaria haya solicitado dicha modificación.`,
                ),
              ],
            }),
            ...(input.enCmn
              ? [
                  new Paragraph({
                    spacing: { after: 120 },
                    children: [
                      new TextRun(
                        `Asimismo, se deja constancia de que la necesidad se encuentra incluida en el Cuadro Multianual de Necesidades${
                          texto(input.versionCmn) ? ` (${texto(input.versionCmn)})` : ""
                        }, por lo que corresponde efectuar la segmentación.`,
                      ),
                    ],
                  }),
                ]
              : []),
          ]
        : input.enCmn
          ? [
              new Paragraph({
                spacing: { after: 120 },
                children: [
                  new TextRun(
                    `Se deja constancia de que la necesidad se encuentra incluida en el Cuadro Multianual de Necesidades${
                      texto(input.versionCmn) ? ` (${texto(input.versionCmn)})` : ""
                    }, por lo que corresponde efectuar la segmentación.`,
                  ),
                ],
              }),
            ]
          : [
              new Paragraph({
                spacing: { after: 120 },
                children: [
                  new TextRun({ bold: true, text: "Precondición pendiente: " }),
                  new TextRun(
                    "a la fecha del presente informe no consta en el expediente la verificación de que la necesidad se encuentre incluida en el Cuadro Multianual de Necesidades. El numeral 42.3 del Reglamento condiciona la segmentación de las contrataciones no programadas a que el área usuaria haya solicitado la modificación del CMN.",
                  ),
                ],
              }),
            ]),
  ];

  const analisisSegmentacion = obra
    ? analisisObras(input, resultado.categoria === "contratacion_basica")
    : analisisBienesServicios(input, resultado.cuantiaAlta, resultado.riesgoAlto, parametros);

  const nar = input.narrativa ?? null;

  // --- Referencias y fecha del informe (la cabecera PARA/DE/ASUNTO se omite) ---
  // Las referencias se arman con lo ya registrado: resoluciones del PIA/PAC y
  // el documento del requerimiento.
  const referencias = [
    texto(inst?.piaResolucionNumero),
    texto(inst?.pacResolucionNumero),
    texto(input.documentoRequerimiento),
  ].filter((r): r is string => Boolean(r));

  const cabeceraMemo: Paragraph[] = [
    // Se omite a propósito el encabezado de memorando (INFORME N°, PARA,
    // ATENCIÓN, DE, ASUNTO) y el saludo: la entidad los aporta desde su propio
    // membrete/numeración al ensamblar el expediente, y duplicarlos aquí genera
    // dos cabeceras. Se conservan REFERENCIA y FECHA, que son datos objetivos
    // del expediente y no un encabezado de destinatario.
    ...(referencias.length > 0
      ? [
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { after: 40 },
            children: [new TextRun({ bold: true, text: "REFERENCIA:" })],
          }),
          ...referencias.map(
            (r, i) =>
              new Paragraph({
                alignment: AlignmentType.LEFT,
                spacing: { after: 40 },
                indent: { left: 567 },
                children: [new TextRun(`${String.fromCharCode(97 + i)}) ${r}`)],
              }),
          ),
        ]
      : []),
    campoMemo("FECHA", texto(input.lugar) ? `${texto(input.lugar)}, ${hoy}.` : `${hoy}.`),
  ];

  // --- Matriz de Segmentación y Tipo de Interacción ---
  const matriz: (Paragraph | Table)[] = [
    subtitulo("Matriz de Segmentación y Tipo de Interacción"),
    new Paragraph({
      spacing: { after: 90 },
      children: [
        new TextRun(
          "A continuación, se presenta la matriz donde se define la Categoría y el Tipo de Interacción correspondiente para cada ítem:",
        ),
      ],
    }),
    tabla(
      [
        "N°",
        "Descripción del ítem",
        "Valor de la cuantía (S/)",
        obra ? "Criterios (Art. 153)" : "Cuantía (Art. 125)",
        obra ? "—" : "Nivel de riesgo (Art. 125.3)",
        "Justificación de la categoría",
        "Categoría (Art. 125.1)",
        "Interacción (Art. 127)",
      ],
      [
        [
          "1",
          input.objeto,
          money(input.valorEstimado),
          obra
            ? resultado.categoria === "contratacion_basica"
              ? "Cumple"
              : "No cumple"
            : resultado.cuantiaAlta
              ? "Alta"
              : "Baja",
          obra ? "—" : resultado.riesgoAlto ? "Alto" : "Bajo",
          texto(nar?.justificacion) ?? "—",
          resultado.categoriaLabel,
          resultado.nivelLabel,
        ],
      ],
      [4, 20, 11, 9, 10, 24, 11, 11],
    ),
  ];

  // --- Resumen de la Clasificación (Art. 125.1) ---
  // El primer punto se sustenta con la aritmética; el resto sale de la norma
  // (125.4) y de lo que haya escrito el usuario.
  const sustentoCuantia = parametros
    ? `El monto de la contratación es de ${money(parametros.valorEstimado)}, el cual ${
        parametros.cuantiaAlta ? "supera" : "no supera"
      } el 10% del total actualizado de bienes y servicios, que asciende a ${money(parametros.lineaCorte)}.`
    : `La contratación es de ${resultado.cuantiaAlta ? "alta" : "baja"} cuantía respecto del monto del PAC para el objeto.`;

  const resumenClasificacion: Paragraph[] = obra
    ? []
    : [
        subtitulo("Resumen de la Clasificación (Art. 125.1)"),
        new Paragraph({
          spacing: { after: 90 },
          children: [new TextRun("Se sustenta la segmentación para el presente ítem en los siguientes puntos:")],
        }),
        bulletTitulado(
          `${resultado.categoriaLabel.toUpperCase()} (Cuantía ${resultado.cuantiaAlta ? "alta" : "baja"} + Riesgo ${resultado.riesgoAlto ? "alto" : "bajo"})`,
          sustentoCuantia,
        ),
        bulletTitulado(
          "Objetivo Estratégico",
          `Conforme al numeral 125.4 del Reglamento, la estrategia de contratación se orienta principalmente a ${estrategiaArt1254(resultado.categoria)}, en atención a los enfoques de Gestión por Resultados y Gestión de Riesgos previstos en el artículo 6 de la Ley General de Contrataciones Públicas.`,
        ),
        ...(texto(nar?.continuidad) ? [bulletTitulado("Continuidad", texto(nar?.continuidad)!)] : []),
      ];

  // --- Gestión de Riesgos --- (solo si el usuario escribió algo)
  const riesgoItems: Paragraph[] = [
    ...(texto(nar?.riesgoMercado) ? [bulletTitulado("Riesgo de Mercado", texto(nar?.riesgoMercado)!)] : []),
    ...(texto(nar?.estrategiaMitigacion)
      ? [bulletTitulado("Estrategia de Mitigación", texto(nar?.estrategiaMitigacion)!)]
      : []),
    ...(texto(nar?.puntoControl) ? [bulletTitulado("Punto de Control", texto(nar?.puntoControl)!)] : []),
  ];
  const gestionRiesgos: Paragraph[] =
    riesgoItems.length > 0
      ? [
          subtitulo("Gestión de Riesgos"),
          new Paragraph({
            spacing: { after: 90 },
            children: [
              new TextRun(
                `Para este ${input.tipoObjetoLabel.toLowerCase()} de categoría ${resultado.categoriaLabel}, se ha determinado lo siguiente:`,
              ),
            ],
          }),
          ...riesgoItems,
        ]
      : [];

  // Compra centralizada/corporativa: fuerza la categoría, así que debe constar.
  const notaCentralizada: Paragraph[] = input.seg.centralizada
    ? [
        new Paragraph({
          spacing: { before: 120, after: 90 },
          children: [
            new TextRun({ bold: true, text: "Compra centralizada o corporativa: " }),
            new TextRun(
              `la contratación se realiza mediante compra centralizada o corporativa, por lo que se clasifica directamente como ${
                obra ? "CONTRATACIÓN AVANZADA" : "ESTRATÉGICA"
              }, conforme a la Guía de Actuaciones Preparatorias (Cap. I).`,
            ),
          ],
        }),
      ]
    : [];

  // Cronograma de presentación de requerimientos (Art. 42.2).
  //
  // Solo aplica a contrataciones PROGRAMADAS: el cronograma nace de la
  // segmentación que la DEC hace de todo el PAC una vez aprobado el CMN, para
  // decir a las áreas usuarias cuándo remitir sus requerimientos. En una
  // contratación NO programada el requerimiento ya llegó —es lo que dispara la
  // segmentación (Art. 42.3)—, así que un cronograma para presentarlo no tiene
  // sentido. Por eso el modelo institucional de segmentación no programada no
  // lo incluye.
  const cronogramaItems = input.programada
    ? (input.cronograma ?? []).filter((c) => (c.area ?? "").trim())
    : [];
  const cronogramaBloque: (Paragraph | Table)[] =
    cronogramaItems.length > 0
      ? [
          subtitulo("Cronograma de presentación de requerimientos (Art. 42.2)"),
          new Paragraph({
            spacing: { after: 90 },
            children: [
              new TextRun(
                "Culminada la segmentación, la DEC comunica a las áreas usuarias, mediante documento interno, las fechas estimadas para la remisión de sus requerimientos, considerando los plazos previstos para el desarrollo de las actuaciones preparatorias.",
              ),
            ],
          }),
          tabla(
            ["Área usuaria", "Fecha estimada de presentación"],
            cronogramaItems.map((c) => [c.area.trim(), (c.fecha ?? "").trim() || "—"]),
            [65, 35],
          ),
        ]
      : [];

  // Conclusiones numeradas 3.1–3.4, como en el modelo institucional.
  const conclusiones: Paragraph[] = [
    conclusion(
      "3.1",
      `Se concluye que “${input.objeto}” se clasifica en la categoría ${resultado.categoriaLabel.toUpperCase()}${
        obra
          ? ", al verificarse los criterios concurrentes del Art. 153 del Reglamento."
          : parametros
            ? `, debido a que su cuantía es de ${money(parametros.valorEstimado)}, lo cual representa el ${parametros.porcentaje}% del monto total actualizado de bienes y servicios, ${
                parametros.cuantiaAlta ? "superando" : "situándose por debajo de"
              } el umbral del 10% (cuantía ${parametros.cuantiaAlta ? "alta" : "baja"}). Asimismo, presenta un riesgo ${
                resultado.riesgoAlto ? "alto" : "bajo"
              } conforme al numeral 125.3 del Reglamento.`
            : ` (cuantía ${resultado.cuantiaAlta ? "alta" : "baja"} y riesgo ${resultado.riesgoAlto ? "alto" : "bajo"}).`
      }`,
    ),
    conclusion(
      "3.2",
      `Al identificarse como una contratación de categoría ${resultado.categoriaLabel.toLowerCase()}, corresponde realizar una ${resultado.nivelLabel}, conforme al Cuadro N° 10 de la Guía de Actuaciones Preparatorias. ${resultado.nivelRequisito}`,
    ),
    ...(obra
      ? []
      : [
          conclusion(
            "3.3",
            `Conforme al numeral 125.4 del Reglamento, al ser una contratación ${resultado.categoriaLabel.toLowerCase()}, la estrategia se orientará prioritariamente a ${estrategiaArt1254(resultado.categoria)}.`,
          ),
        ]),
    conclusion(
      obra ? "3.3" : "3.4",
      "Se remite el presente informe para continuar con las actuaciones preparatorias bajo el marco de la Ley N° 32069 y su Reglamento, aprobado por D.S. N° 009-2025-EF. La segmentación no se aprueba mediante un documento específico: su resultado final se traslada al contenido del Anexo N° 2, mediante el cual se aprueba el expediente de contratación.",
    ),
  ];

  const document = new Document({
    styles: ESTILOS,
    sections: [
      {
        properties: { page: { margin: MARGENES } },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 0 },
                children: [
                  new TextRun({ size: 16, text: "Página " }),
                  new TextRun({ size: 16, children: [PageNumber.CURRENT] }),
                  new TextRun({ size: 16, text: " de " }),
                  new TextRun({ size: 16, children: [PageNumber.TOTAL_PAGES] }),
                ],
              }),
              // Trazabilidad de quién generó el documento en el sistema, no una
              // firma: va en el pie de página, no en el cuerpo que se imprime.
              ...(input.elaboradoPor
                ? [
                    new Paragraph({
                      alignment: AlignmentType.LEFT,
                      spacing: { after: 0 },
                      children: [new TextRun({ size: 16, text: `Elaborado por: ${input.elaboradoPor}` })],
                    }),
                  ]
                : []),
            ],
          }),
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 0 },
            children: [new TextRun({ bold: true, text: input.entidad.toUpperCase() })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
            border: {
              bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000", space: 6 },
            },
            children: [new TextRun({ italics: true, size: 18, text: "Informe de Segmentación · Fase 1 · Actuaciones Preparatorias" })],
          }),
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            text: obra
              ? "SEGMENTACIÓN DE OBRAS Y CONSULTORÍA DE OBRAS"
              : `SEGMENTACIÓN DE BIENES Y SERVICIOS${input.programada ? "" : " NO PROGRAMADOS"}`,
          }),

          ...cabeceraMemo,

          heading("I. ANTECEDENTES"),
          ...antecedentes,

          heading("II. ANÁLISIS"),
          ...analisisIntro,
          ...analisisSegmentacion,
          ...notaCentralizada,
          ...matriz,
          ...resumenClasificacion,
          ...gestionRiesgos,
          ...cronogramaBloque,

          new Paragraph({
            spacing: { before: 160, after: 120 },
            children: [
              new TextRun(
                "En mérito a lo expuesto, esta dependencia, en ejercicio de las funciones asignadas por el artículo 14 del Reglamento y conforme al procedimiento previsto en sus artículos 42, 125 y 153, ha efectuado la segmentación de la presente contratación. La categoría asignada y el nivel mínimo de interacción con el mercado que de ella se deriva quedan sustentados en los criterios normativos y en los parámetros cuantitativos consignados en los numerales precedentes.",
              ),
            ],
          }),

          heading("III. CONCLUSIONES"),
          ...conclusiones,

          new Paragraph({
            spacing: { before: 160, after: 200 },
            children: [
              new TextRun(
                "Es cuanto informo a usted para su conocimiento y los fines correspondientes, debiendo incorporarse el presente al expediente de contratación como sustento de la segmentación efectuada.",
              ),
            ],
          }),
          // Sin bloque de firma: el documento se imprime sobre el membrete de
          // la entidad y se firma con el sello real. Una línea con el nombre
          // mecanografiado debajo estorba y se acaba tachando a mano.
          new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun("Atentamente,")] }),
        ],
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(document));
}
