"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { memo, useState, useEffect, useRef, useMemo } from "react";
import {
  Search,
  X,
  UploadCloud,
  FileText,
  HelpCircle,
  Download,
  MessageCircle,
} from "lucide-react";
import type { ExpedienteItem } from "./types";
import { cn } from "@/lib/utils";

export type CommandAction = {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  shortcut?: string;
  onSelect: () => void;
  group: "expedientes" | "acciones";
};

type Props = {
  open: boolean;
  onClose: () => void;
  expedientes: ExpedienteItem[];
  onOpenExpediente: (exp: ExpedienteItem) => void;
  onGoToSubir: () => void;
  onShowHelp: () => void;
  onOpenChat: () => void;
};

export const CommandPalette = memo(function CommandPalette({
  open,
  onClose,
  expedientes,
  onOpenExpediente,
  onGoToSubir,
  onShowHelp,
  onOpenChat,
}: Props) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);


  const baseActions: CommandAction[] = useMemo(
    () => [
      {
        id: "go-subir",
        label: "Ir a Subir expediente",
        description: "Abre la pestaña para subir un nuevo PDF",
        icon: <UploadCloud size={16} />,
        shortcut: "Ctrl+U",
        onSelect: () => {
          onGoToSubir();
          onClose();
        },
        group: "acciones",
      },
      {
        id: "open-chat",
        label: "Abrir chat con IA",
        description: "Panel lateral para conversación multi-turno",
        icon: <MessageCircle size={16} />,
        shortcut: "Ctrl+I",
        onSelect: () => {
          onOpenChat();
          onClose();
        },
        group: "acciones",
      },
      {
        id: "export-csv",
        label: "Exportar inventario CSV",
        description: "Descarga todos los expedientes filtrados",
        icon: <Download size={16} />,
        onSelect: () => {
          window.open("/api/expedientes-archivo/export?formato=csv", "_blank");
          onClose();
        },
        group: "acciones",
      },
      {
        id: "show-help",
        label: "Ver atajos de teclado",
        description: "Abre la lista de atajos disponibles",
        icon: <HelpCircle size={16} />,
        shortcut: "?",
        onSelect: () => {
          onShowHelp();
          onClose();
        },
        group: "acciones",
      },
    ],
    [onGoToSubir, onOpenChat, onShowHelp, onClose],
  );

  const expedienteResults: CommandAction[] = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const matches = expedientes
      .filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          (e.materia ?? "").toLowerCase().includes(q) ||
          (e.oficina ?? "").toLowerCase().includes(q) ||
          (e.asunto ?? "").toLowerCase().includes(q) ||
          (e.serie_documento ?? "").toLowerCase().includes(q) ||
          String(e.anio ?? "").includes(q),
      )
      .slice(0, 8)
      .map<CommandAction>((e) => ({
        id: `exp-${e.id}`,
        label: e.title,
        description: [
          e.anio ? `${e.anio}` : null,
          e.oficina,
          e.materia,
          e.status,
        ]
          .filter(Boolean)
          .join(" · "),
        icon: <FileText size={16} />,
        onSelect: () => {
          onOpenExpediente(e);
          onClose();
        },
        group: "expedientes",
      }));
    return matches;
  }, [query, expedientes, onOpenExpediente, onClose]);

  const filteredActions: CommandAction[] = useMemo(() => {
    if (!query.trim()) return baseActions;
    const q = query.toLowerCase();
    return baseActions.filter(
      (a) => a.label.toLowerCase().includes(q) || (a.description ?? "").toLowerCase().includes(q),
    );
  }, [baseActions, query]);

  const allItems = [...expedienteResults, ...filteredActions];

  useEffect(() => {
    if (activeIndex >= allItems.length && allItems.length > 0) {
      setActiveIndex(0);
    }
  }, [allItems.length, activeIndex]);

  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-cmd-idx="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(allItems.length - 1, i + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = allItems[activeIndex];
      if (item) item.onSelect();
    }
    // Escape lo cierra Radix desde el contenedor.
  }

  if (!open) return null;

  // Radix aporta el foco atrapado, el bloqueo de scroll y el cierre con Escape;
  // el foco inicial se dirige al campo de búsqueda en lugar del primer botón.
  return (
    <Dialog.Root
      open
      onOpenChange={(abierto) => {
        if (!abierto) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="tw fixed inset-0 z-[200] flex animate-exp-fade-in justify-center bg-[rgba(15,23,42,0.55)] pt-[10vh] backdrop-blur-[4px]" />
        <Dialog.Content
          aria-label="Búsqueda rápida"
          className="tw fixed inset-x-0 top-[10vh] z-[201] mx-auto flex max-h-[70vh] w-[min(640px,92vw)] animate-exp-pop-in flex-col overflow-hidden rounded-exp-lg bg-exp-panel shadow-[0_30px_80px_rgba(15,23,42,0.30)]"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
        >
        <div className="flex items-center gap-2.5 border-b border-exp-line bg-exp-panel px-4 py-3.5 [&>svg]:shrink-0 [&>svg]:text-exp-muted">
          <Search size={18} />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Busca un expediente o una acción…"
            className="flex-1 border-0 bg-transparent py-1 text-[15px] text-exp-ink outline-none placeholder:text-exp-muted"
            aria-label="Búsqueda rápida"
          />
          <kbd className="text-[11px] text-exp-muted">Esc</kbd>
        </div>
        <ul className="m-0 flex-1 list-none overflow-auto py-1.5" ref={listRef}>
          {allItems.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-exp-muted">
              Sin resultados para &ldquo;{query}&rdquo;
            </li>
          ) : (
            <>
              {expedienteResults.length > 0 ? (
                <li className="px-4 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.6px] text-exp-muted" aria-hidden="true">
                  Expedientes ({expedienteResults.length})
                </li>
              ) : null}
              {expedienteResults.map((item, idx) => (
                <li
                  key={item.id}
                  data-cmd-idx={idx}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 border-l-[3px] px-4 py-2.5 text-sm text-exp-ink transition-colors duration-75 ease-linear [&>svg]:shrink-0 [&>svg]:text-exp-brand",
                    idx === activeIndex ? "border-l-exp-brand bg-exp-brand-soft" : "border-l-transparent",
                    "hover:border-l-exp-brand hover:bg-exp-brand-soft",
                  )}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={item.onSelect}
                >
                  {item.icon}
                  <div className="min-w-0 flex-1">
                    <strong className="block truncate font-semibold">{item.label}</strong>
                    {item.description ? (
                      <span className="block truncate text-xs text-exp-muted">{item.description}</span>
                    ) : null}
                  </div>
                </li>
              ))}
              {filteredActions.length > 0 ? (
                <li className="px-4 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.6px] text-exp-muted" aria-hidden="true">
                  Acciones
                </li>
              ) : null}
              {filteredActions.map((item, idx) => {
                const realIdx = expedienteResults.length + idx;
                return (
                  <li
                    key={item.id}
                    data-cmd-idx={realIdx}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 border-l-[3px] px-4 py-2.5 text-sm text-exp-ink transition-colors duration-75 ease-linear [&>svg]:shrink-0 [&>svg]:text-exp-brand",
                      realIdx === activeIndex ? "border-l-exp-brand bg-exp-brand-soft" : "border-l-transparent",
                      "hover:border-l-exp-brand hover:bg-exp-brand-soft",
                    )}
                    onMouseEnter={() => setActiveIndex(realIdx)}
                    onClick={item.onSelect}
                  >
                    {item.icon}
                    <div className="min-w-0 flex-1">
                      <strong className="block truncate font-semibold">{item.label}</strong>
                      {item.description ? (
                        <span className="block truncate text-xs text-exp-muted">{item.description}</span>
                      ) : null}
                    </div>
                    {item.shortcut ? (
                      <span className="inline-flex shrink-0 gap-0.5">
                        {item.shortcut.split("+").map((k, i) => (
                          <kbd
                            key={i}
                            className="min-w-[18px] rounded border border-exp-line bg-exp-panel px-1.5 py-0.5 text-center font-mono text-[11px] font-semibold text-exp-brand"
                          >
                            {k.trim()}
                          </kbd>
                        ))}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </>
          )}
        </ul>
        <div className="flex items-center gap-3.5 border-t border-exp-line bg-exp-line-soft px-4 py-2 text-[11px] text-exp-muted [&_kbd]:mr-0.5 [&_kbd]:rounded-[3px] [&_kbd]:border [&_kbd]:border-exp-line [&_kbd]:bg-exp-panel [&_kbd]:px-[5px] [&_kbd]:py-px [&_kbd]:font-mono [&_kbd]:text-[10px]">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> navegar
          </span>
          <span>
            <kbd>Enter</kbd> seleccionar
          </span>
          <span>
            <kbd>Esc</kbd> cerrar
          </span>
          <span className="ml-auto inline-flex items-center gap-1">
            <X size={12} /> Click fuera
          </span>
        </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
});
