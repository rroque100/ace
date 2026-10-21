"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Ban,
  Check,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Link as LinkIcon,
  FileDown,
  Loader,
  MessageSquareText,
  Pencil,
  ScanSearch,
  ShieldAlert,
  Workflow,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import Link from "next/link";
import { ConfirmDialog } from "./confirm-dialog";
import { Button, Input, Select } from "./ui";
import {
  PROCESS_DOC_KINDS,
  PROCESS_STATUSES,
  objectTypeLabel,
  processDocKindLabel,
  processStatusLabel,
  processTypeLabel,
} from "@/lib/legal-taxonomy";
import { instruirExpediente } from "@/lib/expediente-instruccion";
import { draftKinds } from "@/lib/draft-kinds";
import { PhaseTracker } from "./phase-tracker";
import { FaseUnoPanel } from "./fase-preparatoria/fase-uno-panel";
import { FaseDosPanel } from "./fase-seleccion/fase-dos-panel";
import { FaseTresPanel } from "./fase-ejecucion/fase-tres-panel";
import { GlobalProgress } from "./global-progress";
import { unirTimeline, type EntradaTimeline } from "@/lib/timeline-expediente";
import { useExpediente } from "./expediente-contexto";
import { resumenDelExpediente, type HitosDelExpediente } from "@/lib/expediente-columnas";
import { NotificationBanner } from "./fase-preparatoria/notification-banner";

type Process = {
  /** Pasos de las tres fases: es de donde la ficha de resumen lee sus datos. */
  hitos?: HitosDelExpediente;
  id: string;
  nomenclature: string;
  object_type: string;
  procedure_type: string | null;
  amount: number | null;
  entity: string | null;
  status: string;
  summary: string | null;
  
  // Campos Ley 32069
  valor_estimado: number | null;
  moneda: string | null;
  tipo_cambio: number | null;
  certificacion_presupuestal: string | null;
  sistema_contratacion: string | null;
  modalidad_ejecucion: string | null;
  formula_reajuste: string | null;
  pluralidad_marcas: boolean | null;
  resumen_ejecutivo: string | null;

  // Estrategia de contratación (Art. 46 Reglamento)
  requisitos_calificacion: string | null;
  requisitos_precalificacion: string | null;
  tipo_evaluador_perfil: string | null;
  factores_evaluacion: string | null;
  garantias_adelantos: string | null;
  cronograma_contratacion: string | null;
  tipo_interaccion_mercado: string | null;
  tipo_procedimiento: string | null;

  autoridad_aprobacion: string | null;
  delegacion_facultades: boolean | null;
  doc_aprobacion_expediente: string | null;

  created_at: string;
  updated_at: string;
};

type ProcessDoc = {
  id: string;
  library_document_id?: string | null;
  kind: string;
  bidder_name: string | null;
  title: string;
  file_name: string | null;
  status: "uploaded" | "processing" | "ready" | "error";
  error_message: string | null;
  created_at: string;
};

type LibraryDoc = {
  id: string;
  title: string;
  document_type: string;
  process_type: string | null;
  status: string;
};

type EvaluationRow = {
  id: string;
  bidder_name: string | null;
  result: "cumple" | "no_cumple" | "subsanable" | "riesgo" | null;
  matrix: Array<{
    requisito: string;
    exigidoEnBases: string;
    presentadoPorPostor: string;
    resultado: string;
    observacion: string;
  }>;
  created_at: string;
};

type RiskRow = {
  id: string;
  items: Array<{
    riesgo: string;
    nivel: "alto" | "medio" | "bajo";
    sustento: string;
    accionRecomendada: string;
  }>;
  created_at: string;
};

// Insignia de resultado de evaluación. Valores computados EFECTIVOS (styles.css
// encadena varios overrides: peso 780 no 900, y cada estado toma su token
// semántico). Mapa JS para el estado; el default (riesgo) va en el fallback.
const RESULT_BADGE_BASE = "w-fit rounded-full px-[9px] py-1.5 text-[12px] font-[780]";
const RESULT_BADGE: Record<string, string> = {
  cumple: "bg-[#eaf7ef] text-[#176b49]",
  no_cumple: "bg-[#fff1ef] text-[#b42318]",
  subsanable: "bg-[#fff7e6] text-[#9a5f08]",
  riesgo: "bg-[#fff8ea] text-[#7b4724]",
};

// Tarjeta de riesgo: radio 13px (override), gap/padding y estilado de sus hijos
// (strong/span/p/small) por selectores hijo. El color por nivel va en mapa JS.
const RISK_ITEM_BASE =
  "grid gap-[5px] rounded-[13px] border p-2.5 " +
  "[&>strong]:text-[13px] [&>strong]:text-ink " +
  "[&>span]:w-fit [&>span]:rounded-full [&>span]:bg-white [&>span]:px-[7px] [&>span]:py-1 [&>span]:text-[11px] [&>span]:font-[900] [&>span]:uppercase [&>span]:text-muted " +
  "[&>p]:m-0 [&>p]:text-[12px] [&>p]:leading-[1.45] [&>p]:text-muted " +
  "[&>small]:m-0 [&>small]:text-[12px] [&>small]:leading-[1.45] [&>small]:text-muted";
const RISK_ITEM: Record<string, string> = {
  alto: "border-[#efb9b3] bg-[#fff3f1]",
  bajo: "border-[#b8d9c7] bg-[#f3faf5]",
};
const RISK_ITEM_DEFAULT = "border-warning/25 bg-[#fff7e6]";

// Matriz de evaluación: tabla con th/td por selector descendiente.
const MATRIX_TABLE =
  "w-full border-collapse text-[12px] " +
  "[&_th]:border [&_th]:border-line [&_th]:p-[7px_8px] [&_th]:text-left [&_th]:align-top [&_th]:bg-surface [&_th]:text-ink " +
  "[&_td]:border [&_td]:border-line [&_td]:p-[7px_8px] [&_td]:text-left [&_td]:align-top";

/**
 * Fila de la ficha de resumen.
 *
 * `origen` es el paso que escribe ese dato. Se enseña porque la ficha es de solo
 * lectura: sin decir de dónde sale, un campo vacío parece un fallo y quien lo ve
 * no sabe dónde ir a rellenarlo.
 */
function Row({
  label,
  origen,
  value,
}: {
  label: string;
  origen?: string;
  value: string | number | null | undefined;
}) {
  const vacio = value === null || value === undefined || String(value).trim() === "";
  return (
    <div className="fichaRow" data-vacio={vacio ? "true" : undefined}>
      <span className="fichaLabel">
        {label}
        {origen ? (
          <span className="fichaOrigen" title={`Este dato lo registra el paso ${origen} de la Fase 1`}>
            {origen}
          </span>
        ) : null}
      </span>
      <span className="fichaValue">{vacio ? "—" : String(value)}</span>
    </div>
  );
}

/**
 * Icono por familia de evento.
 *
 * Antes cada entrada traía su componente de icono metido en el dato, lo que
 * mezclaba el qué con el cómo se pinta y obligaba a que el endpoint —que solo
 * devuelve JSON— no pudiera aportar entradas. Ahora el dato trae un `tipo` y la
 * interfaz elige el icono.
 */
const ICONO_TIMELINE: Record<EntradaTimeline["tipo"], typeof Clock> = {
  analisis: ScanSearch,
  creacion: Clock,
  documento: FileText,
  estado: Workflow,
  paso: CheckCircle2,
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short" });
}

// Peso 780 y no 700: es el valor efectivo tras el override agrupado de styles.css
// (grupo de chips en ~7153). Es un <span>, así que no necesita `!` en la fuente.
const DOC_STATUS = "inline-flex items-center gap-[5px] whitespace-nowrap text-[11px] font-[780]";

function DocStatus({ status }: { status: ProcessDoc["status"] }) {
  if (status === "ready") {
    return (
      <span className={`${DOC_STATUS} text-[#166534]`}>
        <CheckCircle2 size={14} /> Listo
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className={`${DOC_STATUS} text-[#991b1b]`}>
        <AlertTriangle size={14} /> Error
      </span>
    );
  }
  return (
    <span className={`${DOC_STATUS} text-[#854d0e]`}>
      <Loader size={14} /> Procesando
    </span>
  );
}

export type ExpedientePermisos = {
  manage: boolean;
  upload: boolean;
  evaluate: boolean;
  risks: boolean;
  draft: boolean;
};

export function ProcessDetail({ permisos, processId }: { permisos: ExpedientePermisos; processId: string }) {
  // Los datos del expediente vienen del contexto: una sola carga para toda la
  // página en vez de una por componente (ver expediente-contexto.tsx).
  const {
    cargando: loading,
    documentos,
    error: errorDelExpediente,
    evaluaciones,
    necesidad,
    proceso,
    recargarDocumentos,
    recargarTodo: reload,
    riesgos,
  } = useExpediente();
  const process = proceso as Process | null;
  const documents = documentos as ProcessDoc[];
  const evaluations = evaluaciones as EvaluationRow[];
  const risks = riesgos as RiskRow[];
  const [libraryDocs, setLibraryDocs] = useState<LibraryDoc[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [uploading, setUploading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [detectingRisks, setDetectingRisks] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [declaringDesierto, setDeclaringDesierto] = useState(false);
  const [confirmDesierto, setConfirmDesierto] = useState(false);
  const [confirmDeleteProcess, setConfirmDeleteProcess] = useState(false);
  const [deletingProcess, setDeletingProcess] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [editandoNomenclature, setEditandoNomenclature] = useState(false);
  const [nomenclatureDraft, setNomenclatureDraft] = useState("");
  const [guardandoNomenclature, setGuardandoNomenclature] = useState(false);
  const [editandoNombreNecesidad, setEditandoNombreNecesidad] = useState(false);
  const [nombreNecesidadDraft, setNombreNecesidadDraft] = useState("");
  const [guardandoNombreNecesidad, setGuardandoNombreNecesidad] = useState(false);

  const [kind, setKind] = useState("bases");
  const [libraryDocumentId, setLibraryDocumentId] = useState("");
  const [bidderName, setBidderName] = useState("");
  const [evalBidderName, setEvalBidderName] = useState("");
  const [draftKind, setDraftKind] = useState("informe_evaluacion");
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadSectionRef = useRef<HTMLElement>(null);
  const [descargandoCaratula, setDescargandoCaratula] = useState(false);
  const [entradasTimeline, setEntradasTimeline] = useState<EntradaTimeline[]>([]);

  // El registro de auditoría está cerrado por RLS, así que lo sirve un endpoint
  // que primero comprueba con el token del usuario que puede ver el expediente.
  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const res = await fetch(`/api/processes/${processId}/timeline`, { cache: "no-store" });
        const payload = await res.json();
        if (!cancelado && res.ok) setEntradasTimeline(payload.entradas ?? []);
      } catch {
        // Sin historia, la línea de tiempo se queda con la creación y los
        // documentos: es peor, pero no rompe la página.
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [processId, documents.length]);

  /**
   * Descarga la carátula y refresca la lista de documentos.
   *
   * El endpoint la archiva además de devolverla, así que sin recargar el usuario
   * no vería aparecer el documento que acaba de crear y pensaría que no pasó nada.
   */
  async function descargarCaratula() {
    setDescargandoCaratula(true);
    try {
      const res = await fetch(`/api/processes/${processId}/caratula`);
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload.error ?? "No se pudo generar la carátula.");
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const nombre = disposition.match(/filename="?([^"]+)"?/)?.[1] ?? "Caratula-Expediente.docx";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nombre;
      a.click();
      URL.revokeObjectURL(url);
      await reload();
    } catch {
      setError("No se pudo conectar para generar la carátula.");
    } finally {
      setDescargandoCaratula(false);
    }
  }

  const instruccion = useMemo(
    () =>
      instruirExpediente({
        status: process?.status,
        documents: documents.map((doc) => ({ kind: doc.kind, title: doc.title, status: doc.status })),
        evaluacionesCount: evaluations.length,
      }),
    [process?.status, documents, evaluations.length],
  );

  // Ficha de resumen. Lee de `hitos` —donde el paso guarda el dato— con la
  // columna como respaldo, así los expedientes anteriores al cableado salen
  // correctos sin que nadie tenga que reabrir A4, A7 y A8 uno por uno.
  const resumen = useMemo(
    () => resumenDelExpediente(process ?? {}, process?.hitos ?? null),
    [process],
  );

  // Preselecciona el tipo de documento de una fase y lleva al formulario de carga.
  function prepareUpload(nextKind: string) {
    setKind(nextKind);
    requestAnimationFrame(() => {
      uploadSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      fileRef.current?.focus();
    });
  }

  async function loadLibraryDocs() {
    try {
      const response = await fetch("/api/documents", { cache: "no-store" });
      const payload = await response.json();
      setLibraryDocs((payload.documents ?? []).filter((doc: LibraryDoc) => doc.status === "indexed"));
    } catch {
      setLibraryDocs([]);
    }
  }

  // Solo la biblioteca: el proceso, documentos, evaluaciones, riesgos y ficha ya
  // los carga `ExpedienteProvider` en su propio efecto de montaje. Antes se
  // llamaba también a `reload()` aquí, así que el expediente se cargaba DOS veces
  // al abrir (8 consultas en vez de 4, más la ficha por duplicado).
  useEffect(() => {
    void loadLibraryDocs();
  }, [processId]);

  // Polling mientras algún documento esté extrayendo texto. Solo se refrescan los
  // DOCUMENTOS (lo único que cambia), no el expediente entero: antes cada 3,5 s se
  // relanzaban las 4 consultas del proceso + la ficha solo para ver el `status`.
  useEffect(() => {
    const pending = documents.some((doc) => doc.status === "uploaded" || doc.status === "processing");
    if (!pending) {
      return;
    }
    const timer = setInterval(() => void recargarDocumentos(), 3500);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents]);

  async function uploadDocument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Selecciona un PDF.");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("kind", kind);
      if (bidderName.trim()) {
        formData.set("bidderName", bidderName.trim());
      }
      const response = await fetch(`/api/processes/${processId}/documents`, { body: formData, method: "POST" });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "No se pudo subir el documento.");
        return;
      }
      setBidderName("");
      if (fileRef.current) {
        fileRef.current.value = "";
      }
      setError("");
      if (payload.statusAdvancedTo) {
        setNotice(`El expediente avanzó automáticamente a la etapa “${processStatusLabel(payload.statusAdvancedTo)}”.`);
      }
      await reload();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setUploading(false);
    }
  }

  async function linkLibraryDocument() {
    if (!libraryDocumentId) {
      setError("Selecciona un documento de biblioteca.");
      return;
    }
    setLinking(true);
    setError("");
    try {
      const formData = new FormData();
      formData.set("libraryDocumentId", libraryDocumentId);
      formData.set("kind", kind);
      const response = await fetch(`/api/processes/${processId}/documents`, { body: formData, method: "POST" });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "No se pudo vincular el documento.");
        return;
      }
      setLibraryDocumentId("");
      if (payload.statusAdvancedTo) {
        setNotice(`El expediente avanzó automáticamente a la etapa “${processStatusLabel(payload.statusAdvancedTo)}”.`);
      }
      await reload();
    } catch {
      setError("No se pudo conectar para vincular documento.");
    } finally {
      setLinking(false);
    }
  }

  async function changeStatus(status: string) {
    // Guard en vuelo: el <select> se deshabilita mientras corre, así no se
    // encadenan varios PATCH por cambios rápidos.
    setChangingStatus(true);
    setError("");
    try {
      const res = await fetch(`/api/processes/${processId}`, {
        body: JSON.stringify({ status }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      // Antes no se miraba `res.ok`: un 403 (capacidad), un 409 (la puerta del
      // Art. 54.2 en los hitos) o un 500 (CHECK de columnas) pasaban en silencio
      // y la UI recargaba como si el estado hubiera cambiado. Ahora se avisa.
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload.error ?? "No se pudo actualizar el estado.");
        return;
      }
      await reload();
    } catch {
      setError("No se pudo actualizar el estado.");
    } finally {
      setChangingStatus(false);
    }
  }

  async function guardarNomenclature() {
    const valor = nomenclatureDraft.trim();
    if (!valor || valor === process?.nomenclature) {
      setEditandoNomenclature(false);
      return;
    }
    setGuardandoNomenclature(true);
    setError("");
    try {
      const res = await fetch(`/api/processes/${processId}`, {
        body: JSON.stringify({ nomenclature: valor }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload.error ?? "No se pudo actualizar el nombre del expediente.");
        return;
      }
      await reload();
      setEditandoNomenclature(false);
    } catch {
      setError("No se pudo actualizar el nombre del expediente.");
    } finally {
      setGuardandoNomenclature(false);
    }
  }

  // El nombre de la necesidad se guarda en /api/necesidades/{id}, no en el
  // expediente: ese endpoint YA propaga el cambio a `procurement_processes.
  // nomenclature` (ver el comentario "la denominación es UNA" en esa ruta), así
  // que recargar el expediente después de este PATCH también refresca el título
  // de arriba si el usuario no lo había editado por su cuenta.
  async function guardarNombreNecesidad() {
    const necesidadId = necesidad?.id as string | undefined;
    const valor = nombreNecesidadDraft.trim();
    if (!necesidadId || !valor || valor === (necesidad?.nombre as string | undefined)) {
      setEditandoNombreNecesidad(false);
      return;
    }
    setGuardandoNombreNecesidad(true);
    setError("");
    try {
      const res = await fetch(`/api/necesidades/${necesidadId}`, {
        body: JSON.stringify({ nombre: valor }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload.error ?? "No se pudo actualizar el nombre de la necesidad.");
        return;
      }
      await reload();
      setEditandoNombreNecesidad(false);
    } catch {
      setError("No se pudo actualizar el nombre de la necesidad.");
    } finally {
      setGuardandoNombreNecesidad(false);
    }
  }

  async function deleteProcess() {
    setDeletingProcess(true);
    setError("");
    try {
      const res = await fetch(`/api/processes/${processId}`, { method: "DELETE" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload.error ?? "No se pudo eliminar el expediente.");
        setConfirmDeleteProcess(false);
        return;
      }
      window.location.href = "/expedientes";
    } catch {
      setError("No se pudo conectar para eliminar el expediente.");
      setConfirmDeleteProcess(false);
    } finally {
      setDeletingProcess(false);
    }
  }

  async function evaluateOffer() {
    setEvaluating(true);
    setError("");
    try {
      const response = await fetch(`/api/processes/${processId}/evaluate`, {
        body: JSON.stringify({ bidderName: evalBidderName }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "No se pudo evaluar la oferta.");
        return;
      }
      if (payload.statusAdvancedTo) {
        setNotice(`El expediente avanzó automáticamente a la etapa “${processStatusLabel(payload.statusAdvancedTo)}”.`);
      }
      await reload();
    } catch {
      setError("No se pudo conectar con el evaluador.");
    } finally {
      setEvaluating(false);
    }
  }

  async function detectRisks() {
    setDetectingRisks(true);
    setError("");
    try {
      const response = await fetch(`/api/processes/${processId}/risks`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "No se pudo detectar riesgos.");
        return;
      }
      await reload();
    } catch {
      setError("No se pudo conectar con el detector de riesgos.");
    } finally {
      setDetectingRisks(false);
    }
  }

  async function declareDesierto() {
    setConfirmDesierto(false);
    setDeclaringDesierto(true);
    setError("");
    try {
      const response = await fetch(`/api/processes/${processId}/desierto`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "No se pudo declarar desierto.");
        return;
      }
      setNotice("Procedimiento declarado desierto. Genera el Acta de declaratoria de desierto desde el panel.");
      await reload();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setDeclaringDesierto(false);
    }
  }

  async function generateDraft() {
    setDrafting(true);
    setError("");
    try {
      const response = await fetch(`/api/processes/${processId}/draft`, {
        body: JSON.stringify({ draftKind }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(payload.error ?? "No se pudo generar el documento.");
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${draftKind}-${process?.nomenclature ?? "expediente"}.docx`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("No se pudo conectar con el generador documental.");
    } finally {
      setDrafting(false);
    }
  }

  if (loading) {
    return <p className="sideMuted">Cargando expediente…</p>;
  }

  if (!process) {
    return (
      <div className="emptyState">
        <AlertTriangle size={20} />
        <p>{error || "Expediente no encontrado."}</p>
      </div>
    );
  }

  // Cuatro fuentes: la creación, los documentos que ya están cargados en este
  // componente, y —del endpoint— el registro de auditoría y los pasos cerrados.
  // Antes eran dos, y sin documentos la línea de tiempo se quedaba en una sola
  // entrada repitiendo una fecha que ya sale en la cabecera.
  const timeline: EntradaTimeline[] = unirTimeline(
    [{ at: process.created_at, label: "Expediente creado", tipo: "creacion" }],
    documents.map((doc) => ({
      at: doc.created_at,
      label: `${processDocKindLabel(doc.kind)} cargado: ${doc.title}`,
      tipo: "documento" as const,
    })),
    entradasTimeline,
  );

  return (
    <div className="tw grid gap-4 p-[18px]">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {editandoNomenclature ? (
            <div className="flex items-center gap-1.5">
              <Input
                autoFocus
                value={nomenclatureDraft}
                onChange={(event) => setNomenclatureDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void guardarNomenclature();
                  if (event.key === "Escape") setEditandoNomenclature(false);
                }}
                disabled={guardandoNomenclature}
                className="!h-9 !w-auto min-w-[320px] text-base font-semibold"
              />
              <Button
                size="sm"
                variant="ghost"
                disabled={guardandoNomenclature}
                loading={guardandoNomenclature}
                onClick={() => void guardarNomenclature()}
                aria-label="Guardar nombre del expediente"
              >
                {!guardandoNomenclature ? <Check size={14} /> : null}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={guardandoNomenclature}
                onClick={() => setEditandoNomenclature(false)}
                aria-label="Cancelar"
              >
                <X size={14} />
              </Button>
            </div>
          ) : (
            <h2 className="group flex items-center gap-1.5">
              {process.nomenclature}
              {permisos.manage ? (
                <button
                  type="button"
                  aria-label="Editar nombre del expediente"
                  onClick={() => {
                    setNomenclatureDraft(process.nomenclature);
                    setEditandoNomenclature(true);
                  }}
                  className="text-muted opacity-0 transition-opacity hover:text-ink group-hover:opacity-100"
                >
                  <Pencil size={14} />
                </button>
              ) : null}
            </h2>
          )}

          {/* Solo si el expediente viene de una necesidad (los creados directo,
              vía "crear expediente directo", no tienen — ver expediente-contexto.tsx). */}
          {necesidad ? (
            editandoNombreNecesidad ? (
              <div className="mt-1 flex items-center gap-1.5">
                <span className="shrink-0 text-[11px] font-semibold text-muted">Necesidad:</span>
                <Input
                  autoFocus
                  value={nombreNecesidadDraft}
                  onChange={(event) => setNombreNecesidadDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void guardarNombreNecesidad();
                    if (event.key === "Escape") setEditandoNombreNecesidad(false);
                  }}
                  disabled={guardandoNombreNecesidad}
                  className="!h-8 !w-auto min-w-[280px] text-[13px]"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={guardandoNombreNecesidad}
                  loading={guardandoNombreNecesidad}
                  onClick={() => void guardarNombreNecesidad()}
                  aria-label="Guardar nombre de la necesidad"
                >
                  {!guardandoNombreNecesidad ? <Check size={13} /> : null}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={guardandoNombreNecesidad}
                  onClick={() => setEditandoNombreNecesidad(false)}
                  aria-label="Cancelar"
                >
                  <X size={13} />
                </Button>
              </div>
            ) : (
              <p className="group mt-1 flex items-center gap-1.5 text-[12px] text-muted">
                Necesidad: {(necesidad.nombre as string) || "Sin nombre"}
                {permisos.manage ? (
                  <button
                    type="button"
                    aria-label="Editar nombre de la necesidad"
                    onClick={() => {
                      setNombreNecesidadDraft((necesidad.nombre as string) ?? "");
                      setEditandoNombreNecesidad(true);
                    }}
                    className="opacity-0 transition-opacity hover:text-ink group-hover:opacity-100"
                  >
                    <Pencil size={12} />
                  </button>
                ) : null}
              </p>
            )
          ) : null}

          <div className="mt-2 flex flex-wrap gap-2 [&>span]:text-[12px] [&>span]:text-muted">
            <span>{objectTypeLabel(process.object_type)}</span>
            {process.procedure_type ? <span>{processTypeLabel(process.procedure_type) ?? process.procedure_type}</span> : null}
            <span>{process.amount != null ? `S/ ${process.amount.toLocaleString("es-PE")}` : "Sin monto"}</span>
            <span>{process.entity ?? "Sin entidad"}</span>
          </div>
        </div>
        <div className="flex items-end gap-2">
          {permisos.manage ? (
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-muted">Estado</span>
              <Select
                className="!w-56"
                disabled={changingStatus}
                onChange={(event) => void changeStatus(event.target.value)}
                value={process.status}
              >
                {PROCESS_STATUSES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </label>
          ) : (
            <span className={`processStatus status-${process.status}`}>{processStatusLabel(process.status)}</span>
          )}
          {permisos.manage ? (
            // Separado del selector de Estado con un borde y margen propios: son
            // dos acciones de frecuencia muy distinta (cambiar estado es habitual,
            // eliminar no) y antes quedaban una junto a la otra sin más que un
            // `gap-2`, a un clic de distancia por error. El variant "ghost" le
            // baja el peso visual sin ocultarlo: sigue en rojo al pasar el mouse.
            <div className="ml-1 flex items-end border-l border-line pl-3">
              <Button
                variant="ghost"
                destructive
                size="sm"
                disabled={deletingProcess}
                loading={deletingProcess}
                onClick={() => setConfirmDeleteProcess(true)}
              >
                {!deletingProcess ? <Trash2 size={14} /> : null} Eliminar expediente
              </Button>
            </div>
          ) : null}
        </div>
      </header>

      {/* Dos orígenes: el fallo al cargar el expediente (del contexto) y el de
          la última acción del usuario. Se enseña el que haya, con prioridad al
          de carga: si el expediente no llegó, lo demás es consecuencia. */}
      {errorDelExpediente || error ? (
        <p className="formMessage errorText">{errorDelExpediente || error}</p>
      ) : null}
      {notice ? <p className="formMessage successText">{notice}</p> : null}

      <GlobalProgress />

      <NotificationBanner processId={process.id} />
      {/* Ancla para que la ficha de resumen pueda mandar aquí: los datos que
          enseña se escriben en estos pasos, y decirlo sin poder llegar de un
          clic obliga a buscarlos por la página. */}
      <div id="fase-1">
        <FaseUnoPanel canManage={permisos.manage} processId={process.id} />
      </div>
      <FaseDosPanel canManage={permisos.manage} processId={process.id} />
      <FaseTresPanel canManage={permisos.manage} processId={process.id} />

      <PhaseTracker canManage={permisos.upload} instruccion={instruccion} onSelectKind={prepareUpload} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(280px,380px)]">
        {/* Ficha de resumen del expediente. Es de SOLO LECTURA a propósito: cada
            dato lo escribe el paso que es su dueño (A3 el requerimiento, A4 la
            estrategia, A7 la certificación, A8 la aprobación), que es lo que se
            firma y se exporta al Formato 1. Un formulario aquí crearía una
            segunda verdad sobre el mismo dato, y la que no se exporta acabaría
            ganando en pantalla mientras el documento oficial dice otra cosa.

            Se quitaron el tipo de cambio, el resumen ejecutivo, los factores de
            evaluación y los requisitos de precalificación: no los escribía
            ningún paso y salían en "—" para siempre. Una ficha con dos tercios
            de guiones enseña que falta información cuando en realidad no había
            de dónde sacarla. */}
        <section className="processPanel">
          <div className="processPanelHead">
            <ScanSearch size={17} />
            <h3 className="panelTitulo">Resumen del expediente</h3>
            <a className="panelOrigen" href="#fase-1">
              Se escribe en los pasos de la Fase 1 →
            </a>
            {/* La carátula es el uso que esta ficha no tenía: entregar el
                expediente a la AGA o a quien audita sin obligarles a abrir la
                aplicación y recorrer cinco acordeones. */}
            <button
              className="secondaryButton compactButton"
              disabled={descargandoCaratula}
              onClick={descargarCaratula}
              title="Descarga una página con las decisiones del expediente y la archiva como documento"
              type="button"
            >
              {descargandoCaratula ? <Loader size={14} /> : <FileDown size={14} />}
              {descargandoCaratula ? "Generando…" : "Carátula"}
            </button>
          </div>
          <div className="fichaGrid">
            <Row
              label="Cuantía de la contratación"
              origen="A5"
              value={process.valor_estimado ? `S/ ${process.valor_estimado.toLocaleString("es-PE")}` : null}
            />
            <Row label="Moneda" origen="Ficha" value={process.moneda} />
            <Row label="Certificación presupuestal" origen="A7" value={resumen.certificacionPresupuestal} />
            {/* `procedure_type`, no `tipo_procedimiento`: esa columna quedó de una
                versión anterior del formulario y llegó a guardar nomenclaturas
                bajo un nombre que dice otra cosa. La que A4 mantiene es esta. */}
            <Row
              label="Tipo de procedimiento"
              origen="A4"
              value={
                process.procedure_type
                  ? processTypeLabel(process.procedure_type) ?? process.procedure_type
                  : null
              }
            />
            <Row label="Sistema de entrega" origen="A4" value={resumen.sistemaEntrega} />
            <Row label="Modalidad de pago" origen="A4" value={resumen.modalidadPago} />
            <Row label="Fórmula de reajuste" origen="A3" value={resumen.formulaReajuste} />
            <Row label="Interacción con el mercado" origen="A4" value={resumen.interaccionMercado} />
            <Row label="Requisitos de calificación" origen="A4" value={resumen.requisitosCalificacion} />
            <Row label="Tipo de evaluador" origen="A4" value={resumen.tipoEvaluador} />
            <Row label="Garantías y adelantos" origen="A4" value={resumen.garantiasAdelantos} />
            <Row label="Aprobación del expediente" origen="A8" value={resumen.aprobacion} />
          </div>
        </section>

        <section className="processPanel" ref={uploadSectionRef}>
          <div className="processPanelHead">
            <UploadCloud size={17} />
            <h3 className="panelTitulo">Documentos del expediente</h3>
          </div>

          {permisos.upload ? (
            <>
              <form className="flex flex-wrap items-center gap-2 rounded-[10px] border border-dashed border-line p-2.5" onSubmit={uploadDocument}>
                <Select className="!w-auto" onChange={(event) => setKind(event.target.value)} value={kind}>
                  {PROCESS_DOC_KINDS.filter((item) => item.value !== "generado").map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </Select>
                <Input
                  className="!w-auto min-w-[180px] flex-1"
                  onChange={(event) => setBidderName(event.target.value)}
                  placeholder="Postor (si es oferta)"
                  value={bidderName}
                />
                <input accept="application/pdf" className="text-[13px]" ref={fileRef} type="file" />
                <button className="primaryButton compactButton" disabled={uploading} type="submit">
                  {uploading ? <Loader size={15} /> : <UploadCloud size={15} />}
                  Subir al expediente
                </button>
              </form>
              <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-dashed border-line p-2.5">
                <Select className="!w-auto min-w-[200px] flex-1" onChange={(event) => setLibraryDocumentId(event.target.value)} value={libraryDocumentId}>
                  <option value="">Vincular documento existente...</option>
                  {libraryDocs.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.title}
                    </option>
                  ))}
                </Select>
                <button className="secondaryButton compactButton" disabled={linking || !libraryDocumentId} onClick={linkLibraryDocument} type="button">
                  <LinkIcon size={15} />
                  Vincular documento existente
                </button>
              </div>
            </>
          ) : null}

          {documents.length === 0 ? (
            <p className="sideMuted">Sin documentos cargados.</p>
          ) : (
            <ul className="m-0 grid list-none gap-2 p-0">
              {documents.map((doc) => (
                <li className="flex items-start gap-2.5 rounded-[14px] border border-line/92 px-3 py-2.5 [&>svg]:mt-0.5 [&>svg]:text-brand" key={doc.id}>
                  <FileText size={16} />
                  <div className="grid flex-1 gap-0.5 [&>strong]:text-[13.5px] [&>strong]:text-ink [&>small]:text-[11.5px] [&>small]:text-muted">
                    <strong>{doc.title}</strong>
                    <small>
                      {processDocKindLabel(doc.kind)}
                      {doc.library_document_id ? " · vinculado de biblioteca" : ""}
                      {doc.bidder_name ? ` · ${doc.bidder_name}` : ""} · {formatDate(doc.created_at)}
                    </small>
                    {doc.status === "error" && doc.error_message ? (
                      <small className="!text-[#b45309]">{doc.error_message}</small>
                    ) : null}
                  </div>
                  <DocStatus status={doc.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="processSide">
          <section className="processPanel">
            <div className="processPanelHead">
              <Clock size={17} />
              <h3 className="panelTitulo">Línea de tiempo</h3>
            </div>
            <ul className="timeline">
              {timeline.map((item, index) => {
                const Icon = ICONO_TIMELINE[item.tipo];
                return (
                  <li data-tipo={item.tipo} key={`${item.at}-${index}`}>
                    <Icon size={14} />
                    <div>
                      <span>{item.label}</span>
                      <small>
                        {formatDate(item.at)}
                        {/* Quién lo hizo: es la mitad de la pregunta que trae a
                            alguien a mirar una línea de tiempo. */}
                        {item.actor ? ` · ${item.actor}` : ""}
                      </small>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="processPanel processSoon">
            <div className="processPanelHead">
              <ScanSearch size={17} />
              <h3 className="panelTitulo">Centro operativo del expediente</h3>
            </div>
            <div className="sourceMetaGrid">
              <span>Documentos: {documents.length}</span>
              <span>Evaluaciones: {evaluations.length}</span>
              <span>Riesgos: {risks[0]?.items?.length ?? 0}</span>
            </div>
            <div className="sourceActions">
              <Link
                className="secondaryButton compactButton"
                href={`/analizar?processId=${process.id}&processType=${process.procedure_type ?? ""}`}
              >
                <ScanSearch size={15} />
                Analizar documento
              </Link>
              <Link
                className="secondaryButton compactButton"
                href={`/validar?processId=${process.id}&processType=${process.procedure_type ?? ""}&pregunta=${encodeURIComponent(`Validar expediente ${process.nomenclature}`)}`}
              >
                <ShieldAlert size={15} />
                Validar procedimiento
              </Link>
              <Link
                className="secondaryButton compactButton"
                href={`/chat?processType=${process.procedure_type ?? ""}&pregunta=${encodeURIComponent(`Revisar expediente ${process.nomenclature} y sus documentos asociados`)}`}
              >
                <MessageSquareText size={15} />
                Consultar en chat
              </Link>
              <Link className="secondaryButton compactButton" href="/documentos">
                <LinkIcon size={15} />
                Biblioteca normativa
              </Link>
            </div>
            <div className="grid gap-2.5">
              <label className="grid gap-1.5">
                <span className="text-[12px] font-semibold text-muted">Postor a evaluar</span>
                <Input
                  onChange={(event) => setEvalBidderName(event.target.value)}
                  placeholder="Vacío: primera oferta"
                  value={evalBidderName}
                />
              </label>
              <button className="primaryButton compactButton" disabled={!permisos.evaluate || evaluating} onClick={evaluateOffer} type="button">
                {evaluating ? <Loader size={15} /> : <CheckCircle2 size={15} />}
                Evaluar oferta
              </button>
              <button className="secondaryButton compactButton" disabled={!permisos.risks || detectingRisks} onClick={detectRisks} type="button">
                {detectingRisks ? <Loader size={15} /> : <ShieldAlert size={15} />}
                Detectar riesgos
              </button>
              <label className="grid gap-1.5">
                <span className="text-[12px] font-semibold text-muted">Documento a generar</span>
                <Select onChange={(event) => setDraftKind(event.target.value)} value={draftKind}>
                  {draftKinds.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </Select>
              </label>
              <button className="secondaryButton compactButton" disabled={!permisos.draft || drafting} onClick={generateDraft} type="button">
                {drafting ? <Loader size={15} /> : <Download size={15} />}
                Generar DOCX
              </button>
              {permisos.evaluate && (process.status === "seleccion" || process.status === "buena_pro") ? (
                <button
                  className="secondaryButton compactButton desiertoButton"
                  disabled={declaringDesierto}
                  onClick={() => setConfirmDesierto(true)}
                  type="button"
                >
                  {declaringDesierto ? <Loader size={15} /> : <Ban size={15} />}
                  Declarar desierto
                </button>
              ) : null}
            </div>
          </section>

          <section className="processPanel">
            <div className="processPanelHead">
              <CheckCircle2 size={17} />
              <h3 className="panelTitulo">Última evaluación</h3>
            </div>
            {evaluations.length === 0 ? (
              <p className="sideMuted">Aún no hay matriz de evaluación.</p>
            ) : (
              <div className="grid gap-2">
                <div className={`${RESULT_BADGE_BASE} ${RESULT_BADGE[evaluations[0]?.result ?? "riesgo"] ?? RESULT_BADGE.riesgo}`}>
                  {evaluations[0]?.result ?? "riesgo"}
                </div>
                <small>
                  {evaluations[0]?.bidder_name ?? "Postor no identificado"} ·{" "}
                  {evaluations[0] ? formatDate(evaluations[0].created_at) : ""}
                </small>
                <div className="overflow-x-auto">
                  <table className={MATRIX_TABLE}>
                    <thead>
                      <tr>
                        <th>Requisito</th>
                        <th>Resultado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(evaluations[0]?.matrix ?? []).slice(0, 6).map((row, index) => (
                        <tr key={`${row.requisito}-${index}`}>
                          <td>{row.requisito}</td>
                          <td>{row.resultado}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          <section className="processPanel">
            <div className="processPanelHead">
              <ShieldAlert size={17} />
              <h3 className="panelTitulo">Riesgos</h3>
            </div>
            {risks.length === 0 ? (
              <p className="sideMuted">Aún no hay matriz de riesgos.</p>
            ) : (
              <div className="grid gap-2">
                {(risks[0]?.items ?? []).slice(0, 5).map((risk, index) => (
                  <article className={`${RISK_ITEM_BASE} ${RISK_ITEM[risk.nivel] ?? RISK_ITEM_DEFAULT}`} data-level={risk.nivel} key={`${risk.riesgo}-${index}`}>
                    <strong>{risk.riesgo}</strong>
                    <span>{risk.nivel}</span>
                    <p>{risk.sustento}</p>
                    <small>{risk.accionRecomendada}</small>
                  </article>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmDeleteProcess}
        title="Eliminar expediente"
        message={`¿Eliminar el expediente "${process.nomenclature}"? Se borrarán sus documentos, evaluaciones y riesgos. La necesidad de origen volverá a estado "Conforme". Esta acción no se puede deshacer.`}
        tone="danger"
        confirmLabel="Eliminar"
        onConfirm={() => void deleteProcess()}
        onCancel={() => setConfirmDeleteProcess(false)}
      />

      <ConfirmDialog
        open={confirmDesierto}
        title="Declarar desierto"
        message="¿Declarar DESIERTO este procedimiento? La selección se cierra sin adjudicación."
        tone="warning"
        confirmLabel="Declarar desierto"
        onConfirm={() => void declareDesierto()}
        onCancel={() => setConfirmDesierto(false)}
      />
    </div>
  );
}
