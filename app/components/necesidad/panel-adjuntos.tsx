"use client";

import { memo, useRef, useState } from "react";
import { FileText, Loader, Trash2, UploadCloud } from "lucide-react";
import { NECESIDAD_DOC_KINDS, necesidadDocKindLabel } from "@/lib/legal-taxonomy";
import type { NecesidadDocumento } from "@/lib/necesidades";
import { Button, IconButton } from "../ui";
import { ConfirmDialog } from "../confirm-dialog";

/**
 * Adjuntos de la necesidad: subir un PDF, listarlos, borrarlos.
 *
 * Estaba dentro de `sec-adjuntos`, PARTIDO EN DOS por el panel de autocompletado
 * con IA que se colaba entre el formulario de subida y la lista. Eran dos cosas
 * distintas en un mismo recuadro: una guarda ficheros en la necesidad, la otra
 * lee un PDF y propone valores para la ficha. Compartian el marco y nada mas.
 *
 * Al separarlas, esta mitad resulta ser autonoma —sus siete variables de estado
 * no se usan en ningun otro sitio— y va memoizada: escribir en la ficha ya no
 * vuelve a pintar la lista de adjuntos.
 *
 * La lista llega por prop porque la trae la peticion combinada que ya carga la
 * necesidad entera; pedirla aqui otra vez seria una ida y vuelta de mas.
 */
export const PanelAdjuntos = memo(function PanelAdjuntos({
  documentos,
  necesidadId,
  onCambio,
  onError,
  puedeEditar,
}: {
  documentos: NecesidadDocumento[];
  necesidadId: string;
  /** Se llama tras subir o borrar para que el padre recargue la lista. */
  onCambio: () => Promise<void> | void;
  /** Cadena vacia limpia el aviso. */
  onError: (mensaje: string) => void;
  puedeEditar: boolean;
}) {
  const [kind, setKind] = useState("requerimiento");
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteDocId, setConfirmDeleteDocId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function subirDocumento(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      onError("Selecciona un PDF.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      onError("El archivo no puede superar los 20 MB.");
      return;
    }
    setUploading(true);
    setUploadingFile(true);
    setUploadProgress(0);
    // La barra avanza sola hasta el 85 %: `fetch` no informa del progreso de
    // subida, asi que es una estimacion honesta, no una medida.
    const interval = setInterval(() => {
      setUploadProgress((prev) => Math.min(prev + 15, 85));
    }, 300);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("kind", kind);
      const response = await fetch(`/api/necesidades/${necesidadId}/documentos`, { body: formData, method: "POST" });
      clearInterval(interval);
      setUploadProgress(100);
      const payload = await response.json();
      if (!response.ok) {
        onError(payload.error ?? "No se pudo subir el documento.");
        return;
      }
      if (fileRef.current) {
        fileRef.current.value = "";
      }
      onError("");
      await onCambio();
    } catch {
      clearInterval(interval);
      onError("No se pudo conectar con el servidor.");
    } finally {
      setUploading(false);
      setUploadingFile(false);
      setUploadProgress(0);
    }
  }

  async function borrarDocumento(documentoId: string) {
    setDeletingId(documentoId);
    try {
      const response = await fetch(`/api/necesidades/${necesidadId}/documentos?documentoId=${documentoId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        onError(payload.error ?? "No se pudo eliminar el documento.");
        return;
      }
      await onCambio();
    } catch {
      onError("No se pudo conectar con el servidor.");
    } finally {
      setDeletingId(null);
      setConfirmDeleteDocId(null);
    }
  }

  return (
    <section id="sec-adjuntos" className="grid grid-cols-[minmax(0,1fr)] content-start gap-3 rounded-[14px] border border-line bg-panel p-3.5 shadow-card">
      <div className="flex flex-wrap items-center gap-2 text-ink">
        <FileText size={17} />
        <h3 className="panelTitle">Adjuntos</h3>
      </div>

      {puedeEditar ? (
        <form className="flex flex-wrap items-center gap-2 rounded-[10px] border border-dashed border-line p-2.5 [&_input]:rounded-lg [&_input]:border [&_input]:border-line [&_input]:bg-panel [&_input]:px-[9px] [&_input]:py-[7px] [&_input]:text-[13px] [&_select]:rounded-lg [&_select]:border [&_select]:border-line [&_select]:bg-panel [&_select]:px-[9px] [&_select]:py-[7px] [&_select]:text-[13px]" onSubmit={subirDocumento}>
          <select onChange={(event) => setKind(event.target.value)} value={kind}>
            {NECESIDAD_DOC_KINDS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <input accept="application/pdf,.pdf" ref={fileRef} type="file" />
          <Button variant="primary" disabled={uploading} type="submit">
            {uploading ? <Loader size={15} /> : <UploadCloud size={15} />}
            {uploading ? "Subiendo..." : "Adjuntar PDF"}
          </Button>
          {uploadingFile ? (
            <div className="h-1 w-full overflow-hidden rounded-full bg-line">
              <div className="h-full bg-brand transition-[width] duration-200" style={{ width: `${uploadProgress}%` }} />
            </div>
          ) : null}
        </form>
      ) : null}

      {documentos.length === 0 ? (
        <p className="text-xs font-semibold text-muted">
          {puedeEditar
            ? "Sin adjuntos. Carga el requerimiento firmado, cotizaciones u otros sustentos. (El TDR/EE.TT. va en su panel del punto 3.4, que lo indexa y lo anexa al Word.)"
            : "Sin adjuntos."}
        </p>
      ) : (
        <ul className="m-0 grid list-none gap-2 p-0">
          {documentos.map((doc) => (
            <li className="flex items-start gap-2.5 rounded-[14px] border border-line bg-panel px-3 py-2.5 shadow-card [&>svg]:mt-0.5 [&>svg]:text-brand" key={doc.id}>
              <FileText size={16} />
              <div className="grid flex-1 gap-0.5 [&_strong]:text-[13.5px] [&_strong]:text-ink [&_small]:text-[11.5px] [&_small]:text-muted">
                <strong>{doc.title}</strong>
                <small>{necesidadDocKindLabel(doc.kind)}</small>
              </div>
              {puedeEditar ? (
                <IconButton
                  aria-label="Eliminar adjunto"
                  destructive
                  size="sm"
                  disabled={deletingId === doc.id}
                  onClick={() => setConfirmDeleteDocId(doc.id)}
                >
                  {deletingId === doc.id ? <Loader size={15} /> : <Trash2 size={15} />}
                </IconButton>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={confirmDeleteDocId !== null}
        title="Eliminar adjunto"
        message="¿Estás seguro de eliminar este documento? No se puede deshacer."
        tone="danger"
        confirmLabel="Eliminar"
        onConfirm={() => { if (confirmDeleteDocId) void borrarDocumento(confirmDeleteDocId); }}
        onCancel={() => setConfirmDeleteDocId(null)}
      />
    </section>
  );
});
