"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

export type OficinaOpcion = {
  id: string;
  nombre: string;
  // Opcionales: el combobox no los usa, pero vienen en /api/oficinas y el
  // Informe de Segmentación los necesita para proponer el PARA/DE.
  responsable_nombre?: string | null;
  responsable_cargo?: string | null;
  /** La oficina marcada en Configuración como la que gestiona contrataciones (la DEC). */
  gestiona_contrataciones?: boolean | null;
};

function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// Combobox con búsqueda sobre el catálogo de oficinas.
// - Estricto (por defecto): el valor comprometido es el nombre exacto de una
//   oficina existente o vacío; el texto que no coincide se revierte al salir.
// - allowFreeText: además admite texto libre (útil para áreas no registradas);
//   lo escrito se conserva tal cual si no coincide con ninguna oficina.
export function OficinaCombobox({
  oficinas,
  value,
  onChange,
  placeholder = "Buscar oficina…",
  allowFreeText = false,
}: {
  oficinas: OficinaOpcion[];
  value: string;
  onChange: (nombre: string) => void;
  placeholder?: string;
  allowFreeText?: boolean;
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [activo, setActivo] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  // Mantiene el input sincronizado si el valor comprometido cambia desde fuera.
  useEffect(() => {
    setQuery(value);
  }, [value]);

  const filtradas = useMemo(() => {
    const q = normalizar(query);
    if (!q) return oficinas;
    return oficinas.filter((o) => normalizar(o.nombre).includes(q));
  }, [oficinas, query]);

  // Confirma una selección válida (o vacío) y cierra.
  function commit(nombre: string) {
    onChange(nombre);
    setQuery(nombre);
    setOpen(false);
  }

  // Al salir: si coincide exactamente con una oficina, la usa. Si no, conserva
  // el texto libre (allowFreeText) o revierte al último valor válido (estricto).
  function enforceStrict() {
    const exacta = oficinas.find((o) => normalizar(o.nombre) === normalizar(query));
    if (exacta) {
      commit(exacta.nombre);
      return;
    }
    if (allowFreeText) {
      commit(query.trim());
      return;
    }
    commit(value && oficinas.some((o) => o.nombre === value) ? value : "");
  }

  // Cierra al hacer clic fuera.
  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        enforceStrict();
      }
    }
    if (open) document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query, value, oficinas]);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActivo((i) => Math.min(i + 1, filtradas.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActivo((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && filtradas[activo]) commit(filtradas[activo].nombre);
    } else if (e.key === "Escape") {
      enforceStrict();
    }
  }

  return (
    <div className="ofcbx" ref={rootRef}>
      <div className="ofcbxField">
        <Search size={14} className="ofcbxIcon" />
        <input
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActivo(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          type="text"
          value={query}
        />
        <ChevronDown size={14} className="ofcbxChevron" />
      </div>
      {open ? (
        <ul className="ofcbxList" role="listbox">
          {filtradas.length === 0 ? (
            allowFreeText && query.trim() ? (
              <li
                className="ofcbxOption"
                onMouseDown={(e) => {
                  e.preventDefault();
                  commit(query.trim());
                }}
                role="option"
              >
                <span>Usar “{query.trim()}”</span>
              </li>
            ) : (
              <li className="ofcbxEmpty">Sin coincidencias</li>
            )
          ) : (
            filtradas.map((o, i) => (
              <li
                aria-selected={o.nombre === value}
                className={`ofcbxOption ${i === activo ? "activo" : ""}`}
                key={o.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  commit(o.nombre);
                }}
                onMouseEnter={() => setActivo(i)}
                role="option"
              >
                <span>{o.nombre}</span>
                {o.nombre === value ? <Check size={14} /> : null}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
