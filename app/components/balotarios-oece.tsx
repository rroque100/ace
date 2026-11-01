"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Award,
  BarChart3,
  BookOpenCheck,
  ChevronDown,
  Clock,
  Eye,
  EyeOff,
  FileText,
  History,
  Play,
  RotateCcw,
  Shuffle,
  Trophy,
} from "lucide-react";
import raw from "./balotarios/balotarios-oece.json";

// Cuestionario de los 5 balotarios OECE importados de LEX. Vive aparte del banco
// gobernado (exam_questions): material de práctica y examen cronometrado con su
// clave de respuestas y un historial local (por navegador), no preguntas
// publicables para el simulacro oficial.

type Opcion = { letra: string; texto: string };
type Pregunta = { n: number; competencia: string; pregunta: string; opciones: Opcion[]; correcta: string };
type Balotario = { balotario: number; preguntas: Pregunta[] };
type Intento = {
  balotario: number;
  fecha: string;
  puntaje: number;
  total: number;
  respuestas: Record<number, string>;
  orden: number[];
  segundos?: number; // tiempo empleado en el examen
};

const BALOTARIOS = (raw as { balotarios: Balotario[] }).balotarios;
const TOTAL_PREGUNTAS = BALOTARIOS.reduce((s, b) => s + b.preguntas.length, 0);
const HIST_KEY = "ace:balotarios:historial";
const DURACION = 120 * 60; // 2 horas, como el simulacro OECE

const NIVELES = [
  { label: "Desaprobado", max: 29, pill: "bg-danger/15 text-danger", barra: "bg-danger" },
  { label: "Básico", max: 42, pill: "bg-warning/15 text-warning", barra: "bg-warning" },
  { label: "Intermedio", max: 57, pill: "bg-brand-soft text-brand-dark", barra: "bg-brand" },
  { label: "Avanzado", max: 72, pill: "bg-success/15 text-success", barra: "bg-success" },
] as const;

function nivelDe(p: number) {
  return NIVELES.find((n) => p <= n.max) ?? NIVELES[NIVELES.length - 1];
}
function barajar(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function fmtFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso.slice(0, 10);
  }
}
function claveMes(iso: string): string {
  const d = new Date(iso); // mes en hora local (coincide con fmtFecha)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function etiquetaMes(clave: string): string {
  const [y, m] = clave.split("-").map(Number);
  const s = new Date(y, m - 1, 1).toLocaleDateString("es-PE", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function fmtTiempo(seg: number): string {
  const s = Math.max(0, seg);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return [h, m, r].map((x) => String(x).padStart(2, "0")).join(":");
}

export function BalotariosOece() {
  const [vista, setVista] = useState<"inicio" | "practicar" | "examen" | "historial">("inicio");
  const [historial, setHistorial] = useState<Intento[]>([]);
  const [revisando, setRevisando] = useState<Intento | null>(null);

  useEffect(() => {
    try {
      const r = localStorage.getItem(HIST_KEY);
      // Lectura post-montaje de localStorage (evita mismatch de hidratación SSR).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (r) setHistorial(JSON.parse(r) as Intento[]);
    } catch {
      /* localStorage no disponible */
    }
  }, []);
  function persistir(next: Intento[]) {
    setHistorial(next);
    try {
      localStorage.setItem(HIST_KEY, JSON.stringify(next));
    } catch {
      /* se mantiene en memoria */
    }
  }
  const mejor = useMemo(
    () => (historial.length ? historial.reduce((m, it) => (it.puntaje > m.puntaje ? it : m)) : null),
    [historial],
  );

  if (revisando) {
    return (
      <div className="tw min-w-0">
        <RevisionIntento intento={revisando} onVolver={() => setRevisando(null)} />
      </div>
    );
  }

  return (
    <div className="tw min-w-0">
      <SubNav vista={vista} intentos={historial.length} onIr={setVista} />
      {vista === "inicio" ? (
        <Inicio
          mejor={mejor}
          onExamen={() => setVista("examen")}
          onPracticar={() => setVista("practicar")}
          onHistorial={() => setVista("historial")}
        />
      ) : vista === "practicar" ? (
        <Practicar />
      ) : vista === "examen" ? (
        <Examen
          onGuardar={(it) => persistir([it, ...historial])}
          onHistorial={() => setVista("historial")}
        />
      ) : (
        <HistorialVista
          historial={historial}
          onInicio={() => setVista("inicio")}
          onVerResultado={setRevisando}
          onLimpiar={() => persistir([])}
        />
      )}
    </div>
  );
}

/* ---------- Navegación ---------- */

function SubNav({
  vista,
  intentos,
  onIr,
}: {
  vista: string;
  intentos: number;
  onIr: (v: "inicio" | "practicar" | "examen" | "historial") => void;
}) {
  const items = [
    { id: "inicio" as const, label: "Inicio", icon: Award },
    { id: "practicar" as const, label: "Practicar", icon: BookOpenCheck },
    { id: "examen" as const, label: "Examen", icon: Clock },
    { id: "historial" as const, label: `Historial${intentos ? ` · ${intentos}` : ""}`, icon: History },
  ];
  return (
    <div role="tablist" aria-label="Secciones de balotarios" className="mb-5 inline-flex flex-wrap gap-1 rounded-xl border border-line bg-soft/60 p-1">
      {items.map(({ id, label, icon: Icon }) => {
        const on = vista === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onIr(id)}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
              on ? "bg-panel text-brand-dark shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            <Icon size={16} aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Inicio ---------- */

function Inicio({
  mejor,
  onExamen,
  onPracticar,
  onHistorial,
}: {
  mejor: Intento | null;
  onExamen: () => void;
  onPracticar: () => void;
  onHistorial: () => void;
}) {
  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#0e716b,#09564f)] p-6 text-white sm:p-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/70">Certificación OECE</p>
        <h2 className="mt-2 max-w-xl text-2xl font-bold leading-tight sm:text-[28px]">
          Prepárate con los balotarios y mide tu nivel
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/80">
          Cinco balotarios (Ley 32069 y su Reglamento). Repasa con la clave a la vista o rinde un
          examen cronometrado como el oficial y sigue tu avance.
        </p>
        <dl className="mt-5 flex flex-wrap gap-6 text-white">
          <Dato valor={String(BALOTARIOS.length)} etiqueta="Balotarios" />
          <Dato valor={String(TOTAL_PREGUNTAS)} etiqueta="Preguntas" />
          <Dato valor="120 min" etiqueta="Por examen" />
        </dl>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <AccionCard
          icon={Clock}
          titulo="Rendir examen"
          desc="Simulacro cronometrado: 72 preguntas, 120 minutos y corrección al finalizar. La clave no se revela hasta entregar."
          cta="Comenzar examen"
          onClick={onExamen}
          primario
        />
        <AccionCard
          icon={BookOpenCheck}
          titulo="Practicar"
          desc="Repaso sin tiempo: marca una opción para comprobarla al instante o muestra la clave completa."
          cta="Practicar"
          onClick={onPracticar}
        />
      </div>

      <section className="rounded-2xl border border-line bg-panel p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Trophy size={16} className="text-brand" aria-hidden />
            {mejor ? `Tu mejor resultado · Balotario ${mejor.balotario}` : "Historial de exámenes"}
          </div>
          <button type="button" onClick={onHistorial} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:text-brand-dark">
            <History size={15} aria-hidden /> Ver historial
          </button>
        </div>
        {mejor ? (
          <NivelMeter puntaje={mejor.puntaje} total={mejor.total} />
        ) : (
          <p className="text-sm text-muted">Aún no has rendido exámenes. Cuando termines uno, tu puntaje y nivel aparecerán aquí.</p>
        )}
      </section>
    </div>
  );
}

function Dato({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  return (
    <div>
      <dd className="text-2xl font-bold leading-none">{valor}</dd>
      <dt className="mt-1 text-[11px] font-medium uppercase tracking-wide text-white/60">{etiqueta}</dt>
    </div>
  );
}

function AccionCard({
  icon: Icon,
  titulo,
  desc,
  cta,
  onClick,
  primario,
}: {
  icon: typeof Clock;
  titulo: string;
  desc: string;
  cta: string;
  onClick: () => void;
  primario?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col rounded-2xl border border-line bg-panel p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand hover:shadow-md focus-visible:outline-2 focus-visible:outline-brand motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand-dark transition-colors group-hover:bg-brand group-hover:text-on-brand">
        <Icon size={20} aria-hidden />
      </span>
      <strong className="mt-4 text-lg font-bold text-ink">{titulo}</strong>
      <span className="mt-1 flex-1 text-sm leading-relaxed text-muted">{desc}</span>
      <span
        className={`mt-4 inline-flex w-fit items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold ${
          primario ? "bg-brand text-on-brand group-hover:bg-brand-dark" : "border border-line text-ink group-hover:border-brand group-hover:text-brand"
        }`}
      >
        {cta}
      </span>
    </button>
  );
}

/* ---------- Medidor de nivel ---------- */

function NivelMeter({ puntaje, total }: { puntaje: number; total: number }) {
  const nivel = nivelDe(puntaje);
  const pct = Math.max(0, Math.min(100, (puntaje / total) * 100));
  const cortes = [0, 29, 42, 57, total];
  const anchos = NIVELES.map((_, i) => ((cortes[i + 1] - cortes[i]) / total) * 100);
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold leading-none text-ink">{puntaje}</span>
          <span className="text-sm text-muted">/ {total} correctas</span>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${nivel.pill}`}>{nivel.label}</span>
      </div>
      <div className="relative mt-3">
        <div className="flex h-2.5 w-full overflow-hidden rounded-full">
          {NIVELES.map((n, i) => (
            <div key={n.label} className={`${n.barra} opacity-25`} style={{ width: `${anchos[i]}%` }} />
          ))}
        </div>
        <div className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-panel bg-ink shadow" style={{ left: `${pct}%` }} aria-hidden />
      </div>
      <div className="mt-2 flex justify-between text-[10px] font-medium uppercase tracking-wide text-muted">
        {NIVELES.map((n) => (
          <span key={n.label} className={n.label === nivel.label ? "text-ink" : undefined}>
            {n.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- Pregunta ---------- */

function PreguntaItem({
  q,
  pos,
  total,
  marcada,
  revelar,
  clickable,
  onMarcar,
}: {
  q: Pregunta;
  pos: number;
  total: number;
  marcada: string | undefined;
  revelar: boolean;
  clickable: boolean;
  onMarcar: (letra: string) => void;
}) {
  return (
    <li className="rounded-2xl border border-line bg-panel p-4 shadow-sm sm:p-5">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
        <span className="rounded-md bg-soft px-2 py-0.5 text-ink">{pos}</span>
        {q.competencia ? <span className="rounded-full bg-brand-soft px-2 py-0.5 text-brand-dark">{q.competencia}</span> : null}
        <span className="ml-auto normal-case text-muted">Pregunta {pos} de {total}</span>
      </div>
      <p className="m-0 mb-3 font-semibold leading-snug text-ink">{q.pregunta}</p>
      <ul className="space-y-2">
        {q.opciones.map((o) => {
          const esCorrecta = o.letra === q.correcta;
          const marcadaEsta = marcada === o.letra;
          const estado =
            revelar && esCorrecta
              ? "border-success/60 bg-success/10"
              : revelar && marcadaEsta && !esCorrecta
                ? "border-danger/60 bg-danger/10"
                : marcadaEsta
                  ? "border-brand bg-brand-soft"
                  : "border-line";
          const circulo =
            revelar && esCorrecta
              ? "bg-success text-white"
              : revelar && marcadaEsta && !esCorrecta
                ? "bg-danger text-white"
                : marcadaEsta
                  ? "bg-brand text-on-brand"
                  : "bg-soft text-muted";
          const cuerpo = (
            <>
              <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-extrabold ${circulo}`}>{o.letra}</span>
              <span className="text-ink">{o.texto}</span>
              {revelar && esCorrecta ? <span className="ml-auto whitespace-nowrap text-xs font-bold text-success">✓ Correcta</span> : null}
            </>
          );
          const base = `flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${estado}`;
          if (clickable) {
            return (
              <li key={o.letra}>
                <button type="button" aria-pressed={marcadaEsta} onClick={() => onMarcar(o.letra)} className={`${base} hover:border-brand`}>
                  {cuerpo}
                </button>
              </li>
            );
          }
          return (
            <li key={o.letra} className={base}>
              {cuerpo}
            </li>
          );
        })}
      </ul>
      {revelar ? <p className="mt-2.5 text-[13px] font-semibold text-success">Respuesta correcta: {q.correcta}</p> : null}
    </li>
  );
}

/* ---------- Practicar (repaso, sin tiempo ni puntaje) ---------- */

function Practicar() {
  const [activo, setActivo] = useState(1);
  const [verTodo, setVerTodo] = useState(false);
  const [marcadas, setMarcadas] = useState<Record<string, string>>({});
  const [orden, setOrden] = useState<number[]>([]);
  const balotario = BALOTARIOS.find((b) => b.balotario === activo) ?? BALOTARIOS[0];
  const total = balotario.preguntas.length;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrden(barajar(total));
  }, [activo, total]);
  const secuencia = orden.length === total ? orden : balotario.preguntas.map((_, i) => i);

  return (
    <>
      <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-panel/85 p-3 shadow-sm backdrop-blur">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Elegir balotario">
          {BALOTARIOS.map((b) => (
            <button
              key={b.balotario}
              type="button"
              onClick={() => {
                setActivo(b.balotario);
                setMarcadas({});
                setVerTodo(false);
              }}
              aria-pressed={activo === b.balotario}
              className={`size-9 rounded-lg text-sm font-bold transition-colors ${activo === b.balotario ? "bg-brand text-on-brand" : "bg-soft text-muted hover:text-ink"}`}
            >
              {b.balotario}
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" onClick={() => setOrden(barajar(total))} title="Mezclar preguntas" className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink hover:border-brand hover:text-brand">
            <Shuffle size={16} aria-hidden /> Mezclar
          </button>
          <button
            type="button"
            onClick={() => setVerTodo((v) => !v)}
            aria-pressed={verTodo}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${verTodo ? "border-brand bg-brand-soft text-brand-dark" : "border-line text-ink hover:border-brand hover:text-brand"}`}
          >
            {verTodo ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
            {verTodo ? "Ocultar respuestas" : "Ver respuestas"}
          </button>
        </div>
      </div>
      <p className="mt-3 text-[13px] text-muted">
        {verTodo ? "Respuestas correctas resaltadas en verde." : "Marca una opción para comprobarla al instante, o usa «Ver respuestas»."}
      </p>
      <ol className="mt-4 list-none space-y-4 p-0">
        {secuencia.map((idx, pos) => {
          const q = balotario.preguntas[idx];
          const marcada = marcadas[`${activo}-${q.n}`];
          const revelar = verTodo || marcada != null;
          return (
            <PreguntaItem
              key={q.n}
              q={q}
              pos={pos + 1}
              total={total}
              marcada={marcada}
              revelar={revelar}
              clickable={!verTodo && marcada == null}
              onMarcar={(letra) => setMarcadas((m) => ({ ...m, [`${activo}-${q.n}`]: letra }))}
            />
          );
        })}
      </ol>
    </>
  );
}

/* ---------- Examen (cronometrado) ---------- */

function Examen({ onGuardar, onHistorial }: { onGuardar: (it: Intento) => void; onHistorial: () => void }) {
  const [estado, setEstado] = useState<"idle" | "curso" | "hecho">("idle");
  const [bal, setBal] = useState(1);
  const [orden, setOrden] = useState<number[]>([]);
  const [marcadas, setMarcadas] = useState<Record<number, string>>({});
  const [restante, setRestante] = useState(DURACION);
  const guardadoRef = useRef(false);
  const balotario = BALOTARIOS.find((b) => b.balotario === bal) ?? BALOTARIOS[0];
  const total = balotario.preguntas.length;

  const respondidas = Object.keys(marcadas).length;
  const aciertos = balotario.preguntas.filter((q) => marcadas[q.n] === q.correcta).length;

  function comenzar() {
    setOrden(barajar(total));
    setMarcadas({});
    setRestante(DURACION);
    guardadoRef.current = false;
    setEstado("curso");
  }
  function finalizar() {
    if (guardadoRef.current) return;
    guardadoRef.current = true;
    onGuardar({
      balotario: bal,
      fecha: new Date().toISOString(),
      puntaje: aciertos,
      total,
      respuestas: { ...marcadas },
      orden,
      segundos: DURACION - restante,
    });
    setEstado("hecho");
  }

  // Cronómetro: tictac cada segundo; al llegar a 0, finaliza automáticamente.
  useEffect(() => {
    if (estado !== "curso") return;
    if (restante <= 0) {
      finalizar();
      return;
    }
    const id = setTimeout(() => setRestante((r) => r - 1), 1000);
    return () => clearTimeout(id);
    // finalizar/aciertos se leen del render actual; el efecto re-corre cada segundo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, restante]);

  if (estado === "idle") {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-line bg-panel p-6 text-center shadow-sm sm:p-8">
        <span className="mx-auto grid size-12 place-items-center rounded-xl bg-brand-soft text-brand-dark">
          <Clock size={24} aria-hidden />
        </span>
        <h2 className="mt-4 text-xl font-bold text-ink">Rendir examen</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
          72 preguntas y 120 minutos. El cronómetro corre hasta que finalices o se acabe el tiempo;
          la clave no se revela hasta terminar. Elige el balotario:
        </p>
        <div className="mt-4 flex justify-center gap-1.5">
          {BALOTARIOS.map((b) => (
            <button
              key={b.balotario}
              type="button"
              onClick={() => setBal(b.balotario)}
              aria-pressed={bal === b.balotario}
              className={`size-10 rounded-lg text-sm font-bold transition-colors ${bal === b.balotario ? "bg-brand text-on-brand" : "bg-soft text-muted hover:text-ink"}`}
            >
              {b.balotario}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={comenzar}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-bold text-on-brand transition-colors hover:bg-brand-dark"
        >
          <Play size={16} aria-hidden />
          Comenzar Balotario {bal}
        </button>
      </div>
    );
  }

  if (estado === "hecho") {
    const seq = orden.length === total ? orden : balotario.preguntas.map((_, i) => i);
    return (
      <div>
        <section className="mb-4 rounded-2xl border border-line bg-panel p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-ink">
            <Award size={16} className="text-brand" aria-hidden />
            Resultado del examen · Balotario {bal}
            <span className="font-normal text-muted">· tiempo {fmtTiempo(DURACION - restante)}</span>
          </div>
          <NivelMeter puntaje={aciertos} total={total} />
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => setEstado("idle")} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-on-brand hover:bg-brand-dark">
              <RotateCcw size={15} aria-hidden /> Nuevo examen
            </button>
            <button type="button" onClick={onHistorial} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink hover:border-brand hover:text-brand">
              <History size={15} aria-hidden /> Ver historial
            </button>
          </div>
        </section>
        <p className="mb-3 text-[13px] font-semibold text-muted">Resolución del examen</p>
        <ol className="list-none space-y-4 p-0">
          {seq.map((idx, pos) => {
            const q = balotario.preguntas[idx];
            return <PreguntaItem key={q.n} q={q} pos={pos + 1} total={total} marcada={marcadas[q.n]} revelar clickable={false} onMarcar={() => {}} />;
          })}
        </ol>
      </div>
    );
  }

  // estado === "curso"
  const seq = orden.length === total ? orden : balotario.preguntas.map((_, i) => i);
  const progreso = Math.round((respondidas / total) * 100);
  const apremio = restante <= 300; // últimos 5 min
  return (
    <>
      <div className="sticky top-2 z-10 rounded-2xl border border-line bg-panel/90 p-3 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-bold text-ink">Balotario {bal}</span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-sm font-bold tabular-nums ${apremio ? "bg-danger/15 text-danger" : "bg-soft text-ink"}`}
            role="timer"
            aria-label="Tiempo restante"
          >
            <Clock size={15} aria-hidden />
            {fmtTiempo(restante)}
          </span>
          <span className="text-xs font-medium text-muted">{respondidas}/{total} respondidas</span>
          <button
            type="button"
            onClick={finalizar}
            className="ml-auto rounded-lg bg-brand px-4 py-2 text-sm font-bold text-on-brand hover:bg-brand-dark"
          >
            Finalizar examen
          </button>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-soft">
          <div className="h-full rounded-full bg-brand transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${progreso}%` }} />
        </div>
      </div>
      <p className="mt-3 text-[13px] text-muted">Marca una respuesta por pregunta. La clave se revela al finalizar.</p>
      <ol className="mt-4 list-none space-y-4 p-0">
        {seq.map((idx, pos) => {
          const q = balotario.preguntas[idx];
          return (
            <PreguntaItem
              key={q.n}
              q={q}
              pos={pos + 1}
              total={total}
              marcada={marcadas[q.n]}
              revelar={false}
              clickable
              onMarcar={(letra) => setMarcadas((m) => ({ ...m, [q.n]: letra }))}
            />
          );
        })}
      </ol>
    </>
  );
}

/* ---------- Revisión de un intento ---------- */

function RevisionIntento({ intento, onVolver }: { intento: Intento; onVolver: () => void }) {
  const balotario = BALOTARIOS.find((b) => b.balotario === intento.balotario) ?? BALOTARIOS[0];
  const seq = intento.orden?.length === balotario.preguntas.length ? intento.orden : balotario.preguntas.map((_, i) => i);
  return (
    <div>
      <button type="button" onClick={onVolver} className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-brand">
        <ChevronDown size={16} className="rotate-90" aria-hidden /> Volver al historial
      </button>
      <section className="mb-4 rounded-2xl border border-line bg-panel p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-ink">
          <FileText size={16} className="text-brand" aria-hidden />
          Resultado · Balotario {intento.balotario} · {fmtFecha(intento.fecha)}
          {intento.segundos != null ? <span className="font-normal text-muted">· tiempo {fmtTiempo(intento.segundos)}</span> : null}
        </div>
        <NivelMeter puntaje={intento.puntaje} total={intento.total} />
      </section>
      <ol className="list-none space-y-4 p-0">
        {seq.map((idx, pos) => {
          const q = balotario.preguntas[idx];
          return <PreguntaItem key={q.n} q={q} pos={pos + 1} total={intento.total} marcada={intento.respuestas?.[q.n]} revelar clickable={false} onMarcar={() => {}} />;
        })}
      </ol>
    </div>
  );
}

/* ---------- Historial (estilo LEX /app/quiz/record) ---------- */

function HistorialVista({
  historial,
  onInicio,
  onVerResultado,
  onLimpiar,
}: {
  historial: Intento[];
  onInicio: () => void;
  onVerResultado: (it: Intento) => void;
  onLimpiar: () => void;
}) {
  const meses = useMemo(() => {
    const set = new Set(historial.map((it) => claveMes(it.fecha)));
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [historial]);
  const [mes, setMes] = useState<string>("");
  const [balFiltro, setBalFiltro] = useState<number>(0);
  const [abiertos, setAbiertos] = useState<Record<number, boolean>>({});

  const mesActivo = mes || meses[0] || "";
  const delMes = useMemo(() => historial.filter((it) => claveMes(it.fecha) === mesActivo), [historial, mesActivo]);
  const filtrados = useMemo(() => (balFiltro ? delMes.filter((it) => it.balotario === balFiltro) : delMes), [delMes, balFiltro]);
  const porBalotario = useMemo(() => {
    const map = new Map<number, Intento[]>();
    for (const it of filtrados) {
      const arr = map.get(it.balotario) ?? [];
      arr.push(it);
      map.set(it.balotario, arr);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [filtrados]);

  if (historial.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-panel p-10 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-xl bg-soft text-muted">
          <History size={22} aria-hidden />
        </span>
        <p className="mx-auto mt-3 max-w-sm text-sm text-muted">
          Aún no has rendido exámenes. Ve a <b className="text-ink">Examen</b>, elige un balotario y
          finaliza: tu puntaje y nivel quedarán aquí.
        </p>
      </div>
    );
  }

  const selectCls = "rounded-lg border border-line bg-panel px-3 py-2 text-sm font-medium text-ink outline-none focus:border-brand";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="m-0 text-xl font-bold text-ink">Historial de evaluaciones</h2>
          <p className="mt-1 text-sm text-muted">Revisa los exámenes que rendiste.</p>
        </div>
        <button type="button" onClick={onInicio} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-panel px-3 py-2 text-sm font-semibold text-ink hover:border-brand hover:text-brand">
          <BarChart3 size={16} aria-hidden /> Ver mi progreso
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select className={selectCls} value={mesActivo} onChange={(e) => setMes(e.target.value)} aria-label="Mes">
          {meses.map((m) => (
            <option key={m} value={m}>
              {etiquetaMes(m)}
            </option>
          ))}
        </select>
        <select className={selectCls} value={balFiltro} onChange={(e) => setBalFiltro(Number(e.target.value))} aria-label="Balotario">
          <option value={0}>Todos los balotarios</option>
          {BALOTARIOS.map((b) => (
            <option key={b.balotario} value={b.balotario}>
              Balotario {b.balotario}
            </option>
          ))}
        </select>
        <button type="button" onClick={onLimpiar} className="ml-auto rounded-lg border border-line px-3 py-2 text-sm font-medium text-muted hover:border-danger hover:text-danger">
          Limpiar historial
        </button>
      </div>

      <p className="flex items-center gap-2 rounded-xl bg-warning/10 px-4 py-3 text-sm font-semibold text-ink">
        <FileText size={16} className="text-warning" aria-hidden />
        {filtrados.length} {filtrados.length === 1 ? "evaluación rendida" : "evaluaciones rendidas"} este mes
      </p>

      {porBalotario.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-panel px-4 py-8 text-center text-sm text-muted">No hay evaluaciones en este periodo.</p>
      ) : (
        porBalotario.map(([bal, intentos]) => {
          const ordenados = [...intentos].sort((a, b) => b.fecha.localeCompare(a.fecha));
          const maxBal = ordenados.reduce((m, it) => Math.max(m, it.puntaje), 0);
          const abierto = abiertos[bal] ?? true;
          return (
            <section key={bal} className="overflow-hidden rounded-2xl border border-line bg-panel shadow-sm">
              <button type="button" onClick={() => setAbiertos((s) => ({ ...s, [bal]: !abierto }))} aria-expanded={abierto} className="flex w-full items-center gap-3 px-4 py-3.5 text-left sm:px-5">
                <h3 className="m-0 text-base font-bold text-ink">Balotario {bal}</h3>
                <span className="rounded-full bg-warning/15 px-2.5 py-0.5 text-xs font-bold text-warning">
                  {ordenados.length} {ordenados.length === 1 ? "intento" : "intentos"}
                </span>
                <ChevronDown size={18} aria-hidden className={`ml-auto text-muted transition-transform ${abierto ? "rotate-180" : ""}`} />
              </button>
              {abierto ? (
                <div className="overflow-x-auto border-t border-line">
                  <table className="w-full min-w-[520px] border-collapse text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
                        <th className="px-4 py-2.5 font-semibold sm:px-5">Fecha</th>
                        <th className="px-4 py-2.5 font-semibold">Puntaje obtenido</th>
                        <th className="px-4 py-2.5 font-semibold">Nivel</th>
                        <th className="px-4 py-2.5 font-semibold">Resultado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ordenados.map((it, i) => {
                        const nv = nivelDe(it.puntaje);
                        const esMejor = it.puntaje === maxBal && ordenados.length > 1;
                        return (
                          <tr key={i} className="border-t border-line/60">
                            <td className="px-4 py-3 text-ink sm:px-5">{fmtFecha(it.fecha)}</td>
                            <td className="px-4 py-3 font-semibold text-ink">
                              {it.puntaje} <span className="font-normal text-muted">puntos</span>
                              {esMejor ? <span className="ml-2 text-xs font-semibold text-brand">· mejor</span> : null}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${nv.pill}`}>{nv.label}</span>
                            </td>
                            <td className="px-4 py-3">
                              <button type="button" onClick={() => onVerResultado(it)} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:border-brand hover:text-brand">
                                <FileText size={13} aria-hidden /> Ver resultado
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </section>
          );
        })
      )}
    </div>
  );
}
