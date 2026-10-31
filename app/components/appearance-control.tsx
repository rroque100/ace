"use client";
import { Moon, Sun } from "lucide-react";
import { useTheme, type Theme } from "../hooks/use-theme";
export function AppearanceControl() {
  const { theme, resolved, setTheme } = useTheme();
  const Icon = resolved === "dark" ? Moon : Sun;
  return <label className="tw inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-line bg-panel px-3 text-ink shadow-sm transition-colors focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15" title="Elige cómo ver ACE">
    <Icon size={17} aria-hidden /><span className="sr-only">Apariencia</span>
    <select className="min-h-10 max-w-24 cursor-pointer border-0 bg-transparent text-[13px] font-medium text-ink outline-none" aria-label="Apariencia" value={theme} onChange={e => setTheme(e.target.value as Theme)}>
      <option value="light">Claro</option><option value="dark">Oscuro</option>
    </select>
  </label>;
}
