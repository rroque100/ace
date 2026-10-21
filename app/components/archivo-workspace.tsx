"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  Bot,
  FileText,
  Filter,
  Lock,
  RefreshCw,
  Search,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { ARCHIVO_DOC_KINDS, ARCHIVO_DOC_KIND_LABELS, archivoDocKindLabel } from "@/lib/archivo";
import { maxPdfSizeBytes, maxPdfSizeLabel } from "@/lib/upload-limits";

type ArchivoItem = {
  id: string;
  document_number: string | null;
  fecha: string | null;
  asunto: string | null;
  title: string;
  doc_kind: string;
  file_name: string;
  file_size: number;
  status: "uploaded" | "processing" | "indexed" | "error";
  error_message: string | null;
  metadata: { chunkCount?: number; pageCount?: number; summary?: string } | null;
  created_at: string;
};

type SearchResult = {
  documentId: string;
  documentNumber: string | null;
  title: string;
  asunto: string | null;
  fecha: string | null;
  docKind: string;
  docKindLabel: string;
  pageStart: number | null;
  pageEnd: number | null;
  excerpt: string;
  score: number;
  citation: string;
};

type ChatAnswer = { answer: string; sufficient: boolean; sources: SearchResult[] };

const docKinds = ARCHIVO_DOC_KINDS;

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function statusLabel(status: ArchivoItem["status"]) {
  return { error: "Error", indexed: "Indexado", processing: "Procesando", uploaded: "Subido" }[status];
}

export function ArchivoWorkspace({ canManage }: { canManage: boolean }) {
  // Consulta
  const [mode, setMode] = useState<"buscar" | "preguntar">("buscar");
  const [query, setQuery] = useState("");
  const [filterKind, setFilterKind] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [answer, setAnswer] = useState<ChatAnswer | null>(null);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);

  // Gestion
  const [documents, setDocuments] = useState<ArchivoItem[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [docKind, setDocKind] = useState<string>("resolucion_alcaldia");
  const [documentNumber, setDocumentNumber] = useState("");
  const [fecha, setFecha] = useState("");
  const [asunto, setAsunto] = useState("");
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [reindexingId, setReindexingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    const response = await fetch("/api/archivo", { cache: "no-store" });
    const payload = await response.json();
    if (response.ok) {
      setDocuments(payload.documentos ?? []);
    }
  }, []);

  const hasPending = useMemo(
    () => documents.some((doc) => doc.status === "uploaded" || doc.status === "processing"),
    [documents],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    if (!hasPending) {
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
  }, [hasPending, loadDocuments]);

  async function runSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (query.trim().length < 2) {
      setSearchMessage("Escribe al menos 2 caracteres.");
      return;
    }

    setSearching(true);
    setSearchMessage(null);
    setResults(null);
    setAnswer(null);

    try {
      if (mode === "buscar") {
        const response = await fetch("/api/archivo/search", {
          body: JSON.stringify({ query: query.trim(), docKind: filterKind || undefined }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const payload = await response.json();
        if (!response.ok) {
          setSearchMessage(payload.error ?? "No se pudo buscar.");
          return;
        }
        setResults(payload.results ?? []);
        if ((payload.results ?? []).length === 0) {
          setSearchMessage("Sin resultados en el archivo.");
        }
      } else {
        const response = await fetch("/api/archivo/chat", {
          body: JSON.stringify({ query: query.trim(), docKind: filterKind || undefined }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const payload = await response.json();
        if (!response.ok) {
          setSearchMessage(payload.error ?? "No se pudo responder.");
          return;
        }
        setAnswer(payload as ChatAnswer);
      }
    } catch {
      setSearchMessage("No se pudo conectar con el servidor.");
    } finally {
      setSearching(false);
    }
  }

  async function uploadDocument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setUploadMessage("Selecciona un archivo PDF antes de subir.");
      return;
    }
    if (file.size > maxPdfSizeBytes) {
      setUploadMessage(`El PDF supera el limite de ${maxPdfSizeLabel}.`);
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("docKind", docKind);
    formData.append("documentNumber", documentNumber);
    formData.append("fecha", fecha);
    formData.append("asunto", asunto);
    formData.append("title", title);

    setUploading(true);
    setUploadMessage("Subiendo PDF...");

    try {
      const response = await fetch("/api/archivo", { body: formData, method: "POST" });
      const payload = await response.json();
      if (!response.ok) {
        setUploadMessage(payload.error ?? "No se pudo subir el documento");
        return;
      }
      setFile(null);
      setDocumentNumber("");
      setFecha("");
      setAsunto("");
      setTitle("");
      setUploadMessage("PDF subido. Procesando e indexando en segundo plano...");
      await loadDocuments();
    } catch {
      setUploadMessage("No se pudo conectar con el servidor.");
    } finally {
      setUploading(false);
    }
  }

  async function reindexDocument(id: string) {
    setReindexingId(id);
    setUploadMessage("Reindexando documento...");
    try {
      const response = await fetch(`/api/archivo/${id}`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) {
        setUploadMessage(payload.error ?? "No se pudo reindexar");
        return;
      }
      setUploadMessage("Reindexado iniciado en segundo plano...");
      await loadDocuments();
    } catch {
      setUploadMessage("No se pudo conectar con el servidor.");
    } finally {
      setReindexingId(null);
    }
  }

  async function deleteDocument(id: string) {
    setDeletingId(id);
    setUploadMessage("Eliminando documento...");
    try {
      const response = await fetch(`/api/archivo/${id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) {
        setUploadMessage(payload.error ?? "No se pudo eliminar");
        return;
      }
      setUploadMessage("Documento eliminado.");
      await loadDocuments();
    } catch {
      setUploadMessage("No se pudo conectar con el servidor.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="uploadPanel" id="archivo">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Archivo documental</p>
          <h2>Consulta y búsqueda en el archivo</h2>
        </div>
        <Archive size={22} />
      </div>

      <form className="documentForm" onSubmit={runSearch}>
        <div className="styleSelectors">
          <div className="styleSelectorGroup">
            <span className="styleSelectorsTitle">Modo</span>
            <div className="pillGroup">
              <button
                className={mode === "buscar" ? "pill active" : "pill"}
                onClick={() => setMode("buscar")}
                type="button"
              >
                <Search size={15} /> Buscar
              </button>
              <button
                className={mode === "preguntar" ? "pill active" : "pill"}
                onClick={() => setMode("preguntar")}
                type="button"
              >
                <Bot size={15} /> Preguntar a la IA
              </button>
            </div>
          </div>
        </div>

        <div className="formGrid">
          <label className="fullSpan">
            <span>{mode === "buscar" ? "Buscar en el contenido" : "Pregunta en lenguaje natural"}</span>
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder={
                mode === "buscar"
                  ? "Ej. designación de comité, número 004-2024, presupuesto..."
                  : "Ej. ¿Qué resuelve la Resolución de Alcaldía 004-2024?"
              }
              value={query}
            />
          </label>
          <label>
            <span>Tipo de documento</span>
            <select onChange={(event) => setFilterKind(event.target.value)} value={filterKind}>
              <option value="">Todos</option>
              {docKinds.map((kind) => (
                <option key={kind} value={kind}>
                  {ARCHIVO_DOC_KIND_LABELS[kind]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="formActions">
          <button className="primaryButton" disabled={searching} type="submit">
            {mode === "buscar" ? <Search size={17} /> : <Bot size={17} />}
            {searching ? "Consultando..." : mode === "buscar" ? "Buscar" : "Preguntar"}
          </button>
        </div>
        {searchMessage ? <p className="formMessage">{searchMessage}</p> : null}
      </form>

      {answer ? (
        <section className="archivoAnswer">
          <div className="documentSectionTitle">
            <div>
              <strong>Respuesta</strong>
              <span>Fundamentada en los documentos del archivo. Las citas [D#] corresponden a las fuentes.</span>
            </div>
          </div>
          <p className="archivoAnswerText">{answer.answer}</p>
          {answer.sources.length > 0 ? (
            <div className="archivoSources">
              {answer.sources.map((source, index) => (
                <article className="documentItem" key={`${source.documentId}-${index}`}>
                  <div className="documentIcon">
                    <FileText size={18} />
                  </div>
                  <div>
                    <strong>
                      [D{index + 1}] {source.title}
                    </strong>
                    <span>{source.citation}</span>
                    {source.excerpt ? <p>{source.excerpt}</p> : null}
                  </div>
                  <div className="documentActions">
                    <a href={`/api/archivo/${source.documentId}`} target="_blank" rel="noreferrer" title="Abrir PDF">
                      <FileText size={16} />
                    </a>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {results ? (
        <section className="archivoResults">
          <div className="documentSectionTitle">
            <div>
              <strong>Resultados</strong>
              <span>{results.length} coincidencia(s) en el archivo</span>
            </div>
          </div>
          {results.length === 0 ? (
            <div className="emptyState">Sin resultados.</div>
          ) : (
            results.map((source, index) => (
              <article className="documentItem" key={`${source.documentId}-${index}`}>
                <div className="documentIcon">
                  <FileText size={18} />
                </div>
                <div>
                  <strong>{source.title}</strong>
                  <span>
                    {source.docKindLabel}
                    {source.documentNumber ? ` · N° ${source.documentNumber}` : ""}
                    {source.fecha ? ` · ${source.fecha}` : ""}
                    {source.pageStart ? ` · pág. ${source.pageStart}` : ""}
                  </span>
                  {source.asunto ? <span>Asunto: {source.asunto}</span> : null}
                  {source.excerpt ? <p>{source.excerpt}</p> : null}
                </div>
                <div className="documentActions">
                  <a href={`/api/archivo/${source.documentId}`} target="_blank" rel="noreferrer" title="Abrir PDF">
                    <FileText size={16} />
                  </a>
                </div>
              </article>
            ))
          )}
        </section>
      ) : null}

      {canManage ? (
        <>
          <form className="documentForm" onSubmit={uploadDocument}>
            <div className="documentSectionTitle">
              <div>
                <strong>Subir documento al archivo</strong>
                <span>El PDF se indexa para poder ubicar número, fecha, asunto y cualquier parte del cuerpo.</span>
              </div>
            </div>
            <label className="filePicker">
              <UploadCloud size={28} />
              <strong>{file ? `${file.name} · ${formatBytes(file.size)}` : "Selecciona un PDF"}</strong>
              <span>Resoluciones, acuerdos, ordenanzas, oficios e informes. Máximo {maxPdfSizeLabel}.</span>
              <input
                accept="application/pdf"
                onChange={(event) => {
                  const selected = event.target.files?.[0] ?? null;
                  if (selected && selected.size > maxPdfSizeBytes) {
                    setFile(null);
                    setUploadMessage(`El PDF supera el limite de ${maxPdfSizeLabel}.`);
                    event.target.value = "";
                    return;
                  }
                  setUploadMessage(null);
                  setFile(selected);
                }}
                type="file"
              />
            </label>
            <div className="formGrid">
              <label>
                <span>Tipo de documento</span>
                <select onChange={(event) => setDocKind(event.target.value)} value={docKind}>
                  {docKinds.map((kind) => (
                    <option key={kind} value={kind}>
                      {ARCHIVO_DOC_KIND_LABELS[kind]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Número (opcional)</span>
                <input
                  onChange={(event) => setDocumentNumber(event.target.value)}
                  placeholder="Ej. 004-2024-MDCH-A (si lo dejas vacío se detecta)"
                  value={documentNumber}
                />
              </label>
              <label>
                <span>Fecha (opcional)</span>
                <input onChange={(event) => setFecha(event.target.value)} type="date" value={fecha} />
              </label>
              <label>
                <span>Título (opcional)</span>
                <input
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Si lo dejas vacío se usa el nombre del archivo"
                  value={title}
                />
              </label>
              <label className="fullSpan">
                <span>Asunto / sumilla (opcional)</span>
                <input
                  onChange={(event) => setAsunto(event.target.value)}
                  placeholder="Si lo dejas vacío se detecta con IA"
                  value={asunto}
                />
              </label>
            </div>
            <div className="formActions">
              <button className="secondaryButton" onClick={() => void loadDocuments()} type="button">
                <RefreshCw size={17} /> Actualizar
              </button>
              <button className="primaryButton" disabled={uploading} type="submit">
                <UploadCloud size={18} /> {uploading ? "Subiendo..." : "Subir al archivo"}
              </button>
            </div>
            {uploadMessage ? <p className="formMessage">{uploadMessage}</p> : null}
          </form>

          <div className="documentList">
            <div className="documentSectionTitle">
              <div>
                <strong>Documentos del archivo</strong>
                <span>{documents.length} documento(s)</span>
              </div>
            </div>
            {documents.length === 0 ? (
              <div className="emptyState">Aún no hay documentos en el archivo.</div>
            ) : (
              documents.map((doc) => (
                <article className="documentItem" key={doc.id}>
                  <div className="documentIcon">
                    <FileText size={18} />
                  </div>
                  <div>
                    <strong>{doc.title}</strong>
                    <span>
                      {archivoDocKindLabel(doc.doc_kind)}
                      {doc.document_number ? ` · N° ${doc.document_number}` : ""}
                      {doc.fecha ? ` · ${doc.fecha}` : ""} · {formatBytes(doc.file_size)}
                    </span>
                    {doc.asunto ? <span>Asunto: {doc.asunto}</span> : null}
                    {doc.metadata?.chunkCount ? (
                      <span>
                        {doc.metadata.pageCount ?? 0} páginas · {doc.metadata.chunkCount} fragmentos
                      </span>
                    ) : null}
                    {doc.error_message ? <span className="documentError">{doc.error_message}</span> : null}
                  </div>
                  <div className="documentActions">
                    <small data-status={doc.status}>{statusLabel(doc.status)}</small>
                    <a href={`/api/archivo/${doc.id}`} target="_blank" rel="noreferrer" title="Abrir PDF">
                      <FileText size={16} />
                    </a>
                    <button
                      disabled={reindexingId === doc.id || deletingId === doc.id}
                      onClick={() => void reindexDocument(doc.id)}
                      title="Reindexar"
                      type="button"
                    >
                      <RefreshCw size={16} />
                    </button>
                    <button
                      disabled={deletingId === doc.id}
                      onClick={() => void deleteDocument(doc.id)}
                      title="Eliminar"
                      type="button"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </>
      ) : (
        <div className="emptyState">
          <Lock size={20} />
          <p>
            La carga y gestión del archivo requiere rol DEC/Editor o administrador. Puedes buscar y
            consultar todos los documentos indexados.
          </p>
        </div>
      )}

      <div className="archivoHint">
        <Filter size={15} />
        <span>El archivo es independiente del corpus normativo: no se mezcla con el Chat jurídico.</span>
      </div>
    </div>
  );
}
