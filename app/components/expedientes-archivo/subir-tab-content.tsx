"use client";

import {
  idPestana,
  propsPanel,
  propsPestana,
  siguientePestana,
} from "@/lib/pestanas-accesibles";

/** Prefijo de los identificadores de esta lista de pestañas en la página. */
const BASE_SUBIDA = "subida";
const MODOS_SUBIDA = ["single", "batch"] as const;

import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileText,
  FileUp,
  History,
  Info,
  Lightbulb,
  Loader2,
  Lock,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import {
  ARCHIVO_COLORES,
  CONTENEDOR_TIPOS,
  CONTENEDOR_TIPO_LABELS,
} from "@/lib/expedientes-archivo";
import { maxPdfSizeLabel } from "@/lib/upload-limits";
import type {
  DuplicateMatch,
  ExpedienteItem,
  ExpedienteLegajoItem,
  PdfInventory,
  SubirForm,
  WizardStep,
  WorkspaceTab,
} from "./types";
import type { UbicacionSugerida } from "@/lib/expedientes-archivo-actions";
import type { LastUbicacion } from "./use-preferences";
import type { BorradorSubir } from "./borrador-subir";
import { BatchUpload } from "./batch-upload";
import { LegajoPicker } from "./legajo-picker";
import { SkeletonList } from "./skeleton";
import {
  EXP_EMPTY,
  EXP_EMPTY_DESC,
  EXP_EMPTY_ILLUSTRATION,
  EXP_EMPTY_TITLE,
  EXP_FIELD,
  EXP_FIELD_CONTROL,
  EXP_FIELD_LABEL,
  EXP_FIELD_TEXTAREA,
  EXP_FILE_PICKER_FILE,
  EXP_FILE_PICKER_FILE_BODY,
  EXP_FILE_PICKER_FILE_META,
  EXP_FILE_PICKER_FILE_NAME,
  EXP_FILE_PICKER_SUB,
  EXP_FILE_PICKER_TITLE,
  EXP_FORM_SECTION,
  EXP_FORM_SECTION_HEADER,
  EXP_FORM_SECTION_HINT,
  EXP_FORM_SECTION_TITLE,
  EXP_HELP_TEXT,
  EXP_ICON_BUTTON,
  EXP_ICON_BUTTON_DANGER,
  EXP_SPIN,
  EXP_TAB_CONTENT,
  expBtnClass,
  expFilePickerClass,
  expFilePickerIconClass,
  expFormSectionCounterClass,
  expStatusClass,
} from "./estilos";
import { cn } from "@/lib/utils";

export type SubirTabContentProps = {
  // Permissions
  canManage: boolean;
  isAdmin: boolean;

  // Upload mode
  uploadMode: "single" | "batch";
  setUploadMode: (m: "single" | "batch") => void;

  // File handling
  file: File | null;
  setFile: (f: File | null) => void;
  isDragging: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onFileSelect: (f: File | null) => void;
  setExtractedData: React.Dispatch<React.SetStateAction<PdfInventory | null>>;

  // Form
  form: SubirForm;
  setField: <K extends keyof SubirForm>(key: K, value: SubirForm[K]) => void;
  autoBadge: (key: keyof SubirForm) => React.ReactNode;
  baseForm: SubirForm;
  setForm: React.Dispatch<React.SetStateAction<SubirForm>>;
  setAutoFilledFields: React.Dispatch<React.SetStateAction<Set<keyof SubirForm>>>;

  // Wizard
  wizardStep: WizardStep;
  setWizardStep: React.Dispatch<React.SetStateAction<WizardStep>>;
  canProceedStep: () => { ok: boolean; reason?: string };
  // Expediente (legajo) elegido para adjuntar el documento, o null para crear
  // uno nuevo (Fase 2 del legajo multidocumento).
  selectedLegajo: ExpedienteLegajoItem | null;
  setSelectedLegajo: (l: ExpedienteLegajoItem | null) => void;

  // Upload
  uploading: boolean;
  uploadProgress: number;
  uploadExpediente: (e: React.FormEvent) => void;

  // Extract
  extracting: boolean;
  extractedData: PdfInventory | null;
  extractFromPdf: (opts?: { auto?: boolean; fileArg?: File }) => Promise<void>;
  applyExtractedData: () => void;
  dismissExtractedData: () => void;

  // Duplicates
  duplicates: DuplicateMatch[];
  setDuplicates: React.Dispatch<React.SetStateAction<DuplicateMatch[]>>;
  dupsDismissed: boolean;
  setDupsDismissed: (v: boolean | ((prev: boolean) => boolean)) => void;
  checkingDuplicates: boolean;
  lastDupSignatureRef: React.MutableRefObject<string>;

  // Ubicacion
  ubicacionSugerida: UbicacionSugerida | null;
  siguientePaquete: string | null;
  applyUbicacionSugerida: (u: UbicacionSugerida) => void;

  // Recent uploads
  recentUploads: ExpedienteItem[];
  loadingRecent: boolean;
  hasRecentPending: boolean;
  refreshRecentUploads: () => void;

  // Shared actions
  reindexingId: string | null;
  deletingId: string | null;
  reindexExpediente: (id: string) => Promise<void>;
  deleteExpediente: (exp: ExpedienteItem) => void;
  setOpenExp: (exp: ExpedienteItem) => void;
  setTab: (t: WorkspaceTab) => void;

  // UI helpers
  showToast: (message: string, kind?: "success" | "error" | "warning" | "info") => void;
  showConfirm: (d: { title: string; message: string; variant: "danger" | "warning"; onConfirm: () => void | Promise<void> }) => void;
  formatBytes: (n: number) => string;
  statusLabel: (s: ExpedienteItem["status"]) => string;

  // Preferences
  autoExtract: boolean;
  setAutoExtract: (v: boolean) => void;
  lastUbicacion: LastUbicacion;
  setLastUbicacion: (u: LastUbicacion) => void;

  // Borrador del wizard (localStorage): banner de recuperación arriba del todo
  // y limpieza cuando el usuario cancela la subida a propósito.
  borradorPendiente: BorradorSubir | null;
  onRecuperarBorrador: () => void;
  onDescartarBorrador: () => void;
  onLimpiarBorrador: () => void;

  // Batch upload callback
  onUploaded: () => void;
};

const WIZARD_STEPS = [
  { id: 0, label: "Documento", hint: "Sube el PDF e identifica el documento" },
  { id: 1, label: "Contenido", hint: "Describe el contenido del expediente" },
  { id: 2, label: "Ubicación", hint: "Dónde se encuentra en papel" },
] as const;

/**
 * Campo editable para el preview de datos extraídos del PDF.
 * Permite al usuario revisar, modificar o eliminar cada campo
 * antes de aplicarlo al formulario.
 */
function EditableExtractedField({
  label,
  icon,
  value,
  onChange,
  onRemove,
  placeholder,
  type = "text",
  fullWidth = false,
  multiline = false,
}: {
  label: string;
  icon?: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  onRemove: () => void;
  placeholder?: string;
  type?: "text" | "number" | "date";
  fullWidth?: boolean;
  multiline?: boolean;
}) {
  const hasValue = value.trim().length > 0;
  return (
    <div
      className={cn(
        "group relative flex flex-col gap-1 rounded-exp border border-exp-line bg-exp-panel py-2 pl-3 pr-2.5 transition-all duration-[120ms] ease-linear hover:border-exp-brand hover:bg-exp-brand-soft focus-within:border-exp-brand focus-within:bg-exp-panel focus-within:shadow-[0_0_0_3px_rgba(15,118,110,0.12)]",
        fullWidth && "col-[1/-1]",
        hasValue ? "border-exp-brand/30" : "opacity-60",
      )}
    >
      <label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.5px] text-exp-brand [&>svg]:shrink-0">
        {icon}
        <span>{label}</span>
      </label>
      {multiline ? (
        <textarea
          className="w-full resize-y border-0 bg-transparent py-0.5 font-[inherit] text-[13px] font-medium text-exp-ink outline-none placeholder:font-normal placeholder:italic placeholder:text-exp-muted [min-height:38px] [line-height:1.4]"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
        />
      ) : (
        <input
          className="w-full border-0 bg-transparent py-0.5 font-[inherit] text-[13px] font-medium text-exp-ink outline-none placeholder:font-normal placeholder:italic placeholder:text-exp-muted"
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
      <button
        type="button"
        className="absolute right-1.5 top-1.5 inline-flex size-5 items-center justify-center rounded bg-exp-line-soft text-exp-muted opacity-0 transition-all duration-[120ms] ease-linear hover:bg-exp-danger hover:text-white group-hover:opacity-100 group-focus-within:opacity-100"
        onClick={onRemove}
        aria-label={`Quitar campo ${label}`}
        title={`Quitar ${label}`}
      >
        <X size={12} />
      </button>
    </div>
  );
}

export function SubirTabContent({
  canManage,
  isAdmin,
  uploadMode,
  setUploadMode,
  file,
  setFile,
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileSelect,
  setExtractedData,
  form,
  setField,
  autoBadge,
  baseForm,
  setForm,
  setAutoFilledFields,
  wizardStep,
  setWizardStep,
  canProceedStep,
  selectedLegajo,
  setSelectedLegajo,
  uploading,
  uploadProgress,
  uploadExpediente,
  extracting,
  extractedData,
  extractFromPdf,
  applyExtractedData,
  dismissExtractedData,
  duplicates,
  setDuplicates,
  dupsDismissed,
  setDupsDismissed,
  checkingDuplicates,
  lastDupSignatureRef,
  ubicacionSugerida,
  siguientePaquete,
  applyUbicacionSugerida,
  recentUploads,
  loadingRecent,
  hasRecentPending,
  refreshRecentUploads,
  reindexingId,
  deletingId,
  reindexExpediente,
  deleteExpediente,
  setOpenExp,
  setTab,
  showToast,
  showConfirm,
  formatBytes,
  statusLabel,
  autoExtract,
  setAutoExtract,
  lastUbicacion,
  setLastUbicacion,
  borradorPendiente,
  onRecuperarBorrador,
  onDescartarBorrador,
  onLimpiarBorrador,
  onUploaded,
}: SubirTabContentProps) {
  return canManage ? (
    <div className={cn("tw", EXP_TAB_CONTENT)}>
      {/* Borrador sin terminar guardado en este navegador (TTL 24 h). Ámbar
          deliberadamente más suave que el aviso de duplicados: no es un
          problema, es una oportunidad de no repetir el trabajo. */}
      {borradorPendiente ? (
        <div
          role="status"
          className="mb-4 flex flex-col gap-2 rounded-[10px] border border-[rgba(234,179,8,0.4)] bg-[rgba(234,179,8,0.08)] p-3.5"
        >
          <div className="flex flex-wrap items-center gap-2 font-semibold text-[13px] text-[#92400e]">
            <AlertCircle size={15} className="shrink-0" />
            Borrador sin terminar · guardado a las{" "}
            {new Date(borradorPendiente.savedAt).toLocaleTimeString("es-PE", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
          <span className={cn(EXP_HELP_TEXT, "mt-0")}>
            Tienes una subida a medias guardada en este navegador
            {borradorPendiente.fileName ? ` (PDF: ${borradorPendiente.fileName})` : ""}. El PDF
            no se guarda: tendrás que volver a seleccionarlo.
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className={expBtnClass("secondary", "small")}
              onClick={onRecuperarBorrador}
            >
              <History size={13} /> Recuperar
            </button>
            <button
              type="button"
              className={expBtnClass("ghost", "small")}
              onClick={onDescartarBorrador}
            >
              <X size={13} /> Descartar
            </button>
          </div>
        </div>
      ) : null}

      {/* Selector de modo: uno por uno vs por lotes */}
      {/* Estas SÍ son pestañas: cada una monta un panel completamente distinto
          (el formulario paso a paso o la carga por lotes). */}
      <div
        role="tablist"
        aria-label="Modo de subida"
        className="mb-4 flex gap-2"
        onKeyDown={(e) => {
          const destino = siguientePestana(MODOS_SUBIDA, uploadMode, e.key);
          if (!destino) return;
          e.preventDefault();
          setUploadMode(destino as typeof uploadMode);
          // Con índice móvil el foco no viaja solo: hay que llevarlo.
          document.getElementById(idPestana(BASE_SUBIDA, destino))?.focus();
        }}
      >
        <button
          type="button"
          {...propsPestana(BASE_SUBIDA, "single", uploadMode)}
          className={expBtnClass(uploadMode === "single" ? "primary" : "ghost")}
          onClick={() => setUploadMode("single")}
        >
          <FileText size={15} /> Uno por uno
        </button>
        <button
          type="button"
          {...propsPestana(BASE_SUBIDA, "batch", uploadMode)}
          className={expBtnClass(uploadMode === "batch" ? "primary" : "ghost")}
          onClick={() => setUploadMode("batch")}
        >
          <UploadCloud size={15} /> Por lotes
        </button>
      </div>

      <div {...propsPanel(BASE_SUBIDA, uploadMode)}>
      {uploadMode === "batch" ? (
        <BatchUpload
          autoExtract={autoExtract}
          lastUbicacion={lastUbicacion}
          setLastUbicacion={setLastUbicacion}
          onUploaded={onUploaded}
          showToast={showToast}
          showConfirm={showConfirm}
        />
      ) : (
      <form onSubmit={uploadExpediente}>
        <div className="mb-6">
          {/* Indicador de pasos, no pestañas: los pasos van en orden y arrastran
              el estado del formulario. `aria-current="step"` es lo que anuncia
              "vas por aquí"; `aria-selected` anunciaba una pestaña elegida. */}
          <div className="mb-4 rounded-exp bg-exp-line-soft px-[18px] py-5" role="group" aria-label="Pasos del formulario">
            <div className="relative">
              {/* Rieles de progreso a la altura del centro de los círculos
                  (size-9 = 36px → centro a 18px). Un solo tramo continuo, no
                  uno por segmento: así el ancho se calcula una vez por el
                  paso actual y no depende de alinear cada segmento a mano. */}
              <div className="absolute left-[18px] right-[18px] top-[18px] h-0.5 -translate-y-1/2 rounded-full bg-exp-line" aria-hidden="true" />
              <div
                className="absolute left-[18px] top-[18px] h-0.5 -translate-y-1/2 rounded-full bg-exp-success transition-[width] duration-500 ease-out"
                style={{ width: `calc((100% - 36px) * ${wizardStep / (WIZARD_STEPS.length - 1)})` }}
                aria-hidden="true"
              />
              <div className="relative flex items-start justify-between">
                {WIZARD_STEPS.map((step, idx) => {
                  const isActive = wizardStep === idx;
                  const isDone = wizardStep > idx;
                  return (
                    <button
                      key={step.id}
                      type="button"
                      aria-current={isActive ? "step" : undefined}
                      onClick={() => setWizardStep(idx as WizardStep)}
                      className="flex flex-col items-center gap-2 transition-opacity duration-[180ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:opacity-80"
                    >
                      <span
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-all duration-[220ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
                          isDone
                            ? "border-exp-success bg-exp-success text-white"
                            : isActive
                              ? "scale-110 border-exp-brand bg-exp-brand text-white shadow-[0_0_0_5px_rgba(15,118,110,0.15)]"
                              : "border-exp-line bg-exp-panel text-exp-muted",
                        )}
                      >
                        {isDone ? <Check size={15} /> : idx + 1}
                      </span>
                      <span
                        className={cn(
                          "max-w-[80px] overflow-hidden text-ellipsis whitespace-nowrap text-xs font-semibold transition-colors duration-[180ms]",
                          isDone ? "text-exp-success" : isActive ? "text-exp-ink" : "text-exp-muted",
                        )}
                      >
                        {step.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-xs text-exp-muted">
              <Info size={12} />
              <span>{WIZARD_STEPS[wizardStep].hint}</span>
            </div>
            <span className="shrink-0 rounded-full bg-exp-brand-soft px-2.5 py-1 text-[11px] font-bold text-exp-brand">
              Paso {wizardStep + 1} de {WIZARD_STEPS.length}
            </span>
          </div>
        </div>

        {wizardStep === 0 ? (
          <>
            <div className={EXP_FORM_SECTION}>
              <LegajoPicker selected={selectedLegajo} onSelect={setSelectedLegajo} />
            </div>
            <div className={EXP_FORM_SECTION}>
              <div className={EXP_FORM_SECTION_HEADER}>
                <h3 className={EXP_FORM_SECTION_TITLE}>
                  <FileUp size={16} /> 1. Carga el PDF
                  <span className={EXP_FORM_SECTION_HINT}>
                    Arrastra un archivo o haz clic para seleccionarlo
                  </span>
                </h3>
                {file ? (
                  <span className={cn(expFormSectionCounterClass(true), "inline-flex items-center gap-1")}>
                    <Check size={12} /> Cargado
                  </span>
                ) : null}
              </div>

              <label
                className={expFilePickerClass(isDragging ? "dragging" : file ? "hasFile" : undefined)}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
              >
                {file ? (
                  <div className={EXP_FILE_PICKER_FILE}>
                    <FileText size={20} />
                    <div className={EXP_FILE_PICKER_FILE_BODY}>
                      <strong className={EXP_FILE_PICKER_FILE_NAME}>{file.name}</strong>
                      <span className={EXP_FILE_PICKER_FILE_META}>{formatBytes(file.size)}</span>
                    </div>
                    <button
                      type="button"
                      className={expBtnClass("ghost")}
                      onClick={(e) => {
                        e.preventDefault();
                        setFile(null);
                        setExtractedData(null);
                      }}
                    >
                      <X size={14} /> Quitar
                    </button>
                  </div>
                ) : (
                  <>
                    <div className={expFilePickerIconClass()}>
                      <UploadCloud size={24} />
                    </div>
                    <p className={EXP_FILE_PICKER_TITLE}>
                      {isDragging
                        ? "Suelta el PDF aquí"
                        : "Arrastra un PDF o haz clic"}
                    </p>
                    <p className={EXP_FILE_PICKER_SUB}>
                      Tamaño máximo: {maxPdfSizeLabel}
                    </p>
                  </>
                )}
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => onFileSelect(e.target.files?.[0] ?? null)}
                />
              </label>

              {/* Toggle: analizar con IA automáticamente al cargar */}
              {canManage ? (
                <label className="mt-2.5 flex cursor-pointer items-center gap-2 text-[13px] text-exp-muted">
                  <input
                    type="checkbox"
                    checked={autoExtract}
                    onChange={(e) => setAutoExtract(e.target.checked)}
                  />
                  <Sparkles size={13} />
                  Analizar el PDF con IA automáticamente al cargarlo
                </label>
              ) : null}

              {/* Botón para extraer datos manualmente (si el auto está apagado o quieres re-analizar) */}
              {file && canManage ? (
                <div className="mt-3 flex flex-col items-start gap-2">
                  <button
                    type="button"
                    className={cn(
                      expBtnClass("secondary"),
                      "border-0 bg-[linear-gradient(135deg,var(--color-exp-brand)_0%,var(--color-exp-brand-dark)_100%)] text-white shadow-[0_2px_8px_rgba(15,118,110,0.18)] " +
                        "hover:not-disabled:bg-[linear-gradient(135deg,var(--color-exp-brand-dark)_0%,#0a3d3a_100%)] hover:not-disabled:shadow-[0_4px_14px_rgba(15,118,110,0.28)] hover:not-disabled:-translate-y-px " +
                        "disabled:cursor-wait disabled:opacity-70",
                    )}
                    onClick={() => extractFromPdf()}
                    disabled={extracting}
                    aria-label="Obtener datos del PDF automaticamente"
                  >
                    {extracting ? (
                      <>
                        <Loader2 size={16} className={EXP_SPIN} />
                        Analizando PDF con IA...
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} />
                        {autoExtract ? "Volver a analizar el PDF" : "Obtener datos del PDF"}
                      </>
                    )}
                  </button>
                  <span className={cn(EXP_HELP_TEXT, "mt-0")}>
                    <Info size={12} />
                    Usa OCR + IA para extraer número, fecha, materia, asunto y resumen.
                    No modifica el archivo ni indexa nada.
                  </span>
                </div>
              ) : null}

              {/* Aviso proactivo de posibles duplicados */}
              {duplicates.length > 0 && !dupsDismissed ? (
                <div
                  role="alert"
                  className="mt-3 flex flex-col gap-2 rounded-[10px] border border-[rgba(234,179,8,0.4)] bg-[rgba(234,179,8,0.08)] p-3"
                >
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertCircle size={15} />
                    Posible{duplicates.length === 1 ? "" : "s"} duplicado{duplicates.length === 1 ? "" : "s"} ({duplicates.length})
                  </div>
                  <span className={cn(EXP_HELP_TEXT, "mt-0")}>
                    Ya hay expedientes parecidos archivados. Revisa antes de subir para no duplicar.
                  </span>
                  <ul className="m-0 flex flex-col gap-0.5 pl-[18px] text-[13px]">
                    {duplicates.slice(0, 4).map((d) => (
                      <li key={d.id}>
                        {d.title}
                        {d.anio ? ` · ${d.anio}` : ""} · {d.status}
                      </li>
                    ))}
                  </ul>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={expBtnClass("ghost", "small")}
                      onClick={() => setDupsDismissed(true)}
                    >
                      Continuar de todos modos
                    </button>
                  </div>
                </div>
              ) : checkingDuplicates ? (
                <span className={cn(EXP_HELP_TEXT, "mt-2.5")}>
                  <Loader2 size={12} className={EXP_SPIN} /> Buscando posibles duplicados…
                </span>
              ) : null}

              {/* Preview de datos extraídos (editables) — el momento
                  protagonista de esta pantalla: es lo único que la IA hace
                  por ti, así que se trata distinto del resto del formulario
                  (barra superior en degradado, ícono con halo). */}
              {extractedData?.warnings?.length ? (
                <div role="status" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  {extractedData.warnings.map((warning) => <p key={warning}>{warning}</p>)}
                </div>
              ) : null}
              {extractedData ? (
                <div
                  className="relative mt-3.5 animate-exp-fade-in overflow-hidden rounded-exp border border-exp-brand/40 bg-[linear-gradient(135deg,var(--color-exp-brand-soft)_0%,var(--color-exp-panel)_55%)] p-3.5 shadow-[0_1px_2px_rgba(15,118,110,0.06),0_12px_28px_-10px_rgba(15,118,110,0.35)] before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-[linear-gradient(90deg,var(--color-exp-brand)_0%,#5eead4_50%,var(--color-exp-brand)_100%)] before:content-['']"
                  role="region"
                  aria-label="Datos extraídos del PDF (editables)"
                >
                  <div className="mb-3 flex items-start gap-3 border-b border-exp-brand/15 pb-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-exp-brand text-white shadow-[0_0_0_4px_rgba(15,118,110,0.12)]">
                      <Sparkles size={14} className="animate-exp-pulse" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <strong className="text-[13px] font-bold uppercase tracking-[0.4px] text-exp-ink">
                          Datos detectados en el PDF
                        </strong>
                        <span className="inline-block rounded-full bg-exp-brand px-1.5 py-px text-[9px] font-bold uppercase tracking-[0.5px] text-white">
                          editables
                        </span>
                        {extractedData.extractionMethod ? (
                          <span
                            className={expStatusClass(
                              extractedData.extractionMethod === "ai"
                                ? "indexed"
                                : extractedData.extractionMethod === "deterministic"
                                  ? "uploaded"
                                  : "processing",
                            )}
                          >
                            {extractedData.extractionMethod === "ai"
                              ? "IA"
                              : extractedData.extractionMethod === "deterministic"
                                ? "Automático"
                                : extractedData.extractionMethod === "hybrid"
                                  ? "Híbrido"
                                  : "Sin datos"}
                          </span>
                        ) : null}
                      </div>
                      <span className={cn(EXP_HELP_TEXT, "mt-0.5")}>
                        Edita o elimina los campos antes de aplicar. Solo
                        se rellenan los campos vacíos del formulario.
                      </span>
                    </div>
                  </div>
                  <div className="mb-3.5 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2.5">
                    {/* Etiqueta corregida a propósito: este valor NUNCA llena el
                        campo SGD (ese es manual, del sistema documental
                        externo — ver applyInventory en expedientes-archivo-
                        workspace.tsx). Solo alimenta Serie documental/Título
                        como respaldo si no hay cabecera reconocible; "SGD"
                        prometía algo que "Aplicar al formulario" no hacía. */}
                    <EditableExtractedField
                      label="N° detectado"
                      icon={<FileText size={11} />}
                      value={extractedData.numeroExpediente ?? ""}
                      onChange={(v) =>
                        setExtractedData((prev) =>
                          prev
                            ? {
                                ...prev,
                                numeroExpediente: v.trim() || null,
                              }
                            : prev,
                        )
                      }
                      onRemove={() =>
                        setExtractedData((prev) =>
                          prev
                            ? { ...prev, numeroExpediente: null }
                            : prev,
                        )
                      }
                      placeholder="N° del documento"
                    />
                    <EditableExtractedField
                      label="Tipo"
                      icon={<FileText size={11} />}
                      value={extractedData.tipoDocumento ?? ""}
                      onChange={(v) =>
                        setExtractedData((prev) =>
                          prev
                            ? {
                                ...prev,
                                tipoDocumento: v.trim() || null,
                              }
                            : prev,
                        )
                      }
                      onRemove={() =>
                        setExtractedData((prev) =>
                          prev
                            ? { ...prev, tipoDocumento: null }
                            : prev,
                        )
                      }
                      placeholder="Resolución, Oficio…"
                    />
                    <EditableExtractedField
                      label="Año"
                      icon={<History size={11} />}
                      value={extractedData.anio?.toString() ?? ""}
                      onChange={(v) =>
                        setExtractedData((prev) => {
                          if (!prev) return prev;
                          const year = v.trim()
                            ? Number.parseInt(v.trim(), 10)
                            : null;
                          return {
                            ...prev,
                            anio: year && !Number.isNaN(year) ? year : null,
                          };
                        })
                      }
                      onRemove={() =>
                        setExtractedData((prev) =>
                          prev ? { ...prev, anio: null } : prev,
                        )
                      }
                      placeholder="2024"
                      type="number"
                    />
                    <EditableExtractedField
                      label="Oficina"
                      icon={<Info size={11} />}
                      value={extractedData.oficina ?? ""}
                      onChange={(v) =>
                        setExtractedData((prev) =>
                          prev ? { ...prev, oficina: v.trim() || null } : prev,
                        )
                      }
                      onRemove={() =>
                        setExtractedData((prev) =>
                          prev ? { ...prev, oficina: null } : prev,
                        )
                      }
                      placeholder="Oficina emisora"
                    />
                    <EditableExtractedField
                      label="Materia"
                      icon={<Info size={11} />}
                      value={extractedData.materia ?? ""}
                      onChange={(v) =>
                        setExtractedData((prev) =>
                          prev
                            ? { ...prev, materia: v.trim() || null }
                            : prev,
                        )
                      }
                      onRemove={() =>
                        setExtractedData((prev) =>
                          prev ? { ...prev, materia: null } : prev,
                        )
                      }
                      placeholder="Materia del documento"
                    />
                    <EditableExtractedField
                      label="Asunto"
                      icon={<Info size={11} />}
                      value={extractedData.asunto ?? ""}
                      onChange={(v) =>
                        setExtractedData((prev) =>
                          prev
                            ? { ...prev, asunto: v.trim() || null }
                            : prev,
                        )
                      }
                      onRemove={() =>
                        setExtractedData((prev) =>
                          prev ? { ...prev, asunto: null } : prev,
                        )
                      }
                      placeholder="Asunto o sumilla"
                    />
                    <EditableExtractedField
                      label="Persona"
                      icon={<Info size={11} />}
                      value={extractedData.personaNombre ?? ""}
                      onChange={(v) =>
                        setExtractedData((prev) =>
                          prev ? { ...prev, personaNombre: v.trim() || null } : prev,
                        )
                      }
                      onRemove={() =>
                        setExtractedData((prev) =>
                          prev
                            ? { ...prev, personaNombre: null, personaTipo: null }
                            : prev,
                        )
                      }
                      placeholder="Persona/empresa interesada"
                    />
                    <EditableExtractedField
                      label="Folios"
                      icon={<FileText size={11} />}
                      value={extractedData.nroFolios?.toString() ?? ""}
                      onChange={(v) =>
                        setExtractedData((prev) => {
                          if (!prev) return prev;
                          const n = v.trim()
                            ? Number.parseInt(v.trim(), 10)
                            : null;
                          return {
                            ...prev,
                            nroFolios: n && !Number.isNaN(n) ? n : null,
                          };
                        })
                      }
                      onRemove={() =>
                        setExtractedData((prev) =>
                          prev ? { ...prev, nroFolios: null } : prev,
                        )
                      }
                      placeholder="Nº folios"
                      type="number"
                    />
                    <EditableExtractedField
                      label="Resumen"
                      icon={<FileText size={11} />}
                      value={extractedData.resumen ?? ""}
                      onChange={(v) =>
                        setExtractedData((prev) =>
                          prev
                            ? { ...prev, resumen: v.trim() || null }
                            : prev,
                        )
                      }
                      onRemove={() =>
                        setExtractedData((prev) =>
                          prev ? { ...prev, resumen: null } : prev,
                        )
                      }
                      placeholder="Resumen ejecutivo"
                      fullWidth
                      multiline
                    />
                  </div>
                  <div className="flex justify-end gap-2 border-t border-exp-brand/15 pt-2.5">
                    <button
                      type="button"
                      className={expBtnClass("ghost", "small")}
                      onClick={dismissExtractedData}
                    >
                      <X size={14} /> Descartar todos
                    </button>
                    <button
                      type="button"
                      className={expBtnClass("primary")}
                      onClick={applyExtractedData}
                    >
                      <Check size={14} /> Aplicar al formulario
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className={EXP_FORM_SECTION}>
              <div className={EXP_FORM_SECTION_HEADER}>
                <h3 className={EXP_FORM_SECTION_TITLE}>
                  <Info size={16} /> 2. Identifica el documento
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className={EXP_FIELD}>
                  <label className={EXP_FIELD_LABEL}>
                    SGD de expediente <span className="text-[11px] font-normal italic text-exp-muted">(opcional)</span>
                  </label>
                  <input
                    value={form.sgdExpediente}
                    onChange={(e) => setField("sgdExpediente", e.target.value)}
                    placeholder="N° del sistema de gestión documental"
                    className={EXP_FIELD_CONTROL}
                  />
                  <span className={EXP_HELP_TEXT}>
                    N° de expediente del sistema documental externo. Lo asignas tú (no se autocompleta).
                  </span>
                </div>
                <div className={EXP_FIELD}>
                  <label className={EXP_FIELD_LABEL}>Serie documental{autoBadge("serieDocumento")}</label>
                  <input
                    value={form.serieDocumento}
                    onChange={(e) => setField("serieDocumento", e.target.value)}
                    placeholder="Ej. Resolución 004-2024-MDCH-A"
                    className={EXP_FIELD_CONTROL}
                  />
                </div>
                <div className={EXP_FIELD}>
                  <label className={EXP_FIELD_LABEL}>Tipo de documento{autoBadge("tipoDocumento")}</label>
                  <select
                    value={form.tipoDocumento}
                    onChange={(e) => setField("tipoDocumento", e.target.value)}
                    className={EXP_FIELD_CONTROL}
                  >
                    <option value="">— Selecciona —</option>
                    <option value="Resolución">Resolución</option>
                    <option value="Oficio">Oficio</option>
                    <option value="Decreto">Decreto</option>
                    <option value="Ordenanza">Ordenanza</option>
                    <option value="Informe">Informe</option>
                    <option value="Memorando">Memorando</option>
                    <option value="Carta">Carta</option>
                    <option value="otro">Otro…</option>
                  </select>
                </div>
                {form.tipoDocumento === "otro" ? (
                  <div className={EXP_FIELD}>
                    <label className={EXP_FIELD_LABEL}>Especificar tipo</label>
                    <input
                      value={form.tipoDocumentoCustom}
                      onChange={(e) => setField("tipoDocumentoCustom", e.target.value)}
                      placeholder="Escribe el tipo de documento"
                      className={EXP_FIELD_CONTROL}
                    />
                  </div>
                ) : null}
                <div className={EXP_FIELD}>
                  <label className={EXP_FIELD_LABEL}>
                    Año <span className="text-[11px] font-normal italic text-exp-muted">(opcional)</span>
                    {autoBadge("anio")}
                  </label>
                  <input
                    type="number"
                    value={form.anio}
                    onChange={(e) => setField("anio", e.target.value)}
                    placeholder="2024"
                    className={EXP_FIELD_CONTROL}
                  />
                </div>
                <div className={EXP_FIELD}>
                  <label className={EXP_FIELD_LABEL}>
                    Folios <span className="text-[11px] font-normal italic text-exp-muted">(opcional)</span>
                    {autoBadge("folio")}
                  </label>
                  <input
                    value={form.folio}
                    onChange={(e) => setField("folio", e.target.value)}
                    placeholder="Nº de páginas del PDF"
                    className={EXP_FIELD_CONTROL}
                  />
                </div>
                <div className={cn(EXP_FIELD, "col-span-full")}>
                  <label className={EXP_FIELD_LABEL}>
                    Oficina{" "}
                    {isAdmin ? (
                      <span className="text-[11px] font-normal italic text-exp-muted">(opcional)</span>
                    ) : (
                      <span className="text-[11px] font-normal italic text-exp-muted">(asignada a tu oficina)</span>
                    )}
                    {autoBadge("oficina")}
                  </label>
                  <input
                    value={form.oficina}
                    onChange={(e) => setField("oficina", e.target.value)}
                    placeholder="Subgerencia, área, dirección…"
                    className={EXP_FIELD_CONTROL}
                    readOnly={!isAdmin}
                    title={!isAdmin ? "La oficina se asigna automáticamente según tu perfil" : undefined}
                  />
                </div>
                <div className={cn(EXP_FIELD, "col-span-full")}>
                  <label className={EXP_FIELD_LABEL}>
                    Título <span className="text-[11px] font-normal italic text-exp-muted">(opcional)</span>
                    {autoBadge("title")}
                  </label>
                  <input
                    value={form.title}
                    onChange={(e) => setField("title", e.target.value)}
                    placeholder="Si lo dejas vacío se usa el nombre del archivo"
                    className={EXP_FIELD_CONTROL}
                  />
                  <span className={EXP_HELP_TEXT}>
                    <Info size={12} /> El título se mostrará en los resultados de búsqueda.
                  </span>
                </div>
              </div>
            </div>
          </>
        ) : null}

        {wizardStep === 1 ? (
          <div className={EXP_FORM_SECTION}>
            <div className={EXP_FORM_SECTION_HEADER}>
              <h3 className={EXP_FORM_SECTION_TITLE}>
                <FileText size={16} /> Describe el contenido
                <span className={EXP_FORM_SECTION_HINT}>
                  Estos campos ayudan a la IA a encontrar el expediente
                </span>
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className={EXP_FIELD}>
                <label className={EXP_FIELD_LABEL}>Materia{autoBadge("materia")}</label>
                <input
                  value={form.materia}
                  onChange={(e) => setField("materia", e.target.value)}
                  placeholder="Contratación, personal, presupuesto…"
                  className={EXP_FIELD_CONTROL}
                />
              </div>
              <div className={EXP_FIELD}>
                <label className={EXP_FIELD_LABEL}>Asunto{autoBadge("asunto")}</label>
                <input
                  value={form.asunto}
                  onChange={(e) => setField("asunto", e.target.value)}
                  placeholder="Asunto o sumilla del documento"
                  className={EXP_FIELD_CONTROL}
                />
              </div>
              <div className={cn(EXP_FIELD, "col-span-full")}>
                <label className={EXP_FIELD_LABEL}>Resumen{autoBadge("resumen")}</label>
                <textarea
                  rows={3}
                  value={form.resumen}
                  onChange={(e) => setField("resumen", e.target.value)}
                  placeholder="Resumen ejecutivo (3-5 líneas)"
                  className={EXP_FIELD_TEXTAREA}
                />
              </div>
              <div className={cn(EXP_FIELD, "col-span-full")}>
                <label className={EXP_FIELD_LABEL}>Observaciones</label>
                <textarea
                  rows={2}
                  value={form.observaciones}
                  onChange={(e) => setField("observaciones", e.target.value)}
                  placeholder="Notas adicionales sobre este expediente"
                  className={EXP_FIELD_TEXTAREA}
                />
              </div>
            </div>
          </div>
        ) : null}

        {wizardStep === 2 ? (
          <div className={EXP_FORM_SECTION}>
            <div className={EXP_FORM_SECTION_HEADER}>
              <h3 className={EXP_FORM_SECTION_TITLE}>
                <MapPin size={16} /> Ubicación física
                <span className={EXP_FORM_SECTION_HINT}>
                  Dónde se encuentra el expediente en papel
                </span>
              </h3>
            </div>

            {/* Sugerencias inteligentes de ubicación física */}
            {(() => {
              const last = lastUbicacion;
              const hasLast = Object.values(last).some((v) => v && String(v).trim());
              const hasSugerida = Boolean(
                ubicacionSugerida &&
                  Object.values(ubicacionSugerida).some((v) => v !== null && v !== ""),
              );
              if (!hasLast && !hasSugerida && !siguientePaquete) return null;
              return (
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className={cn(EXP_HELP_TEXT, "mt-0")}>
                    <Lightbulb size={12} /> Sugerencias:
                  </span>
                  {hasLast ? (
                    <button
                      type="button"
                      className={expBtnClass("secondary", "small")}
                      onClick={() => {
                        applyUbicacionSugerida({
                          tipo_almacenamiento: last.tipoAlmacenamiento || null,
                          nro_archivador: last.nroArchivador || null,
                          nro_paquete: last.nroPaquete || null,
                          empastado:
                            last.empastado === "si"
                              ? true
                              : last.empastado === "no"
                                ? false
                                : null,
                          color_archivador: last.colorArchivador || null,
                          nro_estante: last.nroEstante || null,
                          nro_piso: last.nroPiso || null,
                          nro_local: last.nroLocal || null,
                        });
                      }}
                    >
                      <History size={13} /> Usar última ubicación
                    </button>
                  ) : null}
                  {hasSugerida && ubicacionSugerida ? (
                    <button
                      type="button"
                      className={expBtnClass("secondary", "small")}
                      onClick={() => applyUbicacionSugerida(ubicacionSugerida)}
                    >
                      <MapPin size={13} /> Misma caja del archivo
                    </button>
                  ) : null}
                  {siguientePaquete ? (
                    <button
                      type="button"
                      className={expBtnClass("ghost", "small")}
                      onClick={() => setField("nroPaquete", siguientePaquete)}
                      title="Siguiente número de paquete disponible"
                    >
                      <Plus size={13} /> Paquete {siguientePaquete}
                    </button>
                  ) : null}
                </div>
              );
            })()}
            <div className="grid grid-cols-2 gap-3">
              <div className={EXP_FIELD}>
                <label className={EXP_FIELD_LABEL}>Tipo de contenedor{autoBadge("tipoAlmacenamiento")}</label>
                <select
                  value={form.tipoAlmacenamiento}
                  onChange={(e) => setField("tipoAlmacenamiento", e.target.value)}
                  className={EXP_FIELD_CONTROL}
                >
                  <option value="">— Sin contenedor —</option>
                  {CONTENEDOR_TIPOS.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {CONTENEDOR_TIPO_LABELS[tipo]}
                    </option>
                  ))}
                </select>
              </div>
              {/* Un solo campo "Nº de <tipo>", no uno fijo por cada tipo posible:
                  el número solo tiene sentido para el contenedor que se eligió
                  arriba, y antes se pedían archivador Y paquete a la vez aunque
                  el documento estuviera en uno solo. */}
              {form.tipoAlmacenamiento === "archivador" ? (
                <div className={EXP_FIELD}>
                  <label className={EXP_FIELD_LABEL}>Nº de archivador{autoBadge("nroArchivador")}</label>
                  <input
                    value={form.nroArchivador}
                    onChange={(e) => setField("nroArchivador", e.target.value)}
                    placeholder="Ej. 12"
                    className={EXP_FIELD_CONTROL}
                  />
                </div>
              ) : null}
              {form.tipoAlmacenamiento === "paquete" ? (
                <div className={EXP_FIELD}>
                  <label className={EXP_FIELD_LABEL}>Nº de paquete{autoBadge("nroPaquete")}</label>
                  <input
                    value={form.nroPaquete}
                    onChange={(e) => setField("nroPaquete", e.target.value)}
                    placeholder="Opcional"
                    className={EXP_FIELD_CONTROL}
                  />
                </div>
              ) : null}
              <div className={EXP_FIELD}>
                <label className={EXP_FIELD_LABEL}>Empastado{autoBadge("empastado")}</label>
                <select
                  value={form.empastado}
                  onChange={(e) => setField("empastado", e.target.value)}
                  className={EXP_FIELD_CONTROL}
                >
                  <option value="">— Sin definir —</option>
                  <option value="si">Sí</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div className={EXP_FIELD}>
                <label className={EXP_FIELD_LABEL}>Color{autoBadge("colorArchivador")}</label>
                <select
                  value={form.colorArchivador}
                  onChange={(e) => setField("colorArchivador", e.target.value)}
                  className={EXP_FIELD_CONTROL}
                >
                  <option value="">— Sin color —</option>
                  {ARCHIVO_COLORES.map((color) => (
                    <option key={color} value={color}>
                      {color}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-6 flex items-center justify-between gap-2.5 border-t border-exp-line pt-4">
          <div className="flex gap-2.5">
            {wizardStep > 0 ? (
              <button
                type="button"
                className={expBtnClass("ghost")}
                onClick={() => setWizardStep((s) => (s - 1) as WizardStep)}
              >
                <ChevronLeft size={16} /> Anterior
              </button>
            ) : null}
            <button
              type="button"
              className={expBtnClass("ghost")}
              onClick={() => {
                showConfirm({
                  title: "¿Cancelar subida?",
                  message:
                    "Se perderán los datos del formulario y el PDF seleccionado. ¿Estás seguro?",
                  variant: "warning",
                  onConfirm: () => {
                    setForm(baseForm);
                    setFile(null);
                    setExtractedData(null);
                    setAutoFilledFields(new Set());
                    setDuplicates([]);
                    setDupsDismissed(false);
                    setSelectedLegajo(null);
                    lastDupSignatureRef.current = "";
                    setWizardStep(0);
                    // Cancelar a propósito descarta también el borrador: si lo
                    // conserváramos, el banner volvería a ofrecer lo que acaba
                    // de decidir tirar.
                    onLimpiarBorrador();
                    showToast("Subida cancelada", "info");
                  },
                });
              }}
            >
              <X size={14} /> Cancelar
            </button>
          </div>
          {wizardStep < WIZARD_STEPS.length - 1 ? (
            <div className="flex gap-2.5">
              {file && !extracting ? (
                <button
                  type="submit"
                  disabled={uploading}
                  className={expBtnClass("ghost")}
                  title="Subir ya con los datos actuales (los campos vacíos los completa la IA)"
                >
                  {uploading ? (
                    <Loader2 size={16} className={EXP_SPIN} />
                  ) : (
                    <UploadCloud size={16} />
                  )}
                  Subir ahora
                </button>
              ) : null}
              <button
                type="button"
                className={expBtnClass("primary")}
                onClick={() => {
                  const check = canProceedStep();
                  if (!check.ok) {
                    showToast(check.reason ?? "Completa los datos requeridos", "warning");
                    return;
                  }
                  setWizardStep((s) => (s + 1) as WizardStep);
                }}
              >
                Siguiente <ChevronRight size={16} />
              </button>
            </div>
          ) : (
            <button
              type="submit"
              disabled={uploading}
              className={expBtnClass("primary", "large")}
            >
              {uploading ? (
                <Loader2 size={16} className={EXP_SPIN} />
              ) : (
                <UploadCloud size={16} />
              )}
              {uploading ? `Subiendo… ${uploadProgress}%` : "Subir al archivo"}
            </button>
          )}
        </div>

        {uploading && uploadProgress > 0 && uploadProgress < 100 ? (
          <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-exp-line-soft">
            <div
              className="relative h-full rounded-full bg-[linear-gradient(90deg,var(--color-exp-brand)_0%,var(--color-exp-brand-dark)_100%)] transition-[width] duration-[240ms] ease-linear after:absolute after:inset-0 after:animate-exp-shimmer after:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)] after:content-['']"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        ) : null}
      </form>
      )}
      </div>

      {/* Lista de expedientes subidos (recientes) */}
      {canManage ? (
        <div className="mt-8 border-t-2 border-exp-line pt-5" aria-label="Expedientes subidos recientemente">
          <div className={cn(EXP_FORM_SECTION_HEADER, "mt-8")}>
            <h3 className={EXP_FORM_SECTION_TITLE}>
              <FileUp size={16} /> Expedientes subidos recientemente
              <span className={EXP_FORM_SECTION_HINT}>
                {recentUploads.length} de los últimos subidos
              </span>
            </h3>
            {recentUploads.length > 0 ? (
              <button
                type="button"
                className={expBtnClass("ghost", "small")}
                onClick={refreshRecentUploads}
                disabled={loadingRecent}
                aria-label="Actualizar lista de recientes"
              >
                {loadingRecent ? (
                  <Loader2 size={12} className={EXP_SPIN} />
                ) : (
                  <RefreshCw size={12} />
                )}
                Actualizar
              </button>
            ) : null}
          </div>

          {hasRecentPending ? (
            <div
              className="mb-3 flex animate-[expSlideDown_200ms_ease] items-center gap-2.5 rounded-exp border-l-[3px] border-l-exp-info bg-[linear-gradient(90deg,var(--color-exp-info-soft)_0%,transparent_100%)] px-3.5 py-2.5 text-[13px] text-exp-info [&>svg]:shrink-0"
              role="status"
            >
              <Loader2 size={14} className={EXP_SPIN} />
              <span>
                <strong className="font-bold">Indexando con Pinecone...</strong> Los expedientes
                marcados como &quot;Procesando&quot; están siendo vectorizados y
                fragmentados. La lista se actualiza automáticamente cada 4s.
              </span>
            </div>
          ) : null}

          {loadingRecent && recentUploads.length === 0 ? (
            <SkeletonList count={3} />
          ) : recentUploads.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-exp border border-dashed border-exp-line bg-exp-line-soft px-5 py-8 text-center text-[13px] text-exp-muted [&>svg]:text-exp-brand [&>svg]:opacity-60">
              <FileText size={20} />
              <p className="m-0 max-w-[320px]">
                Aún no has subido expedientes. Completa el wizard de arriba
                para empezar.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {recentUploads.map((exp) => (
                <article
                  key={exp.id}
                  className={cn(
                    "grid grid-cols-[40px_1fr_auto] items-center gap-3 rounded-exp border border-exp-line bg-exp-panel p-3.5 transition-all duration-150 ease-[cubic-bezier(0.4,0,0.2,1)] hover:translate-x-1 hover:border-exp-brand hover:bg-exp-line-soft hover:shadow-[0_2px_8px_rgba(15,118,110,0.08)]",
                    (exp.status === "processing" || exp.status === "uploaded") &&
                      "border-l-[3px] border-l-exp-warning bg-[linear-gradient(90deg,var(--color-exp-warning-soft)_0%,var(--color-exp-panel)_30%)]",
                    exp.status === "error" &&
                      "border-l-[3px] border-l-exp-danger bg-[linear-gradient(90deg,var(--color-exp-danger-soft)_0%,var(--color-exp-panel)_30%)]",
                  )}
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-exp bg-exp-brand-soft text-exp-brand">
                    <FileText size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <strong className="max-w-[360px] overflow-hidden text-ellipsis whitespace-nowrap text-sm font-bold text-exp-ink">
                        {exp.title}
                      </strong>
                      <span className={expStatusClass(exp.status)} data-status={exp.status}>
                        {statusLabel(exp.status)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-exp-muted [&>span]:whitespace-nowrap">
                      {exp.serie_documento ? (
                        <span>{exp.serie_documento}</span>
                      ) : (
                        <span>Sin número</span>
                      )}
                      {exp.anio ? <span>· {exp.anio}</span> : null}
                      {exp.oficina ? <span>· {exp.oficina}</span> : null}
                      <span>· {formatBytes(exp.file_size)}</span>
                      <span>· {new Date(exp.created_at).toLocaleDateString("es-PE")}</span>
                    </div>
                    {exp.metadata?.chunkCount ? (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-exp-muted [&>span]:whitespace-nowrap">
                        <span>
                          {exp.metadata.pageCount ?? 0} páginas · {exp.metadata.chunkCount} fragmentos
                        </span>
                      </div>
                    ) : null}
                    {exp.error_message ? (
                      <div className="mt-1 rounded bg-exp-danger-soft px-2 py-1 text-xs text-exp-danger">
                        {exp.error_message}
                        <div className="mt-2">
                          <button
                            type="button"
                            className={expBtnClass("secondary", "small")}
                            onClick={() => void reindexExpediente(exp.id)}
                            disabled={reindexingId === exp.id}
                            title="Reintenta la extracción con OCR de alta calidad"
                          >
                            {reindexingId === exp.id ? (
                              <Loader2 size={13} className={EXP_SPIN} />
                            ) : (
                              <RefreshCw size={13} />
                            )}
                            Reintentar con OCR de alta calidad
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div
                    className="flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenExp(exp)}
                      className={EXP_ICON_BUTTON}
                      aria-label="Ver detalle"
                      title="Ver detalle"
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void reindexExpediente(exp.id)}
                      disabled={reindexingId === exp.id}
                      className={EXP_ICON_BUTTON}
                      aria-label="Reindexar"
                      title="Reindexar"
                    >
                      <RefreshCw
                        size={14}
                        className={reindexingId === exp.id ? EXP_SPIN : ""}
                      />
                    </button>
                    <a
                      href={`/api/expedientes-archivo/${exp.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className={EXP_ICON_BUTTON}
                      aria-label="Descargar PDF"
                      title="Descargar PDF"
                    >
                      <Download size={14} />
                    </a>
                    <button
                      type="button"
                      onClick={() => void deleteExpediente(exp)}
                      disabled={deletingId === exp.id}
                      className={cn(EXP_ICON_BUTTON, EXP_ICON_BUTTON_DANGER)}
                      aria-label="Eliminar"
                      title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </article>
              ))}
              {recentUploads.length >= 10 ? (
                <button
                  type="button"
                  className={cn(expBtnClass("secondary"), "mt-3 self-center")}
                  onClick={() => setTab("buscar")}
                >
                  Ver todos los expedientes
                  <ArrowRight size={14} />
                </button>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  ) : (
    <div className={cn("tw", EXP_TAB_CONTENT)}>
      <div className={EXP_EMPTY}>
        <div className={EXP_EMPTY_ILLUSTRATION}>
          <Lock size={28} />
        </div>
        <h3 className={EXP_EMPTY_TITLE}>Acceso restringido</h3>
        <p className={EXP_EMPTY_DESC}>
          La carga y gestión de expedientes requiere rol DEC/Editor o administrador.
          Puedes buscar y consultar todos los expedientes indexados.
        </p>
        <button
          type="button"
          className={cn(expBtnClass("secondary"), "mt-2")}
          onClick={() => setTab("buscar")}
        >
          <Search size={16} /> Ir a buscar
        </button>
      </div>
    </div>
  );
}
