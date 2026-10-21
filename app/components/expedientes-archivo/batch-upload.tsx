"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  FileText,
  Loader2,
  MapPin,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import {
  ARCHIVO_AMBIENTES,
  ARCHIVO_COLORES,
  CONTENEDOR_TIPOS,
  CONTENEDOR_TIPO_LABELS,
} from "@/lib/expedientes-archivo";
import { maxPdfSizeBytes, maxPdfSizeLabel } from "@/lib/upload-limits";
import {
  autoFillFromPdf as autoFillFromPdfAction,
  detectDuplicates as detectDuplicatesAction,
  uploadExpediente as uploadExpedienteAction,
} from "@/lib/expedientes-archivo-actions";
import { firmaDuplicados } from "./duplicados";
import type { DuplicateMatch } from "./types";
import type { LastUbicacion } from "./use-preferences";
import {
  EXP_FIELD,
  EXP_FIELD_CONTROL,
  EXP_FIELD_LABEL,
  EXP_FORM_SECTION,
  EXP_FORM_SECTION_HEADER,
  EXP_FORM_SECTION_HINT,
  EXP_FORM_SECTION_TITLE,
  EXP_HELP_TEXT,
  EXP_ICON_BUTTON,
  EXP_ICON_BUTTON_DANGER,
  EXP_SPIN,
  expBtnClass,
  expFilePickerClass,
  expFilePickerIconClass,
  EXP_FILE_PICKER_SUB,
  EXP_FILE_PICKER_TITLE,
  expStatusClass,
} from "./estilos";
import { cn } from "@/lib/utils";

type ToastKind = "success" | "error" | "warning" | "info";

type ItemStatus = "pending" | "analyzing" | "ready" | "uploading" | "done" | "error";

type BatchItem = {
  id: string;
  file: File;
  status: ItemStatus;
  error?: string;
  // Posibles duplicados ya indexados (aviso no bloqueante) y la firma de la
  // comprobación que los produjo (para no repetir la llamada al endpoint).
  duplicates?: DuplicateMatch[];
  dupSignature?: string;
  // Campos editables por fila
  title: string;
  sgdExpediente: string;
  serieDocumento: string;
  tipoDocumento: string;
  anio: string;
  asunto: string;
  // Campos extraídos que se envían sin mostrarse en la tabla
  materia: string;
  resumen: string;
  oficina: string;
  personaNombre: string;
  personaTipo: "" | "natural" | "juridica";
  folio: string;
};

const EMPTY_LOC: LastUbicacion = {
  tipoAlmacenamiento: "",
  nroArchivador: "",
  nroPaquete: "",
  empastado: "",
  colorArchivador: "",
  nroEstante: "",
  nroPiso: "",
  nroLocal: "",
};

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// La serie documental = tipo de documento + numero detectado (ej. "Resolución
// 004-2024-MDCH-A"). El SGD queda MANUAL (N° del sistema documental externo).
function buildSerieDocumental(tipoDocumento: string, numero: string): string {
  const tipo = tipoDocumento.trim();
  const num = numero.trim();
  if (!num) return "";
  return [tipo, num].filter(Boolean).join(" ");
}

export function BatchUpload({
  autoExtract,
  lastUbicacion,
  setLastUbicacion,
  onUploaded,
  showToast,
  showConfirm,
}: {
  autoExtract: boolean;
  lastUbicacion: LastUbicacion;
  setLastUbicacion: (u: LastUbicacion) => void;
  onUploaded: () => void;
  showToast: (message: string, kind?: ToastKind) => void;
  showConfirm: (d: { title: string; message: string; variant: "danger" | "warning"; onConfirm: () => void | Promise<void> }) => void;
}) {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [loc, setLoc] = useState<LastUbicacion>(() => ({ ...EMPTY_LOC, ...lastUbicacion }));
  const [isDragging, setIsDragging] = useState(false);
  const [running, setRunning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const setItem = useCallback((id: string, patch: Partial<BatchItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  // Analiza un PDF con IA y rellena la fila (no bloquea la edición manual).
  const analyzeItem = useCallback(
    async (id: string, file: File) => {
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status: "analyzing" } : it)));
      try {
        const inv = await autoFillFromPdfAction(file, file.name);
        setItems((prev) =>
          prev.map((it) => {
            if (it.id !== id) return it;
            const tipoDoc = it.tipoDocumento || inv.tipoDocumento || "";
            // SGD NO se autocompleta (manual: sistema documental externo). La
            // SERIE es la denominación oficial LITERAL que la IA lee del encabezado
            // (ej. "RESOLUCIÓN DE ALCALDÍA N° 004-2024-MDCH-A"); si no la detectó,
            // se compone como fallback con tipo + número.
            const serie =
              it.serieDocumento ||
              inv.serieDocumental?.trim() ||
              buildSerieDocumental(tipoDoc, inv.numeroExpediente || "");
            return {
              ...it,
              status: "ready",
              serieDocumento: serie,
              tipoDocumento: tipoDoc,
              anio: it.anio || (inv.anio ? String(inv.anio) : ""),
              asunto: it.asunto || inv.asunto || "",
              materia: it.materia || inv.materia || "",
              resumen: it.resumen || inv.resumen || "",
              oficina: it.oficina || inv.oficina || "",
              personaNombre: it.personaNombre || inv.personaNombre || "",
              personaTipo: it.personaTipo || (inv.personaTipo ?? ""),
              folio: it.folio || (inv.nroFolios ? String(inv.nroFolios) : ""),
              title: it.title || serie || file.name,
            };
          }),
        );
      } catch {
        // No es bloqueante: la fila queda lista para llenar a mano.
        setItems((prev) =>
          prev.map((it) => (it.id === id ? { ...it, status: "ready" } : it)),
        );
      }
    },
    [],
  );

  const addFiles = useCallback(
    (files: FileList | File[] | null) => {
      if (!files) return;
      const incoming = Array.from(files);
      const accepted: BatchItem[] = [];
      for (const file of incoming) {
        if (file.type !== "application/pdf") {
          showToast(`"${file.name}" no es PDF, se omitió`, "warning");
          continue;
        }
        if (file.size > maxPdfSizeBytes) {
          showToast(`"${file.name}" supera ${maxPdfSizeLabel}, se omitió`, "warning");
          continue;
        }
        accepted.push({
          id: newId(),
          file,
          status: "pending",
          title: file.name,
          sgdExpediente: "",
          serieDocumento: "",
          tipoDocumento: "",
          anio: "",
          asunto: "",
          materia: "",
          resumen: "",
          oficina: "",
          personaNombre: "",
          personaTipo: "",
          folio: "",
        });
      }
      if (accepted.length === 0) return;
      setItems((prev) => [...prev, ...accepted]);
      showToast(`${accepted.length} PDF${accepted.length === 1 ? "" : "s"} añadido${accepted.length === 1 ? "" : "s"} al lote`, "success");
      if (autoExtract) {
        // Analiza en serie para no saturar el backend de OCR/IA.
        void (async () => {
          for (const it of accepted) {
            await analyzeItem(it.id, it.file);
          }
        })();
      } else {
        setItems((prev) =>
          prev.map((it) =>
            accepted.some((a) => a.id === it.id) ? { ...it, status: "ready" } : it,
          ),
        );
      }
    },
    [autoExtract, analyzeItem, showToast],
  );

  function removeItem(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  function setLocField(key: keyof LastUbicacion, value: string) {
    setLoc((prev) => ({ ...prev, [key]: value }));
  }

  const analyzing = items.some((it) => it.status === "analyzing");
  const uploadable = items.filter((it) => it.status === "ready" || it.status === "error");

  // Detección de duplicados por fila, con firma + debounce (mismo criterio que
  // el wizard individual, ver checkDuplicatesFor en el workspace). Con un solo
  // mecanismo cubre los dos orígenes del dato: el análisis IA (la serie
  // detectada cambia la firma) y la edición manual de SGD/serie en la tabla.
  // Nunca bloquea la subida: es una ayuda para no indexar dos veces lo mismo.
  useEffect(() => {
    if (items.length === 0) return;
    const timer = setTimeout(() => {
      for (const it of items) {
        if (it.status === "done" || it.status === "uploading") continue;
        const sgd = it.sgdExpediente.trim();
        const serie = it.serieDocumento.trim();
        if (sgd.length < 3 && serie.length < 3) {
          // Sin criterio suficiente: quitar un aviso viejo para que no mienta
          // sobre un SGD/serie que el usuario ya borró o recortó.
          if (it.duplicates && it.duplicates.length > 0) {
            setItems((prev) =>
              prev.map((p) => (p.id === it.id ? { ...p, duplicates: [], dupSignature: "" } : p)),
            );
          }
          continue;
        }
        const firma = firmaDuplicados({ sgd, serie });
        if (firma === it.dupSignature) continue;
        // Se marca la firma ANTES de la llamada: sin esto, cada rerender durante
        // la petición en curso re-dispararía la comprobación.
        setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, dupSignature: firma } : p)));
        void detectDuplicatesAction({ sgd: sgd || undefined, serie: serie || undefined })
          .then(({ duplicates }) => {
            setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, duplicates } : p)));
          })
          .catch(() => {
            // La detección es una ayuda; nunca debe romper el lote.
            setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, duplicates: [] } : p)));
          });
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [items]);

  async function uploadAll() {
    if (running) return;
    const queue = items.filter((it) => it.status === "ready" || it.status === "error");
    if (queue.length === 0) {
      showToast("No hay expedientes listos para subir.", "warning");
      return;
    }
    setRunning(true);
    let ok = 0;
    let fail = 0;
    for (const it of queue) {
      setItem(it.id, { status: "uploading", error: undefined });
      const fd = new FormData();
      fd.append("file", it.file);
      const fields: Array<[string, string]> = [
        ["title", it.title || it.file.name],
        ["sgdExpediente", it.sgdExpediente],
        ["serieDocumento", it.serieDocumento],
        ["tipoDocumento", it.tipoDocumento],
        ["anio", it.anio],
        ["asunto", it.asunto],
        ["materia", it.materia],
        ["resumen", it.resumen],
        ["oficina", it.oficina],
        ["personaNombre", it.personaNombre],
        ["personaTipo", it.personaTipo],
        ["folio", it.folio],
        // Ubicación física compartida por todo el lote
        ["tipoAlmacenamiento", loc.tipoAlmacenamiento],
        ["nroArchivador", loc.nroArchivador],
        ["nroPaquete", loc.nroPaquete],
        ["empastado", loc.empastado],
        ["colorArchivador", loc.colorArchivador],
        ["nroEstante", loc.nroEstante],
        ["nroPiso", loc.nroPiso],
        ["nroLocal", loc.nroLocal],
      ];
      for (const [k, v] of fields) {
        if (v && v.trim()) fd.append(k, v.trim());
      }
      try {
        await uploadExpedienteAction(fd);
        setItem(it.id, { status: "done" });
        ok += 1;
      } catch (err) {
        setItem(it.id, {
          status: "error",
          error: err instanceof Error ? err.message : "No se pudo subir",
        });
        fail += 1;
      }
    }
    setRunning(false);
    // Recuerda la ubicación del lote para la próxima vez.
    if (Object.values(loc).some((v) => v && v.trim())) {
      setLastUbicacion(loc);
    }
    onUploaded();
    showToast(
      `Lote subido: ${ok} correcto${ok === 1 ? "" : "s"}${fail ? `, ${fail} con error` : ""}.`,
      fail ? "warning" : "success",
    );
  }

  function clearDone() {
    setItems((prev) => prev.filter((it) => it.status !== "done"));
  }

  const statusLabel: Record<ItemStatus, string> = {
    pending: "En cola",
    analyzing: "Analizando…",
    ready: "Listo",
    uploading: "Subiendo…",
    done: "Subido",
    error: "Error",
  };

  return (
    <div className="tw">
      {/* Zona de carga múltiple */}
      <label
        className={expFilePickerClass(isDragging ? "dragging" : undefined)}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          addFiles(e.dataTransfer.files);
        }}
      >
        <div className={expFilePickerIconClass()}>
          <UploadCloud size={24} />
        </div>
        <p className={EXP_FILE_PICKER_TITLE}>
          {isDragging ? "Suelta los PDF aquí" : "Arrastra varios PDF o haz clic"}
        </p>
        <p className={EXP_FILE_PICKER_SUB}>
          Se analizan con IA automáticamente. Máx {maxPdfSizeLabel} por archivo.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          multiple
          onChange={(e) => {
            addFiles(e.target.files);
            if (inputRef.current) inputRef.current.value = "";
          }}
        />
      </label>

      {items.length > 0 ? (
        <>
          {/* Ubicación física compartida */}
          <div className={cn(EXP_FORM_SECTION, "mt-4")}>
            <div className={EXP_FORM_SECTION_HEADER}>
              <h3 className={EXP_FORM_SECTION_TITLE}>
                <MapPin size={16} /> Ubicación física del lote
                <span className={EXP_FORM_SECTION_HINT}>
                  Se aplica a todos los expedientes del lote
                </span>
              </h3>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className={EXP_FIELD}>
                <label className={EXP_FIELD_LABEL}>Tipo de contenedor</label>
                <select
                  value={loc.tipoAlmacenamiento}
                  onChange={(e) => setLocField("tipoAlmacenamiento", e.target.value)}
                  className={EXP_FIELD_CONTROL}
                >
                  <option value="">— Sin contenedor —</option>
                  {CONTENEDOR_TIPOS.map((t) => (
                    <option key={t} value={t}>
                      {CONTENEDOR_TIPO_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div className={EXP_FIELD}>
                <label className={EXP_FIELD_LABEL}>Nº de archivador</label>
                <input
                  value={loc.nroArchivador}
                  onChange={(e) => setLocField("nroArchivador", e.target.value)}
                  className={EXP_FIELD_CONTROL}
                  placeholder="Ej. 12"
                />
              </div>
              <div className={EXP_FIELD}>
                <label className={EXP_FIELD_LABEL}>Nº de paquete</label>
                <input
                  value={loc.nroPaquete}
                  onChange={(e) => setLocField("nroPaquete", e.target.value)}
                  className={EXP_FIELD_CONTROL}
                  placeholder="Opcional"
                />
              </div>
              <div className={EXP_FIELD}>
                <label className={EXP_FIELD_LABEL}>Color</label>
                <select
                  value={loc.colorArchivador}
                  onChange={(e) => setLocField("colorArchivador", e.target.value)}
                  className={EXP_FIELD_CONTROL}
                >
                  <option value="">— Sin color —</option>
                  {ARCHIVO_COLORES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className={EXP_FIELD}>
                <label className={EXP_FIELD_LABEL}>Estante</label>
                <input
                  value={loc.nroEstante}
                  onChange={(e) => setLocField("nroEstante", e.target.value)}
                  className={EXP_FIELD_CONTROL}
                  placeholder="Ej. 3"
                />
              </div>
              <div className={EXP_FIELD}>
                <label className={EXP_FIELD_LABEL}>Local / ambiente</label>
                <select
                  value={loc.nroLocal}
                  onChange={(e) => setLocField("nroLocal", e.target.value)}
                  className={EXP_FIELD_CONTROL}
                >
                  <option value="">— Sin ambiente —</option>
                  {ARCHIVO_AMBIENTES.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Tabla de revisión */}
          <div className={cn(EXP_FORM_SECTION, "mt-4")}>
            <div className={EXP_FORM_SECTION_HEADER}>
              <h3 className={EXP_FORM_SECTION_TITLE}>
                <FileText size={16} /> Expedientes del lote ({items.length})
                <span className={EXP_FORM_SECTION_HINT}>
                  Revisa y ajusta lo detectado por la IA antes de subir
                </span>
              </h3>
              {analyzing ? (
                <span className={cn(EXP_HELP_TEXT, "mt-0")}>
                  <Loader2 size={12} className={EXP_SPIN} /> Analizando con IA…
                </span>
              ) : null}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="text-left text-exp-muted">
                    <th className="px-2 py-1.5">Archivo</th>
                    <th className="px-2 py-1.5" title="N° del sistema de gestión documental externo (manual)">
                      SGD
                    </th>
                    <th className="px-2 py-1.5">Serie</th>
                    <th className="px-2 py-1.5">Tipo</th>
                    <th className="w-[70px] px-2 py-1.5">Año</th>
                    <th className="px-2 py-1.5">Asunto</th>
                    <th className="w-[90px] px-2 py-1.5">Estado</th>
                    <th className="w-9 px-2 py-1.5" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <Fragment key={it.id}>
                    <tr className="border-t border-exp-line">
                      <td className="max-w-[180px] px-2 py-1.5">
                        <span title={it.file.name} className="block overflow-hidden text-ellipsis whitespace-nowrap">
                          {it.file.name}
                        </span>
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          className={EXP_FIELD_CONTROL}
                          value={it.sgdExpediente}
                          onChange={(e) => setItem(it.id, { sgdExpediente: e.target.value })}
                          placeholder="manual"
                          title="N° de expediente del sistema documental externo (lo asignas tú)"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          className={EXP_FIELD_CONTROL}
                          value={it.serieDocumento}
                          onChange={(e) => setItem(it.id, { serieDocumento: e.target.value })}
                          placeholder="—"
                          title="Serie documental: tipo + número (autodetectada)"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          className={EXP_FIELD_CONTROL}
                          value={it.tipoDocumento}
                          onChange={(e) => setItem(it.id, { tipoDocumento: e.target.value })}
                          placeholder="—"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          className={EXP_FIELD_CONTROL}
                          value={it.anio}
                          onChange={(e) => setItem(it.id, { anio: e.target.value })}
                          placeholder="—"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          className={EXP_FIELD_CONTROL}
                          value={it.asunto}
                          onChange={(e) => setItem(it.id, { asunto: e.target.value })}
                          placeholder="—"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <span
                          className={expStatusClass(
                            it.status === "done"
                              ? "indexed"
                              : it.status === "error"
                                ? "error"
                                : it.status === "uploading" || it.status === "analyzing"
                                  ? "processing"
                                  : "uploaded",
                          )}
                          title={it.error}
                        >
                          {it.status === "analyzing" || it.status === "uploading" ? (
                            <Loader2 size={11} className={EXP_SPIN} />
                          ) : it.status === "done" ? (
                            <Check size={11} />
                          ) : it.status === "error" ? (
                            <AlertCircle size={11} />
                          ) : null}
                          {statusLabel[it.status]}
                        </span>
                      </td>
                      <td className="px-2 py-1.5">
                        {it.status !== "uploading" ? (
                          <button
                            type="button"
                            className={cn(EXP_ICON_BUTTON, EXP_ICON_BUTTON_DANGER, "size-7")}
                            onClick={() => removeItem(it.id)}
                            aria-label="Quitar del lote"
                            title="Quitar"
                          >
                            <Trash2 size={13} />
                          </button>
                        ) : null}
                      </td>
                    </tr>
                    {it.duplicates && it.duplicates.length > 0 ? (
                      <tr aria-label={`Posibles duplicados de ${it.file.name}`}>
                        <td colSpan={8} className="border-t-0 px-2 pb-2.5 pt-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[8px] border border-[rgba(234,179,8,0.4)] bg-[rgba(234,179,8,0.08)] px-2.5 py-1.5 text-xs text-[#92400e]">
                            <AlertCircle size={13} className="shrink-0" />
                            <strong className="font-semibold">
                              Posible duplicado{it.duplicates.length === 1 ? "" : "s"} (
                              {it.duplicates.length}):
                            </strong>
                            {it.duplicates.slice(0, 3).map((d) => (
                              <span key={d.id}>
                                {d.title}
                                {d.anio ? ` · ${d.anio}` : ""} · {d.status}
                              </span>
                            ))}
                            {it.duplicates.length > 3 ? (
                              <span>+{it.duplicates.length - 3} más</span>
                            ) : null}
                            <span className="italic">
                              Se subirá igual; quita la fila si es el mismo documento.
                            </span>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2.5 border-t border-exp-line pt-4">
              <div className="flex gap-2.5">
                <button
                  type="button"
                  className={expBtnClass("ghost")}
                  onClick={() =>
                    showConfirm({
                      title: "¿Vaciar el lote?",
                      message:
                        items.some((it) => it.status !== "pending")
                          ? `Se perderán los ${items.length} PDF del lote, incluida la lectura con IA ya hecha. ¿Estás seguro?`
                          : `Se quitarán los ${items.length} PDF del lote. ¿Estás seguro?`,
                      variant: "warning",
                      onConfirm: () => {
                        setItems([]);
                        showToast("Lote vaciado", "info");
                      },
                    })
                  }
                  disabled={running}
                >
                  <X size={14} /> Vaciar lote
                </button>
                {items.some((it) => it.status === "done") ? (
                  <button
                    type="button"
                    className={expBtnClass("ghost")}
                    onClick={clearDone}
                    disabled={running}
                  >
                    Quitar subidos
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                className={expBtnClass("primary", "large")}
                onClick={uploadAll}
                disabled={running || analyzing || uploadable.length === 0}
              >
                {running ? (
                  <Loader2 size={16} className={EXP_SPIN} />
                ) : (
                  <UploadCloud size={16} />
                )}
                {running
                  ? "Subiendo lote…"
                  : `Subir ${uploadable.length} expediente${uploadable.length === 1 ? "" : "s"}`}
              </button>
            </div>
            <span className={EXP_HELP_TEXT}>
              <Sparkles size={12} /> Cada expediente se procesa con OCR e indexa en segundo plano tras subirse.
            </span>
          </div>
        </>
      ) : null}
    </div>
  );
}
