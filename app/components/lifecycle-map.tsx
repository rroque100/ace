"use client";

import { Ban, CheckCircle2, CircleDot, Circle, FileText, MinusCircle, Workflow } from "lucide-react";
import {
  CICLO_CONTRATACION,
  MODULOS,
  type FormatoArtefacto,
  type UsuarioModulo,
  etapaActualDelProceso,
  modulo as moduloDef,
} from "@/lib/contratacion-modulos";
import { type ActorId, actorSigla } from "@/lib/actores-contratacion";

const FORMATO_LABEL: Record<FormatoArtefacto, string> = {
  pdf: "PDF",
  word: "Word",
  excel: "Excel",
};

function usuarioSigla(id: UsuarioModulo): string {
  return id === "admin" ? "Administrador" : actorSigla(id as ActorId);
}

export function LifecycleMap({ status }: { status?: string | null }) {
  const actual = etapaActualDelProceso(status);
  const actualOrden = actual.orden;
  const moduloActual = moduloDef(actual.modulo);
  const esDesierto = status === "desierto";

  return (
    <section className="processPanel lifecycleMap">
      <div className="processPanelHead">
        <Workflow size={17} />
        <strong>Ciclo de la contratación (Ley 32069)</strong>
      </div>

      <ol className="lifecycleTrack">
        {CICLO_CONTRATACION.map((etapa) => {
          const estado = esDesierto
            ? etapa.orden < actualOrden
              ? "completa"
              : etapa.orden === actualOrden
                ? "desierto"
                : "no_aplica"
            : etapa.orden < actualOrden
              ? "completa"
              : etapa.orden === actualOrden
                ? "actual"
                : "pendiente";
          return (
            <li className="lifecycleStep" data-estado={estado} key={etapa.id}>
              <span className="lifecycleDot" data-estado={estado}>
                {estado === "completa" ? (
                  <CheckCircle2 size={15} />
                ) : estado === "actual" ? (
                  <CircleDot size={15} />
                ) : estado === "desierto" ? (
                  <Ban size={15} />
                ) : estado === "no_aplica" ? (
                  <MinusCircle size={15} />
                ) : (
                  <Circle size={15} />
                )}
              </span>
              <span className="lifecycleStepLabel">{etapa.label}</span>
              <span className="lifecycleStepModule">M{etapa.modulo}</span>
            </li>
          );
        })}
      </ol>

      {esDesierto ? (
        <div className="lifecycleCurrent lifecycleDesierto">
          <div className="lifecycleCurrentHead">
            <span className="lifecycleCurrentTag lifecycleDesiertoTag">Resultado</span>
            <strong>Procedimiento desierto</strong>
          </div>
          <p className="lifecycleCurrentDesc">
            La etapa de selección concluyó sin adjudicación. Genera el Acta de declaratoria de desierto y, de
            corresponder, inicia una nueva convocatoria. Las etapas posteriores no aplican.
          </p>
        </div>
      ) : (
      <div className="lifecycleCurrent">
        <div className="lifecycleCurrentHead">
          <span className="lifecycleCurrentTag">Etapa actual</span>
          <strong>{actual.label}</strong>
          {moduloActual ? (
            <span className="lifecycleCurrentModule">
              Módulo {moduloActual.numero} · {moduloActual.label}
            </span>
          ) : null}
        </div>
        <p className="lifecycleCurrentDesc">{actual.descripcion}</p>

        <div className="lifecycleCurrentGrid">
          <div className="lifecycleCol">
            <span className="lifecycleColTitle">Responsables</span>
            <div className="lifecycleChips">
              {actual.responsables.map((id) => (
                <span className="lifecycleActor" key={id}>
                  {actorSigla(id)}
                </span>
              ))}
            </div>
          </div>

          <div className="lifecycleCol">
            <span className="lifecycleColTitle">Insumos de entrada</span>
            <ul className="lifecycleList">
              {actual.entradas.map((entrada) => (
                <li key={entrada}>{entrada}</li>
              ))}
            </ul>
          </div>

          <div className="lifecycleCol">
            <span className="lifecycleColTitle">Artefactos que genera</span>
            <ul className="lifecycleArtefacts">
              {actual.salidas.map((salida) => (
                <li key={salida.nombre}>
                  <FileText size={13} />
                  <span>{salida.nombre}</span>
                  <span className="lifecycleFormats">
                    {salida.formato.map((f) => (
                      <em className="lifecycleFormat" data-fmt={f} key={f}>
                        {FORMATO_LABEL[f]}
                      </em>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      )}

      <details className="moduleCatalog">
        <summary>
          <Workflow size={14} />
          Arquitectura de módulos (1–10)
        </summary>
        <div className="moduleCatalogGrid">
          {MODULOS.map((m) => (
            <article className="moduleCard" data-transversal={m.transversal ? "true" : undefined} key={m.numero}>
              <div className="moduleCardHead">
                <span className="moduleCardNum">M{m.numero}</span>
                <strong>{m.label}</strong>
                {m.transversal ? <span className="moduleCardTag">Transversal</span> : null}
              </div>
              <p>{m.descripcion}</p>
              <div className="lifecycleChips">
                {m.usuarios.map((id) => (
                  <span className="lifecycleActor" key={id}>
                    {usuarioSigla(id)}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </details>
    </section>
  );
}
