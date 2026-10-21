"use client";

import { useEffect, useState } from "react";
import { FileSpreadsheet, Loader } from "lucide-react";
import type { CeldaPreview } from "@/lib/fase1-export";
import { HojaPreview } from "./hoja-preview";
import { ModalShell } from "./modal-shell";

type Preview = { titulo: string; filas: CeldaPreview[][] };

/**
 * Vista previa de la "Solicitud de propuesta de miembros del Comité de Selección"
 * (A6) antes de descargarla. Muestra la MISMA hoja que se exporta —celdas,
 * combinaciones y marcas— para revisar el formato antes de generar el .xlsx.
 */
export function ComitePreviewModal({
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
        const r = await fetch(`/api/processes/${processId}/fase1/solicitud-comite-preview`);
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
      claseTarjeta="certificacionPreview"
      onClose={onClose}
      titulo="Vista previa · Solicitud de comité"
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
          <HojaPreview filas={preview.filas} />
        </section>
      )}
    </ModalShell>
  );
}
