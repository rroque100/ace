import type { Curso } from "./tipos";
import { ACTOS_PREPARATORIOS } from "./contenido/actos-preparatorios";
import { FASE_SELECCION } from "./contenido/fase-seleccion";
import { EJECUCION_CONTRACTUAL } from "./contenido/ejecucion-contractual";
import { OBRAS } from "./contenido/obras";

// Temario del taller de preparación para el examen de certificación OECE, en el orden de su aula virtual. El temario
// (qué módulos y en qué orden) es el del taller; el desarrollo de cada clase es de ACE y está contrastado con el corpus.
// Los numerales romanos se conservan porque el alumno los reconoce del examen; el orden de Obras (IX, XIII, XVII) es
// el del aula y no el numérico, a propósito.
//
// Los exámenes no se reimplementan aquí: cada sección termina en el simulador, que ya tiene los balotarios, el
// cronómetro, la corrección y el historial.
export const CERTIFICACION_OECE: Curso = {
  slug: "certificacion-oece",
  titulo: "Preparación para el examen de certificación OECE",
  descripcion:
    "Repasa la Ley 32069 y su Reglamento en el orden en que avanza una contratación: actos preparatorios, fase de " +
    "selección, ejecución contractual y obras. Cada clase resume lo que entra en el examen con su base legal, y cada " +
    "sección termina con práctica en el simulador.",
  nivel: "Intermedio",
  publicado: "2026-11-16",
  secciones: [
    {
      slug: "actos-preparatorios",
      titulo: "Actos preparatorios",
      clases: ACTOS_PREPARATORIOS,
      puntoControl: {
        titulo: "Practica actos preparatorios",
        href: "/simulador?vista=practicar",
        descripcion: "Preguntas del balotario sobre actores, modalidades, PAC, expediente y requerimiento.",
      },
    },
    {
      slug: "fase-seleccion",
      titulo: "Fase de selección",
      clases: FASE_SELECCION,
      puntoControl: {
        titulo: "Practica fase de selección",
        href: "/simulador?vista=practicar",
        descripcion: "Procedimientos de selección, MDA y recurso de apelación.",
      },
    },
    {
      slug: "ejecucion-contractual",
      titulo: "Ejecución contractual",
      clases: EJECUCION_CONTRACTUAL,
      puntoControl: {
        titulo: "Practica ejecución contractual",
        href: "/simulador?vista=practicar",
        descripcion: "Perfeccionamiento, garantías, modificaciones, resolución, nulidad y controversias.",
      },
    },
    {
      slug: "obras",
      titulo: "Obras",
      clases: OBRAS,
      puntoControl: {
        titulo: "Practica obras",
        href: "/simulador?vista=practicar",
        descripcion: "Incentivos, inicio del plazo de ejecución e intervención económica.",
      },
    },
  ],
  examenFinal: {
    titulo: "Tomar examen",
    href: "/simulador?vista=examen",
    descripcion: "Examen cronometrado con los balotarios OECE, corregido y con la cita de la norma.",
  },
};
