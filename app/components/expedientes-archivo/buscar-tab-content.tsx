import React from "react";
import {
  Search,
  Bot,
  Filter,
  X,
  Loader2,
  Info,
  Lightbulb,
  ArrowRight,
  FileText,
  MapPin,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  FileUp,
  List as ListIcon,
  Table2,
  Grid3x3,
  Eye,
  Download,
  RefreshCw,
  Trash2,
  Plus,
  History,
} from "lucide-react";
import {
  SearchMode,
  SearchResult,
  ChatAnswer,
  ExpedienteItem,
  ViewMode,
  StatusFilter,
  AdvancedFilters,
  SortBy,
  SortDir,
  WorkspaceTab,
} from "./types";
import { TablaExpedientes } from "./tabla-expedientes";
import { TarjetasExpedientes } from "./tarjetas-expedientes";
import { Pagination } from "./pagination";
import { SkeletonList, SkeletonStats } from "./skeleton";
import {
  EXP_EMPTY,
  EXP_EMPTY_DESC,
  EXP_EMPTY_ILLUSTRATION,
  EXP_EMPTY_TITLE,
  EXP_FIELD,
  EXP_FIELD_CONTROL,
  EXP_FIELD_LABEL,
  EXP_FORM_SECTION_HEADER,
  EXP_FORM_SECTION_HINT,
  EXP_FORM_SECTION_TITLE,
  EXP_HELP_TEXT,
  EXP_ICON_BUTTON,
  EXP_ICON_BUTTON_DANGER,
  EXP_LIST,
  EXP_LIST_ITEM,
  EXP_LIST_ITEM_ACTIONS,
  EXP_LIST_ITEM_BODY,
  EXP_LIST_ITEM_ICON,
  EXP_LIST_ITEM_META,
  EXP_LIST_ITEM_TITLE,
  EXP_SPIN,
  EXP_STATS,
  EXP_STAT_HEADER,
  EXP_TAB_CONTENT,
  expBtnClass,
  expMessageClass,
  expStatCardClass,
  expStatusClass,
} from "./estilos";
import { cn } from "@/lib/utils";

const STATUS_PILLS: { id: StatusFilter; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "pendientes", label: "Pendientes" },
  { id: "indexados", label: "Indexados" },
  { id: "error", label: "Con error" },
];

export type BuscarTabContentProps = {
  // Search
  mode: SearchMode;
  query: string;
  setQuery: (q: string) => void;
  changeMode: (m: SearchMode) => void;
  runSearch: (e?: React.FormEvent) => void;
  searching: boolean;
  showFilters: boolean;
  setShowFilters: React.Dispatch<React.SetStateAction<boolean>>;
  filterAnio: string;
  setFilterAnio: (v: string) => void;
  filterOficina: string;
  setFilterOficina: (v: string) => void;
  filterMateria: string;
  setFilterMateria: (v: string) => void;
  activeFilterCount: number;
  isAdmin: boolean;

  // Results
  searchMessage: string | null;
  answer: ChatAnswer | null;
  results: SearchResult[] | null;
  openExpedienteById: (id: string) => Promise<void>;

  // Stats
  displayStats: { total: number; indexed: number; pending: number; error: number; totalBytes: number };
  displayStatusCounts: { todos: number; pendientes: number; indexados: number; error: number };

  // List
  expedientes: ExpedienteItem[];
  filteredExps: ExpedienteItem[];
  loadingList: boolean;
  searchInput: string;
  setSearchInput: (v: string) => void;
  viewMode: ViewMode;
  setViewMode: (m: ViewMode) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (s: StatusFilter) => void;
  advancedFilters: AdvancedFilters;
  setAdvancedFilters: React.Dispatch<React.SetStateAction<AdvancedFilters>>;
  sortBy: SortBy;
  sortDir: SortDir;
  handleSort: (col: string) => void;
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  toggleSelectAll: () => void;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setBulkOpen: (v: boolean) => void;
  setOpenExp: (exp: ExpedienteItem) => void;
  setReplaceExp: React.Dispatch<React.SetStateAction<ExpedienteItem | null>>;

  // Actions
  canManage: boolean;
  reindexingId: string | null;
  deletingId: string | null;
  reindexExpediente: (id: string) => Promise<void>;
  deleteExpediente: (exp: ExpedienteItem) => void;
  loadExpedientes: (page?: number) => Promise<void>;
  pagination: { page: number; limit: number; total: number; totalPages: number };
  clearFilters: () => void;
  hasActiveFilters: () => boolean;
  resetPreferences: () => void;

  // Helpers
  formatBytes: (n: number) => string;
  statusLabel: (s: ExpedienteItem["status"]) => string;
  setTab: (t: WorkspaceTab) => void;
};

export function BuscarTabContent({
  mode,
  query,
  setQuery,
  changeMode,
  runSearch,
  searching,
  showFilters,
  setShowFilters,
  filterAnio,
  setFilterAnio,
  filterOficina,
  setFilterOficina,
  filterMateria,
  setFilterMateria,
  activeFilterCount,
  isAdmin,
  searchMessage,
  answer,
  results,
  openExpedienteById,
  displayStats,
  displayStatusCounts,
  expedientes,
  filteredExps,
  loadingList,
  searchInput,
  setSearchInput,
  viewMode,
  setViewMode,
  statusFilter,
  setStatusFilter,
  advancedFilters,
  setAdvancedFilters,
  sortBy,
  sortDir,
  handleSort,
  selectedIds,
  toggleSelect,
  toggleSelectAll,
  setSelectedIds,
  setBulkOpen,
  setOpenExp,
  setReplaceExp,
  canManage,
  reindexingId,
  deletingId,
  reindexExpediente,
  deleteExpediente,
  loadExpedientes,
  pagination,
  clearFilters,
  hasActiveFilters,
  resetPreferences,
  formatBytes,
  statusLabel,
  setTab,
}: BuscarTabContentProps) {
  return (
    <div className={cn("tw", EXP_TAB_CONTENT)}>
      {/* Elige cómo se interpreta lo que escribes en el MISMO buscador —cambia
          el marcador de posición, el rótulo y el botón de envío—, no a qué
          panel se va. */}
      <div className="mb-3.5 grid grid-cols-2 gap-2.5 max-[640px]:grid-cols-1" role="group" aria-label="Modo de búsqueda">
        <button
          type="button"
          aria-pressed={mode === "buscar"}
          className={cn(
            "flex items-center gap-3 rounded-exp border p-3.5 text-left transition-all duration-[180ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:border-exp-brand hover:shadow-exp-sm",
            mode === "buscar"
              ? "border-exp-brand bg-exp-brand/[0.06] shadow-[inset_0_0_0_1.5px_var(--color-exp-brand)]"
              : "border-exp-line bg-exp-panel",
          )}
          onClick={() => changeMode("buscar")}
        >
          <span
            className={cn(
              "grid size-11 shrink-0 place-items-center rounded-xl transition-all duration-[180ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
              mode === "buscar"
                ? "bg-exp-brand text-white shadow-[0_4px_10px_-2px_rgba(15,118,110,0.4)]"
                : "bg-exp-line-soft text-exp-muted",
            )}
          >
            <Search size={19} />
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm font-bold text-exp-ink">Buscar</span>
            <span className="text-xs leading-tight text-exp-muted">Por el contenido del documento</span>
          </span>
        </button>
        <button
          type="button"
          aria-pressed={mode === "preguntar"}
          className={cn(
            "flex items-center gap-3 rounded-exp border p-3.5 text-left transition-all duration-[180ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:border-exp-brand hover:shadow-exp-sm",
            mode === "preguntar"
              ? "border-exp-brand bg-exp-brand/[0.06] shadow-[inset_0_0_0_1.5px_var(--color-exp-brand)]"
              : "border-exp-line bg-exp-panel",
          )}
          onClick={() => changeMode("preguntar")}
        >
          <span
            className={cn(
              "grid size-11 shrink-0 place-items-center rounded-xl transition-all duration-[180ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
              mode === "preguntar"
                ? "bg-exp-brand text-white shadow-[0_4px_10px_-2px_rgba(15,118,110,0.4)]"
                : "bg-exp-line-soft text-exp-muted",
            )}
          >
            <Bot size={19} />
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm font-bold text-exp-ink">Preguntar a la IA</span>
            <span className="text-xs leading-tight text-exp-muted">Respuesta y ubicación, en lenguaje natural</span>
          </span>
        </button>
      </div>

      <form
        onSubmit={runSearch}
        className="expSearchBar mb-4 flex items-center gap-3 rounded-exp border border-exp-line bg-exp-line-soft p-3.5 transition-all duration-[180ms] ease-[cubic-bezier(0.4,0,0.2,1)] focus-within:border-exp-brand focus-within:bg-exp-panel focus-within:shadow-[0_0_0_3px_rgba(15,118,110,0.10)]"
      >
        <Search size={18} className="inline-flex shrink-0 items-center gap-1 text-exp-muted" />
        <input
          id="exp-search-input"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            mode === "buscar"
              ? "Ej. licencia de funcionamiento, predio 2024, oficio 0345…"
              : "Ej. ¿Dónde está el expediente de la licencia 2024-0345?"
          }
          className="min-w-0 flex-1 border-0 bg-transparent py-1 text-[15px] text-exp-ink outline-none placeholder:text-exp-muted"
          aria-label={mode === "buscar" ? "Buscar en el contenido" : "Preguntar a la IA"}
        />
        {mode === "buscar" ? (
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-2 text-[13px] font-semibold transition-all duration-[180ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:border-exp-brand hover:text-exp-ink",
              showFilters
                ? "border-exp-brand bg-exp-brand/[0.06] text-exp-brand"
                : "border-exp-line bg-exp-panel text-exp-muted",
            )}
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            title="Filtros"
          >
            <Filter size={15} /> Filtros
            {activeFilterCount > 0 ? (
              <span className="inline-grid h-[18px] min-w-[18px] place-items-center rounded-full bg-exp-brand px-[5px] text-[11px] font-bold text-white">
                {activeFilterCount}
              </span>
            ) : null}
          </button>
        ) : null}
        <button type="submit" disabled={searching} className={expBtnClass("primary")}>
          {searching ? (
            <Loader2 size={16} className={EXP_SPIN} />
          ) : mode === "buscar" ? (
            <Search size={16} />
          ) : (
            <Bot size={16} />
          )}
          {searching
            ? mode === "buscar"
              ? "Buscando..."
              : "Consultando..."
            : mode === "buscar"
              ? "Buscar"
              : "Preguntar"}
        </button>
      </form>

      {mode === "buscar" && showFilters ? (
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-exp border border-exp-line bg-exp-line-soft p-3.5" aria-label="Filtros de búsqueda">
          <div className="flex min-w-[140px] flex-1 basis-[180px] flex-col gap-1">
            <label className="text-xs font-semibold text-exp-muted" htmlFor="filter-anio">Año</label>
            <input
              id="filter-anio"
              type="number"
              value={filterAnio}
              onChange={(e) => setFilterAnio(e.target.value)}
              placeholder="Ej. 2024"
              className={EXP_FIELD_CONTROL}
            />
          </div>
          {isAdmin ? (
            <div className="flex min-w-[140px] flex-1 basis-[180px] flex-col gap-1">
              <label className="text-xs font-semibold text-exp-muted" htmlFor="filter-oficina">Oficina</label>
              <input
                id="filter-oficina"
                value={filterOficina}
                onChange={(e) => setFilterOficina(e.target.value)}
                placeholder="Ej. Subgerencia de Tránsito"
                className={EXP_FIELD_CONTROL}
              />
            </div>
          ) : null}
          <div className="flex min-w-[140px] flex-1 basis-[180px] flex-col gap-1">
            <label className="text-xs font-semibold text-exp-muted" htmlFor="filter-materia">Materia</label>
            <input
              id="filter-materia"
              value={filterMateria}
              onChange={(e) => setFilterMateria(e.target.value)}
              placeholder="Ej. contratación"
              className={EXP_FIELD_CONTROL}
            />
          </div>
          {activeFilterCount > 0 ? (
            <button
              type="button"
              className={cn(expBtnClass("ghost"), "shrink-0 grow-0")}
              onClick={() => {
                setFilterAnio("");
                setFilterOficina("");
                setFilterMateria("");
              }}
            >
              <X size={14} /> Limpiar
            </button>
          ) : null}
        </div>
      ) : null}

      {displayStats.pending > 0 ? (
        <span className={cn(EXP_HELP_TEXT, "mt-2")}>
          <Loader2 size={12} className={EXP_SPIN} /> {displayStats.pending} expediente
          {displayStats.pending === 1 ? "" : "s"} en proceso aún no aparece
          {displayStats.pending === 1 ? "" : "n"} en la búsqueda (se indexa
          {displayStats.pending === 1 ? "" : "n"} en segundo plano).
        </span>
      ) : null}

      {/* Ejemplos: antes solo existían para "Preguntar a la IA" — "Buscar" se
          quedaba con un cuadro vacío sin ninguna guía de qué escribir para
          alguien que entra por primera vez. Mismo componente, contenido
          distinto por modo (términos de búsqueda vs. preguntas). */}
      {(mode === "buscar" && !query && !results) || (mode === "preguntar" && !query && !answer) ? (
        <div
          className="mt-2 flex flex-col gap-1.5"
          aria-label={mode === "buscar" ? "Ejemplos de búsqueda" : "Ejemplos de preguntas"}
        >
          <span className={cn(EXP_HELP_TEXT, "mb-1 mt-0")}>
            <Lightbulb size={12} />
            {mode === "buscar" ? "Prueba buscando por:" : "Prueba con una de estas preguntas:"}
          </span>
          {(mode === "buscar"
            ? [
                "licencia de funcionamiento",
                "resolución de alcaldía 2024",
                "contrato de obra por administración directa",
              ]
            : [
                "¿Cuántos expedientes de contratación hay en 2024?",
                "¿Dónde está el expediente de la licencia 2024-0345?",
                "Resúmeme los expedientes de la subgerencia de tránsito",
              ]
          ).map((q) => (
            <button
              key={q}
              type="button"
              className="flex w-full items-center gap-2 rounded-exp border border-exp-line bg-exp-line-soft px-3 py-2 text-left text-[13px] text-exp-ink-soft transition-colors duration-[120ms] ease-linear hover:border-exp-brand hover:bg-exp-brand-soft hover:text-exp-brand [&>svg]:shrink-0 [&>svg]:text-exp-brand"
              onClick={() => {
                setQuery(q);
                setTimeout(() => {
                  const form = document.querySelector(
                    "form.expSearchBar",
                  ) as HTMLFormElement | null;
                  form?.requestSubmit();
                }, 50);
              }}
            >
              <ArrowRight size={12} />
              <span>{q}</span>
            </button>
          ))}
        </div>
      ) : null}

      {searchMessage ? (
        <div className={expMessageClass("info")} role="status">
          <Info size={16} />
          <span>{searchMessage}</span>
        </div>
      ) : null}

      {/* Mientras busca/consulta lo único que se movía era el ícono del
          botón — el área de resultados se quedaba vacía y quieta varios
          segundos (sobre todo el modo IA), dando la sensación de que no
          pasaba nada. Reusa el mismo esqueleto de la lista principal. */}
      {searching ? (
        <div className="my-4">
          <SkeletonList count={3} />
        </div>
      ) : null}

      {/* Respuesta de la IA — el momento protagonista de esta pestaña: es la
          única vez que el sistema le da al usuario una respuesta lista en vez
          de una lista de coincidencias para revisar. Mismo lenguaje visual
          que el preview de extracción de la pestaña Subir (barra superior en
          degradado, insignia con pulso), a propósito, para que "esto es la
          IA trabajando por ti" se lea igual en todo el módulo. */}
      {answer ? (
        <div className="relative my-4 animate-exp-fade-in overflow-hidden rounded-exp border border-exp-brand/40 bg-[linear-gradient(135deg,var(--color-exp-brand-soft)_0%,var(--color-exp-panel)_60%)] p-5 shadow-[0_1px_2px_rgba(15,118,110,0.06),0_16px_36px_-14px_rgba(15,118,110,0.35)] before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-[linear-gradient(90deg,var(--color-exp-brand)_0%,#5eead4_50%,var(--color-exp-brand)_100%)] before:content-['']">
          <div className="mb-3 flex items-center gap-2.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-exp-brand text-white shadow-[0_0_0_4px_rgba(15,118,110,0.12)]">
              <Sparkles size={16} className="animate-exp-pulse" />
            </div>
            <div>
              <h3 className="m-0 text-sm font-bold text-exp-ink">Respuesta de la IA</h3>
              <p className="m-0 text-xs text-exp-muted">
                Basada en los expedientes del archivo. Las citas [E#] enlazan a las fuentes.
              </p>
            </div>
          </div>
          <p className="m-0 mb-3 whitespace-pre-wrap text-sm leading-relaxed text-exp-ink">{answer.answer}</p>
          {answer.warnings && answer.warnings.length > 0 ? (
            <div className={cn(expMessageClass("warning"), "mb-3")} role="alert">
              <AlertCircle size={14} />
              <span>{answer.warnings.join(" ")}</span>
            </div>
          ) : null}
          {answer.sources.length > 0 ? (
            <div className="flex flex-col gap-1.5 border-t border-exp-brand/15 pt-3">
              <p className="m-0 mb-1 text-[11px] font-bold uppercase tracking-[0.5px] text-exp-muted">
                Fuentes ({answer.sources.length})
              </p>
              {answer.sources.map((source, index) => (
                <button
                  key={`${source.expedienteId}-${index}`}
                  type="button"
                  className="flex w-full flex-col gap-1 rounded-lg border border-exp-line bg-exp-panel px-2.5 py-1.5 text-left text-xs transition-all duration-[120ms] ease-linear hover:-translate-y-px hover:border-exp-brand hover:bg-exp-brand-soft hover:shadow-exp-sm"
                  onClick={() => void openExpedienteById(source.expedienteId)}
                >
                  <span className="flex w-full items-center gap-1.5">
                    <span className="shrink-0 rounded bg-exp-brand px-1.5 py-0.5 text-[10px] font-bold text-white">
                      E{index + 1}
                    </span>
                    <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-exp-ink">
                      {source.title}
                    </span>
                    <span className="whitespace-nowrap text-[11px] text-exp-muted">{source.citation}</span>
                  </span>
                  {/* El modo se anuncia como "Respuesta y ubicación" pero las
                      fuentes no mostraban dónde está el expediente físicamente
                      — el dato ya viaja en cada SearchResult, solo faltaba
                      pintarlo (igual que ya hace cada tarjeta del modo Buscar). */}
                  {source.ubicacionResumen ? (
                    <span className="inline-flex items-center gap-1 pl-[26px] text-[11px] text-exp-muted [&>svg]:size-3 [&>svg]:shrink-0">
                      <MapPin size={12} /> {source.ubicacionResumen}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {results ? (
        <div className="my-4 flex flex-col gap-2.5">
          <div className={EXP_FORM_SECTION_HEADER}>
            <h3 className={EXP_FORM_SECTION_TITLE}>
              <FileText size={16} /> Resultados
              <span className={EXP_FORM_SECTION_HINT}>
                {(() => {
                  // Al usuario le importa cuántos EXPEDIENTES encontró, no
                  // cuántos fragmentos de texto generó el indexado (detalle
                  // interno sin significado fuera de este módulo) — un mismo
                  // expediente puede aportar varios resultados a la lista, y
                  // eso ya se ve ahí abajo (misma tarjeta, distinta página).
                  const expedientesUnicos = new Set(results.map((r) => r.expedienteId)).size;
                  return `${expedientesUnicos} expediente${expedientesUnicos === 1 ? "" : "s"} encontrado${expedientesUnicos === 1 ? "" : "s"}`;
                })()}
              </span>
            </h3>
          </div>
          {(() => {
            // Una tarjeta por EXPEDIENTE, no una por fragmento de página que
            // coincidió — antes un solo documento largo (varios fragmentos)
            // se veía como N tarjetas idénticas con el mismo título repetido.
            // Se agrupa preservando el orden de relevancia que ya trae la API
            // (el primer fragmento de cada grupo es el de mejor puntaje); las
            // demás páginas que también coincidieron se listan compactas
            // abajo en vez de repetir la tarjeta entera.
            const grupos = new Map<string, SearchResult[]>();
            for (const r of results) {
              const grupo = grupos.get(r.expedienteId);
              if (grupo) grupo.push(r);
              else grupos.set(r.expedienteId, [r]);
            }
            return Array.from(grupos.values()).map((coincidencias) => {
              const principal = coincidencias[0];
              const otrasPaginas = coincidencias
                .slice(1)
                .map((m) => m.pageStart)
                .filter((p): p is number => p !== null);
              return (
                <article
                  key={principal.expedienteId}
                  className="grid cursor-pointer grid-cols-[40px_1fr_auto] items-start gap-3 rounded-exp border border-exp-line bg-exp-panel p-3.5 transition-all duration-[180ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:-translate-y-px hover:border-exp-brand hover:shadow-exp"
                  onClick={() => void openExpedienteById(principal.expedienteId)}
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-exp bg-exp-brand-soft text-exp-brand">
                    <FileText size={18} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="m-0 mb-1 text-sm font-bold leading-snug text-exp-ink">{principal.title}</h4>
                    <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs text-exp-muted">
                      {principal.serieDocumento ? (
                        <span className="inline-flex items-center gap-1">{principal.serieDocumento}</span>
                      ) : null}
                      {principal.anio ? <span className="inline-flex items-center gap-1">{principal.anio}</span> : null}
                      {principal.materia ? <span className="inline-flex items-center gap-1">{principal.materia}</span> : null}
                      {principal.pageStart ? (
                        <span className="inline-flex items-center gap-1">pág. {principal.pageStart}</span>
                      ) : null}
                    </div>
                    {principal.ubicacionResumen ? (
                      <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs text-exp-muted">
                        <span className="inline-flex items-center gap-1 [&>svg]:size-3">
                          <MapPin size={12} /> {principal.ubicacionResumen}
                        </span>
                      </div>
                    ) : null}
                    {principal.excerpt ? (
                      <p className="m-0 mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-exp-ink-soft">
                        {principal.excerpt}
                      </p>
                    ) : null}
                    {otrasPaginas.length > 0 ? (
                      <p className="m-0 mt-1.5 text-[11px] text-exp-muted">
                        También coincide en pág. {otrasPaginas.join(", ")}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1">
                    <a
                      href={`/api/expedientes-archivo/${principal.expedienteId}`}
                      target="_blank"
                      rel="noreferrer"
                      className={EXP_ICON_BUTTON}
                      title="Abrir PDF"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <FileText size={14} />
                    </a>
                  </div>
                </article>
              );
            });
          })()}
        </div>
      ) : null}

      {displayStats.total > 0 ? (
        <div className={cn("expStats", EXP_STATS)} aria-label="Resumen del archivo">
          <div className={expStatCardClass("statBrand")}>
            <div className={EXP_STAT_HEADER}>
              <span className="text-[11px] font-bold uppercase tracking-[0.5px] text-exp-muted">Total</span>
              <span className="flex size-7 items-center justify-center rounded-lg bg-exp-brand-soft text-exp-brand">
                <FileText size={14} />
              </span>
            </div>
            <span className="font-mono text-[28px] font-extrabold leading-[1.1] text-exp-ink">{displayStats.total}</span>
            <span className="mt-0.5 text-[11px] text-exp-muted">expedientes en el archivo</span>
          </div>
          <div className={expStatCardClass("statSuccess")}>
            <div className={EXP_STAT_HEADER}>
              <span className="text-[11px] font-bold uppercase tracking-[0.5px] text-exp-muted">Indexados</span>
              <span className="flex size-7 items-center justify-center rounded-lg bg-exp-success-soft text-exp-success">
                <CheckCircle2 size={14} />
              </span>
            </div>
            <span className="font-mono text-[28px] font-extrabold leading-[1.1] text-exp-ink">{displayStats.indexed}</span>
            <span className="mt-0.5 text-[11px] text-exp-muted">listos para buscar</span>
          </div>
          <div className={expStatCardClass("statWarning")}>
            <div className={EXP_STAT_HEADER}>
              <span className="text-[11px] font-bold uppercase tracking-[0.5px] text-exp-muted">Pendientes</span>
              <span className="flex size-7 items-center justify-center rounded-lg bg-exp-warning-soft text-exp-warning">
                <Loader2 size={14} className={displayStats.pending > 0 ? EXP_SPIN : ""} />
              </span>
            </div>
            <span className="font-mono text-[28px] font-extrabold leading-[1.1] text-exp-ink">{displayStats.pending}</span>
            <span className="mt-0.5 text-[11px] text-exp-muted">procesándose ahora</span>
          </div>
          <div className={expStatCardClass("statDanger")}>
            <div className={EXP_STAT_HEADER}>
              <span className="text-[11px] font-bold uppercase tracking-[0.5px] text-exp-muted">Con error</span>
              <span className="flex size-7 items-center justify-center rounded-lg bg-exp-danger-soft text-exp-danger">
                <AlertCircle size={14} />
              </span>
            </div>
            <span className="font-mono text-[28px] font-extrabold leading-[1.1] text-exp-ink">{displayStats.error}</span>
            <span className="mt-0.5 text-[11px] text-exp-muted">requieren atención</span>
          </div>
          <div className={expStatCardClass("statInfo")}>
            <div className={EXP_STAT_HEADER}>
              <span className="text-[11px] font-bold uppercase tracking-[0.5px] text-exp-muted">Tamaño</span>
              <span className="flex size-7 items-center justify-center rounded-lg bg-exp-info-soft text-exp-info">
                <FileUp size={14} />
              </span>
            </div>
            <span className="font-mono text-[28px] font-extrabold leading-[1.1] text-exp-ink">
              {formatBytes(displayStats.totalBytes)}
            </span>
            <span className="mt-0.5 text-[11px] text-exp-muted">en Supabase Storage</span>
          </div>
        </div>
      ) : null}

      {expedientes.length > 0 ? (
        <>
          <div className="expListHeader mb-3.5 flex flex-wrap items-center gap-2.5 rounded-exp border border-exp-line bg-exp-panel p-2.5">
            <input
              type="search"
              placeholder="Filtra la lista por título, materia u oficina…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="min-w-[180px] flex-1 rounded-lg border border-exp-line bg-exp-line-soft px-3 py-2 text-[13px] transition-all duration-[120ms] ease-linear focus:border-exp-brand focus:bg-exp-panel focus:shadow-[0_0_0_3px_rgba(15,118,110,0.10)] focus:outline-none"
              aria-label="Filtro rápido de la lista"
            />
            {/* Cómo se dibuja la MISMA lista: un control segmentado, no pestañas. */}
            <div
              className="relative inline-flex rounded-lg border border-exp-line bg-exp-line-soft p-0.5"
              role="group"
              aria-label="Modo de vista"
            >
              <button
                type="button"
                aria-pressed={viewMode === "lista"}
                className={cn(
                  "relative z-[1] inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[13px] font-semibold transition-colors duration-[120ms] ease-linear hover:text-exp-ink",
                  viewMode === "lista"
                    ? "bg-exp-panel text-exp-brand shadow-exp-sm hover:text-exp-brand"
                    : "text-exp-muted",
                )}
                onClick={() => setViewMode("lista")}
                title="Vista lista"
                aria-label="Vista lista"
              >
                <ListIcon size={14} />
              </button>
              <button
                type="button"
                aria-pressed={viewMode === "tabla"}
                className={cn(
                  "relative z-[1] inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[13px] font-semibold transition-colors duration-[120ms] ease-linear hover:text-exp-ink",
                  viewMode === "tabla"
                    ? "bg-exp-panel text-exp-brand shadow-exp-sm hover:text-exp-brand"
                    : "text-exp-muted",
                )}
                onClick={() => setViewMode("tabla")}
                title="Vista tabla"
                aria-label="Vista tabla"
              >
                <Table2 size={14} />
              </button>
              <button
                type="button"
                aria-pressed={viewMode === "tarjetas"}
                className={cn(
                  "relative z-[1] inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[13px] font-semibold transition-colors duration-[120ms] ease-linear hover:text-exp-ink",
                  viewMode === "tarjetas"
                    ? "bg-exp-panel text-exp-brand shadow-exp-sm hover:text-exp-brand"
                    : "text-exp-muted",
                )}
                onClick={() => setViewMode("tarjetas")}
                title="Vista tarjetas"
                aria-label="Vista tarjetas"
              >
                <Grid3x3 size={14} />
              </button>
            </div>
            <div className="inline-flex flex-wrap gap-1" role="group" aria-label="Filtrar por estado">
              {STATUS_PILLS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={statusFilter === s.id}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition-colors duration-[120ms] ease-linear hover:border-exp-line hover:text-exp-ink",
                    statusFilter === s.id
                      ? "border-exp-brand bg-exp-brand text-white hover:text-white"
                      : "border-exp-line bg-exp-panel text-exp-muted",
                  )}
                  onClick={() => setStatusFilter(s.id)}
                >
                  {s.label}
                  <span
                    className={cn(
                      "min-w-4 rounded-full px-1.5 py-px text-center text-[10px] font-bold",
                      statusFilter === s.id
                        ? "bg-white/20 text-white"
                        : "bg-exp-line-soft text-exp-muted",
                    )}
                  >
                    {displayStatusCounts[s.id]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {hasActiveFilters() ? (
            <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
              <span className={cn(EXP_HELP_TEXT, "mt-0")}>
                <Filter size={12} /> Filtros activos:
              </span>
              {searchInput ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-exp-brand bg-exp-brand-soft py-[3px] pl-2.5 pr-2 text-xs font-semibold text-exp-brand [&>button]:inline-flex [&>button]:items-center [&>button]:border-0 [&>button]:bg-transparent [&>button]:p-0 [&>button]:text-inherit [&>button]:opacity-70 hover:[&>button]:opacity-100">
                  Búsqueda: &quot;{searchInput.slice(0, 20)}&quot;
                  <button onClick={() => setSearchInput("")} aria-label="Quitar filtro">
                    <X size={12} />
                  </button>
                </span>
              ) : null}
              {advancedFilters.oficina ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-exp-brand bg-exp-brand-soft py-[3px] pl-2.5 pr-2 text-xs font-semibold text-exp-brand [&>button]:inline-flex [&>button]:items-center [&>button]:border-0 [&>button]:bg-transparent [&>button]:p-0 [&>button]:text-inherit [&>button]:opacity-70 hover:[&>button]:opacity-100">
                  Oficina: {advancedFilters.oficina}
                  <button
                    onClick={() =>
                      setAdvancedFilters((f) => ({ ...f, oficina: "" }))
                    }
                    aria-label="Quitar filtro"
                  >
                    <X size={12} />
                  </button>
                </span>
              ) : null}
              {advancedFilters.estante ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-exp-brand bg-exp-brand-soft py-[3px] pl-2.5 pr-2 text-xs font-semibold text-exp-brand [&>button]:inline-flex [&>button]:items-center [&>button]:border-0 [&>button]:bg-transparent [&>button]:p-0 [&>button]:text-inherit [&>button]:opacity-70 hover:[&>button]:opacity-100">
                  Estante: {advancedFilters.estante}
                  <button
                    onClick={() =>
                      setAdvancedFilters((f) => ({ ...f, estante: "" }))
                    }
                    aria-label="Quitar filtro"
                  >
                    <X size={12} />
                  </button>
                </span>
              ) : null}
              {advancedFilters.tipoDocumento ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-exp-brand bg-exp-brand-soft py-[3px] pl-2.5 pr-2 text-xs font-semibold text-exp-brand [&>button]:inline-flex [&>button]:items-center [&>button]:border-0 [&>button]:bg-transparent [&>button]:p-0 [&>button]:text-inherit [&>button]:opacity-70 hover:[&>button]:opacity-100">
                  Tipo: {advancedFilters.tipoDocumento}
                  <button
                    onClick={() =>
                      setAdvancedFilters((f) => ({ ...f, tipoDocumento: "" }))
                    }
                    aria-label="Quitar filtro"
                  >
                    <X size={12} />
                  </button>
                </span>
              ) : null}
              {statusFilter !== "todos" ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-exp-brand bg-exp-brand-soft py-[3px] pl-2.5 pr-2 text-xs font-semibold text-exp-brand [&>button]:inline-flex [&>button]:items-center [&>button]:border-0 [&>button]:bg-transparent [&>button]:p-0 [&>button]:text-inherit [&>button]:opacity-70 hover:[&>button]:opacity-100">
                  Estado: {STATUS_PILLS.find((p) => p.id === statusFilter)?.label}
                  <button onClick={() => setStatusFilter("todos")} aria-label="Quitar filtro">
                    <X size={12} />
                  </button>
                </span>
              ) : null}
              <button
                type="button"
                className={expBtnClass("ghost", "small")}
                onClick={clearFilters}
              >
                <X size={12} /> Limpiar todos
              </button>
            </div>
          ) : null}

          <div className="mb-3.5 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))_auto] items-end gap-2.5 rounded-exp border border-exp-line bg-exp-line-soft p-3">
            {isAdmin ? (
              <div className={EXP_FIELD}>
                <label className={EXP_FIELD_LABEL}>
                  <Filter size={11} /> Oficina
                </label>
                <input
                  value={advancedFilters.oficina}
                  onChange={(e) =>
                    setAdvancedFilters((f) => ({ ...f, oficina: e.target.value }))
                  }
                  placeholder="Filtrar por oficina"
                  className={EXP_FIELD_CONTROL}
                  aria-label="Filtrar por oficina"
                />
              </div>
            ) : null}
            <div className={EXP_FIELD}>
              <label className={EXP_FIELD_LABEL}>Estante</label>
              <input
                value={advancedFilters.estante}
                onChange={(e) =>
                  setAdvancedFilters((f) => ({ ...f, estante: e.target.value }))
                }
                placeholder="Nº estante"
                className={EXP_FIELD_CONTROL}
                aria-label="Filtrar por estante"
              />
            </div>
            <div className={EXP_FIELD}>
              <label className={EXP_FIELD_LABEL}>Tipo de documento</label>
              <input
                value={advancedFilters.tipoDocumento}
                onChange={(e) =>
                  setAdvancedFilters((f) => ({ ...f, tipoDocumento: e.target.value }))
                }
                placeholder="Resolución, Oficio…"
                className={EXP_FIELD_CONTROL}
                aria-label="Filtrar por tipo de documento"
              />
            </div>
            <button
              type="button"
              className={expBtnClass("ghost")}
              onClick={clearFilters}
              disabled={!hasActiveFilters()}
            >
              <X size={14} /> Limpiar
            </button>
          </div>

          {canManage && selectedIds.size > 0 ? (
            <div
              className="mb-3.5 flex animate-[expSlideDown_200ms_ease] items-center gap-2.5 rounded-exp bg-[linear-gradient(90deg,var(--color-exp-brand)_0%,var(--color-exp-brand-dark)_100%)] px-3.5 py-2.5 text-white shadow-[0_4px_14px_rgba(15,118,110,0.25)]"
              role="region"
              aria-label="Acciones masivas"
            >
              <strong className="text-[13px] font-bold">{selectedIds.size}</strong>
              <span className="mr-auto text-xs opacity-85">
                seleccionado{selectedIds.size === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md border border-white/25 bg-white/15 px-3 py-1.5 text-xs font-semibold text-white transition-colors duration-[120ms] ease-linear hover:border-white/40 hover:bg-white/25"
                onClick={() => setSelectedIds(new Set())}
              >
                <X size={14} /> Cancelar
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md border border-white bg-white px-3 py-1.5 text-xs font-semibold text-exp-brand transition-colors duration-[120ms] ease-linear hover:bg-exp-brand-soft"
                onClick={() => setBulkOpen(true)}
              >
                <MapPin size={14} /> Mover / reasignar
              </button>
            </div>
          ) : null}

          {loadingList ? (
            <>
              <SkeletonStats />
              <SkeletonList count={5} />
            </>
          ) : filteredExps.length === 0 ? (
            <div className={EXP_EMPTY}>
              <div className={EXP_EMPTY_ILLUSTRATION}>
                <FileText size={28} />
              </div>
              <h3 className={EXP_EMPTY_TITLE}>
                {expedientes.length === 0
                  ? "El archivo está vacío"
                  : "Sin coincidencias"}
              </h3>
              <p className={EXP_EMPTY_DESC}>
                {expedientes.length === 0
                  ? "Sube el primer expediente para empezar a indexar contenido."
                  : "No hay expedientes que coincidan con los filtros aplicados. Prueba ajustando los criterios."}
              </p>
              {expedientes.length === 0 && canManage ? (
                <button
                  type="button"
                  className={cn(expBtnClass("primary"), "mt-2")}
                  onClick={() => setTab("subir")}
                >
                  <Plus size={16} /> Subir primer expediente
                </button>
              ) : null}
            </div>
          ) : (
            <>
              {viewMode === "lista" ? (
                <div className={EXP_LIST} role="list">
                  {filteredExps.map((exp) => (
                    <article
                      key={exp.id}
                      className={cn(EXP_LIST_ITEM, "cursor-pointer")}
                      onClick={() => setOpenExp(exp)}
                      role="listitem"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setOpenExp(exp);
                        }
                      }}
                    >
                      <div className={EXP_LIST_ITEM_ICON}>
                        <FileText size={18} />
                      </div>
                      <div className={EXP_LIST_ITEM_BODY}>
                        <h4 className={EXP_LIST_ITEM_TITLE}>{exp.title}</h4>
                        <div className={EXP_LIST_ITEM_META}>
                          {exp.serie_documento ? (
                            <span>{exp.serie_documento}</span>
                          ) : (
                            <span>Sin número</span>
                          )}
                          {exp.anio ? <span>· {exp.anio}</span> : null}
                          {exp.oficina ? <span>· {exp.oficina}</span> : null}
                          <span>· {formatBytes(exp.file_size)}</span>
                          <span className={expStatusClass(exp.status)} data-status={exp.status}>
                            {statusLabel(exp.status)}
                          </span>
                        </div>
                        {exp.nro_estante || exp.nro_piso || exp.nro_local ? (
                          <div className={EXP_LIST_ITEM_META}>
                            <span className="inline-flex items-center gap-1 [&>svg]:size-3">
                              <MapPin size={12} />
                              {[exp.nro_estante && `E${exp.nro_estante}`, exp.nro_piso && `P${exp.nro_piso}`, exp.nro_local]
                                .filter(Boolean)
                                .join(" / ")}
                            </span>
                          </div>
                        ) : null}
                      </div>
                      <div
                        className={EXP_LIST_ITEM_ACTIONS}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {canManage ? (
                          <>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(exp.id)}
                              onChange={() => toggleSelect(exp.id)}
                              aria-label={`Seleccionar ${exp.title}`}
                              className="mr-1"
                            />
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
                          </>
                        ) : (
                          <a
                            href={`/api/expedientes-archivo/${exp.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className={EXP_ICON_BUTTON}
                            aria-label="Abrir PDF"
                            title="Abrir PDF"
                          >
                            <FileText size={14} />
                          </a>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              ) : viewMode === "tabla" ? (
                <TablaExpedientes
                  exps={filteredExps}
                  canManage={canManage}
                  selectedIds={selectedIds}
                  onToggle={toggleSelect}
                  onSelectAll={toggleSelectAll}
                  onOpen={setOpenExp}
                  onDelete={deleteExpediente}
                  onDownload={(exp) =>
                    window.open(`/api/expedientes-archivo/${exp.id}`, "_blank")
                  }
                  onReplace={setReplaceExp}
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={handleSort}
                  reindexingId={reindexingId}
                  deletingId={deletingId}
                  reindex={reindexExpediente}
                  formatBytes={formatBytes}
                  statusLabel={statusLabel}
                />
              ) : (
                <TarjetasExpedientes
                  exps={filteredExps}
                  onOpen={setOpenExp}
                  formatBytes={formatBytes}
                  statusLabel={statusLabel}
                />
              )}

              <div className="mt-4 flex items-center justify-between rounded-exp bg-exp-line-soft px-3.5 py-3 text-xs text-exp-muted [&>span>strong]:font-bold [&>span>strong]:text-exp-ink">
                <span>
                  Mostrando <strong>{filteredExps.length}</strong> de{" "}
                  {expedientes.length} expediente{expedientes.length === 1 ? "" : "s"}
                </span>
                {hasActiveFilters() ? (
                  <button
                    type="button"
                    className={expBtnClass("ghost", "small")}
                    onClick={resetPreferences}
                  >
                    <History size={12} /> Restablecer preferencias
                  </button>
                ) : null}
              </div>

              {pagination.totalPages > 1 ? (
                <Pagination
                  pagination={pagination}
                  onPageChange={(page) => void loadExpedientes(page)}
                />
              ) : null}
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
