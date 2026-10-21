"use client";

import { useEffect, useRef, useState } from "react";
import { ClipboardCheck, Loader } from "lucide-react";
import {
  ADMISIBILIDAD_ITEMS,
  type AdmisibilidadEstado,
  contarAdmisibilidad,
} from "@/lib/necesidad-admisibilidad";

/**
 * Checklist de admisibilidad de la DEC (P3). La DEC marca los puntos del Art. 44
 * que verifica antes de dar conforme; queda registrado por necesidad. Es un
 * APOYO trazable, no un candado: no bloquea el conforme.
 *
 * Autocontenido: lee y guarda su propio estado (endpoint /admisibilidad). El
 * área usuaria lo ve en solo lectura (qué revisó la DEC y con qué notas).
 */
export function AdmisibilidadDec({
  necesidadId,
  puedeEditar,
  inicial,
}: {
  necesidadId: string;
  puedeEditar: boolean;
  /** Estado sembrado por la carga combinada del detalle. Null mientras carga. */
  inicial: { items: AdmisibilidadEstado; actualizadoPor: string | null } | null;
}) {
  const [estado, setEstado] = useState<AdmisibilidadEstado>({});
  const [actualizadoPor, setActualizadoPor] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Siembra UNA vez desde la carga combinada del detalle (no hay fetch propio al
  // abrir). Solo la primera vez para no pisar lo que la DEC esté editando cuando
  // el detalle recargue por otra razón.
  const sembrado = useRef(false);
  useEffect(() => {
    if (!inicial || sembrado.current) return;
    sembrado.current = true;
    setEstado(inicial.items ?? {});
    setActualizadoPor(inicial.actualizadoPor ?? null);
    setCargando(false);
  }, [inicial]);

  // Guardado diferido (0,8 s): al marcar seguido no dispara en cada clic.
  function programarGuardado(next: AdmisibilidadEstado) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void guardar(next); }, 800);
  }

  async function guardar(next: AdmisibilidadEstado) {
    setGuardando(true);
    try {
      const r = await fetch(`/api/necesidades/${necesidadId}/admisibilidad`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: next }),
      });
      const d = await r.json().catch(() => null);
      if (r.ok && d?.actualizadoPor !== undefined) setActualizadoPor(d.actualizadoPor);
    } catch { /* se reintenta al siguiente cambio */ } finally {
      setGuardando(false);
    }
  }

  function alternar(key: string, ok: boolean) {
    if (!puedeEditar) return;
    const next = { ...estado, [key]: { ok, nota: estado[key]?.nota } };
    setEstado(next);
    programarGuardado(next);
  }

  function ponerNota(key: string, nota: string) {
    if (!puedeEditar) return;
    const next = { ...estado, [key]: { ok: estado[key]?.ok ?? false, nota } };
    setEstado(next);
    programarGuardado(next);
  }

  const { done, total } = contarAdmisibilidad(estado);
  const sinRegistro = !puedeEditar && done === 0 && Object.keys(estado).length === 0;

  return (
    <div className="admisPanel" data-completo={done === total}>
      <div className="admisHead">
        <ClipboardCheck size={16} aria-hidden />
        <h3 className="panelTitle">Admisibilidad (DEC)</h3>
        <span className="admisCount">{done}/{total}</span>
        {guardando ? <span className="admisGuardando"><Loader size={13} /> guardando…</span> : null}
        {!puedeEditar ? <span className="admisSoloLectura">solo lectura</span> : null}
      </div>

      {cargando ? (
        <p className="admisVacio">Cargando…</p>
      ) : sinRegistro ? (
        <p className="admisVacio">La DEC aún no registró su verificación de admisibilidad.</p>
      ) : (
        <ul className="admisLista">
          {ADMISIBILIDAD_ITEMS.map((item) => {
            const st = estado[item.key];
            const marcado = Boolean(st?.ok);
            return (
              <li className="admisItem" data-ok={marcado} key={item.key}>
                <label className="admisItemMarca">
                  <input
                    type="checkbox"
                    checked={marcado}
                    disabled={!puedeEditar}
                    onChange={(e) => alternar(item.key, e.target.checked)}
                  />
                  <span className="admisItemTexto">
                    {item.label}
                    <span className="admisItemBase">{item.baseLegal}</span>
                  </span>
                </label>
                {puedeEditar ? (
                  <input
                    className="admisItemNota"
                    type="text"
                    maxLength={500}
                    placeholder="Nota (opcional)"
                    value={st?.nota ?? ""}
                    onChange={(e) => ponerNota(item.key, e.target.value)}
                  />
                ) : st?.nota ? (
                  <span className="admisItemNotaRO">{st.nota}</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {actualizadoPor && !sinRegistro ? (
        <p className="admisPie">Última actualización por {actualizadoPor}.</p>
      ) : null}
    </div>
  );
}
