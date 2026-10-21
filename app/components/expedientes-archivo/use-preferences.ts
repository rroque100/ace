"use client";

import { useEffect, useState, useCallback, useRef } from "react";

type Setter<T> = (value: T | ((prev: T) => T)) => void;
type SortBy = "created_at" | "title" | "anio" | "file_size" | "status";
type SortDir = "asc" | "desc";

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  validate?: (value: unknown) => value is T,
): [T, Setter<T>, () => void] {
  // Siempre arranca con el default para que el primer render del cliente
  // coincida con el del servidor (evita hydration mismatch SSR). El valor
  // guardado se lee tras el montaje en el efecto de abajo.
  const [value, setValue] = useState<T>(initialValue);

  // Ref para evitar writes redundantes
  const lastWrittenRef = useRef<string | null>(null);

  // Hidratar desde localStorage tras el montaje (no en el inicializador, que
  // correría distinto en server vs cliente). `validate` es un type-guard puro,
  // así que capturar el del primer render es seguro.
  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item === null) return;
      const parsed = JSON.parse(item) as unknown;
      if (validate && !validate(parsed)) return;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValue(parsed as T);
    } catch {
      // Ignorar
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const setStoredValue: Setter<T> = useCallback(
    (next) => {
      setValue((prev) => {
        const resolved =
          typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        try {
          const serialized = JSON.stringify(resolved);
          // Solo escribir si realmente cambió
          if (lastWrittenRef.current === serialized) {
            return resolved;
          }
          lastWrittenRef.current = serialized;
          window.localStorage.setItem(key, serialized);
        } catch {
          // Ignorar errores de localStorage
        }
        return resolved;
      });
    },
    [key],
  );

  const remove = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
      lastWrittenRef.current = null;
      setValue(initialValue);
    } catch {
      // Ignorar
    }
  }, [key, initialValue]);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === key && e.newValue !== null) {
        try {
          const parsed = JSON.parse(e.newValue) as unknown;
          if (!validate || validate(parsed)) {
            setValue(parsed as T);
          }
        } catch {
          // Ignorar
        }
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key, validate]);

  return [value, setStoredValue, remove];
}

type ViewMode = "lista" | "tabla" | "tarjetas";
type StatusFilter = "todos" | "pendientes" | "indexados" | "error";

// Ubicación física recordada entre subidas (subconjunto de SubirForm).
export type LastUbicacion = {
  tipoAlmacenamiento: string;
  nroArchivador: string;
  nroPaquete: string;
  empastado: string;
  colorArchivador: string;
  nroEstante: string;
  nroPiso: string;
  nroLocal: string;
};

const EMPTY_UBICACION: LastUbicacion = {
  tipoAlmacenamiento: "",
  nroArchivador: "",
  nroPaquete: "",
  empastado: "",
  colorArchivador: "",
  nroEstante: "",
  nroPiso: "",
  nroLocal: "",
};

function isLastUbicacion(v: unknown): v is LastUbicacion {
  if (typeof v !== "object" || v === null) return false;
  return Object.keys(EMPTY_UBICACION).every(
    (k) => typeof (v as Record<string, unknown>)[k] === "string",
  );
}

export function useExpedientesPreferences() {
  const [viewMode, setViewMode, resetViewMode] = useLocalStorage<ViewMode>(
    "exp:viewMode",
    "lista",
    (v): v is ViewMode => v === "lista" || v === "tabla" || v === "tarjetas",
  );

  const [statusFilter, setStatusFilter, resetStatusFilter] = useLocalStorage<StatusFilter>(
    "exp:statusFilter",
    "todos",
    (v): v is StatusFilter =>
      v === "todos" || v === "pendientes" || v === "indexados" || v === "error",
  );

  const [sortByRaw, setSortByRaw, resetSortBy] = useLocalStorage<SortBy>(
    "exp:sortBy",
    "created_at",
  );

  const [sortDir, setSortDir, resetSortDir] = useLocalStorage<SortDir>(
    "exp:sortDir",
    "desc",
    (v): v is SortDir => v === "asc" || v === "desc",
  );

  const [filters, setFilters, resetFilters] = useLocalStorage<{
    oficina: string;
    estante: string;
    tipoDocumento: string;
  }>("exp:filters", { oficina: "", estante: "", tipoDocumento: "" });

  const [collapsed, setCollapsed, resetCollapsed] = useLocalStorage<boolean>(
    "exp:sidebarCollapsed",
    false,
  );

  const [tab, setTab, resetTab] = useLocalStorage<"buscar" | "subir" | "responder" | "buscar-rag" | "subir-rag">(
    "exp:lastTab",
    "buscar",
    (v): v is "buscar" | "subir" | "responder" | "buscar-rag" | "subir-rag" =>
      v === "buscar" || v === "subir" || v === "responder" || v === "buscar-rag" || v === "subir-rag",
  );

  // Analizar el PDF con IA automáticamente al cargarlo (sin pulsar un botón).
  const [autoExtract, setAutoExtract, resetAutoExtract] = useLocalStorage<boolean>(
    "exp:autoExtract",
    true,
    (v): v is boolean => typeof v === "boolean",
  );

  // Última ubicación física usada (para precargarla en la siguiente subida del
  // mismo lote: quien archiva mete N expedientes en la misma caja/estante).
  const [lastUbicacion, setLastUbicacion, resetLastUbicacion] = useLocalStorage<LastUbicacion>(
    "exp:lastUbicacion",
    EMPTY_UBICACION,
    isLastUbicacion,
  );

  // Setters tipados estables (no cambian entre renders)
  const setSortBy = useCallback(
    (value: SortBy | ((prev: SortBy) => SortBy)) => {
      if (typeof value === "function") {
        setSortByRaw((prev) => (value as (p: SortBy) => SortBy)(prev));
      } else {
        setSortByRaw(value);
      }
    },
    [setSortByRaw],
  );

  const resetAll = useCallback(() => {
    resetViewMode();
    resetStatusFilter();
    resetSortBy();
    resetSortDir();
    resetFilters();
    resetCollapsed();
    resetTab();
    resetAutoExtract();
    resetLastUbicacion();
  }, [
    resetViewMode,
    resetStatusFilter,
    resetSortBy,
    resetSortDir,
    resetFilters,
    resetCollapsed,
    resetTab,
    resetAutoExtract,
    resetLastUbicacion,
  ]);

  return {
    viewMode,
    setViewMode,
    statusFilter,
    setStatusFilter,
    sortBy: sortByRaw,
    setSortBy,
    sortDir,
    setSortDir,
    filters,
    setFilters,
    collapsed,
    setCollapsed,
    tab,
    setTab,
    autoExtract,
    setAutoExtract,
    lastUbicacion,
    setLastUbicacion,
    resetAll,
  };
}
