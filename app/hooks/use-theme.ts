"use client";
import { useSyncExternalStore } from "react";
import { THEME_EVENT, THEME_KEY, validTheme, type Theme } from "@/lib/theme";
export type { Theme, ResolvedTheme } from "@/lib/theme";
let memoryTheme: Theme | null = null;
function readTheme(): Theme {
  try { return memoryTheme ?? validTheme(localStorage.getItem(THEME_KEY)); } catch { return memoryTheme ?? "system"; }
}
function readResolved() {
  const theme = readTheme();
  return theme === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : theme;
}
function apply() { document.documentElement.dataset.theme = readResolved(); }
function subscribe(listener: () => void) {
  const media = matchMedia("(prefers-color-scheme: dark)");
  const update = () => { apply(); listener(); };
  const storage = () => { memoryTheme = null; update(); };
  window.addEventListener("storage", storage);
  window.addEventListener(THEME_EVENT, update);
  media.addEventListener("change", update);
  apply();
  return () => {
    window.removeEventListener("storage", storage);
    window.removeEventListener(THEME_EVENT, update);
    media.removeEventListener("change", update);
  };
}
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "system" as const);
  const resolved = useSyncExternalStore(subscribe, readResolved, () => "light" as const);
  function setTheme(next: Theme) {
    memoryTheme = next;
    try { localStorage.setItem(THEME_KEY, next); } catch { /* Keep the preference for this tab. */ }
    apply();
    window.dispatchEvent(new Event(THEME_EVENT));
  }
  return { theme, resolved, setTheme, toggle: () => setTheme(resolved === "dark" ? "light" : "dark") };
}
