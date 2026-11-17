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
    // Refuerzo del tema 2.8: la clase XI explica cómo se interpone; esta, qué pasa después. El banco pregunta mucho
    // por improcedencia, plazos de subsanación y por qué parte de la garantía se ejecuta.
    slug: "apelacion-tramite-resolucion",
    modulo: "XXXIII",
    temas: ["2.8"],
    titulo: "Trámite y resolución de la apelación",
    descripcion:
      "Qué pasa después de apelar: suspensión del procedimiento, admisibilidad y subsanación, causales de " +
      "improcedencia, el trámite ante la entidad y ante el Tribunal, cómo se resuelve y qué ocurre con la garantía.",
    minutos: 11,
    contenido: {
      resumen: [
        {
          pregunta: "¿Qué efecto tiene interponer la apelación?",
          parrafos: [
            "Suspende el procedimiento de selección. Si se convocó por relación de ítems, la suspensión afecta solo al " +
              "ítem impugnado. No suspende la incorporación de proveedores a los catálogos electrónicos de acuerdo marco " +
              "ni la extensión de su vigencia (Reglamento, Art. 305).",
            "La entidad o el TCP informan la interposición registrándola en la Pladicop hasta el día hábil siguiente.",
          ],
        },
        {
          pregunta: "¿Cómo se revisa la admisibilidad?",
          parrafos: [
            "El recurso se presenta en la mesa de partes de la entidad o del TCP con los requisitos del Art. 306: " +
              "identificación del impugnante, nomenclatura del procedimiento, petitorio y fundamentos, pruebas, garantía, " +
              "inscripción en el REMYPE si corresponde y firma. En consorcio, apela el representante común.",
            "La revisión se hace en un solo acto, al presentar. La nomenclatura y la firma deben estar en el primer escrito: " +
              "si faltan, la mesa de partes rechaza el recurso. Los demás requisitos se subsanan en un plazo máximo de dos " +
              "días hábiles desde el día siguiente de la presentación; ese plazo es único y suspende todos los plazos de la " +
              "impugnación. Si vence sin subsanar, el recurso se considera no presentado (Reglamento, Art. 307).",
            "Si la omisión se advierte después, se conceden también dos días hábiles desde la notificación de las " +
              "observaciones. Y el recurso presentado antes del otorgamiento de la buena pro se rechaza con la simple " +
              "verificación de la fecha programada en la Pladicop.",
          ],
        },
        {
          pregunta: "¿Cuándo es improcedente?",
          parrafos: [
            "Cuando quien lo recibe no es competente según el Art. 74 de la Ley; se dirige contra un acto no impugnable; se " +
              "presenta fuera de plazo; lo firma quien no es el impugnante o su representante; el impugnante está impedido " +
              "o incapacitado; lo presenta el postor ganador de la buena pro; no hay conexión lógica entre los hechos y el " +
              "petitorio, o el impugnante carece de interés para obrar o de legitimidad procesal (Reglamento, Art. 308).",
            "También cuando el proveedor impugna la buena pro sin cuestionar la no admisión o descalificación de su oferta " +
              "o, aun cuestionándola, no logra revertirla antes. Primero debe volver a estar en carrera.",
          ],
        },
        {
          pregunta: "¿Cómo se tramita ante la entidad?",
          parrafos: [
            "Se corre traslado a los postores con interés directo al día hábil siguiente de la presentación o de la " +
              "subsanación, publicando el recurso en la Pladicop. Pueden absolverlo en un plazo no mayor de tres días " +
              "hábiles; la entidad resuelve con la absolución o sin ella. Los recursos sobre un mismo procedimiento o ítem " +
              "se acumulan al más antiguo (Reglamento, Art. 310).",
            "La entidad resuelve y notifica por la Pladicop en un plazo no mayor de diez días hábiles desde el día " +
              "siguiente de la presentación o de la subsanación. Resuelve la autoridad de la gestión administrativa, con " +
              "opinión previa de las áreas legal y técnicas, y sin que intervengan los servidores que participaron en el " +
              "procedimiento de selección.",
          ],
        },
        {
          pregunta: "¿Y ante el Tribunal?",
          parrafos: [
            "Al día hábil siguiente de la presentación o subsanación, el TCP notifica el recurso para que, en no más de tres " +
              "días hábiles, la entidad registre su sustento técnico legal y los otros postores absuelvan el traslado. La " +
              "audiencia pública se programa en un plazo no menor de tres ni mayor de cinco días hábiles (Reglamento, Art. 311).",
            "La sala puede pedir información adicional; eso prorroga la evaluación sin exceder diez días hábiles desde que " +
              "recibe el expediente. Declarado el expediente listo para resolver, el TCP resuelve en cinco días hábiles y " +
              "notifica por la Pladicop a más tardar al día hábil siguiente. Si la entidad no registra su sustento, se " +
              "comunica a su Órgano de Control Institucional o a la Secretaría Técnica de procedimientos disciplinarios.",
          ],
        },
        {
          pregunta: "¿Cómo puede terminar?",
          parrafos: [
            "Infundado: se confirma el acto. Fundado: se revoca y, si se cuestionó la evaluación, la calificación o la buena " +
              "pro, puede otorgarse la buena pro a quien corresponda. Improcedente: por alguna causal del Art. 308. Nulidad: " +
              "si hay un vicio del Art. 70.1 de la Ley que no puede conservarse, se retrotrae a la etapa que se precise, " +
              "aun cuando el recurso sea improcedente (Reglamento, Art. 313).",
            "El apelante puede desistirse con escrito de firma legalizada notarialmente o certificada ante el TCP, siempre " +
              "que lo haga antes de que el expediente se declare listo para resolver y no comprometa el interés público " +
              "(Reglamento, Art. 314).",
          ],
        },
        {
          pregunta: "¿Qué pasa con la garantía?",
          parrafos: [
            "Infundado o desistimiento: se ejecuta íntegra. Improcedente: se ejecuta el 50 %. Se devuelve toda cuando el " +
              "recurso es fundado en todo o en parte, se declara la nulidad o que carece de objeto pronunciarse, sobreviene " +
              "un impedimento para contratar del impugnante u opera la denegatoria ficta. La devolución se hace en cinco " +
              "días hábiles de solicitada (Reglamento, Art. 315).",
          ],
        },
      ],
      puntosClave: [
        "Apelar suspende el procedimiento; si es por ítems, solo el ítem impugnado.",
        "Nomenclatura y firma van sí o sí en el primer escrito; lo demás se subsana en 2 días hábiles.",
        "Apelar antes de la buena pro: la mesa de partes lo rechaza.",
        "El postor ganador no puede apelar; el descalificado primero debe revertir su descalificación.",
        "Entidad: absolución en 3 días hábiles y resolución en 10.",
        "TCP: sustento y absolución en 3; audiencia entre 3 y 5; resolución en 5 desde «listo para resolver».",
        "Garantía: infundado o desistimiento, íntegra; improcedente, 50 %; fundado aunque sea en parte, se devuelve toda.",
      ],
      casuisticas: [
        {
          enunciado:
            "Un postor apela la buena pro sin adjuntar la garantía y sin firmar el escrito. ¿Qué hace la mesa de partes?",
          resolucion:
            "Rechaza el recurso. La firma, como la nomenclatura del procedimiento, debe constar en el primer escrito; su " +
            "falta no se subsana. Si solo hubiera faltado la garantía, se le darían dos días hábiles para subsanar y, " +
            "vencidos sin hacerlo, el recurso se tendría por no presentado.",
          baseLegal: [
            { norma: "Reglamento", articulo: "306" },
            { norma: "Reglamento", articulo: "307" },
          ],
        },
        {
          enunciado:
            "El ganador de la buena pro apela porque considera que le asignaron menos puntaje técnico del que merecía. " +
            "¿Cómo se resuelve y qué pasa con su garantía?",
          resolucion:
            "Es improcedente: el postor ganador de la buena pro no puede interponer apelación. Al declararse improcedente " +
            "se ejecuta el 50 % de la garantía.",
          baseLegal: [
            { norma: "Reglamento", articulo: "308" },
            { norma: "Reglamento", articulo: "315" },
          ],
        },
        {
          enunciado:
            "Un postor cuya oferta fue descalificada apela solo contra el otorgamiento de la buena pro al ganador, sin " +
            "cuestionar su propia descalificación. ¿Procede?",
          resolucion:
            "No. Es improcedente: quien impugna la buena pro sin cuestionar su no admisión o descalificación (o sin lograr " +
            "revertirla antes) no tiene cómo beneficiarse del resultado.",
          baseLegal: [{ norma: "Reglamento", articulo: "308" }],
        },
        {
          enunciado:
            "Una licitación se convocó por relación de ítems y un postor apela solo el ítem 2. ¿Puede la entidad seguir con " +
            "los demás ítems?",
          resolucion:
            "Sí. La apelación suspende el procedimiento, pero cuando se convocó por relación de ítems la suspensión afecta " +
            "únicamente al ítem impugnado.",
          baseLegal: [{ norma: "Reglamento", articulo: "305" }],
        },
        {
          enunciado:
            "Una apelación se tramita ante la entidad. El recurso se presentó completo y nadie absolvió el traslado. ¿Puede " +
            "la entidad resolver y en qué plazo?",
          resolucion:
            "Sí: resuelve con la absolución o sin ella. Tiene un plazo no mayor de diez días hábiles desde el día siguiente " +
            "de la presentación para resolver y notificar por la Pladicop. Decide la autoridad de la gestión " +
            "administrativa, con opinión previa de las áreas legal y técnicas.",
          baseLegal: [{ norma: "Reglamento", articulo: "310" }],
        },
        {
          enunciado:
            "En una apelación ante el TCP, la sala ya declaró el expediente listo para resolver y el apelante presenta su " +
            "desistimiento. ¿Se acepta?",
          resolucion:
            "No. El desistimiento solo cabe hasta antes de que el expediente se declare listo para resolver (y sin " +
            "comprometer el interés público). Desde esa declaración, el TCP tiene cinco días hábiles para resolver.",
          baseLegal: [
            { norma: "Reglamento", articulo: "311" },
            { norma: "Reglamento", articulo: "314" },
          ],
        },
        {
          enunciado:
            "La apelación se declara fundada en parte: se revoca la descalificación del impugnante, pero no se le otorga la " +
            "buena pro. ¿Qué pasa con la garantía?",
          resolucion:
            "Se devuelve en su totalidad: basta que el recurso sea fundado en todo o en parte. El impugnante la solicita y " +
            "la devolución se hace en cinco días hábiles.",
          baseLegal: [
            { norma: "Reglamento", articulo: "313" },
            { norma: "Reglamento", articulo: "315" },
          ],
        },
      ],
      baseLegal: [
        { norma: "Reglamento", articulo: "305" },
        { norma: "Reglamento", articulo: "306" },
        { norma: "Reglamento", articulo: "307" },
        { norma: "Reglamento", articulo: "308" },
        { norma: "Reglamento", articulo: "310" },
        { norma: "Reglamento", articulo: "311" },
        { norma: "Reglamento", articulo: "313" },
        { norma: "Reglamento", articulo: "314" },
        { norma: "Reglamento", articulo: "315" },
        { norma: "Ley 32069", articulo: "70" },
        { norma: "Ley 32069", articulo: "74" },
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
