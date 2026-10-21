// Anuncio de contratación futura (Art. 43 del Reglamento) — paso A10.
//
// Es el único paso de la Fase 1 que tenía campos y NO generaba documento. El
// Art. 43 fija la información que el anuncio "incluye": a) datos de la entidad,
// b) descripción preliminar del requerimiento, c) tipo de procedimiento
// previsto, d) fecha aproximada de convocatoria; y remite al numeral 64.3 del
// Art. 64 para el beneficio de reducción de plazo cuando se publica con
// antelación. Este módulo compone ese documento a partir de lo capturado en A10.
//
// El builder es PURO y determinista (no llama a `Date`: las fechas llegan como
// texto ISO y se formatean partiendo la cadena, sin zona horaria), para poder
// probarlo sin red ni relojes.

import { AlignmentType, Document, Footer, Packer, Paragraph, TextRun } from "docx";

export type AnuncioFuturoInput = {
  entidad: string;
  ciudad?: string | null;
  nomenclatura: string;
  /** "Bien" / "Servicio" / "Obra" / "Consultoría de obra". */
  objetoLabel?: string | null;
  /** a) Datos de la entidad contratante (texto libre; complementa a `entidad`). */
  datosEntidad?: string | null;
  /** b) Descripción preliminar del requerimiento. */
  descripcionPreliminar?: string | null;
  /** c) Tipo de procedimiento de selección previsto. */
  tipoProcedimiento?: string | null;
  /** d) Fecha aproximada de convocatoria (ISO "YYYY-MM-DD"). */
  fechaAproxConvocatoria?: string | null;
  publicadoPladicop?: boolean;
  publicadoSede?: boolean;
  /** Fecha de publicación del anuncio (ISO). */
  fechaPublicacion?: string | null;
  /** ¿Se publicó con la antelación que da el beneficio del Art. 64.3? */
  beneficio40dias?: boolean;
  /** Plazo reducido aplicado (días), si corresponde. */
  plazoReducido?: number | null;
  /** Fecha del documento (ISO); la fija el llamador para no depender del reloj. */
  hoy: string;
  /** Nombre completo del usuario en sesión que generó el anuncio. */
  elaboradoPor?: string | null;
};

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

// "2026-05-10" → "10 de mayo de 2026". Se parte la cadena a mano: construir un
// `Date` de una fecha ISO la interpreta en UTC y, según la zona, retrocede un día.
function fechaLarga(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return iso.trim();
  const [, y, mm, d] = m;
  const mes = MESES[Number(mm) - 1];
  if (!mes) return iso.trim();
  return `${Number(d)} de ${mes} de ${y}`;
}

const PENDIENTE = "[Por completar]";

function titulo(text: string) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [new TextRun({ bold: true, size: 30, text })],
  });
}

function subtitulo(text: string) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 260 },
    children: [new TextRun({ italics: true, size: 22, text })],
  });
}

function parrafo(text: string) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 160 },
    children: [new TextRun({ size: 22, text })],
  });
}

// "a) Etiqueta: contenido", con la etiqueta en negrita. El contenido faltante se
// marca como pendiente en vez de dejar la línea coja: un anuncio a medio llenar
// se delata solo.
function apartado(etiqueta: string, contenido: string | null | undefined) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 120 },
    children: [
      new TextRun({ bold: true, size: 22, text: `${etiqueta}: ` }),
      new TextRun({ size: 22, text: contenido ?? PENDIENTE }),
    ],
  });
}

export async function buildAnuncioFuturoDocx(input: AnuncioFuturoInput): Promise<Buffer> {
  const canales = [
    input.publicadoPladicop ? "la Pladicop" : "",
    input.publicadoSede ? "la sede digital de la entidad" : "",
  ].filter(Boolean);

  const hijos: Paragraph[] = [
    titulo("ANUNCIO DE CONTRATACIÓN FUTURA"),
    subtitulo(input.nomenclatura),
    parrafo(
      `${input.entidad}, a través de la Dependencia Encargada de las Contrataciones (DEC), en el marco del artículo 43 del Reglamento de la Ley N° 32069, da a conocer de manera anticipada al mercado su intención de convocar la siguiente contratación${input.objetoLabel ? ` (${input.objetoLabel.toLowerCase()})` : ""}, a fin de promover una mayor participación de potenciales proveedores.`,
    ),
    apartado("a) Datos de la entidad contratante", input.datosEntidad ?? input.entidad),
    apartado("b) Descripción preliminar del requerimiento", input.descripcionPreliminar),
    apartado("c) Tipo de procedimiento de selección previsto", input.tipoProcedimiento),
    apartado("d) Fecha aproximada de convocatoria", fechaLarga(input.fechaAproxConvocatoria)),
  ];

  if (canales.length > 0 || input.fechaPublicacion) {
    const partes = [
      canales.length > 0 ? `El presente anuncio se publica en ${canales.join(" y ")}` : "El presente anuncio se publica",
      input.fechaPublicacion ? `con fecha ${fechaLarga(input.fechaPublicacion)}` : "",
    ].filter(Boolean);
    hijos.push(parrafo(`${partes.join(" ")}.`));
  }

  // El anuncio NO sustituye la convocatoria y su publicación es potestativa
  // (Art. 43, "puede publicar"). Si se hizo con antelación suficiente, opera el
  // beneficio de reducción de plazo del numeral 64.3.
  hijos.push(
    parrafo(
      input.beneficio40dias
        ? `Habiéndose publicado con la antelación prevista, resulta aplicable el beneficio de reducción de plazo del numeral 64.3 del artículo 64 del Reglamento${input.plazoReducido ? `, con un plazo reducido de ${input.plazoReducido} días` : ""}.`
        : "Este anuncio no sustituye la convocatoria del procedimiento de selección y su publicación es potestativa (artículo 43 del Reglamento).",
    ),
  );

  hijos.push(
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 300 },
      children: [
        new TextRun({
          size: 22,
          text: input.ciudad ? `${input.ciudad}, ${fechaLarga(input.hoy)}.` : `${fechaLarga(input.hoy)}.`,
        }),
      ],
    }),
  );
  const document = new Document({
    sections: [
      {
        // "Elaborado por" es la trazabilidad de quién generó el documento en el
        // sistema, no una firma: va en el pie de página, no en el cuerpo que se
        // imprime y se firma.
        footers: input.elaboradoPor
          ? {
              default: new Footer({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.LEFT,
                    children: [new TextRun({ size: 16, text: `Elaborado por: ${input.elaboradoPor}` })],
                  }),
                ],
              }),
            }
          : undefined,
        // Márgenes normales: 2.5 cm superior/inferior, 3 cm izquierda/derecha.
        properties: { page: { margin: { top: 1418, bottom: 1418, left: 1701, right: 1701 } } },
        children: hijos,
      },
    ],
  });
  return Buffer.from(await Packer.toBuffer(document));
}

/** Mapea el JSONB del paso A10 al input del builder. Puro y testeable. */
export function datosAnuncioFuturo(
  a10: Record<string, unknown>,
  ctx: { entidad: string; ciudad?: string | null; nomenclatura: string; objetoLabel?: string | null; hoy: string },
): AnuncioFuturoInput {
  const s = (k: string): string | null => {
    const v = a10[k];
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };
  const b = (k: string): boolean => a10[k] === true;
  const n = (k: string): number | null => {
    const v = Number(a10[k]);
    return Number.isFinite(v) && v > 0 ? v : null;
  };
  return {
    entidad: ctx.entidad,
    ciudad: ctx.ciudad ?? null,
    nomenclatura: ctx.nomenclatura,
    objetoLabel: ctx.objetoLabel ?? null,
    datosEntidad: s("datos_entidad"),
    descripcionPreliminar: s("descripcion_preliminar"),
    tipoProcedimiento: s("tipo_procedimiento_previsto"),
    fechaAproxConvocatoria: s("fecha_aprox_convocatoria"),
    publicadoPladicop: b("publicado_pladicop"),
    publicadoSede: b("publicado_sede_digital"),
    fechaPublicacion: s("fecha_publicacion_anuncio"),
    beneficio40dias: b("aplica_beneficio_40dias"),
    plazoReducido: n("plazo_reducido"),
    hoy: ctx.hoy,
  };
}
