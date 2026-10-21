"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Copy, FileText, GitCompare, History, Loader2, Search, X } from "lucide-react";
import { useState } from "react";
import {
  nuevaVersionRespuesta,
  type SavedRespuesta,
} from "@/lib/expedientes-archivo-actions";
import { Pagination } from "../pagination";
import {
  EXP_FIELD,
  EXP_FIELD_CONTROL,
  EXP_FIELD_LABEL,
  EXP_FORM_SECTION,
  EXP_FORM_SECTION_HEADER,
  EXP_FORM_SECTION_HINT,
  EXP_FORM_SECTION_TITLE,
  EXP_ICON_BUTTON,
  EXP_SPIN,
  expBtnClass,
} from "../estilos";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 8;

type Props = {
  onOpen: (r: SavedRespuesta) => void;
  saved: SavedRespuesta[];
  loading?: boolean;
  onVersionCreated?: (id: string) => void;
  showToast: (msg: string, kind?: "success" | "error" | "warning" | "info") => void;
};

// Seccion 5: Historial de respuestas archivadas con:
// - Busqueda local (asunto, destinatario, nro de oficio, contenido)
// - Paginacion
// - Chip de version (v2, v3, ...)
// - Boton "Nueva version" que clona y abre en el editor
export function HistorialRespuestas({
  onOpen,
  saved,
  loading,
  onVersionCreated,
  showToast,
}: Props) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [creatingVersionFor, setCreatingVersionFor] = useState<string | null>(null);
  const [compare, setCompare] = useState<SavedRespuesta | null>(null);

  const filtered = (() => {
    const term = query.trim().toLowerCase();
    if (!term) return saved;
    return saved.filter((r) => {
      return (
        (r.asunto ?? "").toLowerCase().includes(term) ||
        (r.destinatario ?? "").toLowerCase().includes(term) ||
        (r.nro_oficio ?? "").toLowerCase().includes(term) ||
        (r.cuerpo ?? "").toLowerCase().includes(term)
      );
    });
  })();

  const total = filtered.length;
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function handleNewVersion(r: SavedRespuesta) {
    setCreatingVersionFor(r.id);
    try {
      const result = await nuevaVersionRespuesta(r.id);
      showToast(
        `Nueva version creada (v${result.version}). Abriendola en el editor...`,
        "success",
      );
      onVersionCreated?.(result.id);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "No se pudo crear la nueva version",
        "error",
      );
    } finally {
      setCreatingVersionFor(null);
    }
  }

  if (loading) {
    return (
      <div className={cn("tw", EXP_FORM_SECTION, "mt-4")}>
        <div className={EXP_FORM_SECTION_HEADER}>
          <h3 className={EXP_FORM_SECTION_TITLE}>
            <History size={16} /> Respuestas archivadas
          </h3>
        </div>
        <p className="text-exp-muted">
          <Loader2 size={14} className={EXP_SPIN} /> Cargando historial...
        </p>
      </div>
    );
  }

  if (saved.length === 0) {
    return null;
  }

  return (
    <div className={cn("tw", EXP_FORM_SECTION, "mt-4")}>
      <div className={EXP_FORM_SECTION_HEADER}>
        <h3 className={EXP_FORM_SECTION_TITLE}>
          <History size={16} /> Respuestas archivadas
          <span className={EXP_FORM_SECTION_HINT}>
            {total} de {saved.length} — click para reabrir
          </span>
        </h3>
      </div>

      <div className={cn(EXP_FIELD, "mb-2")}>
        <label className={EXP_FIELD_LABEL} htmlFor="historial-search">
          <Search size={12} /> Buscar
        </label>
        <input
          id="historial-search"
          className={EXP_FIELD_CONTROL}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder="Asunto, destinatario, nro de oficio, contenido..."
        />
      </div>

      <div className="flex flex-col gap-2">
        {pageItems.length === 0 ? (
          <p className="m-0 text-sm text-exp-muted">
            Ninguna respuesta coincide con la busqueda.
          </p>
        ) : (
          pageItems.map((r) => (
            <div
              key={r.id}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-exp border border-exp-line bg-exp-panel p-3.5 text-left transition-all duration-[180ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:-translate-y-px hover:border-exp-brand hover:shadow-exp"
            >
              <button
                type="button"
                onClick={() => onOpen(r)}
                className="border-0 bg-transparent p-0 text-left text-inherit"
              >
                <div className="min-w-0">
                  <h4 className="m-0 mb-1 text-sm font-bold leading-snug text-exp-ink">
                    {r.nro_oficio || r.asunto || "Respuesta"}
                    {r.version && r.version > 1 ? (
                      <span className="ml-2 inline-block rounded bg-[#fef3c7] px-1.5 py-px align-middle text-[10px] font-bold text-[#92400e]">
                        v{r.version}
                      </span>
                    ) : null}
                    {r.parent_version_id ? (
                      <span
                        className="ml-1 text-[10px] text-exp-muted"
                        title="Es una revision de otra respuesta"
                      >
                        (revision)
                      </span>
                    ) : null}
                  </h4>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-exp-muted">
                    {r.tipo_documento ? (
                      <span className="inline-flex items-center gap-1">{r.tipo_documento}</span>
                    ) : null}
                    {r.asunto ? <span className="inline-flex items-center gap-1">{r.asunto}</span> : null}
                    {r.destinatario ? (
                      <span className="inline-flex items-center gap-1">→ {r.destinatario}</span>
                    ) : null}
                    <span className="inline-flex items-center gap-1">
                      {new Date(r.created_at).toLocaleDateString("es-PE")}
                    </span>
                    {r.antecedente_id ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-[#155e75]">
                        <FileText size={11} /> PDF
                      </span>
                    ) : null}
                  </div>
                </div>
              </button>
              {r.parent_version_id && saved.some((s) => s.id === r.parent_version_id) ? (
                <button
                  type="button"
                  className={EXP_ICON_BUTTON}
                  aria-label="Comparar con la version anterior"
                  title="Comparar con la version anterior"
                  onClick={() => setCompare(r)}
                >
                  <GitCompare size={15} />
                </button>
              ) : null}
              <button
                type="button"
                className={cn(EXP_ICON_BUTTON, "text-exp-brand")}
                aria-label="Nueva version"
                title="Crear nueva version (revisar)"
                onClick={() => handleNewVersion(r)}
                disabled={creatingVersionFor === r.id}
              >
                {creatingVersionFor === r.id ? (
                  <Loader2 size={15} className={EXP_SPIN} />
                ) : (
                  <Copy size={15} />
                )}
              </button>
            </div>
          ))
        )}
      </div>

      {compare ? (
        <CompareModal
          actual={compare}
          anterior={saved.find((s) => s.id === compare.parent_version_id) ?? null}
          onClose={() => setCompare(null)}
          onOpen={(r) => {
            setCompare(null);
            onOpen(r);
          }}
        />
      ) : null}

      {totalPages > 1 ? (
        <div className="mt-3 flex justify-center">
          <Pagination
            pagination={{ limit: PAGE_SIZE, page, total, totalPages }}
            onPageChange={setPage}
          />
        </div>
      ) : null}
    </div>
  );
}

// Comparación lado a lado de una versión con su anterior. Los párrafos que
// no están en la otra versión se resaltan (nuevo en verde, quitado en rojo).
function CompareModal({
  actual,
  anterior,
  onClose,
  onOpen,
}: {
  actual: SavedRespuesta;
  anterior: SavedRespuesta | null;
  onClose: () => void;
  onOpen: (r: SavedRespuesta) => void;
}) {
  const parrafos = (texto: string) =>
    texto
      .split(/\r?\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
  const pAnterior = parrafos(anterior?.cuerpo ?? "");
  const pActual = parrafos(actual.cuerpo ?? "");
  const setAnterior = new Set(pAnterior);
  const setActual = new Set(pActual);

  const columna = (titulo: string, items: string[], otros: Set<string>, highlightClass: string) => (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <strong className="text-[13px]">{titulo}</strong>
      <div className="flex-1 overflow-y-auto rounded-lg border border-exp-line p-2.5 text-[12.5px] leading-[1.55]">
        {items.length === 0 ? (
          <em className="text-exp-muted">Sin contenido.</em>
        ) : (
          items.map((p, i) => (
            <p
              key={i}
              className={cn("mb-2 text-justify", !otros.has(p) && cn("rounded px-1 py-0.5", highlightClass))}
            >
              {p}
            </p>
          ))
        )}
      </div>
    </div>
  );

  // Escape, foco atrapado y bloqueo de scroll los aporta Radix.
  return (
    <Dialog.Root
      open
      onOpenChange={(abierto) => {
        if (!abierto) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="visorModalFondo" />
        <Dialog.Content className="tw diffVersiones">
          <div className="diffVersionesHead">
            <Dialog.Title asChild>
              <h3 className="diffVersionesTitulo">
                Comparando v{actual.version ?? 2} con la versión anterior
                {actual.nro_oficio ? ` — ${actual.nro_oficio}` : ""}
              </h3>
            </Dialog.Title>
            <Dialog.Close asChild>
              <button aria-label="Cerrar comparación" className="visorModalCerrar" type="button">
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>
          <span className="diffVersionesPista">
            Los párrafos resaltados en rojo se quitaron; los verdes son nuevos o cambiaron.
          </span>
          <div className="diffVersionesCols">
            {columna(
              anterior ? `Versión anterior (v${anterior.version ?? 1})` : "Versión anterior",
              pAnterior,
              setActual,
              "bg-exp-danger-soft",
            )}
            {columna(`Esta versión (v${actual.version ?? 2})`, pActual, setAnterior, "bg-exp-success-soft")}
          </div>
          <div className="diffVersionesPie">
            {anterior ? (
              <button type="button" className={expBtnClass("secondary")} onClick={() => onOpen(anterior)}>
                Restaurar la anterior en el editor
              </button>
            ) : null}
            <button type="button" className={expBtnClass("primary")} onClick={() => onOpen(actual)}>
              Abrir esta versión
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
