// Guiones de los videos animados de las clases. Cada clase que declare `animacion` encuentra aquí su guion:
// escenas de contenido (fichas + segmentos narrados + panel de detalle) y comprobaciones interactivas.
// El reproductor (app/components/cursos/video-animado.tsx) narra segmento por segmento, resalta la ficha
// que está presentando, muestra su detalle extra y suena al activarse.
//
// REGLA DE VOZ: los segmentos se hablan: frases cortas, palabras simples, sin legalismos.
// REGLA DE CONTENIDO: cada afirmación sale de la clase verificada contra el corpus.
// REGLA DE DETALLE: `detalle` dice lo que la voz no alcanza a narrar; `examen` es la punta que cierra.
// REGLA DOCENTE: cada escena tiene UNA sola idea; la comparación se hace lado a lado; la memoria con trucos.
// Módulo puro: sin red ni base de datos.

export type FichaVideo = {
  icono: string;
  nombre: string;
  rol: string;
  /** Artículo que la respalda, para el badge en la ficha. */
  articulo?: string;
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
  /** Punta de examen que cierra la escena en el panel. */
  examen?: string;
  /** Truco de memoria que el panel muestra en la franja ámbar. */
  truco?: string;
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
  "Gavel", "Stamp", "Ban", "ListChecks", "Swords", "BookOpen", "GraduationCap",
] as const;

export const VIDEO_ESCENAS: Record<string, GuionVideo> = {
  "actores-involucrados": [
    // ── ESCENA 0: gancho ───────────────────────────────────────────────────────
    {
      titulo: "¿Por qué te importa esto?",
      cinta: "Lo que el examen pregunta de esta clase",
      examen: "Casi el 4 % del examen (≈3 de 72) sale de este tema: quién es quién y quién aprueba qué.",
      truco: "Memoriza el reparto: si la pregunta dice «emergencia», piensa TITULAR. Si dice «lo demás», piensa AUTORIDAD.",
      fichas: [
        { icono: "GraduationCap", nombre: "≈3 preguntas del examen", rol: "De este tema concreto" },
        { icono: "FileWarning", nombre: "La trampa #1", rol: "Confundir la DEC con el área usuaria" },
        { icono: "Gavel", nombre: "La trampa #2", rol: "Confundir quién aprueba: titular o autoridad" },
      ],
      guion: [
        { texto: "Este tema vale unas tres preguntas del examen. Tres puntos que puedes ganar o perder en treinta segundos." },
        { texto: "La trampa número uno es confundir a la DEC con el área usuaria. La trampa número dos es confundir quién aprueba qué." },
        { texto: "En tres minutos vas a dominar el reparto completo. Y al final, dos comprobaciones para que pruebes que lo aprendiste." },
      ],
    },
    // ── ESCENA 1: los cinco ─────────────────────────────────────────────────────
    {
      titulo: "Cinco actores en escena",
      cinta: "Ley 32069 · Art. 9",
      examen: "El examen te da los cinco nombres y te pide identificarlos: memoriza qué es cada uno y qué hace.",
      truco: "DGA = Reglas · OECE = Árbitro · Perú Compras = Bodega del Estado · Entidades = Las que contratan · Proveedores = Los que venden.",
      fichas: [
        { icono: "Landmark", nombre: "DGA", rol: "Dirección General de Abastecimiento del MEF", articulo: "Ley, Art. 9",
          detalle: "La DGA no contrata: formula la política de abastecimiento y emite las bases estándar, directivas y fichas de homologación que las entidades usan.",
          conecta: [4] },
        { icono: "Scale", nombre: "OECE", rol: "Organismo Especializado para las Contrataciones Públicas Eficientes", articulo: "Ley, Art. 9",
          detalle: "El OECE reemplazó al OSCE. Su Tribunal de Contrataciones Públicas (TCP) resuelve apelaciones y sanciona. «TCP» = Tribunal de Contrataciones Públicas.",
          conecta: [3] },
        { icono: "ShoppingBag", nombre: "Perú Compras", rol: "Central de Compras Públicas", articulo: "Ley, Art. 9",
          detalle: "Perú Compras puede recibir el encargo de TODAS las fases: no solo seleccionar, también ejecutar, liquidar y pagar. Eso la distingue de la compra por encargo, que solo cubre preparatorias o selección.",
          conecta: [3] },
        { icono: "Building2", nombre: "Entidades contratantes", rol: "Las que contratan en nombre del Estado", articulo: "Ley, Art. 9",
          detalle: "Cada entidad se organiza con seis roles internos: titular, autoridad, área usuaria, área técnica, DEC y compradores públicos. De ellos salen todas las decisiones de la contratación.",
          conecta: [4] },
        { icono: "Users", nombre: "Proveedores", rol: "Los que ofrecen bienes y servicios", articulo: "Ley, Art. 9",
          detalle: "Los proveedores se inscriben en el RNP. En el examen, «participante» es el registrado en un procedimiento, y «postor» es quien además presenta oferta.",
          conecta: [3] },
      ],
      guion: [
        { texto: "El artículo 9 de la Ley presenta a los cinco actores del proceso." },
        { texto: "Primero, la DGA. Ella pone las reglas del juego: bases estándar, directivas, fichas de homologación. No contrata.", ficha: 0 },
        { texto: "Luego, el OECE: el organismo especializado. Piensa en él como el árbitro del juego. Su tribunal resuelve apelaciones y sanciona.", ficha: 1 },
        { texto: "Perú Compras es la central que compra en grande para todo el Estado. Puede recibir TODAS las fases.", ficha: 2 },
        { texto: "Las entidades contratantes son las que contratan: tu municipalidad, tu ministerio, tu hospital.", ficha: 3 },
        { texto: "Y los proveedores: quienes venden sus bienes y servicios al Estado.", ficha: 4 },
      ],
    },
    // ── ESCENA 2: dentro de la entidad ─────────────────────────────────────────
    {
      titulo: "Dentro de la entidad: seis papeles",
      cinta: "Reglamento · Arts. 14–20",
      examen: "El examen confunde con la autoridad de gestión administrativa: en un ministerio es la secretaría general, en una municipalidad, la gerencia.",
      truco: "T-A-D-C: Titular y Autoridad deciden, DEC y Compradores ejecutan. Áreas usuaria y técnica piden.",
      fichas: [
        { icono: "Crown", nombre: "Titular", rol: "La máxima autoridad de la entidad", articulo: "Rgto., Art. 18",
          detalle: "El titular aprueba: emergencia, desabastecimiento, adicionales de obras y la anulación de laudo. En una empresa del Estado, es el gerente general.",
          conecta: [1] },
        { icono: "UserCog", nombre: "Autoridad de gestión administrativa", rol: "Secretaría general o gerencia, según la entidad", articulo: "Rgto., Art. 19",
          detalle: "La AGA aprueba: los demás no competitivos, adicionales de bienes, servicios y consultorías, declara nulidades y resuelve apelaciones. Sus apelaciones son INDELEGABLES (Art. 302.1).",
          conecta: [0, 4] },
        { icono: "User", nombre: "Área usuaria", rol: "Formula su requerimiento", articulo: "Rgto., Art. 20",
          detalle: "El área usuaria pide, verifica el cumplimiento y emite la conformidad. Si la pregunta es quién da la conformidad, la respuesta nunca es la DEC.",
          conecta: [4] },
        { icono: "Compass", nombre: "Área técnica estratégica", rol: "Pide por otras unidades de la entidad", articulo: "Rgto., Art. 20",
          detalle: "Cuando una unidad no puede formular su propio requerimiento, esta área lo hace por ella. Tiene el mismo papel que el área usuaria, pero para otras oficinas.",
          conecta: [4] },
        { icono: "Network", nombre: "DEC", rol: "Dependencia encargada de las contrataciones", articulo: "Rgto., Art. 14",
          detalle: "La DEC conduce el proceso: registra en la Pladicop, elabora la estrategia, realiza la interacción con el mercado y revisa el requerimiento en lo normativo. Lo técnico es del área usuaria.",
          conecta: [5] },
        { icono: "BadgeCheck", nombre: "Compradores públicos", rol: "Personal certificado conforme a la directiva del OECE", articulo: "Rgto., Art. 14",
          detalle: "Son los funcionarios y servidores de la DEC, certificados por directiva del OECE. A través de ellos, la DEC registra en la Pladicop.",
          conecta: [4] },
      ],
      guion: [
        { texto: "Ahora entremos a la entidad. Aquí trabajan seis papeles distintos, y el examen espera que los distingas." },
        { texto: "El titular es la máxima autoridad. La última palabra.", ficha: 0 },
        { texto: "La autoridad de gestión administrativa: en un ministerio es la secretaría general; en una municipalidad, la gerencia. Aprueba lo demás.", ficha: 1 },
        { texto: "El área usuaria es la que pide, porque tiene la necesidad. Y ojo: también da la conformidad.", ficha: 2 },
        { texto: "El área técnica estratégica pide por otras unidades que no pueden hacerlo solas.", ficha: 3 },
        { texto: "La DEC es la que conduce el proceso. A través de sus compradores públicos, registra en la Pladicop.", ficha: 4 },
        { texto: "Y los compradores públicos son el personal certificado de la DEC.", ficha: 5 },
      ],
    },
    // ── ESCENA 3: la DEC ───────────────────────────────────────────────────────
    {
      titulo: "La DEC: lo que hace y lo que no",
      cinta: "Reglamento · Art. 14",
      examen: "El examen adora la excepción: la DEC registra todo, SALVO lo que corresponde a los evaluadores.",
      truco: "DEC = Dirige el proceso, Estrategia e interacción, Compradores públicos. Lo técnico NUNCA es de la DEC.",
      fichas: [
        { icono: "ClipboardList", nombre: "Pladicop", rol: "La DEC registra los actos de las tres fases", articulo: "Rgto., Art. 14.2.a",
          detalle: "La Pladicop es la Plataforma Digital para las Contrataciones Públicas (reemplaza al SEACE). La DEC registra ahí TODOS los actos de las tres fases: preparatorias, selección y ejecución.",
          conecta: [1, 3] },
        { icono: "Users", nombre: "Comités y jurados", rol: "Los comités registran sus actas; los jurados avisan a la DEC", articulo: "Rgto., Arts. 59 y 60",
          detalle: "La excepción que el examen adora: los comités registran sus propios acuerdos y votos en la Pladicop. Los jurados comunican sus prórrogas a la DEC para que ella las registre. Si respondes «la DEC registra todo», fallas.",
          conecta: [0] },
        { icono: "FileSearch", nombre: "Estrategia e interacción", rol: "Las elabora y conduce la DEC", articulo: "Ley, Arts. 47 y 49",
          detalle: "La DEC elabora la estrategia de contratación y realiza la interacción con el mercado, que puede ser indagación o consulta (Ley, Art. 47).",
          conecta: [3] },
        { icono: "FileWarning", nombre: "Lo técnico del requerimiento", rol: "Es del área usuaria, no de la DEC", articulo: "Rgto., Art. 14.2.b",
          detalle: "En el requerimiento, la DEC solo participa en lo normativo de la contratación. Los aspectos técnicos son del área usuaria. El examen lo pregunta como afirmación incorrecta: «la DEC puede modificar el requerimiento técnico».",
          conecta: [0] },
      ],
      guion: [
        { texto: "La DEC tiene tres encargos y una excepción que el examen adora." },
        { texto: "Encargo uno: registrar en la Pladicop los actos de las tres fases, a través de sus compradores públicos.", ficha: 0 },
        { texto: "La excepción: los comités registran sus propias actas. Los jurados comunican sus prórrogas a la DEC. Si respondes que la DEC registra todo, fallas.", ficha: 1 },
        { texto: "Encargo dos: elaborar la estrategia de contratación. Encargo tres: conducir la interacción con el mercado.", ficha: 2 },
        { texto: "Y ojo: en el requerimiento, la DEC opina solo de normativa. Lo técnico lo decide el área usuaria.", ficha: 3 },
      ],
    },
    // ── ESCENA 4: el área usuaria ───────────────────────────────────────────────
    {
      titulo: "El área usuaria: pide y conforma",
      cinta: "Reglamento · Art. 20",
      examen: "La conformidad la emite el área usuaria, NUNCA la DEC. El examen lo pregunta directamente.",
      truco: "Área usuaria = QUIEN PIDE Y QUIEN CONFORMA. Si la pregunta dice «conformidad», piensa área usuaria.",
      fichas: [
        { icono: "FileText", nombre: "Requerimiento", rol: "Lo formula en coordinación con la DEC", articulo: "Ley, Art. 46",
          detalle: "El requerimiento da inicio al proceso de contratación. Lo determina el área usuaria en coordinación con la DEC, e identifica la finalidad pública y los objetivos de la contratación.",
          conecta: [1] },
        { icono: "BadgeCheck", nombre: "Conformidad", rol: "La emite el área usuaria, no la DEC", articulo: "Rgto., Art. 20",
          detalle: "El área usuaria verifica el cumplimiento del contrato y emite la conformidad. Si la pregunta es «quién da la conformidad», la respuesta nunca es la DEC: es el área usuaria.",
          conecta: [0] },
      ],
      guion: [
        { texto: "El área usuaria es la protagonista silenciosa. Hace dos cosas que el examen siempre pregunta." },
        { texto: "Primero: formula su requerimiento, en coordinación con la DEC.", ficha: 0 },
        { texto: "Segundo: cuando llega la prestación, verifica el cumplimiento y emite la conformidad. Ni la DEC, ni el titular: el área usuaria.", ficha: 1 },
      ],
    },
    // ── ESCENA 5: quiz 1 ───────────────────────────────────────────────────────
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
        "La conformidad la emite el área usuaria, que además verificó el cumplimiento del contrato (Rgto., Art. 20). Ni la DEC ni el titular la firman.",
    },
    // ── ESCENA 6: el duelo: Titular vs AGA ────────────────────────────────────
    {
      titulo: "El duelo: Titular vs Autoridad",
      cinta: "Reglamento · Arts. 18 y 19",
      examen: "Si el supuesto dice «emergencia» o «desabastecimiento»: TITULAR. Si dice «lo demás»: AUTORIDAD. Si dice «apelaciones»: AUTORIDAD, indelegable.",
      truco: "Titular = Emergencia, Desabastecimiento, Obras, Laudo (E-D-O-L). Autoridad = Todo lo demás, Incluye Apelaciones indelegables.",
      fichas: [
        { icono: "Gavel", nombre: "Titular", rol: "Emergencia · Desabastecimiento · Adicionales de obra · Anulación de laudo", articulo: "Rgto., Art. 18",
          detalle: "APRUEBA: (i) contratación directa por emergencia (literal a del 55.1 de la Ley), (ii) desabastecimiento (literal b), (iii) adicionales de obras, (iv) inicio de la acción judicial de anulación de laudo. En una empresa del Estado: el gerente general.",
          conecta: [1] },
        { icono: "Stamp", nombre: "Autoridad de gestión administrativa", rol: "Los demás no competitivos · Adicionales de bienes y servicios · Nulidades · Apelaciones", articulo: "Rgto., Art. 19",
          detalle: "APRUEBA: (i) los demás no competitivos, (ii) adicionales de bienes, servicios y consultorías de obras (hasta 25%), (iii) declara nulidades, (iv) resuelve apelaciones. Sus apelaciones son INDELEGABLES (Art. 302.1).",
          conecta: [0] },
      ],
      guion: [
        { texto: "Esta es la comparación que más confusiones causa en el examen. Dos firmas, un reparto que debes memorizar." },
        { texto: "El titular aprueba cuatro cosas: emergencia, desabastecimiento, adicionales de obras, y la anulación de laudo.", ficha: 0 },
        { texto: "La autoridad de gestión administrativa aprueba todo lo demás: los otros no competitivos, los adicionales de bienes y servicios, declara nulidades y resuelve apelaciones. Y ojo: sus apelaciones son indelegables.", ficha: 1 },
      ],
    },
    // ── ESCENA 7: quiz 2 (con escenario) ──────────────────────────────────────
    {
      tipo: "quiz",
      titulo: "Comprueba: la emergencia",
      cinta: "Reglamento · Art. 18",
      pregunta: "Las lluvias destruyen vías rurales de una municipalidad y hay que contratar la maquinaria de inmediato. ¿Quién aprueba esa contratación directa por emergencia?",
      opciones: [
        { texto: "La autoridad de gestión administrativa", correcta: false },
        { texto: "El titular de la entidad", correcta: true },
        { texto: "El área usuaria", correcta: false },
      ],
      aclaracion:
        "La emergencia la aprueba el titular de la entidad (Rgto., Art. 18). Recuerda: titular para emergencia y desabastecimiento; la autoridad, para todo lo demás.",
    },
    // ── ESCENA 8: delegación ──────────────────────────────────────────────────
    {
      titulo: "Delegar: sí, pero no todo",
      cinta: "Ley 32069 · Art. 25 · Reglamento · Art. 302.1",
      examen: "El examen pregunta: «¿puede la AGA delegar la resolución de apelaciones?» — NO, es indelegable.",
      truco: "Todo se delega por resolución, EXCEPTO las apelaciones de la autoridad de gestión administrativa.",
      fichas: [
        { icono: "FileText", nombre: "Resolución", rol: "La delegación de facultades se hace por resolución", articulo: "Ley, Art. 25",
          detalle: "El titular y la autoridad pueden delegar sus facultades mediante resolución. Es un acto formal: nada de acuerdos verbales ni correos.",
          conecta: [1] },
        { icono: "Ban", nombre: "Apelaciones", rol: "La AGA las resuelve de forma indelegable", articulo: "Rgto., Art. 302.1",
          detalle: "La excepción estrella: resolver los recursos de apelación es indelegable para la autoridad de gestión administrativa. Si el examen pregunta si puede delegarse, la respuesta es «no».",
          conecta: [0] },
      ],
      guion: [
        { texto: "¿Y pueden delegar? Sí, con una sola regla de forma. Y una excepción." },
        { texto: "Titular y autoridad delegan mediante resolución. Nada de acuerdos verbales.", ficha: 0 },
        { texto: "Pero la excepción: resolver apelaciones es indelegable para la autoridad de gestión administrativa. Si te lo preguntan, esa es la respuesta.", ficha: 1 },
      ],
    },
    // ── ESCENA 9: cierre ────────────────────────────────────────────────────────
    {
      titulo: "Para el examen",
      cinta: "Tu tarjeta de repaso",
      examen: "Practica ya: rendir el balotario de actos preparatorios en el simulador para comprobar que dominas el reparto.",
      truco: "5-6-2: CINCO actores, SEIS dentro, DOS firmas (titular y autoridad). La DEC registra salvo comités. El área usuaria conforma. Apelaciones: indelegables.",
      fichas: [
        { icono: "Network", nombre: "DEC", rol: "Registra, salvo comités y jurados", articulo: "Rgto., Art. 14",
          detalle: "La DEC registra en la Pladicop, pero los comités registran sus actas y los jurados comunican a la DEC." },
        { icono: "BadgeCheck", nombre: "Área usuaria", rol: "Pide y da la conformidad", articulo: "Rgto., Art. 20",
          detalle: "Formula el requerimiento y emite la conformidad. Ni la DEC ni el titular." },
        { icono: "Gavel", nombre: "Titular", rol: "Emergencia, desabastecimiento y adicionales de obra", articulo: "Rgto., Art. 18",
          detalle: "Aprueba la emergencia, el desabastecimiento y los adicionales de obras." },
        { icono: "Stamp", nombre: "AGA", rol: "El resto, y apelaciones indelegables", articulo: "Rgto., Art. 19",
          detalle: "Aprueba los demás no competitivos y declara nulidades. Sus apelaciones son indelegables." },
      ],
      guion: [
        { texto: "Cerremos con tu tarjeta de repaso. Repite conmigo." },
        { texto: "Cinco actores en el proceso, seis dentro de la entidad. La DEC registra, salvo lo que toca a los evaluadores.", ficha: 0 },
        { texto: "El área usuaria pide y da la conformidad.", ficha: 1 },
        { texto: "El titular: emergencia, desabastecimiento y adicionales de obra.", ficha: 2 },
        { texto: "Y la autoridad: todo lo demás, con las apelaciones indelegables. Ya dominas el reparto: practícalo en el simulador.", ficha: 3 },
      ],
    },
  ],
};
