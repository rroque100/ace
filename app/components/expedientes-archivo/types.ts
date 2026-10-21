// Tipos del módulo /expedientes-archivo
// Mantén este archivo sincronizado con lib/expedientes-archivo.ts

/** Expediente tal como lo devuelve el endpoint GET /api/expedientes-archivo */
export type ExpedienteItem = {
  id: string;
  sgd_expediente: string | null;
  serie_documento: string | null;
  anio: number | null;
  tipo_documento: string | null;
  asunto: string | null;
  materia: string | null;
  resumen: string | null;
  title: string;
  oficina: string | null;
  tipo_almacenamiento: string | null;
  nro_archivador: string | null;
  nro_paquete: string | null;
  empastado: boolean | null;
  color_archivador: string | null;
  nro_estante: string | null;
  nro_piso: string | null;
  nro_local: string | null;
  folio: string | null;
  // Legajo al que pertenece este documento + folio correlativo dentro de él
  // (ver lib/expedientes-archivo.ts -> ExpedienteArchivo para el porqué).
  expediente_id: string | null;
  numero_folio: number | null;
  observaciones: string | null;
  persona_tipo: string | null;
  persona_documento: string | null;
  persona_nombre: string | null;
  file_size: number;
  file_name: string;
  mime_type?: string;
  storage_path?: string;
  status: "uploaded" | "processing" | "indexed" | "error";
  error_message: string | null;
  metadata: {
    chunkCount?: number;
    pageCount?: number;
    tokenUsage?: {
      ocr: { model: string; inputTokens: number; outputTokens: number; fromCache: boolean } | null;
      analysis: { model: string; inputTokens: number; outputTokens: number } | null;
      totalTokens: number;
      estimatedCostUsd: number;
    };
  } | null;
  created_at: string;
  updated_at?: string;
};

/** Resultado de búsqueda por palabra clave (modo "Buscar") */
export type SearchResult = {
  expedienteId: string;
  sgdExpediente: string | null;
  serieDocumento: string | null;
  tipoDocumento: string | null;
  title: string;
  asunto: string | null;
  materia: string | null;
  oficina: string | null;
  anio: number | null;
  pageStart: number | null;
  pageEnd: number | null;
  excerpt: string;
  citation: string;
  ubicacionResumen: string;
  ubicacion: Ubicacion;
};

/** Ubicación física estructurada (debe coincidir con ExpedienteUbicacion del backend) */
export type Ubicacion = {
  tipoAlmacenamiento: string;
  tipoAlmacenamientoLabel: string;
  nroArchivador: string | null;
  nroPaquete: string | null;
  empastado: boolean | null;
  color: string | null;
  nroEstante: string | null;
  nroPiso: string | null;
  nroLocal: string | null;
  folio: string | null;
};

/** Resultado del chat con IA (modo "Chat con IA") */
export type ChatAnswer = {
  answer: string;
  sufficient: boolean;
  sources: SearchResult[];
  /** Avisos de la verificación de fidelidad de citas, si alguna cita [E#] no se sustenta en su fragmento. */
  warnings?: string[];
};

/** Sub-modo de búsqueda en la pestaña "Buscar" */
export type SearchMode = "buscar" | "preguntar";

/** Tab principal del workspace */
export type WorkspaceTab = "buscar" | "subir" | "responder" | "buscar-rag" | "subir-rag";

/** Paso del wizard de subida (0..2) */
export type WizardStep = 0 | 1 | 2;

/** Filtro de status para la lista */
export type StatusFilter = "todos" | "pendientes" | "indexados" | "error";

/** Modo de vista de la lista */
export type ViewMode = "lista" | "tabla" | "tarjetas";

/** Campo por el que se ordena la lista */
export type SortBy = "created_at" | "title" | "anio" | "file_size" | "status";

/** Dirección de ordenamiento */
export type SortDir = "asc" | "desc";

/** Filtros avanzados de la lista */
export type AdvancedFilters = {
  oficina: string;
  estante: string;
  tipoDocumento: string;
};

/** Estado del formulario de subida */
export type SubirForm = {
  title: string;
  sgdExpediente: string;
  serieDocumento: string;
  tipoDocumento: string;
  tipoDocumentoCustom: string;
  anio: string;
  folio: string;
  oficina: string;
  materia: string;
  asunto: string;
  resumen: string;
  observaciones: string;
  personaTipo: "" | "natural" | "juridica";
  personaDocumento: string;
  personaNombre: string;
  tipoAlmacenamiento: string;
  nroArchivador: string;
  nroPaquete: string;
  empastado: string;
  colorArchivador: string;
  nroEstante: string;
  nroPiso: string;
  nroLocal: string;
};

/** Grupo de duplicados por título */
export type DuplicateGroup = {
  title: string;
  items: ExpedienteItem[];
};

/** Duplicado resumido para mostrar en UI */
export type DuplicateMatch = {
  id: string;
  title: string;
  anio: number | null;
  status: string;
};

/** Legajo (expedientes_archivo_legajos): agrupa uno o más documentos. Para el
 *  selector "añadir documento a legajo existente" (fase de UI, fuera de este plan). */
export type ExpedienteLegajoItem = {
  id: string;
  sgd_expediente: string | null;
  serie_documento: string | null;
  anio: number | null;
  asunto: string | null;
  materia: string | null;
  oficina: string | null;
  tipo_almacenamiento: string | null;
  nro_archivador: string | null;
  nro_paquete: string | null;
  nro_estante: string | null;
  nro_piso: string | null;
  nro_local: string | null;
  documentos_count: number;
  documentos_error_count: number;
  documentos_pending_count: number;
  created_at: string;
};

/** Un documento (folio) dentro de un legajo — resumen para el slide-over. */
export type LegajoDocumentoResumen = {
  id: string;
  numero_folio: number | null;
  tipo_documento: string | null;
  title: string;
  anio: number | null;
  status: "uploaded" | "processing" | "indexed" | "error";
  error_message: string | null;
  file_name: string;
  file_size: number;
  created_at: string;
};

/** Detalle de un legajo + sus documentos, tal como lo devuelve
 *  GET /api/expedientes-archivo/legajos/[id]. */
export type LegajoDetalle = {
  legajo: ExpedienteLegajoItem;
  documentos: LegajoDocumentoResumen[];
};

/** Resultado de autocompletar PDF con IA / extractores deterministas */
export type PdfInventory = {
  warnings?: string[];
  ocrPartial?: boolean;
  analysisPartial?: boolean;
  numeroExpediente?: string | null;
  // Denominación oficial literal del documento (ej. "RESOLUCIÓN DE ALCALDÍA N° 004-2024-MDCH-A").
  serieDocumental?: string | null;
  fecha?: string | null;
  anio?: number | null;
  asunto?: string | null;
  materia?: string | null;
  tipoDocumento?: string | null;
  oficina?: string | null;
  personaNombre?: string | null;
  personaTipo?: "natural" | "juridica" | null;
  resumen?: string | null;
  remitente?: string | null;
  destinatario?: string | null;
  nroFolios?: number | null;
  extractionMethod?: "ai" | "deterministic" | "hybrid" | "none";
};

/** Datos detectados por la IA del PDF (preview de chips) */
export type DetectedMetadata = {
  serieDocumento: string | null;
  anio: number | null;
  materia: string | null;
  asunto: string | null;
  resumen: string | null;
  tipoDocumento: string | null;
};


/** Estadísticas del dashboard */
export type Stats = {
  total: number;
  indexed: number;
  pending: number;
  error: number;
  totalBytes: number;
  topYears: { year: number; count: number }[];
  topTipos: { tipo: string; count: number }[];
};

/** Props de los sub-componentes extraídos */
export type TablaExpedientesProps = {
  exps: ExpedienteItem[];
  canManage: boolean;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onOpen: (exp: ExpedienteItem) => void;
  onDelete: (exp: ExpedienteItem) => void;
  onDownload: (exp: ExpedienteItem) => void;
  onReplace: (exp: ExpedienteItem) => void;
  sortBy: SortBy;
  sortDir: SortDir;
  onSort: (col: string) => void;
  reindexingId: string | null;
  deletingId: string | null;
  reindex: (id: string) => Promise<void>;
  formatBytes: (n: number) => string;
  statusLabel: (s: ExpedienteItem["status"]) => string;
};

export type TarjetasExpedientesProps = {
  exps: ExpedienteItem[];
  onOpen: (exp: ExpedienteItem) => void;
  formatBytes: (n: number) => string;
  statusLabel: (s: ExpedienteItem["status"]) => string;
};

export type BulkMoveModalProps = {
  count: number;
  onClose: () => void;
  onApply: (updates: Record<string, unknown>) => void;
  // Solo admin puede reasignar expedientes a otra oficina.
  canChangeOficina?: boolean;
};

export type ReplaceFileModalProps = {
  exp: ExpedienteItem;
  onClose: () => void;
  onApply: (file: File) => void;
};

export type ChatPanelProps = {
  query: string;
  setQuery?: (q: string) => void;
  onClose: () => void;
  onAsk: (text: string) => void | Promise<void>;
  searching: boolean;
  messages: { role: "user" | "ai"; text: string; sources?: SearchResult[]; warnings?: string[] }[];
  onOpenExpediente: (id: string) => void;
};
