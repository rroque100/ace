import raw from "@/app/components/balotarios/balotarios-oece.json";
import type { PreguntaBalotario } from "./balotarios-policy";

const normalizar = (s: string) => s.toLocaleLowerCase("es").replace(/\s+/g, " ").trim();
const repeticiones = new Map<string, number>();
for (const b of raw.balotarios) for (const q of b.preguntas) {
  const key = normalizar(q.pregunta);
  repeticiones.set(key, (repeticiones.get(key) ?? 0) + 1);
}
export const catalogoBalotarios = raw.balotarios.map(b => ({
  balotario: b.balotario,
  preguntas: b.preguntas.map((q): PreguntaBalotario => ({ ...q, id: `b${b.balotario}-q${q.n}`,
    revisada: false,
    incidencia: b.balotario === 1 && q.n === 27 ? "El enunciado y las alternativas requieren revisión de contexto." : undefined,
  })),
}));
export function diagnosticoBalotarios() {
  return catalogoBalotarios.flatMap(b => b.preguntas.map(q => ({
    id: q.id, balotario: b.balotario, pregunta: q.pregunta,
    sinCompetencia: !q.competencia, repetido: (repeticiones.get(normalizar(q.pregunta)) ?? 0) > 1,
    incidencia: q.incidencia, revisada: false,
  })));
}
