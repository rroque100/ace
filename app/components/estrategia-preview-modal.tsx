"use client";

import { useEffect, useState } from "react";
import { FileSpreadsheet, Loader } from "lucide-react";
import type { CeldaPreview } from "@/lib/fase1-export";
import { HojaPreview } from "./hoja-preview";
import { ModalShell } from "./modal-shell";

type Preview = {
  hoja: { titulo: string; filas: CeldaPreview[][]; anchos: number[] };
  marcas: { celda: string; etiqueta: string }[];
  sustentos: { titulo: string; texto: string }[];
  sinResponder: string[];
};

/**
 * Vista previa del Formato de Estrategia (A4) antes de descargarlo.
 *
 * Mismo patrón que el Anexo N° 1: lo que muestra sale de `llenarEstrategia`, el
 * mismo código que escribe el .xlsx, así que revisar aquí equivale a revisar el
 * archivo. En un formato de ~20 variables es donde más falta hace ver de un
 * vistazo qué se marcaría y qué se quedaría en blanco.
 */
export function EstrategiaPreviewModal({
  processId,
  onClose,
  onDescargar,
}: {
  processId: string;
  onClose: () => void;
  onDescargar: () => void;
}) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const r = await fetch(`/api/processes/${processId}/fase1/estrategia-preview`);
        const data = await r.json();
        if (!vivo) return;
        if (!r.ok) setError(data.error ?? "No se pudo generar la vista previa.");
        else setPreview(data);
      } catch {
        if (vivo) setError("No se pudo conectar con el servidor.");
      }
    })();
    return () => {
      vivo = false;
    };
  }, [processId]);

  // Escape, foco atrapado e id del título los aporta ModalShell (Radix).

  return (
    <ModalShell
      acciones={
        <>
          <button
            className="primaryButton compactButton"
            disabled={!preview}
            onClick={() => {
              onDescargar();
              onClose();
            }}
            type="button"
          >
            <FileSpreadsheet size={14} /> Descargar Excel
          </button>
          <button className="secondaryButton compactButton" onClick={onClose} type="button">
            Volver a editar
          </button>
        </>
      }
      claseTarjeta="anexo1Preview"
      onClose={onClose}
      titulo="Vista previa · Formato de Estrategia"
    >
          {error ? (
            <p className="formError">{error}</p>
          ) : !preview ? (
            <p className="anexo1PreviewCargando">
              <Loader className="spinIcon" size={14} /> Generando la vista previa…
            </p>
          ) : (
            <>
              {/* La vista previa ES la hoja tal y como se exporta: mismas
                  celdas, combinaciones, marcas y orden que el Formato de
                  Estrategia en Excel. Se resalta lo que ACE rellena. Antes se
                  repetía la información en listas aparte (marcas, sustentos),
                  que rompían la organización del formato. */}
              <section>
                <h4>Vista previa del Formato de Estrategia (como se exportará)</h4>
                <HojaPreview anchos={preview.hoja.anchos} filas={preview.hoja.filas} />
              </section>

              {preview.sinResponder.length > 0 ? (
                <section>
                  <h4>Ojo · preguntas sin responder ({preview.sinResponder.length})</h4>
                  <p className="anexo1PreviewVacio">
                    Estas preguntas SÍ/NO saldrían con las dos casillas en blanco, que no significa
                    “no”: significa “sin analizar”. En el formato firmado por la entidad están todas
                    marcadas.
                  </p>
                  <ul className="anexo1PreviewMarcas">
                    {preview.sinResponder.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          )}
    </ModalShell>
  );
}
