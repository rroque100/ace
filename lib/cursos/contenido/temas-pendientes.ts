import type { Clase } from "../tipos";

// Clases de la fase 3: los 8 temas del temario oficial del examen que no tenían clase (1.4, 1.8, 2.3, 2.6, 3.4, 3.7,
// 3.8 y 3.11). Pesan poco cada uno (1 o 2 de 72 preguntas), pero juntos son ≈9 preguntas del examen y el banco del
// simulador los pregunta con plazos y reglas exactas. Cada clase sale de lo que el banco pregunta de su tema.
//
// Verificado contra el corpus del RAG: Reglamento (texto al 09.01.2026). Donde el D.S. 001-2026-EF modificó un numeral
// se usa el texto modificado (43, 55.2, 75.1, 170.4, 188.1, 215.1 y 215.2), que es el que evalúa el banco.

export const TEMAS_PENDIENTES: Clase[] = [
  {
    slug: "bases-anuncio-pladicop-preparatorias",
    modulo: "XXVII",
    temas: ["1.4", "1.8"],
    titulo: "Bases estándar, anuncio y Pladicop en las actuaciones preparatorias",
    descripcion:
      "Quién elabora las bases y qué puede ajustar de las bases estándar, el anuncio de contratación futura y qué se " +
      "publica en la Pladicop antes de convocar.",
    minutos: 9,
    contenido: {
      resumen: [
        {
          pregunta: "¿Quién elabora las bases y qué contienen?",
          parrafos: [
            "Las bases fijan las reglas del procedimiento. Las elabora el oficial de compra o el comité, o la DEC si se " +
              "designó un jurado, a partir del expediente de contratación. Incluyen como mínimo el requerimiento, los " +
              "documentos para presentar ofertas y las condiciones para la ejecución contractual. Las bases estándar las " +
              "aprueba la DGA por directiva y son de uso obligatorio para los evaluadores (Reglamento, Art. 55).",
          ],
        },
        {
          pregunta: "¿Qué se puede cambiar de los factores de evaluación?",
          parrafos: [
            "Las bases estándar incluyen factores obligatorios y facultativos (Reglamento, Art. 73). Al elaborar las bases, " +
              "el oficial de compra o el comité pueden adicionar, suprimir o ajustar los factores facultativos de la " +
              "estrategia, respetando la evaluación, acreditación, puntaje y metodología previstos en las bases estándar " +
              "(Reglamento, Art. 55.2, texto modificado).",
            "Con jurado, la DEC puede remitir las bases a sus integrantes antes de convocar; sus propuestas deben respetar " +
              "las bases estándar e ir con su sustento, y la DEC decide si las incorpora.",
          ],
        },
        {
          pregunta: "¿Qué es el anuncio de contratación futura?",
          parrafos: [
            "La DEC puede publicarlo en la Pladicop y en la sede digital, de contar con ella, antes de la convocatoria en " +
              "los procedimientos cuya base estándar lo contemple, para dar a conocer pronto la intención de convocar. " +
              "Contiene los datos de la entidad, la descripción preliminar del requerimiento (alcance, plazo y cantidad " +
              "aproximada), el tipo de procedimiento y la fecha aproximada de convocatoria (Reglamento, Art. 43).",
            "No es lo mismo que la difusión del requerimiento: el anuncio informa una intención; la difusión recibe y " +
              "absuelve consultas técnicas y publica su resultado (Reglamento, Art. 51).",
          ],
        },
        {
          pregunta: "¿Y si la Pladicop aún no permite hacer una actuación preparatoria?",
          parrafos: [
            "Mientras se implementan las funcionalidades para que las actuaciones preparatorias y la ejecución contractual " +
              "se realicen a través de la Pladicop, las entidades pueden seguir usando los medios físicos y digitales a su " +
              "disposición, conforme a la LPAG (Reglamento, Decimotercera Disposición Complementaria Transitoria).",
          ],
        },
      ],
      puntosClave: [
        "Bases: las elabora el oficial de compra o el comité; con jurado, la DEC.",
        "Bases estándar de la DGA: obligatorias para los evaluadores.",
        "Solo los factores facultativos se ajustan, respetando la metodología de las bases estándar.",
        "Con jurado, la DEC decide si incorpora las propuestas de sus integrantes.",
        "Anuncio de contratación futura ≠ difusión del requerimiento.",
      ],
      casuisticas: [
        {
          enunciado:
            "El comité elabora las bases y quiere cambiar la forma de puntuar un factor facultativo, apartándose de la " +
            "metodología de las bases estándar. ¿Puede hacerlo?",
          resolucion:
            "No. Puede adicionar, suprimir o ajustar factores facultativos, pero respetando la evaluación, acreditación, " +
            "puntaje y metodología que fijan las bases estándar, que son de uso obligatorio.",
          baseLegal: [{ norma: "Reglamento", articulo: "55" }],
        },
        {
          enunciado:
            "El evaluador prepara bases con el requerimiento y los documentos para presentar ofertas, pero deja fuera las " +
            "condiciones de ejecución para «acordarlas con el ganador». ¿Es válido?",
          resolucion:
            "No. Las bases incluyen como mínimo las condiciones para la ejecución contractual, además del requerimiento " +
            "y de los documentos para presentar ofertas.",
          baseLegal: [{ norma: "Reglamento", articulo: "55" }],
        },
        {
          enunciado:
            "La DEC publicó en la Pladicop la intención de comprar lectores, con alcance preliminar y fecha aproximada " +
            "de convocatoria, y sostiene que con eso ya hizo la difusión del requerimiento. ¿Tiene razón?",
          resolucion:
            "No. Eso es un anuncio de contratación futura, que solo informa la intención de convocar. La difusión del " +
            "requerimiento exige recibir y absolver consultas técnicas y publicar su resultado.",
          baseLegal: [
            { norma: "Reglamento", articulo: "43" },
            { norma: "Reglamento", articulo: "51" },
          ],
        },
      ],
      baseLegal: [
        { norma: "Reglamento", articulo: "43" },
        { norma: "Reglamento", articulo: "51" },
        { norma: "Reglamento", articulo: "55" },
        { norma: "Reglamento", articulo: "73" },
        { norma: "Reglamento", articulo: "DCT-13" },
      ],
      verificada: true,
    },
  },
  {
    slug: "pladicop-seleccion",
    modulo: "XXVIII",
    temas: ["2.6"],
    titulo: "Pladicop en la selección: participantes, cronograma y acceso a la información",
    descripcion:
      "Qué se registra en la Pladicop durante la selección: la convocatoria, los participantes, los cambios de " +
      "cronograma, la elevación de cuestionamientos y el acceso al expediente tras la buena pro.",
    minutos: 9,
    contenido: {
      resumen: [
        {
          pregunta: "¿Cuándo empieza la selección y cómo se cambia el cronograma?",
          parrafos: [
            "La fase de selección empieza con la publicación del aviso de convocatoria en la Pladicop (Reglamento, Art. 63). " +
              "Si se prorroga o posterga una etapa, se registra en la Pladicop modificando el cronograma inicial " +
              "(Reglamento, Art. 64.2).",
          ],
        },
        {
          pregunta: "¿Cómo se registran los participantes?",
          parrafos: [
            "El registro es gratuito, a través de la Pladicop y según el cronograma; el proveedor necesita inscripción " +
              "vigente en el RNP conforme al objeto. Va desde el día siguiente de la convocatoria hasta antes del inicio de " +
              "la presentación de ofertas; si hay precalificación, concluye antes de esa etapa. Quien se registra se adhiere " +
              "al procedimiento en el estado en que se encuentre (Reglamento, Art. 65).",
            "Según la modalidad, el registro es de lista abierta, lista abierta con invitación o lista cerrada; las " +
              "invitaciones se hacen por la Pladicop y están a cargo de la DEC.",
          ],
        },
        {
          pregunta: "¿Quién eleva los cuestionamientos a las bases?",
          parrafos: [
            "En los procedimientos que permiten cuestionar el pliego de absolución de consultas y observaciones y las " +
              "bases integradas, la entidad los eleva al OECE a través de la Pladicop; se sustentan en vulneraciones a la " +
              "normativa de contrataciones, a sus principios u otra normativa vinculada al objeto (Reglamento, Art. 67, " +
              "texto modificado).",
          ],
        },
        {
          pregunta: "¿Qué información se puede ver y cuándo?",
          parrafos: [
            "Durante la evaluación no se da a conocer nada del análisis, subsanación y evaluación de las ofertas hasta que " +
              "se publique el otorgamiento de la buena pro. Otorgada, la DEC debe permitir el acceso al expediente a " +
              "participantes y postores a más tardar el día hábil siguiente de solicitado por escrito, salvo la información " +
              "secreta, confidencial o reservada y la de ofertas no admitidas (Reglamento, Art. 79).",
          ],
        },
      ],
      puntosClave: [
        "La selección empieza con la convocatoria publicada en la Pladicop.",
        "Prórrogas y postergaciones: se registran en la Pladicop modificando el cronograma.",
        "Registro de participantes: gratuito, con RNP vigente, desde el día siguiente de la convocatoria hasta antes de las ofertas.",
        "Nada de la evaluación se revela antes de publicar la buena pro.",
        "Tras la buena pro: acceso al expediente a más tardar el día hábil siguiente de pedirlo por escrito.",
      ],
      casuisticas: [
        {
          enunciado:
            "La entidad envía el lunes las bases por correo a proveedores y las publica en su web, pero recién el jueves " +
            "publica la convocatoria en la Pladicop. Un proveedor intenta registrarse el miércoles. ¿Puede?",
          resolucion:
            "No. La selección empieza con la publicación de la convocatoria en la Pladicop (el jueves) y el registro de " +
            "participantes corre desde el día siguiente: podrá registrarse desde el viernes.",
          baseLegal: [
            { norma: "Reglamento", articulo: "63" },
            { norma: "Reglamento", articulo: "65" },
          ],
        },
        {
          enunciado:
            "Mientras el comité termina de evaluar, uno de sus integrantes avisa por correo a un postor que «probablemente " +
            "ganará». ¿Es correcto?",
          resolucion:
            "No. Durante la evaluación no se da a conocer información alguna sobre el análisis, la subsanación y la " +
            "evaluación de las ofertas hasta que se publique el otorgamiento de la buena pro.",
          baseLegal: [{ norma: "Reglamento", articulo: "79" }],
        },
        {
          enunciado:
            "Hay que postergar la etapa de presentación de ofertas de un procedimiento ya convocado. ¿Qué se hace en la " +
            "Pladicop?",
          resolucion:
            "Registrar la postergación en la Pladicop modificando el cronograma inicial del procedimiento.",
          baseLegal: [{ norma: "Reglamento", articulo: "64" }],
        },
      ],
      baseLegal: [
        { norma: "Reglamento", articulo: "63" },
        { norma: "Reglamento", articulo: "64" },
        { norma: "Reglamento", articulo: "65" },
        { norma: "Reglamento", articulo: "67" },
        { norma: "Reglamento", articulo: "79" },
      ],
      verificada: true,
    },
  },
  {
    slug: "evaluacion-ofertas-desempate",
    modulo: "XXIX",
    temas: ["2.3"],
    titulo: "Evaluación de ofertas y desempate",
    descripcion:
      "Cómo se evalúan las ofertas técnica y económicamente, la fórmula del puntaje económico, los topes de puntaje y " +
      "el orden para desempatar.",
    minutos: 10,
    contenido: {
      resumen: [
        {
          pregunta: "¿Con qué se evalúan las ofertas?",
          parrafos: [
            "Con los factores de evaluación de las bases integradas, cuyo objetivo es seleccionar la mejor oferta conforme " +
              "al principio de valor por dinero. Las bases estándar traen factores obligatorios y facultativos y la " +
              "ponderación de la evaluación técnica y económica (Reglamento, Art. 73). No se pueden crear factores que no " +
              "estén en las bases integradas.",
          ],
        },
        {
          pregunta: "¿Cómo se evalúa la oferta económica?",
          parrafos: [
            "Según el procedimiento, de manera simultánea a la técnica (la oferta económica es un factor más), de manera " +
              "posterior (solo para quienes alcanzan el puntaje técnico mínimo) o con lances en línea (Reglamento, Art. 74).",
            "El mayor puntaje va al menor monto, y los demás reciben puntajes inversamente proporcionales: Po = Mb × Pmax / " +
              "Mo, donde Mb es la oferta más baja y Mo la que se evalúa. Esa fórmula no se aplica a la subasta inversa ni a " +
              "la comparación de precios, donde la buena pro va al menor monto.",
          ],
        },
        {
          pregunta: "¿Cuáles son los topes de puntaje?",
          parrafos: [
            "En la evaluación simultánea los factores suman 100 puntos y la oferta económica no puede superar 40, salvo en " +
              "la licitación pública abreviada de bienes homologados, donde puede llegar a 70 (Reglamento, Art. 75.1, texto " +
              "modificado). Si la evaluación económica es posterior, cada evaluación vale hasta 100 puntos y el total es un " +
              "promedio ponderado (Reglamento, Art. 75).",
          ],
        },
        {
          pregunta: "¿Cómo se desempata?",
          parrafos: [
            "En este orden: mejor puntaje técnico; micro o pequeña empresa integrada por personas con discapacidad (o " +
              "consorcio formado íntegramente por ellas); micro o pequeña empresa (o consorcio formado íntegramente por " +
              "ellas), siempre que estén acreditadas; y, por último, sorteo (Reglamento, Art. 81).",
          ],
        },
      ],
      puntosClave: [
        "Se evalúa solo con los factores de las bases integradas.",
        "Puntaje económico: Po = Mb × Pmax / Mo (no en subasta inversa ni comparación de precios).",
        "Simultánea: 100 puntos; económica ≤ 40 (≤ 70 en LPA de bienes homologados).",
        "Posterior: técnica y económica valen 100 cada una; total = promedio ponderado.",
        "Empate: técnico → MYPE de personas con discapacidad → MYPE → sorteo.",
      ],
      casuisticas: [
        {
          enunciado:
            "Dos ofertas empatan en puntaje total: una tiene mejor puntaje técnico y la otra es de una MYPE debidamente " +
            "acreditada. ¿A quién se otorga la buena pro?",
          resolucion:
            "A la de mejor puntaje técnico: es el primer criterio de desempate; la condición de MYPE solo se mira si " +
            "siguen empatadas.",
          baseLegal: [{ norma: "Reglamento", articulo: "81" }],
        },
        {
          enunciado:
            "En una evaluación simultánea con 40 puntos para la oferta económica, la más baja es S/ 90 000. ¿Cuánto obtiene " +
            "una oferta de S/ 100 000?",
          resolucion:
            "36 puntos: Po = Mb × Pmax / Mo = 90 000 × 40 / 100 000. La oferta más baja obtiene los 40.",
          baseLegal: [{ norma: "Reglamento", articulo: "74" }],
        },
        {
          enunciado:
            "En una licitación pública (que no es abreviada de bienes homologados) con evaluación simultánea, el comité " +
            "quiere dar 50 puntos a la oferta económica. ¿Puede?",
          resolucion:
            "No. En la evaluación simultánea la oferta económica no puede superar 40 puntos; el tope de 70 solo se admite " +
            "en la licitación pública abreviada para bienes homologados.",
          baseLegal: [{ norma: "Reglamento", articulo: "75" }],
        },
        {
          enunciado:
            "Un integrante del comité propone, durante la evaluación, dar puntos extra a un proveedor «conocido por la " +
            "entidad», aunque ese factor no está en las bases integradas. ¿Procede?",
          resolucion:
            "No. Las ofertas se evalúan con los factores establecidos en las bases integradas; no se crean factores " +
            "durante la evaluación.",
          baseLegal: [{ norma: "Reglamento", articulo: "73" }],
        },
      ],
      baseLegal: [
        { norma: "Reglamento", articulo: "73" },
        { norma: "Reglamento", articulo: "74" },
        { norma: "Reglamento", articulo: "75" },
        { norma: "Reglamento", articulo: "81" },
      ],
      verificada: true,
    },
  },
  {
    slug: "recepcion-conformidad-bienes-servicios",
    modulo: "XXX",
    temas: ["3.4"],
    titulo: "Recepción y conformidad de bienes y servicios",
    descripcion:
      "Quién da la conformidad y en qué plazo, cómo se tramitan las observaciones, cuándo hay o no penalidad y qué es " +
      "la constancia de prestación.",
    minutos: 9,
    contenido: {
      resumen: [
        {
          pregunta: "¿Quién da la conformidad y en qué plazo?",
          parrafos: [
            "El área usuaria, verificando el cumplimiento de las especificaciones técnicas o términos de referencia (y el " +
              "control de calidad en bienes, si se previó). La emite en un máximo de 7 días desde el día siguiente de " +
              "recibido el entregable; en consultorías, o si hay que hacer pruebas, el plazo es de hasta 20 días. La sola " +
              "recepción de los bienes no constituye conformidad (Reglamento, Art. 144).",
          ],
        },
        {
          pregunta: "¿Qué pasa si hay observaciones?",
          parrafos: [
            "La DEC las comunica al contratista y le da un plazo para subsanar según su complejidad, que no puede ser mayor " +
              "del 30 % del plazo del entregable. Si subsana dentro del plazo, no hay penalidad. La entidad tiene el mismo " +
              "plazo para pronunciarse sobre el levantamiento, y los días que se retrase no se imputan al contratista " +
              "(Reglamento, Art. 144).",
            "Si el contratista no subsana a cabalidad, la entidad puede darle periodos adicionales —con penalidad por mora " +
              "desde el vencimiento del plazo inicial— o resolver el contrato. Si lo entregado manifiestamente no cumple, no " +
              "se recibe ni se da conformidad: la prestación se considera no ejecutada.",
          ],
        },
        {
          pregunta: "¿Qué es la constancia de prestación?",
          parrafos: [
            "Se genera con lo que la entidad registra en la Pladicop: contrato, objeto, monto vigente, plazo y penalidades. " +
              "Aparece en el FUP del proveedor una vez registrada la conformidad de la prestación final (bienes y servicios) " +
              "o consentida la liquidación (obras y consultorías de obra). Si la DEC no registró la información, el " +
              "contratista puede pedirla directamente a la entidad (Reglamento, Art. 124).",
          ],
        },
      ],
      puntosClave: [
        "Conformidad: la da el área usuaria; 7 días (20 en consultorías o con pruebas).",
        "Recibir los bienes no es dar conformidad.",
        "Subsanación: hasta el 30 % del plazo del entregable; subsanado a tiempo, sin penalidad.",
        "Los días de retraso de la entidad no se imputan al contratista.",
        "Incumplimiento manifiesto: no se recibe; la prestación se tiene por no ejecutada.",
      ],
      casuisticas: [
        {
          enunciado:
            "Un servicio tiene un entregable con plazo de 20 días. Se entregó a tiempo con defectos subsanables. ¿Cuánto " +
            "plazo máximo puede dar la DEC para subsanar?",
          resolucion:
            "Hasta 6 días: el plazo de subsanación no puede superar el 30 % del plazo del entregable (30 % de 20 días).",
          baseLegal: [{ norma: "Reglamento", articulo: "144" }],
        },
        {
          enunciado:
            "El proveedor dejó los bienes en el almacén y recibió constancia de recepción física. El área usuaria aún no " +
            "verifica el cumplimiento técnico. ¿Hay conformidad?",
          resolucion:
            "No. La sola recepción de los bienes no constituye conformidad; la da el área usuaria tras verificar el " +
            "cumplimiento de las especificaciones técnicas.",
          baseLegal: [{ norma: "Reglamento", articulo: "144" }],
        },
        {
          enunciado:
            "El contratista levantó las observaciones a tiempo, pero la entidad tardó 4 días más de lo previsto en " +
            "pronunciarse. ¿Esos días cuentan como mora del contratista?",
          resolucion:
            "No. Cuando la entidad excede el plazo para pronunciarse sobre el levantamiento de observaciones, los días de " +
            "retraso no se imputan al contratista para aplicar penalidades.",
          baseLegal: [{ norma: "Reglamento", articulo: "144" }],
        },
      ],
      baseLegal: [
        { norma: "Reglamento", articulo: "124" },
        { norma: "Reglamento", articulo: "144" },
      ],
      verificada: true,
    },
  },
  {
    slug: "obra-expediente-residente-supervision",
    modulo: "XXXI",
    temas: ["3.7", "3.8"],
    titulo: "Obra I: expediente técnico, residente, supervisión y gerente de proyecto",
    descripcion:
      "Cómo se revisa y aprueba el expediente técnico de obra, quién es responsable de elaborarlo, y las reglas del " +
      "residente, la supervisión, el cuaderno de incidencias y el gerente de proyecto.",
    minutos: 11,
    contenido: {
      resumen: [
        {
          pregunta: "¿Qué exige el expediente técnico y quién responde por él?",
          parrafos: [
            "Debe guardar coherencia con los objetivos, alcances y parámetros que sustentan la viabilidad o aprobación de " +
              "la inversión. Lo elabora la entidad, un contratista de consultoría bajo supervisión o el contratista de " +
              "diseño y construcción (Reglamento, Art. 170). Si lo elabora un contratista, este designa a un jefe de " +
              "elaboración, ingeniero o arquitecto colegiado y habilitado, que es su responsable técnico (Reglamento, " +
              "Art. 172).",
            "El órgano competente lo aprueba en no más de 10 días hábiles desde la conformidad otorgada al contratista que " +
              "lo elaboró (Reglamento, Art. 173).",
          ],
        },
        {
          pregunta: "¿Cómo se revisa en solo construcción?",
          parrafos: [
            "El contratista presenta a la entidad y al supervisor un informe técnico de revisión del expediente dentro de " +
              "los 12 días siguientes a la suscripción del contrato, con las posibles deficiencias, adicionales y riesgos. " +
              "El supervisor lo remite con su evaluación en 5 días y la entidad se pronuncia en un máximo de 10 días desde " +
              "recibido el informe del supervisor. Esa revisión no impide aprobar después modificaciones no advertidas " +
              "(Reglamento, Art. 171).",
          ],
        },
        {
          pregunta: "¿Qué reglas tiene el residente?",
          parrafos: [
            "Desde el inicio de la obra hay un residente permanente y exclusivo: ingeniero o arquitecto colegiado y " +
              "habilitado, con no menos de 2 años de experiencia como residente, jefe de supervisión o similar. Representa " +
              "al contratista como responsable técnico, pero no puede pactar modificaciones al contrato, y no presta " +
              "servicios en más de una obra a la vez, salvo obras convocadas por paquete (Reglamento, Art. 177).",
          ],
        },
        {
          pregunta: "¿Y la supervisión, el cuaderno y el gerente de proyecto?",
          parrafos: [
            "La supervisión la hace un inspector (servidor de la entidad) o un supervisor (contratado, con un jefe de " +
              "supervisión con al menos la experiencia del residente); nunca ambos a la vez, y el supervisor no puede ser " +
              "ejecutor en el mismo proyecto. La cuantía a partir de la cual es obligatorio un supervisor la fija la Ley de " +
              "Presupuesto (Reglamento, Art. 186). La supervisión vela por la correcta ejecución y no puede modificar el " +
              "contrato (Reglamento, Art. 187).",
            "El cuaderno de incidencias es digital y forma parte de la Pladicop: registra los hechos de la ejecución de la " +
              "obra o de la elaboración del expediente, las consultas y sus respuestas (Reglamento, Art. 188, texto " +
              "modificado). En los contratos estandarizados de uso internacional, la entidad asigna un gerente de " +
              "proyecto con al menos 5 años de experiencia y certificación oficial en el contrato elegido (Reglamento, " +
              "Art. 222).",
          ],
        },
      ],
      puntosClave: [
        "Revisión del expediente en solo construcción: contratista 12 días, supervisor 5, entidad 10.",
        "Aprobación del expediente: ≤ 10 días hábiles desde la conformidad al consultor.",
        "Residente: permanente y exclusivo, ≥ 2 años; no pacta modificaciones; una sola obra salvo paquete.",
        "Inspector o supervisor, nunca los dos a la vez; la supervisión no modifica el contrato.",
        "Gerente de proyecto (contratos estandarizados): ≥ 5 años y certificación oficial en ese contrato.",
      ],
      casuisticas: [
        {
          enunciado:
            "En una obra de solo construcción, el informe inicial del contratista no detectó una deficiencia del " +
            "expediente que aparece meses después. Se propone rechazar toda modificación por no haberla advertido. ¿Es " +
            "correcto?",
          resolucion:
            "No. La revisión inicial no impide aprobar modificaciones contractuales no advertidas en ese informe; deben " +
            "verificarse los demás requisitos de cada modificación.",
          baseLegal: [{ norma: "Reglamento", articulo: "171" }],
        },
        {
          enunciado:
            "Un contratista quiere que su residente atienda a la vez dos obras distintas, que no se convocaron por " +
            "paquete. ¿Puede?",
          resolucion:
            "No. El residente es permanente y exclusivo y no presta servicios en más de una obra a la vez, salvo en obras " +
            "convocadas por paquete.",
          baseLegal: [{ norma: "Reglamento", articulo: "177" }],
        },
        {
          enunciado:
            "Para gestionar un contrato estandarizado de uso internacional, la entidad propone un profesional con la " +
            "titulación y experiencia exigidas, pero sin certificación oficial en ese contrato. ¿Cumple?",
          resolucion:
            "No. El gerente de proyecto debe tener, además de al menos 5 años de experiencia, certificación oficial en el " +
            "contrato estandarizado elegido.",
          baseLegal: [{ norma: "Reglamento", articulo: "222" }],
        },
      ],
      baseLegal: [
        { norma: "Reglamento", articulo: "170" },
        { norma: "Reglamento", articulo: "171" },
        { norma: "Reglamento", articulo: "172" },
        { norma: "Reglamento", articulo: "173" },
        { norma: "Reglamento", articulo: "177" },
        { norma: "Reglamento", articulo: "186" },
        { norma: "Reglamento", articulo: "187" },
        { norma: "Reglamento", articulo: "188" },
        { norma: "Reglamento", articulo: "222" },
      ],
      verificada: true,
    },
  },
  {
    slug: "obra-valorizacion-recepcion-liquidacion",
    modulo: "XXXII",
    temas: ["3.11"],
    titulo: "Obra II: valorización, recepción y liquidación",
    descripcion:
      "Cómo se valoriza y paga la obra, el procedimiento de recepción con su pliego de observaciones y los plazos de la " +
      "liquidación y su consentimiento.",
    minutos: 11,
    contenido: {
      resumen: [
        {
          pregunta: "¿Cómo se valoriza y paga la obra?",
          parrafos: [
            "Las valorizaciones son mensuales y se consideran pagos a cuenta, salvo que las bases fijen otro periodo; " +
              "incluyen adicionales y mayores metrados. Residente y supervisor revisan juntos los metrados; el contratista " +
              "presenta la valorización dentro de los 3 primeros días del mes siguiente, el supervisor informa en 5 días y " +
              "la entidad la evalúa y paga hasta el último día del mes en que se presentó (Reglamento, Art. 210).",
            "Los reajustes se aplican con las fórmulas polinómicas del expediente técnico aprobado, conforme a la " +
              "directiva de la DGA (Reglamento, Art. 209).",
          ],
        },
        {
          pregunta: "¿Cómo se recibe la obra?",
          parrafos: [
            "Culminada la obra, el contratista la pide al supervisor por el cuaderno; el supervisor remite el certificado " +
              "de conformidad técnica en 5 días. La entidad designa un comité de recepción en 5 días hábiles (el supervisor " +
              "no lo integra), que verifica en obra en un plazo no mayor de 15 días. Sin observaciones se firma el acta; con " +
              "observaciones, se emite un pliego y no se recibe (Reglamento, Art. 212).",
            "Para subsanar, el contratista tiene un décimo del plazo de ejecución vigente o 40 días, el que resulte menor. " +
              "Al verificar el levantamiento, el comité solo revisa esas observaciones: no puede formular nuevas. Las " +
              "discrepancias las resuelve la autoridad de la gestión administrativa, de forma indelegable.",
          ],
        },
        {
          pregunta: "¿Cómo se liquida?",
          parrafos: [
            "En obra, el contratista presenta la liquidación en 30 días; la otra parte se pronuncia en 50 días calendario; y " +
              "se contesta en 15 días. En consultoría de obra los plazos son 15, 30 días calendario y 15. Si el contratista no " +
              "la presenta, empieza el plazo de la entidad (Reglamento, Art. 215).",
            "Si quien la recibe no se pronuncia a tiempo, la liquidación queda consentida; si quien la presentó no subsana " +
              "las observaciones, queda consentida con ellas. Consentida, se hace el pago final, se devuelve la garantía de " +
              "fiel cumplimiento y se cierra el expediente.",
          ],
        },
      ],
      puntosClave: [
        "Valorización: mensual y como pago a cuenta; presentada en los 3 primeros días del mes siguiente.",
        "Recepción: certificado del supervisor en 5 días, comité en 5 días hábiles, verificación en ≤ 15 días.",
        "Subsanación del pliego: un décimo del plazo vigente o 40 días, el menor.",
        "Al verificar el levantamiento no se formulan nuevas observaciones.",
        "Liquidación de obra: 30 días para presentarla, 50 días calendario para pronunciarse, 15 para contestar.",
        "Silencio de quien recibe la liquidación: queda consentida.",
      ],
      casuisticas: [
        {
          enunciado:
            "Una obra con plazo de ejecución vigente de 300 días recibe un pliego de observaciones. ¿Cuánto plazo tiene " +
            "el contratista para subsanarlas? ¿Y si el plazo vigente fuera de 500 días?",
          resolucion:
            "30 días en el primer caso (un décimo de 300, menor que 40) y 40 días en el segundo (un décimo de 500 serían 50, " +
            "pero manda el menor de los dos).",
          baseLegal: [{ norma: "Reglamento", articulo: "212" }],
        },
        {
          enunciado:
            "El contratista comunica que levantó las observaciones. Al verificar, el comité de recepción encuentra otros " +
            "detalles menores no observados antes y quiere añadirlos al pliego. ¿Puede?",
          resolucion:
            "No. Al verificar el levantamiento, el comité revisa únicamente las observaciones formuladas; no puede " +
            "formular nuevas observaciones.",
          baseLegal: [{ norma: "Reglamento", articulo: "212" }],
        },
        {
          enunciado:
            "El contratista presentó la liquidación de una obra y la entidad no se pronunció dentro de los 50 días " +
            "calendario. ¿Qué pasa?",
          resolucion:
            "La liquidación queda consentida o aprobada. Consentida, corresponde el pago final, la devolución de la " +
            "garantía de fiel cumplimiento y el cierre del expediente.",
          baseLegal: [{ norma: "Reglamento", articulo: "215" }],
        },
      ],
      baseLegal: [
        { norma: "Reglamento", articulo: "209" },
        { norma: "Reglamento", articulo: "210" },
        { norma: "Reglamento", articulo: "212" },
        { norma: "Reglamento", articulo: "215" },
      ],
      verificada: true,
    },
  },
];
