"use client";

import { FileText, Loader, UploadCloud } from "lucide-react";
import { useEffect, useState } from "react";
import type { ParrafoDocx } from "@/lib/docx-a-bloques";

/**
 * Campo «Términos de referencia / Especificaciones técnicas» (sección 3.4).
 *
 * Es un ADJUNTO, no un texto: el EETT/TDR se redacta fuera —en Word, con sus
 * tablas y su formato— y lo que la ficha necesita es el documento, no una
 * transcripción. Escribirlo a mano en un textarea perdía ese formato y creaba
 * una segunda versión que no coincidía con la que se firma.
 *
 * Acepta PDF y .docx, y previsualiza los dos:
 *   * PDF   → el propio fichero en un <iframe>.
 *   * .docx → párrafos leídos en el servidor, porque el navegador no sabe
 *             pintar un .docx.
 *
 * Los documentos son los mismos del módulo EETT/TDR (subir, revisar contra el
 * modelo del OECE, trasladar a la ficha): esto es su puerta de entrada desde el
 * campo, no un almacén paralelo.
 */
export type EettDocResumen = {
  id: string;
  title: string;
  file_name: string;
  status?: string;
};

export function NecesidadEettCampo({
  necesidadId,
  docs,
  subiendo,
  onSubir,
  onAbrir,
  readOnly,
}: {
  necesidadId: string;
  docs: EettDocResumen[];
  subiendo: boolean;
  onSubir: (archivo: File, tipo: "eett" | "tdr") => void;
  /** Abre el modal del módulo (revisión contra el modelo, traslado a la ficha). */
  onAbrir: (docId: string) => void;
  readOnly?: boolean;
}) {
  const [tipo, setTipo] = useState<"eett" | "tdr">("tdr");
  const [verId, setVerId] = useState<string | null>(null);

  // El último subido se abre solo: es lo que se acaba de adjuntar y lo que se
  // quiere comprobar.
  useEffect(() => {
    if (docs.length > 0 && !docs.some((d) => d.id === verId)) {
      setVerId(docs[docs.length - 1]!.id);
    }
    if (docs.length === 0) setVerId(null);
  }, [docs, verId]);

  const activo = docs.find((d) => d.id === verId) ?? null;

  return (
    <div className="eettCampo">
      {readOnly ? null : (
        <div className="eettCampoBarra">
          <select
            aria-label="Tipo de documento"
            onChange={(e) => setTipo(e.target.value as "eett" | "tdr")}
            value={tipo}
          >
            <option value="tdr">TDR — Términos de Referencia (servicios)</option>
            <option value="eett">EETT — Especificaciones Técnicas (bienes)</option>
          </select>
          <label className="secondaryButton compactButton eettCampoSubir">
            {subiendo ? <Loader className="spinIcon" size={14} /> : <UploadCloud size={14} />}
            {subiendo ? "Subiendo…" : `Adjuntar ${tipo === "eett" ? "EETT" : "TDR"}`}
            <input
              accept="application/pdf,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              disabled={subiendo}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onSubir(f, tipo);
                // Se limpia para poder volver a elegir el MISMO fichero tras
                // corregirlo: sin esto el `change` no vuelve a dispararse.
                e.target.value = "";
              }}
              type="file"
            />
          </label>
          <span className="eettCampoFormatos">PDF o Word (.docx)</span>
        </div>
      )}

      {docs.length === 0 ? (
        <p className="eettCampoVacio">
          Sin documento adjunto. El EETT/TDR se redacta en Word o PDF y se adjunta aquí.
        </p>
      ) : (
        <>
          <ul className="eettCampoLista">
            {docs.map((d) => (
              <li key={d.id}>
                <button
                  aria-current={d.id === verId ? "true" : undefined}
                  className="eettCampoDoc"
                  onClick={() => setVerId(d.id)}
                  type="button"
                >
                  <FileText size={14} aria-hidden /> {d.file_name}
                </button>
                <button className="eettCampoRevisar" onClick={() => onAbrir(d.id)} type="button">
                  Revisar y trasladar
                </button>
              </li>
            ))}
          </ul>
          {activo ? <VistaPrevia docId={activo.id} fileName={activo.file_name} necesidadId={necesidadId} /> : null}
        </>
      )}
    </div>
  );
}

/** PDF por iframe; .docx por párrafos leídos en el servidor. */
function VistaPrevia({
  necesidadId,
  docId,
  fileName,
}: {
  necesidadId: string;
  docId: string;
  fileName: string;
}) {
  const esDocx = /\.docx$/i.test(fileName);
  const [parrafos, setParrafos] = useState<ParrafoDocx[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!esDocx) return;
    let vivo = true;
    setParrafos(null);
    setError("");
    void (async () => {
      try {
        const r = await fetch(`/api/necesidades/${necesidadId}/eett-tdr/${docId}/parrafos`, {
          cache: "no-store",
        });
        const d = await r.json();
        if (!vivo) return;
        if (!r.ok) setError(d.error ?? "No se pudo leer el documento.");
        else setParrafos(d.parrafos ?? []);
      } catch {
        if (vivo) setError("No se pudo conectar con el servidor.");
      }
    })();
    return () => {
      vivo = false;
    };
  }, [docId, esDocx, necesidadId]);

  if (!esDocx) {
    return (
      <div className="eettCampoPreview">
        <iframe
          src={`/api/necesidades/${necesidadId}/eett-tdr/${docId}/pdf`}
          title={`Vista previa de ${fileName}`}
        />
      </div>
    );
  }

  if (error) return <p className="formError">{error}</p>;
  if (!parrafos) {
    return (
      <p className="eettCampoCargando">
        <Loader className="spinIcon" size={14} /> Leyendo el documento…
      </p>
    );
  }

  return (
    <div className="eettCampoPreview eettCampoPreviewDocx">
      <div className="hojaInforme">
        {parrafos.map((p, i) => (
          <ParrafoVista key={i} parrafo={p} />
        ))}
      </div>
    </div>
  );
}

/** Un párrafo del .docx con su alineación y sus énfasis, tal como se leyó. */
function ParrafoVista({ parrafo }: { parrafo: ParrafoDocx }) {
  const textAlign =
    parrafo.alineacion === "center"
      ? "center"
      : parrafo.alineacion === "right"
        ? "right"
        : parrafo.alineacion === "both"
          ? "justify"
          : "left";

  // Un párrafo sin texto es un espacio de la maqueta: se conserva con altura
  // fija para no comerse la separación.
  if (parrafo.fragmentos.length === 0) {
    return <p className="hojaParrafo hojaParrafoVacio" />;
  }

  return (
    <p className="hojaParrafo" style={{ textAlign }}>
      {parrafo.fragmentos.map((f, i) => {
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
