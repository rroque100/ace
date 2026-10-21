"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Folder, Loader2, Search, X } from "lucide-react";
import { searchLegajos } from "@/lib/expedientes-archivo-actions";
import type { ExpedienteLegajoItem } from "./types";
import {
  EXP_FIELD,
  EXP_FIELD_CONTROL,
  EXP_FIELD_LABEL,
  EXP_HELP_TEXT,
  EXP_LIST,
  EXP_LIST_ITEM,
  EXP_LIST_ITEM_ACTIONS,
  EXP_LIST_ITEM_BODY,
  EXP_LIST_ITEM_ICON,
  EXP_LIST_ITEM_META,
  EXP_LIST_ITEM_TITLE,
  EXP_SPIN,
  expBtnClass,
} from "./estilos";
import { cn } from "@/lib/utils";

function etiquetaLegajo(l: ExpedienteLegajoItem): string {
  return l.serie_documento || l.sgd_expediente || l.asunto || "Expediente sin identificar";
}

/**
 * Elige si el PDF que se está subiendo abre un expediente NUEVO (de siempre)
 * o se ADJUNTA a uno YA EXISTENTE (folio nuevo dentro del mismo legajo). No
 * cambia nada más del wizard: los campos de identificación del paso 1 se
 * siguen llenando igual y se guardan en el documento aunque se adjunte a un
 * expediente existente (ver Global Constraints del plan de esta fase).
 */
export function LegajoPicker({
  selected,
  onSelect,
}: {
  selected: ExpedienteLegajoItem | null;
  onSelect: (legajo: ExpedienteLegajoItem | null) => void;
}) {
  const [modo, setModo] = useState<"nuevo" | "existente">(selected ? "existente" : "nuevo");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ExpedienteLegajoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // El toggle vuelve a "nuevo" cada vez que `selected` se limpia — sea porque
  // el padre reseteó el wizard entero (cancelar/subir con éxito, sin que este
  // componente llegara a desmontarse si el usuario se quedó en el paso 1) o
  // porque el propio "Quitar" lo deselecciona. Sin esto, un reset externo con
  // el componente montado dejaba el botón marcado en "Añadir a uno existente"
  // con el buscador vacío en vez de volver al estado inicial.
  useEffect(() => {
    if (!selected) setModo("nuevo");
  }, [selected]);

  // Debounce 250ms, igual que el resto de buscadores del módulo
  // (ver BibliotecaSelector en respuesta/biblioteca-selector.tsx).
  useEffect(() => {
    if (modo !== "existente" || selected) return;
    setLoading(true);
    const timeout = setTimeout(() => {
      void searchLegajos(query, 8)
        .then((data) => setResults(data.legajos))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timeout);
  }, [modo, query, selected]);

  useEffect(() => {
    if (modo === "existente" && !selected) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [modo, selected]);

  return (
    <div className={EXP_FIELD}>
      <label className={EXP_FIELD_LABEL}>¿A qué expediente pertenece?</label>
      <div className="flex gap-2">
        <button
          type="button"
          className={expBtnClass(modo === "nuevo" ? "primary" : "ghost", "small")}
          onClick={() => {
            setModo("nuevo");
            onSelect(null);
          }}
        >
          Expediente nuevo
        </button>
        <button
          type="button"
          className={expBtnClass(modo === "existente" ? "primary" : "ghost", "small")}
          onClick={() => setModo("existente")}
        >
          Añadir a uno existente
        </button>
      </div>

      {modo === "existente" ? (
        selected ? (
          <div className={cn(EXP_LIST_ITEM, "mt-2")}>
            <div className={EXP_LIST_ITEM_ICON}>
              <Folder size={16} />
            </div>
            <div className={EXP_LIST_ITEM_BODY}>
              <p className={EXP_LIST_ITEM_TITLE}>{etiquetaLegajo(selected)}</p>
              <div className={EXP_LIST_ITEM_META}>
                {selected.anio ? <span>{selected.anio}</span> : null}
                {selected.oficina ? <span>· {selected.oficina}</span> : null}
                <span>
                  · {selected.documentos_count} documento{selected.documentos_count === 1 ? "" : "s"}
                </span>
              </div>
            </div>
            <div className={EXP_LIST_ITEM_ACTIONS}>
              <button
                type="button"
                className={expBtnClass("ghost", "small")}
                onClick={() => onSelect(null)}
                aria-label="Quitar expediente seleccionado"
              >
                <X size={13} /> Quitar
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-2 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Search size={14} className="shrink-0 text-exp-muted" aria-hidden="true" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por SGD, serie o asunto…"
                className={EXP_FIELD_CONTROL}
              />
            </div>
            {loading ? (
              <span className={EXP_HELP_TEXT}>
                <Loader2 size={12} className={EXP_SPIN} /> Buscando expedientes…
              </span>
            ) : results.length === 0 ? (
              <span className={EXP_HELP_TEXT}>
                {query.trim().length > 0 && query.trim().length < 2
                  ? "Escribe al menos 2 caracteres"
                  : "Sin expedientes que coincidan"}
              </span>
            ) : (
              <ul className={cn(EXP_LIST, "list-none p-0")}>
                {results.map((legajo) => (
                  <li key={legajo.id}>
                    <button
                      type="button"
                      className={cn(EXP_LIST_ITEM, "w-full text-left")}
                      onClick={() => onSelect(legajo)}
                    >
                      <div className={EXP_LIST_ITEM_ICON}>
                        <Folder size={16} />
                      </div>
                      <div className={EXP_LIST_ITEM_BODY}>
                        <p className={EXP_LIST_ITEM_TITLE}>{etiquetaLegajo(legajo)}</p>
                        <div className={EXP_LIST_ITEM_META}>
                          {legajo.anio ? <span>{legajo.anio}</span> : null}
                          {legajo.oficina ? <span>· {legajo.oficina}</span> : null}
                          <span>
                            · {legajo.documentos_count} documento{legajo.documentos_count === 1 ? "" : "s"}
                          </span>
                        </div>
                      </div>
                      <div className={EXP_LIST_ITEM_ACTIONS}>
                        <Check size={14} className="text-exp-muted" />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      ) : (
        <span className={EXP_HELP_TEXT}>
          Se creará un expediente nuevo con los datos de este documento.
        </span>
      )}
    </div>
  );
}
