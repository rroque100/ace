"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Search } from "lucide-react";
import type { Personal } from "@/lib/personal";

/**
 * Buscador de personas contra el padrón (`/api/configuracion/personal`). Es un
 * typeahead: se escribe y ofrece coincidencias por nombre, DNI, código o unidad;
 * al elegir una, `onSelect` recibe la persona completa para autollenar los campos
 * (nombre, DNI, unidad…). Se puede seguir escribiendo un nombre libre que no esté
 * en el padrón —`onText` lo refleja—, para no bloquear a quien no figura aún.
 *
 * Autónomo y sin dependencias de estilo: usa las variables de tema de styles.css
 * (--panel, --line, --ink, --muted, --brand) para verse igual dentro y fuera de
 * los contenedores Tailwind.
 */
export function PersonaPicker({
  value,
  onText,
  onSelect,
  disabled,
  placeholder,
  ariaLabel,
  soloActivos = true,
  mostrarUnidad = true,
}: {
  value: string;
  /** Texto libre (el usuario teclea un nombre que quizá no esté en el padrón). */
  onText: (nombre: string) => void;
  /** Eligió a alguien del padrón: la persona completa para autollenar. */
  onSelect: (persona: Personal) => void;
  disabled?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  soloActivos?: boolean;
  /** Mostrar la unidad (nombre_cc) en la línea de detalle. A6 no la necesita. */
  mostrarUnidad?: boolean;
}) {
  const [q, setQ] = useState(value);
  const [abierto, setAbierto] = useState(false);
  const [resultados, setResultados] = useState<Personal[]>([]);
  const [activo, setActivo] = useState(-1);
  const [buscando, setBuscando] = useState(false);
  const cajaRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  // El input sigue al valor de fuera cuando cambia por otra vía (auto-relleno).
  useEffect(() => {
    setQ(value);
  }, [value]);

  // Búsqueda con retardo; solo mientras el desplegable está abierto (hay foco).
  useEffect(() => {
    if (!abierto) return;
    const term = q.trim();
    if (term.length < 2) {
      setResultados([]);
      return;
    }
    let vivo = true;
    setBuscando(true);
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: term, limit: "8" });
        if (soloActivos) params.set("estado", "activos");
        const r = await fetch(`/api/configuracion/personal?${params.toString()}`, { cache: "no-store" });
        const d = await r.json();
        if (!vivo) return;
        setResultados(Array.isArray(d.personal) ? d.personal : []);
        setActivo(-1);
      } catch {
        if (vivo) setResultados([]);
      } finally {
        if (vivo) setBuscando(false);
      }
    }, 220);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [q, abierto, soloActivos]);

  // Cerrar al hacer clic fuera.
  useEffect(() => {
    function alClic(e: MouseEvent) {
      if (cajaRef.current && !cajaRef.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", alClic);
    return () => document.removeEventListener("mousedown", alClic);
  }, []);

  function elegir(p: Personal) {
    onSelect(p);
    setQ(p.nombreCompleto);
    setAbierto(false);
    setResultados([]);
  }

  function alTeclado(e: React.KeyboardEvent) {
    if (!abierto && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setAbierto(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActivo((a) => Math.min(a + 1, resultados.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActivo((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && activo >= 0 && resultados[activo]) {
      e.preventDefault();
      elegir(resultados[activo]);
    } else if (e.key === "Escape") {
      setAbierto(false);
    }
  }

  return (
    <div ref={cajaRef} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <Search
          size={13}
          aria-hidden
          style={{
            position: "absolute",
            left: 7,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--muted)",
            pointerEvents: "none",
          }}
        />
        <input
          aria-label={ariaLabel}
          aria-autocomplete="list"
          aria-controls={abierto ? listId : undefined}
          aria-expanded={abierto}
          role="combobox"
          disabled={disabled}
          placeholder={placeholder ?? "Buscar en el padrón o escribir…"}
          style={{ paddingLeft: 24 }}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            onText(e.target.value);
            if (!abierto) setAbierto(true);
          }}
          onFocus={() => setAbierto(true)}
          onKeyDown={alTeclado}
        />
      </div>

      {abierto && (buscando || resultados.length > 0) ? (
        <ul
          id={listId}
          role="listbox"
          style={{
            position: "absolute",
            zIndex: 30,
            top: "calc(100% + 2px)",
            left: 0,
            right: 0,
            margin: 0,
            padding: 4,
            listStyle: "none",
            maxHeight: 240,
            overflowY: "auto",
            background: "var(--panel)",
            border: "1px solid var(--line)",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          }}
        >
          {buscando && resultados.length === 0 ? (
            <li style={{ padding: "6px 8px", fontSize: 12, color: "var(--muted)" }}>Buscando…</li>
          ) : (
            resultados.map((p, i) => (
              <li key={p.codigo} role="option" aria-selected={i === activo}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    elegir(p);
                  }}
                  onMouseEnter={() => setActivo(i)}
                  style={{
                    display: "grid",
                    width: "100%",
                    textAlign: "left",
                    gap: 1,
                    padding: "6px 8px",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                    background: i === activo ? "var(--brand-soft, rgba(0,0,0,0.05))" : "transparent",
                    color: "var(--ink)",
                    font: "inherit",
                  }}
                >
                  <span style={{ fontSize: 12.5, fontWeight: 600 }}>{p.nombreCompleto}</span>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>
                    {[
                      p.documento ? `DNI ${p.documento}` : null,
                      mostrarUnidad ? p.unidad : null,
                      p.profesion,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
