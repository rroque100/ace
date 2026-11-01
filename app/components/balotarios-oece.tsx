"use client";

import { useEffect, useMemo, useState } from "react";
import raw from "./balotarios/balotarios-oece.json";

// Cuestionario de estudio con los 5 balotarios OECE importados de LEX. Vive
// aparte del banco gobernado (exam_questions): aquí no hay clasificación por
// subcompetencia ni revisión editorial, es material de repaso con su clave de
// respuestas y un historial de evaluaciones local (por navegador), no preguntas
// publicables para el simulacro oficial.

type Opcion = { letra: string; texto: string };
type Pregunta = {
  n: number;
  competencia: string;
  pregunta: string;
  opciones: Opcion[];
  correcta: string;
};
type Balotario = { balotario: number; preguntas: Pregunta[] };
type Intento = { balotario: number; fecha: string; puntaje: number; total: number };

const BALOTARIOS = (raw as { balotarios: Balotario[] }).balotarios;
const HIST_KEY = "ace:balotarios:historial";

// Bandas OECE sobre 72 preguntas (mismas que usa LEX y el resultado del simulacro).
function nivelDe(puntaje: number): { label: string; clase: string } {
  if (puntaje <= 29) return { label: "Desaprobado", clase: "bg-danger/15 text-danger" };
  if (puntaje <= 42) return { label: "Básico", clase: "bg-warning/15 text-warning" };
  if (puntaje <= 57) return { label: "Intermedio", clase: "bg-brand-soft text-brand-dark" };
  return { label: "Avanzado", clase: "bg-success/15 text-success" };
}

function fmtFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

export function BalotariosOece() {
  const [vista, setVista] = useState<"practicar" | "historial">("practicar");
  const [activo, setActivo] = useState(1);
  const [evaluando, setEvaluando] = useState(false);
  const [marcadas, setMarcadas] = useState<Record<string, string>>({});
  const [finalizado, setFinalizado] = useState(false);
  const [historial, setHistorial] = useState<Intento[]>([]);

  // El historial persiste solo en este navegador (sin servidor).
  useEffect(() => {
    try {
      const r = localStorage.getItem(HIST_KEY);
      // Lectura post-montaje de localStorage (evita mismatch de hidratación SSR).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (r) setHistorial(JSON.parse(r) as Intento[]);
    } catch {
      // localStorage no disponible: el historial no persiste en esta sesión.
    }
  }, []);

  function persistir(next: Intento[]) {
    setHistorial(next);
    try {
      localStorage.setItem(HIST_KEY, JSON.stringify(next));
    } catch {
      /* se mantiene en memoria durante la sesión */
    }
  }

  const balotario = BALOTARIOS.find((b) => b.balotario === activo) ?? BALOTARIOS[0];
  const total = balotario.preguntas.length;

  const respondidas = useMemo(
    () => balotario.preguntas.filter((q) => marcadas[`${activo}-${q.n}`] != null).length,
    [balotario, marcadas, activo],
  );
  const aciertos = useMemo(
    () => balotario.preguntas.filter((q) => marcadas[`${activo}-${q.n}`] === q.correcta).length,
    [balotario, marcadas, activo],
  );

  function reiniciar() {
    setMarcadas({});
    setFinalizado(false);
  }
  function cambiarBalotario(n: number) {
    setActivo(n);
    reiniciar();
  }
  function alternarEvaluacion() {
    setEvaluando((v) => !v);
    reiniciar();
  }
  function finalizar() {
    persistir([
      { balotario: activo, fecha: new Date().toISOString(), puntaje: aciertos, total },
      ...historial,
    ]);
    setFinalizado(true);
  }

  // Agrupa el historial por balotario para la vista de historial.
  const porBalotario = useMemo(() => {
    const map = new Map<number, Intento[]>();
    for (const it of historial) {
      const arr = map.get(it.balotario) ?? [];
      arr.push(it);
      map.set(it.balotario, arr);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [historial]);

  return (
    <div className="tw min-w-0">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="m-0 text-xl font-bold text-ink">Balotarios OECE</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Cinco balotarios con sus preguntas y la respuesta correcta. Material de
            repaso (Ley 32069 y su Reglamento); no sustituye al banco revisado del
            simulacro oficial.
          </p>
        </div>
        <div role="tablist" aria-label="Vista de balotarios" className="flex gap-2">
          <SubTab activo={vista === "practicar"} onClick={() => setVista("practicar")}>
            Practicar
          </SubTab>
          <SubTab activo={vista === "historial"} onClick={() => setVista("historial")}>
            Historial{historial.length ? ` (${historial.length})` : ""}
          </SubTab>
        </div>
      </header>

      {vista === "practicar" ? (
        <>
          <div className="flex flex-wrap items-center gap-2 border-b border-line pb-3">
            {BALOTARIOS.map((b) => (
              <button
                key={b.balotario}
                type="button"
                onClick={() => cambiarBalotario(b.balotario)}
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
              onClick={alternarEvaluacion}
              aria-pressed={evaluando}
              className="ml-auto rounded-lg border border-line bg-panel px-3 py-1.5 text-sm font-semibold text-ink transition-colors hover:border-brand hover:text-brand"
            >
              {evaluando ? "Ver respuestas" : "Evaluarme"}
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-muted">
            <span>
              <b className="text-ink">{total}</b> preguntas
            </span>
            {evaluando && !finalizado ? (
              <>
                <span>
                  Respondidas: <b className="text-ink">{respondidas}</b> de {total}
                </span>
                <button
                  type="button"
                  onClick={finalizar}
                  disabled={respondidas === 0}
                  className="ml-auto rounded-lg border border-brand bg-brand px-4 py-1.5 text-sm font-semibold text-on-brand transition-opacity disabled:opacity-40"
                >
                  Finalizar evaluación
                </button>
              </>
            ) : null}
            {evaluando && finalizado ? (
              <>
                <span>
                  Puntaje: <b className="text-ink">{aciertos}</b> / {total}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${nivelDe(aciertos).clase}`}
                >
                  {nivelDe(aciertos).label}
                </span>
                <button
                  type="button"
                  onClick={reiniciar}
                  className="ml-auto rounded-lg border border-line bg-panel px-3 py-1.5 text-sm font-semibold text-ink hover:border-brand hover:text-brand"
                >
                  Reiniciar
                </button>
              </>
            ) : null}
            {!evaluando ? <span>Respuestas correctas resaltadas en verde</span> : null}
          </div>

          <ol className="mt-4 space-y-4">
            {balotario.preguntas.map((q) => {
              const clave = `${activo}-${q.n}`;
              const marcada = marcadas[clave];
              const revelar = !evaluando || finalizado;
              return (
                <li key={q.n} className="rounded-xl border border-line bg-panel p-4 shadow-sm">
                  <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
                    {q.competencia ? (
                      <span className="rounded-full bg-brand-soft px-2 py-0.5 text-brand-dark">
                        {q.competencia}
                      </span>
                    ) : null}
                    <span>
                      Pregunta {q.n} de {total}
                    </span>
                  </div>
                  <p className="m-0 mb-3 font-semibold leading-snug text-ink">{q.pregunta}</p>
                  <ul className="space-y-2">
                    {q.opciones.map((o) => {
                      const esCorrecta = o.letra === q.correcta;
                      const marcadaEsta = marcada === o.letra;
                      const clases = [
                        "flex items-start gap-3 rounded-lg border px-3 py-2 text-left text-sm w-full",
                        revelar && esCorrecta
                          ? "border-success/60 bg-success/10 text-ink"
                          : revelar && marcadaEsta && !esCorrecta
                            ? "border-danger/60 bg-danger/10 text-ink"
                            : marcadaEsta
                              ? "border-brand bg-brand-soft text-ink"
                              : "border-line text-ink",
                      ].join(" ");
                      const letraClases = [
                        "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-extrabold",
                        revelar && esCorrecta
                          ? "bg-success text-white"
                          : revelar && marcadaEsta && !esCorrecta
                            ? "bg-danger text-white"
                            : marcadaEsta
                              ? "bg-brand text-on-brand"
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
                      if (evaluando && !finalizado) {
                        return (
                          <li key={o.letra}>
                            <button
                              type="button"
                              className={`${clases} ${marcadaEsta ? "" : "hover:border-brand"}`}
                              aria-pressed={marcadaEsta}
                              onClick={() => setMarcadas((m) => ({ ...m, [clave]: o.letra }))}
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
                  {revelar ? (
                    <p className="mt-2 text-[13px] font-semibold text-success">
                      Respuesta correcta: {q.correcta}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </>
      ) : (
        <Historial
          porBalotario={porBalotario}
          totalIntentos={historial.length}
          onLimpiar={() => persistir([])}
        />
      )}
    </div>
  );
}

function Historial({
  porBalotario,
  totalIntentos,
  onLimpiar,
}: {
  porBalotario: [number, Intento[]][];
  totalIntentos: number;
  onLimpiar: () => void;
}) {
  if (totalIntentos === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-panel p-8 text-center text-sm text-muted">
        Aún no has rendido ninguna evaluación. Ve a <b className="text-ink">Practicar</b>,
        pulsa <b className="text-ink">Evaluarme</b>, responde y{" "}
        <b className="text-ink">Finaliza la evaluación</b>: tu puntaje quedará aquí.
      </div>
    );
  }
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-brand-dark">
          {totalIntentos} {totalIntentos === 1 ? "evaluación rendida" : "evaluaciones rendidas"}
        </p>
        <button
          type="button"
          onClick={onLimpiar}
          className="rounded-lg border border-line bg-panel px-3 py-1.5 text-sm font-medium text-muted hover:border-danger hover:text-danger"
        >
          Limpiar historial
        </button>
      </div>
      <div className="space-y-5">
        {porBalotario.map(([bal, intentos]) => {
          const ordenados = [...intentos].sort((a, b) => b.fecha.localeCompare(a.fecha));
          return (
            <section key={bal} className="rounded-xl border border-line bg-panel p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-3">
                <h3 className="m-0 text-base font-bold text-ink">Balotario {bal}</h3>
                <span className="rounded-full bg-soft px-2.5 py-0.5 text-xs font-semibold text-muted">
                  {ordenados.length} {ordenados.length === 1 ? "intento" : "intentos"}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[460px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-muted">
                      <th className="py-2 pr-3 font-semibold">Fecha</th>
                      <th className="py-2 pr-3 font-semibold">Puntaje</th>
                      <th className="py-2 font-semibold">Nivel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordenados.map((it, i) => {
                      const nv = nivelDe(it.puntaje);
                      return (
                        <tr key={i} className="border-b border-line/60 last:border-0">
                          <td className="py-2.5 pr-3 text-ink">{fmtFecha(it.fecha)}</td>
                          <td className="py-2.5 pr-3 font-semibold text-ink">
                            {it.puntaje} <span className="font-normal text-muted">/ {it.total}</span>
                          </td>
                          <td className="py-2.5">
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${nv.clase}`}>
                              {nv.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function SubTab({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={activo}
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors ${
        activo
          ? "border-brand bg-brand-soft text-brand-dark"
          : "border-line bg-panel text-muted hover:border-brand hover:text-brand"
      }`}
    >
      {children}
    </button>
  );
}
