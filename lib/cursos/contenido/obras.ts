import type { Clase } from "../tipos";

// Contenido verificado contra el corpus del RAG (ver la cabecera de actos-preparatorios.ts).
// El orden (IX, XIII, XVII) es el del aula del taller, no el numérico.

export const OBRAS: Clase[] = [
  {
    slug: "incentivos-obras-consultoria",
    modulo: "IX",
    temas: [],
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
      casuisticas: [
        {
          enunciado:
            "En una obra bajo solo construcción el contratista terminó un componente antes de la fecha programada y obtuvo su conformidad. ¿Le corresponde algo?",
          resolucion:
            "El incentivo por cumplimiento anticipado: el pago del gasto general variable diario por los días de diferencia. En el sistema de solo construcción este incentivo es obligatorio y se fija en las bases.",
          baseLegal: [{ norma: "Reglamento", articulo: "162" }],
        },
        {
          enunciado:
            "La entidad quiere pagar la bonificación por excelencia en estándares ambientales y de seguridad equivalente al 3 % del contrato. ¿Es correcto?",
          resolucion:
            "No. Esa bonificación llega hasta el 1 % del monto del contrato original, solo para componentes de ejecución de obra; el 3 % corresponde al incentivo por respuesta rápida de la supervisión.",
          baseLegal: [{ norma: "Reglamento", articulo: "162" }],
        },
        {
          enunciado:
            "La supervisión se pronunció sobre todas las consultas del cuaderno de incidencias en la mitad del plazo previsto. ¿Gana algo?",
          resolucion:
            "Sí, el incentivo por respuesta rápida de la supervisión: si responde en un plazo igual o menor al 50 % del previsto, la bonificación llega hasta el 3 % del monto del contrato original.",
          baseLegal: [{ norma: "Reglamento", articulo: "162" }],
        },
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
    temas: ["3.1", "3.6"],
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
      casuisticas: [
        {
          enunciado:
            "La entidad ya entregó el terreno y la actualización del expediente técnico, pero aún no comunicó quién supervisará la obra. ¿Corre el plazo de ejecución?",
          resolucion:
            "No. El plazo de ejecución de la obra empieza solo cuando la entidad cumple todas las condiciones: actualización del expediente técnico, comunicación del supervisor, entrega del adelanto directo solicitado, contrato tripartito de la JPRD si corresponde y, en solo construcción, entrega del terreno.",
          baseLegal: [{ norma: "Reglamento", articulo: "176" }],
        },
        {
          enunciado:
            "El contratista solicitó adelanto directo y lo garantizó con fideicomiso. La entidad quiere retener el inicio del plazo hasta entregarlo. ¿Puede?",
          resolucion:
            "La entrega del adelanto directo es condición de inicio del plazo, pero esa condición no aplica cuando el adelanto se garantiza mediante fideicomiso.",
          baseLegal: [{ norma: "Reglamento", articulo: "176" }],
        },
        {
          enunciado:
            "En una obra por diseño y construcción ya se aprobó el expediente técnico. ¿Cuándo inicia la ejecución del componente obra?",
          resolucion:
            "La entidad pone el terreno a disposición del contratista durante la elaboración del diseño, y en un plazo máximo de veinte días computados desde el día siguiente de la aprobación del expediente técnico se inicia la ejecución del componente obra, notificando la aprobación y entregando el terreno.",
          baseLegal: [{ norma: "Reglamento", articulo: "176" }],
        },
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
    temas: ["3.10"],
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
      casuisticas: [
        {
          enunciado:
            "El contratista de una obra incumple de modo que, a juicio de la entidad, ya no podrá terminarla. ¿Qué medida cabe además de resolver el contrato?",
          resolucion:
            "La intervención económica de la obra, de oficio o a solicitud de parte: una medida técnica y económica para culminar la obra sin resolver el contrato.",
          baseLegal: [{ norma: "Reglamento", articulo: "208" }],
        },
        {
          enunciado:
            "Notificada la intervención económica, el contratista la rechaza. ¿Qué pasa?",
          resolucion:
            "El contrato se resuelve por incumplimiento.",
          baseLegal: [{ norma: "Reglamento", articulo: "208" }],
        },
        {
          enunciado:
            "La intervención se originó en incumplimientos del contratista. ¿Puede este reclamar mayores gastos generales o indemnización?",
          resolucion:
            "No. Cuando la intervención se debe a su incumplimiento, el contratista pierde el derecho a mayores gastos generales, indemnización o similares, sin quedar fuera del contrato ni de sus obligaciones.",
          baseLegal: [{ norma: "Reglamento", articulo: "208" }],
        },
      ],
      baseLegal: [{ norma: "Reglamento", articulo: "208" }],
      verificada: true,
    },
  },
  {
    slug: "suspension-reprogramacion-obra",
    modulo: "XXII",
    temas: ["3.10"],
    titulo: "Suspensión, reprogramación y control de la obra",
    descripcion:
      "Cómo se suspende el plazo de ejecución de una obra (incluido el impago de valorizaciones), cómo se reprograma la obra atrasada y qué mide el supervisor para exigir un programa acelerado.",
    minutos: 11,
    contenido: {
      resumen: [
        {
          pregunta: "¿Cómo se suspende el plazo de ejecución de la obra?",
          parrafos: [
            "Por eventos no atribuibles a las partes que interrumpen la ejecución, las partes acuerdan por escrito la " +
              "suspensión hasta que culmine el evento, sin reconocimiento de mayores gastos generales ni costos directos, " +
              "salvo los necesarios para viabilizar la suspensión (Reglamento, Arts. 107.1 y 202.1).",
            "Culminado el evento, las partes suscriben un acta con la fecha de reinicio; si no hay acuerdo, la fecha la " +
              "determina la entidad (Art. 107.2). La suspensión por causa imputable a la entidad requiere autorización " +
              "previa de la autoridad de la gestión administrativa (Art. 107.5). Durante la suspensión no se ejecutan " +
              "actividades del alcance del contrato, pero sí trámites de gestión como adicionales o valorizaciones " +
              "pendientes (Art. 107.4). Reiniciado el plazo, la entidad comunica al contratista la modificación de las " +
              "fechas del programa de ejecución actualizado (Art. 202.2).",
          ],
        },
        {
          pregunta: "¿Qué pasa si la entidad no paga las valorizaciones?",
          parrafos: [
            "La falta de pago de dos valorizaciones consecutivas suspende el plazo: el contratista requiere el pago de al " +
              "menos una valorización pendiente en un plazo no mayor de diez días y, vencido ese plazo, el residente " +
              "anota la suspensión en el cuaderno de incidencias, que inicia desde el día siguiente de la anotación. En " +
              "ese caso la entidad reconoce los costos directos y mayores gastos generales vinculados y acreditados " +
              "(Reglamento, Art. 202.3).",
          ],
        },
        {
          pregunta: "¿Cuándo se amplía el plazo de una obra?",
          parrafos: [
            "Solo por causales que modifiquen la ruta crítica del programa de ejecución vigente: atrasos o paralizaciones " +
              "no imputables al contratista, la necesidad de plazo para ejecutar un adicional o los mayores metrados en " +
              "contratos a precios unitarios o costo reembolsable (Reglamento, Art. 198.1).",
            "El contratista notifica su solicitud en no más de diez días hábiles desde el hecho generador, con prórroga " +
              "posible de hasta diez más; la supervisión opina en cinco días hábiles y la entidad resuelve en diez días " +
              "hábiles. Si la entidad calla, se tiene por aprobado lo informado por el supervisor y, si este tampoco se " +
              "pronunció, lo solicitado por el contratista (Art. 200.1).",
          ],
        },
        {
          pregunta: "¿Cuándo obliga el nuevo programa acelerado?",
          parrafos: [
            "Cuando en una valorización el supervisor verifica retraso injustificado: valorización acumulada ejecutada " +
              "menor al 80 % de la programada o atraso en la ruta crítica. Entonces ordena un nuevo programa de " +
              "ejecución acelerado y un calendario de avance valorizado acelerado, anotándolo en el cuaderno de " +
              "incidencias (Reglamento, Art. 207.1).",
            "El contratista los presenta en siete días, el supervisor se pronuncia en cinco y la entidad puede " +
              "observarlos en siete días hábiles; de lo contrario se consideran aprobados. No presentarlos puede activar " +
              "la intervención económica o la resolución del contrato, sin apercibimiento (Arts. 207.2 y 207.5).",
          ],
        },
        {
          pregunta: "¿Qué pasa con la garantía al recibir la obra y con el personal clave?",
          parrafos: [
            "Recibida la obra y deducidas las penalidades de ese hito, el contratista puede pedir reducir la garantía de " +
              "fiel cumplimiento al equivalente del 5 % del monto vigente, manteniendo un mecanismo de garantía por ese " +
              "5 % (Reglamento, Art. 183.2).",
            "La sustitución permanente de personal clave se solicita diez días hábiles antes de que opere, con " +
              "reemplazante de perfil igual o mayor; si la entidad no se pronuncia, se considera autorizada, y hay " +
              "penalidad si se sustituye al mismo integrante por segunda vez (Art. 189.3).",
          ],
        },
      ],
      puntosClave: [
        "Suspensión: acuerdo escrito por eventos no atribuibles; si la causa es de la entidad, autorización previa de la AGA.",
        "Dos valorizaciones impagas consecutivas: requerimiento de pago en 10 días, anotación del residente y suspensión al día siguiente.",
        "Ampliación de plazo en obra: solo causales que muevan la ruta crítica; silencio de la entidad = aprobado.",
        "Atraso (menos del 80 % valorizado o ruta crítica): programa acelerado en 7 días; no presentarlo habilita intervención económica o resolución.",
        "Tras la recepción, la garantía se puede reducir al 5 % del monto vigente; personal clave: aviso de 10 días hábiles y silencio que autoriza.",
      ],
      casuisticas: [
        {
          enunciado:
            "La entidad lleva dos valorizaciones consecutivas sin pagar. ¿Qué debe hacer el contratista para suspender el plazo?",
          resolucion:
            "Requerir el pago de al menos una valorización pendiente otorgando un plazo no mayor de diez días; vencido ese plazo, el residente anota la suspensión en el cuaderno de incidencias y el plazo se suspende desde el día siguiente de la anotación, con reconocimiento de los costos vinculados y acreditados.",
          baseLegal: [{ norma: "Reglamento", articulo: "202" }],
        },
        {
          enunciado:
            "La valorización acumulada ejecutada llegó al 70 % de la programada. ¿Qué puede ordenar el supervisor?",
          resolucion:
            "Un nuevo programa de ejecución acelerado y un calendario de avance valorizado acelerado, por el retraso injustificado (menos del 80 %): el contratista los presenta en siete días, el supervisor opina en cinco y la entidad puede observar en siete días hábiles, caso contrario se aprueban.",
          baseLegal: [{ norma: "Reglamento", articulo: "207" }],
        },
        {
          enunciado:
            "El contratista pide ampliación de plazo por un atraso que no toca la ruta crítica del programa vigente. ¿Procede?",
          resolucion:
            "No. En obras, las causales de ampliación de plazo deben modificar la ruta crítica del programa de ejecución vigente al momento de la solicitud.",
          baseLegal: [{ norma: "Reglamento", articulo: "198" }],
        },
        {
          enunciado:
            "El supervisor ordenó presentar un nuevo programa de ejecución acelerado y el contratista lo entregó dentro de los siete días. Pasan siete días hábiles sin que la entidad observe nada. ¿Qué estado tiene el programa?",
          resolucion:
            "Se considera aprobado: el contratista presenta los documentos en siete días, el supervisor remite su pronunciamiento en cinco y la entidad puede observarlos dentro de siete días hábiles siguientes; sin observación, el nuevo programa y su calendario quedan aprobados.",
          baseLegal: [{ norma: "Reglamento", articulo: "207" }],
        },
      ],
      baseLegal: [
        { norma: "Reglamento", articulo: "107" },
        { norma: "Reglamento", articulo: "175" },
        { norma: "Reglamento", articulo: "183" },
        { norma: "Reglamento", articulo: "189" },
        { norma: "Reglamento", articulo: "198" },
        { norma: "Reglamento", articulo: "200" },
        { norma: "Reglamento", articulo: "202" },
        { norma: "Reglamento", articulo: "207" },
      ],
      verificada: true,
    },
  },
];
