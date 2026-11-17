import type { Clase } from "../tipos";

// Contenido verificado contra el corpus del RAG (ver la cabecera de actos-preparatorios.ts).
// Ojo con la garantía de apelación: el numeral 73.2 de la Ley fue modificado por la Ley 32187 (3 %, y 0,5 % con tope
// de 25 UIT para MYPE) y el Art. 309 del Reglamento fija el tope general en 300 UIT. El texto original de la Ley
// (0,5 % y 50 UIT) ya no rige; no lo reintroduzcas.

export const FASE_SELECCION: Clase[] = [
  {
    slug: "mecanismo-diferenciado-adquisicion",
    modulo: "VIII",
    temas: [],
    titulo: "Mecanismo diferenciado de adquisición (MDA)",
    descripcion:
      "Los acuerdos MDA para tecnologías sanitarias de alto costo o innovadoras: qué entidades pueden usarlos, para qué " +
      "enfermedades y de qué tipos son.",
    minutos: 7,
    contenido: {
      resumen: [
        {
          pregunta: "¿Para qué existen los MDA?",
          parrafos: [
            "Permiten contratar tecnologías sanitarias para el diagnóstico y tratamiento de enfermedades raras o huérfanas, " +
              "oncológicas y de alto costo, así como tecnologías sanitarias innovadoras (Ley, Art. 44).",
            "Con estos acuerdos las entidades acceden a esas tecnologías bajo condiciones que permiten gestionar la " +
              "incertidumbre sobre su funcionalidad (Reglamento, Art. 293).",
          ],
        },
        {
          pregunta: "¿Quién puede usarlos?",
          parrafos: [
            "El Ministerio de Salud, EsSalud, las sanidades de la PNP y de las Fuerzas Armadas y las entidades del Sistema " +
              "Nacional de Salud que el Ministerio de Salud autorice por resolución ministerial (Reglamento, Art. 293). La " +
              "Ley también menciona al INEN, conforme a la Ley Nacional del Cáncer (Ley, Art. 44).",
          ],
        },
        {
          pregunta: "¿Qué tipos de acuerdo MDA hay?",
          parrafos: [
            "De tipo financiero, de riesgo compartido o híbridos (Ley, Art. 44). El Reglamento los regula en sus artículos " +
              "298 a 300 y desarrolla por separado sus actuaciones preparatorias, fase de selección y ejecución contractual.",
          ],
        },
      ],
      puntosClave: [
        "Objeto: tecnologías sanitarias para enfermedades raras o huérfanas, oncológicas, de alto costo, o innovadoras.",
        "Tres tipos de acuerdo: financiero, de riesgo compartido e híbrido.",
        "Solo entidades del ámbito de salud determinadas por la norma o autorizadas por resolución ministerial.",
      ],
      casuisticas: [
        {
          enunciado:
            "Una municipalidad provincial quiere contratar por MDA una tecnología sanitaria para pacientes oncológicos. ¿Puede?",
          resolucion:
            "No. El MDA está reservado al Ministerio de Salud, EsSalud, las sanidades de la PNP y de las Fuerzas Armadas, las entidades del Sistema Nacional de Salud autorizadas por resolución ministerial y, conforme a la Ley Nacional del Cáncer, el INEN.",
          baseLegal: [
            { norma: "Ley 32069", articulo: "44" },
            { norma: "Reglamento", articulo: "293" },
          ],
        },
        {
          enunciado:
            "En un acuerdo MDA, el pago al proveedor depende de que los pacientes respondan al tratamiento: si no responden, el proveedor asume parte del costo. ¿Qué tipo de acuerdo es?",
          resolucion:
            "Un acuerdo de riesgo compartido. Los MDA pueden ser de tipo financiero, de riesgo compartido o híbridos.",
          baseLegal: [{ norma: "Ley 32069", articulo: "44" }],
        },
        {
          enunciado:
            "Para un MDA de dos tecnologías que tratan la misma patología, ¿cuántos procedimientos de selección se convocan?",
          resolucion:
            "Uno solo: si existe más de una tecnología sanitaria para la misma patología, se realiza un único procedimiento y en la fase de negociación la buena pro va a la que evidencie mejores condiciones contractuales, por costo-efectividad y valor por dinero.",
          baseLegal: [{ norma: "Reglamento", articulo: "295" }],
        },
      ],
      baseLegal: [
        { norma: "Ley 32069", articulo: "44" },
        { norma: "Reglamento", articulo: "293" },
        { norma: "Reglamento", articulo: "298" },
        { norma: "Reglamento", articulo: "299" },
        { norma: "Reglamento", articulo: "300" },
        { norma: "Reglamento", articulo: "295" },
      ],
      verificada: true,
    },
  },
  {
    slug: "procedimientos-seleccion",
    modulo: "X",
    temas: ["2.1", "2.2"],
    titulo: "Procedimientos de selección",
    descripcion:
      "Procedimientos competitivos y no competitivos, sus modalidades, las etapas de la fase de selección y cómo se " +
      "cuentan los plazos.",
    minutos: 10,
    contenido: {
      resumen: [
        {
          pregunta: "¿Cómo se determina el procedimiento?",
          parrafos: [
            "Considerando el objeto de la contratación y su cuantía, entre otros criterios del Reglamento, para los " +
              "requerimientos previstos en la PMBSO (Ley, Art. 53).",
          ],
        },
        {
          pregunta: "¿Cuáles son los procedimientos competitivos?",
          parrafos: [
            "La licitación pública, para bienes y obras, y el concurso público, para servicios (Ley, Art. 54). El Reglamento " +
              "establece sus modalidades abreviadas y las modalidades diferenciadas, como la subasta inversa electrónica, " +
              "la comparación de precios y los procedimientos de compra pública de innovación.",
            "La regla es el procedimiento competitivo; las excepciones son las que establece la Ley.",
          ],
        },
        {
          pregunta: "¿Cuándo se contrata directamente?",
          parrafos: [
            "En los supuestos del artículo 55 de la Ley, entre ellos: contratar con otra entidad, situación de emergencia, " +
              "desabastecimiento, proveedor único o con derechos exclusivos, servicios personalísimos y bienes y servicios " +
              "para investigación, desarrollo e innovación.",
            "El titular aprueba los supuestos de emergencia y desabastecimiento, entre otros, y la autoridad de la gestión " +
              "administrativa los demás (Reglamento, Arts. 18 y 19).",
          ],
        },
        {
          pregunta: "¿Qué etapas tiene la fase de selección?",
          parrafos: [
            "Según el tipo, objeto y modalidad: convocatoria, registro de participantes, cuestionamientos a las bases " +
              "(consultas y observaciones, integración), precalificación (con diálogo competitivo o negociación), " +
              "evaluación de ofertas técnicas y económicas, adjudicación para la innovación y otorgamiento de la buena pro " +
              "(Reglamento, Art. 62).",
            "La fase empieza con la publicación del aviso de convocatoria en la Pladicop (Reglamento, Art. 63). Sus plazos, " +
              "hasta el perfeccionamiento del contrato, se cuentan en días hábiles, sin el día inicial y con el de " +
              "vencimiento (Reglamento, Art. 62).",
          ],
        },
      ],
      puntosClave: [
        "Licitación pública: bienes y obras. Concurso público: servicios.",
        "Subasta inversa electrónica y comparación de precios son modalidades diferenciadas que regula el Reglamento.",
        "La contratación directa solo procede en los supuestos del artículo 55 de la Ley.",
        "La fase de selección empieza con la publicación de la convocatoria en la Pladicop.",
        "Plazos de la fase de selección: días hábiles, excluyendo el día inicial e incluyendo el de vencimiento.",
      ],
      casuisticas: [
        {
          enunciado:
            "Una entidad necesita contratar el mantenimiento preventivo de sus ascensores. ¿Qué procedimiento competitivo corresponde?",
          resolucion:
            "El concurso público: los servicios se contratan por concurso público, como la licitación pública corresponde a bienes y obras.",
          baseLegal: [{ norma: "Ley 32069", articulo: "54" }],
        },
        {
          enunciado:
            "Las lluvias destruyen vías rurales de una municipalidad y hay que contratar de inmediato la maquinaria. ¿Qué procedimiento cabe y quién lo aprueba?",
          resolucion:
            "La contratación directa por situación de emergencia, del artículo 55 de la Ley, y la aprueba el titular de la entidad.",
          baseLegal: [
            { norma: "Ley 32069", articulo: "55" },
            { norma: "Reglamento", articulo: "18" },
          ],
        },
        {
          enunciado:
            "La buena pro quedó consentida el jueves y el equipo quiere contar el plazo de presentación de requisitos desde ese mismo jueves. ¿Está bien?",
          resolucion:
            "No. Los plazos de la fase de selección se cuentan en días hábiles, sin el día inicial y con el de vencimiento: los ocho días hábiles del postor corren desde el día siguiente al registro del consentimiento en la Pladicop.",
          baseLegal: [
            { norma: "Reglamento", articulo: "62" },
            { norma: "Reglamento", articulo: "90" },
          ],
        },
      ],
      baseLegal: [
        { norma: "Ley 32069", articulo: "53" },
        { norma: "Ley 32069", articulo: "54" },
        { norma: "Ley 32069", articulo: "55" },
        { norma: "Reglamento", articulo: "18" },
        { norma: "Reglamento", articulo: "19" },
        { norma: "Reglamento", articulo: "62" },
        { norma: "Reglamento", articulo: "63" },
        { norma: "Reglamento", articulo: "90" },
      ],
      verificada: true,
    },
  },
  {
    slug: "recurso-apelacion",
    modulo: "XI",
    temas: ["2.7", "2.8"],
    titulo: "Recurso de apelación",
    descripcion:
      "Qué se puede apelar y cuándo, ante quién se presenta, en qué plazo y cuánto cuesta la garantía, con su régimen " +
      "especial para las MYPE.",
    minutos: 10,
    contenido: {
      resumen: [
        {
          pregunta: "¿Qué se puede impugnar?",
          parrafos: [
            "Las discrepancias entre la entidad y los participantes o postores de un procedimiento de selección, y las de " +
              "los procedimientos de catálogos electrónicos de acuerdos marco, solo pueden dar lugar al recurso de " +
              "apelación. Se impugnan actos anteriores al perfeccionamiento del contrato (Ley, Art. 72).",
            "No se impugnan las contrataciones no sujetas a procedimiento competitivo ni las actuaciones que señala el " +
              "Reglamento.",
          ],
        },
        {
          pregunta: "¿Cuándo y en qué plazo se apela?",
          parrafos: [
            "Solo después del otorgamiento de la buena pro, de la declaración de desierto o de la publicación de los " +
              "resultados de adjudicación en los catálogos electrónicos (Ley, Art. 73).",
            "Regla general: hasta ocho días hábiles desde la notificación de la buena pro en la Pladicop. En concurso " +
              "público abreviado, licitación pública abreviada, selección de expertos y comparación de precios: cinco días " +
              "hábiles. En subasta inversa electrónica, cinco, salvo que su cuantía sea la de una licitación o un concurso " +
              "público, en cuyo caso son ocho (Reglamento, Art. 304).",
          ],
        },
        {
          pregunta: "¿Ante quién se presenta?",
          parrafos: [
            "Ante el Tribunal cuando la cuantía del procedimiento supera cincuenta UIT y en los procedimientos de catálogos " +
              "electrónicos; en los demás casos, ante la autoridad de la gestión administrativa de la entidad (Ley, Art. 74).",
            "La facultad de la autoridad de la gestión administrativa de resolver apelaciones es indelegable. Y con " +
              "independencia de la cuantía, la declaración de nulidad de oficio y la cancelación del procedimiento se " +
              "impugnan ante el Tribunal de Contrataciones Públicas (Reglamento, Art. 302).",
          ],
        },
        {
          pregunta: "¿Cuánto es la garantía?",
          parrafos: [
            "El 3 % de la cuantía del procedimiento o del ítem impugnado, con un máximo de trescientas UIT. Para las micro y " +
              "pequeñas empresas es el 0,5 %, con un límite de veinticinco UIT (Ley, Art. 73; Reglamento, Art. 309).",
          ],
        },
      ],
      puntosClave: [
        "Solo se apelan actos anteriores al perfeccionamiento del contrato.",
        "Plazo general: ocho días hábiles; cinco en los procedimientos abreviados, selección de expertos y comparación de precios.",
        "Tribunal si la cuantía supera cincuenta UIT; si no, la autoridad de la gestión administrativa.",
        "Nulidad de oficio y cancelación: siempre ante el TCP, sin importar la cuantía.",
        "La AGA resuelve las apelaciones de forma indelegable.",
        "Garantía: 3 % con tope de 300 UIT; MYPE, 0,5 % con tope de 25 UIT.",
      ],
      casuisticas: [
        {
          enunciado:
            "Una entidad cancela un procedimiento cuya cuantía es de 30 UIT y un participante quiere apelar esa cancelación. ¿Ante quién la presenta?",
          resolucion:
            "Ante el Tribunal de Contrataciones Públicas. La cancelación del procedimiento y la declaración de nulidad de oficio se impugnan ante el TCP con independencia de la cuantía; la regla de los 50 UIT no aplica aquí.",
          baseLegal: [{ norma: "Reglamento", articulo: "302" }],
        },
        {
          enunciado:
            "Un postor apela un procedimiento cuya cuantía es el equivalente a 400 000 UIT. ¿Cuánta garantía presenta una MYPE y cuánta una empresa grande?",
          resolucion:
            "La empresa grande: 3 % de la cuantía, con tope de 300 UIT. La MYPE: 0,5 %, con tope de 25 UIT.",
          baseLegal: [
            { norma: "Ley 32069", articulo: "73" },
            { norma: "Reglamento", articulo: "309" },
          ],
        },
        {
          enunciado:
            "Vence el plazo para que la autoridad de la gestión administrativa resuelva una apelación y no hay resolución notificada. ¿Qué queda para el impugnante?",
          resolucion:
            "Opera la denegatoria ficta: el recurso se considera desestimado, se agota la vía administrativa y procede la acción contencioso-administrativa; la garantía se devuelve.",
          baseLegal: [
            { norma: "Ley 32069", articulo: "75" },
            { norma: "Reglamento", articulo: "316" },
            { norma: "Reglamento", articulo: "317" },
          ],
        },
      ],
      baseLegal: [
        { norma: "Ley 32069", articulo: "72" },
        { norma: "Ley 32069", articulo: "73" },
        { norma: "Ley 32069", articulo: "74" },
        { norma: "Reglamento", articulo: "302" },
        { norma: "Reglamento", articulo: "304" },
        { norma: "Reglamento", articulo: "309" },
        { norma: "Ley 32069", articulo: "75" },
        { norma: "Reglamento", articulo: "316" },
        { norma: "Reglamento", articulo: "317" },
      ],
      verificada: true,
    },
  },
  {
    slug: "plazos-buena-pro-seleccion",
    modulo: "XIX",
    temas: ["2.2", "2.4", "2.5"],
    titulo: "Plazos, consentimiento y pérdida de la buena pro",
    descripcion:
      "Los plazos mínimos de cada etapa de la selección, cómo queda firme la buena pro y qué pasa cuando el postor ganador o la entidad incumplen al perfeccionar el contrato.",
    minutos: 9,
    contenido: {
      resumen: [
        {
          pregunta: "¿Cuánto dura cada etapa?",
          parrafos: [
            "Entre la convocatoria y la presentación de ofertas o los documentos de precalificación no pueden pasar menos " +
              "de veintidós días hábiles, salvo en las modalidades abreviadas y las que no tienen etapa de consultas y " +
              "observaciones (Reglamento, Art. 64.1). Las prórrogas de etapas se registran en la Pladicop modificando el " +
              "cronograma (Art. 64.2).",
            "Con un anuncio de contratación futura publicado al menos cuarenta días calendario antes de la convocatoria, " +
              "el plazo puede reducirse conforme a las bases estándar, nunca por debajo de diez días calendario (Art. 64.3).",
            "Las consultas y observaciones a las bases se presentan en no menos de siete días hábiles desde la convocatoria " +
              "(tres en abreviadas) (Art. 66.1). Las ofertas se presentan en no menos de siete días hábiles desde la " +
              "integración de bases (tres en abreviadas); sin etapa de consultas, no menos de seis días hábiles desde la " +
              "convocatoria, y en comparación de precios, tres (Arts. 66.1 y 68).",
          ],
        },
        {
          pregunta: "¿Qué pasa si el área usuaria objeta un cambio del requerimiento durante las consultas?",
          parrafos: [
            "Si una consulta u observación obliga a precisar el requerimiento, los evaluadores proponen la modificación y " +
              "piden la no objeción del área usuaria. Si esta objeta de manera sustentada, los evaluadores pueden modificar " +
              "el requerimiento conforme pide el área usuaria o devolver el expediente a la DEC para que se evalúe la " +
              "nulidad del procedimiento por no satisfacer la necesidad (Reglamento, Art. 66.5).",
          ],
        },
        {
          pregunta: "¿Cuándo queda consentida la buena pro?",
          parrafos: [
            "Con dos o más ofertas, al día siguiente de vencido el plazo de apelación sin que los postores hayan recurrido. " +
              "Con una sola oferta, el mismo día de la notificación de su otorgamiento (Reglamento, Art. 82).",
          ],
        },
        {
          pregunta: "¿Qué pasa si alguien incumple al perfeccionar?",
          parrafos: [
            "Si la entidad no perfecciona el contrato en plazo, el postor ganador puede requerirle su cumplimiento dándole " +
              "cinco días hábiles; vencido ese plazo, el postor queda libre de suscribir (Reglamento, Arts. 91.1 y 91.2).",
            "Si es el postor quien incumple, pierde automáticamente la buena pro: la DEC requiere al segundo lugar, en un " +
              "máximo de dos días hábiles desde la finalización del plazo de consentimiento de la pérdida, para que " +
              "presente sus requisitos (Reglamento, Art. 91.3).",
          ],
        },
      ],
      puntosClave: [
        "Convocatoria a ofertas: mínimo 22 días hábiles; con anuncio futuro de 40 días calendario, mínimo 10 días calendario.",
        "Consultas: mínimo 7 días hábiles (3 en abreviadas). Ofertas: mínimo 7 desde integración (3 en abreviadas).",
        "Buena pro consentida: al día siguiente de vencer el plazo de apelación sin recurso; con oferta única, el mismo día de la notificación.",
        "Entidad que no perfecciona: requerimiento de 5 días hábiles y el postor queda libre. Postor que incumple: pierde la buena pro y sale el segundo lugar.",
      ],
      casuisticas: [
        {
          enunciado:
            "Una licitación pública publicó su convocatoria habiendo difundido 45 días antes un anuncio de contratación futura. ¿Puede convocar a ofertas con un plazo menor a 22 días hábiles?",
          resolucion:
            "Sí: con el anuncio publicado al menos 40 días calendario antes, el plazo puede reducirse conforme a las bases estándar, pero nunca por debajo de 10 días calendario.",
          baseLegal: [{ norma: "Reglamento", articulo: "64" }],
        },
        {
          enunciado:
            "En un procedimiento solo se presentó una oferta y la buena pro fue notificada el lunes. ¿Cuándo queda consentida?",
          resolucion:
            "El mismo día de la notificación de su otorgamiento; con dos o más ofertas, en cambio, se espera al día siguiente del vencimiento del plazo de apelación sin recurso.",
          baseLegal: [{ norma: "Reglamento", articulo: "82" }],
        },
        {
          enunciado:
            "El postor ganador no presenta sus requisitos y pierde la buena pro. ¿Cómo sigue el procedimiento?",
          resolucion:
            "La pérdida es automática y la DEC requiere al postor del segundo lugar, en un máximo de dos días hábiles desde la finalización del plazo de consentimiento de la pérdida, para que presente sus requisitos.",
          baseLegal: [{ norma: "Reglamento", articulo: "91" }],
        },
      ],
      baseLegal: [
        { norma: "Reglamento", articulo: "64" },
        { norma: "Reglamento", articulo: "66" },
        { norma: "Reglamento", articulo: "68" },
        { norma: "Reglamento", articulo: "82" },
        { norma: "Reglamento", articulo: "91" },
      ],
      verificada: true,
    },
  },
];
