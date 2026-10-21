"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const CURRENT_YEAR = new Date().getFullYear();
const STORAGE_KEY = "ace-selected-year";

type YearContextValue = {
  year: number;
  setYear: (y: number) => void;
  availableYears: number[];
  yearParam: string; // "year=2026"
};

const YearContext = createContext<YearContextValue | null>(null);

export function YearProvider({ children }: { children: React.ReactNode }) {
  const [year, setYearState] = useState<number>(CURRENT_YEAR);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (stored) {
      const n = Number.parseInt(stored, 10);
      if (n >= 2020 && n <= 2100) setYearState(n);
    }
    setMounted(true);
  }, []);

  const setYear = useCallback((y: number) => {
    setYearState(y);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, String(y));
    }
  }, []);

  const value = useMemo<YearContextValue>(
    () => ({
      year,
      setYear,
      availableYears: computeAvailableYears(year),
      yearParam: `year=${year}`,
    }),
    [year, setYear],
  );

  // No renderizar hijos hasta saber el año (evita flicker).
  if (!mounted) return null;

  return <YearContext.Provider value={value}>{children}</YearContext.Provider>;
}

export function useYear(): YearContextValue {
  const ctx = useContext(YearContext);
  if (!ctx) throw new Error("useYear debe usarse dentro de <YearProvider>");
  return ctx;
}

export function useYearQueryParam(): string {
  const ctx = useContext(YearContext);
  return ctx ? `year=${ctx.year}` : `year=${CURRENT_YEAR}`;
}

/** Construye una URL con el año como query param. */
export function withYear(base: string, year: number): string {
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}year=${year}`;
}

function computeAvailableYears(selected: number): number[] {
  const years: number[] = [];
  const start = Math.min(selected, CURRENT_YEAR);
  for (let y = start; y <= Math.max(selected, CURRENT_YEAR) + 1; y++) {
    years.push(y);
  }
  return years.sort((a, b) => b - a); // más reciente primero
}
