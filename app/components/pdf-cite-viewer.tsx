"use client";
import"./library-workspace.css";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileSearch,
  LoaderCircle,
  X,
} from "lucide-react";
import type { SourceBlock } from "@/lib/source-blocks";
import { SaveButton } from "./save-button";
import {GuidedReading} from './guided-reading';
import {DocumentFacts} from './document-facts';
import {FollowSource} from './follow-source';

type PdfCiteButtonProps = {
  documentId: string;
  page?: number | null;
  quote?: string | null;
  label?: string;
  sidePanel?: boolean;
  locator?: string | null;
};

type Highlight = { left: number; top: number; width: number; height: number };

const stopWords = new Set([
  "para",
  "por",
  "que",
  "con",
  "los",
  "las",
  "del",
  "una",
  "como",
  "este",
  "esta",
]);

function normalizeQuoteText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function pdfSearchPhrase(quote?: string | null) {
  if (!quote) {
    return "";
  }

  const clean = quote
    .replace(/\s+/g, " ")
    .replace(/\[[Ff]#?\d+\]/g, "")
    .trim();

  if (!clean) {
    return "";
  }

  const sentence = clean
    .split(/(?<=[.;:])\s+/)
    .map((part) => part.trim())
    .find((part) => part.length >= 24);

  return (sentence ?? clean).slice(0, 90);
}

function quoteTokens(quote: string) {
  return new Set(
    quote
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 4 && !stopWords.has(token)),
  );
}

export function PdfCiteButton({
  documentId,
  page,
  quote,
  label = "Ver cita",
  sidePanel = false,
  locator,
}: PdfCiteButtonProps) {
  const [blocks, setBlocks] = useState<SourceBlock[]>([]);
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceInfo,setSourceInfo]=useState<{metadata:Record<string,unknown>;documentType?:string;sourceEntity?:string;sha256?:string}|null>(null);
  const [blockOffset, setBlockOffset] = useState(0);
  const [blockQuery, setBlockQuery] = useState("");
  const matchingBlocks = blockQuery.trim()
    ? blocks.filter((b) =>
        normalizeQuoteText(b.content).includes(normalizeQuoteText(blockQuery)),
      )
    : blocks;
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [currentPage, setCurrentPage] = useState(page && page > 0 ? page : 1);
  const [numPages, setNumPages] = useState(1);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfRef = useRef<any>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    async function load() {
      setStatus("loading");
      try {
        const contentResponse = await fetch(
          `/api/documents/${documentId}/content`,
        );
        if (contentResponse.ok) {
          const content = await contentResponse.json();
          if(!cancelled)setSourceTitle(content.title??'');
          if(!cancelled)setSourceInfo(content.document??null);
          if (content.format !== "pdf" && Array.isArray(content.blocks)) {
            if (cancelled) return;
            setBlocks(content.blocks);
            setSourceTitle(content.title);
            const at = content.blocks.findIndex((b: SourceBlock) =>
              locator
                ? b.id === locator
                : Boolean(quote && b.content.includes(quote.slice(0, 70))),
            );
            setBlockOffset(Math.max(0, at));
            setStatus("ready");
            return;
          }
        }
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();

        const response = await fetch(`/api/documents/${documentId}`);
        if (!response.ok) {
          throw new Error("download");
        }
        const data = await response.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data }).promise;
        if (cancelled) {
          return;
        }
        pdfRef.current = pdf;
        setNumPages(pdf.numPages);
        const startPage = Math.min(
          Math.max(page && page > 0 ? page : 1, 1),
          pdf.numPages,
        );
        setCurrentPage(startPage);
        await renderPage(pdfjs, pdf, startPage);
        if (!cancelled) {
          setStatus("ready");
        }
      } catch {
        if (!cancelled) {
          setStatus("error");
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function renderPage(pdfjs: any, pdf: any, pageNumber: number) {
    const pageObj = await pdf.getPage(pageNumber);
    const available = Math.max(
      220,
      (stageRef.current?.clientWidth ?? 800) - 32,
    );
    const scale = Math.min(
      1.4,
      available / pageObj.getViewport({ scale: 1 }).width,
    );
    const viewport = pageObj.getViewport({ scale });
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const context = canvas.getContext("2d");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await pageObj.render({ canvasContext: context, viewport }).promise;

    const tokens = quote ? quoteTokens(quote) : new Set<string>();
    if (tokens.size === 0) {
      setHighlights([]);
      return;
    }

    const textContent = await pageObj.getTextContent();
    const rects: Highlight[] = [];
    const searchPhraseTokens = quote
      ? quoteTokens(pdfSearchPhrase(quote))
      : new Set<string>();
    const relevantTokens =
      searchPhraseTokens.size >= 3 ? searchPhraseTokens : tokens;

    for (const item of textContent.items) {
      const str: string = item.str ?? "";
      if (!str.trim()) {
        continue;
      }
      const normalized = normalizeQuoteText(str);
      const matches = Array.from(relevantTokens).some((token) =>
        normalized.includes(token),
      );
      if (!matches) {
        continue;
      }
      const tx = pdfjs.Util.transform(viewport.transform, item.transform);
      const fontHeight = Math.hypot(tx[2], tx[3]);
      rects.push({
        left: tx[4],
        top: tx[5] - fontHeight,
        width: (item.width ?? 0) * scale,
        height: fontHeight,
      });
    }
    setHighlights(rects);
  }

  async function goTo(pageNumber: number) {
    const pdf = pdfRef.current;
    if (!pdf || pageNumber < 1 || pageNumber > numPages) {
      return;
    }
    const pdfjs = await import("pdfjs-dist");
    setCurrentPage(pageNumber);
    await renderPage(pdfjs, pdf, pageNumber);
  }

  const searchPhrase = pdfSearchPhrase(quote);
  const hashParts = [
    page && page > 0 ? `page=${page}` : "",
    searchPhrase ? `search=${encodeURIComponent(searchPhrase)}` : "",
  ].filter(Boolean);
  const fallbackHref = `/api/documents/${documentId}${hashParts.length ? `#${hashParts.join("&")}` : ""}`;

  return (
    <Dialog.Root modal={!sidePanel} open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="secondaryButton compactButton" type="button">
          <FileSearch size={15} />
          {label}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        {!sidePanel ? <Dialog.Overlay className="dialogOverlay" /> : null}
        <Dialog.Content
          className={`pdfViewerContent${sidePanel ? " searchPdfPanel" : ""}`}
          aria-describedby={undefined}
        >
          <div className="pdfViewerBar">
            <Dialog.Title>
              {sidePanel ? "Lectura del documento" : "Cita en el documento"}
            </Dialog.Title>
            <div className="pdfViewerControls">
              <button
                className="iconButton"
                aria-label="Página anterior"
                disabled={
                  blocks.length > 0 || status !== "ready" || currentPage <= 1
                }
                onClick={() => goTo(currentPage - 1)}
                type="button"
              >
                <ChevronLeft size={16} />
              </button>
              <span>
                {blocks.length
                  ? "Lectura por bloques"
                  : status === "ready"
                    ? `${currentPage} / ${numPages}`
                    : "Cargando…"}
              </span>
              <button
                className="iconButton"
                aria-label="Página siguiente"
                disabled={
                  blocks.length > 0 ||
                  status !== "ready" ||
                  currentPage >= numPages
                }
                onClick={() => goTo(currentPage + 1)}
                type="button"
              >
                <ChevronRight size={16} />
              </button>
              <a
                className="secondaryButton compactButton"
                href={fallbackHref}
                rel="noreferrer"
                target="_blank"
              >
                <ExternalLink size={15} />
                Original
              </a>
              <Dialog.Close asChild>
                <button
                  className="iconButton"
                  type="button"
                  aria-label="Cerrar documento"
                >
                  <X size={16} />
                </button>
              </Dialog.Close>
            </div>
          </div>

          <div ref={stageRef} className="pdfViewerStage">
            {sourceInfo?<div className="tw px-4"><DocumentFacts document={sourceInfo}/><FollowSource documentId={documentId} label={sourceTitle||'Documento consultado'}/><GuidedReading documentId={documentId} page={blocks.length?undefined:currentPage} sha256={sourceInfo.sha256}/></div>:null}
            {blocks.length ? (
              <section
                className="tw sourceBlockReader space-y-4 p-4"
                aria-label="Texto del original"
              >
                <p className="text-sm text-slate-600">
                  {sourceTitle} · Referencias por bloque, sin páginas físicas.
                </p>
                <p className="text-xs text-slate-600">La numeración de bloques y tablas permite localizar el texto extraído. El diseño y las imágenes se consultan en el original.</p>
                <label className="grid gap-2 text-sm font-semibold">Buscar dentro del documento<input className="rounded-lg border border-slate-300 p-3 font-normal" value={blockQuery} onChange={e=>{setBlockQuery(e.target.value);setBlockOffset(0);}} placeholder="Escribe una palabra del contenido"/></label>
                <p className="text-xs text-slate-600">{matchingBlocks.length} bloques{blockQuery?" con coincidencias":" disponibles"}</p>
                {matchingBlocks.slice(blockOffset, blockOffset + 30).map((b) => (
                  <article
                    id={b.id}
                    key={b.id}
                    className="rounded-xl border border-slate-200 bg-white p-4"
                  >
                    <strong className="text-sm text-teal-800">{b.label}</strong>
                    <p className="my-3 whitespace-pre-wrap text-sm leading-7">
                      {b.content}
                    </p>
                    <SaveButton
                      itemType="documento"
                      title={sourceTitle.slice(0,300)}
                      documentId={documentId}
                      locator={b.id}
                      label="Guardar pasaje"
                    />
                    <GuidedReading documentId={documentId} locator={b.id} sha256={sourceInfo?.sha256}/>
                  </article>
                ))}
                <div className="flex flex-wrap gap-3">
                  <button
                    className="secondaryButton"
                    disabled={blockOffset === 0}
                    onClick={() =>
                      setBlockOffset(Math.max(0, blockOffset - 30))
                    }
                  >
                    Bloques anteriores
                  </button>
                  <button
                    className="secondaryButton"
                    disabled={blockOffset + 30 >= matchingBlocks.length}
                    onClick={() => setBlockOffset(blockOffset + 30)}
                  >
                    Más bloques
                  </button>
                </div>
              </section>
            ) : null}
            {status === "loading" ? (
              <div className="emptyState">
                <LoaderCircle size={20} />
                <span>Cargando documento...</span>
              </div>
            ) : null}
            {status === "error" ? (
              <div className="emptyState">
                <span>No se pudo mostrar el documento. Puedes abrir el original.</span>
                <a
                  className="primaryButton"
                  href={fallbackHref}
                  rel="noreferrer"
                  target="_blank"
                >
                  Descargar original
                </a>
              </div>
            ) : null}
            <div
              className="pdfCanvasWrap"
              style={{
                display:
                  status === "ready" && !blocks.length ? "block" : "none",
              }}
            >
              <canvas ref={canvasRef} />
              {highlights.map((rect, index) => (
                <span
                  className="pdfHighlight"
                  key={index}
                  style={{
                    left: rect.left,
                    top: rect.top,
                    width: rect.width,
                    height: rect.height,
                  }}
                />
              ))}
              {status === "ready" && highlights.length === 0 && quote ? (
                <span className="pdfHint">
                  No se pudo resaltar texto exacto; revise la pagina indicada.
                </span>
              ) : null}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
