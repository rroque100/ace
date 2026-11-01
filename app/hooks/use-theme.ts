"use client";
import { useSyncExternalStore } from "react";
import { THEME_EVENT, THEME_KEY, validTheme, type Theme } from "@/lib/theme";
export type { Theme, ResolvedTheme } from "@/lib/theme";
let memoryTheme: Theme | null = null;
function readTheme(): Theme {
  try { return memoryTheme ?? validTheme(localStorage.getItem(THEME_KEY)); } catch { return memoryTheme ?? "light"; }
}
function apply() {
  const theme = readTheme();
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = theme === "dark" ? "#101923" : "#f4f7fa";
}
function subscribe(listener: () => void) {
  const update = () => { apply(); listener(); };
  const storage = () => { memoryTheme = null; update(); };
  window.addEventListener("storage", storage);
  window.addEventListener(THEME_EVENT, update);
  apply();
  return () => {
    window.removeEventListener("storage", storage);
    window.removeEventListener(THEME_EVENT, update);
  };
}
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "light" as const);
  function setTheme(next: Theme) {
    memoryTheme = validTheme(next);
    try { localStorage.setItem(THEME_KEY, memoryTheme); } catch { /* Keep the preference for this tab. */ }
    apply();
    window.dispatchEvent(new Event(THEME_EVENT));
  }
  return { theme, resolved: theme, setTheme, toggle: () => setTheme(theme === "dark" ? "light" : "dark") };
}
