"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  CircleDot,
  ListChecks,
  MinusCircle,
  UploadCloud,
  UserRound,
  Users,
} from "lucide-react";
import {
  type EstadoFase,
  type FaseEvaluada,
  type InstruccionExpediente,
} from "@/lib/expediente-instruccion";
import {
  ACTORES,
  MACRO_FASES,
  type MacroFase,
  actorLabel,
  actorSigla,
  macroFaseLabel,
} from "@/lib/actores-contratacion";
import { processDocKindLabel } from "@/lib/legal-taxonomy";
import { cn } from "@/lib/utils";

const ESTADO_LABEL: Record<EstadoFase, string> = {
  completa: "Completa",
  en_curso: "En curso",
  pendiente: "Pendiente",
  atencion: "Requiere atención",
  no_aplica: "No aplica",
};

// Color del semáforo por estado, como clases sueltas y COMPLETAS (borde+fondo+
// texto en cada estado, incluido el por defecto). Dos motivos:
//   1. NO se usan variantes `data-[estado=…]`: Tailwind convierte el `_` de
//      "en_curso"/"no_aplica" en un espacio y el selector deja de casar.
//   2. El color NO va en el base: una utilidad de override (`bg-[#f1faf4]`) tiene
//      la MISMA especificidad que la del base (`bg-panel`) y el orden de Tailwind
//      hace ganar al base. Con el color solo aquí, no hay conflicto.
// Marcador y chip solo difieren en el fondo por defecto (panel vs surface).
const NUM_ESTADO: Record<EstadoFase, string> = {
  pendiente: "border-line bg-panel text-muted",
  completa: "border-[#b8d9c7] bg-[#f1faf4] text-[#166534]",
  en_curso: "border-brand bg-brand-soft text-brand",
  atencion: "border-[#efb9b3] bg-[#fff3f1] text-[#b45309]",
  no_aplica: "border-line bg-surface text-muted opacity-75",
};
const CHIP_ESTADO: Record<EstadoFase, string> = {
  pendiente: "border-line bg-surface text-muted",
  completa: "border-[#b8d9c7] bg-[#f1faf4] text-[#166534]",
  en_curso: "border-brand bg-brand-soft text-brand",
  atencion: "border-[#efb9b3] bg-[#fff3f1] text-[#b45309]",
  no_aplica: "border-line bg-surface text-muted opacity-75",
};

function PhaseIcon({ estado }: { estado: EstadoFase }) {
  if (estado === "completa") {
    return <CheckCircle2 size={18} />;
  }
  if (estado === "en_curso") {
    return <CircleDot size={18} />;
  }
  if (estado === "atencion") {
    return <AlertTriangle size={18} />;
  }
  if (estado === "no_aplica") {
    return <MinusCircle size={18} />;
  }
  return <Circle size={18} />;
}

function PhaseCard({
  canManage,
  fase,
  onSelectKind,
}: {
  canManage: boolean;
  fase: FaseEvaluada;
  onSelectKind?: (kind: string) => void;
}) {
  return (
    <li className="group/fase flex gap-[14px]" data-estado={fase.estado}>
      <div className="flex flex-col items-center">
        <span
          className={cn(
            "flex size-[34px] shrink-0 items-center justify-center rounded-full border-2",
            NUM_ESTADO[fase.estado],
          )}
        >
          <PhaseIcon estado={fase.estado} />
        </span>
        <span className="my-1 min-h-[14px] w-0.5 flex-1 bg-line group-last/fase:hidden" aria-hidden />
      </div>

      <div className={cn("grid min-w-0 flex-1 content-start gap-2 pb-[18px]", fase.estado === "no_aplica" && "opacity-60")}>
        <div className="flex items-start justify-between gap-2.5">
          <div className="grid gap-px [&>strong]:text-[14.5px] [&>strong]:text-ink">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-muted">Fase {fase.numero}</span>
            <strong>{fase.label}</strong>
            {/* El módulo lo enseñaba el mapa del ciclo, que era un segundo riel
                de estas mismas once etapas. Al fusionarlos viene aquí. */}
            <span
              className="ml-1.5 rounded-[4px] border border-line bg-brand-soft px-[5px] text-[9.5px] font-bold text-muted"
              title={`Módulo ${fase.modulo} del ciclo`}
            >
              M{fase.modulo}
            </span>
          </div>
          <span
            className={cn(
              "shrink-0 whitespace-nowrap rounded-full border px-[9px] py-1 text-[11px] font-extrabold",
              CHIP_ESTADO[fase.estado],
            )}
          >
            {ESTADO_LABEL[fase.estado]}
          </span>
        </div>

        <p className="m-0 text-[12.5px] leading-normal text-muted">{fase.descripcion}</p>

        <div className="flex flex-wrap gap-2">
          <span
            className="inline-flex items-center gap-[5px] rounded-full bg-brand-soft px-[9px] py-[3px] text-[11.5px] font-bold text-brand"
            title={actorLabel(fase.responsable)}
          >
            <UserRound size={13} />
            {actorLabel(fase.responsable)}
          </span>
          {fase.participantes.length > 0 ? (
            <span className="inline-flex items-center gap-[5px] rounded-full border border-line px-[9px] py-[3px] text-[11.5px] font-semibold text-muted">
              <Users size={13} />
              {fase.participantes.map((id) => actorSigla(id)).join(" · ")}
            </span>
          ) : null}
        </div>

        {/* Insumos y artefactos SOLO en la etapa actual: son la respuesta a "y
            ahora qué hago", y repetirlos en las once convertiría el panel en un
            manual. En las demás, lo que importa es qué falta. */}
        {fase.esActual && (fase.entradas.length > 0 || fase.salidas.length > 0) ? (
          <div className="mb-0.5 mt-1.5 grid grid-cols-1 gap-x-[14px] gap-y-2 rounded-[8px] border border-line bg-brand-soft px-2.5 py-2 sm:grid-cols-2">
            {fase.entradas.length > 0 ? (
              <div>
                <span className="mb-0.5 block text-[10.5px] uppercase tracking-[0.04em] text-muted">Insumos de entrada</span>
                <ul className="m-0 list-disc pl-[15px] text-[11.5px] leading-[1.45] text-ink">
                  {fase.entradas.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {fase.salidas.length > 0 ? (
              <div>
                <span className="mb-0.5 block text-[10.5px] uppercase tracking-[0.04em] text-muted">Artefactos que genera</span>
                <ul className="m-0 list-disc pl-[15px] text-[11.5px] leading-[1.45] text-ink">
                  {fase.salidas.map((sal) => (
                    <li key={sal}>{sal}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        <ul className="m-0 grid list-none gap-[5px] p-0">
          {fase.requisitos.map((req) => (
            <li
              className="grid grid-cols-[16px_1fr] items-start gap-[7px] text-[12.5px] text-ink [&>svg]:mt-0.5 [&>svg]:text-muted data-[ok=true]:[&>svg]:text-[#166534] data-[ok=false]:text-muted"
              data-ok={req.cumplido}
              key={`${fase.id}-${req.kind}-${req.label}`}
            >
              {req.cumplido ? <CheckCircle2 size={14} /> : <Circle size={14} />}
              <span>
                {req.label}
                {!req.obligatorio ? <em className="not-italic text-[11px] text-muted"> · recomendado</em> : null}
              </span>
              {req.cumplido && req.documentoTitulo ? (
                <small className="col-start-2 text-[11px] text-brand">{req.documentoTitulo}</small>
              ) : null}
            </li>
          ))}
        </ul>

        {fase.alertas.length > 0 ? (
          <p className="m-0 flex items-start gap-1.5 text-[12px] leading-[1.45] text-[#b45309] [&>svg]:mt-0.5 [&>svg]:shrink-0">
            <AlertTriangle size={13} />
            {fase.alertas.join(" ")}
          </p>
        ) : null}

        {canManage && fase.documentosFaltantes.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {fase.documentosFaltantes.map((doc) => (
              <button
                className="inline-flex items-center gap-1.5 rounded-[8px] border border-line bg-panel px-[11px] py-1.5 text-[12px] font-bold text-brand transition-[background-color,border-color] hover:border-brand hover:bg-brand-soft"
                key={`${fase.id}-up-${doc.kind}-${doc.label}`}
                onClick={() => onSelectKind?.(doc.kind)}
                type="button"
              >
                <UploadCloud size={13} />
                Cargar {processDocKindLabel(doc.kind).toLowerCase()}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </li>
  );
}

function ActorMatrix() {
  return (
    <details className="actorMatrix">
      <summary>
        <Users size={14} />
        Actores por fase (Ley N.° 32069 · D.S. 009-2025-EF)
      </summary>
      <div className="actorMatrixWrap">
        <table className="actorMatrixTable">
          <thead>
            <tr>
              <th>Actor</th>
              {MACRO_FASES.map((macro) => (
                <th key={macro.id}>{macro.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ACTORES.map((act) => (
              <tr key={act.id}>
                <th scope="row" title={act.descripcion}>
                  {act.label}
                </th>
                {MACRO_FASES.map((macro) => {
                  const value = act.participacion[macro.id as MacroFase];
                  return (
                    <td key={macro.id} data-empty={value ? undefined : "true"}>
                      {value ?? "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/** Dónde se recuerda si el detalle queda abierto. */
const CLAVE_ABIERTA = "ace.instruccion.abierta";

export function PhaseTracker({
  canManage = false,
  instruccion,
  onSelectKind,
}: {
  canManage?: boolean;
  instruccion: InstruccionExpediente;
  onSelectKind?: (kind: string) => void;
}) {
  const faseActual = instruccion.fases.find((fase) => fase.esActual);
  const progresoPct = Math.round(instruccion.progreso * 100);

  /**
   * Once tarjetas de etapa ocupan casi toda la pantalla, y la mayoría de las
   * veces basta con saber el avance y qué toca ahora. Por eso arranca COLAPSADA
   * y recuerda la elección: quien la abre para trabajar la foliación no tiene
   * que volver a abrirla en cada expediente.
   *
   * Lo que NO se colapsa: el avance, la siguiente actuación y los avisos de
   * secuencia. Esconder una advertencia detrás de un clic es la forma segura de
   * que nadie la lea.
   */
  const [abierta, setAbierta] = useState(false);

  useEffect(() => {
    try {
      setAbierta(window.localStorage.getItem(CLAVE_ABIERTA) === "true");
    } catch {
      // Sin localStorage (modo privado, permisos), se queda colapsada.
    }
  }, []);

  function alternar() {
    setAbierta((previo) => {
      const siguiente = !previo;
      try {
        window.localStorage.setItem(CLAVE_ABIERTA, String(siguiente));
      } catch {
        // Que no se pueda recordar no debe impedir abrirla ahora.
      }
      return siguiente;
    });
  }

  // Macro-fases presentes en este flujo, en orden, para agrupar las fases.
  const macroFasesPresentes = MACRO_FASES.filter((macro) =>
    instruccion.fases.some((fase) => fase.macroFase === macro.id),
  );

  return (
    <section className="processPanel phaseTracker">
      <div className="processPanelHead">
        <ListChecks size={17} />
        <h3 className="panelTitulo">Instrucción del expediente</h3>
        <span className="panelOrigen">Ciclo de la contratación · Ley 32069</span>
        <button
          aria-controls="instruccion-detalle"
          aria-expanded={abierta}
          className="panelToggle"
          onClick={alternar}
          type="button"
        >
          {abierta ? "Ocultar etapas" : `Ver las ${instruccion.totalFases} etapas`}
          {abierta ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {instruccion.desierto ? (
        <div className="mb-3 flex items-center gap-[9px] rounded-[10px] border border-[#efb9b3] bg-[#fff1ef] px-3 py-2.5 text-[#b91c1c]">
          <Ban size={16} />
          <span>
            Procedimiento declarado <strong>DESIERTO</strong>: la selección concluyó sin adjudicación. Las
            etapas posteriores a Buena pro no aplican.
          </span>
        </div>
      ) : null}

      <div className="grid gap-2">
        <div className="flex items-baseline justify-between text-[12.5px] text-muted">
          <span>
            {instruccion.fasesCompletas} de {instruccion.totalFases} fases completas
          </span>
          <strong className="text-[16px] text-brand">{progresoPct}%</strong>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-brand-soft">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand to-brand-dark transition-[width] duration-[400ms]"
            style={{ width: `${progresoPct}%` }}
          />
        </div>
        <p className="m-0 text-[12.5px] text-ink">
          {instruccion.desierto
            ? "Procedimiento concluido sin adjudicación (desierto)."
            : faseActual
              ? `Siguiente actuación: Fase ${faseActual.numero} · ${faseActual.label} — responsable: ${actorLabel(faseActual.responsable)}`
              : "Todas las fases obligatorias están completas."}
        </p>
      </div>

      {instruccion.alertasSecuencia.length > 0 ? (
        <div className="grid gap-1.5 rounded-[10px] border border-[#efb9b3] bg-[#fff3f1] px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-[12.5px] font-extrabold text-[#991b1b]">
            <AlertTriangle size={14} />
            Revisión de secuencia y foliación
          </div>
          <ul className="m-0 grid list-disc gap-1 pl-[18px] [&>li]:text-[12px] [&>li]:leading-[1.45] [&>li]:text-[#7f1d1d]">
            {instruccion.alertasSecuencia.map((alerta) => (
              <li key={alerta}>{alerta}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* El detalle. `hidden` y no un desmontaje: así los lectores de pantalla lo
          anuncian como región colapsada en vez de como contenido inexistente, y
          no se pierde el estado de nada al plegarlo. */}
      <div className="grid gap-[18px]" hidden={!abierta} id="instruccion-detalle">
        {macroFasesPresentes.map((macro) => (
          <div className="grid gap-2.5" key={macro.id}>
            <div className="border-b border-line pb-1.5 text-[11px] font-extrabold uppercase tracking-[0.06em] text-brand">
              {macroFaseLabel(macro.id)}
            </div>
            <ol className="m-0 list-none p-0">
              {instruccion.fases
                .filter((fase) => fase.macroFase === macro.id)
                .map((fase) => (
                  <PhaseCard canManage={canManage} fase={fase} key={fase.id} onSelectKind={onSelectKind} />
                ))}
            </ol>
          </div>
        ))}
      </div>

      {abierta ? <ActorMatrix /> : null}
    </section>
  );
}
