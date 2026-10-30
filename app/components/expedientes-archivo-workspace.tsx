"use client";
import { archivoNeedsRecovery } from "@/lib/archivo-processing-policy";
import { prepareArchivoUpload } from "@/lib/archivo-upload-client";

import dynamic from "next/dynamic";
import { SkeletonList } from "./expedientes-archivo/skeleton";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  idPanel,
  idPestana,
  propsPanel,
  propsPestana,
  siguientePestana,
} from "@/lib/pestanas-accesibles";
import {
  CheckCircle2,
  FileSignature,
  HelpCircle,
  Info,
  Moon,
  Search,
  Sparkles,
  Sun,
  Trash2,
  UploadCloud,
  X,
  AlertCircle,
  BookOpen,
  Compass,
  PlusCircle,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { maxPdfSizeBytes, maxPdfSizeLabel } from "@/lib/upload-limits";
import type {
  DuplicateMatch,
  ExpedienteItem,
  ExpedienteLegajoItem,
  PdfInventory,
  SortBy,
  SortDir,
  StatusFilter,
  SubirForm,
  ViewMode,
  WizardStep,
  WorkspaceTab,
} from "./expedientes-archivo/types";
import { BuscarTabContent } from "./expedientes-archivo/buscar-tab-content";
import { ExpSlideOver } from "./expedientes-archivo/slide-over-shell";
import {
  OnboardingTour,
  TourTrigger,
  useTour,
  type TourStep,
} from "./expedientes-archivo/onboarding-tour";
import { UndoToasts, useUndoStack } from "./expedientes-archivo/undo";
import {
  EXP_HELP_TEXT,
  EXP_SLIDE_OVER_BODY,
  EXP_TOAST,
  EXP_TOAST_CLOSE,
  EXP_TOAST_ICON,
  EXP_TOAST_MESSAGE,
  expBtnClass,
} from "./expedientes-archivo/estilos";
import { cn } from "@/lib/utils";
import { useToasts } from "./expedientes-archivo/use-toasts";
import { useExpedienteSearch } from "./expedientes-archivo/use-expediente-search";
import { useExpedientesPreferences } from "./expedientes-archivo/use-preferences";
import { useBorradorSubir } from "./expedientes-archivo/use-borrador-subir";
import { EMPTY_SUBIR_FORM, type BorradorSubir } from "./expedientes-archivo/borrador-subir";
import { firmaDuplicados } from "./expedientes-archivo/duplicados";
import { useDebouncedValue } from "@/app/hooks/use-debounced-value";
import { useTheme } from "@/app/hooks/use-theme";
import { useDensity } from "@/app/hooks/use-density";
import type { PaginationInfo } from "./expedientes-archivo/pagination";
import {
  loadExpedientes as loadExpedientesAction,
  fetchExpedienteById,
  updateExpediente as updateExpedienteAction,
  autoFillFromPdf as autoFillFromPdfAction,
  detectDuplicates as detectDuplicatesAction,
  fetchUbicacionSugerida,
  type ExpedienteCounts,
  type UbicacionSugerida,
} from "@/lib/expedientes-archivo-actions";

// Todo lo que hay debajo se muestra SOLO bajo condicion —otra pestaña, un modal,
// un panel lateral— y aun asi se descargaba al abrir la pagina. «Buscar» se
// queda estatica a proposito: es la pestaña por defecto y es lo que se ve al
// entrar.
//
// `ssr: false` porque ninguno aporta nada al HTML inicial: todos exigen una
// interaccion previa.
const BuscarRagTab = dynamic(() => import("./expedientes-archivo/buscar-rag-tab").then(m => m.BuscarRagTab));
const SubirRagTab = dynamic(() => import("./expedientes-archivo/subir-rag-tab").then(m => m.SubirRagTab));
const importarSubir = () => import("./expedientes-archivo/subir-tab-content");
const SubirTabContent = dynamic(() => importarSubir().then((m) => m.SubirTabContent), {
  loading: () => <SkeletonList count={4} />,
  ssr: false,
});
const importarRespuesta = () => import("./expedientes-archivo/respuesta-panel");
const RespuestaPanel = dynamic(() => importarRespuesta().then((m) => m.RespuestaPanel), {
  loading: () => <SkeletonList count={3} />,
  ssr: false,
});
const ExpedienteSlideOver = dynamic(() => import("./expedientes-archivo/slide-over-detalle").then((m) => m.ExpedienteSlideOver), { ssr: false });
const CommandPalette = dynamic(() => import("./expedientes-archivo/command-palette").then((m) => m.CommandPalette), { ssr: false });
const ChatPanel = dynamic(() => import("./expedientes-archivo/chat-panel").then((m) => m.ChatPanel), { ssr: false });
const BulkMoveModal = dynamic(() => import("./expedientes-archivo/bulk-move-modal").then((m) => m.BulkMoveModal), { ssr: false });
const ReplaceFileModal = dynamic(() => import("./expedientes-archivo/replace-file-modal").then((m) => m.ReplaceFileModal), { ssr: false });

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function statusLabel(status: ExpedienteItem["status"]) {
  return {
    error: "Con error",
    indexed: "Indexado",
    processing: "Procesando",
    uploaded: "Subido",
  }[status];
}

// Ajusta los conteos globales del dashboard al añadir (+1) o quitar (-1) un
// expediente, sin tener que refetchear. Mantiene el total, el tamaño y el
// desglose por estado coherentes durante el borrado diferido.
function adjustCounts(c: ExpedienteCounts, exp: ExpedienteItem, delta: number): ExpedienteCounts {
  const next = { ...c };
  next.total = Math.max(0, next.total + delta);
  next.totalBytes = Math.max(0, next.totalBytes + delta * (exp.file_size ?? 0));
  if (exp.status === "indexed") next.indexed = Math.max(0, next.indexed + delta);
  else if (exp.status === "uploaded" || exp.status === "processing")
    next.pending = Math.max(0, next.pending + delta);
  else if (exp.status === "error") next.error = Math.max(0, next.error + delta);
  return next;
}

// El formulario vacío vive en borrador-subir.ts (compartido con la validación
// de shape del borrador).
const EMPTY_FORM: SubirForm = EMPTY_SUBIR_FORM;

// La SERIE DOCUMENTAL se arma con el tipo de documento + el numero detectado
// (ej. "Resolución 004-2024-MDCH-A"). El SGD NO se autocompleta: es el N° de
// expediente del sistema de gestion documental EXTERNO y lo asigna el usuario a mano.
function buildSerieDocumental(
  tipoDocumento: string | null | undefined,
  numero: string | number | null | undefined,
): string {
  const tipo = tipoDocumento == null ? "" : String(tipoDocumento).trim();
  const num = numero == null ? "" : String(numero).trim();
  if (!num) return "";
  return [tipo, num].filter(Boolean).join(" ");
}

/** Prefijo de los identificadores de esta lista de pestañas en la página. */
const BASE_PESTANAS = "archivo";

// "expTab"/"active" se conservan como marcadores literales (no aportan CSS
// propio) porque el tour guiado (onboarding-tour.tsx) las busca por
// `document.querySelector(".expTab:first-of-type")`.
//
// El color de fondo/texto NO va incondicional en la base: Tailwind v4 genera
// las utilidades en el orden en que las descubre al escanear (no en un orden
// fijo), así que una utilidad nucleo como `bg-transparent` puede terminar
// generada DESPUES de una utilidad de nuestro tema (`bg-exp-brand-soft`) y
// ganarle la cascada aunque tengan la misma especificidad — la pestaña
// activa se quedaba sin resaltar. Con el color condicionado en cada llamada
// (nunca las dos clases del mismo tipo en el mismo elemento) el orden de
// generación deja de importar.
const EXP_TAB =
  "expTab relative inline-flex items-center gap-2 whitespace-nowrap rounded-t-exp border-0 px-[18px] py-3.5 text-sm font-semibold " +
  "transition-all duration-[180ms] ease-[cubic-bezier(0.4,0,0.2,1)]";
const EXP_TAB_INACTIVE = "bg-transparent text-exp-muted hover:bg-exp-line-soft hover:text-exp-ink";
const EXP_TAB_ACTIVE = "active bg-exp-brand-soft text-exp-brand";

const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    target: ".expPanel",
    title: "¡Bienvenido a la Biblioteca de Expedientes!",
    content:
      "Aquí podrás buscar, organizar y consultar todos los expedientes archivados de la municipalidad. Te mostraremos las funciones principales en unos segundos.",
    position: "bottom",
  },
  {
    id: "search-tab",
    target: ".expTab:first-of-type",
    title: "Buscar expedientes",
    content:
      "Aquí puedes buscar por contenido (palabras clave) o hacer preguntas en lenguaje natural a la IA. La IA entiende consultas como '¿dónde está el expediente de la licencia 2024-0345?'",
    position: "bottom",
  },
  {
    id: "search-bar",
    target: ".expSearchBar",
    title: "Barra de búsqueda",
    content:
      "Escribe lo que buscas. Usa '/' desde cualquier lugar para enfocar esta barra. El filtro por año es opcional.",
    position: "bottom",
  },
  {
    id: "stats",
    target: ".expStats",
    title: "Resumen del archivo",
    content:
      "Aquí ves el estado general: cuántos expedientes hay, cuántos están indexados, pendientes o con error.",
    position: "top",
  },
  {
    id: "filters",
    target: ".expListHeader",
    title: "Filtros y vista",
    content:
      "Filtra por estado, oficina, estante o tipo. Cambia entre vista de lista, tabla o tarjetas según prefieras.",
    position: "bottom",
  },
  {
    id: "upload-tab",
    target: ".expTab:nth-of-type(2)",
    title: "Subir expedientes",
    content:
      "Sube PDFs escaneados o digitales. El sistema hace OCR automáticamente y los indexa para búsqueda. Sigue el wizard de 4 pasos.",
    position: "bottom",
  },
  {
    id: "command-palette",
    target: "body",
    title: "Atajos de teclado",
    content:
      "Presiona Ctrl+K en cualquier momento para abrir la paleta de comandos. También puedes usar Ctrl+I para el chat, Ctrl+B para buscar, Ctrl+U para subir, y '?' para ver todos los atajos.",
    position: "bottom",
    action: "Prueba presionando Ctrl+K ahora.",
  },
];

export function ExpedientesArchivoWorkspace({
  canManage,
  isAdmin = false,
  userOficina = null,
}: {
  canManage: boolean;
  isAdmin?: boolean;
  // Nombre de la OFICINA del usuario (no de la entidad/municipalidad entera) —
  // ver el comentario en app/expedientes-archivo/page.tsx.
  userOficina?: string | null;
}) {
  const prefs = useExpedientesPreferences();
  const borradorSubir = useBorradorSubir();
  const { stack: undoStack, push: pushUndo, execute: executeUndo, dismiss: dismissUndo } =
    useUndoStack();
  const { resolved: resolvedTheme, toggle: toggleTheme } = useTheme();
  const { density, toggle: toggleDensity } = useDensity();

  const [tab, setTab] = useState<WorkspaceTab>(prefs.tab);
  // Sin permiso de gestión solo se muestra "Buscar": las flechas deben recorrer
  // lo que hay en pantalla, no las tres de siempre.
  const pestanasArchivo: WorkspaceTab[] = canManage
    ? ["buscar", "subir", "responder", "buscar-rag", "subir-rag"]
    : ["buscar", "buscar-rag"];
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });

  useEffect(() => {
    prefs.setTab(tab);
  }, [tab, prefs]);

  const [expedientes, setExpedientes] = useState<ExpedienteItem[]>([]);
  // Conteos globales del archivo (todo, no solo la página) para el dashboard.
  const [counts, setCounts] = useState<ExpedienteCounts | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>(prefs.viewMode);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(prefs.statusFilter);
  const [advancedFilters, setAdvancedFilters] = useState(prefs.filters);
  const [sortBy, setSortBy] = useState<SortBy>(prefs.sortBy);
  const [sortDir, setSortDir] = useState<SortDir>(prefs.sortDir);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearchInput = useDebouncedValue(searchInput, 250);

  useEffect(() => {
    prefs.setViewMode(viewMode);
  }, [viewMode, prefs]);
  useEffect(() => {
    prefs.setStatusFilter(statusFilter);
  }, [statusFilter, prefs]);
  useEffect(() => {
    prefs.setFilters(advancedFilters);
  }, [advancedFilters, prefs]);
  useEffect(() => {
    prefs.setSortBy(sortBy);
  }, [sortBy, prefs]);
  useEffect(() => {
    prefs.setSortDir(sortDir);
  }, [sortDir, prefs]);

  // Para usuarios no-admin la oficina viene fija de su perfil (aislamiento por
  // oficina): se pre-llena y el servidor la fuerza de todos modos.
  const baseForm = useMemo<SubirForm>(
    () => (isAdmin ? EMPTY_FORM : { ...EMPTY_FORM, oficina: userOficina ?? "" }),
    [isAdmin, userOficina],
  );
  const [form, setForm] = useState<SubirForm>(baseForm);
  const [file, setFile] = useState<File | null>(null);
  const [wizardStep, setWizardStep] = useState<WizardStep>(0);
  const [uploading, setUploading] = useState(false);
  const [reindexingId, setReindexingId] = useState<string | null>(null);
  // Con borrado diferido la fila desaparece al instante (no hay llamada en vuelo
  // durante la ventana de deshacer), así que no se necesita indicador por fila.
  const deletingId: string | null = null;
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [extracting, setExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<PdfInventory | null>(null);
  const [recentUploads, setRecentUploads] = useState<ExpedienteItem[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  // Campos rellenados automáticamente (IA/OCR) y aún no editados a mano. Se usa
  // para marcarlos visualmente ("IA") y distinguirlos de lo que escribió el usuario.
  const [autoFilledFields, setAutoFilledFields] = useState<Set<keyof SubirForm>>(new Set());
  // Posibles duplicados detectados al cargar/identificar el PDF o al teclear el SGD.
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [dupsDismissed, setDupsDismissed] = useState(false);
  // Firma de la última comprobación de duplicados, para no repetirla (clave por
  // SGD/serie; si no hay, por título). Evita que la detección al teclear y la de
  // la extracción se pisen.
  const lastDupSignatureRef = useRef<string>("");
  // SGD/serie con debounce: disparan la detección de duplicados al teclear a mano.
  const debouncedSgd = useDebouncedValue(form.sgdExpediente, 600);
  const debouncedSerie = useDebouncedValue(form.serieDocumento, 600);
  // Sugerencia de ubicación física basada en lo ya archivado.
  const [ubicacionSugerida, setUbicacionSugerida] = useState<UbicacionSugerida | null>(null);
  const [siguientePaquete, setSiguientePaquete] = useState<string | null>(null);
  // Modo de subida: uno por uno (wizard) o por lotes (varios PDF a la vez).
  const [uploadMode, setUploadMode] = useState<"single" | "batch">("single");
  // Expediente (legajo) elegido para adjuntar el documento, o null para crear
  // uno nuevo. Ver docs/superpowers/plans/2026-08-27-legajo-ui-wizard-slideover.md.
  const [selectedLegajo, setSelectedLegajo] = useState<ExpedienteLegajoItem | null>(null);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [replaceExp, setReplaceExp] = useState<ExpedienteItem | null>(null);
  const [openExp, setOpenExp] = useState<ExpedienteItem | null>(null);
  // Edición de metadata del expediente abierto (slide-over).
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, unknown>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const tour = useTour(TOUR_STEPS, "exp-tour-completed-v1");

  // Avisos (toasts) y diálogo de confirmación: hook dedicado.
  const { toasts, showToast, dismissToast, confirm, showConfirm, closeConfirm } = useToasts();

  // Búsqueda vectorial, consulta a la IA y panel de chat: hook dedicado.
  const {
    mode,
    query,
    setQuery,
    filterAnio,
    setFilterAnio,
    filterOficina,
    setFilterOficina,
    filterMateria,
    setFilterMateria,
    showFilters,
    setShowFilters,
    searching,
    results,
    answer,
    searchMessage,
    chatOpen,
    setChatOpen,
    chatMessages,
    activeFilterCount,
    runSearch,
    changeMode,
    askInChat,
  } = useExpedienteSearch(showToast);

  // Expedientes ocultados de la UI mientras corre su ventana de "deshacer"
  // (borrado diferido). Se filtran de cualquier lista que venga del servidor,
  // porque la fila aún existe en BD hasta que se confirma el borrado.
  const pendingDeleteRef = useRef<Map<string, ExpedienteItem>>(new Map());

  const loadExpedientes = useCallback(async (page = 1) => {
    try {
      const result = await loadExpedientesAction({ page, limit: 50 });
      const pending = pendingDeleteRef.current;
      const fetched = (result.expedientes as ExpedienteItem[]) ?? [];
      setExpedientes(pending.size ? fetched.filter((e) => !pending.has(e.id)) : fetched);
      let serverCounts = result.counts;
      if (serverCounts && pending.size) {
        for (const ex of pending.values()) serverCounts = adjustCounts(serverCounts, ex, -1);
      }
      setCounts(serverCounts);
      setPagination(result.pagination);
    } catch {
      // Silenciar
    } finally {
      setLoadingList(false);
    }
  }, []);

  // Carga los expedientes subidos recientemente (los ultimos 10) para mostrarlos
  // en la pestana Subir. Permite al usuario ver y gestionar lo que acaba de subir
  // sin tener que ir a la pestana Buscar.
  const refreshRecentUploads = useCallback(async () => {
    setLoadingRecent(true);
    try {
      const result = await loadExpedientesAction({ page: 1, limit: 10 });
      const pending = pendingDeleteRef.current;
      const fetched = (result.expedientes as ExpedienteItem[]) ?? [];
      setRecentUploads(pending.size ? fetched.filter((e) => !pending.has(e.id)) : fetched);
    } catch {
      // Silenciar
    } finally {
      setLoadingRecent(false);
    }
  }, []);

  // Carga inicial de recientes cuando el usuario abre la pestana Subir
  useEffect(() => {
    if (tab === "subir" && canManage) {
      // Carga de datos al montar/cambiar de tab; el setState ocurre tras await.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void refreshRecentUploads();
    }
  }, [tab, canManage, refreshRecentUploads]);

  const hasPending = useMemo(
    () => expedientes.some((exp) => exp.status === "uploaded" || exp.status === "processing"),
    [expedientes],
  );

  useEffect(() => {
    // Carga inicial de la lista; el setState ocurre tras await.
    void loadExpedientes();
  }, [loadExpedientes]);

  // Polling de la lista de recientes cuando hay items pendientes
  const hasRecentPending = useMemo(
    () => recentUploads.some((exp) => exp.status === "uploaded" || exp.status === "processing"),
    [recentUploads],
  );

  // UN solo temporizador para las dos listas (antes eran dos efectos
  // independientes, cada uno con su propio setInterval de 4 s): con un
  // expediente recién subido, `hasPending` y `hasRecentPending` se ponen en
  // true casi a la vez (el upload refresca ambas listas), así que los dos
  // sondeos corrían en paralelo y por sí solos agotaban el límite de la ruta
  // ("Indexando con Pinecone..." se quedaba pegado porque el sondeo que iba a
  // detectar "ya terminó" era justo el que estaba recibiendo 429).
  useEffect(() => {
    if (!hasPending && !hasRecentPending) return;
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (attempts > 75) {
        clearInterval(timer);
        return;
      }
      if (hasPending) void loadExpedientes();
      if (hasRecentPending) void refreshRecentUploads();
    }, 4000);
    return () => clearInterval(timer);
  }, [hasPending, hasRecentPending, loadExpedientes, refreshRecentUploads]);

  // Auto-guardado del borrador del wizard (el debounce vive en el hook). Nunca
  // durante la subida: si esta termina bien, el borrador se limpia explícito;
  // si falla, el efecto vuelve a correr con uploading=false y lo reagenda.
  useEffect(() => {
    if (!canManage || uploading) return;
    borradorSubir.programarGuardado({
      form,
      wizardStep,
      legajo: selectedLegajo,
      fileName: file?.name ?? null,
      fileSize: file?.size ?? null,
    });
  }, [canManage, uploading, form, wizardStep, selectedLegajo, file, borradorSubir]);

  // Refs estables para evitar memory leak en el keyboard listener
  const tourOpenRef = useRef(tour.open);
  const tourDismissRef = useRef(tour.dismiss);
  useEffect(() => {
    tourOpenRef.current = tour.open;
    tourDismissRef.current = tour.dismiss;
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "i" && !isTyping) {
        e.preventDefault();
        setChatOpen(true);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "u" && canManage && !isTyping) {
        e.preventDefault();
        setTab("subir");
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b" && !isTyping) {
        e.preventDefault();
        setTab("buscar");
        return;
      }
      if ((e.metaKey || e.ctrlKey) && tab === "subir" && canManage) {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          setWizardStep((s) => (Math.min(3, s + 1) as WizardStep));
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          setWizardStep((s) => (Math.max(0, s - 1) as WizardStep));
        }
      }
      if (e.key === "/" && !isTyping) {
        e.preventDefault();
        const input = document.getElementById("exp-search-input") as HTMLInputElement | null;
        input?.focus();
        return;
      }
      if (e.key === "?" && !isTyping) {
        e.preventDefault();
        setHelpOpen((v) => !v);
        return;
      }
      if (e.key === "Escape") {
        if (cmdOpen) setCmdOpen(false);
        else if (chatOpen) setChatOpen(false);
        else if (openExp) closeSlideOver();
        else if (bulkOpen) setBulkOpen(false);
        else if (replaceExp) setReplaceExp(null);
        else if (helpOpen) setHelpOpen(false);
        else if (confirm) closeConfirm();
        else if (tourOpenRef.current) tourDismissRef.current();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tab, canManage, cmdOpen, chatOpen, openExp, bulkOpen, replaceExp, helpOpen, confirm, closeConfirm, setChatOpen]);

  // Cierra el slide-over y sale de modo edición, limpiando el borrador.
  function closeSlideOver() {
    setOpenExp(null);
    setEditMode(false);
    setEditForm({});
  }

  function setField<K extends keyof SubirForm>(key: K, value: SubirForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    // Una edición manual deja de considerarse "rellenado por IA".
    setAutoFilledFields((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  // Chip "IA" para campos rellenados automáticamente y aún no editados a mano.
  const autoBadge = (key: keyof SubirForm) =>
    autoFilledFields.has(key) ? (
      <span
        title="Autocompletado por IA — revisa el valor"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 3,
          marginLeft: 6,
          padding: "1px 6px",
          borderRadius: 999,
          fontSize: 10,
          fontWeight: 600,
          background: "var(--exp-accent-soft, rgba(99,102,241,0.12))",
          color: "var(--exp-accent, #6366f1)",
        }}
      >
        <Sparkles size={9} /> IA
      </span>
    ) : null;

  // Rellena la ubicación física desde una sugerencia del backend.
  function applyUbicacionSugerida(u: UbicacionSugerida) {
    const map: Array<[keyof SubirForm, string | boolean | null]> = [
      ["tipoAlmacenamiento", u.tipo_almacenamiento],
      ["nroArchivador", u.nro_archivador],
      ["nroPaquete", u.nro_paquete],
      ["empastado", u.empastado === null ? "" : u.empastado ? "si" : "no"],
      ["colorArchivador", u.color_archivador],
      ["nroEstante", u.nro_estante],
      ["nroPiso", u.nro_piso],
      ["nroLocal", u.nro_local],
    ];
    const filled = new Set<keyof SubirForm>();
    setForm((prev) => {
      const next = { ...prev };
      for (const [k, v] of map) {
        const str = v === null || v === undefined ? "" : String(v);
        if (str) {
          next[k] = str as never;
          filled.add(k);
        }
      }
      return next;
    });
    setAutoFilledFields((prev) => {
      const merged = new Set(prev);
      for (const k of filled) merged.add(k);
      return merged;
    });
    showToast("Ubicación física aplicada. Ajusta lo que cambie.", "success");
  }

  function canProceedStep(): { ok: boolean; reason?: string } {
    if (wizardStep === 0) {
      if (!file) return { ok: false, reason: "Selecciona un PDF para continuar" };
    }
    return { ok: true };
  }

  // Abre el slide-over de un expediente desde un resultado de búsqueda. La lista
  // está paginada (50) pero la búsqueda es global, así que el expediente puede no
  // estar cargado: en ese caso se trae su metadata por id.
  async function openExpedienteById(id: string) {
    const loaded = expedientes.find((e) => e.id === id);
    if (loaded) {
      setOpenExp(loaded);
      return;
    }
    try {
      const exp = (await fetchExpedienteById(id)) as ExpedienteItem | null;
      if (exp) {
        setOpenExp(exp);
      } else {
        window.open(`/api/expedientes-archivo/${id}`, "_blank");
      }
    } catch {
      window.open(`/api/expedientes-archivo/${id}`, "_blank");
    }
  }

  // Aplica un inventario extraído al formulario. Solo rellena campos vacíos (no
  // pisa lo que el usuario ya escribió) y marca los rellenados como "IA" para que
  // se distingan visualmente. Devuelve cuántos campos aplicó.
  function applyInventory(data: PdfInventory): number {
    let appliedCount = 0;
    const filled = new Set<keyof SubirForm>();
    setForm((prev) => {
      const next = { ...prev };
      const tryApply = (
        extractedValue: string | number | null | undefined,
        formKey: keyof SubirForm,
        transform: (v: string | number) => string = (v) => String(v),
      ) => {
        const str = extractedValue == null ? "" : String(extractedValue).trim();
        if (!str) return;
        const current = next[formKey];
        if (current && String(current).trim() !== "") return;
        next[formKey] = transform(extractedValue as string | number) as never;
        filled.add(formKey);
        appliedCount += 1;
      };
      // SGD NO se autocompleta (manual: N° del sistema documental externo). La
      // SERIE DOCUMENTAL es la denominación oficial LITERAL que la IA lee del
      // encabezado (ej. "RESOLUCIÓN DE ALCALDÍA N° 004-2024-MDCH-A"); si no la
      // detectó, se compone como fallback con tipo + número.
      const serieDetectada =
        data.serieDocumental?.trim() || buildSerieDocumental(data.tipoDocumento, data.numeroExpediente);
      tryApply(serieDetectada, "serieDocumento");
      tryApply(data.tipoDocumento, "tipoDocumento");
      tryApply(data.anio, "anio");
      // No-admin: la oficina viene fija del perfil del usuario; la detectada
      // por la IA no debe pisarla (el servidor la forzaría igualmente).
      if (isAdmin) tryApply(data.oficina, "oficina");
      tryApply(data.materia, "materia");
      tryApply(data.asunto, "asunto");
      tryApply(data.personaNombre, "personaNombre");
      tryApply(data.personaTipo, "personaTipo");
      tryApply(data.resumen, "resumen");
      tryApply(data.nroFolios, "folio");
      // Si el titulo esta vacio, usar la serie documental como fallback.
      if (!next.title?.trim() && serieDetectada) {
        next.title = serieDetectada;
        filled.add("title");
        appliedCount += 1;
      }
      return next;
    });
    if (appliedCount > 0) {
      setAutoFilledFields((prev) => {
        const merged = new Set(prev);
        for (const k of filled) merged.add(k);
        return merged;
      });
    }
    return appliedCount;
  }

  // Comprueba si ya existe un expediente igual (por SGD/serie/título) para avisar
  // antes de reprocesar OCR/embeddings en vano.
  const checkDuplicatesFor = useCallback(
    async (params: { title?: string; sgd?: string; serie?: string }) => {
      if (!params.title && !params.sgd && !params.serie) return;
      const signature = firmaDuplicados(params);
      if (signature === lastDupSignatureRef.current) return;
      lastDupSignatureRef.current = signature;
      setCheckingDuplicates(true);
      try {
        const { duplicates: found } = await detectDuplicatesAction(params);
        setDuplicates(found);
        setDupsDismissed(false);
      } catch {
        // La detección es una ayuda; nunca debe romper la subida.
      } finally {
        setCheckingDuplicates(false);
      }
    },
    [],
  );

  // Pide al backend la ubicación física probable (misma caja del lote, siguiente
  // paquete) según lo ya archivado para esta serie/año.
  const loadUbicacionSugeridaFor = useCallback(
    async (params: { serie?: string; anio?: string | number }) => {
      try {
        const res = await fetchUbicacionSugerida(params);
        setUbicacionSugerida(res.ultima);
        setSiguientePaquete(res.siguientePaquete);
      } catch {
        // Silenciar: es solo una sugerencia.
      }
    },
    [],
  );

  // Detección de duplicados al teclear el SGD o la serie a mano (con debounce).
  // La firma en checkDuplicatesFor evita repetir lo ya comprobado por la extracción.
  useEffect(() => {
    if (!canManage || tab !== "subir") return;
    const sgd = debouncedSgd.trim();
    const serie = debouncedSerie.trim();
    if (sgd.length < 3 && serie.length < 3) return;
    // El setState ocurre dentro de checkDuplicatesFor (indicador de carga).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void checkDuplicatesFor({ sgd: sgd || undefined, serie: serie || undefined });
  }, [debouncedSgd, debouncedSerie, canManage, tab, checkDuplicatesFor]);

  // Extrae datos del PDF (OCR + IA). En modo automático aplica los datos al
  // formulario directamente (el usuario solo revisa); en modo manual muestra el
  // preview editable. También dispara la detección de duplicados.
  async function extractFromPdf(opts?: { auto?: boolean; fileArg?: File }) {
    const target = opts?.fileArg ?? file;
    if (!target) {
      showToast("Selecciona un PDF primero", "warning");
      return;
    }
    if (extracting) return;

    setExtracting(true);
    setExtractedData(null);
    try {
      // Cualquier clic MANUAL (auto=false: "Obtener datos"/"Volver a
      // analizar") salta la cache de OCR — es justo el gesto de "esto no
      // salió bien, léelo de nuevo", así que debe poder superar un resultado
      // malo ya cacheado. La carga automática al arrastrar el PDF sí usa cache
      // (rápida y barata para el caso normal, que acierta a la primera).
      const data = await autoFillFromPdfAction(target, form.title, !opts?.auto);
      const notices = data.warnings ?? [];
      const fieldsFound = Object.entries(data).filter(
        ([key, value]) =>
          !["extractionMethod", "warnings", "ocrPartial", "analysisPartial", "nroFolios"].includes(key) && value !== null && value !== "" && value !== undefined,
      ).length;

      if (fieldsFound === 0) {
        const method = data.extractionMethod ?? "none";
        const reason =
          method === "none"
            ? "El PDF no tiene texto legible (posible escaneado sin OCR)."
            : method === "deterministic"
              ? "Solo se detectaron datos básicos. La IA no devolvió campos semánticos."
              : "La IA no devolvió campos. Intenta nuevamente o revisa el documento.";
        showToast([...notices, reason].join(" "), "warning");
        setExtractedData(data);
        return;
      }

      if (opts?.auto) {
        // Auto: aplicar directamente para que el usuario solo confirme.
        const applied = applyInventory(data);
        if (notices.length) setExtractedData(data);
        showToast(
          `${data.extractionMethod === "ai" || data.extractionMethod === "hybrid" ? "Analizado con IA" : "Datos básicos detectados"}: ${applied} campos autocompletados. ${notices.join(" ")} Revisa y ajusta.`,
          notices.length ? "warning" : "success",
        );
        void checkDuplicatesFor({
          title: data.numeroExpediente ?? target.name,
          serie:
            data.serieDocumental?.trim() ||
            buildSerieDocumental(data.tipoDocumento, data.numeroExpediente) ||
            undefined,
        });
        void loadUbicacionSugeridaFor({ anio: data.anio ?? undefined });
      } else {
        // Manual: mostrar preview editable (comportamiento previo).
        setExtractedData(data);
        showToast(`Se detectaron ${fieldsFound} campos. ${notices.join(" ")} Revisa y aplica los datos.`, notices.length ? "warning" : "success");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo extraer datos del PDF";
      // En modo automático no interrumpimos con un error rojo: el usuario puede
      // llenar a mano. En modo manual sí avisamos del fallo.
      showToast(opts?.auto ? `No se pudo autocompletar: ${msg}` : `Error: ${msg}`, opts?.auto ? "info" : "error");
      console.error("[expedientes] extractFromPdf fallo:", err);
    } finally {
      setExtracting(false);
    }
  }

  // Aplica los datos del preview manual al formulario.
  function applyExtractedData() {
    if (!extractedData) return;
    const applied = applyInventory(extractedData);
    if (applied === 0) {
      showToast(
        "No se aplicaron datos (el formulario ya tiene esos campos llenos o los datos estaban vacíos)",
        "info",
      );
    } else {
      showToast(
        `Se aplicaron ${applied} campo${applied === 1 ? "" : "s"} al formulario`,
        "success",
      );
      void checkDuplicatesFor({
        title: extractedData.numeroExpediente ?? file?.name,
        serie:
          extractedData.serieDocumental?.trim() ||
          buildSerieDocumental(extractedData.tipoDocumento, extractedData.numeroExpediente) ||
          undefined,
      });
      void loadUbicacionSugeridaFor({ anio: extractedData.anio ?? undefined });
    }
    setExtractedData(null);
    if (wizardStep === 0) {
      setWizardStep(1);
    }
  }

  function dismissExtractedData() {
    setExtractedData(null);
  }

  async function uploadExpediente(event: React.FormEvent) {
    event.preventDefault();
    if (!file) {
      showToast("Selecciona un archivo PDF antes de subir.", "warning");
      return;
    }
    if (file.size > maxPdfSizeBytes) {
      showToast(`El PDF supera el límite de ${maxPdfSizeLabel}.`, "error");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    if (selectedLegajo) {
      formData.append("expedienteId", selectedLegajo.id);
    }
    for (const [key, value] of Object.entries(form)) {
      if (value !== "" && value !== null && value !== undefined) {
        formData.append(key, String(value));
      }
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      await prepareArchivoUpload(formData);
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          setUploadProgress(Math.round((e.loaded / e.total) * 100));
        }
      });

      const result = await new Promise<{ ok: boolean; status: number; body: unknown }>(
        (resolve) => {
          xhr.addEventListener("load", () => {
            try {
              const body = xhr.responseText ? JSON.parse(xhr.responseText) : null;
              resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, body });
            } catch {
              resolve({ ok: false, status: xhr.status, body: null });
            }
          });
          xhr.addEventListener("error", () => resolve({ ok: false, status: 0, body: null }));
          xhr.open("POST", "/api/expedientes-archivo");
          xhr.send(formData);
        },
      );

      if (!result.ok) {
        const errorMsg =
          (result.body as { error?: string })?.error ?? "No se pudo subir el expediente";
        showToast(errorMsg, "error");
        return;
      }

      const uploadedTitle = file.name;
      // Recordar la ubicación física para precargarla en la siguiente subida del lote.
      prefs.setLastUbicacion({
        tipoAlmacenamiento: form.tipoAlmacenamiento,
        nroArchivador: form.nroArchivador,
        nroPaquete: form.nroPaquete,
        empastado: form.empastado,
        colorArchivador: form.colorArchivador,
        nroEstante: form.nroEstante,
        nroPiso: form.nroPiso,
        nroLocal: form.nroLocal,
      });
      setFile(null);
      setForm(baseForm);
      setAutoFilledFields(new Set());
      setDuplicates([]);
      setDupsDismissed(false);
      setSelectedLegajo(null);
      lastDupSignatureRef.current = "";
      setWizardStep(0);
      setUploadProgress(0);
      // La subida terminó: el borrador ya cumplió su función.
      borradorSubir.limpiar();
      showToast(
        `Expediente "${uploadedTitle}" subido. Se está procesando con OCR e indexando.`,
        "success",
      );
      await Promise.all([loadExpedientes(), refreshRecentUploads()]);
    } catch {
      showToast("No se pudo conectar con el servidor.", "error");
    } finally {
      setUploading(false);
    }
  }

  async function reindexExpediente(id: string) {
    if (reindexBusyRef.current) return false;
    reindexBusyRef.current = true;
    setReindexingId(id);
    try {
      const res = await fetch(`/api/expedientes-archivo/${id}`, { method: "POST" });
      if (!res.ok) {
        if (res.status === 429) {
          reindexNextAttemptRef.current = Date.now() + Math.max(60, Number(res.headers.get("Retry-After")) || 60) * 1000;
          return false;
        }
        const payload = await res.json();
        showToast(payload.error ?? "No se pudo reindexar", "error");
        return false;
      }
      showToast("Reindexado iniciado en segundo plano.", "info");
      await Promise.all([loadExpedientes(), refreshRecentUploads()]);
      return true;
    } catch {
      showToast("No se pudo conectar con el servidor.", "error");
      return false;
    } finally {
      reindexBusyRef.current = false;
      reindexNextAttemptRef.current = Math.max(reindexNextAttemptRef.current, Date.now() + 15_000);
      setReindexingId(null);
    }
  }

  // Una recuperación por versión, sin interferir con trabajos activos.
  const autoReindexedRef = useRef<Set<string>>(new Set());
  const autoErrorRetriedRef = useRef<Set<string>>(new Set());
  const reindexBusyRef = useRef(false);
  const reindexNextAttemptRef = useRef(0);
  useEffect(() => {
    if (!canManage || tab !== "subir") return;
    const timer = setInterval(() => {
      if (reindexBusyRef.current || Date.now() < reindexNextAttemptRef.current) return;
      const exp = recentUploads.find(row => archivoNeedsRecovery(row) &&
        !(row.status === "error" && autoErrorRetriedRef.current.has(row.id)) &&
        !autoReindexedRef.current.has(`${row.id}:${row.updated_at}`));
      if (!exp) return;
      const key = `${exp.id}:${exp.updated_at}`;
      autoReindexedRef.current.add(key);
      if (exp.status === "error") autoErrorRetriedRef.current.add(exp.id);
      void reindexExpediente(exp.id).then(accepted => {
        if (!accepted) {
          autoReindexedRef.current.delete(key);
          autoErrorRetriedRef.current.delete(exp.id);
        }
      });
    }, 4000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage, tab, recentUploads]);

  async function deleteExpediente(exp: ExpedienteItem) {
    showConfirm({
      title: `¿Eliminar "${exp.title}"?`,
      message:
        "Tendrás unos segundos para deshacer. Pasada la ventana, el PDF y sus fragmentos indexados se eliminarán de forma definitiva.",
      variant: "danger",
      onConfirm: () => {
        void performDelete(exp);
      },
    });
  }

  // Reintroduce un expediente en la UI (al deshacer o si el borrado falla).
  function restoreExpedienteInUi(exp: ExpedienteItem) {
    pendingDeleteRef.current.delete(exp.id);
    setExpedientes((prev) => [exp, ...prev.filter((e) => e.id !== exp.id)]);
    setCounts((prev) => (prev ? adjustCounts(prev, exp, +1) : prev));
  }

  // Borrado diferido con "deshacer" real: ocultamos el expediente de inmediato y
  // solo ejecutamos el DELETE en el servidor cuando vence la ventana (o el usuario
  // cierra el aviso). Si pulsa "Deshacer", nada se llegó a borrar.
  function performDelete(exp: ExpedienteItem) {
    pendingDeleteRef.current.set(exp.id, exp);
    setExpedientes((prev) => prev.filter((e) => e.id !== exp.id));
    setRecentUploads((prev) => prev.filter((e) => e.id !== exp.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(exp.id);
      return next;
    });
    if (openExp?.id === exp.id) closeSlideOver();
    setCounts((prev) => (prev ? adjustCounts(prev, exp, -1) : prev));

    pushUndo(
      `Expediente "${exp.title}" eliminado`,
      // Deshacer: restaurar en la UI (no se borró nada en el servidor).
      () => {
        restoreExpedienteInUi(exp);
        showToast(`Se restauró "${exp.title}".`, "success");
      },
      {
        // Confirmar: ejecutar el DELETE real al vencer la ventana o al cerrar el aviso.
        onCommit: async () => {
          try {
            const res = await fetch(`/api/expedientes-archivo/${exp.id}`, { method: "DELETE" });
            if (!res.ok) {
              const payload = await res.json().catch(() => ({}));
              showToast(payload.error ?? `No se pudo eliminar "${exp.title}"`, "error");
              restoreExpedienteInUi(exp);
              return;
            }
            pendingDeleteRef.current.delete(exp.id);
            await Promise.all([loadExpedientes(pagination.page), refreshRecentUploads()]);
          } catch {
            showToast(`No se pudo eliminar "${exp.title}".`, "error");
            restoreExpedienteInUi(exp);
          }
        },
      },
    );
  }

  async function replaceExpedienteFile(file: File) {
    if (!replaceExp) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`/api/expedientes-archivo/${replaceExp.id}`, {
        method: "PUT",
        body: formData,
      });
      if (!res.ok) {
        const payload = await res.json();
        showToast(payload.error ?? "No se pudo reemplazar", "error");
        return;
      }
      showToast("PDF reemplazado. Se está reprocesando.", "success");
      setReplaceExp(null);
      await loadExpedientes();
    } catch {
      showToast("No se pudo conectar con el servidor.", "error");
    }
  }

  async function applyBulkUpdate(updates: Record<string, unknown>) {
    if (selectedIds.size === 0) return;
    try {
      const res = await fetch("/api/expedientes-archivo/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selectedIds], action: "update", updates }),
      });
      if (!res.ok) {
        const payload = await res.json();
        showToast(payload.error ?? "No se pudo aplicar la operación", "error");
        return;
      }
      showToast(
        `Operación aplicada a ${selectedIds.size} expediente${selectedIds.size === 1 ? "" : "s"}.`,
        "success",
      );
      setSelectedIds(new Set());
      setBulkOpen(false);
      await loadExpedientes();
    } catch {
      showToast("No se pudo conectar con el servidor.", "error");
    }
  }

  // ── Edición de metadata del expediente abierto (PATCH) ────────────────────
  function strOrNull(value: unknown): string | null {
    const s = value == null ? "" : String(value).trim();
    return s ? s : null;
  }

  function setEditField(key: string, value: unknown) {
    setEditForm((prev) => ({ ...prev, [key]: value }));
  }

  // Inicializa el formulario con los valores actuales del expediente y entra en
  // modo edición. empastado se mapea a "si"/"no"/"" para el <select>.
  function startEdit() {
    if (!openExp) return;
    setEditForm({
      title: openExp.title ?? "",
      sgd_expediente: openExp.sgd_expediente ?? "",
      serie_documento: openExp.serie_documento ?? "",
      anio: openExp.anio ?? "",
      tipo_documento: openExp.tipo_documento ?? "",
      oficina: openExp.oficina ?? "",
      materia: openExp.materia ?? "",
      asunto: openExp.asunto ?? "",
      resumen: openExp.resumen ?? "",
      observaciones: openExp.observaciones ?? "",
      persona_tipo: openExp.persona_tipo ?? "",
      persona_documento: openExp.persona_documento ?? "",
      persona_nombre: openExp.persona_nombre ?? "",
      tipo_almacenamiento: openExp.tipo_almacenamiento ?? "",
      nro_archivador: openExp.nro_archivador ?? "",
      nro_paquete: openExp.nro_paquete ?? "",
      empastado: openExp.empastado === true ? "si" : openExp.empastado === false ? "no" : "",
      color_archivador: openExp.color_archivador ?? "",
      nro_estante: openExp.nro_estante ?? "",
      nro_piso: openExp.nro_piso ?? "",
      nro_local: openExp.nro_local ?? "",
      folio: openExp.folio ?? "",
    });
    setEditMode(true);
  }

  // Construye el ExpedienteItem actualizado a partir del formulario, para reflejar
  // los cambios al instante en el slide-over y la lista (antes del refetch).
  function mergeEditIntoItem(item: ExpedienteItem, form: Record<string, unknown>): ExpedienteItem {
    const anio =
      form.anio === "" || form.anio == null ? null : Number.parseInt(String(form.anio), 10);
    const empastado = form.empastado === "si" ? true : form.empastado === "no" ? false : null;
    const personaTipo = form.persona_tipo === "natural" || form.persona_tipo === "juridica"
      ? form.persona_tipo
      : null;
    return {
      ...item,
      title: strOrNull(form.title) ?? item.title,
      sgd_expediente: strOrNull(form.sgd_expediente),
      serie_documento: strOrNull(form.serie_documento),
      anio: Number.isFinite(anio as number) ? (anio as number) : null,
      tipo_documento: strOrNull(form.tipo_documento),
      oficina: strOrNull(form.oficina),
      materia: strOrNull(form.materia),
      asunto: strOrNull(form.asunto),
      resumen: strOrNull(form.resumen),
      observaciones: strOrNull(form.observaciones),
      persona_tipo: personaTipo,
      persona_documento: strOrNull(form.persona_documento),
      persona_nombre: strOrNull(form.persona_nombre),
      tipo_almacenamiento: strOrNull(form.tipo_almacenamiento) ?? item.tipo_almacenamiento,
      nro_archivador: strOrNull(form.nro_archivador),
      nro_paquete: strOrNull(form.nro_paquete),
      empastado,
      color_archivador: strOrNull(form.color_archivador),
      nro_estante: strOrNull(form.nro_estante),
      nro_piso: strOrNull(form.nro_piso),
      nro_local: strOrNull(form.nro_local),
      folio: strOrNull(form.folio),
    };
  }

  async function saveExpedienteEdits() {
    if (!openExp) return;
    if (!strOrNull(editForm.title)) {
      showToast("El título no puede quedar vacío.", "warning");
      return;
    }
    setSavingEdit(true);
    try {
      const updates: Record<string, unknown> = { ...editForm };
      updates.anio = editForm.anio === "" || editForm.anio == null ? null : editForm.anio;
      await updateExpedienteAction(openExp.id, updates);
      const merged = mergeEditIntoItem(openExp, editForm);
      setOpenExp(merged);
      setExpedientes((prev) => prev.map((e) => (e.id === merged.id ? merged : e)));
      setEditMode(false);
      showToast("Cambios guardados.", "success");
      // Resincroniza desde el servidor (por si normalizó algún valor).
      void loadExpedientes(pagination.page);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "No se pudo guardar", "error");
    } finally {
      setSavingEdit(false);
    }
  }

  const filteredExps = useMemo(() => {
    let list = [...expedientes];
    if (statusFilter !== "todos") {
      if (statusFilter === "pendientes") {
        list = list.filter((e) => e.status === "uploaded" || e.status === "processing");
      } else if (statusFilter === "indexados") {
        list = list.filter((e) => e.status === "indexed");
      } else if (statusFilter === "error") {
        list = list.filter((e) => e.status === "error");
      }
    }
    if (advancedFilters.oficina) {
      const q = advancedFilters.oficina.toLowerCase();
      list = list.filter((e) => (e.oficina ?? "").toLowerCase().includes(q));
    }
    if (advancedFilters.estante) {
      list = list.filter((e) => e.nro_estante === advancedFilters.estante);
    }
    if (advancedFilters.tipoDocumento) {
      list = list.filter((e) => e.tipo_documento === advancedFilters.tipoDocumento);
    }
    if (debouncedSearchInput.trim()) {
      const q = debouncedSearchInput.toLowerCase();
      list = list.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          (e.materia ?? "").toLowerCase().includes(q) ||
          (e.asunto ?? "").toLowerCase().includes(q) ||
          (e.serie_documento ?? "").toLowerCase().includes(q) ||
          (e.oficina ?? "").toLowerCase().includes(q),
      );
    }
    list.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const av = (a[sortBy] ?? "") as string | number;
      const bv = (b[sortBy] ?? "") as string | number;
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return list;
  }, [expedientes, statusFilter, advancedFilters, debouncedSearchInput, sortBy, sortDir]);

  const statusCounts = useMemo(() => {
    return {
      todos: expedientes.length,
      pendientes: expedientes.filter(
        (e) => e.status === "uploaded" || e.status === "processing",
      ).length,
      indexados: expedientes.filter((e) => e.status === "indexed").length,
      error: expedientes.filter((e) => e.status === "error").length,
    };
  }, [expedientes]);

  const stats = useMemo(() => {
    const total = expedientes.length;
    const indexed = expedientes.filter((e) => e.status === "indexed").length;
    const pending = expedientes.filter(
      (e) => e.status === "uploaded" || e.status === "processing",
    ).length;
    const error = expedientes.filter((e) => e.status === "error").length;
    const totalBytes = expedientes.reduce((s, e) => s + (e.file_size ?? 0), 0);
    return { total, indexed, pending, error, totalBytes };
  }, [expedientes]);

  // Conteos a mostrar: los globales del backend (todo el archivo) si están
  // disponibles; si no, los derivados de la página cargada (fallback).
  const displayStats = counts ?? stats;
  const displayStatusCounts = useMemo(
    () =>
      counts
        ? {
            todos: counts.total,
            pendientes: counts.pending,
            indexados: counts.indexed,
            error: counts.error,
          }
        : statusCounts,
    [counts, statusCounts],
  );

  function handleSort(col: string) {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col as SortBy);
      setSortDir("desc");
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      if (filteredExps.every((e) => prev.has(e.id))) return new Set();
      return new Set(filteredExps.map((e) => e.id));
    });
  }

  function clearFilters() {
    setAdvancedFilters({ oficina: "", estante: "", tipoDocumento: "" });
    setSearchInput("");
    setStatusFilter("todos");
  }

  function hasActiveFilters() {
    return (
      statusFilter !== "todos" ||
      advancedFilters.oficina !== "" ||
      advancedFilters.estante !== "" ||
      advancedFilters.tipoDocumento !== "" ||
      searchInput !== ""
    );
  }

  // Precarga la ubicación física con la última usada (mismo lote) si los campos
  // están vacíos. No pisa lo que el usuario ya escribió.
  function prefillLastUbicacion() {
    const last = prefs.lastUbicacion;
    const hasAny = Object.values(last).some((v) => v && String(v).trim());
    if (!hasAny) return;
    const locKeys: (keyof SubirForm)[] = [
      "tipoAlmacenamiento",
      "nroArchivador",
      "nroPaquete",
      "empastado",
      "colorArchivador",
      "nroEstante",
      "nroPiso",
      "nroLocal",
    ];
    const filled = new Set<keyof SubirForm>();
    setForm((prev) => {
      const next = { ...prev };
      for (const k of locKeys) {
        const v = (last as Record<string, string>)[k] ?? "";
        if (v && !(next[k] && String(next[k]).trim())) {
          next[k] = v as never;
          filled.add(k);
        }
      }
      return next;
    });
    if (filled.size > 0) {
      setAutoFilledFields((prev) => {
        const merged = new Set(prev);
        for (const k of filled) merged.add(k);
        return merged;
      });
    }
  }

  // Punto único de entrada al cargar un PDF (selección o drag&drop): valida,
  // precarga la última ubicación y, si está activo, lo analiza con IA al instante.
  // Aplica el borrador guardado: form (fusionado sobre baseForm para que un
  // campo nuevo de SubirForm quede con su default y no en undefined), paso del
  // wizard y legajo. El PDF hay que recargarlo: un File no es serializable.
  function recuperarBorradorSubir() {
    const b: BorradorSubir | null = borradorSubir.borrador;
    if (!b) return;
    setForm({ ...baseForm, ...b.form });
    setWizardStep(b.wizardStep);
    setSelectedLegajo(b.legajo);
    borradorSubir.recuperar();
    showToast(
      b.fileName
        ? `Borrador recuperado. Vuelve a cargar el PDF (era "${b.fileName}"${b.fileSize ? `, ${formatBytes(b.fileSize)}` : ""}).`
        : "Borrador recuperado.",
      "info",
    );
  }

  function handleNewFile(f: File | null) {
    if (!f) return;
    if (f.type !== "application/pdf") {
      showToast("Solo se permiten archivos PDF", "warning");
      return;
    }
    if (f.size > maxPdfSizeBytes) {
      showToast(`El PDF supera el límite de ${maxPdfSizeLabel}`, "error");
      return;
    }
    setFile(f);
    setExtractedData(null);
    setDuplicates([]);
    setDupsDismissed(false);
    lastDupSignatureRef.current = "";
    prefillLastUbicacion();
    if (prefs.autoExtract) {
      void extractFromPdf({ auto: true, fileArg: f });
    } else {
      showToast("PDF cargado. Pulsa “Obtener datos del PDF” o llena los campos.", "info");
    }
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }
  function onDragLeave() {
    setIsDragging(false);
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    handleNewFile(e.dataTransfer.files?.[0] ?? null);
  }

  function onFileSelect(f: File | null) {
    handleNewFile(f);
  }

  function resetPreferences() {
    showConfirm({
      title: "¿Restablecer preferencias?",
      message:
        "Esto volverá las preferencias a sus valores por defecto: vista de lista, filtro 'Todos', orden por fecha de creación.",
      variant: "warning",
      onConfirm: () => {
        prefs.resetAll();
        showToast("Preferencias restablecidas", "success");
      },
    });
  }

  return (
    <div className="tw expPanel overflow-hidden rounded-exp-lg border border-exp-line bg-exp-panel shadow-exp-sm" id="expedientes-archivo">
      {/* Apunta al panel, no al contenido de una pestaña concreta: así el salto
          funciona en las tres y no solo en Buscar. */}
      <a
        className="absolute left-2 -top-10 z-[999] rounded-md bg-exp-brand px-4 py-2 text-[13px] font-semibold text-white no-underline transition-[top] duration-200 ease-linear focus:top-2 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-white"
        href={`#${idPanel(BASE_PESTANAS)}`}
      >
        Saltar al contenido principal
      </a>

      <div className="flex items-start justify-between gap-4 border-b border-exp-line bg-[linear-gradient(180deg,var(--color-exp-brand-soft)_0%,transparent_100%)] px-[26px] pb-[18px] pt-[22px]">
        <div className="min-w-0 flex-1">
          <p className="m-0 mb-1.5 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.6px] text-exp-brand [&>svg]:size-3">
            <Sparkles size={12} /> Biblioteca de expedientes
          </p>
          <h2 className="m-0 text-[22px] font-bold leading-[1.3] text-exp-ink">
            Busca el contenido y localiza dónde está el expediente físico
          </h2>
          <p className="mt-1 max-w-[78ch] text-sm leading-relaxed text-exp-muted">
            Usa el buscador para encontrar expedientes por contenido, o sube nuevos PDF con OCR automático.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className="relative inline-block size-2 shrink-0 rounded-full bg-exp-success after:absolute after:inset-0 after:animate-exp-pulse after:rounded-full after:bg-inherit after:content-['']"
              title="Conectado"
              aria-hidden="true"
            />
            <span className={cn(EXP_HELP_TEXT, "mt-0")}>
              <Compass size={12} />
              Atajo: Ctrl+K para buscar · Ctrl+I para chat · ? para ayuda
            </span>
            <div className="ml-auto inline-flex items-center gap-1" role="group" aria-label="Preferencias de visualización">
              <button
                type="button"
                className="inline-flex size-8 items-center justify-center rounded-md border border-transparent text-exp-muted transition-colors duration-[120ms] ease-linear hover:bg-exp-line-soft hover:text-exp-ink aria-pressed:border-exp-brand aria-pressed:bg-exp-brand-soft aria-pressed:text-exp-brand"
                onClick={toggleDensity}
                aria-pressed={density === "compact"}
                aria-label={density === "compact" ? "Modo compacto activado" : "Modo cómodo"}
                title={density === "compact" ? "Cambiar a modo cómodo" : "Cambiar a modo compacto"}
              >
                {density === "compact" ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
              </button>
              <button
                type="button"
                className="inline-flex size-8 items-center justify-center rounded-md border border-transparent text-exp-muted transition-colors duration-[120ms] ease-linear hover:bg-exp-line-soft hover:text-exp-ink aria-pressed:border-exp-brand aria-pressed:bg-exp-brand-soft aria-pressed:text-exp-brand"
                onClick={toggleTheme}
                aria-pressed={resolvedTheme === "dark"}
                aria-label={resolvedTheme === "dark" ? "Modo oscuro activado" : "Modo claro"}
                title={resolvedTheme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
              >
                {resolvedTheme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
              </button>
              <TourTrigger onClick={tour.restart} />
            </div>
          </div>
        </div>
        <div
          className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-exp-brand text-white shadow-[0_4px_12px_rgba(15,118,110,0.20)]"
          aria-hidden="true"
        >
          <BookOpen size={20} />
        </div>
      </div>

      <div className="sticky top-0 z-10 flex items-center gap-1 overflow-x-auto bg-exp-panel px-[18px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* La lista solo puede contener pestañas: el botón de atajos vive fuera,
            justo después. Antes estaba dentro y el lector lo contaba como una
            pestaña más ("4 de 4") sin serlo. */}
        <div
          className="flex items-center gap-1"
          role="tablist"
          aria-label="Secciones del archivo"
          onKeyDown={(e) => {
            const destino = siguientePestana(pestanasArchivo, tab, e.key);
            if (!destino) return;
            e.preventDefault();
            setTab(destino as typeof tab);
            // Con índice móvil el foco no viaja solo: hay que llevarlo.
            document.getElementById(idPestana(BASE_PESTANAS, destino))?.focus();
          }}
        >
          <button
            type="button"
            {...propsPestana(BASE_PESTANAS, "buscar", tab)}
            className={cn(EXP_TAB, tab === "buscar" ? EXP_TAB_ACTIVE : EXP_TAB_INACTIVE)}
            onClick={() => setTab("buscar")}
          >
            <Search size={15} /> Buscar
          </button>
          {canManage ? (
            <button
              type="button"
              {...propsPestana(BASE_PESTANAS, "subir", tab)}
              className={cn(EXP_TAB, tab === "subir" ? EXP_TAB_ACTIVE : EXP_TAB_INACTIVE)}
              onClick={() => setTab("subir")}
              onMouseEnter={() => void importarSubir()}
              onFocus={() => void importarSubir()}
            >
              <UploadCloud size={15} /> Subir
              {hasPending ? (
                <span
                  className="ml-0.5 inline-flex items-center justify-center gap-1 rounded-full bg-exp-brand-soft px-[5px] text-[10px] font-bold text-exp-brand [.expTab.active_&]:bg-exp-brand [.expTab.active_&]:text-white"
                  aria-label="Procesando"
                >
                  <span className="relative inline-block size-1.5 rounded-full bg-exp-brand before:absolute before:inset-0 before:animate-[expPing_1.5s_cubic-bezier(0,0,0.2,1)_infinite] before:rounded-full before:bg-inherit before:content-['']" />
                  {displayStatusCounts.pendientes}
                </span>
              ) : null}
            </button>
          ) : null}
          {canManage ? (
            <button
              type="button"
              {...propsPestana(BASE_PESTANAS, "responder", tab)}
              className={cn(EXP_TAB, tab === "responder" ? EXP_TAB_ACTIVE : EXP_TAB_INACTIVE)}
              onClick={() => setTab("responder")}
              onMouseEnter={() => void importarRespuesta()}
              onFocus={() => void importarRespuesta()}
            >
              <FileSignature size={15} /> Responder
            </button>
          ) : null}
          <button type="button" {...propsPestana(BASE_PESTANAS, "buscar-rag", tab)} className={cn(EXP_TAB, tab === "buscar-rag" ? EXP_TAB_ACTIVE : EXP_TAB_INACTIVE)} onClick={() => setTab("buscar-rag")}><Search size={15} /> Buscar RAG</button>
          {canManage && <button type="button" {...propsPestana(BASE_PESTANAS, "subir-rag", tab)} className={cn(EXP_TAB, tab === "subir-rag" ? EXP_TAB_ACTIVE : EXP_TAB_INACTIVE)} onClick={() => setTab("subir-rag")}><UploadCloud size={15} /> Subir RAG</button>}
        </div>
        <button
          type="button"
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border-0 bg-transparent px-3 py-2 text-xs font-semibold text-exp-muted transition-colors duration-[180ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-exp-line-soft hover:text-exp-ink [&>kbd]:rounded [&>kbd]:border [&>kbd]:border-exp-line [&>kbd]:bg-exp-panel [&>kbd]:px-1.5 [&>kbd]:py-0.5 [&>kbd]:font-mono [&>kbd]:text-[11px] [&>kbd]:font-bold [&>kbd]:text-exp-brand"
          onClick={() => setHelpOpen(true)}
          aria-label="Ver atajos de teclado"
        >
          <HelpCircle size={14} /> <kbd>?</kbd> Atajos
        </button>
      </div>

      {/* Un solo panel para las tres pestañas, porque solo se monta la activa.
          Lleva el destino del enlace de salto, que antes vivía dentro de
          BuscarTabContent y por eso solo funcionaba en esa pestaña. */}
      <div {...propsPanel(BASE_PESTANAS, tab)}>
      {tab === "buscar-rag" && <BuscarRagTab canManage={canManage} openDocument={openExpedienteById} />}
      {canManage && <div hidden={tab !== "subir-rag"}><SubirRagTab oficina={userOficina} /></div>}
      {tab === "buscar" ? (
        <BuscarTabContent
          mode={mode}
          query={query}
          setQuery={setQuery}
          changeMode={changeMode}
          runSearch={runSearch}
          searching={searching}
          showFilters={showFilters}
          setShowFilters={setShowFilters}
          filterAnio={filterAnio}
          setFilterAnio={setFilterAnio}
          filterOficina={filterOficina}
          setFilterOficina={setFilterOficina}
          filterMateria={filterMateria}
          setFilterMateria={setFilterMateria}
          activeFilterCount={activeFilterCount}
          isAdmin={isAdmin}
          searchMessage={searchMessage}
          answer={answer}
          results={results}
          openExpedienteById={openExpedienteById}
          displayStats={displayStats}
          displayStatusCounts={displayStatusCounts}
          expedientes={expedientes}
          filteredExps={filteredExps}
          loadingList={loadingList}
          searchInput={searchInput}
          setSearchInput={setSearchInput}
          viewMode={viewMode}
          setViewMode={setViewMode}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          advancedFilters={advancedFilters}
          setAdvancedFilters={setAdvancedFilters}
          sortBy={sortBy}
          sortDir={sortDir}
          handleSort={handleSort}
          selectedIds={selectedIds}
          toggleSelect={toggleSelect}
          toggleSelectAll={toggleSelectAll}
          setSelectedIds={setSelectedIds}
          setBulkOpen={setBulkOpen}
          setOpenExp={setOpenExp}
          setReplaceExp={setReplaceExp}
          canManage={canManage}
          reindexingId={reindexingId}
          deletingId={deletingId}
          reindexExpediente={async id => { await reindexExpediente(id); }}
          deleteExpediente={deleteExpediente}
          loadExpedientes={loadExpedientes}
          pagination={pagination}
          clearFilters={clearFilters}
          hasActiveFilters={hasActiveFilters}
          resetPreferences={resetPreferences}
          formatBytes={formatBytes}
          statusLabel={statusLabel}
          setTab={setTab}
        />
      ) : null}

      {tab === "subir" ? (
        <SubirTabContent
          canManage={canManage}
          isAdmin={isAdmin}
          uploadMode={uploadMode}
          setUploadMode={setUploadMode}
          file={file}
          setFile={setFile}
          isDragging={isDragging}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onFileSelect={onFileSelect}
          setExtractedData={setExtractedData}
          form={form}
          setField={setField}
          autoBadge={autoBadge}
          baseForm={baseForm}
          setForm={setForm}
          setAutoFilledFields={setAutoFilledFields}
          wizardStep={wizardStep}
          setWizardStep={setWizardStep}
          canProceedStep={canProceedStep}
          selectedLegajo={selectedLegajo}
          setSelectedLegajo={setSelectedLegajo}
          uploading={uploading}
          uploadProgress={uploadProgress}
          uploadExpediente={uploadExpediente}
          extracting={extracting}
          extractedData={extractedData}
          extractFromPdf={extractFromPdf}
          applyExtractedData={applyExtractedData}
          dismissExtractedData={dismissExtractedData}
          duplicates={duplicates}
          setDuplicates={setDuplicates}
          dupsDismissed={dupsDismissed}
          setDupsDismissed={setDupsDismissed}
          checkingDuplicates={checkingDuplicates}
          lastDupSignatureRef={lastDupSignatureRef}
          ubicacionSugerida={ubicacionSugerida}
          siguientePaquete={siguientePaquete}
          applyUbicacionSugerida={applyUbicacionSugerida}
          recentUploads={recentUploads}
          loadingRecent={loadingRecent}
          hasRecentPending={hasRecentPending}
          refreshRecentUploads={refreshRecentUploads}
          reindexingId={reindexingId}
          deletingId={deletingId}
          reindexExpediente={async id => { await reindexExpediente(id); }}
          deleteExpediente={deleteExpediente}
          setOpenExp={setOpenExp}
          setTab={setTab}
          showToast={showToast}
          showConfirm={showConfirm}
          formatBytes={formatBytes}
          statusLabel={statusLabel}
          autoExtract={prefs.autoExtract}
          setAutoExtract={prefs.setAutoExtract}
          lastUbicacion={prefs.lastUbicacion}
          setLastUbicacion={prefs.setLastUbicacion}
          borradorPendiente={borradorSubir.borrador}
          onRecuperarBorrador={recuperarBorradorSubir}
          onDescartarBorrador={borradorSubir.descartar}
          onLimpiarBorrador={borradorSubir.limpiar}
          onUploaded={() => { void Promise.all([loadExpedientes(), refreshRecentUploads()]); }}
        />
      ) : null}

      {tab === "responder" && canManage ? (
        <RespuestaPanel showToast={showToast} />
      ) : null}
      </div>

      {openExp ? (
        <ExpedienteSlideOver
          openExp={openExp}
          editMode={editMode}
          editForm={editForm}
          savingEdit={savingEdit}
          isAdmin={isAdmin}
          canManage={canManage}
          formatBytes={formatBytes}
          onClose={closeSlideOver}
          onStartEdit={startEdit}
          onCancelEdit={() => setEditMode(false)}
          onSetEditField={setEditField}
          onSaveEdits={saveExpedienteEdits}
          onReplace={setReplaceExp}
          onOpenDocumentoId={openExpedienteById}
          statusLabel={statusLabel}
        />
      ) : null}

      {replaceExp ? (
        <ReplaceFileModal
          exp={replaceExp}
          onClose={() => setReplaceExp(null)}
          onApply={(f) => void replaceExpedienteFile(f)}
        />
      ) : null}

      {bulkOpen ? (
        <BulkMoveModal
          count={selectedIds.size}
          onClose={() => setBulkOpen(false)}
          onApply={(updates) => void applyBulkUpdate(updates)}
          canChangeOficina={isAdmin}
        />
      ) : null}

      {chatOpen ? (
        <ChatPanel
          query={query}
          onClose={() => setChatOpen(false)}
          onAsk={askInChat}
          searching={searching}
          messages={chatMessages}
          onOpenExpediente={(id) => void openExpedienteById(id)}
        />
      ) : null}

      {cmdOpen ? (
        <CommandPalette
          open={cmdOpen}
          onClose={() => setCmdOpen(false)}
          expedientes={expedientes}
          onOpenExpediente={(exp) => {
            setCmdOpen(false);
            setOpenExp(exp);
          }}
          onGoToSubir={() => canManage && setTab("subir")}
          onShowHelp={() => {
            setCmdOpen(false);
            setHelpOpen(true);
          }}
          onOpenChat={() => {
            setCmdOpen(false);
            setChatOpen(true);
          }}
        />
      ) : null}

      {helpOpen ? (
        <ExpSlideOver
          modificador="expSlideOver-modal"
          onClose={() => setHelpOpen(false)}
          subtitulo="Navega más rápido con el teclado"
          titulo="Atajos de teclado"
        >
            <div className={cn("tw", EXP_SLIDE_OVER_BODY)}>
              <table className="w-full border-collapse text-[13px] [&_td]:px-3 [&_td]:py-2.5 [&_td:first-child]:w-40 [&_td:first-child]:whitespace-nowrap [&_tr]:border-b [&_tr]:border-exp-line-soft [&_tr:last-child]:border-b-0 [&_kbd]:mx-px [&_kbd]:inline-block [&_kbd]:rounded [&_kbd]:border [&_kbd]:border-exp-line [&_kbd]:bg-exp-line-soft [&_kbd]:px-1.5 [&_kbd]:py-0.5 [&_kbd]:font-mono [&_kbd]:text-[11px] [&_kbd]:font-semibold [&_kbd]:text-exp-brand">
                <tbody>
                  <tr>
                    <td>
                      <kbd>⌘</kbd>
                      <kbd>K</kbd>
                    </td>
                    <td>Abrir paleta de comandos</td>
                  </tr>
                  <tr>
                    <td>
                      <kbd>Ctrl</kbd>
                      <kbd>I</kbd>
                    </td>
                    <td>Abrir chat con IA</td>
                  </tr>
                  <tr>
                    <td>
                      <kbd>Ctrl</kbd>
                      <kbd>U</kbd>
                    </td>
                    <td>Ir a pestaña Subir</td>
                  </tr>
                  <tr>
                    <td>
                      <kbd>Ctrl</kbd>
                      <kbd>B</kbd>
                    </td>
                    <td>Ir a pestaña Buscar</td>
                  </tr>
                  <tr>
                    <td>
                      <kbd>Ctrl</kbd>
                      <kbd>→</kbd>
                    </td>
                    <td>Siguiente paso del wizard</td>
                  </tr>
                  <tr>
                    <td>
                      <kbd>Ctrl</kbd>
                      <kbd>←</kbd>
                    </td>
                    <td>Paso anterior del wizard</td>
                  </tr>
                  <tr>
                    <td>
                      <kbd>/</kbd>
                    </td>
                    <td>Enfocar buscador</td>
                  </tr>
                  <tr>
                    <td>
                      <kbd>?</kbd>
                    </td>
                    <td>Mostrar/ocultar esta ayuda</td>
                  </tr>
                  <tr>
                    <td>
                      <kbd>Esc</kbd>
                    </td>
                    <td>Cerrar paneles y modales</td>
                  </tr>
                </tbody>
              </table>
            </div>
        </ExpSlideOver>
      ) : null}

      {/* AlertDialog y no Dialog: esto pide una decisión, así que el foco arranca
          en Cancelar y el clic fuera no lo cierra por accidente. Los ids de
          título y descripción los genera Radix. */}
      {confirm ? (
        <AlertDialog.Root
          open
          onOpenChange={(abierto) => {
            if (!abierto) closeConfirm();
          }}
        >
          <AlertDialog.Portal>
            <AlertDialog.Overlay className="tw fixed inset-0 z-[250] flex animate-exp-fade-in items-center justify-center bg-[rgba(15,23,42,0.5)] p-5 backdrop-blur-[3px]" />
            <AlertDialog.Content className="tw fixed inset-5 z-[251] m-auto h-fit w-full max-w-[420px] animate-exp-pop-in overflow-hidden rounded-exp-lg bg-exp-panel shadow-[0_20px_60px_rgba(15,23,42,0.25)]">
            <div className="flex items-center gap-3 border-b border-exp-line px-5 py-[18px]">
              <div
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-full",
                  confirm.variant === "danger"
                    ? "bg-exp-danger-soft text-exp-danger"
                    : "bg-exp-warning-soft text-exp-warning",
                )}
              >
                {confirm.variant === "danger" ? (
                  <Trash2 size={20} />
                ) : (
                  <AlertCircle size={20} />
                )}
              </div>
              <AlertDialog.Title asChild>
                <h3 className="m-0 text-[15px] font-bold text-exp-ink">{confirm.title}</h3>
              </AlertDialog.Title>
            </div>
            <AlertDialog.Description asChild>
              <p className="px-5 py-[18px] text-sm leading-relaxed text-exp-ink-soft">{confirm.message}</p>
            </AlertDialog.Description>
            <div className="flex justify-end gap-2.5 border-t border-exp-line bg-exp-line-soft px-5 py-3.5">
              <AlertDialog.Cancel asChild>
                <button type="button" className={expBtnClass("ghost")}>
                  Cancelar
                </button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <button
                  type="button"
                  className={expBtnClass(confirm.variant === "danger" ? "danger" : "primary")}
                  onClick={() => {
                    // Cerrar primero para que el aviso de "deshacer" quede visible.
                    const action = confirm.onConfirm;
                    closeConfirm();
                    void action();
                  }}
                >
                  {confirm.variant === "danger" ? "Eliminar" : "Confirmar"}
                </button>
              </AlertDialog.Action>
            </div>
            </AlertDialog.Content>
          </AlertDialog.Portal>
        </AlertDialog.Root>
      ) : null}

      <OnboardingTour
        steps={TOUR_STEPS}
        open={tour.open}
        onClose={tour.close}
        onComplete={tour.complete}
      />

      <UndoToasts stack={undoStack} onExecute={executeUndo} onDismiss={dismissUndo} />

      <button
        type="button"
        className="fixed bottom-5 right-5 z-50 hidden size-14 items-center justify-center rounded-full border-0 bg-exp-brand text-white shadow-[0_6px_20px_rgba(15,118,110,0.4)] transition-all duration-200 ease-linear hover:scale-105 hover:bg-exp-brand-dark hover:shadow-[0_8px_24px_rgba(15,118,110,0.5)] active:scale-95 max-[768px]:inline-flex"
        onClick={() => (canManage ? setTab("subir") : tour.restart())}
        aria-label={canManage ? "Subir nuevo expediente" : "Ver tutorial"}
        title={canManage ? "Subir nuevo expediente" : "Ver tutorial"}
      >
        {canManage ? <PlusCircle size={22} /> : <Compass size={22} />}
      </button>

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {toasts.map((t) => (
          <span key={t.id}>{t.message}</span>
        ))}
      </div>

      <div className="fixed bottom-5 right-5 z-[300] flex flex-col gap-2">
        {toasts.map((toast) => {
          const Icon =
            toast.kind === "success"
              ? CheckCircle2
              : toast.kind === "error"
                ? AlertCircle
                : toast.kind === "warning"
                  ? AlertCircle
                  : Info;
          return (
            <div
              key={toast.id}
              // `!` porque se combina con EXP_TOAST, que ya trae `bg-exp-ink`
              // sin condición (lo usan también los UndoToasts, sin variante de
              // color) — ver el mismo comentario en borrador-editor.tsx.
              className={cn(
                EXP_TOAST,
                "max-w-[400px]",
                toast.kind === "success" && "!bg-exp-success",
                toast.kind === "error" && "!bg-exp-danger",
                toast.kind === "warning" && "!bg-exp-warning",
              )}
              role="status"
            >
              <Icon className={EXP_TOAST_ICON} size={18} />
              <span className={EXP_TOAST_MESSAGE}>{toast.message}</span>
              <button
                type="button"
                className={EXP_TOAST_CLOSE}
                onClick={() => dismissToast(toast.id)}
                aria-label="Cerrar notificación"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
