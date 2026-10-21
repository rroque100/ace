"use client";

import { useEffect, useState, useCallback } from "react";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "exp:theme";

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", resolved);
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolved, setResolved] = useState<ResolvedTheme>("light");

  // Cargar tema inicial desde localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
      const initial: Theme = stored ?? "system";
      // Lectura de localStorage post-montaje (evita mismatch de hidratación SSR).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setThemeState(initial);
      const r = initial === "system" ? getSystemTheme() : initial;
      setResolved(r);
      applyTheme(r);
    } catch {
      // Ignorar
    }
  }, []);

  // Escuchar cambios en prefers-color-scheme si theme === "system"
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (theme !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const r = getSystemTheme();
      setResolved(r);
      applyTheme(r);
    };
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignorar
    }
    const r = next === "system" ? getSystemTheme() : next;
    setResolved(r);
    applyTheme(r);
  }, []);

  const toggle = useCallback(() => {
    // Si es system, vamos a dark. Si es dark, a light. Si es light, a system.
    const next: Theme = theme === "system" ? "dark" : theme === "dark" ? "light" : "system";
    setTheme(next);
  }, [theme, setTheme]);

  return { theme, resolved, setTheme, toggle };
}
