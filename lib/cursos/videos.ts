// Guiones de los videos animados de las clases. Cada clase que declare `animacion` encuentra aquí su guion:
// escenas con fichas (icono + nombre + rol) y la narración que el reproductor lee en voz alta. El contenido sale
// de las clases verificadas contra el corpus (Ley al 19.07.2026, Reglamento al 09.01.2026): una escena nueva no
// puede introducir una regla ni una cifra que su clase no respalde. Módulo puro: sin red ni base de datos.

export type FichaVideo = { icono: string; nombre: string; rol: string };
export type EscenaVideo = {
  titulo: string;
  /** Texto que se narra y se muestra como subtítulo. */
  narracion: string;
  fichas: readonly FichaVideo[];
  /** Referencia legal que pisa el escenario («Ley 32069 · Art. 9»). */
  cinta: string;
};
export type GuionVideo = readonly EscenaVideo[];

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
      narracion:
        "¿Quién participa en una contratación pública? El artículo 9 de la Ley presenta a los cinco actores del proceso: " +
        "la Dirección General de Abastecimiento del Ministerio de Economía y Finanzas; el Organismo Especializado para las " +
        "Contrataciones Públicas Eficientes, el OECE; la Central de Compras Públicas, Perú Compras; las entidades " +
        "contratantes, que contratan en nombre del Estado; y los proveedores, que ofrecen sus bienes y servicios en el mercado.",
      fichas: [
        { icono: "Landmark", nombre: "DGA", rol: "Dirección General de Abastecimiento del MEF" },
        { icono: "Scale", nombre: "OECE", rol: "Organismo Especializado para las Contrataciones Públicas Eficientes" },
        { icono: "ShoppingBag", nombre: "Perú Compras", rol: "Central de Compras Públicas" },
        { icono: "Building2", nombre: "Entidades contratantes", rol: "Las que contratan en nombre del Estado" },
        { icono: "Users", nombre: "Proveedores", rol: "Los que ofrecen bienes y servicios" },
      ],
      cinta: "Ley 32069 · Art. 9",
    },
    {
      titulo: "Y dentro de la entidad, seis más",
      narracion:
        "Ahora entremos a la entidad contratante. Aquí trabajan seis: el titular, la máxima autoridad; la autoridad de la " +
        "gestión administrativa, que en un ministerio es la secretaría general y en un gobierno regional o local, la gerencia; " +
        "el área usuaria, que pide lo que necesita; el área técnica estratégica, que formula los requerimientos de otras " +
        "unidades; la Dependencia Encargada de las Contrataciones, la DEC; y los compradores públicos, su personal certificado.",
      fichas: [
        { icono: "Crown", nombre: "Titular", rol: "La máxima autoridad de la entidad" },
        { icono: "UserCog", nombre: "Autoridad de gestión administrativa", rol: "Secretaría general o gerencia, según la entidad" },
        { icono: "User", nombre: "Área usuaria", rol: "Formula su requerimiento" },
        { icono: "Compass", nombre: "Área técnica estratégica", rol: "Pide por otras unidades de la entidad" },
        { icono: "Network", nombre: "DEC", rol: "Dependencia encargada de las contrataciones" },
        { icono: "BadgeCheck", nombre: "Compradores públicos", rol: "Personal certificado conforme a la directiva del OECE" },
      ],
      cinta: "Reglamento · Arts. 14–20",
    },
    {
      titulo: "La DEC registra, no recibe",
      narracion:
        "La DEC, a través de sus compradores públicos, registra en la Pladicop los actos de las tres fases. Ojo con la " +
        "excepción que el examen adora: los comités registran sus propias actas, y los jurados comunican sus prórrogas a la " +
        "DEC para que ella las registre. La DEC también elabora la estrategia de contratación y realiza la interacción con el " +
        "mercado. Pero en el requerimiento solo participa en lo normativo: lo técnico es responsabilidad del área usuaria.",
      fichas: [
        { icono: "ClipboardList", nombre: "Pladicop", rol: "La DEC registra los actos de las tres fases" },
        { icono: "Users", nombre: "Comités y jurados", rol: "Los comités registran sus actas; los jurados avisan a la DEC" },
        { icono: "FileSearch", nombre: "Estrategia e interacción", rol: "Las elabora y conduce la DEC" },
        { icono: "FileWarning", nombre: "Lo técnico del requerimiento", rol: "Es del área usuaria, no de la DEC" },
      ],
      cinta: "Reglamento · Art. 14",
    },
    {
      titulo: "El área usuaria pide y conforma",
      narracion:
        "El área usuaria formula su requerimiento en coordinación con la DEC y verifica el cumplimiento del contrato. Y " +
        "cuando la prestación llega, es ella quien emite la conformidad. Si el examen pregunta quién da la conformidad de la " +
        "prestación, la respuesta no es la DEC: es el área usuaria.",
      fichas: [
        { icono: "FileText", nombre: "Requerimiento", rol: "Lo formula en coordinación con la DEC" },
        { icono: "BadgeCheck", nombre: "Conformidad", rol: "La emite el área usuaria, no la DEC" },
      ],
      cinta: "Reglamento · Art. 20",
    },
    {
      titulo: "Quién aprueba qué",
      narracion:
        "Dos firmas concentran las decisiones. El titular aprueba las situaciones de emergencia y de desabastecimiento, " +
        "autoriza los adicionales de obras y el inicio de la acción judicial de anulación de laudo. La autoridad de la " +
        "gestión administrativa aprueba los demás procedimientos no competitivos, autoriza los adicionales de bienes, " +
        "servicios y consultorías de obras, y declara la nulidad de procedimientos y contratos.",
      fichas: [
        { icono: "Gavel", nombre: "Titular", rol: "Emergencia, desabastecimiento, adicionales de obra y anulación de laudo" },
        { icono: "Stamp", nombre: "Autoridad de gestión administrativa", rol: "Los demás no competitivos, adicionales de bienes y servicios, y las nulidades" },
      ],
      cinta: "Reglamento · Arts. 18 y 19",
    },
    {
      titulo: "Delegar: sí, pero no todo",
      narracion:
        "Titular y autoridad de la gestión administrativa pueden delegar sus facultades mediante resolución. Pero hay " +
        "excepciones que el examen pregunta: para la autoridad de la gestión administrativa, resolver los recursos de " +
        "apelación es una facultad indelegable.",
      fichas: [
        { icono: "FileText", nombre: "Resolución", rol: "La delegación de facultades se hace por resolución" },
        { icono: "Ban", nombre: "Apelaciones", rol: "La AGA las resuelve de forma indelegable" },
      ],
      cinta: "Ley 32069 · Art. 25 · Reglamento · Art. 302.1",
    },
    {
      titulo: "Para el examen",
      narracion:
        "Repasemos el reparto: cinco actores en el proceso y seis dentro de la entidad. La DEC registra en la Pladicop, " +
        "salvo lo que corresponde a los evaluadores. El área usuaria pide y da la conformidad. El titular: emergencia, " +
        "desabastecimiento y adicionales de obra. La autoridad de gestión administrativa: el resto, y las apelaciones, que " +
        "son indelegables. Ensayado el reparto, pasa a la siguiente clase.",
      fichas: [
        { icono: "Network", nombre: "DEC", rol: "Registra, salvo comités y jurados" },
        { icono: "BadgeCheck", nombre: "Área usuaria", rol: "Pide y da la conformidad" },
        { icono: "Gavel", nombre: "Titular", rol: "Emergencia, desabastecimiento y adicionales de obra" },
        { icono: "Stamp", nombre: "AGA", rol: "El resto, y apelaciones indelegables" },
      ],
      cinta: "Repaso del reparto",
    },
  ],
};
