// Prueba diagnóstica del curso OECE: 15 preguntas del banco (5 por competencia, cada una de un tema distinto del
// temario oficial) para decidir por dónde empezar a estudiar.
//
// La selección y la calificación las hace el motor del simulador (función ace_exam_start_diagnostic, en
// docs/supabase/2026-11-17-cursos-prueba-diagnostica.sql): aquí solo se traduce el intento entregado a «qué clases
// estudiar primero». Módulo puro: sin red ni base de datos.
import { clasesEnOrden } from "./catalogo";
import { temaExamen } from "./temario-examen";
import type { CompetenciaExamen, Curso } from "./tipos";

export const PREGUNTAS_DIAGNOSTICO = 15;
export const MINUTOS_DIAGNOSTICO = 25;
/** Cuántas clases se recomiendan como máximo: más de cinco ya no es «por dónde empezar». */
const MAX_RECOMENDADAS = 5;

/** Una pregunta del intento, ya calificada. `tema` es el código de subcompetencia (p. ej. «2.8»). */
export type RespuestaDiagnostico = { tema: string; acierto: boolean };

type PreguntaIntento = { id?: unknown; subcompetency_code?: unknown; correct_option?: unknown };
type RespuestaIntento = { question_id?: unknown; option?: unknown };

/**
 * Califica un intento a partir de sus preguntas (con la opción correcta, que solo existe en el servidor) y de las
 * respuestas guardadas. Una pregunta sin responder cuenta como fallo: en el examen también resta.
 */
export function respuestasDeIntento(
  preguntas: readonly PreguntaIntento[],
  respuestas: readonly RespuestaIntento[],
): RespuestaDiagnostico[] {
  const elegida = new Map(respuestas.map((r) => [String(r.question_id), r.option]));
  return preguntas
    .filter((q) => typeof q.id === "string" && typeof q.subcompetency_code === "string")
    .map((q) => ({
      tema: q.subcompetency_code as string,
      acierto: typeof q.correct_option === "string" && elegida.get(q.id as string) === q.correct_option,
    }));
}

export type ClaseRecomendada = { slug: string; modulo: string; titulo: string; temas: string[] };

export type ResultadoDiagnostico = {
  aciertos: number;
  total: number;
  competencias: Array<{ codigo: CompetenciaExamen; titulo: string; aciertos: number; total: number }>;
  /** Temas fallados, del que más pesa en el examen al que menos. */
  temasFallados: Array<{ code: string; label: string; quota: number }>;
  /** Clases que enseñan los temas fallados, de la que más preguntas del examen rescata a la que menos. */
  recomendadas: ClaseRecomendada[];
};

export function resultadoDiagnostico(curso: Curso, respuestas: readonly RespuestaDiagnostico[]): ResultadoDiagnostico {
  const competencias = curso.secciones
    .filter((s): s is typeof s & { competencia: CompetenciaExamen } => Boolean(s.competencia))
    .map((s) => {
      const suyas = respuestas.filter((r) => temaExamen(r.tema)?.competency === s.competencia);
      return { codigo: s.competencia, titulo: s.titulo, aciertos: suyas.filter((r) => r.acierto).length, total: suyas.length };
    });

  const fallados = new Map<string, { code: string; label: string; quota: number }>();
  for (const r of respuestas) {
    const t = temaExamen(r.tema);
    if (!r.acierto && t) fallados.set(t.code, { code: t.code, label: t.label, quota: t.quota });
  }
  const temasFallados = [...fallados.values()].sort((a, b) => b.quota - a.quota);

  // Una clase vale tanto como las preguntas del examen que cubren los temas fallados que enseña. A igual peso, manda
  // el orden del curso, que es el orden en que conviene estudiarlas.
  const recomendadas = clasesEnOrden(curso)
    .map((c, orden) => {
      const temas = c.temas.filter((t) => fallados.has(t));
      return { clase: c, orden, temas, peso: temas.reduce((s, t) => s + fallados.get(t)!.quota, 0) };
    })
    .filter((x) => x.temas.length > 0)
    .sort((a, b) => b.peso - a.peso || a.orden - b.orden)
    .slice(0, MAX_RECOMENDADAS)
    .map(({ clase, temas }) => ({ slug: clase.slug, modulo: clase.modulo, titulo: clase.titulo, temas }));

  return {
    aciertos: respuestas.filter((r) => r.acierto).length,
    total: respuestas.length,
    competencias,
    temasFallados,
    recomendadas,
  };
}

/**
 * Si el diagnóstico recomendó esta clase: en qué lugar (1 = la primera que conviene estudiar) y qué temas fallados
 * enseña. La recomendación se ve en la portada; esto la repite al entrar en la clase, que es donde se estudia.
 */
export function recomendacionDeClase(
  resultado: ResultadoDiagnostico,
  slug: string,
): { posicion: number; total: number; temas: Array<{ code: string; label: string }> } | null {
  const i = resultado.recomendadas.findIndex((c) => c.slug === slug);
  if (i < 0) return null;
  return {
    posicion: i + 1,
    total: resultado.recomendadas.length,
    temas: resultado.recomendadas[i].temas.map((code) => ({ code, label: temaExamen(code)?.label ?? code })),
  };
}
