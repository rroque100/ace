"use client";

import { useEffect, useState } from "react";
import { FileSpreadsheet, Loader } from "lucide-react";
import type { CeldaPreview } from "@/lib/fase1-export";
import { HojaPreview } from "./hoja-preview";
import { ModalShell } from "./modal-shell";

type Preview = { hoja: { titulo: string; filas: CeldaPreview[][]; anchos: number[] } };

/**
 * Vista previa del Anexo N° 2 (aprobación del expediente, A8) antes de
 * descargarlo.
 *
 * Muestra la hoja tal cual, con las MISMAS celdas y combinaciones que el .xlsx:
 * sale de `llenarAnexo2`, el mismo código que escribe el archivo. A diferencia
 * de la del Anexo N° 1, aquí no hay "casillas que se marcarán" ni sustentos —el
 * Anexo N° 2 es una hoja de datos, no de marcas—, así que se enseña la hoja y ya.
 */
export function Anexo2PreviewModal({
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
        const r = await fetch(`/api/processes/${processId}/fase1/anexo2-preview`);
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

  // El cierre con Escape, el foco atrapado y el id del título los aporta
  // ModalShell (Radix); antes había aquí un `useEffect` propio solo para Escape.
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
      titulo="Vista previa · Anexo N° 2"
    >
      {error ? (
        <p className="formError">{error}</p>
      ) : !preview ? (
        <p className="anexo1PreviewCargando">
          <Loader className="spinIcon" size={14} /> Generando la vista previa…
        </p>
      ) : (
        <section>
          <h4>Así se exportará</h4>
          <HojaPreview anchos={preview.hoja.anchos} filas={preview.hoja.filas} />
        </section>
      )}
    </ModalShell>
  );
}
