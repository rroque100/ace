"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { HitosMap } from "@/lib/procurement-fases";

// Datos del expediente, cargados UNA vez y compartidos por toda la página.
//
// ── El problema ───────────────────────────────────────────────────────────────
//
// Abrir un expediente disparaba unas catorce peticiones, y la mayoría eran la
// misma cosa: `/api/processes/:id` cuatro veces (el detalle y los tres paneles
// de fase), `/api/processes/:id/hitos` otras cuatro (el avance global y los tres
// paneles) y `/api/necesidades/:id` tres.
//
// No es solo ruido. `/api/processes/:id` lanza cuatro consultas en paralelo
// —proceso, documentos, evaluaciones y riesgos—, así que cuatro llamadas son
// dieciséis consultas para el mismo dato. Medido contra la base real: 150-500 ms
// por consulta, 13 KB el payload del proceso (9 KB de ellos el jsonb `hitos`) y
// unos 80 KB duplicados por carga.
//
// ── Por qué un contexto y no una caché genérica ───────────────────────────────
//
// Los cinco componentes que lo necesitan viven todos dentro del detalle del
// expediente y ninguno se usa en otro sitio. Un contexto es la herramienta del
// tamaño del problema: no añade dependencias, se ve de un vistazo quién provee y
// quién consume, y el día que alguien saque un panel de aquí el compilador se lo
// dirá en vez de dejarle una caché huérfana.
//
// ── Dos recargas, no una ──────────────────────────────────────────────────────
//
// Guardar un paso solo cambia `hitos`. Recargar el expediente entero por eso
// volvería a pedir documentos, evaluaciones y riesgos en cada autoguardado, que
// es el problema de partida por otro camino. Por eso hay una recarga barata
// —solo los hitos— y otra completa para cuando cambia algo más.

export type ProcesoExpediente = Record<string, unknown> & {
  id: string;
  hitos?: HitosMap | null;
  necesidad_id?: string | null;
};

export type DatosExpediente = {
  proceso: ProcesoExpediente | null;
  documentos: unknown[];
  evaluaciones: unknown[];
  riesgos: unknown[];
  /** Ficha de origen. Null si el expediente no viene de una necesidad. */
  necesidad: Record<string, unknown> | null;
  hitos: HitosMap;
  cargando: boolean;
  error: string;
  /** Recarga todo: proceso, documentos, evaluaciones, riesgos y ficha. */
  recargarTodo: () => Promise<void>;
  /** Recarga solo los hitos. Es lo que cambia al guardar un paso. */
  recargarHitos: () => Promise<void>;
  /**
   * Recarga solo los documentos. Es lo que cambia mientras un PDF se extrae:
   * el sondeo usa esto en vez de `recargarTodo`, así no re-pide proceso,
   * evaluaciones, riesgos y ficha cada 3,5 s solo para ver el `status` del doc.
   */
  recargarDocumentos: () => Promise<void>;
  /** Aplica un mapa de hitos ya conocido, sin ir al servidor. */
  fijarHitos: (hitos: HitosMap) => void;
};

const Contexto = createContext<DatosExpediente | null>(null);

/**
 * Datos del expediente.
 *
 * Lanza si se usa fuera del proveedor. Es deliberado: devolver datos vacíos
 * dejaría un panel en blanco sin explicación, y el fallo aparecería en
 * producción en vez de en el primer render de desarrollo.
 */
export function useExpediente(): DatosExpediente {
  const valor = useContext(Contexto);
  if (!valor) {
    throw new Error("useExpediente se usó fuera de <ExpedienteProvider>.");
  }
  return valor;
}

export function ExpedienteProvider({
  children,
  processId,
}: {
  children: React.ReactNode;
  processId: string;
}) {
  const [proceso, setProceso] = useState<ProcesoExpediente | null>(null);
  const [documentos, setDocumentos] = useState<unknown[]>([]);
  const [evaluaciones, setEvaluaciones] = useState<unknown[]>([]);
  const [riesgos, setRiesgos] = useState<unknown[]>([]);
  const [necesidad, setNecesidad] = useState<Record<string, unknown> | null>(null);
  const [hitos, setHitos] = useState<HitosMap>({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const recargarTodo = useCallback(async () => {
    try {
      const res = await fetch(`/api/processes/${processId}`, { cache: "no-store" });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error ?? "No se pudo cargar el expediente.");
        return;
      }
      const p: ProcesoExpediente | null = payload.process ?? null;
      setProceso(p);
      setDocumentos(payload.documents ?? []);
      setEvaluaciones(payload.evaluations ?? []);
      setRiesgos(payload.risks ?? []);
      // Los hitos vienen DENTRO del proceso: pedirlos aparte era la cuarta
      // petición duplicada y son 9 de los 13 KB del payload.
      setHitos((p?.hitos as HitosMap | undefined) ?? {});
      setError("");

      const necesidadId = p?.necesidad_id;
      if (!necesidadId) {
        setNecesidad(null);
        return;
      }
      const nRes = await fetch(`/api/necesidades/${necesidadId}`, { cache: "no-store" });
      const n = await nRes.json();
      setNecesidad(nRes.ok ? (n.necesidad ?? null) : null);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setCargando(false);
    }
  }, [processId]);

  const recargarHitos = useCallback(async () => {
    try {
      const res = await fetch(`/api/processes/${processId}/hitos`, { cache: "no-store" });
      const payload = await res.json();
      if (res.ok) setHitos(payload.hitos ?? {});
    } catch {
      // Un fallo al refrescar los pasos no debe borrar lo que ya se veía.
    }
  }, [processId]);

  const recargarDocumentos = useCallback(async () => {
    try {
      const res = await fetch(`/api/processes/${processId}/documents`, { cache: "no-store" });
      const payload = await res.json();
      if (res.ok) setDocumentos(payload.documents ?? []);
    } catch {
      // Un fallo al refrescar los documentos no debe borrar lo que ya se veía.
    }
  }, [processId]);

  useEffect(() => {
    void recargarTodo();
  }, [recargarTodo]);

  const valor = useMemo<DatosExpediente>(
    () => ({
      cargando,
      documentos,
      error,
      evaluaciones,
      fijarHitos: setHitos,
      hitos,
      necesidad,
      proceso,
      recargarDocumentos,
      recargarHitos,
      recargarTodo,
      riesgos,
    }),
    [
      cargando,
      documentos,
      error,
      evaluaciones,
      hitos,
      necesidad,
      proceso,
      recargarDocumentos,
      recargarHitos,
      recargarTodo,
      riesgos,
    ],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
