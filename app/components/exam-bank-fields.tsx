"use client";
import {
  COMPETENCIES,
  CURRICULUM_VERSION,
  EXAM_CURRICULUM,
} from "@/lib/exam-curriculum";
import { OPTION_IDS, type ExamQuestion } from "@/lib/exam-policy";
const field =
  "mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-700";
const checks = {
  unambiguous:
    "La pregunta tiene una única respuesta, no es ambigua y corresponde a la subcompetencia seleccionada",
  distractors:
    "Las alternativas incorrectas son plausibles y su descarte está explicado",
  conditions: "El enunciado conserva las condiciones de aplicación",
  exceptions: "Las excepciones pertinentes fueron comprobadas",
  sources:
    "La versión, artículo, página y pasaje sostienen la clave y su explicación",
};
export function ExamBankFields({
  value: q,
  onChange,
}: {
  value: ExamQuestion;
  onChange: (q: ExamQuestion) => void;
}) {
  return (
    <section className="space-y-4 rounded-xl border border-teal-200 bg-teal-50/30 p-4">
      <h3 className="font-semibold">Temario y revisión de cada alternativa</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          Competencia del temario
          <select
            className={field}
            value={q.competencyCode}
            onChange={(e) =>
              onChange({
                ...q,
                curriculumVersion: CURRICULUM_VERSION,
                competencyCode: e.target.value,
                competency: COMPETENCIES[e.target.value] ?? "",
                subcompetencyCode: "",
              })
            }
          >
            <option value="">Marco general · sin asignar</option>
            {Object.entries(COMPETENCIES).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Subcompetencia del temario
          <select
            className={field}
            value={q.subcompetencyCode}
            onChange={(e) =>
              onChange({
                ...q,
                curriculumVersion: CURRICULUM_VERSION,
                subcompetencyCode: e.target.value,
              })
            }
          >
            <option value="">Selecciona una subcompetencia</option>
            {EXAM_CURRICULUM.filter(
              (s) => s.competency === q.competencyCode,
            ).map((s) => (
              <option key={s.code} value={s.code}>
                {s.code} · {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Demanda cognitiva
          <select
            className={field}
            value={q.cognitiveLevel}
            onChange={(e) =>
              onChange({
                ...q,
                cognitiveLevel: e.target
                  .value as ExamQuestion["cognitiveLevel"],
              })
            }
          >
            <option value="understand">Comprender la disposición</option>
            <option value="apply">Aplicar a un caso</option>
            <option value="analyze">Analizar varias condiciones</option>
          </select>
        </label>
        <label className="text-sm">
          Fecha de corte normativo
          <input
            className={field}
            type="date"
            value={q.sourceCutoff}
            onChange={(e) => onChange({ ...q, sourceCutoff: e.target.value })}
          />
        </label>
      </div>
      <p className="text-xs text-slate-600">
        La dificultad es una valoración editorial; no acredita un nivel del
        OECE. La fecha de corte debe corresponder a la normativa revisada.
      </p>
      {OPTION_IDS.map((id) => (
        <label className="block text-sm" key={id}>
          Alternativa {id} ·{" "}
          {id === q.correctOption
            ? "por qué es correcta"
            : "por qué se descarta"}
          <textarea
            rows={2}
            className={field}
            value={q.optionRationales[id]}
            onChange={(e) =>
              onChange({
                ...q,
                optionRationales: {
                  ...q.optionRationales,
                  [id]: e.target.value,
                },
              })
            }
          />
        </label>
      ))}
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-semibold">
          Comprobaciones de quien revisa
        </legend>
        {Object.entries(checks).map(([id, label]) => (
          <label className="flex min-h-11 items-start gap-3 text-sm" key={id}>
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-teal-700"
              checked={q.reviewChecks[id as keyof typeof checks]}
              onChange={(e) =>
                onChange({
                  ...q,
                  reviewChecks: { ...q.reviewChecks, [id]: e.target.checked },
                })
              }
            />
            {label}
          </label>
        ))}
      </fieldset>
      <p className="text-xs text-slate-600">
        {q.origin.startsWith("IA:")
          ? "Propuesta asistida por IA, pendiente de revisión humana."
          : "Pregunta de autoría manual."}{" "}
        Las comprobaciones automáticas no sustituyen tu revisión.
      </p>
    </section>
  );
}
