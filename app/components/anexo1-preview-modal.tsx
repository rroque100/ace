"use client";

import { useEffect, useState } from "react";
import { CheckSquare, FileSpreadsheet, Loader } from "lucide-react";
import type { CeldaPreview } from "@/lib/fase1-export";
import { HojaPreview } from "./hoja-preview";
import { ModalShell } from "./modal-shell";

type Preview = {
  hoja: { titulo: string; filas: CeldaPreview[][] };
  marcas: { celda: string; etiqueta: string }[];
  sustentoIndagacion: string;
  sustentoConsulta: string;
  fecha: string;
  responsable: string;
};

/**
 * Vista previa del Anexo N° 1 antes de descargarlo.
 *
 * Lo que muestra sale del mismo `llenarAnexo1` que escribe el .xlsx, así que
 * revisar aquí equivale a revisar el archivo. Sirve para cazar lo que ACE no
 * puede: una sección que no debía marcarse, un sustento a medias, un proveedor
 * que falta.
 */
export function Anexo1PreviewModal({
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
        const r = await fetch(`/api/processes/${processId}/fase1/anexo1-preview`);
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

  // Cerrar con Escape: es un modal, y atrapar al usuario dentro es de mala educación.
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
      titulo="Vista previa · Anexo N° 1"
    >
          {error ? (
            <p className="formError">{error}</p>
          ) : !preview ? (
            <p className="anexo1PreviewCargando">
              <Loader className="spinIcon" size={14} /> Generando la vista previa…
            </p>
          ) : (
            <>
              <section>
                <h4>Así se exportará</h4>
                <HojaPreview filas={preview.hoja.filas} />
              </section>

              <section>
                <h4>Casillas que se marcarán</h4>
                {preview.marcas.length === 0 ? (
                  <p className="anexo1PreviewVacio">
                    Ninguna. Revisa el nivel de interacción y las fuentes o herramientas en A5: el
                    formato saldría sin una sola marca.
                  </p>
                ) : (
                  <ul className="anexo1PreviewMarcas">
                    {preview.marcas.map((m) => (
                      <li key={m.celda}>
                        <CheckSquare size={13} /> {m.etiqueta}
                        <code>{m.celda}</code>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h4>Sustento · INDAGACIÓN</h4>
                <pre className="anexo1PreviewTexto">{preview.sustentoIndagacion || "(vacío)"}</pre>
              </section>

              <section>
                <h4>Sustento · CONSULTA AL MERCADO</h4>
                <pre className="anexo1PreviewTexto">{preview.sustentoConsulta || "(vacío)"}</pre>
              </section>

              <section>
                <h4>Pie</h4>
                <p className="anexo1PreviewPie">
                  Fecha de elaboración: <strong>{preview.fecha || "—"}</strong>
                  <br />
                  Responsable de la DEC: <strong>{preview.responsable || "— sin registrar —"}</strong>
                </p>
              </section>
            </>
          )}
    </ModalShell>
  );
}
