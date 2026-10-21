"use client";

import { Building2, Check, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { formatDocumentNumber } from "@/lib/document-number";
import { useYear } from "@/lib/year-context";

export type Counter = {
  tipo: string;
  siguiente: number;
  preview: string;
  enabled: boolean;
  // Sigla propia del tipo (ej. "MDCH/LOG"); si es null se usa la de la oficina.
  sufijo: string | null;
};
export type Oficina = {
  id: string;
  nombre: string;
  entidad: string | null;
  ruc: string | null;
  responsable_nombre: string | null;
  responsable_cargo: string | null;
  sufijo: string | null;
  ancho: number;
  activo: boolean;
  membrete: boolean;
  /** Si true, la oficina gestiona procedimientos de contratación (muestra "Gestionar procesos"). */
  gestiona_contrataciones: boolean;
  counters: Counter[];
};

const API = "/api/configuracion/oficinas";

// Construye el preview oficial peruano de un correlativo.
// Formato: {TIPO} N° {NNN}-{AAAA}-{ENTIDAD}/{AREA}
// Ver lib/document-number.ts para detalles.
export function formatCounterPreview(
  tipo: string,
  siguiente: number,
  ancho: number,
  sufijo: string | null | undefined,
  year?: number,
): string {
  return formatDocumentNumber({
    siguiente,
    ancho,
    sufijo: sufijo ?? null,
    tipo,
    ...(year !== undefined ? { year } : {}),
  });
}

export type LoadState = "idle" | "loading" | "ready" | "error";

export function useOficinas() {
  const { yearParam } = useYear();
  const [oficinas, setOficinas] = useState<Oficina[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Copia de lo que devolvió el servidor. Editar una oficina o un correlativo
  // escribe en el estado compartido, así que la pantalla muestra los cambios como
  // si estuvieran guardados; comparando contra esta copia se sabe cuáles siguen
  // solo en el navegador y se puede avisar antes de perderlos.
  const [guardado, setGuardado] = useState<string>("[]");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}?${yearParam}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        // Se conserva lo que hubiera en pantalla: pisarlo con [] hacía pasar un
        // fallo por "no hay oficinas", y además lo fijaba como estado guardado,
        // con lo que el aviso de cambios sin guardar dejaba de tener sentido.
        setError(data.error ?? "No se pudo cargar las oficinas");
        return;
      }
      const lista: Oficina[] = data.oficinas ?? [];
      setOficinas(lista);
      setGuardado(JSON.stringify(lista));
      setError(null);
    } catch {
      setError("No se pudo cargar las oficinas");
    } finally {
      setLoading(false);
    }
  }, [yearParam]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /**
   * Aplica la lista que acaba de devolver el servidor tras guardar: actualiza la
   * pantalla Y la copia de referencia. Usar `setOficinas` aquí dejaría la copia
   * vieja y todo seguiría marcado como "sin guardar" justo después de guardar.
   */
  const aplicarDelServidor = useCallback((lista: Oficina[]) => {
    setOficinas(lista);
    setGuardado(JSON.stringify(lista));
  }, []);

  const sinGuardar = !loading && JSON.stringify(oficinas) !== guardado;

  return { oficinas, loading, error, reload, setOficinas, aplicarDelServidor, sinGuardar };
}

// Pequeño indicador de estado: se muestra 30s tras cada guardado.
export function SavedBadge({ at }: { at: number | null }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    setHidden(false);
    if (at === null) return;
    const timer = setTimeout(() => setHidden(true), 30_000);
    return () => clearTimeout(timer);
  }, [at]);
  if (at === null || hidden) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
      <Check size={14} /> Guardado
    </span>
  );
}

export function LoadingLine({ message = "Cargando…" }: { message?: string }) {
  return (
    <p className="text-sm text-muted">
      <Loader2 size={14} className="animate-spin" /> {message}
    </p>
  );
}

export function ErrorLine({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-md bg-danger-soft p-2.5 text-sm text-[color-mix(in_srgb,var(--danger)_85%,var(--ink))]"
    >
      <Building2 size={14} className="inline -translate-y-0.5" /> {message}
    </p>
  );
}
