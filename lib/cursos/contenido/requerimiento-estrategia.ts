import type { Clase } from "../tipos";

// Clases de refuerzo del tema 1.2 del temario oficial («Requerimiento, estrategia y mercado»): el más pesado del
// examen (≈13 de 72 preguntas) y el que más pregunta el banco del simulador (65 preguntas; el Art. 44 aparece en 32).
// Hasta ahora lo cubría una sola clase introductoria (VI); estas tres desarrollan la capa del Reglamento que se evalúa.
//
// Verificado contra el corpus del RAG: Ley 32069 (texto al 19.07.2026) y Reglamento (texto al 09.01.2026). Donde el
// D.S. 001-2026-EF modificó un numeral se usa el texto modificado (51.1, 51.3, 52.1.b, 53.3 y el literal j del 46.1),
// que es el que evalúa el banco. Ojo: el 51.3 pasó de 3 a 6 días hábiles; no reintroduzcas el plazo anterior.

export const REQUERIMIENTO_ESTRATEGIA: Clase[] = [
  {
    slug: "requerimiento-contenido",
    modulo: "XXIV",
    temas: ["1.2"],
    titulo: "El requerimiento: contenido, límites y no objeción",
    descripcion:
      "Qué tiene que traer el requerimiento, qué riesgos y prestaciones accesorias se evalúan al elaborarlo, qué no " +
      "puede exigir y cómo lo modifica la DEC con la no objeción del área usuaria.",
    minutos: 11,
    contenido: {
      resumen: [
        {
          pregunta: "¿Qué contiene como mínimo el requerimiento?",
          parrafos: [
            "El requerimiento da inicio al proceso de contratación: lo determina el área usuaria o el área técnica " +
              "estratégica en coordinación con la DEC e identifica la finalidad pública y los objetivos de la contratación " +
              "(Ley, Art. 46).",
            "Atiende una necesidad para cumplir la finalidad pública, promoviendo el valor por dinero, y el área usuaria lo " +
              "remite a la DEC. Contiene las condiciones de contratación, que incluyen como mínimo, de corresponder: el " +
              "alcance y las condiciones de ejecución en función de su desempeño y funcionalidad; la propuesta de requisitos " +
              "de calificación y/o precalificación; la propuesta de modalidad de pago y sistema de entrega; el equipamiento, " +
              "permisos y otros recursos que necesite el contratista; y la fórmula de reajuste (Reglamento, Art. 44).",
          ],
        },
        {
          pregunta: "¿Qué más se analiza al elaborarlo?",
          parrafos: [
            "Al elaborar el requerimiento se inicia la identificación y evaluación de los riesgos del proceso de " +
              "contratación y su asignación a alguna de las partes, que sirve de insumo para la estrategia. En bienes y " +
              "obras se evalúa además la necesidad de prestaciones accesorias como el mantenimiento y la operación, " +
              "considerando el ciclo de vida del activo (Reglamento, Art. 44).",
            "El requerimiento incluye lo previsto en leyes, reglamentos, normas metrológicas y normas técnicas obligatorias " +
              "vinculadas con el objeto. Puede incluir normas técnicas voluntarias solo si se sustenta en la estrategia y " +
              "sirven para asegurar requisitos funcionales o técnicos, existe en el mercado quien acredite su cumplimiento, " +
              "se basan en normas internacionales cuando existan y no contravienen las obligatorias.",
          ],
        },
        {
          pregunta: "¿Qué no puede exigir?",
          parrafos: [
            "No incluye exigencias desproporcionadas o innecesarias que limiten la concurrencia o favorezcan a un " +
              "proveedor, ni hace referencia a procedencia, fabricante, marca, patente, origen o tipos de producción, salvo " +
              "que la autoridad de la gestión administrativa haya aprobado el proceso de compatibilización del requerimiento " +
              "(Reglamento, Art. 44).",
            "Si la necesidad está en una ficha de homologación o en una ficha técnica vigentes, el requerimiento recoge las " +
              "características técnicas y los requisitos de calificación ya definidos en ellas.",
          ],
        },
        {
          pregunta: "¿Quién puede modificarlo y cómo se fija su objeto?",
          parrafos: [
            "La DEC verifica que cumpla la Ley y el Reglamento, propone mejoras y puede modificarlo en cualquier momento de " +
              "las actuaciones preparatorias, pidiendo al área usuaria la no objeción. El área usuaria solo puede objetar la " +
              "modificación cuando exista el riesgo de que no se satisfaga su necesidad y no se cumpla la finalidad pública " +
              "(Reglamento, Art. 44).",
            "El objeto se determina por la naturaleza de la contratación; si hay varios tipos de prestaciones, por la de " +
              "mayor costo, siempre que no desvirtúe esa naturaleza. Con diálogo competitivo se convoca con un requerimiento " +
              "preliminar que solo describe la necesidad, los objetivos, metas o funcionalidades y la finalidad pública.",
          ],
        },
      ],
      puntosClave: [
        "Mínimo del requerimiento: alcance, requisitos de calificación, modalidad de pago y sistema de entrega, recursos del contratista y fórmula de reajuste.",
        "Al elaborarlo empieza la gestión de riesgos: identificarlos, evaluarlos y asignarlos a una de las partes.",
        "Bienes y obras: evaluar operación y mantenimiento según el ciclo de vida del activo.",
        "Marca, patente o fabricante solo con compatibilización aprobada por la autoridad de la gestión administrativa.",
        "La DEC modifica con no objeción; el área usuaria solo objeta si peligra su necesidad o la finalidad pública.",
        "Objeto mixto: manda la prestación de mayor costo, sin desvirtuar la naturaleza.",
      ],
      casuisticas: [
        {
          enunciado:
            "Una entidad compra bombas de agua que necesitarán operación y mantenimiento durante toda su vida útil. El " +
            "área usuaria propone requerir solo el suministro inicial. ¿Qué corresponde al elaborar el requerimiento?",
          resolucion:
            "Evaluar la necesidad de incluir el mantenimiento y la operación como prestaciones accesorias, considerando " +
            "el ciclo de vida del activo; en bienes y obras esa evaluación es parte del requerimiento.",
          baseLegal: [{ norma: "Reglamento", articulo: "44" }],
        },
        {
          enunciado:
            "Una contratación combina bienes por S/ 220 000 y servicios de instalación por S/ 60 000. Tomar la prestación " +
            "de mayor costo no desvirtúa la naturaleza de la contratación. ¿Cuál es el objeto?",
          resolucion:
            "Bienes: con prestaciones de distinto tipo, el objeto se determina por la de mayor costo, siempre que no " +
            "desvirtúe la naturaleza de la contratación.",
          baseLegal: [{ norma: "Reglamento", articulo: "44" }],
        },
        {
          enunciado:
            "El área usuaria pide impresoras «marca X» porque sus técnicos ya la conocen. No hay ningún proceso de " +
            "compatibilización aprobado. ¿Puede la DEC mantener la marca en el requerimiento?",
          resolucion:
            "No. El requerimiento no puede hacer referencia a marca, fabricante o patente salvo que la autoridad de la " +
            "gestión administrativa haya aprobado la compatibilización; sin ella, debe describirse por características " +
            "y funcionalidad.",
          baseLegal: [{ norma: "Reglamento", articulo: "44" }],
        },
        {
          enunciado:
            "La DEC ajusta el requerimiento para ampliar la concurrencia y pide la no objeción. El área usuaria la niega " +
            "porque «prefería su redacción original», aunque el cambio no afecta su necesidad. ¿Es válida la objeción?",
          resolucion:
            "No. El área usuaria solo puede objetar la modificación cuando exista el riesgo de que no se satisfaga su " +
            "necesidad y no se cumpla la finalidad pública; una preferencia de redacción no es causa de objeción.",
          baseLegal: [{ norma: "Reglamento", articulo: "44" }],
        },
      ],
      baseLegal: [
        { norma: "Ley 32069", articulo: "46" },
        { norma: "Reglamento", articulo: "44" },
      ],
      verificada: true,
    },
  },
  {
    slug: "interaccion-mercado-cuantia",
    modulo: "XXV",
    temas: ["1.2"],
    titulo: "Interacción con el mercado y cuantía de la contratación",
    descripcion:
      "Indagación y consulta al mercado, básicas o avanzadas; las herramientas de consulta y los plazos de la difusión " +
      "del requerimiento; y cómo se calcula la cuantía.",
    minutos: 12,
    contenido: {
      resumen: [
        {
          pregunta: "¿Para qué sirve la interacción con el mercado?",
          parrafos: [
            "Permite perfeccionar el requerimiento, actualizar la cuantía considerada en el PAC del CMN, medir la oferta, " +
              "la competencia y el riesgo de que el procedimiento se frustre. Es de dos tipos: indagación y consulta al " +
              "mercado. La entidad guarda confidencialidad de la información no pública a la que accede, aunque sea de " +
              "forma indirecta (Reglamento, Art. 47; Ley, Art. 47).",
          ],
        },
        {
          pregunta: "¿Cuándo es básica o avanzada la indagación?",
          parrafos: [
            "La indagación analiza datos e investiga las condiciones competitivas del mercado. Sus fuentes son la " +
              "información histórica de la entidad, los procedimientos y contratos de otras entidades obtenidos de la " +
              "Pladicop y otras pertinentes, preferentemente de los tres últimos ejercicios; también puede pedirse " +
              "información a potenciales proveedores (Reglamento, Art. 48).",
            "Es básica con una fuente como mínimo y avanzada con dos o más fuentes.",
          ],
        },
        {
          pregunta: "¿Y la consulta al mercado?",
          parrafos: [
            "Propicia un intercambio abierto y transparente con los proveedores. Es básica si emplea una sola herramienta " +
              "y avanzada si emplea dos o más, de la misma o de distinta clasificación (Reglamento, Art. 49).",
            "Las herramientas son escritas (la difusión del requerimiento o solicitudes de información) o reuniones: «uno a " +
              "muchos» para comunicar aspectos clave a varios proveedores, como talleres con la industria, y «uno a uno» para " +
              "obtener información detallada en reuniones individuales. La indagación puede usarse de forma complementaria " +
              "(Reglamento, Art. 50).",
          ],
        },
        {
          pregunta: "¿Qué plazos tiene la difusión del requerimiento?",
          parrafos: [
            "Se publica el requerimiento en la Pladicop y en la sede digital, de contar con ella, antes de la convocatoria. " +
              "Los proveedores formulan consultas o comentarios técnicos en un plazo no menor de 5 días hábiles; el área " +
              "usuaria y la DEC los absuelven en un máximo de 6 días hábiles y publican un acta; dentro de los 3 días hábiles " +
              "siguientes se hace una reunión de confirmación o aclaración dirigida por la DEC, cuya acta se publica al día " +
              "hábil siguiente (Reglamento, Art. 51, texto modificado por el D.S. 001-2026-EF).",
            "Tras la absolución, el requerimiento puede modificarlo el área usuaria o la DEC con su no objeción.",
          ],
        },
        {
          pregunta: "¿Cómo se determina la cuantía?",
          parrafos: [
            "La DEC parte de la cuantía del PAC del CMN para gestionar la certificación o previsión presupuestal, y puede " +
              "actualizarla con la interacción con el mercado. Incluye todos los conceptos aplicables al bien, servicio u " +
              "obra. En un procedimiento por ítems, lotes o tramos es la suma de las cuantías de cada uno. No es obligatorio " +
              "darla a conocer en la selección, salvo que sea punto de referencia para las ofertas (Reglamento, Art. 53; Ley, " +
              "Art. 48).",
          ],
        },
      ],
      puntosClave: [
        "Interacción con el mercado: indagación o consulta al mercado.",
        "Indagación básica: 1 fuente; avanzada: 2 o más.",
        "Consulta básica: 1 herramienta; avanzada: 2 o más, aunque sean de la misma clasificación.",
        "Difusión del requerimiento: consultas ≥ 5 días hábiles, absolución ≤ 6, reunión ≤ 3, acta al día hábil siguiente.",
        "La cuantía incluye todos los conceptos aplicables; por ítems, se suman las cuantías de cada ítem.",
        "La información no pública recibida en la interacción es confidencial.",
      ],
      casuisticas: [
        {
          enunciado:
            "La DEC solo usó el historial de contratos de su propia entidad y quiere calificar su indagación como " +
            "avanzada. ¿Qué le falta?",
          resolucion:
            "Una segunda fuente de información, por ejemplo contratos de otras entidades obtenidos de la Pladicop: la " +
            "indagación avanzada exige dos o más fuentes; con una sola es básica.",
          baseLegal: [{ norma: "Reglamento", articulo: "48" }],
        },
        {
          enunciado:
            "Para una compra compleja la entidad hizo un taller con la industria y luego reuniones individuales con tres " +
            "proveedores. No usó herramientas escritas. ¿Cómo se clasifica la consulta al mercado?",
          resolucion:
            "Avanzada: usó dos herramientas (reuniones «uno a muchos» y «uno a uno»), y la consulta avanzada admite dos o " +
            "más herramientas aunque pertenezcan a la misma clasificación.",
          baseLegal: [
            { norma: "Reglamento", articulo: "49" },
            { norma: "Reglamento", articulo: "50" },
          ],
        },
        {
          enunciado:
            "Se difundió el requerimiento y las consultas técnicas se recibieron el último día del plazo. La DEC quiere " +
            "absolverlas en el día 8 hábil siguiente. ¿Está dentro del plazo?",
          resolucion:
            "No. La absolución debe hacerse en un máximo de 6 días hábiles desde formuladas las consultas, publicando el " +
            "acta en la Pladicop; luego hay hasta 3 días hábiles para la reunión de confirmación o aclaración.",
          baseLegal: [{ norma: "Reglamento", articulo: "51" }],
        },
        {
          enunciado:
            "Un bien cuesta S/ 80 000; el flete, S/ 4 000; la instalación, S/ 6 000, y los tributos aplicables, S/ 16 200. " +
            "Son conceptos necesarios y no incluidos unos en otros. ¿Cuál es la cuantía de la contratación?",
          resolucion:
            "S/ 106 200: la cuantía incluye todos los conceptos aplicables al bien a contratar, no solo su precio.",
          baseLegal: [{ norma: "Reglamento", articulo: "53" }],
        },
        {
          enunciado:
            "Durante la consulta al mercado, un proveedor entrega su estructura de costos, que no es pública. Otro " +
            "proveedor pide una copia para preparar sus comentarios. ¿Qué hace la entidad?",
          resolucion:
            "No la entrega: guarda confidencialidad de toda información no pública a la que accede, directa o " +
            "indirectamente, con ocasión de la interacción con el mercado.",
          baseLegal: [{ norma: "Reglamento", articulo: "47" }],
        },
      ],
      baseLegal: [
        { norma: "Ley 32069", articulo: "47" },
        { norma: "Ley 32069", articulo: "48" },
        { norma: "Reglamento", articulo: "47" },
        { norma: "Reglamento", articulo: "48" },
        { norma: "Reglamento", articulo: "49" },
        { norma: "Reglamento", articulo: "50" },
        { norma: "Reglamento", articulo: "51" },
        { norma: "Reglamento", articulo: "53" },
      ],
      verificada: true,
    },
  },
  {
    slug: "estrategia-agrupamiento-fraccionamiento",
    modulo: "XXVI",
    temas: ["1.2"],
    titulo: "Estrategia de contratación, agrupamiento y fraccionamiento",
    descripcion:
      "Las variables que decide la estrategia, cuándo se pueden agrupar prestaciones por paquete o por ítems, y qué " +
      "casos no constituyen fraccionamiento.",
    minutos: 12,
    contenido: {
      resumen: [
        {
          pregunta: "¿Qué es la estrategia y quién la elabora?",
          parrafos: [
            "Es el proceso por el que la DEC, con base en el requerimiento, analiza y evalúa de forma integral las " +
              "variables que influyen en la contratación, aplicando el principio de valor por dinero y considerando lo " +
              "obtenido en la interacción con el mercado y lo que aporta el área usuaria (Reglamento, Art. 46; Ley, Art. 49).",
            "Consta en un documento conforme al formato de la DGA y forma parte del expediente de contratación; la DEC puede " +
              "pedir información al área usuaria y solicitar la participación de los evaluadores.",
          ],
        },
        {
          pregunta: "¿Qué variables decide?",
          parrafos: [
            "Entre otras, según corresponda: el tipo de procedimiento y su modalidad, el sustento de un no competitivo, la " +
              "posibilidad de usar una modalidad de contratación eficiente, el tipo de evaluador y su perfil, los requisitos " +
              "de calificación, los factores de evaluación, la modalidad de pago y el sistema de entrega, los puntos no " +
              "negociables en la subetapa de negociación, la fuente de financiamiento y la actualización de la cuantía, " +
              "las garantías y adelantos, el cronograma estimado, la posibilidad de agrupar prestaciones, si el " +
              "requerimiento está estandarizado y la gestión de riesgos (Reglamento, Art. 46).",
          ],
        },
        {
          pregunta: "¿Cuándo se pueden agrupar prestaciones?",
          parrafos: [
            "La entidad puede agrupar bienes, servicios u obras esencialmente similares para mejorar precios y calidades " +
              "por la competencia y la economía de escala y simplificar las relaciones contractuales. Por paquete, agrupa en " +
              "un mismo objeto bienes o servicios distintos pero vinculados. Por relación de ítems, lotes o tramos, hace un " +
              "único procedimiento con prestaciones distintas pero vinculadas, siempre que la cuantía de cada contratación " +
              "individual supere la de un contrato menor; cada ítem es un procedimiento independiente (Reglamento, Art. 52).",
            "La DEC debe sustentar en la estrategia que agrupar resulta más eficiente que contratar por separado. Recuerda " +
              "que el contrato menor llega hasta 8 UIT (Ley, Art. 34).",
          ],
        },
        {
          pregunta: "¿Qué no es fraccionamiento?",
          parrafos: [
            "Está prohibido dividir una contratación para evitar el procedimiento que corresponde según la necesidad anual " +
              "o para evadir la Ley (Ley, Art. 50). Responden el área usuaria, la DEC y las demás dependencias encargadas " +
              "de planificar los recursos (Reglamento, Art. 45).",
            "No constituye fraccionamiento: contratar por razones presupuestales, acreditadas con informe de la oficina de " +
              "planeamiento y presupuesto; una necesidad imprevisible adicional generada por un evento no atribuible a la " +
              "entidad, si el área usuaria la sustenta y la DEC verifica las magnitudes del CMN y que el hecho generador sea " +
              "posterior al primer requerimiento de objeto idéntico; las compras por catálogos electrónicos de acuerdo marco " +
              "(salvo que corresponda gran compra); y los demás casos que fije el Reglamento (Reglamento, Art. 45).",
          ],
        },
      ],
      puntosClave: [
        "La estrategia la elabora la DEC, con valor por dinero, y forma parte del expediente.",
        "Decide procedimiento, evaluador, requisitos, modalidad de pago, sistema de entrega, garantías, adelantos y riesgos.",
        "Por ítems: cada contratación individual debe superar la cuantía de un contrato menor (8 UIT).",
        "Agrupar exige sustentar en la estrategia que es más eficiente que contratar por separado.",
        "Razones presupuestales: solo con informe de planeamiento y presupuesto.",
        "Imprevisible: el hecho generador debe ser posterior al primer requerimiento de objeto idéntico.",
      ],
      casuisticas: [
        {
          enunciado:
            "Se quiere convocar por relación de ítems tres servicios vinculados de 15, 10 y 5 UIT. El de 5 UIT es " +
            "separable y la estrategia demuestra que agrupar los otros dos es más eficiente. ¿Qué ítems pueden ir juntos?",
          resolucion:
            "Solo los de 15 y 10 UIT: por ítems, la cuantía de cada contratación individual debe superar la de un " +
            "contrato menor (8 UIT). El de 5 UIT queda fuera de ese procedimiento.",
          baseLegal: [
            { norma: "Reglamento", articulo: "52" },
            { norma: "Ley 32069", articulo: "34" },
          ],
        },
        {
          enunciado:
            "La DEC agrupa varias prestaciones «porque es más cómodo tramitarlas juntas», sin comparar con contratarlas " +
            "por separado. ¿Qué falta?",
          resolucion:
            "Sustentar en la estrategia de contratación que el agrupamiento resulta más eficiente que efectuar " +
            "contrataciones separadas; la comodidad no basta.",
          baseLegal: [{ norma: "Reglamento", articulo: "52" }],
        },
        {
          enunciado:
            "Se divide una compra alegando falta de presupuesto, con solo una nota del área usuaria. ¿Qué respaldo falta " +
            "para que no sea fraccionamiento?",
          resolucion:
            "El informe de la oficina de planeamiento y presupuesto, o de quien haga sus veces: es lo que acredita la " +
            "excepción por razones presupuestales.",
          baseLegal: [{ norma: "Reglamento", articulo: "45" }],
        },
        {
          enunciado:
            "El área usuaria pide una contratación adicional por una necesidad «imprevisible», pero la DEC comprueba que " +
            "el hecho que la generó ocurrió antes del primer requerimiento del mismo objeto. ¿Aplica la excepción?",
          resolucion:
            "No. Para que la necesidad imprevisible adicional no sea fraccionamiento, el hecho generador debe ser " +
            "posterior al primer requerimiento de objeto contractual idéntico.",
          baseLegal: [{ norma: "Reglamento", articulo: "45" }],
        },
      ],
      baseLegal: [
        { norma: "Ley 32069", articulo: "34" },
        { norma: "Ley 32069", articulo: "49" },
        { norma: "Ley 32069", articulo: "50" },
        { norma: "Reglamento", articulo: "45" },
        { norma: "Reglamento", articulo: "46" },
        { norma: "Reglamento", articulo: "52" },
      ],
      verificada: true,
    },
  },
];
