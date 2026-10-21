"use client";

import { memo, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRightCircle, Briefcase, Loader } from "lucide-react";
import { HITO_STATUS_META, type HitosMap, hitosDeFase, progresoDeFase } from "@/lib/procurement-fases";
import { necesidadStatusLabel, necesidadStatusTono } from "@/lib/necesidad-workflow";
import { cn } from "@/lib/utils";
import { Badge, Button, buttonClasses } from "../ui";

type AvanceFase1 = {
  completados: number;
  pasos: Array<{ code: string; label: string; status: string; statusLabel: string }>;
  porcentaje: number;
  total: number;
};

/**
 * Derivación de la necesidad a Expediente de Contratación.
 *
 * Tiene dos caras según haya expediente o no, y las dos traen lo suyo: si ya se
 * derivó, carga el avance real de la Fase 1 para no obligar a abrir el
 * expediente solo para saber por dónde va; si no, ofrece el botón de derivar y
 * explica por qué está deshabilitado.
 *
 * Se lleva su petición de hitos, que es la única de la pantalla que no viaja en
 * la carga combinada —depende del expediente, no de la necesidad—.
 *
 * `siguienteAccionLabel` llega como cadena y no como el objeto de la acción: es
 * lo único que se necesita de él, y un objeto nuevo por render anularía la
 * memoización.
 */
export const PanelDerivacion = memo(function PanelDerivacion({
  necesidadId,
  onCambio,
  onError,
  processId,
  puedeDerivar,
  siguienteAccionLabel,
  status,
}: {
  necesidadId: string;
  /** Tras derivar, para que el padre recargue la necesidad. */
  onCambio: () => Promise<void> | void;
  /** Cadena vacía limpia el aviso. */
  onError: (mensaje: string) => void;
  /** Expediente ya creado, o `null` si aún no se derivó. */
  processId: string | null;
  puedeDerivar: boolean;
  /** Nombre del siguiente paso del flujo, para orientar; `null` si no hay. */
  siguienteAccionLabel: string | null;
  status: string;
}) {
  const [avanceFase1, setAvanceFase1] = useState<AvanceFase1 | null>(null);
  const [deriving, setDeriving] = useState(false);

  // Cargar el avance de la Fase 1 cuando la necesidad está derivada. Si el
  // fetch falla se queda en null y el panel simplemente no muestra la barra:
  // el enlace al expediente sigue funcionando igual.
  useEffect(() => {
    let cancelado = false;
    if (!processId) {
      // Limpieza diferida: evita el setState síncrono dentro del efecto (la
      // regla react-hooks/set-state-in-effect) sin cambiar el comportamiento.
      queueMicrotask(() => {
        if (!cancelado) setAvanceFase1(null);
      });
      return () => {
        cancelado = true;
      };
    }
    void (async () => {
      try {
        const res = await fetch(`/api/processes/${processId}/hitos`);
        if (!res.ok) return;
        const payload = (await res.json()) as { hitos?: HitosMap };
        if (cancelado || !payload.hitos) return;
        const progreso = progresoDeFase("F1", payload.hitos);
        const pasos = hitosDeFase("F1").map((h) => {
          const st = payload.hitos?.[h.code]?.status ?? "pendiente";
          return { code: h.code, label: h.label, status: st, statusLabel: HITO_STATUS_META[st].label };
        });
        setAvanceFase1({ completados: progreso.completados, pasos, porcentaje: progreso.porcentaje, total: progreso.total });
      } catch {
        /* sin barra; el enlace sigue */
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [processId]);

  async function derivar() {
    setDeriving(true);
    onError("");
    try {
      const response = await fetch(`/api/necesidades/${necesidadId}/derivar`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) {
        onError(payload.error ?? "No se pudo derivar a expediente.");
        return;
      }
      await onCambio();
    } catch {
      onError("No se pudo conectar con el servidor.");
    } finally {
      setDeriving(false);
    }
  }

  return (
    <section id="sec-derivacion" className="grid grid-cols-[minmax(0,1fr)] content-start gap-3 rounded-[14px] border border-line bg-panel p-3.5 shadow-card">
      <div className="flex flex-wrap items-center gap-2 text-ink">
        <ArrowRightCircle size={17} />
        <h3 className="panelTitle">Derivación a expediente</h3>
      </div>
      {processId ? (
        <>
          <p className="text-xs font-semibold text-muted">Esta necesidad ya fue derivada e incorporada al CMN.</p>
          {/* El avance REAL del expediente, sin tener que abrirlo: antes la
              necesidad solo decía "derivada" y no contaba nada de la Fase 1. */}
          {avanceFase1 ? (
            <div className="fase1Avance">
              <div className="h-1.5 overflow-hidden rounded-full bg-line [&>div]:h-full [&>div]:bg-success [&>div]:transition-[width] [&>div]:duration-200">
                <div style={{ width: `${avanceFase1.porcentaje}%` }} />
              </div>
              <small>
                Actuaciones preparatorias: <strong>{avanceFase1.completados}</strong> de{" "}
                {avanceFase1.total} pasos
              </small>
              <div className="flex flex-wrap gap-1">
                {avanceFase1.pasos.map((paso) => (
                  <span
                    className="rounded border border-line px-[5px] py-px text-[10px] font-semibold text-muted"
                    data-status={paso.status}
                    key={paso.code}
                    title={`${paso.code} · ${paso.label}: ${paso.statusLabel}`}
                  >
                    {paso.code.replace(/^[A-Z]/, "")}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          <Link className={cn(buttonClasses({ variant: "primary" }), "justify-self-start")} href={`/expedientes/${processId}`}>
            <Briefcase size={15} />
            Abrir expediente
          </Link>
        </>
      ) : (
        <>
          <p className="text-xs font-semibold text-muted">
            Al derivar, la DEC crea el Expediente de Contratación y la necesidad pasa a “Incorporado al CMN”. Requiere que
            el requerimiento esté <strong>conforme</strong>.
          </p>
          <Button
            variant="primary"
            className="justify-self-start"
            disabled={!puedeDerivar || deriving || status !== "conforme"}
            onClick={derivar}
            type="button"
          >
            {deriving ? <Loader size={15} /> : <ArrowRightCircle size={15} />}
            Derivar a expediente
          </Button>
          {!puedeDerivar ? (
            <small className="text-xs font-semibold text-muted">Derivar requiere rol con gestión de expedientes (DEC, AGA, Titular).</small>
          ) : status !== "conforme" ? (
            <div className="mt-1 grid gap-1.5 rounded-lg border border-line bg-brand-soft px-2.5 py-2 [&_small]:leading-[1.45]">
              <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                Estado actual:{" "}
                <Badge tone={necesidadStatusTono(status)}>
                  {necesidadStatusLabel(status)}
                </Badge>
              </span>
              <small className="text-xs font-semibold text-muted">
                El requerimiento debe estar <strong>Conforme</strong> para derivar.{" "}
                {siguienteAccionLabel ? (
                  <>
                    Siguiente paso: pulsa <strong>«{siguienteAccionLabel}»</strong> en el panel “Requerimiento ·
                    flujo” de arriba y continúa hasta “Conforme”.
                  </>
                ) : (
                  <>Usa las acciones del panel “Requerimiento · flujo” de arriba para avanzar hasta “Conforme”.</>
                )}
              </small>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
});
