"use client";

import { Workflow } from "lucide-react";
import { useState } from "react";
import type { Oficina } from "../oficinas/use-oficinas";
import { ProcesosModal } from "../oficinas/procesos-modal";
import { btnPrimary } from "./ui";
import { useToastHelpers } from "@/lib/toast";

/**
 * Sección «Procesos de contratación» de la pestaña Procesos de selección.
 *
 * Antes vivía en la pestaña Áreas, dentro de la tarjeta de la oficina que
 * gestiona las contrataciones (el OEC — en una municipalidad, la Unidad de
 * Abastecimiento). Se trasladó aquí porque el catálogo de procedimientos ACTIVOS
 * de esa oficina es, en la práctica, el de procesos de selección de la entidad.
 *
 * El catálogo sigue siendo POR OFICINA (`/api/configuracion/oficinas/{id}/procesos`),
 * así que la sección lista las oficinas marcadas como encargadas de las
 * contrataciones y abre para cada una el MISMO `ProcesosModal`: no se reescribió
 * su funcionalidad, solo cambió desde dónde se abre.
 */
export function ProcesosContratacionSection({ oficinas }: { oficinas: Oficina[] }) {
  const { error: toastError } = useToastHelpers();
  const [openId, setOpenId] = useState<string | null>(null);

  // La bandera `gestiona_contrataciones` (el chip «Contrataciones» de Áreas)
  // marca al OEC. Normalmente es una sola oficina, pero se admite más de una.
  const oec = oficinas.filter((o) => o.gestiona_contrataciones);

  return (
    <section
      id="procesos-contratacion"
      data-section="procesos-contratacion"
      className="border border-line rounded-lg bg-panel p-4"
    >
      <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink mb-1.5">
        <Workflow size={14} /> Procesos de contratación (Ley 32069)
      </h2>
      <p className="text-sm text-muted leading-relaxed m-0 mb-3">
        El catálogo de procedimientos que gestiona el órgano encargado de las contrataciones (OEC).
        Define qué procedimientos de la Ley 32069 están activos para la entidad y sus modelos de
        requerimiento para el copiloto. Se administra por oficina.
      </p>

      {oec.length === 0 ? (
        <p className="rounded-md border border-dashed border-line bg-surface px-3 py-2.5 text-sm text-muted m-0">
          Ninguna oficina está marcada como encargada de las contrataciones. Márcala en la pestaña{" "}
          <strong>Áreas</strong> para poder gestionar sus procesos aquí.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {oec.map((o) => (
            <div
              key={o.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-line bg-white px-3 py-2.5 max-sm:flex-col max-sm:items-stretch"
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold text-ink truncate">
                  {o.nombre}
                  {o.sufijo ? ` · ${o.sufijo}` : ""}
                </div>
                <div className="text-xs text-muted">Órgano encargado de las contrataciones</div>
              </div>
              <button
                className={`${btnPrimary} shrink-0`}
                type="button"
                onClick={() => setOpenId(o.id)}
              >
                <Workflow size={15} /> Gestionar procesos
              </button>
            </div>
          ))}
        </div>
      )}

      {openId !== null ? (
        <ProcesosModal
          oficina={oficinas.find((o) => o.id === openId)!}
          open={openId !== null}
          onClose={() => setOpenId(null)}
          setError={(v) => {
            if (v) toastError("Procesos de contratación", v);
          }}
        />
      ) : null}
    </section>
  );
}
