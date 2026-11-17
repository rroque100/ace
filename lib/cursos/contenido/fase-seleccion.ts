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
      baseLegal: [
        { norma: "Ley 32069", articulo: "44" },
        { norma: "Reglamento", articulo: "293" },
        { norma: "Reglamento", articulo: "298" },
        { norma: "Reglamento", articulo: "299" },
        { norma: "Reglamento", articulo: "300" },
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
      baseLegal: [
        { norma: "Ley 32069", articulo: "53" },
        { norma: "Ley 32069", articulo: "54" },
        { norma: "Ley 32069", articulo: "55" },
        { norma: "Reglamento", articulo: "18" },
        { norma: "Reglamento", articulo: "19" },
        { norma: "Reglamento", articulo: "62" },
        { norma: "Reglamento", articulo: "63" },
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
        "Garantía: 3 % con tope de 300 UIT; MYPE, 0,5 % con tope de 25 UIT.",
      ],
      baseLegal: [
        { norma: "Ley 32069", articulo: "72" },
        { norma: "Ley 32069", articulo: "73" },
        { norma: "Ley 32069", articulo: "74" },
        { norma: "Reglamento", articulo: "304" },
        { norma: "Reglamento", articulo: "309" },
      ],
      verificada: true,
    },
  },
];
