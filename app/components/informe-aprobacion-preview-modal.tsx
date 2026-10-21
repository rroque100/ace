"use client";

import { useEffect, useState } from "react";
import { FileText, Loader } from "lucide-react";
import type { Bloque } from "@/lib/informe-aprobacion-contenido";
import { ModalShell } from "./modal-shell";

/**
 * Vista previa del informe de solicitud de aprobación (A8) antes de descargarlo.
 *
 * Pinta los MISMOS bloques que el .docx —los sirve el endpoint de previa desde
 * el mismo compositor—, con la misma tipografía, el mismo interlineado y las
 * citas legales en cursiva. Lo que se ve aquí es lo que sale en Word.
 *
 * Sirve para dos cosas: comprobar la cabecera —a quién va, quién firma— y ver
 * qué campos salen con guion, que son los que faltan por registrar en los pasos.
 */
export function InformeAprobacionPreviewModal({
  processId,
  onClose,
  onDescargar,
}: {
  processId: string;
  onClose: () => void;
  onDescargar: () => void;
}) {
  const [bloques, setBloques] = useState<Bloque[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const r = await fetch(`/api/processes/${processId}/fase1/informe-aprobacion/preview`);
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

  // Cuántos datos faltan: es lo que decide si conviene descargarlo ya o volver a
  // los pasos. Contarlo aquí evita que el usuario tenga que buscar los guiones.
  const faltantes =
    bloques
      ?.filter((b) => b.tipo === "tabla")
      .flatMap((b) => (b.tipo === "tabla" ? b.filas : []))
      .filter((f) => f.valor === "—").length ?? 0;

  return (
    <ModalShell
      acciones={
        <>
          <button className="secondaryButton compactButton" onClick={onClose} type="button">
            Cerrar
          </button>
          <button
            className="primaryButton compactButton"
            disabled={!bloques}
            onClick={onDescargar}
            type="button"
          >
            <FileText size={15} /> Descargar .docx
          </button>
        </>
      }
      claseTarjeta="informeAprobPreview"
      onClose={onClose}
      titulo="Vista previa · Informe de aprobación"
    >
        {error ? (
          <p className="formError">{error}</p>
        ) : !bloques ? (
          <p className="anexo1PreviewCargando">
            <Loader className="spinIcon" size={14} /> Preparando la vista previa…
          </p>
        ) : (
          <>
            {faltantes > 0 ? (
              <p className="previaAviso">
                {faltantes === 1
                  ? "Un dato del detalle sale con guion: aún no está registrado en su paso."
                  : `${faltantes} datos del detalle salen con guion: aún no están registrados en sus pasos.`}{" "}
                Puedes descargarlo igual y completarlo después.
              </p>
            ) : null}

            <div className="hojaInforme">
              {bloques.map((b, i) => (
                <BloqueVista bloque={b} key={i} />
              ))}
            </div>
          </>
        )}
    </ModalShell>
  );
}

function BloqueVista({ bloque }: { bloque: Bloque }) {
  switch (bloque.tipo) {
    case "titulo":
      return <p className="hojaTitulo">{bloque.texto}</p>;
    case "subtitulo":
      return <p className="hojaSubtitulo">{bloque.texto}</p>;
    case "cabecera":
      return (
        <p className="hojaCabecera">
          <span className="hojaCabeceraEtiqueta">{bloque.etiqueta}</span>
          <span>
            <strong>{bloque.nombre || "—"}</strong>
            {bloque.cargo ? (
              <>
                <br />
                {bloque.cargo}
              </>
            ) : null}
          </span>
        </p>
      );
    case "parrafo":
      return (
        <p className="hojaParrafo">
          {bloque.fragmentos.map((f, i) => {
            if (f.negrita) return <strong key={i}>{f.texto}</strong>;
            if (f.cursiva) return <em key={i}>{f.texto}</em>;
            return <span key={i}>{f.texto}</span>;
          })}
        </p>
      );
    case "vinetas":
      return (
        <ul className="hojaVinetas">
          {bloque.items.map((t, i) => (
            <li key={i}>
              <em>{t}</em>
            </li>
          ))}
        </ul>
      );
    case "tabla":
      return (
        <table className="hojaTabla">
          <tbody>
            {bloque.filas.map((f, i) => (
              <tr key={i}>
                <th scope="row">{f.etiqueta}</th>
                <td data-vacio={f.valor === "—" ? "true" : undefined}>{f.valor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    case "linea":
      return <hr className="hojaLinea" />;
    case "espacio":
      return <div className="hojaEspacio" />;
    case "pie":
      return (
        <p className="hojaPie">
          {bloque.fragmentos.map((f, i) => {
            if (f.negrita) return <strong key={i}>{f.texto}</strong>;
            if (f.cursiva) return <em key={i}>{f.texto}</em>;
            return <span key={i}>{f.texto}</span>;
          })}
        </p>
      );
  }
}
