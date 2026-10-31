"use client";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../hooks/use-theme";

// Un solo interruptor, no icono + desplegable. Con solo dos estados (claro y
// oscuro) la píldora con icono y el <select> al lado se leían como dos controles
// distintos para lo mismo y confundían; un botón que alterna es inequívoco.
// Mostramos el icono del modo al que se va a cambiar, igual que el conmutador
// del archivo de expedientes, para que el app sea coherente.
export function AppearanceControl() {
  const { resolved, toggle } = useTheme();
  const esOscuro = resolved === "dark";
  const accion = esOscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={accion}
      title={accion}
      className="tw inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-line bg-panel text-ink shadow-sm transition-colors hover:border-brand hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/15"
    >
      {esOscuro ? <Sun size={17} aria-hidden /> : <Moon size={17} aria-hidden />}
    </button>
  );
}
