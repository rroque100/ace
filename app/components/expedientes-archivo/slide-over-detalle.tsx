"use client";

import { useEffect, useState } from "react";
import { Download, FileText, Loader2, Pencil, RefreshCw, Save, Sparkles } from "lucide-react";
import { ARCHIVO_COLORES, CONTENEDOR_TIPOS, CONTENEDOR_TIPO_LABELS } from "@/lib/expedientes-archivo";
import { fetchLegajoDetalle } from "@/lib/expedientes-archivo-actions";
import { ExpSlideOver } from "./slide-over-shell";
import type { ExpedienteItem, LegajoDetalle, LegajoDocumentoResumen } from "./types";
import {
  EXP_FIELD,
  EXP_FIELD_CONTROL,
  EXP_FIELD_LABEL,
  EXP_FIELD_TEXTAREA,
  EXP_HELP_TEXT,
  EXP_LIST,
  EXP_LIST_ITEM,
  EXP_LIST_ITEM_BODY,
  EXP_LIST_ITEM_ICON,
  EXP_LIST_ITEM_META,
  EXP_LIST_ITEM_TITLE,
  EXP_SLIDE_OVER_BODY,
  EXP_SLIDE_OVER_FOOTER,
  EXP_SPIN,
  expBtnClass,
  expStatusClass,
} from "./estilos";
import { cn } from "@/lib/utils";

export type SlideOverDetalleProps = {
  openExp: ExpedienteItem;
  editMode: boolean;
  editForm: Record<string, unknown>;
  savingEdit: boolean;
  isAdmin: boolean;
  canManage: boolean;
  formatBytes: (n: number) => string;
  onClose: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSetEditField: (key: string, value: unknown) => void;
  onSaveEdits: () => void;
  onReplace: (exp: ExpedienteItem) => void;
  // Abre OTRO documento del mismo expediente sin cerrar el slide-over (Fase 2
  // del legajo multidocumento).
  onOpenDocumentoId: (id: string) => void;
  statusLabel: (s: LegajoDocumentoResumen["status"]) => string;
};

export function ExpedienteSlideOver({
  openExp,
  editMode,
  editForm,
  savingEdit,
  isAdmin,
  canManage,
  formatBytes,
  onClose,
  onStartEdit,
  onCancelEdit,
  onSetEditField,
  onSaveEdits,
  onReplace,
  onOpenDocumentoId,
  statusLabel,
}: SlideOverDetalleProps) {
  // Otros documentos del mismo legajo: se recarga cada vez que se abre un
  // expediente distinto (openExp.id cambia también al saltar entre folios).
  const [legajoDetalle, setLegajoDetalle] = useState<LegajoDetalle | null>(null);
  const [loadingLegajo, setLoadingLegajo] = useState(false);

  useEffect(() => {
    if (!openExp.expediente_id) {
      setLegajoDetalle(null);
      return;
    }
    let cancelled = false;
    setLoadingLegajo(true);
    void fetchLegajoDetalle(openExp.expediente_id)
      .then((data) => {
        if (!cancelled) setLegajoDetalle(data);
      })
      .finally(() => {
        if (!cancelled) setLoadingLegajo(false);
      });
    return () => {
      cancelled = true;
    };
  }, [openExp.expediente_id, openExp.id]);

  const otrosDocumentos = (legajoDetalle?.documentos ?? []).filter((d) => d.id !== openExp.id);

  // Escape, foco atrapado y bloqueo de scroll los aporta ExpSlideOver (Radix).
  return (
    <ExpSlideOver
      onClose={onClose}
      subtitulo={
        <>
          {openExp.serie_documento ?? "Sin número"} · {openExp.anio ?? "s/f"} ·{" "}
          {formatBytes(openExp.file_size)}
        </>
      }
      titulo={openExp.title}
    >
        <div className={cn("tw", EXP_SLIDE_OVER_BODY)}>
          <iframe
            title="Vista previa"
            src={`/api/expedientes-archivo/${openExp.id}`}
            className="h-[70vh] w-full border-0"
          />
          {openExp.metadata?.tokenUsage ? (
            <div
              className={cn(EXP_HELP_TEXT, "mt-2.5 flex-wrap")}
              title="Tokens de OpenAI consumidos al procesar este expediente (OCR + análisis). Coste estimado."
            >
              <Sparkles size={12} />
              Consumo IA: {openExp.metadata.tokenUsage.totalTokens.toLocaleString("es-PE")} tokens
              {openExp.metadata.tokenUsage.estimatedCostUsd > 0
                ? ` · ~$${openExp.metadata.tokenUsage.estimatedCostUsd.toFixed(4)}`
                : ""}
              {openExp.metadata.tokenUsage.ocr
                ? ` · OCR ${openExp.metadata.tokenUsage.ocr.model}${
                    openExp.metadata.tokenUsage.ocr.fromCache ? " (reutilizado)" : ""
                  }`
                : ""}
              {openExp.metadata.tokenUsage.analysis
                ? ` · análisis ${openExp.metadata.tokenUsage.analysis.model}`
                : ""}
            </div>
          ) : null}
          {otrosDocumentos.length > 0 || loadingLegajo ? (
            <div className="mt-4">
              <label className={EXP_FIELD_LABEL}>
                Otros documentos de este expediente
                {legajoDetalle ? ` (${legajoDetalle.documentos.length})` : ""}
              </label>
              {loadingLegajo ? (
                <span className={cn(EXP_HELP_TEXT, "mt-1")}>
                  <Loader2 size={12} className={EXP_SPIN} /> Cargando…
                </span>
              ) : (
                <ul className={cn(EXP_LIST, "mt-1.5 list-none p-0")}>
                  {otrosDocumentos.map((doc) => (
                    <li key={doc.id}>
                      <button
                        type="button"
                        className={cn(EXP_LIST_ITEM, "w-full text-left")}
                        onClick={() => onOpenDocumentoId(doc.id)}
                      >
                        <div className={EXP_LIST_ITEM_ICON}>
                          <FileText size={16} />
                        </div>
                        <div className={EXP_LIST_ITEM_BODY}>
                          <p className={EXP_LIST_ITEM_TITLE}>
                            {doc.numero_folio ? `Folio ${doc.numero_folio} · ` : ""}
                            {doc.title}
                          </p>
                          <div className={EXP_LIST_ITEM_META}>
                            {doc.tipo_documento ? <span>{doc.tipo_documento}</span> : null}
                            {doc.anio ? <span>· {doc.anio}</span> : null}
                            <span className={expStatusClass(doc.status)}>{statusLabel(doc.status)}</span>
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
          {editMode ? (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className={cn(EXP_FIELD, "col-span-2")}>
                <label className={EXP_FIELD_LABEL}>Título</label>
                <input
                  className={EXP_FIELD_CONTROL}
                  value={String(editForm.title ?? "")}
                  onChange={(e) => onSetEditField("title", e.target.value)}
                />
              </div>
              <div className={EXP_FIELD}>
                <label className={EXP_FIELD_LABEL}>Nº SGD</label>
                <input
                  className={EXP_FIELD_CONTROL}
                  value={String(editForm.sgd_expediente ?? "")}
                  onChange={(e) => onSetEditField("sgd_expediente", e.target.value)}
                />
              </div>
              <div className={EXP_FIELD}>
                <label className={EXP_FIELD_LABEL}>Serie documental</label>
                <input
                  className={EXP_FIELD_CONTROL}
                  value={String(editForm.serie_documento ?? "")}
                  onChange={(e) => onSetEditField("serie_documento", e.target.value)}
                />
              </div>
              <div className={EXP_FIELD}>
                <label className={EXP_FIELD_LABEL}>Año</label>
                <input
                  type="number"
                  className={EXP_FIELD_CONTROL}
                  value={String(editForm.anio ?? "")}
                  onChange={(e) => onSetEditField("anio", e.target.value)}
                />
              </div>
              <div className={EXP_FIELD}>
                <label className={EXP_FIELD_LABEL}>Tipo de documento</label>
                <input
                  className={EXP_FIELD_CONTROL}
                  value={String(editForm.tipo_documento ?? "")}
                  onChange={(e) => onSetEditField("tipo_documento", e.target.value)}
                />
              </div>
              <div className={cn(EXP_FIELD, "col-span-2")}>
                <label className={EXP_FIELD_LABEL}>Oficina</label>
                <input
                  className={EXP_FIELD_CONTROL}
                  value={String(editForm.oficina ?? "")}
                  onChange={(e) => onSetEditField("oficina", e.target.value)}
                  readOnly={!isAdmin}
                  title={!isAdmin ? "Solo un administrador puede cambiar la oficina" : undefined}
                />
              </div>
              <div className={cn(EXP_FIELD, "col-span-2")}>
                <label className={EXP_FIELD_LABEL}>Materia</label>
                <input
                  className={EXP_FIELD_CONTROL}
                  value={String(editForm.materia ?? "")}
                  onChange={(e) => onSetEditField("materia", e.target.value)}
                />
              </div>
              <div className={cn(EXP_FIELD, "col-span-2")}>
                <label className={EXP_FIELD_LABEL}>Asunto</label>
                <textarea
                  className={EXP_FIELD_TEXTAREA}
                  rows={2}
                  value={String(editForm.asunto ?? "")}
                  onChange={(e) => onSetEditField("asunto", e.target.value)}
                />
              </div>
              <div className={cn(EXP_FIELD, "col-span-2")}>
                <label className={EXP_FIELD_LABEL}>Resumen</label>
                <textarea
                  className={EXP_FIELD_TEXTAREA}
                  rows={3}
                  value={String(editForm.resumen ?? "")}
                  onChange={(e) => onSetEditField("resumen", e.target.value)}
                />
              </div>
              <div className={cn(EXP_FIELD, "col-span-2")}>
                <label className={EXP_FIELD_LABEL}>Observaciones</label>
                <textarea
                  className={EXP_FIELD_TEXTAREA}
                  rows={2}
                  value={String(editForm.observaciones ?? "")}
                  onChange={(e) => onSetEditField("observaciones", e.target.value)}
                />
              </div>
              <div className={EXP_FIELD}>
                <label className={EXP_FIELD_LABEL}>Tipo de persona</label>
                <select
                  className={EXP_FIELD_CONTROL}
                  value={String(editForm.persona_tipo ?? "")}
                  onChange={(e) => onSetEditField("persona_tipo", e.target.value)}
                >
                  <option value="">— Sin persona —</option>
                  <option value="natural">Natural</option>
                  <option value="juridica">Jurídica</option>
                </select>
              </div>
              <div className={EXP_FIELD}>
                <label className={EXP_FIELD_LABEL}>Documento de la persona</label>
                <input
                  className={EXP_FIELD_CONTROL}
                  value={String(editForm.persona_documento ?? "")}
                  onChange={(e) => onSetEditField("persona_documento", e.target.value)}
                />
              </div>
              <div className={cn(EXP_FIELD, "col-span-2")}>
                <label className={EXP_FIELD_LABEL}>Nombre / razón social</label>
                <input
                  className={EXP_FIELD_CONTROL}
                  value={String(editForm.persona_nombre ?? "")}
                  onChange={(e) => onSetEditField("persona_nombre", e.target.value)}
                />
              </div>
              <div className={EXP_FIELD}>
                <label className={EXP_FIELD_LABEL}>Tipo de contenedor</label>
                <select
                  className={EXP_FIELD_CONTROL}
                  value={String(editForm.tipo_almacenamiento ?? "")}
                  onChange={(e) => onSetEditField("tipo_almacenamiento", e.target.value)}
                >
                  {CONTENEDOR_TIPOS.map((t) => (
                    <option key={t} value={t}>
                      {CONTENEDOR_TIPO_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div className={EXP_FIELD}>
                <label className={EXP_FIELD_LABEL}>Color</label>
                <select
                  className={EXP_FIELD_CONTROL}
                  value={String(editForm.color_archivador ?? "")}
                  onChange={(e) => onSetEditField("color_archivador", e.target.value)}
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
                <label className={EXP_FIELD_LABEL}>Nº de archivador</label>
                <input
                  className={EXP_FIELD_CONTROL}
                  value={String(editForm.nro_archivador ?? "")}
                  onChange={(e) => onSetEditField("nro_archivador", e.target.value)}
                />
              </div>
              <div className={EXP_FIELD}>
                <label className={EXP_FIELD_LABEL}>Nº de paquete</label>
                <input
                  className={EXP_FIELD_CONTROL}
                  value={String(editForm.nro_paquete ?? "")}
                  onChange={(e) => onSetEditField("nro_paquete", e.target.value)}
                />
              </div>
              <div className={EXP_FIELD}>
                <label className={EXP_FIELD_LABEL}>Empastado</label>
                <select
                  className={EXP_FIELD_CONTROL}
                  value={String(editForm.empastado ?? "")}
                  onChange={(e) => onSetEditField("empastado", e.target.value)}
                >
                  <option value="">— Sin dato —</option>
                  <option value="si">Sí</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div className={EXP_FIELD}>
                <label className={EXP_FIELD_LABEL}>Folio</label>
                <input
                  className={EXP_FIELD_CONTROL}
                  value={String(editForm.folio ?? "")}
                  onChange={(e) => onSetEditField("folio", e.target.value)}
                />
              </div>
              <div className={EXP_FIELD}>
                <label className={EXP_FIELD_LABEL}>Estante</label>
                <input
                  className={EXP_FIELD_CONTROL}
                  value={String(editForm.nro_estante ?? "")}
                  onChange={(e) => onSetEditField("nro_estante", e.target.value)}
                />
              </div>
              <div className={EXP_FIELD}>
                <label className={EXP_FIELD_LABEL}>Piso</label>
                <input
                  className={EXP_FIELD_CONTROL}
                  value={String(editForm.nro_piso ?? "")}
                  onChange={(e) => onSetEditField("nro_piso", e.target.value)}
                />
              </div>
              <div className={cn(EXP_FIELD, "col-span-2")}>
                <label className={EXP_FIELD_LABEL}>Local / ambiente</label>
                <input
                  className={EXP_FIELD_CONTROL}
                  value={String(editForm.nro_local ?? "")}
                  onChange={(e) => onSetEditField("nro_local", e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="mt-4 grid gap-3">
              {openExp.materia ? (
                <div className={EXP_FIELD}>
                  <label className={EXP_FIELD_LABEL}>Materia</label>
                  <div>{openExp.materia}</div>
                </div>
              ) : null}
              {openExp.asunto ? (
                <div className={EXP_FIELD}>
                  <label className={EXP_FIELD_LABEL}>Asunto</label>
                  <div>{openExp.asunto}</div>
                </div>
              ) : null}
              {(openExp.nro_estante || openExp.nro_piso || openExp.nro_local) ? (
                <div className={EXP_FIELD}>
                  <label className={EXP_FIELD_LABEL}>Ubicación física</label>
                  <div>
                    {[openExp.nro_estante && `Estante ${openExp.nro_estante}`, openExp.nro_piso && `Piso ${openExp.nro_piso}`, openExp.nro_local]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
        {canManage ? (
          <div className={EXP_SLIDE_OVER_FOOTER}>
            {editMode ? (
              <>
                <button
                  type="button"
                  className={expBtnClass("ghost")}
                  onClick={onCancelEdit}
                  disabled={savingEdit}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className={expBtnClass("primary")}
                  onClick={() => void onSaveEdits()}
                  disabled={savingEdit}
                >
                  {savingEdit ? <Loader2 size={14} className={EXP_SPIN} /> : <Save size={14} />}
                  {savingEdit ? "Guardando…" : "Guardar cambios"}
                </button>
              </>
            ) : (
              <>
                <button type="button" className={expBtnClass("ghost")} onClick={onStartEdit}>
                  <Pencil size={14} /> Editar datos
                </button>
                <button
                  type="button"
                  className={expBtnClass("ghost")}
                  onClick={() => {
                    onReplace(openExp);
                    onClose();
                  }}
                >
                  <RefreshCw size={14} /> Reemplazar PDF
                </button>
                <a
                  href={`/api/expedientes-archivo/${openExp.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className={expBtnClass("secondary")}
                >
                  <Download size={14} /> Descargar
                </a>
                <button
                  type="button"
                  className={expBtnClass("primary")}
                  onClick={onClose}
                >
                  Cerrar
                </button>
              </>
            )}
          </div>
        ) : null}
    </ExpSlideOver>
  );
}
