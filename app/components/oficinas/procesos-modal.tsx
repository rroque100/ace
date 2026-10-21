"use client";

import { Loader2, Plus, Save, Search, Star, Trash2, Workflow, X, ChevronDown, ChevronRight, ChevronUp, BookOpen } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "../confirm-dialog";
import {
  type ProcessTypeSetting,
  CATEGORY_META,
  CATEGORY_ORDER,
  codeFromLabel,
} from "@/lib/configuracion-types";
import { LEY_32069_PROCESOS_CATALOGO } from "@/lib/procesos-catalogo-32069";
import { useYear } from "@/lib/year-context";
import { SavedBadge, type Oficina } from "./use-oficinas";
import { ModelosRequerimiento } from "./modelos-requerimiento";
import { btnPrimary as btnPri, btnSecondary as btnSec } from "../configuracion/ui";

type Props = {
  oficina: Oficina;
  open: boolean;
  onClose: () => void;
  setError: (v: string | null) => void;
};

type OfficeState = {
  processTypes: ProcessTypeSetting[];
  loaded: boolean;
  saving: boolean;
  savedAt: number | null;
  /** Procesos guardados que ya no existen en el catálogo (régimen derogado). */
  obsoletos: number;
};

export function ProcesosModal({ oficina, open, onClose, setError }: Props) {
  const { yearParam } = useYear();
  const [st, setSt] = useState<OfficeState>({
    processTypes: [],
    loaded: false,
    obsoletos: 0,
    saving: false,
    savedAt: null,
  });
  const [processFilter, setProcessFilter] = useState<string>("todos");
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [showOnlyActive, setShowOnlyActive] = useState(false);
  // Base legal mostrada como popover (antes era un alert() bloqueante).
  const [baseLegalAbierta, setBaseLegalAbierta] = useState<number | null>(null);

  const { processTypes, loaded, saving, savedAt, obsoletos } = st;

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Load saved processes from API and merge with legal catalog
  useEffect(() => {
    if (!open || loaded) return;
    fetch(`/api/configuracion/oficinas/${oficina.id}/procesos?${yearParam}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        const saved = data.processTypes ?? [];
        // Merge: start with full legal catalog, then apply saved active states and custom fields
        const merged = LEY_32069_PROCESOS_CATALOGO.map((catalogItem) => {
          const savedItem = saved.find((s: ProcessTypeSetting) => s.code === catalogItem.code || (s.label && s.label === catalogItem.label));
          if (savedItem) {
            return {
              ...catalogItem,
              ...savedItem,
              // Keep catalog legalBasis/object/description as defaults if saved ones are empty
              legalBasis: savedItem.legalBasis || catalogItem.legalBasis,
              object: savedItem.object || catalogItem.object,
              description: savedItem.description || catalogItem.description,
            };
          }
          return catalogItem;
        });
        // Lo guardado que NO está en el catálogo se retira. No son procesos que
        // alguien añadiera a mano: vienen del catálogo anterior, que era del
        // régimen derogado ("Adjudicación Simplificada", "Adjudicación Directa"
        // — vocabulario de la Ley 30225, con citas legales que no correspondían
        // a ningún artículo). Mantenerlos en pantalla los daría por válidos.
        //
        // No se borran en silencio: se cuentan y se dicen. La configuración de la
        // base sigue intacta hasta que alguien guarde.
        const obsoletos = saved.filter(
          (s: ProcessTypeSetting) =>
            !LEY_32069_PROCESOS_CATALOGO.some((c) => c.code === s.code || (c.label && c.label === s.label)),
        );
        setSt((prev) => ({
          ...prev,
          loaded: true,
          obsoletos: obsoletos.length,
          processTypes: merged,
        }));
      })
      .catch(() => { setSt((prev) => ({ ...prev, loaded: true })); });
  }, [open, loaded, oficina.id, yearParam]);

  const categorySummary = useMemo(
    () =>
      CATEGORY_ORDER.map((value) => {
        const items = processTypes.filter((item) => item.category === value);
        return {
          activeCount: items.filter((item) => item.active).length,
          description: CATEGORY_META[value].description,
          label: CATEGORY_META[value].label,
          total: items.length,
          value,
        };
      }),
    [processTypes],
  );

  const processFilters = useMemo(
    () => [
      { count: processTypes.length, label: "Todos", value: "todos" },
      ...CATEGORY_ORDER.map((value) => ({
        count: processTypes.filter((item) => item.category === value).length,
        label: CATEGORY_META[value].label,
        value,
      })),
    ],
    [processTypes],
  );

  const visibleProcesses = useMemo(
    () =>
      processTypes
        .map((item, index) => ({ index, item }))
        .filter(({ item }) =>
          processFilter === "todos" ? true : item.category === processFilter,
        )
        .filter(({ item }) => {
          // "Solo activos" se evalúa SIEMPRE, aun sin búsqueda: antes iba tras
          // el atajo de `searchQuery` vacío, así que el toggle no hacía nada
          // hasta que se escribía algo en el buscador.
          if (showOnlyActive && !item.active) return false;
          if (!searchQuery.trim()) return true;
          const q = searchQuery.toLowerCase().trim();
          return (
            item.label.toLowerCase().includes(q) ||
            item.code.toLowerCase().includes(q) ||
            item.object.toLowerCase().includes(q) ||
            item.legalBasis.toLowerCase().includes(q) ||
            item.description.toLowerCase().includes(q)
          );
        }),
    [processTypes, processFilter, searchQuery, showOnlyActive],
  );

  function updateProcess(index: number, patch: Partial<ProcessTypeSetting>) {
    setSt((prev) => ({
      ...prev,
      processTypes: prev.processTypes.map((item, i) =>
        i === index ? { ...item, ...patch } : item,
      ),
    }));
  }

  function addProcess() {
    const presetCategory = (CATEGORY_ORDER as string[]).includes(processFilter)
      ? (processFilter as ProcessTypeSetting["category"])
      : "competitivo";
    setSt((prev) => ({
      ...prev,
      processTypes: [
        ...prev.processTypes,
        {
          active: true,
          category: presetCategory,
          code: "",
          description: "",
          frequentMunicipality: false,
          label: "",
          legalBasis: "",
          object: "",
          sortOrder: prev.processTypes.length + 1,
        },
      ],
    }));
  }

  function confirmRemoveProcess() {
    if (pendingDelete === null) return;
    setSt((prev) => ({
      ...prev,
      processTypes: prev.processTypes.filter((_, i) => i !== pendingDelete),
    }));
    setPendingDelete(null);
  }

  function toggleSection(category: string) {
    setExpandedSections((prev) => ({ ...prev, [category]: !prev[category] }));
  }

  const pendingTarget = pendingDelete !== null ? processTypes[pendingDelete] : null;

  async function save() {
    const enabled = processTypes.filter((p) => p.active);
    if (enabled.length === 0) {
      setError("Marca al menos un proceso como activo para esta oficina.");
      return;
    }
    setSt((prev) => ({ ...prev, saving: true }));
    try {
      const res = await fetch(`/api/configuracion/oficinas/${oficina.id}/procesos?${yearParam}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processTypes: processTypes.filter(p => p.active || p.code) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al guardar");
      setSt((prev) => ({
        ...prev,
        saving: false,
        savedAt: Date.now(),
        processTypes: data.processTypes ?? prev.processTypes,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron guardar los procesos");
      setSt((prev) => ({ ...prev, saving: false }));
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1200] grid place-items-center bg-[rgba(15,23,42,0.6)]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex h-full w-full max-w-none flex-col overflow-hidden bg-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between border-b border-line bg-[#f8fafc] px-6 py-4">
          <div className="flex items-center gap-3 text-[#475569]">
            <div>
              <Workflow size={22} />
            </div>
            <div>
              <h2 className="m-0 text-xl font-bold">Procesos de contratación — Ley 32069</h2>
              <p className="m-0 mt-0.5 text-sm text-muted">{oficina.nombre}{oficina.sufijo ? ` · ${oficina.sufijo}` : ""}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <label className="flex cursor-pointer items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                className="accent-brand"
                checked={showOnlyActive}
                onChange={(e) => setShowOnlyActive(e.target.checked)}
              />
              <span>Solo activos</span>
            </label>
            <button type="button" className="flex shrink-0 cursor-pointer rounded-md border-0 bg-transparent p-2 text-[#94a3b8] transition-[background,color] duration-150 hover:bg-[#f1f5f9] hover:text-[#334155]" onClick={onClose} aria-label="Cerrar">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Cuerpo */}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
          {!loaded ? (
            <div className="flex items-center justify-center gap-2 py-10 text-md text-muted">
              <Loader2 size={24} className="animate-spin" /> Cargando catálogo legal y configuración guardada…
            </div>
          ) : (
            <>
              {/* Modelos de requerimiento (PDF) → RAG para el copiloto IA */}
              <ModelosRequerimiento entidad={oficina.entidad} />

              {/* Los procesos guardados con el catálogo anterior no se pierden
                  en silencio: se dice cuántos son y por qué se retiran. */}
              {obsoletos > 0 ? (
                <p className="flex items-start gap-2 rounded-[var(--radio-sm)] border border-[color-mix(in_srgb,var(--danger)_30%,transparent)] bg-danger-soft px-3 py-2.5 text-sm leading-snug text-[color-mix(in_srgb,var(--danger)_85%,var(--ink))] m-0 mb-3">
                  <BookOpen size={14} aria-hidden className="shrink-0 mt-0.5" />
                  <span>
                    Esta oficina tenía <strong>{obsoletos}</strong> proceso{obsoletos > 1 ? "s" : ""} de un
                    catálogo que no corresponde a la Ley 32069 —«Adjudicación Simplificada»,
                    «Adjudicación Directa» y similares son del régimen derogado—. No aparece
                    {obsoletos > 1 ? "n" : ""} en la lista y se retirará{obsoletos > 1 ? "n" : ""} al
                    guardar. Marca abajo los procedimientos que la oficina gestiona de verdad.
                  </span>
                </p>
              ) : null}

              {/* Toolbar */}
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-line pb-2 mb-2">
                <div className="relative min-w-[280px] max-w-[480px] flex-1">
                  <Search size={16} className="pointer-events-none absolute left-[11px] top-1/2 -translate-y-1/2 text-[#94a3b8]" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por nombre, código, objeto, base legal, descripción…"
                    aria-label="Buscar proceso"
                    className="box-border w-full rounded-lg border border-line px-9 py-2.5 text-base outline-none transition-[border-color,box-shadow] duration-150 focus:border-brand focus:shadow-[0_0_0_2px_rgba(15,118,110,0.12)]"
                  />
                  {searchQuery ? (
                    <button type="button" onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-sm border-0 bg-transparent p-1 text-[#94a3b8] hover:text-[#475569]" aria-label="Limpiar búsqueda">
                      <X size={14} />
                    </button>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2.5">
                  <button className={btnSec} type="button" onClick={() => {
                    const allExpanded = CATEGORY_ORDER.every(c => expandedSections[c]);
                    CATEGORY_ORDER.forEach(c => setExpandedSections(prev => ({ ...prev, [c]: !allExpanded })));
                  }}>
                    {CATEGORY_ORDER.every(c => expandedSections[c]) ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    <span>{CATEGORY_ORDER.every(c => expandedSections[c]) ? "Colapsar todo" : "Expandir todo"}</span>
                  </button>
                  <button className={btnPri} onClick={addProcess} type="button">
                    <Plus size={14} /> Nuevo proceso personalizado
                  </button>
                </div>
              </div>

              {/* Resumen por categoría */}
              <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2.5 px-0 py-2">
                {categorySummary.map((item) => (
                  <article data-category={item.value} key={item.value} className={`rounded-lg border border-line bg-white px-3 py-2.5 transition-[border-color,box-shadow] duration-150 hover:border-brand hover:shadow-[0_2px_8px_rgba(15,118,110,0.08)] ${
                    item.value === "competitivo" ? "border-l-[3px] border-l-[#0f766e]"
                    : item.value === "no_competitivo" ? "border-l-[3px] border-l-[#7c3aed]"
                    : "border-l-[3px] border-l-[#d97706]"
                  }`}>
                    <div className="mb-1 flex items-baseline gap-2">
                      <strong className="text-xl font-bold leading-none text-brand">{item.activeCount}</strong>
                      <span className={`rounded-full px-2 py-0.5 text-sm font-semibold capitalize ${
                        item.value === "competitivo" ? "bg-[#ecfeff] text-[#0f766e]"
                        : item.value === "no_competitivo" ? "bg-[#f5f3ff] text-[#7c3aed]"
                        : "bg-[#fffbeb] text-[#d97706]"
                      }`}>{item.label}</span>
                    </div>
                    <small className="text-xs text-muted">{item.activeCount} activo(s) de {item.total}</small>
                  </article>
                ))}
              </div>

              {/* Filtros por categoría */}
              <div className="flex shrink-0 flex-wrap items-center gap-2.5 border-b border-line py-2 mb-2">
                <div className="flex min-w-0 flex-1 flex-wrap gap-1.5" role="group" aria-label="Filtrar por categoria">
                  {processFilters.map((filter) => (
                    <button
                      aria-pressed={processFilter === filter.value}
                      key={filter.value}
                      onClick={() => setProcessFilter(filter.value)}
                      type="button"
                      className={`inline-flex items-center gap-1.5 cursor-pointer border px-3 py-1.5 text-sm font-[850] rounded-sm transition-all duration-150 ease ${
                        processFilter === filter.value
                          ? "border-brand bg-brand text-white"
                          : "border-line bg-white text-[#475569] hover:border-brand hover:text-brand"
                      }`}
                    >
                      {filter.label}
                      <em className={`not-italic font-semibold rounded-full px-1.5 py-0.5 text-xs ${
                        processFilter === filter.value ? "bg-[rgba(255,255,255,0.2)]" : "bg-[#f1f5f9]"
                      }`}>{filter.count}</em>
                    </button>
                  ))}
                </div>
              </div>

              {/* Lista de procesos agrupados por categoría */}
              <div className="flex flex-col gap-2.5">
                {CATEGORY_ORDER.map((catValue) => {
                  const catItems = visibleProcesses.filter(({ item }) => item.category === catValue);
                  const isExpanded = expandedSections[catValue] ?? true;
                  if (catItems.length === 0) return null;

                  return (
                    <section key={catValue}>
                      <header className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2" onClick={() => toggleSection(catValue)}>
                        <div className="flex items-center gap-2">
                          <span className="text-muted">
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
                            catValue === "competitivo" ? "bg-[#ecfeff] text-[#0f766e]"
                            : catValue === "no_competitivo" ? "bg-[#f5f3ff] text-[#7c3aed]"
                            : "bg-[#fffbeb] text-[#d97706]"
                          }`}>
                            {CATEGORY_META[catValue].label}
                          </span>
                          <span className="text-sm text-muted">
                            {catItems.filter(({ item }) => item.active).length} / {catItems.length}
                          </span>
                        </div>
                        <p className="m-0 flex-1 text-sm text-muted">{CATEGORY_META[catValue].description}</p>
                      </header>
                      {isExpanded && (
                        <div className="flex flex-col gap-2.5 pl-4">
                          {catItems.map(({ index, item }) => (
                            <article
                              className={`rounded-xl border bg-white transition-[border-color,box-shadow,opacity] duration-150 ${
                                item.active ? "border-brand shadow-[0_0_0_1px_rgba(15,118,110,0.1)]" : "border-line"
                              } ${
                                item.category === "competitivo" ? "border-l-[3px] border-l-[#0f766e]"
                                : item.category === "no_competitivo" ? "border-l-[3px] border-l-[#7c3aed]"
                                : "border-l-[3px] border-l-[#d97706]"
                              } ${!item.active ? "bg-[#fbfbfc] opacity-70" : ""}`}
                              data-active={item.active}
                              data-category={item.category}
                              key={`${item.code}-${index}`}
                            >
                              <header className="flex items-center gap-2 px-3 py-2 border-b border-line bg-[#fafafa]">
                                <label className="relative flex shrink-0 cursor-pointer items-center" title={item.active ? "Desactivar" : "Activar"}>
                                  <input
                                    checked={item.active}
                                    onChange={(event) => updateProcess(index, { active: event.target.checked })}
                                    type="checkbox"
                                    className="absolute size-0 opacity-0"
                                    aria-label={item.active ? `Desactivar ${item.label || item.code}` : `Activar ${item.label || item.code}`}
                                  />
                                  <span
                                    role="switch"
                                    aria-checked={item.active}
                                    className={`inline-flex h-[22px] w-10 items-center rounded-full bg-[#cbd5e1] p-[2px] transition-[background] duration-150 ${
                                      item.active ? "!bg-[#0f766e]" : ""
                                    }`}
                                  >
                                    <span className={`inline-block size-[18px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-transform duration-150 ${
                                      item.active ? "translate-x-[18px]" : ""
                                    }`} />
                                  </span>
                                </label>
                                <input
                                  className="flex-1 min-w-0 border-0 bg-transparent text-sm font-semibold text-[#1e293b] outline-none placeholder:text-[#94a3b8]"
                                  onBlur={() => {
                                    if (!item.code && item.label) {
                                      updateProcess(index, { code: codeFromLabel(item.label) });
                                    }
                                  }}
                                  onChange={(event) => updateProcess(index, { label: event.target.value })}
                                  placeholder="Nombre del procedimiento"
                                  value={item.label}
                                />
                                <div className="flex shrink-0 items-center gap-1">
                                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold inline-flex items-center gap-1 ${
                                    item.active ? "bg-[#dcfce7] text-[#166534]" : "bg-[#f1f5f9] text-[#64748b]"
                                  }`}>
                                    <span className="inline-block size-[6px] rounded-full bg-current" />
                                    {item.active ? "Activo" : "Inactivo"}
                                  </span>
                                  {item.frequentMunicipality ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-[#fef3c7] px-2 py-0.5 text-xs font-semibold text-[#92400e]">
                                      <Star size={12} /> Frecuente
                                    </span>
                                  ) : null}
                                  {!LEY_32069_PROCESOS_CATALOGO.some(c => c.code === item.code) && (
                                    <span className="rounded-full bg-[#e0e7ff] px-2 py-0.5 text-xs font-semibold text-[#3730a3]">Personalizado</span>
                                  )}
                                </div>
                                <div className="relative flex shrink-0 gap-1">
                                  <button
                                    aria-label={item.legalBasis ? "Ver base legal" : "Sin base legal"}
                                    aria-expanded={baseLegalAbierta === index}
                                    className="grid size-[32px] place-items-center rounded-full border border-line bg-white text-brand cursor-pointer hover:border-[rgba(176,71,60,0.45)] hover:bg-[#fbf1ef] hover:text-[#b0473c]"
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setBaseLegalAbierta(baseLegalAbierta === index ? null : index); }}
                                  >
                                    <BookOpen size={13} />
                                  </button>
                                  {baseLegalAbierta === index ? (
                                    <div
                                      role="dialog"
                                      aria-label="Base legal"
                                      className="absolute right-0 top-[calc(100%+6px)] z-20 w-[280px] rounded-lg border border-line bg-panel p-3 text-xs leading-relaxed text-ink shadow-pop"
                                    >
                                      <div className="mb-1.5 flex items-center justify-between gap-2">
                                        <span className="font-semibold text-muted uppercase tracking-wide">Base legal</span>
                                        <button
                                          aria-label="Cerrar"
                                          className="grid size-6 place-items-center rounded-md text-muted hover:bg-surface hover:text-ink"
                                          onClick={(e) => { e.stopPropagation(); setBaseLegalAbierta(null); }}
                                          type="button"
                                        >
                                          <X size={12} />
                                        </button>
                                      </div>
                                      {item.legalBasis ? (
                                        <p className="m-0 whitespace-pre-line">{item.legalBasis}</p>
                                      ) : (
                                        <p className="m-0 text-muted">Sin base legal registrada.</p>
                                      )}
                                    </div>
                                  ) : null}
                                  <button
                                    aria-label="Eliminar proceso"
                                    className="grid size-[32px] place-items-center rounded-full border border-line bg-white text-brand cursor-pointer hover:border-[rgba(176,71,60,0.45)] hover:bg-[#fbf1ef] hover:text-[#b0473c]"
                                    onClick={() => setPendingDelete(index)}
                                    type="button"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </header>

                              <div className="flex flex-col gap-2 p-3">
                                <label className="flex flex-col gap-1 text-sm">
                                  <span className="font-semibold text-[#475569]">Objeto</span>
                                  <input
                                    className="w-full rounded-md border border-line bg-white px-2.5 py-2 text-base outline-none transition-[border-color,box-shadow] duration-150 focus:border-brand focus:shadow-[0_0_0_2px_rgba(15,118,110,0.12)]"
                                    onChange={(event) => updateProcess(index, { object: event.target.value })}
                                    placeholder="Bienes, obras, servicios..."
                                    value={item.object}
                                  />
                                </label>
                                <label className="flex flex-col gap-1 text-sm">
                                  <span className="font-semibold text-[#475569]">Sustento / referencia legal</span>
                                  <input
                                    className="w-full rounded-md border border-line bg-white px-2.5 py-2 text-base outline-none transition-[border-color,box-shadow] duration-150 focus:border-brand focus:shadow-[0_0_0_2px_rgba(15,118,110,0.12)]"
                                    onChange={(event) => updateProcess(index, { legalBasis: event.target.value })}
                                    placeholder="Ley 32069, Reglamento, Bases Estandar DGA..."
                                    value={item.legalBasis}
                                  />
                                </label>
                              </div>

                              <details className="border-t border-dashed border-line px-3 pb-3 pt-2">
                                <summary className="w-fit cursor-pointer text-sm font-semibold text-[#64748b]">
                                  Opciones avanzadas
                                </summary>
                                <div className="mt-2 grid grid-cols-2 gap-3 border-t border-line pt-2 max-md:grid-cols-1">
                                  <label className="flex flex-col gap-1 text-sm">
                                    <span className="font-semibold text-[#475569]">Categoría</span>
                                    <select
                                      className="w-full rounded-md border border-line bg-white px-2.5 py-2 text-base outline-none transition-[border-color,box-shadow] duration-150 focus:border-brand focus:shadow-[0_0_0_2px_rgba(15,118,110,0.12)]"
                                      onChange={(event) =>
                                        updateProcess(index, {
                                          category: event.target.value as ProcessTypeSetting["category"],
                                        })
                                      }
                                      value={item.category}
                                    >
                                      <option value="competitivo">Competitivo</option>
                                      <option value="no_competitivo">No competitivo</option>
                                      <option value="contrato_menor">Contrato menor</option>
                                    </select>
                                  </label>
                                  <label className="flex flex-col gap-1 text-sm">
                                    <span className="font-semibold text-[#475569]">Descripción operativa</span>
                                    <input
                                      className="w-full rounded-md border border-line bg-white px-2.5 py-2 text-base outline-none transition-[border-color,box-shadow] duration-150 focus:border-brand focus:shadow-[0_0_0_2px_rgba(15,118,110,0.12)]"
                                      onChange={(event) => updateProcess(index, { description: event.target.value })}
                                      placeholder="Uso interno, directiva aplicable o nota breve"
                                      value={item.description}
                                    />
                                  </label>
                                  <label className="flex flex-row items-center gap-2 text-sm font-medium text-[#475569]">
                                    <input
                                      checked={item.frequentMunicipality}
                                      onChange={(event) =>
                                        updateProcess(index, { frequentMunicipality: event.target.checked })
                                      }
                                      type="checkbox"
                                      className="size-4 accent-brand"
                                    />
                                    <span>Frecuente municipal</span>
                                  </label>
                                  <label className="flex flex-col gap-1 text-sm">
                                    <span className="font-semibold text-[#475569]">Código interno</span>
                                    <input
                                      className="w-full rounded-md border border-line bg-white px-2.5 py-2 text-base outline-none transition-[border-color,box-shadow] duration-150 focus:border-brand focus:shadow-[0_0_0_2px_rgba(15,118,110,0.12)]"
                                      onChange={(event) =>
                                        updateProcess(index, { code: codeFromLabel(event.target.value) })
                                      }
                                      placeholder="licitacion_publica"
                                      value={item.code}
                                    />
                                  </label>
                                  <label className="flex flex-col gap-1 text-sm">
                                    <span className="font-semibold text-[#475569]">Orden de aparición</span>
                                    <input
                                      className="w-full rounded-md border border-line bg-white px-2.5 py-2 text-base outline-none transition-[border-color,box-shadow] duration-150 focus:border-brand focus:shadow-[0_0_0_2px_rgba(15,118,110,0.12)]"
                                      inputMode="numeric"
                                      onChange={(event) =>
                                        updateProcess(index, {
                                          sortOrder: Number.parseInt(event.target.value || "0", 10),
                                        })
                                      }
                                      value={item.sortOrder}
                                    />
                                  </label>
                                </div>
                              </details>
                            </article>
                          ))}
                        </div>
                      )}
                    </section>
                  );
                })}

                {visibleProcesses.length === 0 && (
                  <div className="py-8 text-center text-base text-muted">
                    {searchQuery.trim()
                      ? "Ningún proceso coincide con la búsqueda."
                      : "No hay procesos en esta categoría."}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {loaded ? (
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-t border-line bg-[#f8fafc] px-6 py-3.5">
            <span className="min-w-[280px] flex-1 text-sm leading-normal text-[#64748b]">
              Catálogo basado en <strong className="text-[#475569]">Ley 32069</strong> y su Reglamento (D.S. 009-2025-EF).
              Los procesos marcados como &quot;Frecuente municipal&quot; aparecen primero al crear expedientes.
            </span>
            <div className="flex shrink-0 items-center gap-2.5">
              <button
                className={btnPri}
                onClick={save}
                type="button"
                disabled={saving}
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Guardar cambios
              </button>
              {/* Se auto-oculta a los 30 s: el rótulo fijo se quedaba pegado
                  indefinidamente, incluso mientras se seguía editando. */}
              <SavedBadge at={savedAt} />
              <button className={btnSec} onClick={onClose} type="button">
                Cerrar
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Eliminar proceso"
        message={
          pendingTarget
            ? `Eliminar el proceso "${pendingTarget.label || pendingTarget.code || "sin nombre"}? Esta accion se aplicara al guardar los cambios.`
            : ""
        }
        tone="danger"
        confirmLabel="Eliminar"
        onConfirm={confirmRemoveProcess}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}