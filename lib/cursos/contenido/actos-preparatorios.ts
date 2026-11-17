import type { Clase } from "../tipos";

// Contenido verificado contra el corpus del RAG: Ley 32069 (texto actualizado al 19.07.2026) y Reglamento (texto
// actualizado al 09.01.2026, con las modificaciones del D.S. 001-2026-EF). Cada artículo, plazo y cifra que aparece
// aquí se leyó en el fragmento correspondiente; lo que no se pudo confirmar se dejó fuera en vez de aproximarlo.

export const ACTOS_PREPARATORIOS: Clase[] = [
  {
    slug: "actores-involucrados",
    modulo: "I",
    temas: ["1.7"],
    titulo: "Actores involucrados",
    descripcion:
      "Quién participa en una contratación pública, dentro y fuera de la entidad contratante, qué decide cada actor y " +
      "qué puede delegarse.",
    minutos: 9,
    contenido: {
      resumen: [
        {
          pregunta: "¿Quiénes son los actores del proceso de contratación?",
          parrafos: [
            "El artículo 9 de la Ley enumera cinco: la Dirección General de Abastecimiento del MEF (DGA), el Organismo " +
              "Especializado para las Contrataciones Públicas Eficientes (OECE), la Central de Compras Públicas (Perú " +
              "Compras), las entidades contratantes y los proveedores.",
          ],
        },
        {
          pregunta: "¿Qué actores hay dentro de la entidad contratante?",
          parrafos: [
            "El artículo 25.1 de la Ley distingue seis: el titular de la entidad, la autoridad de la gestión " +
              "administrativa, el área usuaria, el área técnica estratégica, la dependencia encargada de las " +
              "contrataciones (DEC) y los compradores públicos.",
            "La autoridad de la gestión administrativa es la más alta autoridad administrativa: la secretaría general " +
              "en los ministerios, la gerencia general regional en los gobiernos regionales y la gerencia municipal en " +
              "los gobiernos locales.",
            "El área usuaria formula su requerimiento en coordinación con la DEC, verifica el cumplimiento del contrato y " +
              "emite la conformidad (Reglamento, Art. 20). El área técnica estratégica asume ese rol para formular los " +
              "requerimientos de otras unidades.",
          ],
        },
        {
          pregunta: "¿Qué hace la DEC y qué no?",
          parrafos: [
            "La DEC, a través de los compradores públicos, registra en la Pladicop los actos de las tres fases, salvo " +
              "aquellos que el Reglamento asigna a los evaluadores u otros actores (Reglamento, Art. 14.2.a): los comités " +
              "registran sus actas (Reglamento, Art. 59.5.c) y los jurados comunican sus prórrogas a la DEC para que esta " +
              "las registre (Reglamento, Art. 60.3). Además elabora la estrategia de contratación y realiza la interacción " +
              "con el mercado (Reglamento, Art. 14).",
            "Participa en la revisión de los requerimientos en lo referido a la normativa de contratación, pero esa " +
              "participación no alcanza los aspectos técnicos de la necesidad, que son responsabilidad del área usuaria.",
          ],
        },
        {
          pregunta: "¿Qué decide el titular y qué la autoridad de la gestión administrativa?",
          parrafos: [
            "El titular autoriza, cuando le corresponde, las prestaciones adicionales de obra, autoriza el inicio de la " +
              "acción judicial de anulación de laudo y aprueba los procedimientos no competitivos de los literales b), c) " +
              "y k) del numeral 55.1 de la Ley (Reglamento, Art. 18).",
            "La autoridad de la gestión administrativa autoriza las prestaciones adicionales de bienes, servicios y " +
              "consultorías de obras, aprueba los demás supuestos no competitivos, declara la nulidad de procedimientos " +
              "y contratos y resuelve las apelaciones en los casos que indica la Ley (Reglamento, Art. 19).",
            "Ambos pueden delegar sus facultades mediante resolución, salvo las excepciones del Reglamento (Ley, Art. 25).",
          ],
        },
      ],
      puntosClave: [
        "Son cinco actores del proceso: DGA, OECE, Perú Compras, entidades contratantes y proveedores.",
        "Dentro de la entidad hay seis: titular, autoridad de la gestión administrativa, área usuaria, área técnica estratégica, DEC y compradores públicos.",
        "La conformidad de la prestación la emite el área usuaria, no la DEC.",
        "Los compradores públicos son los funcionarios y servidores de la DEC y deben estar certificados conforme a la directiva del OECE.",
        "La DEC no registra todo: los comités registran sus actas y los jurados comunican sus prórrogas a la DEC.",
        "La delegación de facultades del titular y de la autoridad de la gestión administrativa se hace por resolución.",
      ],
      casuisticas: [
        {
          enunciado:
            "La DEC recibe un requerimiento de mobiliario y observa dos cosas: la necesidad no está registrada en el CMN y la marca de los escritorios no le parece la más conveniente. ¿Qué puede hacer la DEC?",
          resolucion:
            "La DEC verifica que la necesidad esté registrada y aprobada en el CMN y sus modificaciones, pero su participación en el requerimiento alcanza solo lo normativo de la contratación: los aspectos técnicos de la necesidad son responsabilidad del área usuaria, así que la DEC no puede cambiar la marca.",
          baseLegal: [{ norma: "Reglamento", articulo: "14" }],
        },
        {
          enunciado:
            "Termina la entrega de un servicio de mantenimiento y el jefe de la DEC quiere emitir él mismo la conformidad para agilizar el pago. ¿Corresponde?",
          resolucion:
            "No. La conformidad de la prestación la emite el área usuaria, que además verificó el cumplimiento del contrato; la DEC gestiona el contrato, no lo recibe.",
          baseLegal: [{ norma: "Reglamento", articulo: "20" }],
        },
        {
          enunciado:
            "En un concurso público abreviado a cargo de un comité, la evaluación necesita una prórroga. El comprador público de la DEC quiere registrarla él en la Pladicop «porque la DEC registra los actos de las tres fases». ¿Es correcto?",
          resolucion:
            "No. La regla general de la DEC tiene excepciones: los comités registran sus acuerdos y votos en actas en la Pladicop. Si el evaluador fuera un jurado, este comunica la prórroga a la DEC para que esta la registre.",
          baseLegal: [
            { norma: "Reglamento", articulo: "14" },
            { norma: "Reglamento", articulo: "59" },
            { norma: "Reglamento", articulo: "60" },
          ],
        },
      ],
      baseLegal: [
        { norma: "Ley 32069", articulo: "9" },
        { norma: "Ley 32069", articulo: "25" },
        { norma: "Reglamento", articulo: "14" },
        { norma: "Reglamento", articulo: "15" },
        { norma: "Reglamento", articulo: "18" },
        { norma: "Reglamento", articulo: "19" },
        { norma: "Reglamento", articulo: "20" },
        { norma: "Reglamento", articulo: "59" },
        { norma: "Reglamento", articulo: "60" },
      ],
      verificada: true,
    },
  },
  {
    slug: "modalidades-contratacion-eficiente",
    modulo: "II",
    temas: ["2.1"],
    titulo: "Modalidades de la contratación pública eficiente",
    descripcion:
      "Contratos menores, compra por encargo, compra centralizada, compra corporativa, compra pública de innovación y " +
      "acuerdos marco: qué es cada una y cuándo conviene.",
    minutos: 10,
    contenido: {
      resumen: [
        {
          pregunta: "¿Qué es un contrato menor?",
          parrafos: [
            "Es el que celebra la entidad por un monto igual o inferior a ocho UIT vigentes al momento de la contratación " +
              "y que no requiere procedimiento de selección. Está sujeto a la supervisión del OECE y su información se " +
              "publica en la Pladicop (Ley, Art. 34).",
          ],
        },
        {
          pregunta: "¿En qué se diferencian la compra por encargo y la compra centralizada?",
          parrafos: [
            "En la compra por encargo, la entidad encarga a otra entidad o a un organismo internacional las fases de " +
              "actuaciones preparatorias o de selección, mediante un convenio (Ley, Art. 35).",
            "En la compra centralizada, por razones de importancia estratégica, complejidad o especialización, la entidad " +
              "encarga a Perú Compras o a otra entidad todas las fases, hasta la liquidación o el pago total, y puede " +
              "incluir la distribución. Para ello puede transferir partidas a la entidad encargada (Ley, Art. 36).",
          ],
        },
        {
          pregunta: "¿Cuándo hay compra corporativa?",
          parrafos: [
            "Cuando dos o más entidades consolidan la contratación de bienes y servicios para necesidades comunes y así " +
              "obtener mejores condiciones. Puede ser facultativa u obligatoria; la obligatoria está a cargo de Perú " +
              "Compras (Ley, Art. 37).",
          ],
        },
        {
          pregunta: "¿Para qué sirven la compra pública de innovación y los acuerdos marco?",
          parrafos: [
            "La compra pública de innovación (CPI) genera soluciones innovadoras soportadas por investigación y desarrollo " +
              "cuando la solución no está disponible en el mercado o necesita adaptaciones que incorporen elementos " +
              "innovadores, asumiendo y mitigando los riesgos de la innovación (Ley, Art. 38).",
            "Con los acuerdos marco la contratación se hace por etapas: primero se determinan los proveedores o las " +
              "condiciones del acuerdo y después se adjudica el contrato (Ley, Art. 39).",
          ],
        },
      ],
      puntosClave: [
        "Contrato menor: hasta ocho UIT vigentes al contratar, sin procedimiento de selección y supervisado por el OECE.",
        "Compra por encargo: solo actuaciones preparatorias o selección, y por convenio.",
        "Compra centralizada: todas las fases, hasta la liquidación o el pago total.",
        "Compra corporativa: solo bienes y servicios; la obligatoria la conduce Perú Compras.",
        "Acuerdo marco: primero se fijan proveedores o condiciones; luego se adjudica.",
      ],
      casuisticas: [
        {
          enunciado:
            "Una entidad necesita comprar útiles de oficina por un monto equivalente a 6 UIT. El área usuaria pide «un procedimiento rápido». ¿Qué figura corresponde?",
          resolucion:
            "El contrato menor: monto igual o inferior a 8 UIT vigentes al momento de la contratación, sin procedimiento de selección, sujeto a supervisión del OECE y con publicación de la información en la Pladicop.",
          baseLegal: [{ norma: "Ley 32069", articulo: "34" }],
        },
        {
          enunciado:
            "Un ministerio quiere que Perú Compras se encargue no solo de seleccionar sino también de ejecutar, liquidar y pagar la contratación. ¿Es la compra por encargo?",
          resolucion:
            "No. La compra por encargo cubre solo las fases de actuaciones preparatorias o de selección, mediante convenio. Lo que describe es la compra centralizada: todas las fases hasta la liquidación o el pago total, con posible transferencia de partidas.",
          baseLegal: [
            { norma: "Ley 32069", articulo: "35" },
            { norma: "Ley 32069", articulo: "36" },
          ],
        },
        {
          enunciado:
            "Dos entidades públicas necesitan el mismo servicio de vigilancia y quieren juntarse para conseguir mejor precio. ¿Pueden?",
          resolucion:
            "Sí, mediante compra corporativa: dos o más entidades consolidan la contratación de bienes y servicios para necesidades comunes. Puede ser facultativa u obligatoria; la obligatoria está a cargo de Perú Compras.",
          baseLegal: [{ norma: "Ley 32069", articulo: "37" }],
        },
      ],
      baseLegal: [
        { norma: "Ley 32069", articulo: "34" },
        { norma: "Ley 32069", articulo: "35" },
        { norma: "Ley 32069", articulo: "36" },
        { norma: "Ley 32069", articulo: "37" },
        { norma: "Ley 32069", articulo: "38" },
        { norma: "Ley 32069", articulo: "39" },
      ],
      verificada: true,
    },
  },
  {
    slug: "expediente-contratacion",
    modulo: "III",
    temas: ["1.1"],
    titulo: "Expediente de contratación",
    descripcion:
      "Qué contiene el expediente, quién lo custodia y quién lo aprueba antes de convocar, y qué pasa con él cuando el " +
      "procedimiento se declara desierto.",
    minutos: 7,
    contenido: {
      resumen: [
        {
          pregunta: "¿Qué abarca el expediente de contratación?",
          parrafos: [
            "Contiene la información que respalda las actuaciones desde la formulación del requerimiento hasta el " +
              "cumplimiento total de las obligaciones del contrato, incluidas las incidencias del recurso de apelación y " +
              "de los medios de solución de controversias (Ley, Art. 51).",
          ],
        },
        {
          pregunta: "¿Quién lo custodia y quién lo aprueba?",
          parrafos: [
            "La DEC es responsable de que toda la información esté en el expediente y de que esté disponible para quien la " +
              "requiera; se privilegian los medios electrónicos (Reglamento, Art. 54).",
            "La autoridad de la gestión administrativa lo aprueba antes de la fase de selección. Para aprobarlo, la " +
              "necesidad debe estar prevista en el CMN aprobado del año fiscal o en su modificatoria.",
          ],
        },
        {
          pregunta: "¿Qué documentos debe tener para aprobarse?",
          parrafos: [
            "El requerimiento final (indicando si está estandarizado), la aprobación de la compatibilización cuando " +
              "corresponda, la estrategia de contratación con la interacción con el mercado, la cuantía, el documento de " +
              "designación de los evaluadores, la certificación de crédito presupuestario o previsión presupuestal y la " +
              "demás documentación que exija la normativa del objeto (Reglamento, Art. 54).",
            "Sin expediente aprobado y bases elaboradas no se puede convocar (Reglamento, Art. 63).",
            "En el MDA el proceso empieza con el requerimiento y las actuaciones preparatorias aplican sin segmentación " +
              "ni interacción con el mercado (Reglamento, Art. 295.1); el expediente no incorpora lo que la interacción " +
              "produciría en otros regímenes.",
          ],
        },
      ],
      puntosClave: [
        "Va desde el requerimiento hasta el cumplimiento total del contrato, incluidas apelaciones y controversias.",
        "La custodia es de la DEC; la aprobación, de la autoridad de la gestión administrativa.",
        "La necesidad tiene que estar en el CMN aprobado del año fiscal o en su modificatoria.",
        "MDA: actuaciones preparatorias sin segmentación ni interacción con el mercado.",
        "Si el procedimiento se declara desierto, la siguiente convocatoria por regla general no necesita aprobar de nuevo el expediente.",
      ],
      casuisticas: [
        {
          enunciado:
            "Un hospital del Ministerio de Salud arma el expediente de una contratación por MDA e incluye la segmentación y una ronda de interacción con el mercado «para cumplir el expediente completo». ¿Corresponde?",
          resolucion:
            "No. En el MDA el proceso se inicia con el requerimiento y las actuaciones preparatorias aplican sin segmentación ni interacción con el mercado.",
          baseLegal: [{ norma: "Reglamento", articulo: "295" }],
        },
        {
          enunciado:
            "La autoridad de la gestión administrativa duda en aprobar un expediente porque la necesidad no aparece en el CMN aprobado ni en su modificatoria. ¿Puede aprobarlo de todos modos si hay presupuesto?",
          resolucion:
            "No. Para aprobar el expediente la necesidad debe estar prevista en el CMN aprobado del año fiscal o en su modificatoria; sin expediente aprobado y bases elaboradas tampoco se puede convocar.",
          baseLegal: [
            { norma: "Reglamento", articulo: "54" },
            { norma: "Reglamento", articulo: "63" },
          ],
        },
        {
          enunciado:
            "Una licitación pública se declara desierta y la necesidad persiste. ¿Hay que volver a aprobar el expediente para la nueva convocatoria?",
          resolucion:
            "Por regla general, no: la siguiente convocatoria del procedimiento declarado desierto no exige aprobar de nuevo el expediente.",
          baseLegal: [{ norma: "Reglamento", articulo: "63" }],
        },
        {
          enunciado:
            "El expediente trae el requerimiento final, la estrategia de contratación con su interacción con el mercado, la designación de los evaluadores y la previsión presupuestal, pero no la certificación de crédito presupuestario. ¿Puede la autoridad de la gestión administrativa aprobarlo?",
          resolucion:
            "Sí. El Reglamento exige «la certificación de crédito presupuestario o previsión presupuestal»: basta una de las dos. Con la previsión documentada, el expediente reúne el contenido mínimo para aprobarse.",
          baseLegal: [{ norma: "Reglamento", articulo: "54" }],
        },
        {
          enunciado:
            "La entidad ya tiene el requerimiento cerrado y la estrategia definida, y quiere convocar de inmediato para no perder el año fiscal, sin esperar la aprobación del expediente. ¿Puede?",
          resolucion:
            "No. Sin expediente aprobado y bases elaboradas no se puede convocar: la aprobación del expediente por la autoridad de la gestión administrativa es requisito previo a la convocatoria.",
          baseLegal: [{ norma: "Reglamento", articulo: "63" }],
        },
      ],
      baseLegal: [
        { norma: "Ley 32069", articulo: "51" },
        { norma: "Reglamento", articulo: "54" },
        { norma: "Reglamento", articulo: "63" },
        { norma: "Reglamento", articulo: "295" },
      ],
      verificada: true,
    },
  },
  {
    slug: "plan-anual-contrataciones",
    modulo: "IV",
    temas: ["1.6", "1.5"],
    titulo: "Plan anual de contrataciones",
    descripcion:
      "Cómo el plan anual nace del Cuadro Multianual de Necesidades, por qué una contratación tiene que estar prevista " +
      "en él y qué pasa con las contrataciones no planificadas.",
    minutos: 7,
    contenido: {
      resumen: [
        {
          pregunta: "¿Qué es el PAC del CMN?",
          parrafos: [
            "Es el plan anual de contrataciones del Cuadro Multianual de Necesidades (Reglamento, Art. 3). Se origina en la " +
              "programación multianual de bienes, servicios y obras (PMBSO), en cuyo marco se realiza el requerimiento " +
              "(Ley, Art. 46), y las entidades convocan procedimientos de selección para los requerimientos previstos en " +
              "ella (Ley, Art. 53).",
          ],
        },
        {
          pregunta: "¿Por qué importa al convocar?",
          parrafos: [
            "La DEC verifica que la necesidad del requerimiento esté registrada y aprobada en el CMN (Reglamento, Art. 14) " +
              "y, para aprobar el expediente, la necesidad debe estar prevista en el CMN aprobado del año fiscal o en su " +
              "modificatoria (Reglamento, Art. 54).",
            "La cuantía con la que se gestiona la certificación presupuestal es la establecida en el PAC del CMN, y puede " +
              "actualizarse con la interacción con el mercado (Reglamento, Art. 53).",
          ],
        },
        {
          pregunta: "¿Qué pasa con una contratación no planificada?",
          parrafos: [
            "Si la contratación no está programada pero la necesidad ya está incluida en el CMN respectivo, la DEC efectúa la segmentación luego de la recepción del requerimiento (Reglamento, Art. 42.3, texto sustituido por el D.S. 001-2026-EF).",
            "Las compras centralizadas y corporativas las segmenta la entidad encargada al inicio de las actuaciones preparatorias, y las considera estratégicas (bienes y servicios) o avanzadas (obras y consultorías de obras). Las contrataciones por encargo las segmenta la entidad encargada cuando el encargo contempla esa fase (Reglamento, Art. 42.4).",
            "No se segmentan los contratos menores ni las contrataciones por catálogos electrónicos de acuerdos marco, procedimientos no competitivos y supuestos excluidos (Reglamento, Arts. 42.1 y 42.5).",
            "Mientras el PAC del CMN se implementa, las entidades elaboran y aprueban su Plan Anual de Contrataciones " +
              "conforme a la directiva de la DGA (Primera Disposición Complementaria Transitoria del Reglamento).",
          ],
        },
      ],
      puntosClave: [
        "PAC del CMN = plan anual de contrataciones del Cuadro Multianual de Necesidades.",
        "Sin la necesidad en el CMN aprobado (o en su modificatoria) no se aprueba el expediente.",
        "La cuantía del PAC del CMN puede actualizarse con la interacción con el mercado.",
        "No programada con la necesidad ya en el CMN: la DEC segmenta al recibir el requerimiento (Art. 42.3, texto del D.S. 001-2026-EF).",
        "Catálogos electrónicos, no competitivos y supuestos excluidos no se segmentan.",
      ],
      casuisticas: [
        {
          enunciado:
            "A mitad de año surge una contratación no programada, pero la necesidad sí está incluida en el CMN respectivo. ¿La DEC espera a que el área usuaria pida modificar el CMN antes de segmentar?",
          resolucion:
            "No. Con la necesidad ya incluida en el CMN, la DEC efectúa la segmentación luego de la recepción del requerimiento (Art. 42.3, texto sustituido por el D.S. 001-2026-EF).",
          baseLegal: [{ norma: "Reglamento", articulo: "42" }],
        },
        {
          enunciado:
            "Perú Compras asume la compra centralizada de dos puentes para varias entidades. ¿Quién segmenta esa contratación y en qué categoría cae?",
          resolucion:
            "La segmentación la realiza la entidad encargada al inicio de las actuaciones preparatorias, y las compras centralizadas de obras se consideran en la categoría de contratación avanzada.",
          baseLegal: [{ norma: "Reglamento", articulo: "42" }],
        },
        {
          enunciado:
            "La DEC quiere segmentar una contratación que se hará por un catálogo electrónico de acuerdos marco. ¿Procede?",
          resolucion:
            "No. Los catálogos electrónicos de acuerdos marco, los procedimientos no competitivos y los supuestos excluidos no se segmentan.",
          baseLegal: [{ norma: "Reglamento", articulo: "42" }],
        },
      ],
      baseLegal: [
        { norma: "Ley 32069", articulo: "46" },
        { norma: "Ley 32069", articulo: "53" },
        { norma: "Reglamento", articulo: "3" },
        { norma: "Reglamento", articulo: "14" },
        { norma: "Reglamento", articulo: "42" },
        { norma: "Reglamento", articulo: "53" },
        { norma: "Reglamento", articulo: "54" },
        { norma: "Reglamento", articulo: "DCT-1" },
      ],
      verificada: true,
    },
  },
  {
    slug: "segmentacion-contrataciones",
    modulo: "V",
    temas: ["1.2"],
    titulo: "Segmentación de contrataciones",
    descripcion:
      "Cómo se clasifican las contrataciones del plan anual según cuantía y riesgo, para qué sirve esa clasificación y " +
      "cómo la DEC se la comunica a las áreas usuarias.",
    minutos: 8,
    contenido: {
      resumen: [
        {
          pregunta: "¿Qué es la segmentación y para qué sirve?",
          parrafos: [
            "Mediante la segmentación la entidad clasifica las contrataciones del PAC del CMN del ejercicio en curso, salvo " +
              "los contratos menores; y no se segmentan las contrataciones por catálogos electrónicos de acuerdos marco, los " +
              "procedimientos no competitivos ni los supuestos excluidos (Reglamento, Arts. 42.1 y 42.5), ni las " +
              "contrataciones por MDA (Reglamento, Art. 295.1). Ayuda a definir la estrategia de contratación, incluido el " +
              "tipo de interacción con el mercado, y a organizar los recursos de la DEC y de las áreas usuarias (Reglamento, " +
              "Art. 42).",
            "Es el punto de partida de las actuaciones preparatorias (Reglamento, Art. 41).",
          ],
        },
        {
          pregunta: "¿En qué categorías se segmentan bienes y servicios?",
          parrafos: [
            "Según cuantía y riesgo: rutinarios (baja cuantía y bajo riesgo), operacionales (alta cuantía y bajo riesgo), " +
              "críticos (baja cuantía y alto riesgo) y estratégicos (alta cuantía y alto riesgo) (Reglamento, Art. 125).",
            "Una contratación es de alta cuantía cuando su cuantía en el PAC del CMN supera el 10 % del monto total de las " +
              "contrataciones de bienes y servicios contempladas en él.",
          ],
        },
        {
          pregunta: "¿Qué hace la DEC después de segmentar?",
          parrafos: [
            "Informa por documento interno a todas las áreas usuarias la categoría de sus contrataciones y adjunta un " +
              "cronograma con las fechas estimadas para presentar los requerimientos, que considera los plazos de las " +
              "actuaciones preparatorias (Reglamento, Art. 42).",
          ],
        },
      ],
      puntosClave: [
        "Se segmenta el PAC del CMN del ejercicio, menos los contratos menores; los catálogos electrónicos, los no competitivos, los supuestos excluidos y el MDA no se segmentan.",
        "Cuatro categorías: rutinarios, operacionales, críticos y estratégicos.",
        "Alta cuantía: más del 10 % del monto total de bienes y servicios del PAC del CMN.",
        "La DEC comunica la categoría a las áreas usuarias con un cronograma para presentar requerimientos.",
      ],
      casuisticas: [
        {
          enunciado:
            "En el PAC del CMN, una contratación de servicios informáticos representa el 14 % del monto total destinado a bienes y servicios del año. ¿Es de alta cuantía?",
          resolucion:
            "Sí. La contratación es de alta cuantía cuando su cuantía en el PAC del CMN supera el 10 % del monto total de las contrataciones de bienes y servicios contempladas en él.",
          baseLegal: [{ norma: "Reglamento", articulo: "125" }],
        },
        {
          enunciado:
            "La compra anual de papelería y el arrendamiento de la plataforma de trámite documental están en el mismo PAC del CMN. ¿Qué categoría le toca a cada una?",
          resolucion:
            "La papelería es de baja cuantía y bajo riesgo: rutinaria. El arrendamiento de la plataforma, si es de alta cuantía y bajo riesgo: operacional. Las cuatro categorías se definen por cuantía y riesgo.",
          baseLegal: [{ norma: "Reglamento", articulo: "125" }],
        },
        {
          enunciado:
            "Un hospital programa una contratación por MDA y la DEC la segmenta «porque se segmenta todo el PAC». ¿Es correcto?",
          resolucion:
            "No. El MDA no se segmenta: sus actuaciones preparatorias aplican sin segmentación ni interacción con el mercado.",
          baseLegal: [{ norma: "Reglamento", articulo: "295" }],
        },
      ],
      baseLegal: [
        { norma: "Reglamento", articulo: "41" },
        { norma: "Reglamento", articulo: "42" },
        { norma: "Reglamento", articulo: "125" },
        { norma: "Reglamento", articulo: "295" },
      ],
      verificada: true,
    },
  },
  {
    slug: "actos-preparatorios",
    modulo: "VI",
    temas: ["1.2"],
    titulo: "Actos preparatorios",
    descripcion:
      "Lo que ocurre entre la segmentación y la convocatoria: requerimiento, interacción con el mercado, estrategia de " +
      "contratación y la prohibición de fraccionar.",
    minutos: 10,
    contenido: {
      resumen: [
        {
          pregunta: "¿Dónde empiezan y dónde terminan las actuaciones preparatorias?",
          parrafos: [
            "El proceso de contratación tiene tres fases: actuaciones preparatorias, selección y ejecución contractual " +
              "(Ley, Art. 45).",
            "Las actuaciones preparatorias van desde la segmentación del PAC del CMN hasta antes de la convocatoria e " +
              "incluyen el anuncio de contratación futura cuando corresponde, la estrategia de contratación, la aprobación " +
              "del expediente y la elaboración de las bases (Reglamento, Art. 41).",
          ],
        },
        {
          pregunta: "¿Quién formula el requerimiento?",
          parrafos: [
            "El requerimiento da inicio al proceso de contratación. Lo determina el área usuaria o el área técnica " +
              "estratégica en coordinación con la DEC, e identifica la finalidad pública y los objetivos de la " +
              "contratación (Ley, Art. 46).",
          ],
        },
        {
          pregunta: "¿Qué aportan la interacción con el mercado y la estrategia?",
          parrafos: [
            "La interacción con el mercado permite perfeccionar el requerimiento, actualizar la cuantía, medir la oferta y " +
              "la competencia y el riesgo de que el procedimiento se frustre. Puede ser indagación o consulta al mercado " +
              "(Ley, Art. 47; Reglamento, Art. 47).",
            "La estrategia de contratación la elabora la DEC y define, entre otros, el tipo de procedimiento de selección o " +
              "mecanismo de contratación, la modalidad de pago y la verificación de la estandarización del requerimiento " +
              "(Ley, Art. 49; Reglamento, Art. 46).",
          ],
        },
        {
          pregunta: "¿Qué es fraccionar?",
          parrafos: [
            "Está prohibido dividir una contratación en dos o más procedimientos, o en contratos menores, para evitar el " +
              "procedimiento que corresponde según la necesidad anual o para evadir la Ley y su Reglamento (Ley, Art. 50).",
          ],
        },
      ],
      puntosClave: [
        "Tres fases: actuaciones preparatorias, selección y ejecución contractual.",
        "El requerimiento lo determina el área usuaria (o la técnica estratégica) en coordinación con la DEC.",
        "Interacción con el mercado: indagación o consulta al mercado.",
        "La estrategia de contratación la elabora la DEC.",
        "Fraccionar para eludir el procedimiento que corresponde está prohibido.",
      ],
      casuisticas: [
        {
          enunciado:
            "El área usuaria propone dividir la adquisición anual de reactivos en cuatro contratos menores trimestrales «para agilizar». ¿Es válido?",
          resolucion:
            "No. Está prohibido fraccionar: dividir una contratación en dos o más procedimientos o contratos menores para evitar el procedimiento que corresponde según la necesidad anual o para evadir la Ley y su Reglamento.",
          baseLegal: [{ norma: "Ley 32069", articulo: "50" }],
        },
        {
          enunciado:
            "La DEC recibe del área usuaria un requerimiento ya cerrado, sin haber participado en su formulación. ¿Cumple el proceso?",
          resolucion:
            "No. El requerimiento lo determina el área usuaria o el área técnica estratégica en coordinación con la DEC, e identifica la finalidad pública y los objetivos de la contratación.",
          baseLegal: [{ norma: "Ley 32069", articulo: "46" }],
        },
        {
          enunciado:
            "Ante un requerimiento con poca oferta en el mercado, la DEC quiere obligar a todos los proveedores a una consulta al mercado. ¿Puede?",
          resolucion:
            "La interacción con el mercado sirve para perfeccionar el requerimiento, actualizar la cuantía y medir la oferta y el riesgo, y puede ser indagación o consulta al mercado: la DEC elige el tipo, no impone uno solo.",
          baseLegal: [
            { norma: "Ley 32069", articulo: "47" },
            { norma: "Reglamento", articulo: "47" },
          ],
        },
      ],
      baseLegal: [
        { norma: "Ley 32069", articulo: "45" },
        { norma: "Ley 32069", articulo: "46" },
        { norma: "Ley 32069", articulo: "47" },
        { norma: "Ley 32069", articulo: "49" },
        { norma: "Ley 32069", articulo: "50" },
        { norma: "Reglamento", articulo: "41" },
        { norma: "Reglamento", articulo: "46" },
        { norma: "Reglamento", articulo: "47" },
      ],
      verificada: true,
    },
  },
  {
    slug: "evaluadores",
    modulo: "VII",
    temas: ["1.3"],
    titulo: "Evaluadores",
    descripcion:
      "Oficial de compra, comité y jurado: cómo se conforma cada uno, quién los designa y qué responsabilidad tienen en " +
      "la fase de selección.",
    minutos: 8,
    contenido: {
      resumen: [
        {
          pregunta: "¿Quiénes pueden ser evaluadores?",
          parrafos: [
            "Los procedimientos de selección competitivos están a cargo de evaluadores: compradores públicos de la DEC, " +
              "comités o jurados. Los comités y jurados cuentan con expertos en el objeto de la contratación (Ley, Art. 52).",
          ],
        },
        {
          pregunta: "¿Cómo se conforma cada tipo?",
          parrafos: [
            "Oficial de compra: un comprador público de la DEC, designado por la DEC; puede estar en más de un " +
              "procedimiento a la vez (Reglamento, Arts. 56 y 58).",
            "Comité: tres integrantes, de los cuales al menos uno es comprador público de la DEC y uno es experto o " +
              "profesional con conocimiento técnico o experiencia en el objeto. La autoridad de la gestión administrativa " +
              "designa a titulares y suplentes (Reglamento, Arts. 56 y 59).",
            "Jurado: tres o cinco expertos en el objeto, designados por la autoridad de la gestión administrativa junto con " +
              "un suplente. Cada jurado evalúa individualmente y el puntaje total considera los puntajes de todos " +
              "(Reglamento, Arts. 56 y 60).",
          ],
        },
        {
          pregunta: "¿De qué responde cada uno?",
          parrafos: [
            "El oficial de compra o el comité conduce la fase de selección, incluida la preparación de las bases. Si el " +
              "evaluador es un jurado, este evalúa las ofertas y la DEC se encarga del resto de actuaciones del " +
              "procedimiento (Reglamento, Art. 56).",
            "Excepción: en los procedimientos con subetapas de negociación o diálogo competitivo, el jurado conduce las " +
              "rondas y decide de forma colegiada y por mayoría; se integra además por al menos un servidor del área " +
              "usuaria, que la representa y emite la no objeción a las modificaciones del requerimiento (Reglamento, " +
              "Art. 60.4).",
            "Sus decisiones son autónomas y constan en actas registradas en la Pladicop. Antes de ser designados presentan " +
              "una declaración jurada de no tener conflicto de intereses (Reglamento, Art. 56). Comités y jurados no " +
              "pueden alterar el expediente, salvo los factores de evaluación y las excepciones del Reglamento (Ley, Art. 52).",
          ],
        },
      ],
      puntosClave: [
        "Tres tipos de evaluador: oficial de compra, comité y jurado.",
        "Comité: tres integrantes, al menos un comprador público de la DEC y un experto o profesional en el objeto.",
        "Jurado: tres o cinco expertos, que evalúan individualmente.",
        "Comité y jurado los designa la autoridad de la gestión administrativa; el oficial de compra, la DEC.",
        "Con negociación o diálogo competitivo, el jurado conduce las rondas, no la DEC.",
        "Declaración jurada de no tener conflicto de intereses antes de la designación.",
      ],
      casuisticas: [
        {
          enunciado:
            "Un concurso público con subetapa de diálogo competitivo está a cargo de un jurado. ¿Quién conduce las rondas del diálogo?",
          resolucion:
            "El jurado conduce las rondas y determina de forma colegiada y por mayoría las decisiones; además, está conformado por al menos un servidor del área usuaria, que la representa y emite la no objeción a las modificaciones del requerimiento.",
          baseLegal: [{ norma: "Reglamento", articulo: "60" }],
        },
        {
          enunciado:
            "La DEC designa un comité de dos integrantes: un comprador público y un experto. ¿Es válido?",
          resolucion:
            "No. El comité son tres integrantes, de los cuales al menos uno es comprador público de la DEC y uno experto o profesional con conocimiento técnico o experiencia en el objeto; titulares y suplentes los designa la autoridad de la gestión administrativa.",
          baseLegal: [
            { norma: "Reglamento", articulo: "56" },
            { norma: "Reglamento", articulo: "59" },
          ],
        },
        {
          enunciado:
            "El único comprador público certificado ya conduce otros dos procedimientos. ¿Puede ser oficial de compra de un tercero?",
          resolucion:
            "Sí. Un oficial de compra puede ser designado en más de un procedimiento de selección simultáneamente; lo designa la DEC.",
          baseLegal: [{ norma: "Reglamento", articulo: "58" }],
        },
      ],
      baseLegal: [
        { norma: "Ley 32069", articulo: "52" },
        { norma: "Reglamento", articulo: "56" },
        { norma: "Reglamento", articulo: "58" },
        { norma: "Reglamento", articulo: "59" },
        { norma: "Reglamento", articulo: "60" },
      ],
      verificada: true,
    },
  },
];
