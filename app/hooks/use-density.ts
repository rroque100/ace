"use client";

import { useCallback, useEffect, useState } from "react";

export type Density = "comfortable" | "compact";

const STORAGE_KEY = "exp:density";

export function useDensity() {
  const [density, setDensityState] = useState<Density>("comfortable");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY) as Density | null;
      if (stored === "comfortable" || stored === "compact") {
        // Lectura de localStorage post-montaje (evita mismatch de hidratación SSR).
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDensityState(stored);
        document.documentElement.setAttribute("data-density", stored);
      }
    } catch {
      // Ignorar
    }
  }, []);

  const setDensity = useCallback((next: Density) => {
    setDensityState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignorar
    }
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-density", next);
    }
  }, []);

  const toggle = useCallback(() => {
    setDensity(density === "comfortable" ? "compact" : "comfortable");
  }, [density, setDensity]);

  return { density, setDensity, toggle };
}
