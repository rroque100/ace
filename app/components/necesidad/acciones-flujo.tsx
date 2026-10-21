"use client";

import { memo, useMemo, useState } from "react";
import { ArrowRightCircle, CheckCircle2, ClipboardCheck, Loader } from "lucide-react";
import { type AccionDef, type LadoActor, accionesDisponibles, ladoDeRol } from "@/lib/necesidad-workflow";
import { contarAdmisibilidad } from "@/lib/necesidad-admisibilidad";
import { Button } from "../ui";

/**
 * Las acciones que mueven el requerimiento de estado, con sus dos confirmaciones.
 *
 * Salió del panel «Requerimiento · flujo», que mezclaba dos cosas: cabeceras,
 * insignias y avisos que solo LEEN la necesidad, y esto, que la CAMBIA. Lo que
 * cambia trae estado propio —la acción pendiente de sustento, el aviso de
 * admisibilidad, el bloqueo mientras corre la petición— y ese estado no lo usa
 * nadie más.
 *
 * Recibe `role` y `status` en vez de la lista de acciones ya calculada, y ahí
 * está el motivo de que la memoización funcione: `accionesDisponibles` devuelve
 * un array nuevo en cada llamada, así que pasarlo como prop habría dado una prop
 * distinta por render. Con las cadenas sueltas, la lista se calcula aquí una vez
 * y solo se rehace cuando de verdad cambia el rol o el estado.
 *
 * Por la misma razón `verificacion` llega partido en dos escalares: el objeto lo
 * recalcula el padre en cada render.
 */
export const AccionesFlujo = memo(function AccionesFlujo({
  estadoActor,
  listaParaRemitir,
  necesidadId,
  onCambio,
  onError,
  pendientesParaRemitir,
  puedeGestionar,
  role,
  status,
  tieneExpediente,
}: {
  /** A quién le toca actuar en este estado; para el mensaje de «sin acciones». */
  estadoActor: LadoActor | null | undefined;
  /** El requerimiento no tiene pendientes que impidan remitirlo. */
  listaParaRemitir: boolean;
  necesidadId: string;
  /** Tras una transición: recargar la necesidad y refrescar el historial. */
  onCambio: () => Promise<void> | void;
  /** Cadena vacía limpia el aviso. */
  onError: (mensaje: string) => void;
  pendientesParaRemitir: number;
  puedeGestionar: boolean;
  role: string;
  status: string | null | undefined;
  tieneExpediente: boolean;
}) {
  // Acción pendiente de confirmar (cuando requiere sustento).
  const [pendingAction, setPendingAction] = useState<AccionDef | null>(null);
  const [sustento, setSustento] = useState("");
  const [mecanismo, setMecanismo] = useState("");
  const [runningAction, setRunningAction] = useState(false);
  const [avisoAdmisibilidad, setAvisoAdmisibilidad] = useState<
    { accion: AccionDef; faltan: number; total: number } | null
  >(null);

  const acciones = useMemo(
    () =>
      puedeGestionar
        ? accionesDisponibles(status, ladoDeRol(role), { tieneExpediente })
        : [],
    [puedeGestionar, role, status, tieneExpediente],
  );

  async function runAction(accion: AccionDef, conSustento: string, conMecanismo: string) {
    setRunningAction(true);
    onError("");
    try {
      const response = await fetch(`/api/necesidades/${necesidadId}/transicion`, {
        body: JSON.stringify({ action: accion.action, sustento: conSustento, mecanismo: conMecanismo }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok) {
        onError(payload.error ?? "No se pudo ejecutar la acción.");
        return;
      }
      setPendingAction(null);
      setSustento("");
      setMecanismo("");
      await onCambio();
    } catch {
      onError("No se pudo conectar con el servidor.");
    } finally {
      setRunningAction(false);
    }
  }

  // Lanza la acción por su vía normal (con o sin sustento).
  function ejecutarAccion(accion: AccionDef) {
    if (accion.requiereSustento) {
      setPendingAction(accion);
      setSustento("");
      setMecanismo("");
    } else {
      void runAction(accion, "", "");
    }
  }

  async function onClickAccion(accion: AccionDef) {
    // Aviso suave antes del conforme: si quedan puntos de admisibilidad sin
    // marcar, se pregunta. El conforme NO los exige, pero conviene ser
    // consciente. Si el checklist está completo (o el fetch falla), no estorba.
    if (accion.action === "aprobar_conforme") {
      try {
        const r = await fetch(`/api/necesidades/${necesidadId}/admisibilidad`, { cache: "no-store" });
        if (r.ok) {
          const d = await r.json();
          const { done, total } = contarAdmisibilidad(d?.items ?? {});
          if (total - done > 0) {
            setAvisoAdmisibilidad({ accion, faltan: total - done, total });
            return;
          }
        }
      } catch { /* sin checklist accesible: no se estorba el conforme */ }
    }
    ejecutarAccion(accion);
  }

  return (
    <>
      {/* Remitir a la DEC es una AFIRMACIÓN: dice que el requerimiento está
          formulado. Por eso es lo único que se condiciona — escribir y guardar
          a medias sigue siendo trabajo legítimo. */}
      {puedeGestionar && acciones.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {acciones.map((accion) => {
            const frenado = accion.action === "remitir" && !listaParaRemitir;
            return (
              <Button
                variant={accion.variante === "primary" ? "primary" : "secondary"}
                destructive={accion.variante === "danger"}
                disabled={runningAction || frenado}
                key={accion.action}
                onClick={() => onClickAccion(accion)}
                title={
                  frenado
                    ? `Antes de remitir hay ${pendientesParaRemitir === 1 ? "una cosa" : `${pendientesParaRemitir} cosas`} que resolver. Míralas en «¿Está lista para el expediente?».`
                    : accion.ayuda
                }
                type="button"
              >
                {runningAction ? <Loader size={14} /> : <ArrowRightCircle size={14} />}
                {accion.label}
              </Button>
            );
          })}
        </div>
      ) : puedeGestionar ? (
        <p className="text-xs font-semibold text-muted">
          No hay acciones disponibles para tu rol en este estado (
          {estadoActor === "dec" ? "corresponde a la DEC" : "corresponde al área usuaria"}).
        </p>
      ) : null}

      {pendingAction ? (
        <div className="grid gap-2 rounded-[10px] border border-dashed border-brand/30 bg-surface p-3 [&_label]:grid [&_label]:gap-1 [&_label]:text-[12.5px] [&_label]:text-muted [&_input]:rounded-lg [&_input]:border [&_input]:border-line [&_input]:bg-panel [&_input]:px-[9px] [&_input]:py-[7px] [&_input]:text-[13px] [&_textarea]:rounded-lg [&_textarea]:border [&_textarea]:border-line [&_textarea]:bg-panel [&_textarea]:px-[9px] [&_textarea]:py-[7px] [&_textarea]:text-[13px]">
          <label>
            <span>Sustento de “{pendingAction.label}”</span>
            <textarea onChange={(e) => setSustento(e.target.value)} rows={3} value={sustento} />
          </label>
          <label>
            <span>Mecanismo (memorando / correo / proveído)</span>
            <input onChange={(e) => setMecanismo(e.target.value)} placeholder="Memorando N°…" value={mecanismo} />
          </label>
          <div className="flex gap-2">
            <Button
              variant="primary"
              disabled={runningAction || sustento.trim().length < 3}
              onClick={() => void runAction(pendingAction, sustento, mecanismo)}
              type="button"
            >
              {runningAction ? <Loader size={14} /> : <CheckCircle2 size={14} />}
              Confirmar
            </Button>
            <Button onClick={() => setPendingAction(null)} type="button">
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}

      {/* Aviso suave de admisibilidad al dar conforme (no bloquea). Por eso es
          `role="alert"` y no `alertdialog`: informa sin atrapar el foco ni
          exigir respuesta, y el conforme sigue disponible. */}
      {avisoAdmisibilidad ? (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-[12.5px] leading-[1.45] text-ink" role="alert">
          <p className="m-0 flex items-start gap-2 text-[13px] leading-[1.45] text-ink [&_svg]:mt-0.5 [&_svg]:flex-none [&_svg]:text-warning">
            <ClipboardCheck size={15} aria-hidden />
            <span>
              Quedan <strong>{avisoAdmisibilidad.faltan} de {avisoAdmisibilidad.total}</strong> puntos de
              admisibilidad sin marcar. El conforme no los exige, pero conviene revisarlos antes de aprobar.
            </span>
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Button
              onClick={() => {
                setAvisoAdmisibilidad(null);
                document.querySelector(".admisPanel")?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
              type="button"
            >
              Revisar checklist
            </Button>
            <Button
              variant="primary"
              disabled={runningAction}
              onClick={() => { const a = avisoAdmisibilidad.accion; setAvisoAdmisibilidad(null); ejecutarAccion(a); }}
              type="button"
            >
              {runningAction ? <Loader size={14} /> : <CheckCircle2 size={14} />}
              Dar conforme igual
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
});
