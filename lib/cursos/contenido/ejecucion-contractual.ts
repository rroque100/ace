import type { Clase } from "../tipos";

// Contenido verificado contra el corpus del RAG (ver la cabecera de actos-preparatorios.ts).

export const EJECUCION_CONTRACTUAL: Clase[] = [
  {
    slug: "perfeccionamiento-contrato",
    modulo: "XII",
    titulo: "Perfeccionamiento del contrato",
    descripcion:
      "Cuándo se perfecciona el contrato, cuándo basta una orden de compra o de servicio y los plazos para presentar " +
      "requisitos, subsanarlos y suscribir.",
    minutos: 8,
    contenido: {
      resumen: [
        {
          pregunta: "¿Cómo se perfecciona el contrato?",
          parrafos: [
            "Con la suscripción del documento que lo contiene. En licitaciones públicas abreviadas para bienes, concursos " +
              "públicos abreviados y comparación de precios puede perfeccionarse con la recepción de la orden de compra o " +
              "de servicio, si así lo prevén las bases y la ejecución no supera el año fiscal (Reglamento, Art. 87).",
            "Si el proveedor tiene multas impagas, antes de suscribir se incorpora una cláusula de compromiso de pago que " +
              "se cumple mediante retención (Ley, Art. 58).",
          ],
        },
        {
          pregunta: "¿Qué plazos tiene el postor ganador?",
          parrafos: [
            "Ocho días hábiles para presentar los requisitos, desde el día siguiente al registro del consentimiento de la " +
              "buena pro en la Pladicop o desde que quedó administrativamente firme. Si no se exige garantía de fiel " +
              "cumplimiento, el plazo es de cinco días hábiles (Reglamento, Art. 90).",
          ],
        },
        {
          pregunta: "¿Y la entidad?",
          parrafos: [
            "En no más de tres días hábiles desde la presentación de los requisitos perfecciona el contrato o, en el mismo " +
              "plazo, notifica observaciones y otorga hasta cuatro días hábiles para subsanar. Si la garantía de fiel " +
              "cumplimiento está en trámite, a pedido expreso del postor, la DEC puede dar hasta cuatro días hábiles " +
              "adicionales (Reglamento, Art. 90).",
          ],
        },
      ],
      puntosClave: [
        "Regla: suscripción del contrato. Excepción: orden de compra o de servicio si las bases lo prevén y no pasa del año fiscal.",
        "Requisitos: ocho días hábiles (cinco si no hay garantía de fiel cumplimiento).",
        "La entidad perfecciona u observa en no más de tres días hábiles; subsanación de hasta cuatro.",
        "Multas impagas del proveedor: cláusula de compromiso de pago por retención.",
      ],
      baseLegal: [
        { norma: "Ley 32069", articulo: "58" },
        { norma: "Reglamento", articulo: "87" },
        { norma: "Reglamento", articulo: "90" },
      ],
      verificada: true,
    },
  },
  {
    slug: "garantias",
    modulo: "XIV",
    titulo: "Garantías",
    descripcion:
      "Qué cubren las garantías, los cuatro mecanismos que admite la Ley, el monto de la garantía de fiel cumplimiento y " +
      "las reglas propias de bienes y servicios.",
    minutos: 8,
    contenido: {
      resumen: [
        {
          pregunta: "¿Qué deben garantizar los contratistas?",
          parrafos: [
            "El adelanto de pago, el fiel cumplimiento del contrato y el fiel cumplimiento de las prestaciones accesorias " +
              "(Ley, Art. 61).",
          ],
        },
        {
          pregunta: "¿Con qué mecanismos?",
          parrafos: [
            "Fideicomiso, para el adelanto y el fiel cumplimiento; carta fianza financiera y contrato de seguro, para el " +
              "adelanto, el fiel cumplimiento y las prestaciones accesorias; y retención de pago, para el fiel cumplimiento " +
              "y las prestaciones accesorias (Ley, Art. 61).",
          ],
        },
        {
          pregunta: "¿Cuánto es la garantía de fiel cumplimiento?",
          parrafos: [
            "El 10 % del monto del contrato original. Es requisito indispensable para perfeccionar el contrato " +
              "(Reglamento, Art. 113).",
          ],
        },
        {
          pregunta: "¿Qué reglas especiales tienen los bienes y servicios?",
          parrafos: [
            "La garantía de fiel cumplimiento se mantiene vigente hasta la conformidad. En contratos de suministro, el " +
              "contratista puede pedir su reducción proporcional cuando tenga la conformidad de al menos la primera mitad " +
              "de los entregables sin retrasos ni penalidades. El fideicomiso como garantía de fiel cumplimiento solo " +
              "procede si el plazo de ejecución supera noventa días calendario (Reglamento, Art. 138).",
          ],
        },
      ],
      puntosClave: [
        "Cuatro mecanismos: fideicomiso, carta fianza financiera, contrato de seguro y retención de pago.",
        "La retención de pago no sirve para garantizar el adelanto.",
        "Fiel cumplimiento: 10 % del monto del contrato original.",
        "Bienes y servicios: la garantía rige hasta la conformidad; fideicomiso solo con más de 90 días calendario de plazo.",
      ],
      baseLegal: [
        { norma: "Ley 32069", articulo: "61" },
        { norma: "Reglamento", articulo: "113" },
        { norma: "Reglamento", articulo: "138" },
      ],
      verificada: true,
    },
  },
  {
    slug: "modificaciones-contrato",
    modulo: "XV",
    titulo: "Modificaciones al contrato",
    descripcion:
      "Quién puede modificar un contrato y por qué vías, el equilibrio económico financiero y los topes de las " +
      "prestaciones adicionales y reducciones.",
    minutos: 9,
    contenido: {
      resumen: [
        {
          pregunta: "¿Quién modifica el contrato y con qué límite?",
          parrafos: [
            "Puede modificarse por acuerdo de las partes, por disposición de la entidad o a solicitud del contratista, para " +
              "alcanzar la finalidad del contrato. La aprueba la autoridad de la gestión administrativa, salvo las " +
              "excepciones de la Ley y el Reglamento (Ley, Art. 63).",
            "La modificación no debe afectar el equilibrio económico financiero; si lo afecta, la parte beneficiada compensa " +
              "a la perjudicada.",
          ],
        },
        {
          pregunta: "¿Cuáles son los supuestos de modificación?",
          parrafos: [
            "Prestaciones adicionales, reducción de prestaciones, ampliaciones de plazo, hecho sobreviniente no imputable a " +
              "las partes y otros previstos en el Reglamento o en los contratos estandarizados de ingeniería y construcción " +
              "(Ley, Art. 63).",
          ],
        },
        {
          pregunta: "¿Hasta cuánto pueden ser los adicionales?",
          parrafos: [
            "En bienes, servicios y consultorías de obras, la autoridad de la gestión administrativa puede autorizar " +
              "adicionales hasta el 25 % del monto del contrato original, si son indispensables para la finalidad; y " +
              "reducir hasta el mismo porcentaje (Ley, Art. 64).",
            "En obras bajo solo construcción, hasta el 15 % del monto del contrato original, restando los deductivos " +
              "vinculados. Por encima del 15 % y hasta el 30 % los autoriza el titular de la entidad, si cuenta con los " +
              "recursos (Ley, Art. 64).",
          ],
        },
      ],
      puntosClave: [
        "Las modificaciones las aprueba la autoridad de la gestión administrativa, salvo excepciones.",
        "Si se rompe el equilibrio económico financiero, la parte beneficiada compensa.",
        "Bienes, servicios y consultorías de obras: adicionales y reducciones hasta 25 %.",
        "Obras (solo construcción): hasta 15 % la autoridad de la gestión administrativa; de 15 % a 30 %, el titular.",
      ],
      baseLegal: [
        { norma: "Ley 32069", articulo: "63" },
        { norma: "Ley 32069", articulo: "64" },
      ],
      verificada: true,
    },
  },
  {
    slug: "resolucion-nulidad-contrato",
    modulo: "XVI",
    titulo: "Resolución y nulidad de contrato",
    descripcion:
      "Las causales para resolver un contrato, el requerimiento previo por incumplimiento y los supuestos en que la " +
      "entidad puede declarar su nulidad.",
    minutos: 9,
    contenido: {
      resumen: [
        {
          pregunta: "¿Cuándo puede resolverse un contrato?",
          parrafos: [
            "Cualquiera de las partes puede resolverlo, total o parcialmente, por caso fortuito o fuerza mayor que impida " +
              "continuarlo, por incumplimiento atribuible a la otra parte, por hecho sobreviniente no imputable que impida " +
              "continuarlo, por incumplir la cláusula anticorrupción, por documentación falsa o inexacta en la ejecución o " +
              "por la condición de terminación anticipada pactada (Ley, Art. 68).",
            "Si la resolución es por causa imputable a una parte, esta resarce los daños y perjuicios acreditados.",
          ],
        },
        {
          pregunta: "¿Qué se hace antes de resolver por incumplimiento?",
          parrafos: [
            "La parte perjudicada requiere a la otra que cumpla, bajo apercibimiento de resolver. El plazo que otorga no " +
              "puede ser menor del 10 % ni mayor del 15 % del plazo del contrato, ítem o entregable incumplido; si sale " +
              "decimal, se redondea a favor del contratista (Reglamento, Art. 122).",
          ],
        },
        {
          pregunta: "¿Cuándo es nulo el contrato?",
          parrafos: [
            "La autoridad de la gestión administrativa puede declarar la nulidad, entre otros casos, cuando se suscribió con " +
              "un proveedor impedido, cuando se presentó documentación falsa o inexacta que sustentó la buena pro, cuando " +
              "se suscribió estando en trámite una apelación o cuando se prescindió del procedimiento competitivo que " +
              "correspondía (Ley, Art. 71; Reglamento, Art. 19).",
          ],
        },
      ],
      puntosClave: [
        "Seis causales de resolución en el artículo 68 de la Ley, para cualquiera de las partes.",
        "Requerimiento previo por incumplimiento: plazo entre el 10 % y el 15 % del plazo incumplido.",
        "La nulidad del contrato la declara la autoridad de la gestión administrativa.",
        "Firmar con una apelación en trámite es causal de nulidad.",
      ],
      baseLegal: [
        { norma: "Ley 32069", articulo: "68" },
        { norma: "Ley 32069", articulo: "71" },
        { norma: "Reglamento", articulo: "19" },
        { norma: "Reglamento", articulo: "122" },
      ],
      verificada: true,
    },
  },
  {
    slug: "resolucion-controversias",
    modulo: "XVIII",
    titulo: "Mecanismos de resolución de controversias",
    descripcion:
      "Junta de prevención y resolución de disputas, conciliación y arbitraje: qué resuelve cada mecanismo y qué " +
      "materias quedan fuera.",
    minutos: 9,
    contenido: {
      resumen: [
        {
          pregunta: "¿Qué mecanismos hay?",
          parrafos: [
            "Las controversias de la ejecución contractual se resuelven mediante la junta de prevención y resolución de " +
              "disputas (JPRD), la conciliación, el arbitraje y otros previstos en los contratos estandarizados de " +
              "ingeniería y construcción (Ley, Art. 76).",
            "Se aplican, en este orden obligatorio, la Constitución, la Ley y su Reglamento, las normas de derecho público y " +
              "las de derecho privado.",
          ],
        },
        {
          pregunta: "¿Qué hace la JPRD?",
          parrafos: [
            "Promueve prevenir o resolver controversias en contratos de suministro y de obras: absuelve consultas y resuelve " +
              "controversias técnicas y contractuales. Sus decisiones son obligatorias y de inmediato cumplimiento, pero no " +
              "puede conocer la validez, nulidad o eficacia del contrato (Ley, Art. 79).",
          ],
        },
        {
          pregunta: "¿Qué se concilia y qué se arbitra?",
          parrafos: [
            "La conciliación puede pactarse antes del arbitraje para materias como resolución del contrato, ampliación de " +
              "plazo, recepción y conformidad, valorizaciones o metrados y liquidación. La nulidad del contrato no es " +
              "conciliable. En los contratos menores la conciliación se pacta (Ley, Art. 81).",
            "Las controversias sobre validez, nulidad, interpretación, ejecución, terminación o eficacia del contrato se " +
              "resuelven por arbitraje, salvo previsión expresa en contrario. El convenio arbitral es una cláusula del " +
              "contrato (Ley, Art. 83).",
          ],
        },
      ],
      puntosClave: [
        "Mecanismos: JPRD, conciliación, arbitraje y los de contratos estandarizados.",
        "La JPRD no resuelve sobre validez, nulidad o eficacia del contrato.",
        "La nulidad del contrato no se concilia.",
        "El arbitraje es la vía general; el convenio arbitral va como cláusula del contrato.",
      ],
      baseLegal: [
        { norma: "Ley 32069", articulo: "76" },
        { norma: "Ley 32069", articulo: "79" },
        { norma: "Ley 32069", articulo: "81" },
        { norma: "Ley 32069", articulo: "83" },
      ],
      verificada: true,
    },
  },
];
