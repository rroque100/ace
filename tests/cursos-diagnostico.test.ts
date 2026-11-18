import { describe, expect, it } from "vitest";
import { EXAM_CURRICULUM } from "@/lib/exam-curriculum";
import { buscarCurso, clasesEnOrden } from "@/lib/cursos/catalogo";
import { PREGUNTAS_DIAGNOSTICO, recomendacionDeClase, respuestasDeIntento, resultadoDiagnostico } from "@/lib/cursos/diagnostico";

const curso = buscarCurso("certificacion-oece")!;

describe("prueba diagnóstica", () => {
  it("califica el intento: acierta solo la opción correcta y lo omitido cuenta como fallo", () => {
    const preguntas = [
      { id: "a", subcompetency_code: "1.2", correct_option: "B" },
      { id: "b", subcompetency_code: "2.8", correct_option: "C" },
      { id: "c", subcompetency_code: "3.1", correct_option: "A" },
      { id: 7, subcompetency_code: "3.2", correct_option: "A" }, // mal formada: se ignora
    ];
    const respuestas = [
      { question_id: "a", option: "B" },
      { question_id: "b", option: "A" },
    ];
    expect(respuestasDeIntento(preguntas, respuestas)).toEqual([
      { tema: "1.2", acierto: true },
      { tema: "2.8", acierto: false },
      { tema: "3.1", acierto: false },
    ]);
  });

  it("todo bien: sin temas fallados ni clases recomendadas, y el reparto por competencia cuadra", () => {
    const temas = ["1.1", "1.2", "1.3", "1.4", "1.5", "2.1", "2.2", "2.3", "2.4", "2.5", "3.1", "3.2", "3.3", "3.4", "3.5"];
    const r = resultadoDiagnostico(curso, temas.map((tema) => ({ tema, acierto: true })));
    expect(r).toMatchObject({ aciertos: 15, total: PREGUNTAS_DIAGNOSTICO, temasFallados: [], recomendadas: [] });
    expect(r.competencias.map((c) => [c.codigo, c.aciertos, c.total])).toEqual([["1", 5, 5], ["2", 5, 5], ["3", 5, 5]]);
  });

  it("cada tema del temario oficial, si se falla, lleva al menos a una clase que lo enseña", () => {
    const clases = clasesEnOrden(curso);
    for (const t of EXAM_CURRICULUM) {
      const r = resultadoDiagnostico(curso, [{ tema: t.code, acierto: false }]);
      expect(r.recomendadas.length, t.code).toBeGreaterThan(0);
      for (const c of r.recomendadas) expect(c.temas, `${t.code} → ${c.slug}`).toEqual([t.code]);
      // A igual peso, la primera recomendada es la primera del curso que enseña el tema.
      expect(r.recomendadas[0].slug, t.code).toBe(clases.find((c) => c.temas.includes(t.code))!.slug);
    }
  });

  it("recomienda primero lo que más pesa en el examen y nunca más de cinco clases", () => {
    const r = resultadoDiagnostico(curso, [
      { tema: "2.8", acierto: false },
      { tema: "1.2", acierto: false },
      { tema: "3.1", acierto: false },
      { tema: "3.6", acierto: false },
      { tema: "2.1", acierto: false },
    ]);
    expect(r.temasFallados[0].code).toBe("1.2");
    expect(r.recomendadas[0].temas).toContain("1.2");
    expect(r.recomendadas.length).toBeLessThanOrEqual(5);
  });

  it("un tema desconocido no rompe nada: no cuenta para ninguna competencia ni recomienda clases", () => {
    const r = resultadoDiagnostico(curso, [{ tema: "9.9", acierto: false }]);
    expect(r.recomendadas).toEqual([]);
    expect(r.competencias.every((c) => c.total === 0)).toBe(true);
  });
});

describe("recomendación del diagnóstico dentro de la clase", () => {
  it("cada clase recomendada sabe su lugar y sus temas fallados; las demás no muestran nada", () => {
    const r = resultadoDiagnostico(curso, [
      { tema: "1.2", acierto: false },
      { tema: "2.8", acierto: false },
      { tema: "3.1", acierto: true },
    ]);
    r.recomendadas.forEach((c, i) => {
      const x = recomendacionDeClase(r, c.slug);
      expect(x, c.slug).toMatchObject({ posicion: i + 1, total: r.recomendadas.length });
      expect(x!.temas.map((t) => t.code)).toEqual(c.temas);
      for (const t of x!.temas) expect(t.label, t.code).not.toBe(t.code);
    });
    const otra = clasesEnOrden(curso).find((c) => !r.recomendadas.some((x) => x.slug === c.slug))!;
    expect(recomendacionDeClase(r, otra.slug)).toBeNull();
  });
});
