"use client";

import { useEffect, useState } from "react";
import { FileText, Loader } from "lucide-react";
import type { ParrafoDocx } from "@/lib/docx-a-bloques";
import { ModalShell } from "./modal-shell";

/**
 * Vista previa de uno de los tres documentos de designación de evaluadores (A6)
 * antes de descargarlo.
 *
 * Lo que muestra se LEE del mismo .docx que se descarga —el endpoint genera el
 * archivo y lo lee de vuelta—, con la misma tipografía, alineación, negritas,
 * cursivas y subrayados. No es una segunda composición: es el archivo.
 */
type Miembro = { index: number; nombre: string };

export function EvaluadoresPreviewModal({
  processId,
  doc,
  label,
  onClose,
  onDescargar,
}: {
  processId: string;
  /** memo | jurada | consentimiento */
  doc: string;
  label: string;
  onClose: () => void;
  /** Descarga el documento del miembro elegido (null = todos, el grupo). */
  onDescargar: (miembro: number | null) => void;
}) {
  const [parrafos, setParrafos] = useState<ParrafoDocx[] | null>(null);
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  // null = todos (el grupo, una página por miembro); un número = ese miembro.
  const [miembro, setMiembro] = useState<number | null>(null);
  const [error, setError] = useState("");

  // El memorándum de designación es un solo documento del panel; la jurada y el
  // consentimiento se firman por integrante, así que solo estos llevan selector.
  const porMiembro = doc !== "memo";

  useEffect(() => {
    let vivo = true;
    setParrafos(null);
    void (async () => {
      try {
        const q = new URLSearchParams({ doc });
        if (porMiembro && miembro != null) q.set("miembro", String(miembro));
        const r = await fetch(`/api/processes/${processId}/fase1/evaluadores-preview?${q.toString()}`);
        const data = await r.json();
        if (!vivo) return;
        if (!r.ok) setError(data.error ?? "No se pudo generar la vista previa.");
        else {
          setParrafos(data.parrafos ?? []);
          setMiembros(Array.isArray(data.miembros) ? data.miembros : []);
        }
      } catch {
        if (vivo) setError("No se pudo conectar con el servidor.");
      }
    })();
    return () => {
      vivo = false;
    };
  }, [processId, doc, miembro, porMiembro]);

  // Escape, foco atrapado e id del título los aporta ModalShell (Radix).

  return (
    <ModalShell
      acciones={
        <>
          <button
            className="primaryButton compactButton"
            disabled={!parrafos}
            onClick={() => {
              onDescargar(porMiembro ? miembro : null);
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
      titulo={`Vista previa · ${label}`}
    >
          {/* Selector de miembro: solo para jurada/consentimiento con panel de
              más de una persona. "Todos" genera una página por integrante. */}
          {porMiembro && miembros.length > 1 ? (
            <label
              style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 13 }}
            >
              <span style={{ fontWeight: 600 }}>Miembro:</span>
              <select
                value={miembro == null ? "todos" : String(miembro)}
                onChange={(e) => setMiembro(e.target.value === "todos" ? null : Number(e.target.value))}
                style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--line)" }}
              >
                <option value="todos">Todos ({miembros.length} miembros)</option>
                {miembros.map((m) => (
                  <option key={m.index} value={m.index}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {error ? (
            <p className="formError">{error}</p>
          ) : !parrafos ? (
            <p className="anexo1PreviewCargando">
              <Loader className="spinIcon" size={14} /> Preparando la vista previa…
            </p>
          ) : (
            <div className="hojaInforme">
              {parrafos.map((p, i) => (
                <ParrafoVista key={i} parrafo={p} />
              ))}
            </div>
          )}
    </ModalShell>
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
