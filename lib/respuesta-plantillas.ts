import type { DocTipo } from "./expedientes-archivo-actions";

// Plantillas de casos frecuentes de mesa de partes municipal.
// Pre-llenan la INTENCION (lo que el funcionario quiere responder) y sugieren
// el tipo de documento. El usuario solo completa los [CORCHETES] y genera.
export type PlantillaRespuesta = {
  id: string;
  label: string;
  descripcion: string;
  tipoSugerido: DocTipo;
  intencion: string;
};

export const PLANTILLAS_RESPUESTA: PlantillaRespuesta[] = [
  {
    id: "acceso-informacion",
    label: "Acceso a la información pública",
    descripcion: "Entrega de información solicitada bajo la Ley de Transparencia",
    tipoSugerido: "CARTA",
    intencion:
      "Responder la solicitud de acceso a la información pública: se ENTREGA la información solicitada consistente en [DESCRIBIR INFORMACIÓN]. Indicar que la entrega se hace conforme a la Ley N° 27806, Ley de Transparencia y Acceso a la Información Pública, dentro del plazo legal.",
  },
  {
    id: "derivacion",
    label: "Derivación a otra área",
    descripcion: "El pedido no es de competencia de esta oficina",
    tipoSugerido: "MEMORANDUM",
    intencion:
      "Derivar el documento recibido a [ÁREA COMPETENTE] por ser de su competencia, conforme al principio de legalidad y al ROF de la entidad. Solicitar que atienda el pedido dentro del plazo legal y comunique la respuesta al administrado.",
  },
  {
    id: "subsanacion",
    label: "Requerimiento de subsanación",
    descripcion: "La solicitud tiene observaciones que el administrado debe corregir",
    tipoSugerido: "CARTA",
    intencion:
      "Comunicar al administrado que su solicitud tiene las siguientes observaciones: [LISTAR OBSERVACIONES]. Requerir la subsanación en el plazo de DOS (2) días hábiles conforme al artículo 136 del TUO de la Ley N° 27444, bajo apercibimiento de tenerse por no presentada.",
  },
  {
    id: "respuesta-reclamo",
    label: "Respuesta a reclamo",
    descripcion: "Atención de un reclamo o queja del administrado",
    tipoSugerido: "CARTA",
    intencion:
      "Responder el reclamo presentado: explicar las acciones adoptadas respecto a [MOTIVO DEL RECLAMO], los resultados de la verificación realizada y las medidas correctivas dispuestas, agradeciendo la comunicación.",
  },
  {
    id: "atencion-solicitud",
    label: "Atención de solicitud (procedente)",
    descripcion: "Se atiende favorablemente lo pedido",
    tipoSugerido: "OFICIO",
    intencion:
      "Comunicar que la solicitud ha sido atendida FAVORABLEMENTE: se dispone [ACCIÓN CONCEDIDA], conforme a [BASE LEGAL O SUSTENTO]. Indicar los pasos siguientes si los hubiera.",
  },
  {
    id: "solicitud-improcedente",
    label: "Solicitud improcedente",
    descripcion: "Se deniega lo pedido con fundamento legal",
    tipoSugerido: "CARTA",
    intencion:
      "Comunicar que la solicitud resulta IMPROCEDENTE porque [FUNDAMENTO], conforme a [BASE LEGAL]. Indicar que puede interponer los recursos administrativos previstos en el TUO de la Ley N° 27444 dentro de los 15 días hábiles.",
  },
  {
    id: "requerimiento-informe",
    label: "Requerimiento de informe a otra área",
    descripcion: "Pedir informe técnico o descargo interno",
    tipoSugerido: "MEMORANDUM",
    intencion:
      "Requerir a [ÁREA/FUNCIONARIO] un informe técnico sobre [TEMA], necesario para atender el expediente [N° EXPEDIENTE], otorgando un plazo de [N] días hábiles.",
  },
  {
    id: "subsanacion-perfeccionamiento",
    label: "Subsanación para perfeccionamiento de contrato",
    descripcion:
      "El postor ganador de la buena pro no presentó todos los requisitos del art. 88 del Reglamento de la Ley 32069",
    tipoSugerido: "CARTA",
    intencion:
      "Comunicar al postor ganador de la buena pro del procedimiento [TIPO Y N° DE PROCEDIMIENTO, ej. SUBASTA INVERSA ELECTRONICA N° 00-2026-DEC-MDCH-1] sobre [DENOMINACIÓN DE LA CONTRATACIÓN/PROYECTO] que, revisada la documentación presentada por mesa de partes el [FECHA DE PRESENTACIÓN], NO cumple los requisitos para perfeccionar el contrato.\n\n" +
      "Estructura: I. ANTECEDENTES (fecha de presentación y resultado de la revisión). BASE LEGAL: los plazos y el procedimiento se rigen por el artículo 90 del Reglamento de la Ley N° 32069 (D.S. N° 009-2025-EF); los documentos exigibles son los del artículo 88 del Reglamento y los previstos en la sección específica de las bases. SOLICITA (lista numerada SOLO con los documentos faltantes):\n" +
      "[MARCAR LOS QUE FALTAN]\n" +
      "- Institución arbitral elegida del listado propuesto por la entidad o propuesta de tres instituciones arbitrales del postor (Anexo N° [9/10 según bases]).\n" +
      "- Detalle del precio de la oferta de cada uno de los bienes que conforman el paquete.\n" +
      "- Autorización de notificaciones electrónicas durante la ejecución contractual (Anexo N° [8/9 según bases]).\n" +
      "- Copia de la vigencia de poder del representante legal con facultades para perfeccionar el contrato.\n" +
      "- Declaración Jurada de Actualización de Desafectación de Impedimento (Anexo N° 15) y su sustento, de corresponder.\n" +
      "- Garantía de fiel cumplimiento (y por prestaciones accesorias, de corresponder).\n" +
      "- Contrato de consorcio con firmas legalizadas, de ser el caso.\n" +
      "- Código de cuenta interbancaria (CCI).\n" +
      "- [OTRO REQUISITO DE LAS BASES, ej. certificado de análisis vigente no mayor a 6 meses].\n\n" +
      "Otorgar un plazo de [2/3/4] días hábiles como máximo para subsanar, contados desde el día siguiente de la notificación (art. 90.3: máximo 4 días hábiles), citando además el art. 90.5 (perfeccionamiento dentro de los 3 días hábiles de subsanado). Indicar que la documentación se remite por mesa de partes de la entidad y que se notifica al correo [CORREO DEL POSTOR].",
  },
  {
    id: "remision-informacion",
    label: "Remisión de información / documentos",
    descripcion: "Enviar información o documentación a otra entidad",
    tipoSugerido: "OFICIO",
    intencion:
      "Remitir a la entidad destinataria la información/documentación consistente en [DETALLE], en atención a su requerimiento [REFERENCIA], para los fines correspondientes.",
  },
];
