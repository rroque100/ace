// Guiones de los videos animados de las clases. Cada clase que declare `animacion` encuentra aquí su guion:
// escenas de contenido (fichas + segmentos narrados) y comprobaciones interactivas. El reproductor
// (app/components/cursos/video-animado.tsx) narra segmento por segmento y resalta la ficha que está presentando.
//
// REGLA DE VOZ: los segmentos se hablan, no se leen: frases cortas, palabras simples, sin legalismos.
// El alumno escucha a un profesor, no a la gaceta. La regla de contenido no cambia: cada afirmación sale de la
// clase verificada contra el corpus (Ley al 19.07.2026, Reglamento al 09.01.2026); nada nuevo que ella no respalde.
// Módulo puro: sin red ni base de datos.

export type FichaVideo = { icono: string; nombre: string; rol: string };
/** Un trozo de narración. Si apunta a una ficha, esta se resalta mientras se habla. */
export type SegmentoVideo = { texto: string; ficha?: number };
export type EscenaContenido = {
  titulo: string;
  cinta: string;
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
      fichas: [
        { icono: "Landmark", nombre: "DGA", rol: "Dirección General de Abastecimiento del MEF" },
        { icono: "Scale", nombre: "OECE", rol: "Organismo Especializado para las Contrataciones Públicas Eficientes" },
        { icono: "ShoppingBag", nombre: "Perú Compras", rol: "Central de Compras Públicas" },
        { icono: "Building2", nombre: "Entidades contratantes", rol: "Las que contratan en nombre del Estado" },
        { icono: "Users", nombre: "Proveedores", rol: "Los que ofrecen bienes y servicios" },
      ],
      guion: [
        { texto: "Toda contratación pública tiene su reparto. El artículo 9 de la Ley presenta a los cinco actores del proceso. Vamos uno por uno." },
        { texto: "Primero, la DGA. Es la Dirección General de Abastecimiento, y vive en el Ministerio de Economía y Finanzas.", ficha: 0 },
        { texto: "Luego, el OECE: el organismo especializado de las contrataciones públicas eficientes. Piensa en él como el árbitro del juego.", ficha: 1 },
        { texto: "Perú Compras es la central que compra en grande, para todo el Estado.", ficha: 2 },
        { texto: "Las entidades contratantes son las que contratan: tu municipalidad, tu ministerio, tu hospital.", ficha: 3 },
        { texto: "Y los proveedores: quienes venden sus bienes y servicios al Estado. Ese es el reparto completo.", ficha: 4 },
      ],
    },
    {
      titulo: "Y dentro de la entidad, seis más",
      cinta: "Reglamento · Arts. 14–20",
      fichas: [
        { icono: "Crown", nombre: "Titular", rol: "La máxima autoridad de la entidad" },
        { icono: "UserCog", nombre: "Autoridad de gestión administrativa", rol: "Secretaría general o gerencia, según la entidad" },
        { icono: "User", nombre: "Área usuaria", rol: "Formula su requerimiento" },
        { icono: "Compass", nombre: "Área técnica estratégica", rol: "Pide por otras unidades de la entidad" },
        { icono: "Network", nombre: "DEC", rol: "Dependencia encargada de las contrataciones" },
        { icono: "BadgeCheck", nombre: "Compradores públicos", rol: "Personal certificado conforme a la directiva del OECE" },
      ],
      guion: [
        { texto: "Ahora entremos a la entidad contratante. Aquí trabaja otro equipo, con seis papeles bien distintos." },
        { texto: "El titular es la máxima autoridad. La última palabra.", ficha: 0 },
        { texto: "La autoridad de la gestión administrativa: en un ministerio es la secretaría general; en una municipalidad o región, la gerencia.", ficha: 1 },
        { texto: "El área usuaria es la que pide, porque tiene la necesidad.", ficha: 2 },
        { texto: "El área técnica estratégica también pide, pero por otras unidades que no pueden hacerlo solas.", ficha: 3 },
        { texto: "La DEC es la dependencia encargada de las contrataciones: la que conduce el proceso.", ficha: 4 },
        { texto: "Y los compradores públicos: el personal de la DEC, certificado conforme a la directiva del OECE.", ficha: 5 },
      ],
    },
    {
      titulo: "La DEC registra, no recibe",
      cinta: "Reglamento · Art. 14",
      fichas: [
        { icono: "ClipboardList", nombre: "Pladicop", rol: "La DEC registra los actos de las tres fases" },
        { icono: "Users", nombre: "Comités y jurados", rol: "Los comités registran sus actas; los jurados avisan a la DEC" },
        { icono: "FileSearch", nombre: "Estrategia e interacción", rol: "Las elabora y conduce la DEC" },
        { icono: "FileWarning", nombre: "Lo técnico del requerimiento", rol: "Es del área usuaria, no de la DEC" },
      ],
      guion: [
        { texto: "La DEC tiene encargos claros, y una excepción que el examen adora. Escucha bien." },
        { texto: "Encargo uno: registrar en la Pladicop los actos de las tres fases, a través de sus compradores públicos.", ficha: 0 },
        { texto: "La excepción: los comités registran sus propias actas. Y los jurados comunican sus prórrogas a la DEC, para que ella las registre.", ficha: 1 },
        { texto: "Encargo dos: elaborar la estrategia de contratación. Encargo tres: conducir la interacción con el mercado.", ficha: 2 },
        { texto: "Y ojo con esto: en el requerimiento, la DEC opina solo de normativa. Lo técnico lo decide el área usuaria.", ficha: 3 },
      ],
    },
    {
      titulo: "El área usuaria pide y conforma",
      cinta: "Reglamento · Art. 20",
      fichas: [
        { icono: "FileText", nombre: "Requerimiento", rol: "Lo formula en coordinación con la DEC" },
        { icono: "BadgeCheck", nombre: "Conformidad", rol: "La emite el área usuaria, no la DEC" },
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
      fichas: [
        { icono: "Gavel", nombre: "Titular", rol: "Emergencia, desabastecimiento, adicionales de obra y anulación de laudo" },
        { icono: "Stamp", nombre: "Autoridad de gestión administrativa", rol: "Los demás no competitivos, adicionales de bienes y servicios, y las nulidades" },
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
      fichas: [
        { icono: "FileText", nombre: "Resolución", rol: "La delegación de facultades se hace por resolución" },
        { icono: "Ban", nombre: "Apelaciones", rol: "La AGA las resuelve de forma indelegable" },
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
        { icono: "Network", nombre: "DEC", rol: "Registra, salvo comités y jurados" },
        { icono: "BadgeCheck", nombre: "Área usuaria", rol: "Pide y da la conformidad" },
        { icono: "Gavel", nombre: "Titular", rol: "Emergencia, desabastecimiento y adicionales de obra" },
        { icono: "Stamp", nombre: "AGA", rol: "El resto, y apelaciones indelegables" },
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
