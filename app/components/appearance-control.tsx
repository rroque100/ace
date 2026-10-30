"use client";
import { Moon, Sun } from "lucide-react";
import { useTheme, type Theme } from "../hooks/use-theme";
export function AppearanceControl() {
  const { theme, resolved, setTheme } = useTheme();
  const Icon = resolved === "dark" ? Moon : Sun;
  return <label className="appearanceControl tw" title="Elige cómo ver ACE">
    <Icon size={17} aria-hidden /><span className="sr-only">Apariencia</span>
    <select aria-label="Apariencia" value={theme} onChange={e => setTheme(e.target.value as Theme)}>
      <option value="system">Sistema</option><option value="light">Claro</option><option value="dark">Oscuro</option>
    </select>
  </label>;
}
