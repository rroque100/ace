"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FileText,
  Filter,
  Info,
  Layers3,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UploadCloud,
} from "lucide-react";
import {
  DOCUMENT_TYPES,
  documentTypeLabel,
  processTypeLabel,
  type TaxonomyOption,
} from "@/lib/legal-taxonomy";
import { supportsAmendment } from "@/lib/documents";
import { maxPdfSizeBytes, maxPdfSizeLabel } from "@/lib/upload-limits";
import { processLabelFromOptions, useSettingsCatalog, withBlankProcessOption } from "./use-settings-catalog";

type DocumentItem = {
  id: string;
  title: string;
  file_name: string;
  file_size: number;
  document_type: string;
  process_type?: string | null;
  error_message: string | null;
  metadata: {
    amends?: string | null;
    changeCategory?: string | null;
    changeNote?: string | null;
    ai?: {
      classificationConfidence?: string;
      suggestedDocumentType?: string | null;
      suggestedSourceEntity?: string | null;
    };
    chunkCount?: number;
    indexingPipelineVersion?: string;
    extractionMethod?: string;
    ocrPartial?: boolean;
    pageCount?: number;
    pinecone?: {
      recordCount?: number;
      verification?: {
        hitCount?: number;
        verified?: boolean;
      };
    };
    processType?: string | null;
    summary?: string;
    textLength?: number;
    topic?: string | null;
    vigencia?: string | null;
    year?: number | null;
  };
  source_entity: string | null;
  status: "uploaded" | "processing" | "indexed" | "error";
  created_at: string;
  oficina_id?: string | null;
  es_institucional?: boolean;
};

type DocumentsResponse = {
  documents: DocumentItem[];
  error?: string;
  setupRequired?: boolean;
};

type PendingAction = {
  document: DocumentItem;
  type: "delete" | "reindex";
} | null;

type BulkDeleteTarget = {
  count: number;
  documentType: string;
  processType: string;
} | null;

type BulkReindexTarget = {
  count: number;
  ids: string[];
} | null;
type CorpusQuality = {
  procedures: Array<{
    missingDocumentTypes?: Array<{
      documentType: string;
      documentTypeLabel: string;
      reason: string;
    }>;
    operationalReady: boolean;
    processType: string;
    processTypeLabel: string;
    score: number;
    status: "listo" | "operativo_sin_norma_completa" | "incompleto";
    typeCoverage: Array<{
      documentType: string;
      documentTypeLabel: string;
      documents: number;
      ready: boolean;
    }>;
  }>;
};

const documentTypes = DOCUMENT_TYPES;

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function statusLabel(status: DocumentItem["status"]) {
  const labels = {
    error: "Error",
    indexed: "Indexado",
    processing: "Procesando",
    uploaded: "Subido",
  };

  return labels[status];
}

function getDocumentProcessType(document: DocumentItem) {
  return document.process_type ?? document.metadata?.processType ?? "";
}

function isPineconeVerified(document: DocumentItem) {
  return document.metadata?.pinecone?.verification?.verified === true;
}

function hasUsableTrace(document: DocumentItem) {
  return (
    document.status === "indexed" &&
    Boolean(document.metadata?.chunkCount) &&
    Boolean(document.metadata?.pageCount) &&
    isPineconeVerified(document)
  );
}

function needsReindex(document: DocumentItem) {
  if (document.status === "error" || document.status === "uploaded") {
    return true;
  }

  if (document.status !== "indexed") {
    return false;
  }

  return !document.metadata?.chunkCount || !document.metadata?.pageCount || !isPineconeVerified(document);
}

// Alcance del tipo de proceso segun el tipo documental:
// - "todos": Ley y Reglamento se aplican a todos los procesos (process_type = "todos").
// - "general": Opiniones son de alcance general, sin proceso asociado (process_type vacio).
// - "required": Directivas y Bases se clasifican por el proceso especifico al que aplican.
// - "optional": resto de tipos (resolucion, contrato, expediente, otros) sin restriccion.
type ProcessScope = "todos" | "general" | "required" | "optional";

function processScopeFor(documentType: string): ProcessScope {
  if (documentType === "ley" || documentType === "reglamento") {
    return "todos";
  }

  if (documentType === "opinion") {
    return "general";
  }

  if (documentType === "directiva" || documentType === "bases_integradas") {
    return "required";
  }

  return "optional";
}

function uploadGuidance(documentType: string) {
  if (documentType === "opinion") {
    return "Opinión del OECE: interpreta el sentido o alcance de la norma. No es un proceso de selección; sus criterios aplican a todos los procesos.";
  }

  switch (processScopeFor(documentType)) {
    case "todos":
      return "Ley y Reglamento se aplican a todos los tipos de proceso.";
    case "general":
      return "Documento de alcance general: aplica a todos los procesos.";
    case "required":
      return "Selecciona el tipo de proceso al que aplican la directiva o las bases.";
    default:
      return "Clasifica el documento con el tipo y proceso mas preciso posible.";
  }
}

export function DocumentUpload() {
  const { processTypes: configuredProcessTypes } = useSettingsCatalog();
  const processTypes = withBlankProcessOption(configuredProcessTypes, "No aplica");
  const labelProcessType = (value?: string | null) =>
    processLabelFromOptions(configuredProcessTypes, value) ?? processTypeLabel(value);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [documentType, setDocumentType] = useState("opinion");
  const [file, setFile] = useState<File | null>(null);
  const [bulkDeleteTarget, setBulkDeleteTarget] = useState<BulkDeleteTarget>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkReindexTarget, setBulkReindexTarget] = useState<BulkReindexTarget>(null);
  const [bulkReindexing, setBulkReindexing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filterDocumentType, setFilterDocumentType] = useState("");
  const [filterProcessType, setFilterProcessType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [processType, setProcessType] = useState("");
  const [reindexingId, setReindexingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  // Institucional = visible para cualquier oficina; si no, solo la que sube lo
  // ve (y admin). Default false: la excepción se marca a propósito.
  const [esInstitucional, setEsInstitucional] = useState(false);
  const [changeCategory, setChangeCategory] = useState("original");
  const [amendsDocumentId, setAmendsDocumentId] = useState("");
  const [amendsNote, setAmendsNote] = useState("");
  const [quality, setQuality] = useState<CorpusQuality | null>(null);

  const selectedFileLabel = useMemo(() => {
    if (!file) {
      return "Selecciona un PDF juridico";
    }

    return `${file.name} · ${formatBytes(file.size)}`;
  }, [file]);
  const filteredDocuments = useMemo(
    () =>
      documents.filter((document) => {
        const matchesType = filterDocumentType ? document.document_type === filterDocumentType : true;
        const matchesProcess = filterProcessType ? getDocumentProcessType(document) === filterProcessType : true;
        const matchesStatus = filterStatus ? document.status === filterStatus : true;

        return matchesType && matchesProcess && matchesStatus;
      }),
    [documents, filterDocumentType, filterProcessType, filterStatus],
  );
  const integratedBasesCount = documents.filter(
    (document) => document.document_type === "bases_integradas",
  ).length;
  const directiveCount = documents.filter((document) => document.document_type === "directiva").length;
  const indexedCount = documents.filter((document) => document.status === "indexed").length;
  const usableCount = documents.filter(hasUsableTrace).length;
  const reindexRecommended = documents.filter(needsReindex);
  const normativeTypes = ["ley", "reglamento", "directiva", "opinion"];
  const corpusChecklist = normativeTypes.map((type) => {
    const typeDocuments = documents.filter((document) => document.document_type === type);
    const indexedDocuments = typeDocuments.filter((document) => document.status === "indexed");
    const usableDocuments = typeDocuments.filter(hasUsableTrace);

    return {
      count: typeDocuments.length,
      indexed: indexedDocuments.length,
      ready: usableDocuments.length > 0,
      title: documentTypeLabel(type),
      usable: usableDocuments.length,
    };
  });
  const globalScopeIssues = documents.filter(
    (document) =>
      ["ley", "reglamento"].includes(document.document_type) &&
      document.status === "indexed" &&
      getDocumentProcessType(document) &&
      getDocumentProcessType(document) !== "todos",
  );
  const bulkDeleteCount = filteredDocuments.filter(
    (document) =>
      ["bases_integradas", "directiva"].includes(document.document_type) &&
      (!filterProcessType || getDocumentProcessType(document) === filterProcessType),
  ).length;
  const canBulkDelete =
    bulkDeleteCount > 0 &&
    ["bases_integradas", "directiva"].includes(filterDocumentType) &&
    Boolean(filterProcessType);
  const canBulkReindex = filteredDocuments.length > 0 && !bulkReindexing;

  // Opciones del selector de proceso en la subida, segun el alcance del tipo documental.
  const uploadProcessScope = processScopeFor(documentType);
  const uploadProcessDisabled = uploadProcessScope === "todos" || uploadProcessScope === "general";
  const uploadProcessOptions: TaxonomyOption[] =
    uploadProcessScope === "todos"
      ? [{ label: "Todos los procesos", value: "todos" }]
      : uploadProcessScope === "general"
        ? [{ label: "Aplica a todos los procesos (general)", value: "" }]
        : uploadProcessScope === "required"
          ? [{ label: "Selecciona el proceso…", value: "" }, ...configuredProcessTypes]
          : withBlankProcessOption(configuredProcessTypes, "No aplica");
  // Normas ya indexadas que pueden ser modificadas por el documento que se sube.
  const amendableDocuments = documents.filter(
    (document) => supportsAmendment(document.document_type) && document.status === "indexed",
  );
  const changeCategoryHint =
    changeCategory === "modificatoria"
      ? "Enlázala con la norma que modifica."
      : changeCategory === "modificada"
        ? "Marca que esta norma recibió cambios posteriores."
        : "La norma se registra como versión original/vigente.";
  const uploadProcessHint =
    uploadProcessScope === "todos"
      ? "La Ley y el Reglamento se aplican a todos los procesos."
      : uploadProcessScope === "general"
        ? "Alcance general: sus criterios aplican a todos los procesos."
        : uploadProcessScope === "required"
          ? "Obligatorio: elige el proceso al que aplica."
          : "Opcional: asígnalo solo si aplica a un proceso concreto.";

  const loadDocuments = useCallback(async () => {
    // No limpia `message` para no borrar el aviso de "procesando" durante el polling.
    const response = await fetch("/api/documents", { cache: "no-store" });
    const payload = (await response.json()) as DocumentsResponse;

    if (!response.ok) {
      setMessage(payload.error ?? "No se pudieron cargar documentos");
      return;
    }

    setDocuments(payload.documents);
  }, []);
  const loadQuality = useCallback(async () => {
    try {
      const response = await fetch("/api/corpus/quality", { cache: "no-store" });
      const payload = (await response.json()) as CorpusQuality;
      if (response.ok) {
        setQuality(payload);
      }
    } catch {
      setQuality(null);
    }
  }, []);
  const hasPendingDocuments = useMemo(
    () => documents.some((document) => document.status === "uploaded" || document.status === "processing"),
    [documents],
  );

  useEffect(() => {
    // Initial sync with the documents API when the upload panel mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDocuments();
    void loadQuality();
  }, [loadDocuments, loadQuality]);

  useEffect(() => {
    // Mientras haya documentos indexandose en segundo plano, refresca el estado
    // periodicamente. La dependencia es el booleano (no la lista), de modo que el
    // intervalo no se reinicia en cada refresco y el tope de intentos se respeta.
    if (!hasPendingDocuments) {
      return;
    }

    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;

      if (attempts > 75) {
        clearInterval(timer);
        return;
      }

      void loadDocuments();
    }, 4000);

    return () => clearInterval(timer);
  }, [hasPendingDocuments, loadDocuments]);

  async function uploadDocument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      setMessage("Selecciona un archivo PDF antes de subir.");
      return;
    }

    if (file.size > maxPdfSizeBytes) {
      setMessage(`El PDF supera el limite de ${maxPdfSizeLabel}.`);
      return;
    }

    const scope = processScopeFor(documentType);

    if (scope === "required" && (!processType || processType === "todos")) {
      setMessage("Selecciona el tipo de proceso al que aplican la directiva o las bases.");
      return;
    }

    // Normaliza el proceso al alcance del tipo documental antes de enviar.
    const processTypeToSend = scope === "todos" ? "todos" : scope === "general" ? "" : processType;

    // Categoria de cambio (paso 2): original | modificatoria | modificada.
    let amendsToSend = "";
    let amendsDocumentIdToSend = "";
    let changeNoteToSend = "";
    if (changeCategory === "modificatoria") {
      if (amendableDocuments.length > 0 && !amendsDocumentId) {
        setMessage("Selecciona la norma que este documento modifica.");
        return;
      }
      const base = documents.find((document) => document.id === amendsDocumentId);
      amendsDocumentIdToSend = amendsDocumentId;
      amendsToSend = amendsNote.trim() || (base ? `Modifica ${base.title}` : "Modificatoria de norma existente");
    } else if (changeCategory === "modificada") {
      changeNoteToSend = amendsNote.trim();
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("documentType", documentType);
    formData.append("processType", processTypeToSend);
    formData.append("title", title);
    formData.append("changeCategory", changeCategory);
    formData.append("amends", amendsToSend);
    formData.append("amendsDocumentId", amendsDocumentIdToSend);
    formData.append("changeNote", changeNoteToSend);
    formData.append("esInstitucional", String(esInstitucional));

    setLoading(true);
    setMessage("Subiendo PDF...");

    try {
      const response = await fetch("/api/documents", {
        body: formData,
        method: "POST",
      });
      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "No se pudo subir el documento");
        return;
      }

      setFile(null);
      setProcessType("");
      setTitle("");
      setChangeCategory("original");
      setAmendsDocumentId("");
      setAmendsNote("");
      setEsInstitucional(false);
      setMessage("PDF subido. Procesando e indexando en segundo plano...");
      await loadDocuments();
      await loadQuality();
    } catch {
      setMessage("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  function applyChangeCategory(nextCategory: string) {
    setChangeCategory(nextCategory);
    // Limpia los datos del cambio al alternar categoria para no arrastrar valores.
    setAmendsDocumentId("");
    setAmendsNote("");
  }

  function applyDocumentType(nextType: string) {
    setDocumentType(nextType);

    switch (processScopeFor(nextType)) {
      case "todos":
        setProcessType("todos");
        break;
      case "general":
        setProcessType("");
        break;
      case "required":
        // Fuerza una eleccion de proceso especifico (descarta "todos" o vacio heredados).
        setProcessType((current) => (current && current !== "todos" ? current : ""));
        break;
      default:
        setProcessType((current) => (current === "todos" ? "" : current));
        break;
    }
  }

  async function deleteDocument(document: DocumentItem) {
    setDeletingId(document.id);
    setMessage("Eliminando documento...");
    setPendingAction(null);

    try {
      const response = await fetch(`/api/documents/${document.id}`, {
        method: "DELETE",
      });
      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "No se pudo eliminar el documento");
        return;
      }

      setMessage("Documento eliminado completamente.");
      await loadDocuments();
      await loadQuality();
    } catch {
      setMessage("No se pudo conectar con el servidor.");
    } finally {
      setDeletingId(null);
    }
  }

  async function reindexDocument(document: DocumentItem) {
    setReindexingId(document.id);
    setMessage("Reindexando documento...");
    setPendingAction(null);

    try {
      const response = await fetch(`/api/documents/${document.id}`, {
        method: "POST",
      });
      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "No se pudo reindexar el documento");
        return;
      }

      setMessage("Reindexado iniciado en segundo plano...");
      await loadDocuments();
    } catch {
      setMessage("No se pudo conectar con el servidor.");
    } finally {
      setReindexingId(null);
    }
  }

  async function bulkDeleteDocuments() {
    if (!bulkDeleteTarget) {
      return;
    }

    setBulkDeleting(true);
    setMessage("Eliminando documentos por proceso...");

    try {
      const response = await fetch("/api/documents", {
        body: JSON.stringify({
          documentType: bulkDeleteTarget.documentType,
          processType: bulkDeleteTarget.processType,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "DELETE",
      });
      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "No se pudo eliminar el grupo de documentos");
        return;
      }

      setBulkDeleteTarget(null);
      setMessage(
        `Eliminados ${payload.deleted?.documents ?? 0} documento(s), ${
          payload.deleted?.vectors ?? 0
        } vector(es) y ${payload.deleted?.chunks ?? 0} fragmento(s).`,
      );
      await loadDocuments();
    } catch {
      setMessage("No se pudo conectar con el servidor.");
    } finally {
      setBulkDeleting(false);
    }
  }

  async function bulkReindexDocuments() {
    if (!bulkReindexTarget) {
      return;
    }

    setBulkReindexing(true);
    setMessage(`Reindexando ${bulkReindexTarget.count} documento(s). Esto puede tardar...`);

    try {
      const response = await fetch("/api/documents/reindex", {
        body: JSON.stringify({
          ids: bulkReindexTarget.ids,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "No se pudo reindexar el grupo de documentos");
        return;
      }

      setBulkReindexTarget(null);
      setMessage(
        `Reindexacion de ${payload.reindexed?.requested ?? 0} documento(s) iniciada en segundo plano.`,
      );
      await loadDocuments();
    } catch {
      setMessage("No se pudo conectar con el servidor.");
    } finally {
      setBulkReindexing(false);
    }
  }

  return (
    <div className="uploadPanel" id="documentos">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Base documental</p>
          <h2>Gestion documental</h2>
        </div>
        <UploadCloud size={22} />
      </div>

      <section className="documentStats" aria-label="Resumen documental">
        <div>
          <Database size={17} />
          <span>Total</span>
          <strong>{documents.length}</strong>
        </div>
        <div>
          <Layers3 size={17} />
          <span>Bases integradas</span>
          <strong>{integratedBasesCount}</strong>
        </div>
        <div>
          <FileText size={17} />
          <span>Directivas</span>
          <strong>{directiveCount}</strong>
        </div>
        <div>
          <RefreshCw size={17} />
          <span>Listos para RAG</span>
          <strong>
            {usableCount}/{indexedCount}
          </strong>
        </div>
      </section>

      <section className="analysisHelpBox">
        <UploadCloud size={18} />
        <div>
          <strong>Elige el destino correcto del PDF</strong>
          <span>
            Biblioteca normativa: Ley, Reglamento, Directivas, Opiniones y Bases que alimentan Chat, Busqueda y Normas.
            Expediente: documentos de un proceso especifico para evaluar ofertas, riesgos o generar informes.
          </span>
          <div className="sourceActions">
            <Link className="secondaryButton compactButton" href="/documentos">
              Subir a biblioteca normativa
            </Link>
            <Link className="secondaryButton compactButton" href="/expedientes">
              Subir al expediente
            </Link>
            <Link className="secondaryButton compactButton" href="/expedientes">
              Vincular documento existente
            </Link>
          </div>
        </div>
      </section>

      <form className="documentForm" onSubmit={uploadDocument}>
        <div className="documentSectionTitle">
          <div>
            <strong>Subir nuevo PDF</strong>
            <span>{uploadGuidance(documentType)}</span>
          </div>
        </div>
        <label className="filePicker">
          <UploadCloud size={28} />
          <strong>{selectedFileLabel}</strong>
          <span>Ley, reglamento, bases integradas, directivas, resoluciones y expedientes. Maximo {maxPdfSizeLabel}.</span>
          <input
            accept="application/pdf"
            aria-label="Seleccionar PDF"
            onChange={(event) => {
              const selected = event.target.files?.[0] ?? null;

              if (selected && selected.size > maxPdfSizeBytes) {
                setFile(null);
                setMessage(`El PDF supera el limite de ${maxPdfSizeLabel}.`);
                event.target.value = "";
                return;
              }

              setMessage(null);
              setFile(selected);
            }}
            type="file"
          />
        </label>

        <div className="formGrid uploadFields">
          <label>
            <span>1 · Tipo de documento</span>
            <select
              onChange={(event) => applyDocumentType(event.target.value)}
              value={documentType}
            >
              {documentTypes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>2 · Cambios o modificación</span>
            <select
              onChange={(event) => applyChangeCategory(event.target.value)}
              value={changeCategory}
            >
              <option value="original">Original (sin cambios)</option>
              <option value="modificatoria">Modificatoria (modifica otra norma)</option>
              <option value="modificada">Con modificaciones posteriores</option>
            </select>
            <small className="fieldHint">{changeCategoryHint}</small>
          </label>
          <label>
            <span>3 · Tipo de proceso</span>
            <select
              disabled={uploadProcessDisabled}
              onChange={(event) => setProcessType(event.target.value)}
              value={processType}
            >
              {uploadProcessOptions.map((item) => (
                <option key={item.value || "blank"} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <small className="fieldHint">{uploadProcessHint}</small>
          </label>
          <label>
            <span>4 · Título (opcional)</span>
            <input
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Si lo dejas vacío se usa el nombre del archivo"
              value={title}
            />
          </label>
          <label className="checkboxField">
            <input
              checked={esInstitucional}
              onChange={(event) => setEsInstitucional(event.target.checked)}
              type="checkbox"
            />
            <span>5 · Documento institucional</span>
            <small className="fieldHint">
              Visible para todas las oficinas (p. ej. la Ley, el Reglamento, una plantilla común). Sin
              marcar, solo lo ve tu oficina.
            </small>
          </label>
        </div>

        {documentType === "opinion" ? (
          <div className="uploadTypeNote">
            <Info size={18} />
            <div>
              <strong>Opiniones del OECE</strong>
              <span>
                Absuelven consultas sobre el sentido o alcance de la normativa de contrataciones,
                formuladas por entidades, sector privado y sociedad civil. No son normas ni un proceso
                de selección, pero sus criterios deben ser observados por las Entidades. Base legal:
                art. 11, numeral 11.1, literal g) de la Ley 32069 y art. 11 de su Reglamento (D.S.
                009-2025-EF).
              </span>
            </div>
          </div>
        ) : null}

        {changeCategory === "modificatoria" ? (
          <div className="amendmentBox">
            <div className="formGrid uploadFields">
              <label className="fullSpan">
                <span>Norma que modifica</span>
                <select
                  onChange={(event) => setAmendsDocumentId(event.target.value)}
                  value={amendsDocumentId}
                >
                  <option value="">Selecciona la norma…</option>
                  {amendableDocuments.map((document) => (
                    <option key={document.id} value={document.id}>
                      {documentTypeLabel(document.document_type)} · {document.title}
                    </option>
                  ))}
                </select>
                <small className="fieldHint">
                  {amendableDocuments.length === 0
                    ? "Aún no hay normas indexadas para enlazar. Sube primero la norma base."
                    : "Elige la Ley, Reglamento o Directiva que este PDF modifica."}
                </small>
              </label>
              <label className="fullSpan">
                <span>Detalle del cambio (opcional)</span>
                <input
                  onChange={(event) => setAmendsNote(event.target.value)}
                  placeholder="Ej. Modifica el artículo del Reglamento sobre comparación de precios"
                  value={amendsNote}
                />
              </label>
            </div>
          </div>
        ) : changeCategory === "modificada" ? (
          <div className="amendmentBox">
            <div className="formGrid uploadFields">
              <label className="fullSpan">
                <span>Detalle de las modificaciones (opcional)</span>
                <input
                  onChange={(event) => setAmendsNote(event.target.value)}
                  placeholder="Ej. Tuvo cambios por el D.S. 001-2026-EF"
                  value={amendsNote}
                />
              </label>
            </div>
          </div>
        ) : null}

        <div className="formActions">
          <button className="secondaryButton" onClick={() => void loadDocuments()} type="button">
            <RefreshCw size={17} />
            Actualizar
          </button>
          <button className="primaryButton" disabled={loading} type="submit">
            <UploadCloud size={18} />
            {loading ? "Subiendo..." : "Subir PDF"}
          </button>
        </div>

        {message ? <p className="formMessage">{message}</p> : null}
      </form>

      <section className="corpusReadiness" aria-label="Preparacion del corpus">
        <div className="documentSectionTitle">
          <div>
            <strong>Preparacion para Chat y Consultas</strong>
            <span>El chat juridico necesita normativa vigente, paginas, articulos y vectores verificados.</span>
          </div>
          <Link className="secondaryButton compactButton" href="/validar">
            <ShieldCheck size={15} />
            Verificar corpus
          </Link>
        </div>
        <div className="corpusChecklist">
          {corpusChecklist.map((item) => (
            <article className="corpusCheckItem" data-ready={item.ready} key={item.title}>
              {item.ready ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
              <div>
                <strong>{item.title}</strong>
                <span>
                  {item.usable}/{item.count} listo(s) · {item.indexed} indexado(s)
                </span>
              </div>
            </article>
          ))}
        </div>
        {reindexRecommended.length > 0 || globalScopeIssues.length > 0 ? (
          <div className="corpusWarnings">
            {reindexRecommended.length > 0 ? (
              <span>{reindexRecommended.length} documento(s) requieren reindexacion o revision de Pinecone/paginas.</span>
            ) : null}
            {globalScopeIssues.length > 0 ? (
              <span>Ley/Reglamento deben usar proceso Todos los procesos para no quedar fuera de busquedas especificas.</span>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="corpusReadiness" aria-label="Calidad por procedimiento">
        <div className="documentSectionTitle">
          <div>
            <strong>Calidad del corpus por procedimiento</strong>
            <span>Permite saber si cada proceso tiene normativa suficiente y bases solo como apoyo operativo.</span>
          </div>
          <button className="secondaryButton compactButton" onClick={() => void loadQuality()} type="button">
            <RefreshCw size={15} />
            Actualizar calidad
          </button>
        </div>
        {quality ? (
          <div className="procedureQualityGrid">
            {quality.procedures.map((procedure) => (
              <article className="ruleItem" data-tone={procedure.status === "listo" ? "ok" : procedure.operationalReady ? "warn" : "bad"} key={procedure.processType}>
                <div>
                  {procedure.status === "listo" ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
                  <strong>{procedure.processTypeLabel}</strong>
                  <span>{procedure.score}%</span>
                </div>
                <small>
                  {procedure.status === "listo"
                    ? "Normativa principal disponible."
                    : procedure.operationalReady
                      ? "Hay bases/esquema, pero falta normativa completa."
                      : "Corpus incompleto para responder con seguridad."}
                </small>
                <div className="sourceMetaGrid">
                  {procedure.typeCoverage.map((item) => (
                    <span key={`${procedure.processType}-${item.documentType}`}>
                      {item.documentTypeLabel}: {item.ready ? "sí" : "no"} ({item.documents})
                    </span>
                  ))}
                </div>
                {procedure.missingDocumentTypes?.length ? (
                  <div className="corpusMissingList">
                    <strong>Falta completar</strong>
                    {procedure.missingDocumentTypes.slice(0, 4).map((item) => (
                      <span key={`${procedure.processType}-missing-${item.documentType}`}>
                        {item.documentTypeLabel}: {item.reason}
                      </span>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="emptyState">Actualiza para calcular calidad por procedimiento.</div>
        )}
      </section>

      <div className="documentList">
        <div className="documentToolbar">
          <div className="documentSectionTitle">
            <div>
              <strong>Biblioteca cargada</strong>
              <span>{filteredDocuments.length} documento(s) visibles</span>
            </div>
          </div>
          <div className="documentFilters">
            <label>
              <span>Tipo</span>
              <select onChange={(event) => setFilterDocumentType(event.target.value)} value={filterDocumentType}>
                <option value="">Todos</option>
                {documentTypes.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Proceso</span>
              <select onChange={(event) => setFilterProcessType(event.target.value)} value={filterProcessType}>
                {processTypes.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Estado</span>
              <select onChange={(event) => setFilterStatus(event.target.value)} value={filterStatus}>
                <option value="">Todos</option>
                <option value="indexed">Indexado</option>
                <option value="processing">Procesando</option>
                <option value="uploaded">Subido</option>
                <option value="error">Error</option>
              </select>
            </label>
            <button
              className="secondaryButton compactButton"
              onClick={() => {
                setFilterDocumentType("");
                setFilterProcessType("");
                setFilterStatus("");
              }}
              type="button"
            >
              <Filter size={15} />
              Limpiar
            </button>
          </div>
          <div className="bulkDeleteBox">
            <AlertTriangle size={16} />
            <span>Acciones masivas</span>
            <button
              className="secondaryButton compactButton"
              disabled={!canBulkReindex}
              onClick={() =>
                setBulkReindexTarget({
                  count: filteredDocuments.length,
                  ids: filteredDocuments.map((document) => document.id),
                })
              }
              type="button"
            >
              <RefreshCw size={15} />
              Reindexar visibles
            </button>
            <button
              className="dangerButton compactButton"
              disabled={!canBulkDelete || bulkDeleting}
              onClick={() =>
                setBulkDeleteTarget({
                  count: bulkDeleteCount,
                  documentType: filterDocumentType,
                  processType: filterProcessType,
                })
              }
              type="button"
            >
              <Trash2 size={15} />
              Eliminar grupo
            </button>
          </div>
        </div>

        {documents.length === 0 ? (
          <div className="emptyState">Aun no hay documentos registrados.</div>
        ) : filteredDocuments.length === 0 ? (
          <div className="emptyState">No hay documentos con esos filtros.</div>
        ) : (
          filteredDocuments.map((document) => (
            <article className="documentItem" key={document.id}>
              <div className="documentIcon">
                <FileText size={18} />
              </div>
              <div>
                <strong>{document.title}</strong>
                <span>
                  {documentTypeLabel(document.document_type)} · {formatBytes(document.file_size)}
                  {document.source_entity ? ` · ${document.source_entity}` : ""}
                  {labelProcessType(getDocumentProcessType(document))
                    ? ` · ${labelProcessType(getDocumentProcessType(document))}`
                    : ""}
                  {/* Sin oficina asignada al usuario que la ve, todo lo que llega aquí es
                      institucional (GET ya filtra así), así que marcarla solo aporta cuando
                      además hay documentos propios de oficina para distinguir. */}
                  {document.es_institucional ? " · Institucional" : ""}
                </span>
                {document.metadata?.extractionMethod ? (
                  <span>
                    {document.metadata.extractionMethod === "openai-ocr"
                      ? "OCR OpenAI"
                      : "Texto PDF"}{" "}
                    · {document.metadata.chunkCount ?? 0} fragmentos
                    {document.metadata.pinecone?.recordCount
                      ? ` · ${document.metadata.pinecone.recordCount} vectores`
                      : ""}
                    {document.metadata.pinecone?.verification
                      ? ` · Pinecone ${
                          document.metadata.pinecone.verification.verified
                            ? "verificado"
                            : "pendiente de verificar"
                        }`
                      : ""}
                    {document.metadata.ocrPartial ? " · OCR parcial" : ""}
                  </span>
                ) : null}
                <div className="documentQuality">
                  <span data-ready={Boolean(document.metadata?.pageCount)}>
                    Paginas {document.metadata?.pageCount ?? "sin dato"}
                  </span>
                  <span data-ready={Boolean(document.metadata?.chunkCount)}>
                    Fragmentos {document.metadata?.chunkCount ?? 0}
                  </span>
                  <span data-ready={isPineconeVerified(document)}>
                    Pinecone {isPineconeVerified(document) ? "verificado" : "pendiente"}
                  </span>
                  <span data-ready={!needsReindex(document)}>
                    {needsReindex(document) ? "Reindexar" : "Utilizable"}
                  </span>
                </div>
                {document.metadata?.topic || document.metadata?.vigencia || document.metadata?.year ? (
                  <span>
                    {document.metadata.topic ? `Tema ${document.metadata.topic}` : "Tema no definido"}
                    {document.metadata.vigencia ? ` · ${document.metadata.vigencia}` : ""}
                    {document.metadata.year ? ` · ${document.metadata.year}` : ""}
                  </span>
                ) : null}
                {document.metadata?.amends ? (
                  <span className="documentAmends">Modifica: {document.metadata.amends}</span>
                ) : null}
                {document.metadata?.changeNote ? (
                  <span className="documentAmends">Con modificaciones: {document.metadata.changeNote}</span>
                ) : null}
                {document.metadata?.summary ? <p>{document.metadata.summary}</p> : null}
                {document.error_message ? (
                  <span className="documentError">{document.error_message}</span>
                ) : null}
              </div>
              <div className="documentActions">
                <small data-status={document.status}>{statusLabel(document.status)}</small>
                <Link
                  aria-label={`Abrir PDF ${document.title}`}
                  href={`/api/documents/${document.id}`}
                  target="_blank"
                  title="Abrir PDF original"
                >
                  <FileText size={16} />
                </Link>
                <button
                  aria-label={`Reindexar ${document.title}`}
                  disabled={reindexingId === document.id || deletingId === document.id}
                  onClick={() => setPendingAction({ document, type: "reindex" })}
                  title="Reindexar documento"
                  type="button"
                >
                  <RefreshCw size={16} />
                </button>
                <button
                  aria-label={`Eliminar ${document.title}`}
                  disabled={deletingId === document.id}
                  onClick={() => setPendingAction({ document, type: "delete" })}
                  title="Eliminar documento"
                  type="button"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          ))
        )}
      </div>

      <Dialog.Root open={Boolean(pendingAction)} onOpenChange={(open) => !open && setPendingAction(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialogOverlay" />
          <Dialog.Content className="dialogContent">
            <Dialog.Title>
              {pendingAction?.type === "delete" ? "Eliminar documento" : "Reindexar documento"}
            </Dialog.Title>
            <Dialog.Description>
              {pendingAction?.type === "delete"
                ? "Se eliminara el PDF de Storage, sus fragmentos en Supabase y sus vectores en Pinecone."
                : "Se regeneraran fragmentos, paginas aproximadas, resumen y metadata sugerida por IA."}
            </Dialog.Description>
            <strong>{pendingAction?.document.title}</strong>
            <div className="dialogActions">
              <Dialog.Close className="secondaryButton" type="button">
                Cancelar
              </Dialog.Close>
              <button
                className={pendingAction?.type === "delete" ? "dangerButton" : "primaryButton"}
                onClick={() => {
                  if (!pendingAction) {
                    return;
                  }

                  if (pendingAction.type === "delete") {
                    void deleteDocument(pendingAction.document);
                  } else {
                    void reindexDocument(pendingAction.document);
                  }
                }}
                type="button"
              >
                {pendingAction?.type === "delete" ? "Eliminar" : "Reindexar"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root
        open={Boolean(bulkDeleteTarget)}
        onOpenChange={(open) => !open && setBulkDeleteTarget(null)}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialogOverlay" />
          <Dialog.Content className="dialogContent">
            <Dialog.Title>Eliminar documentos por proceso</Dialog.Title>
            <Dialog.Description>
              Se eliminaran PDFs de Storage, fragmentos en Supabase y vectores en Pinecone para el grupo seleccionado.
            </Dialog.Description>
            <strong>
              {documentTypeLabel(bulkDeleteTarget?.documentType)} ·{" "}
              {labelProcessType(bulkDeleteTarget?.processType) ?? "Sin proceso"}
            </strong>
            <p>{bulkDeleteTarget?.count ?? 0} documento(s) seran eliminados.</p>
            <div className="dialogActions">
              <Dialog.Close className="secondaryButton" type="button">
                Cancelar
              </Dialog.Close>
              <button
                className="dangerButton"
                disabled={bulkDeleting}
                onClick={() => void bulkDeleteDocuments()}
                type="button"
              >
                {bulkDeleting ? "Eliminando..." : "Eliminar grupo"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root
        open={Boolean(bulkReindexTarget)}
        onOpenChange={(open) => !open && setBulkReindexTarget(null)}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialogOverlay" />
          <Dialog.Content className="dialogContent">
            <Dialog.Title>Reindexar documentos visibles</Dialog.Title>
            <Dialog.Description>
              Se regeneraran fragmentos, metadata juridica y vectores de Pinecone usando los PDF guardados en Supabase Storage.
            </Dialog.Description>
            <strong>{bulkReindexTarget?.count ?? 0} documento(s) seran reindexados.</strong>
            <p>Usa filtros antes de ejecutar si quieres limitarlo por tipo documental, proceso o estado.</p>
            <div className="dialogActions">
              <Dialog.Close className="secondaryButton" type="button">
                Cancelar
              </Dialog.Close>
              <button
                className="primaryButton"
                disabled={bulkReindexing}
                onClick={() => void bulkReindexDocuments()}
                type="button"
              >
                {bulkReindexing ? "Reindexando..." : "Reindexar visibles"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
