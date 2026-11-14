import type { IntentoBalotario } from "./balotarios-policy";
export function estadisticasCompetencia(intentos: IntentoBalotario[]) {
  const grupos = new Map<string, { competencia: string; correctas: number; incorrectas: number; omitidas: number; total: number }>();
  for (const t of intentos) {
    if (t.state !== "submitted") continue;
    if (!t.questions.length && t.result?.competencies) {
      for (const r of t.result.competencies) {
        const old = grupos.get(r.competencia) ?? { competencia: r.competencia, correctas: 0, incorrectas: 0, omitidas: 0, total: 0 };
        grupos.set(r.competencia, { competencia: r.competencia, correctas: old.correctas+r.correctas, incorrectas: old.incorrectas+r.incorrectas, omitidas: old.omitidas+r.omitidas, total: old.total+r.total });
      }
      continue;
    }
    for (const q of t.questions) {
      const competencia = q.competencia || "Pendiente de clasificar";
      const row = grupos.get(competencia) ?? { competencia, correctas: 0, incorrectas: 0, omitidas: 0, total: 0 };
      row.total++;
      if (!t.answers[q.id]) row.omitidas++;
      else if (t.answers[q.id] === q.correcta) row.correctas++;
      else row.incorrectas++;
      grupos.set(competencia, row);
    }
  }
  return [...grupos.values()].sort((a, b) => a.competencia.localeCompare(b.competencia));
}
