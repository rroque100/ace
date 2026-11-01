"use client";

import { useMemo, useState } from "react";
import raw from "./balotarios/balotarios-oece.json";

// Cuestionario de estudio con los 5 balotarios OECE importados de LEX. Vive
// aparte del banco gobernado (exam_questions): aquí no hay clasificación por
// subcompetencia ni revisión editorial, es material de repaso con su clave de
// respuestas, no preguntas publicables para el simulacro oficial.

type Opcion = { letra: string; texto: string };
type Pregunta = {
  n: number;
  competencia: string;
  pregunta: string;
  opciones: Opcion[];
  correcta: string;
};
type Balotario = { balotario: number; preguntas: Pregunta[] };

const BALOTARIOS = (raw as { balotarios: Balotario[] }).balotarios;

export function BalotariosOece() {
  const [activo, setActivo] = useState(1);
  const [estudio, setEstudio] = useState(false);
  // Respuesta marcada por el usuario en modo estudio, por balotario+pregunta.
  const [marcadas, setMarcadas] = useState<Record<string, string>>({});

  const balotario = BALOTARIOS.find((b) => b.balotario === activo) ?? BALOTARIOS[0];

  const resueltas = useMemo(
    () =>
      balotario.preguntas.filter(
        (q) => marcadas[`${activo}-${q.n}`] != null,
      ).length,
    [balotario, marcadas, activo],
  );
  const aciertos = useMemo(
    () =>
      balotario.preguntas.filter(
        (q) => marcadas[`${activo}-${q.n}`] === q.correcta,
      ).length,
    [balotario, marcadas, activo],
  );

  function alternarEstudio() {
    setEstudio((v) => !v);
    setMarcadas({});
  }

  return (
    <div className="tw min-w-0">
      <header className="mb-4">
        <h2 className="m-0 text-xl font-bold text-ink">Balotarios OECE</h2>
        <p className="mt-1 text-sm text-muted">
          Cinco balotarios con sus preguntas y la respuesta correcta. Material de
          repaso (Ley 32069 y su Reglamento); no sustituye al banco revisado del
          simulacro oficial.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b border-line pb-3">
        {BALOTARIOS.map((b) => (
          <button
            key={b.balotario}
            type="button"
            onClick={() => setActivo(b.balotario)}
            aria-pressed={activo === b.balotario}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${
              activo === b.balotario
                ? "border-brand bg-brand text-on-brand"
                : "border-line bg-panel text-ink hover:border-brand hover:text-brand"
            }`}
          >
            Balotario {b.balotario}
          </button>
        ))}
        <button
          type="button"
          onClick={alternarEstudio}
          aria-pressed={estudio}
          className="ml-auto rounded-lg border border-line bg-panel px-3 py-1.5 text-sm font-semibold text-ink transition-colors hover:border-brand hover:text-brand"
        >
          {estudio ? "Ver respuestas" : "Modo estudio"}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-muted">
        <span>
          <b className="text-ink">{balotario.preguntas.length}</b> preguntas
        </span>
        {estudio ? (
          <span>
            Resueltas: <b className="text-ink">{resueltas}</b> ·{" "}
            <b className="text-ink">{aciertos}</b> aciertos
          </span>
        ) : (
          <span>Respuestas correctas resaltadas en verde</span>
        )}
      </div>

      <ol className="mt-4 space-y-4">
        {balotario.preguntas.map((q) => {
          const clave = `${activo}-${q.n}`;
          const marcada = marcadas[clave];
          return (
            <li
              key={q.n}
              className="rounded-xl border border-line bg-panel p-4 shadow-sm"
            >
              <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
                {q.competencia ? (
                  <span className="rounded-full bg-brand-soft px-2 py-0.5 text-brand-dark">
                    {q.competencia}
                  </span>
                ) : null}
                <span>
                  Pregunta {q.n} de {balotario.preguntas.length}
                </span>
              </div>
              <p className="m-0 mb-3 font-semibold leading-snug text-ink">
                {q.pregunta}
              </p>
              <ul className="space-y-2">
                {q.opciones.map((o) => {
                  const esCorrecta = o.letra === q.correcta;
                  // En modo estudio solo se revela tras marcar; fuera de él, siempre.
                  const revelar = !estudio || marcada != null;
                  const marcadaEsta = marcada === o.letra;
                  const clases = [
                    "flex items-start gap-3 rounded-lg border px-3 py-2 text-left text-sm",
                    estudio && marcada == null
                      ? "cursor-pointer border-line hover:border-brand"
                      : "border-line",
                    revelar && esCorrecta
                      ? "border-success/60 bg-success/10 text-ink"
                      : "",
                    revelar && marcadaEsta && !esCorrecta
                      ? "border-danger/60 bg-danger/10 text-ink"
                      : "",
                  ].join(" ");
                  const letraClases = [
                    "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-extrabold",
                    revelar && esCorrecta
                      ? "bg-success text-white"
                      : revelar && marcadaEsta && !esCorrecta
                        ? "bg-danger text-white"
                        : "bg-soft text-muted",
                  ].join(" ");
                  const contenido = (
                    <>
                      <span className={letraClases}>{o.letra}</span>
                      <span>{o.texto}</span>
                      {revelar && esCorrecta ? (
                        <span className="ml-auto whitespace-nowrap text-xs font-bold text-success">
                          ✓ Correcta
                        </span>
                      ) : null}
                    </>
                  );
                  if (estudio && marcada == null) {
                    return (
                      <li key={o.letra}>
                        <button
                          type="button"
                          className={`${clases} w-full`}
                          onClick={() =>
                            setMarcadas((m) => ({ ...m, [clave]: o.letra }))
                          }
                        >
                          {contenido}
                        </button>
                      </li>
                    );
                  }
                  return (
                    <li key={o.letra} className={clases}>
                      {contenido}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-[13px] font-semibold text-success">
                {revelarClave(estudio, marcada)
                  ? `Respuesta correcta: ${q.correcta}`
                  : " "}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function revelarClave(estudio: boolean, marcada: string | undefined): boolean {
  return !estudio || marcada != null;
}
