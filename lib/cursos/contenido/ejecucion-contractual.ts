import type { Clase } from "../tipos";

// Contenido verificado contra el corpus del RAG (ver la cabecera de actos-preparatorios.ts).

export const EJECUCION_CONTRACTUAL: Clase[] = [
  {
    slug: "perfeccionamiento-contrato",
    modulo: "XII",
    temas: ["2.9", "2.10"],
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
      casuisticas: [
        {
          enunciado:
            "La buena pro de una licitación pública abreviada de bienes quedó consentida y las bases no exigen garantía de fiel cumplimiento. ¿Cuántos días hábiles tiene el postor para presentar sus requisitos?",
          resolucion:
            "Cinco días hábiles. El plazo general es de ocho, pero baja a cinco cuando no se exige garantía de fiel cumplimiento.",
          baseLegal: [{ norma: "Reglamento", articulo: "90" }],
        },
        {
          enunciado:
            "Una compra por comparación de precios debe ejecutarse dentro del año fiscal y las bases prevén el perfeccionamiento con orden de compra. ¿Hace falta suscribir contrato?",
          resolucion:
            "No. En los procedimientos que el Reglamento permite (licitaciones públicas abreviadas para bienes, concursos públicos abreviados y comparación de precios), si las bases lo prevén y la ejecución no supera el año fiscal, el contrato se perfecciona con la recepción de la orden de compra o de servicio.",
          baseLegal: [{ norma: "Reglamento", articulo: "87" }],
        },
        {
          enunciado:
            "El postor ganador tiene multas impagas de otro contrato. ¿Se le suspende la suscripción?",
          resolucion:
            "No: antes de suscribir se incorpora una cláusula de compromiso de pago de las multas, que se cumple mediante retención.",
          baseLegal: [{ norma: "Ley 32069", articulo: "58" }],
        },
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
    temas: ["3.3"],
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
      casuisticas: [
        {
          enunciado:
            "Un contrato de servicios por S/ 800 000 está por suscribirse. ¿De cuánto es la garantía de fiel cumplimiento?",
          resolucion:
            "De S/ 80 000: el 10 % del monto del contrato original, requisito indispensable para perfeccionar el contrato.",
          baseLegal: [{ norma: "Reglamento", articulo: "113" }],
        },
        {
          enunciado:
            "Un contratista pide el adelanto de pago y ofrece garantizarlo con retención del propio pago. ¿Se acepta?",
          resolucion:
            "No. La retención de pago sirve para el fiel cumplimiento y las prestaciones accesorias, pero no para garantizar el adelanto; para el adelanto proceden fideicomiso, carta fianza financiera o contrato de seguro.",
          baseLegal: [{ norma: "Ley 32069", articulo: "61" }],
        },
        {
          enunciado:
            "Un contrato de suministro de 60 días calendario propone garantía de fiel cumplimiento por fideicomiso. ¿Procede?",
          resolucion:
            "No. En bienes y servicios, el fideicomiso como garantía de fiel cumplimiento solo procede si el plazo de ejecución supera noventa días calendario.",
          baseLegal: [{ norma: "Reglamento", articulo: "138" }],
        },
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
    temas: ["3.2"],
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
      casuisticas: [
        {
          enunciado:
            "Un contrato de servicios de S/ 1 000 000 necesita una prestación adicional de S/ 260 000 indispensable para la finalidad. ¿Puede aprobarse?",
          resolucion:
            "No. En bienes, servicios y consultorías de obras la autoridad de la gestión administrativa solo puede autorizar adicionales hasta el 25 % del monto del contrato original: S/ 250 000 en este caso.",
          baseLegal: [{ norma: "Ley 32069", articulo: "64" }],
        },
        {
          enunciado:
            "En una obra bajo solo construcción ya se aprobaron adicionales por 12 % del contrato original (menos los deductivos vinculados) y ahora se pide llegar al 20 %. ¿Quién autoriza? ¿Y si se pidiera llegar al 35 %?",
          resolucion:
            "Hasta el 15 % autoriza la autoridad de la gestión administrativa; por encima del 15 % y hasta el 30 %, el titular, si cuenta con los recursos. Para pasar del 30 % hasta el 50 % se requiere además la autorización previa de la Contraloría; y en conjunto los adicionales no pueden superar el 50 % del contrato original, porque de lo contrario el contrato se resuelve.",
          baseLegal: [
            { norma: "Ley 32069", articulo: "64" },
            { norma: "Reglamento", articulo: "194" },
          ],
        },
        {
          enunciado:
            "La entidad ya recibió parte de los bienes y quiere reducir el contrato en 20 %. ¿Cómo se formaliza la reducción?",
          resolucion:
            "Con resolución de la autoridad de la gestión administrativa, hasta el 25 % del monto del contrato original, siempre que las prestaciones por reducir no hayan sido ejecutadas y sean cuantificables y divisibles. No se suscribe adenda: basta publicar la resolución en la Pladicop.",
          baseLegal: [
            { norma: "Ley 32069", articulo: "64" },
            { norma: "Reglamento", articulo: "109" },
          ],
        },
      ],
      baseLegal: [
        { norma: "Ley 32069", articulo: "63" },
        { norma: "Ley 32069", articulo: "64" },
        { norma: "Reglamento", articulo: "109" },
        { norma: "Reglamento", articulo: "194" },
      ],
      verificada: true,
    },
  },
  {
    slug: "resolucion-nulidad-contrato",
    modulo: "XVI",
    temas: ["3.3"],
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
      casuisticas: [
        {
          enunciado:
            "Un contrato de 200 días tiene un ítem incumplido cuyo plazo venció a los 100 días. ¿Entre cuántos días debe fijarse el requerimiento previo de subsanación? ¿Y si el cálculo da 12,5 días?",
          resolucion:
            "El plazo no puede ser menor al 10 % ni mayor al 15 % del plazo del ítem incumplido: aquí, entre 10 y 15 días. Si el cálculo da decimal, se redondea a favor del contratista.",
          baseLegal: [{ norma: "Reglamento", articulo: "122" }],
        },
        {
          enunciado:
            "Una entidad suscribió el contrato mientras aún estaba en trámite un recurso de apelación. ¿El contrato es válido?",
          resolucion:
            "Es causal de nulidad del contrato, que declara la autoridad de la gestión administrativa. Suscribir con una apelación en trámite está entre los supuestos de nulidad.",
          baseLegal: [
            { norma: "Ley 32069", articulo: "71" },
            { norma: "Reglamento", articulo: "19" },
          ],
        },
        {
          enunciado:
            "Se descubrió documentación falsa: en un caso sustentó la buena pro; en el otro, solo la ejecución del contrato. ¿Es lo mismo?",
          resolucion:
            "No. La documentación falsa o inexacta presentada en la ejecución es causal de resolución del contrato; la que sustentó el otorgamiento de la buena pro es causal de nulidad.",
          baseLegal: [
            { norma: "Ley 32069", articulo: "68" },
            { norma: "Ley 32069", articulo: "71" },
          ],
        },
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
    temas: ["3.5"],
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
      casuisticas: [
        {
          enunciado:
            "En un contrato de obras con JPRD, una parte pide que la junta declare la nulidad del contrato. ¿Puede conocerla?",
          resolucion:
            "No. La JPRD absuelve consultas y resuelve controversias técnicas y contractuales, pero no puede conocer la validez, la nulidad ni la eficacia del contrato.",
          baseLegal: [{ norma: "Ley 32069", articulo: "79" }],
        },
        {
          enunciado:
            "Las partes de un contrato de obras quieren someter a conciliación la nulidad del contrato. ¿Se puede?",
          resolucion:
            "No. La nulidad del contrato no es materia conciliable; las controversias sobre validez, nulidad o eficacia se resuelven por arbitraje.",
          baseLegal: [{ norma: "Ley 32069", articulo: "81" }],
        },
        {
          enunciado:
            "¿Dónde debe constar el convenio arbitral de un contrato de la Ley 32069?",
          resolucion:
            "En el contrato: el convenio arbitral es una cláusula del contrato, y el arbitraje resuelve por defecto las controversias de validez, nulidad, interpretación, ejecución, terminación o eficacia.",
          baseLegal: [{ norma: "Ley 32069", articulo: "83" }],
        },
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
  {
    slug: "modificaciones-procedimiento",
    modulo: "XX",
    temas: ["3.2"],
    titulo: "Modificaciones en bienes y servicios: trámite",
    descripcion:
      "Cómo se tramitan de verdad los adicionales, las reducciones y las ampliaciones de plazo en bienes y servicios: quién resuelve, en cuántos días y qué pasa si la entidad calla.",
    minutos: 9,
    contenido: {
      resumen: [
        {
          pregunta: "¿Cómo se aprueba una prestación adicional en bienes y servicios?",
          parrafos: [
            "La autoridad de la gestión administrativa la aprueba mediante resolución publicada en la Pladicop, hasta el " +
              "25 % del monto del contrato original, con sustento técnico y legal previo y con la certificación o " +
              "previsión presupuestaria (Reglamento, Art. 141.1).",
            "El costo se determina con las especificaciones o términos de referencia y los precios pactados; a falta de " +
              "estos, la DEC, con el área usuaria, determina el monto considerando la estructura de costos presentada por " +
              "el contratista (Art. 141.2).",
            "No se suscribe adenda: basta la publicación de la resolución en la Pladicop, y está prohibido aprobar " +
              "adicionales en vía de regularización (Art. 141.3).",
          ],
        },
        {
          pregunta: "¿Y una reducción de prestaciones?",
          parrafos: [
            "La autoridad de la gestión administrativa la ordena mediante resolución, hasta el 25 % del monto del contrato " +
              "original, siempre que la falta de esas prestaciones no impida la finalidad, que sean divisibles y " +
              "cuantificables, que no estén ejecutadas y que se apruebe antes de la conformidad final o del acta de " +
              "recepción; en obras, con opinión del supervisor (Reglamento, Art. 109.1).",
            "En la misma resolución se determina si reduce el plazo. No se suscribe adenda: basta publicar la resolución " +
              "en la Pladicop (Arts. 109.2 y 109.3).",
          ],
        },
        {
          pregunta: "¿Cómo se tramita una ampliación de plazo?",
          parrafos: [
            "El contratista la solicita dentro de los diez días hábiles siguientes a la notificación del adicional o de " +
              "finalizado el atraso o paralización no imputable, y puede pedir dentro de ese plazo una prórroga de hasta " +
              "diez días hábiles más; las solicitudes extemporáneas se tienen por no presentadas (Reglamento, Art. 142.3).",
            "La autoridad de la gestión administrativa resuelve y notifica por la Pladicop dentro de los doce días " +
              "hábiles; si no se pronuncia, la ampliación se tiene por aprobada, salvo que el contratista no haya " +
              "cumplido el procedimiento (Art. 142.5). Las ampliaciones dan lugar al pago de costos y gastos generales " +
              "acreditados (Art. 142.7).",
          ],
        },
        {
          pregunta: "¿Cuándo se puede ceder la posición contractual?",
          parrafos: [
            "El contratista solo la cede en casos de transferencia de bienes arrendados a la entidad, fusiones, escisiones " +
              "o norma expresa que lo permita (Reglamento, Art. 112.1). Entre entidades, con sustento de la DEC, por " +
              "traslado de funciones, extinción, fusión o absorción, desaparición de la necesidad acreditada por la " +
              "cesionaria en su CMN, o norma expresa (Art. 112.2).",
          ],
        },
      ],
      puntosClave: [
        "Adicional de bienes y servicios: resolución de la AGA publicada en Pladicop, hasta 25 %, sin adenda y sin regularización.",
        "Reducción: resolución de la AGA hasta 25 %, prestaciones divisibles y no ejecutadas, antes de la conformidad final.",
        "Ampliación de plazo: solicitud en 10 días hábiles + prórroga de 10; la AGA resuelve en 12 y el silencio la aprueba.",
        "Cesión de posición contractual: solo en los casos cerrados del artículo 112 del Reglamento.",
      ],
      casuisticas: [
        {
          enunciado:
            "Se aprobó un adicional de servicios y el contratista pide suscribir la adenda correspondiente. ¿Corresponde?",
          resolucion:
            "No. En bienes y servicios no se suscribe adenda por la aprobación de un adicional: basta con la publicación de la resolución en la Pladicop para que surta efectos.",
          baseLegal: [{ norma: "Reglamento", articulo: "141" }],
        },
        {
          enunciado:
            "El hecho generador del atraso terminó el lunes y el contratista recién presenta su solicitud de ampliación de plazo 15 días hábiles después, sin haber pedido prórroga. ¿Qué sigue?",
          resolucion:
            "La solicitud se tiene por no presentada: el plazo era de diez días hábiles, ampliables por prórroga de hasta diez más solo si se pidió dentro del plazo original.",
          baseLegal: [{ norma: "Reglamento", articulo: "142" }],
        },
        {
          enunciado:
            "Presentada la solicitud de ampliación de plazo, la autoridad de la gestión administrativa no resuelve ni notifica dentro del plazo. ¿Se perdió la ampliación?",
          resolucion:
            "No: si no hay pronunciamiento en los doce días hábiles, la ampliación se tiene por aprobada, salvo que el contratista no haya cumplido estrictamente el procedimiento de presentación.",
          baseLegal: [{ norma: "Reglamento", articulo: "142" }],
        },
        {
          enunciado:
            "Dos ministerios se fusionan y el que tenía los contratos de mantenimiento quiere ceder su posición contractual al que asume las funciones. ¿Basta un acuerdo entre ellos?",
          resolucion:
            "No basta el acuerdo: la cesión de posición contractual entre entidades procede solo en los casos del artículo 112.2 del Reglamento —traslado de funciones, extinción, fusión o absorción— y requiere el sustento técnico legal previo de la DEC; cuando la causal es la desaparición de la necesidad, la cesionaria además acredita esa necesidad programada en su CMN.",
          baseLegal: [{ norma: "Reglamento", articulo: "112" }],
        },
      ],
      baseLegal: [
        { norma: "Ley 32069", articulo: "64" },
        { norma: "Reglamento", articulo: "109" },
        { norma: "Reglamento", articulo: "112" },
        { norma: "Reglamento", articulo: "141" },
        { norma: "Reglamento", articulo: "142" },
      ],
      verificada: true,
    },
  },
  {
    slug: "adelantos-penalidades-subcontratacion",
    modulo: "XXI",
    temas: ["3.9", "3.3"],
    titulo: "Adelantos, penalidades y subcontratación",
    descripcion:
      "Los topes de los adelantos y cómo se amortizan, el límite del 10 % de las penalidades y las reglas de la subcontratación, incluida la respuesta del silencio de la entidad.",
    minutos: 10,
    contenido: {
      resumen: [
        {
          pregunta: "¿Cuánto se puede adelantar en una obra?",
          parrafos: [
            "En obras bajo solo construcción, el adelanto directo y el adelanto para materiales e insumos, equipamiento y " +
              "mobiliario no exceden, respectivamente, el 10 % y el 20 % del monto del contrato original; el adelanto por " +
              "avance no excede el 10 % del monto del contrato original (Reglamento, Art. 178.3).",
            "En consultoría de obras solo proceden los adelantos directos y no procede garantizarlos con fideicomiso " +
              "(Art. 178.2).",
          ],
        },
        {
          pregunta: "¿Cómo se amortizan?",
          parrafos: [
            "El adelanto directo se amortiza con descuentos proporcionales en cada una de las valorizaciones o pagos " +
              "(Reglamento, Art. 180.1). El de materiales se amortiza conforme a la directiva de la DGA sobre fórmulas " +
              "polinómicas, aceptándose la amortización total salvo que el saldo pendiente supere el monto de la " +
              "valorización (Art. 180.2). Cualquier diferencia de una valorización se toma en cuenta en la posterior o en " +
              "la liquidación (Art. 180.4).",
          ],
        },
        {
          pregunta: "¿Hasta dónde llegan las penalidades?",
          parrafos: [
            "La suma de la penalidad por mora y de las demás penalidades no puede exceder el 10 % del monto vigente del " +
              "contrato o del ítem correspondiente. Se deducen de los pagos a cuenta o parciales, del pago o liquidación " +
              "final, o de la ejecución de la garantía de fiel cumplimiento (Reglamento, Art. 119).",
          ],
        },
        {
          pregunta: "¿Qué se puede subcontratar?",
          parrafos: [
            "Hasta el 40 % del monto del contrato vigente de bienes, servicios u obras. En bienes y servicios, las bases " +
              "pueden excluir prestaciones esenciales o prohibir la subcontratación si así se evaluó en la estrategia " +
              "(Reglamento, Art. 108.1).",
            "La solicitud contiene el alcance y el RNP vigente del subcontratista, y la entidad resuelve en cinco días " +
              "hábiles; si no se pronuncia, se entiende denegada (Arts. 108.2 y 108.3). No cabe subcontratar a los " +
              "evaluadores expertos o especialistas técnicos de los contratos estandarizados (Art. 108.4).",
          ],
        },
      ],
      puntosClave: [
        "Solo construcción: adelanto directo 10 %, materiales 20 %, por avance 10 %, siempre del contrato original.",
        "Consultoría de obras: solo adelantos directos, nunca fideicomiso por adelanto.",
        "Penalidades (mora + otras): tope conjunto del 10 % del monto vigente del contrato o del ítem.",
        "Subcontratación: máximo 40 % del monto del contrato vigente; el silencio de la entidad la deniega.",
      ],
      casuisticas: [
        {
          enunciado:
            "Un contrato de obra de S/ 2 000 000 propone adelanto directo de 12 % y adelanto para materiales de 20 %. ¿Es viable?",
          resolucion:
            "El adelanto para materiales sí (20 % del contrato original); el directo no: el tope es 10 %, es decir S/ 200 000.",
          baseLegal: [{ norma: "Reglamento", articulo: "178" }],
        },
        {
          enunciado:
            "El contratista pidió subcontratar parte del mantenimiento y la entidad no respondió en cinco días hábiles. ¿Puede empezar a subcontratar?",
          resolucion:
            "No. La entidad aprueba o deniega en cinco días hábiles y, si calla, la solicitud se entiende denegada.",
          baseLegal: [{ norma: "Reglamento", articulo: "108" }],
        },
        {
          enunciado:
            "En un contrato, la mora acumulada suma 8 % del monto vigente y otras penalidades llegan a 4 %. ¿Se pueden aplicar todas?",
          resolucion:
            "No juntas: la suma de la mora y las demás penalidades no puede exceder el 10 % del monto vigente del contrato o del ítem. Las penalidades se cobran de los pagos o de la garantía.",
          baseLegal: [{ norma: "Reglamento", articulo: "119" }],
        },
      ],
      baseLegal: [
        { norma: "Reglamento", articulo: "108" },
        { norma: "Reglamento", articulo: "119" },
        { norma: "Reglamento", articulo: "178" },
        { norma: "Reglamento", articulo: "180" },
      ],
      verificada: true,
    },
  },
  {
    slug: "contratos-estandarizados-internacionales",
    modulo: "XXIII",
    temas: ["3.12"],
    titulo: "Contratos estandarizados de uso internacional",
    descripcion:
      "Qué marco rige la selección y la ejecución de los contratos estandarizados de ingeniería y construcción de uso internacional, sus topes de modificación y sus cláusulas clave.",
    minutos: 8,
    contenido: {
      resumen: [
        {
          pregunta: "¿Qué norma los rige?",
          parrafos: [
            "Las contrataciones que usan contratos estandarizados de ingeniería y construcción de uso internacional se " +
              "rigen por sus propios contratos: las modificaciones que inciden en el monto contractual no pueden exceder " +
              "el 50 % del valor del presupuesto de obra consignado en el expediente técnico aprobado o, en solo " +
              "construcción, del monto del contrato de obra (Ley, Art. 64.7; Reglamento, Art. 221.2.d). Si el 50 % se " +
              "supera, se configura la terminación anticipada que ocasiona la resolución del contrato; el porcentaje no " +
              "comprende las modificaciones que afecten el plazo.",
          ],
        },
        {
          pregunta: "¿Qué cláusulas debe traer la proforma?",
          parrafos: [
            "Las bases incluyen la proforma del contrato adaptada por la DEC y el área usuaria (Reglamento, Art. 221.1). " +
              "Entre otras: comunicación honesta y colaboración entre las partes (Art. 221.2.a); responsabilidad única " +
              "del contratista por sus terceros, incluido el plantel técnico (221.2.b); caso fortuito y vicios ocultos " +
              "conforme a los artículos 1315 y 1326 del Código Civil (221.2.c); informe previo de la oficina de " +
              "presupuesto cuando la modificación supere el 30 % (221.2.e); suspensión o resolución si no hay presupuesto " +
              "(221.2.f); y en diseño y construcción, no aprobar modificaciones por deficiencias del expediente técnico " +
              "imputables al propio contratista (221.2.g).",
          ],
        },
        {
          pregunta: "¿Qué particularidad tiene el diseño y construcción?",
          parrafos: [
            "El expediente técnico puede aprobarse con un presupuesto de obra incrementado hasta en 50 % del monto del " +
              "componente considerado en el contrato original, con certificación presupuestal; eso no califica como " +
              "prestación adicional. El contrato contempla la terminación anticipada por pérdida sobreviniente de " +
              "viabilidad del proyecto o por motivos presupuestales (Reglamento, Art. 175).",
          ],
        },
        {
          pregunta: "¿Qué restricciones tienen?",
          parrafos: [
            "No cabe subcontratar a los evaluadores expertos o especialistas técnicos de estos contratos (Reglamento, " +
              "Art. 108.4), y las prestaciones adicionales de tecnologías sanitarias del MDA están exceptuadas de los " +
              "límites generales y se sujetan a sus contratos (Ley, Art. 64.8).",
          ],
        },
      ],
      puntosClave: [
        "Se rigen por sus propios contratos; las modificaciones de monto no pasan del 50 % del presupuesto de obra del ETO (o del contrato original en solo construcción).",
        "Superar el 50 % configura terminación anticipada que resuelve el contrato; las modificaciones de plazo no computan en el tope.",
        "Diseño y construcción: presupuesto aprobable hasta +50 % del componente; no es adicional.",
        "Ni subcontratación de evaluadores expertos ni límites para las tecnologías sanitarias del MDA.",
      ],
      casuisticas: [
        {
          enunciado:
            "En un contrato estandarizado de uso internacional quieren aprobar modificaciones de monto por el 55 % del presupuesto de obra del expediente técnico. ¿Se puede?",
          resolucion:
            "No. El tope es el 50 %; superarlo configura la condición de terminación anticipada que ocasiona la resolución del contrato. Las modificaciones que afectan el plazo no computan en ese porcentaje.",
          baseLegal: [
            { norma: "Ley 32069", articulo: "64" },
            { norma: "Reglamento", articulo: "221" },
          ],
        },
        {
          enunciado:
            "En una obra por diseño y construcción, el error que motiva la modificación proviene del expediente técnico que elaboró el propio contratista. ¿Se aprueba?",
          resolucion:
            "No. En los sistemas donde el contratista elabora el expediente técnico, no se pueden aprobar modificaciones de monto que sean consecuencia de deficiencias o errores del expediente que le sean imputables.",
          baseLegal: [{ norma: "Reglamento", articulo: "221" }],
        },
        {
          enunciado:
            "El contratista de un contrato estandarizado quiere subcontratar al especialista técnico evaluador. ¿Cabe?",
          resolucion:
            "No. La subcontratación no procede para los evaluadores expertos o especialistas técnicos de los contratos estandarizados de ingeniería y construcción de uso internacional.",
          baseLegal: [{ norma: "Reglamento", articulo: "108" }],
        },
      ],
      baseLegal: [
        { norma: "Ley 32069", articulo: "64" },
        { norma: "Reglamento", articulo: "108" },
        { norma: "Reglamento", articulo: "175" },
        { norma: "Reglamento", articulo: "221" },
      ],
      verificada: true,
    },
  },
];
