// Enlace entre el curso y el temario oficial del examen de certificación (lib/exam-curriculum.ts): cuánto pesa cada
// tema, qué competencia cubre cada sección y qué temas oficiales siguen sin clase. El temario es el mismo que usa el
// simulador para armar el simulacro de 72 preguntas, así que el peso que ve el alumno es el del examen que practica.
// Módulo puro: sin red ni base de datos.
import { COMPETENCIES, EXAM_CURRICULUM, type SubcompetencyCode } from "@/lib/exam-curriculum";
import type { Clase, CompetenciaExamen, Curso } from "./tipos";

export type TemaExamen = { code: SubcompetencyCode; label: string; quota: number; competency: CompetenciaExamen };

const POR_CODIGO = new Map<string, TemaExamen>(
  EXAM_CURRICULUM.map((t) => [t.code, { code: t.code, label: t.label, quota: t.quota, competency: t.competency as CompetenciaExamen }]),
);

/** Preguntas del examen completo (suma de las cuotas del temario). */
export const PREGUNTAS_EXAMEN = EXAM_CURRICULUM.reduce((n, t) => n + t.quota, 0);

export const temaExamen = (code: string): TemaExamen | null => POR_CODIGO.get(code) ?? null;

export const nombreCompetencia = (c: CompetenciaExamen) => COMPETENCIES[c];

/** Preguntas de una competencia en el examen (25, 22 y 25 en el temario vigente). */
export const preguntasCompetencia = (c: CompetenciaExamen) =>
  EXAM_CURRICULUM.filter((t) => t.competency === c).reduce((n, t) => n + t.quota, 0);

/**
 * Los temas oficiales de una clase, del más pesado al más ligero. A igual peso manda el orden en que la clase los
 * declara (el primero es su tema principal): `sort` es estable, así que no hace falta desempatar por código.
 */
export function temasDeClase(clase: Clase): TemaExamen[] {
  return clase.temas
    .map((c) => temaExamen(c))
    .filter((t): t is TemaExamen => t !== null)
    .sort((a, b) => b.quota - a.quota);
}

/** Temas del temario oficial que ninguna clase del curso trabaja todavía. */
export function temasSinClase(curso: Curso): TemaExamen[] {
  const cubiertos = new Set(curso.secciones.flatMap((s) => s.clases.flatMap((c) => c.temas)));
  return EXAM_CURRICULUM.filter((t) => !cubiertos.has(t.code)).map((t) => temaExamen(t.code)!);
}

/** «≈13 de 72 preguntas»: aproximado porque el banco reparte por cuotas, pero el examen real puede variar. */
export const textoPeso = (preguntas: number) => `≈${preguntas} de ${PREGUNTAS_EXAMEN} preguntas`;
