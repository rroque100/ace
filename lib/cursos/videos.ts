// Guiones de los videos animados de las clases. Cada clase que declare `animacion` encuentra aquí su guion:
// escenas de contenido (fichas + segmentos narrados + panel de detalle) y comprobaciones interactivas.
// El reproductor (app/components/cursos/video-animado.tsx) narra segmento por segmento, resalta la ficha
// que está presentando, muestra su detalle extra y suena al activarse.
//
// REGLA DE VOZ: los segmentos se hablan: frases cortas, palabras simples, sin legalismos.
// REGLA DE CONTENIDO: cada afirmación sale de la clase verificada contra el corpus.
// REGLA DE DETALLE: `detalle` y `examen` dicen lo que la voz no narra — el panel lo muestra para leerlo.
// Módulo puro: sin red ni base de datos.

export type FichaVideo = {
  icono: string;
  nombre: string;
  rol: string;
  /** Detalle extra que el panel muestra al resaltarse: lo que la voz no alcanza a decir. */
  detalle?: string;
  /** Índices de las fichas de esta escena a las que se conecta. */
  conecta?: number[];
};
/** Un trozo de narración. Si apunta a una ficha, esta se resalta y muestra su detalle. */
export type SegmentoVideo = { texto: string; ficha?: number };
export type EscenaContenido = {
  titulo: string;
  cinta: string;
  /** Punta de examen que cierra la escena en el panel, por encima del detalle de cada ficha. */
  examen?: string;
  fichas: readonly FichaVideo[];
  guion: readonly SegmentoVideo[];
};
/** Comprobación interactiva: el video se detiene, el alumno responde y la voz corrige. */
export type EscenaQuiz = {
  tipo: "quiz";
  titulo: string;
  cinta: string;
  pregunta: string;
  opciones: readonly { texto: string; correcta: boolean }[];
  aclaracion: string;
};
export type EscenaVideo = EscenaContenido | EscenaQuiz;
export type GuionVideo = readonly EscenaVideo[];

export const esQuiz = (e: EscenaVideo): e is EscenaQuiz => (e as EscenaQuiz).tipo === "quiz";

/** Iconos que el reproductor sabe pintar (el mapa vive en video-animado.tsx; el test exige que coincidan). */
export const ICONOS_VIDEO = [
  "Landmark", "Scale", "ShoppingBag", "Building2", "Users", "Crown", "UserCog", "User",
  "Compass", "Network", "BadgeCheck", "ClipboardList", "FileSearch", "FileWarning", "FileText",
  "Gavel", "Stamp", "Ban", "ListChecks",
] as const;

export const VIDEO_ESCENAS: Record<string, GuionVideo> = {
  "actores-involucrados": [
    {
      titulo: "Cinco actores en escena",
      cinta: "Ley 32069 · Art. 9",
      examen: "El examen te da los cinco nombres y te pide identificarlos: memoriza qué es cada uno y qué hace.",
      fichas: [
        { icono: "Landmark", nombre: "DGA", rol: "Dirección General de Abastecimiento del MEF",
          detalle: "La DGA no contrata: formula la política de abastecimiento y emite las bases estándar, directivas y fichas de homologación que las entidades usan.",
          conecta: [4] },
        { icono: "Scale", nombre: "OECE", rol: "Organismo Especializado para las Contrataciones Públicas Eficientes",
          detalle: "El OECE reemplazó al OSCE. Su Tribunal de Contrataciones Públicas (TCP) resuelve apelaciones y sanciona. El examen espera que sepas que «TCP» es Tribunal de Contrataciones Públicas.",
          conecta: [3] },
        { icono: "ShoppingBag", nombre: "Perú Compras", rol: "Central de Compras Públicas",
          detalle: "Perú Compras puede recibir el encargo de TODAS las fases: no solo seleccionar, también ejecutar, liquidar y pagar. Eso la distingue de la simple compra por encargo, que cubre solo preparatorias o selección.",
          conecta: [3] },
        { icono: "Building2", nombre: "Entidades contratantes", rol: "Las que contratan en nombre del Estado",
          detalle: "Cada entidad se organiza con seis roles internos (titular, autoridad, área usuaria, área técnica, DEC y compradores públicos). De ellos salen todas las decisiones de la contratación.",
          conecta: [4] },
        { icono: "Users", nombre: "Proveedores", rol: "Los que ofrecen bienes y servicios",
          detalle: "Los proveedores se inscriben en el RNP. En el examen, «participante» es el registrado en un procedimiento, y «postor» es quien además presenta oferta.",
          conecta: [3] },
      ],
      guion: [
        { texto: "Toda contratación pública tiene su reparto. El artículo 9 de la Ley presenta a los cinco actores del proceso." },
        { texto: "Primero, la DGA. Es la Dirección General de Abastecimiento, y vive en el Ministerio de Economía y Finanzas. Ella pone las reglas del juego.", ficha: 0 },
        { texto: "Luego, el OECE: el organismo especializado de las contrataciones públicas eficientes. Piensa en él como el árbitro del juego.", ficha: 1 },
        { texto: "Perú Compras es la central que compra en grande, para todo el Estado.", ficha: 2 },
        { texto: "Las entidades contratantes son las que contratan: tu municipalidad, tu ministerio, tu hospital.", ficha: 3 },
        { texto: "Y los proveedores: quienes venden sus bienes y servicios al Estado. Ese es el reparto completo.", ficha: 4 },
      ],
    },
    {
      titulo: "Dentro de la entidad: seis papeles",
      cinta: "Reglamento · Arts. 14–20",
      examen: "El examen confunde al alumno con la autoridad de gestión administrativa. Recuerda: la AGA es la secretaría general en un ministerio, la gerencia en una municipalidad.",
      fichas: [
        { icono: "Crown", nombre: "Titular", rol: "La máxima autoridad de la entidad",
          detalle: "El titular aprueba: emergencia, desabastecimiento, adicionales de obras y la anulación de laudo. En una empresa del Estado, es el gerente general.",
          conecta: [1] },
        { icono: "UserCog", nombre: "Autoridad de gestión administrativa", rol: "Secretaría general o gerencia, según la entidad",
          detalle: "La AGA aprueba: los demás no competitivos, adicionales de bienes, servicios y consultorías, declara nulidades y resuelve apelaciones. Su facultad de resolver apelaciones es INDELEGABLE (Art. 302.1 del Reglamento).",
          conecta: [0, 4] },
        { icono: "User", nombre: "Área usuaria", rol: "Formula su requerimiento",
          detalle: "El área usuaria pide, verifica el cumplimiento y emite la conformidad. En el examen, si la pregunta es quién da la conformidad, la respuesta nunca es la DEC: es el área usuaria.",
          conecta: [4] },
        { icono: "Compass", nombre: "Área técnica estratégica", rol: "Pide por otras unidades de la entidad",
          detalle: "Cuando una unidad no puede formular su propio requerimiento, esta área lo hace por ella. Tiene el mismo papel que el área usuaria, solo que para otras oficinas.",
          conecta: [4] },
        { icono: "Network", nombre: "DEC", rol: "Dependencia encargada de las contrataciones",
          detalle: "La DEC conduce el proceso a través de los compradores públicos: registra en la Pladicop, elabora la estrategia, realiza la interacción con el mercado y revisa el requerimiento en lo normativo. Lo técnico es del área usuaria.",
          conecta: [5] },
        { icono: "BadgeCheck", nombre: "Compradores públicos", rol: "Personal certificado conforme a la directiva del OECE",
          detalle: "Son los funcionarios y servidores de la DEC. Están certificados y su designación es por directiva del OECE. A través de ellos, la DEC registra en la Pladicop.",
          conecta: [4] },
      ],
      guion: [
        { texto: "Ahora entremos a la entidad contratante. Aquí trabaja otro equipo, con seis papeles bien distintos." },
        { texto: "El titular es la máxima autoridad. La última palabra.", ficha: 0 },
        { texto: "La autoridad de la gestión administrativa: en un ministerio es la secretaría general; en una municipalidad o región, la gerencia. Fíjate en quién aprueba qué.", ficha: 1 },
        { texto: "El área usuaria es la que pide, porque tiene la necesidad.", ficha: 2 },
        { texto: "El área técnica estratégica también pide, pero por otras unidades que no pueden hacerlo solas.", ficha: 3 },
        { texto: "La DEC es la dependencia encargada de las contrataciones: la que conduce el proceso.", ficha: 4 },
        { texto: "Y los compradores públicos: el personal de la DEC, certificado conforme a la directiva del OECE.", ficha: 5 },
      ],
    },
    {
      titulo: "La DEC: lo que hace y lo que no",
      cinta: "Reglamento · Art. 14",
      examen: "El examen adora la excepción: la DEC registra todo, SALVO lo que corresponde a los evaluadores (comités registran sus actas; jurados comunican a la DEC).",
      fichas: [
        { icono: "ClipboardList", nombre: "Pladicop", rol: "La DEC registra los actos de las tres fases",
          detalle: "La Pladicop es la Plataforma Digital para las Contrataciones Públicas (reemplaza al SEACE). La DEC, a través de los compradores públicos, registra ahí TODOS los actos de las tres fases: actuaciones preparatorias, selección y ejecución.",
          conecta: [1, 3] },
        { icono: "Users", nombre: "Comités y jurados", rol: "Los comités registran sus actas; los jurados avisan a la DEC",
          detalle: "Ojo con esto: la regla general tiene una excepción. Los comités registran sus propios acuerdos y votos en actas en la Pladicop. Los jurados comunican sus prórrogas a la DEC para que ella las registre. Si respondes «la DEC registra todo», fallas la pregunta.",
          conecta: [0] },
        { icono: "FileSearch", nombre: "Estrategia e interacción", rol: "Las elabora y conduce la DEC",
          detalle: "La DEC elabora la estrategia de contratación (Ley, Art. 49) y realiza la interacción con el mercado, que puede ser indagación o consulta (Ley, Art. 47).",
          conecta: [3] },
        { icono: "FileWarning", nombre: "Lo técnico del requerimiento", rol: "Es del área usuaria, no de la DEC",
          detalle: "En el requerimiento, la DEC solo participa en lo normativo de la contratación. Los aspectos técnicos de la necesidad son responsabilidad exclusiva del área usuaria. El examen pregunta esto como afirmación incorrecta: «la DEC puede modificar el requerimiento técnico».",
          conecta: [0] },
      ],
      guion: [
        { texto: "La DEC tiene encargos claros, y una excepción que el examen adora. Escucha bien." },
        { texto: "Encargo uno: registrar en la Pladicop los actos de las tres fases, a través de sus compradores públicos.", ficha: 0 },
        { texto: "La excepción: los comités registran sus propias actas. Y los jurados comunican sus prórrogas a la DEC, para que ella las registre. Si respondes que la DEC registra todo, fallas.", ficha: 1 },
        { texto: "Encargo dos: elaborar la estrategia de contratación. Encargo tres: conducir la interacción con el mercado.", ficha: 2 },
        { texto: "Y ojo con esto: en el requerimiento, la DEC opina solo de normativa. Lo técnico lo decide el área usuaria.", ficha: 3 },
      ],
    },
    {
      titulo: "El área usuaria: pide y conforma",
      cinta: "Reglamento · Art. 20",
      examen: "La conformidad la emite el área usuaria, NUNCA la DEC. El examen lo pregunta directamente.",
      fichas: [
        { icono: "FileText", nombre: "Requerimiento", rol: "Lo formula en coordinación con la DEC",
          detalle: "El requerimiento da inicio al proceso de contratación (Ley, Art. 46). Lo determina el área usuaria en coordinación con la DEC, e identifica la finalidad pública y los objetivos de la contratación.",
          conecta: [1] },
        { icono: "BadgeCheck", nombre: "Conformidad", rol: "La emite el área usuaria, no la DEC",
          detalle: "El área usuaria verifica el cumplimiento del contrato y emite la conformidad (Rgto., Art. 20). Es la confirmación de que la prestación llegó como se pidió. Si la pregunta es «quién da la conformidad», la respuesta nunca es la DEC.",
          conecta: [0] },
      ],
      guion: [
        { texto: "El área usuaria es la protagonista silenciosa. Hace dos cosas que el examen siempre pregunta." },
        { texto: "Primero: formula su requerimiento, en coordinación con la DEC.", ficha: 0 },
        { texto: "Segundo: cuando llega la prestación, verifica el cumplimiento y emite la conformidad. Ni la DEC, ni el titular: la conformidad la firma el área usuaria.", ficha: 1 },
      ],
    },
    {
      tipo: "quiz",
      titulo: "Comprueba: ¿quién da la conformidad?",
      cinta: "Reglamento · Art. 20",
      pregunta: "La prestación llegó y hay que dar la conformidad. ¿Quién la emite?",
      opciones: [
        { texto: "La DEC", correcta: false },
        { texto: "El área usuaria", correcta: true },
        { texto: "El titular de la entidad", correcta: false },
      ],
      aclaracion:
        "La conformidad la emite el área usuaria, que además verificó el cumplimiento del contrato. Ni la DEC ni el titular la firman.",
    },
    {
      titulo: "Quién aprueba qué",
      cinta: "Reglamento · Arts. 18 y 19",
      examen: "El examen te da un supuesto y te pide quién lo aprueba: si es emergencia o desabastecimiento, es el titular; todo lo demás, la autoridad de gestión administrativa.",
      fichas: [
        { icono: "Gavel", nombre: "Titular", rol: "Emergencia, desabastecimiento, adicionales de obra y anulación de laudo",
          detalle: "El titular aprueba específicamente: (i) la contratación directa por emergencia (literal a del 55.1 de la Ley), (ii) la de desabastecimiento (literal b), (iii) las prestaciones adicionales de obras, y (iv) el inicio de la acción judicial de anulación de laudo. En una empresa del Estado, es el gerente general.",
          conecta: [1] },
        { icono: "Stamp", nombre: "Autoridad de gestión administrativa", rol: "Los demás no competitivos, adicionales de bienes y servicios, y las nulidades",
          detalle: "La AGA aprueba: (i) los demás supuestos no competitivos que el Reglamento no asigna al titular, (ii) las prestaciones adicionales de bienes, servicios y consultorías de obras (hasta 25%), (iii) declara la nulidad de procedimientos y contratos, y (iv) resuelve las apelaciones que le corresponden. Todo esto es indelegable en el caso de las apelaciones (Art. 302.1).",
          conecta: [0] },
      ],
      guion: [
        { texto: "Dos firmas se reparten las decisiones. Aprende este reparto: cae en el examen." },
        { texto: "El titular aprueba la emergencia y el desabastecimiento. También autoriza los adicionales de obras, y el inicio de la acción judicial de anulación de laudo.", ficha: 0 },
        { texto: "La autoridad de gestión administrativa aprueba los demás no competitivos, los adicionales de bienes, servicios y consultorías de obras… y declara las nulidades de procedimientos y contratos.", ficha: 1 },
      ],
    },
    {
      tipo: "quiz",
      titulo: "Comprueba: ¿quién aprueba la emergencia?",
      cinta: "Reglamento · Art. 18",
      pregunta: "Un desastre natural obliga a contratar de inmediato. ¿Quién aprueba esa contratación directa por emergencia?",
      opciones: [
        { texto: "La autoridad de gestión administrativa", correcta: false },
        { texto: "El titular de la entidad", correcta: true },
        { texto: "El área usuaria", correcta: false },
      ],
      aclaracion:
        "La emergencia la aprueba el titular de la entidad. Recuerda el reparto: titular para emergencia y desabastecimiento; la autoridad de gestión administrativa, para el resto.",
    },
    {
      titulo: "Delegar: sí, pero no todo",
      cinta: "Ley 32069 · Art. 25 · Reglamento · Art. 302.1",
      examen: "El examen pregunta: «¿puede la AGA delegar la resolución de apelaciones?» — NO, es indelegable.",
      fichas: [
        { icono: "FileText", nombre: "Resolución", rol: "La delegación de facultades se hace por resolución",
          detalle: "El titular y la autoridad de gestión administrativa pueden delegar sus facultades mediante resolución (Ley, Art. 25). Es un acto formal: nada de decisiones verbales ni correos.",
          conecta: [1] },
        { icono: "Ban", nombre: "Apelaciones", rol: "La AGA las resuelve de forma indelegable",
          detalle: "La excepción estrella: la facultad de la autoridad de gestión administrativa de resolver los recursos de apelación es indelegable (Rgto., Art. 302.1). Si el examen pregunta si puede delegarse, la respuesta es «no».",
          conecta: [0] },
      ],
      guion: [
        { texto: "¿Y pueden delegar sus facultades? Sí, con una sola regla de forma." },
        { texto: "Titular y autoridad delegan mediante resolución. Nada de acuerdos verbales.", ficha: 0 },
        { texto: "Pero la excepción estrella: resolver los recursos de apelación es indelegable para la autoridad de gestión administrativa. Si te lo preguntan, esa es la respuesta.", ficha: 1 },
      ],
    },
    {
      titulo: "Para el examen",
      cinta: "Repaso del reparto",
      fichas: [
        { icono: "Network", nombre: "DEC", rol: "Registra, salvo comités y jurados",
          detalle: "La DEC registra en la Pladicop, pero los comités registran sus actas y los jurados comunican a la DEC." },
        { icono: "BadgeCheck", nombre: "Área usuaria", rol: "Pide y da la conformidad",
          detalle: "Formula el requerimiento y emite la conformidad. Ni la DEC ni el titular." },
        { icono: "Gavel", nombre: "Titular", rol: "Emergencia, desabastecimiento y adicionales de obra",
          detalle: "Aprueba la emergencia, el desabastecimiento y los adicionales de obras." },
        { icono: "Stamp", nombre: "AGA", rol: "El resto, y apelaciones indelegables",
          detalle: "Aprueba los demás no competitivos y declara nulidades. Sus apelaciones son indelegables." },
      ],
      guion: [
        { texto: "Cerremos con el repaso. Repite conmigo el reparto." },
        { texto: "Cinco actores en el proceso, seis dentro de la entidad. La DEC registra, salvo lo que toca a los evaluadores.", ficha: 0 },
        { texto: "El área usuaria pide y da la conformidad.", ficha: 1 },
        { texto: "El titular: emergencia, desabastecimiento y adicionales de obra.", ficha: 2 },
        { texto: "Y la autoridad: el resto, con las apelaciones indelegables. Ensayado el reparto, sigue con las modalidades de contratación.", ficha: 3 },
      ],
    },
  ],
};
