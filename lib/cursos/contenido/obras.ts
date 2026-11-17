import type { Clase } from "../tipos";

// Contenido verificado contra el corpus del RAG (ver la cabecera de actos-preparatorios.ts).
// El orden (IX, XIII, XVII) es el del aula del taller, no el numérico.

export const OBRAS: Clase[] = [
  {
    slug: "incentivos-obras-consultoria",
    modulo: "IX",
    titulo: "Incentivos para proveedores de obras y consultores de obra",
    descripcion:
      "Los tres incentivos que la entidad puede fijar en las bases para la ejecución de obras y consultorías de obra, " +
      "cuándo se pagan y cuál es obligatorio.",
    minutos: 7,
    contenido: {
      resumen: [
        {
          pregunta: "¿Dónde se establecen los incentivos?",
          parrafos: [
            "En las bases, independientemente de la modalidad de pago, conforme al numeral 49.3 de la Ley " +
              "(Reglamento, Art. 162; Ley, Art. 49).",
          ],
        },
        {
          pregunta: "¿Cuáles son?",
          parrafos: [
            "Cumplimiento anticipado: si el contratista termina antes de la fecha programada uno o más componentes y obtiene " +
              "la conformidad, se le paga el gasto general variable diario por los días de diferencia. En el sistema de " +
              "solo construcción este incentivo es obligatorio.",
            "Excelencia en estándares ambientales y de seguridad: solo para componentes de ejecución de obra, con una " +
              "bonificación de hasta el 1 % del monto del contrato original. Si se usa, la sostenibilidad ambiental y la " +
              "seguridad y salud en el trabajo no se incluyen como factor de evaluación.",
            "Respuesta rápida de la supervisión: si se pronuncia sobre todas las consultas del cuaderno de incidencias o " +
              "las modificaciones en un plazo igual o menor al 50 % del previsto, con una bonificación de hasta el 3 % del " +
              "monto del contrato original (Reglamento, Art. 162).",
          ],
        },
      ],
      puntosClave: [
        "Tres incentivos: cumplimiento anticipado, excelencia ambiental y de seguridad, y respuesta rápida de la supervisión.",
        "Cumplimiento anticipado: obligatorio en solo construcción.",
        "Excelencia ambiental y de seguridad: hasta 1 % del contrato original.",
        "Respuesta rápida de la supervisión: hasta 3 % del contrato original.",
      ],
      baseLegal: [
        { norma: "Ley 32069", articulo: "49" },
        { norma: "Reglamento", articulo: "162" },
      ],
      verificada: true,
    },
  },
  {
    slug: "inicio-plazo-vigencia-contrato",
    modulo: "XIII",
    titulo: "Inicio del plazo de ejecución y vigencia del contrato",
    descripcion:
      "Desde cuándo rige el contrato, hasta cuándo, y qué condiciones tiene que cumplir la entidad para que empiece a " +
      "correr el plazo de ejecución de una obra.",
    minutos: 8,
    contenido: {
      resumen: [
        {
          pregunta: "¿Desde cuándo y hasta cuándo rige el contrato?",
          parrafos: [
            "Rige desde el día siguiente de su suscripción o desde la notificación de la orden de compra o de servicio " +
              "(Reglamento, Art. 106).",
            "En bienes y servicios, hasta el pago final (o hasta la conformidad, si el pago es condición de la entrega) o " +
              "hasta la última prestación del contratista cuando hay prestaciones posteriores al pago. En obras y " +
              "consultoría de obras, hasta el consentimiento de la liquidación final y su pago.",
          ],
        },
        {
          pregunta: "¿Cuándo empieza el plazo de ejecución de una obra?",
          parrafos: [
            "Cuando la entidad cumple estas condiciones: entregar la actualización del expediente técnico o de la " +
              "documentación técnica si cambió durante el procedimiento; comunicar quién está a cargo de la supervisión; " +
              "entregar el adelanto directo si se solicitó (salvo que se garantice con fideicomiso); suscribir el contrato " +
              "tripartito de la JPRD, si corresponde; y, en solo construcción, entregar total o parcialmente el terreno " +
              "(Reglamento, Art. 176).",
            "Las consultorías de obras tienen su propia lista de condiciones en el mismo artículo.",
          ],
        },
      ],
      puntosClave: [
        "Vigencia: desde el día siguiente de la suscripción o de la notificación de la orden.",
        "Obras y consultorías de obra: el contrato rige hasta el consentimiento de la liquidación final y su pago.",
        "El plazo de ejecución de obra empieza solo cuando la entidad cumple todas las condiciones del artículo 176.",
        "La entrega del terreno es condición en el sistema de solo construcción.",
      ],
      baseLegal: [
        { norma: "Reglamento", articulo: "106" },
        { norma: "Reglamento", articulo: "176" },
      ],
      verificada: true,
    },
  },
  {
    slug: "intervencion-economica",
    modulo: "XVII",
    titulo: "Intervención económica",
    descripcion:
      "Cuándo puede la entidad intervenir económicamente una obra, para qué sirve y qué consecuencias tiene para el " +
      "contratista que la acepta o la rechaza.",
    minutos: 6,
    contenido: {
      resumen: [
        {
          pregunta: "¿Cuándo procede?",
          parrafos: [
            "La entidad puede intervenir económicamente la obra, de oficio o a solicitud de parte, por caso fortuito, " +
              "fuerza mayor o incumplimientos contractuales que a su juicio no permitan terminar los trabajos. Aplica a " +
              "obras bajo solo construcción y diseño y construcción (Reglamento, Art. 208).",
          ],
        },
        {
          pregunta: "¿Para qué sirve y qué efectos tiene?",
          parrafos: [
            "Es una medida técnica y económica para culminar la obra sin resolver el contrato. Si el contratista la " +
              "rechaza, el contrato se resuelve por incumplimiento.",
            "El contratista no queda fuera del contrato ni de sus obligaciones, pero pierde el derecho a mayores gastos " +
              "generales, indemnización o similares cuando la intervención se debe a su incumplimiento. Se aplica además la " +
              "directiva de la DGA (Reglamento, Art. 208).",
          ],
        },
      ],
      puntosClave: [
        "Causas: caso fortuito, fuerza mayor o incumplimientos que impidan terminar la obra.",
        "Busca culminar la obra sin resolver el contrato.",
        "Si el contratista la rechaza, se resuelve el contrato por incumplimiento.",
        "Si la causa es su incumplimiento, pierde mayores gastos generales e indemnizaciones.",
      ],
      baseLegal: [{ norma: "Reglamento", articulo: "208" }],
      verificada: true,
    },
  },
];
