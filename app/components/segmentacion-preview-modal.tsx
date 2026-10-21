"use client";

import { useEffect, useState } from "react";
import { FileText, Loader } from "lucide-react";
import type { BloqueDocx, ParrafoDocx } from "@/lib/docx-a-bloques";
import { ModalShell } from "./modal-shell";

/**
 * Vista previa del Informe de Segmentación (A2) antes de descargarlo.
 *
 * Lo que muestra se LEE del mismo .docx que se descarga —el endpoint genera el
 * archivo y lo lee de vuelta—, con la misma tipografía, alineación, negritas,
 * cursivas, subrayados y tablas (matriz, cronograma). No es una segunda
 * composición: es el archivo.
 */
export function SegmentacionPreviewModal({
  processId,
  onClose,
  onDescargar,
}: {
  processId: string;
  onClose: () => void;
  onDescargar: () => void;
}) {
  const [bloques, setBloques] = useState<BloqueDocx[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const r = await fetch(`/api/processes/${processId}/fase1/segmentacion-preview`);
        const data = await r.json();
        if (!vivo) return;
        if (!r.ok) setError(data.error ?? "No se pudo generar la vista previa.");
        else setBloques(data.bloques ?? []);
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
            disabled={!bloques}
            onClick={() => {
              onDescargar();
              onClose();
            }}
            type="button"
          >
            <FileText size={14} /> Descargar Word
          </button>
          <button className="secondaryButton compactButton" onClick={onClose} type="button">
            Volver a editar
          </button>
        </>
      }
      claseTarjeta="informeAprobPreview"
      onClose={onClose}
      titulo="Vista previa · Informe de Segmentación"
    >
      {error ? (
        <p className="formError">{error}</p>
      ) : !bloques ? (
        <p className="anexo1PreviewCargando">
          <Loader className="spinIcon" size={14} /> Preparando la vista previa…
        </p>
      ) : (
        <div className="hojaInforme">
          {bloques.map((b, i) =>
            b.tipo === "tabla" ? <TablaVista key={i} tabla={b.tabla} /> : <ParrafoVista key={i} parrafo={b.parrafo} />,
          )}
        </div>
      )}
    </ModalShell>
  );
}

/** Una `<w:tbl>` tal como se leyó: cabecera sombreada, filas de datos debajo. */
function TablaVista({ tabla }: { tabla: Extract<BloqueDocx, { tipo: "tabla" }>["tabla"] }) {
  return (
    <table className="hojaTablaGrid">
      <tbody>
        {tabla.filas.map((fila, i) => (
          <tr key={i}>
            {fila.celdas.map((celda, j) => {
              const Tag = fila.cabecera ? "th" : "td";
              return (
                <Tag key={j}>
                  {celda.map((p, k) => (
                    <ParrafoVista key={k} parrafo={p} />
                  ))}
                </Tag>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Un párrafo del .docx tal como se leyó, con su alineación y sus énfasis. */
function ParrafoVista({ parrafo }: { parrafo: ParrafoDocx }) {
  // "both" es el justificado de Word; el resto son directos.
  const textAlign =
    parrafo.alineacion === "center"
      ? "center"
      : parrafo.alineacion === "right"
        ? "right"
        : parrafo.alineacion === "both"
          ? "justify"
          : "left";

  // Un párrafo sin texto es un espacio de la maqueta (línea de firma, salto):
  // se conserva con una altura fija para no comerse la separación.
  if (parrafo.fragmentos.length === 0) {
    return <p className="hojaParrafo hojaParrafoVacio" />;
  }

  return (
    <p className="hojaParrafo" style={{ textAlign }}>
      {parrafo.fragmentos.map((f, i) => {
        // Los saltos y tabulaciones que trae el fragmento se respetan con
        // white-space; aquí solo se aplica el énfasis.
        let nodo: React.ReactNode = f.texto;
        if (f.subrayado) nodo = <u key={`u${i}`}>{nodo}</u>;
        if (f.cursiva) nodo = <em key={`i${i}`}>{nodo}</em>;
        if (f.negrita) nodo = <strong key={`b${i}`}>{nodo}</strong>;
        return (
          <span key={i} style={{ whiteSpace: "pre-wrap" }}>
            {nodo}
          </span>
        );
      })}
    </p>
  );
}
