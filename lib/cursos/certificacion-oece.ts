import type { Clase, Curso } from "./tipos";
import { ACTOS_PREPARATORIOS } from "./contenido/actos-preparatorios";
import { FASE_SELECCION } from "./contenido/fase-seleccion";
import { EJECUCION_CONTRACTUAL } from "./contenido/ejecucion-contractual";
import { OBRAS } from "./contenido/obras";
import { REQUERIMIENTO_ESTRATEGIA } from "./contenido/requerimiento-estrategia";
import { TEMAS_PENDIENTES } from "./contenido/temas-pendientes";

// Curso de preparación para el examen de certificación OECE.
//
// ORDEN: las secciones son las tres competencias del TEMARIO OFICIAL del examen (lib/exam-curriculum.ts, el mismo que
// usa el simulacro de 72 preguntas), no los bloques del taller del que salió el primer temario. Por eso
// «Perfeccionamiento del contrato» está en Selección (subcompetencias 2.9 y 2.10) y no en Ejecución, y MDA e
// Incentivos de obras van a Complementos: el temario oficial no los evalúa como tema propio.
//
// Los ficheros de contenido conservan su agrupación de origen; aquí solo se elige qué clase va en qué sección y en qué
// orden, por slug. Los slugs no cambian al reordenar, así que el avance guardado de cada persona sigue valiendo.
//
// Los numerales romanos (Módulo I…XVIII) son los del taller y se conservan porque el alumno los reconoce; ya no
// coinciden con el orden del curso, a propósito. Los módulos XIX–XXXII son clases de refuerzo de ACE, nacidas del
// análisis de coherencia con los balotarios y el banco (docs/evaluaciones/2026-11-17-coherencia-simulador-curso.md):
// cubren los bloques que el examen más pregunta y el taller no desarrollaba.
//
// Cada clase trae casos tipo examen (pestaña «Casuística»): el banco del simulador es casi todo casuística.
//
// Los exámenes no se reimplementan aquí: cada competencia termina en el banco del simulador, que filtra por competencia
// y tema y tiene el simulacro con el reparto oficial.
const TODAS = new Map<string, Clase>(
  [
    ...ACTOS_PREPARATORIOS,
    ...FASE_SELECCION,
    ...EJECUCION_CONTRACTUAL,
    ...OBRAS,
    ...REQUERIMIENTO_ESTRATEGIA,
    ...TEMAS_PENDIENTES,
  ].map((c) => [c.slug, c]),
);

function clases(...slugs: string[]): Clase[] {
  return slugs.map((slug) => {
    const clase = TODAS.get(slug);
    // Un slug mal escrito aquí rompería la página en producción: mejor que falle al cargar el módulo (y en los tests).
    if (!clase) throw new Error(`Clase desconocida en el curso: ${slug}`);
    return clase;
  });
}

const BANCO = "/simulador?seccion=banco";

export const CERTIFICACION_OECE: Curso = {
  slug: "certificacion-oece",
  titulo: "Preparación para el examen de certificación OECE",
  descripcion:
    "Estudia la Ley 32069 y su Reglamento con el temario oficial del examen de certificación: actuaciones " +
    "preparatorias, selección y ejecución contractual. Cada clase indica cuánto pesa su tema en el examen, resume lo " +
    "que se evalúa con su base legal, trae casos tipo examen resueltos, y cada competencia termina con práctica en el " +
    "banco del simulador.",
  nivel: "Intermedio",
  publicado: "2026-11-16",
  secciones: [
    {
      slug: "actuaciones-preparatorias",
      titulo: "Actuaciones preparatorias",
      competencia: "1",
      clases: clases(
        "actores-involucrados",
        "plan-anual-contrataciones",
        "segmentacion-contrataciones",
        "actos-preparatorios",
        // Tema 1.2 (≈13 de 72 preguntas): VI da la visión general y estas tres desarrollan lo que se evalúa.
        "requerimiento-contenido",
        "interaccion-mercado-cuantia",
        "estrategia-agrupamiento-fraccionamiento",
        "expediente-contratacion",
        "evaluadores",
        "bases-anuncio-pladicop-preparatorias",
      ),
      puntoControl: {
        titulo: "Practica actuaciones preparatorias",
        href: BANCO,
        descripcion: "En el banco, elige la competencia «Actuaciones preparatorias»: requerimiento, PAC, expediente y evaluadores.",
      },
    },
    {
      slug: "seleccion",
      titulo: "Selección",
      competencia: "2",
      clases: clases(
        "procedimientos-seleccion",
        "modalidades-contratacion-eficiente",
        "pladicop-seleccion",
        "evaluacion-ofertas-desempate",
        "plazos-buena-pro-seleccion",
        "recurso-apelacion",
        "perfeccionamiento-contrato",
      ),
      puntoControl: {
        titulo: "Practica selección",
        href: BANCO,
        descripcion: "En el banco, elige la competencia «Selección»: procedimientos, etapas y plazos, apelación y perfeccionamiento.",
      },
    },
    {
      slug: "ejecucion-contractual",
      titulo: "Ejecución contractual",
      competencia: "3",
      clases: clases(
        "inicio-plazo-vigencia-contrato",
        "modificaciones-contrato",
        "modificaciones-procedimiento",
        "garantias",
        "adelantos-penalidades-subcontratacion",
        "recepcion-conformidad-bienes-servicios",
        "resolucion-nulidad-contrato",
        "resolucion-controversias",
        // Obras, en el orden de la ejecución: expediente y equipo, suspensión y control, cierre.
        "obra-expediente-residente-supervision",
        "suspension-reprogramacion-obra",
        "intervencion-economica",
        "obra-valorizacion-recepcion-liquidacion",
        "contratos-estandarizados-internacionales",
      ),
      puntoControl: {
        titulo: "Practica ejecución contractual",
        href: BANCO,
        descripcion: "En el banco, elige la competencia «Ejecución contractual»: modificaciones, garantías, resolución, controversias y obras.",
      },
    },
    {
      slug: "complementos",
      titulo: "Complementos",
      clases: clases("mecanismo-diferenciado-adquisicion", "incentivos-obras-consultoria"),
    },
  ],
  examenFinal: {
    titulo: "Tomar el simulacro",
    href: BANCO,
    descripcion: "Simulacro OECE de 72 preguntas en 120 minutos, con el reparto del temario oficial.",
  },
};
