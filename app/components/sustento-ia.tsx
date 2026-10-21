"use client";

import { useState } from "react";
import { Loader, Sparkles } from "lucide-react";
import type { CampoSustento } from "@/lib/sustento-ia";

/**
 * Botón que pide a la IA un BORRADOR de sustento y lo enseña para que la persona
 * lo lea y decida.
 *
 * Nunca escribe en el campo por su cuenta: el texto aparece en una caja aparte y
 * solo se aplica al pulsar "Usar este texto". Es el mismo trato que el resto de
 * la app da a lo sugerido (el sustento del evaluador, las fechas calculadas, los
 * campos que se leen del requerimiento) — y aquí importa más que en ningún otro
 * sitio, porque esto va a un documento que alguien firma.
 */
export function SustentoIA({
  processId,
  campo,
  detalle,
  actual,
  base,
  onUsar,
  disabled,
}: {
  processId: string;
  campo: CampoSustento;
  /** El factor o el punto concreto que se sustenta. */
  detalle?: string;
  /** Lo que ya hay escrito, para avisar de que se va a reemplazar. */
  actual?: string;
  /** Borrador de partida (plantilla sugerida): la IA lo mejora en vez de partir de cero. */
  base?: string;
  onUsar: (texto: string) => void;
  disabled?: boolean;
}) {
  const [cargando, setCargando] = useState(false);
  const [borrador, setBorrador] = useState("");
  const [citaNorma, setCitaNorma] = useState(false);
  const [error, setError] = useState("");

  async function pedir() {
    setCargando(true);
    setError("");
    setBorrador("");
    try {
      const res = await fetch(`/api/processes/${processId}/sustento`, {
        body: JSON.stringify({ campo, detalle, base }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error ?? "No se pudo redactar el borrador.");
        return;
      }
      setBorrador(payload.borrador ?? "");
      setCitaNorma(payload.citaNorma === true);
    } catch {
      setError("No se pudo conectar para redactar el borrador.");
    } finally {
      setCargando(false);
    }
  }

  if (disabled) return null;

  return (
    <div className="sustentoIA">
      {!borrador ? (
        <button
          className="secondaryButton compactButton"
          disabled={cargando}
          onClick={pedir}
          title={
            base?.trim()
              ? "La IA parte del borrador sugerido y lo concreta a este expediente. Tú lo revisas y decides."
              : "La IA redacta un primer borrador con los datos ya registrados en el expediente. Tú lo revisas y decides."
          }
          type="button"
        >
          {cargando ? <Loader size={13} /> : <Sparkles size={13} />}
          {cargando ? " Redactando…" : base?.trim() ? " Mejorar borrador con IA" : " Proponer un borrador con IA"}
        </button>
      ) : null}

      {error ? <small className="pasoFieldHelp sustentoIAError">{error}</small> : null}

      {borrador ? (
        <div className="sustentoIABorrador">
          <div className="sustentoIAHead">
            <Sparkles size={13} /> Borrador de la IA — revísalo antes de usarlo
          </div>
          <p className="sustentoIATexto">{borrador}</p>
          {/* Se le prohíbe citar normas porque las citas del expediente salen de
              código. Si se coló una, hay que mirarla: una cita inventada en un
              documento firmado es el peor resultado posible de esta función. */}
          {citaNorma ? (
            <small className="pasoFieldHelp sustentoIAError">
              ⚠ El borrador menciona una norma o un artículo. Verifícalo: la IA no debería citar y
              puede haberlo inventado.
            </small>
          ) : null}
          <div className="sustentoIAAcciones">
            <button
              className="secondaryButton compactButton"
              onClick={() => {
                onUsar(borrador);
                setBorrador("");
              }}
              type="button"
            >
              {actual?.trim() ? "Reemplazar lo escrito" : "Usar este texto"}
            </button>
            <button className="secondaryButton compactButton" onClick={() => void pedir()} type="button">
              Otra propuesta
            </button>
            <button className="secondaryButton compactButton" onClick={() => setBorrador("")} type="button">
              Descartar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
