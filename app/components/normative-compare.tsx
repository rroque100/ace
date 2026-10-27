"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ExternalLink,
  GitCompare,
  LoaderCircle,
  Quote,
  RotateCcw,
} from "lucide-react";
import {
  DOCUMENT_TYPES,
  processTypeLabel,
} from "@/lib/legal-taxonomy";
import { processLabelFromOptions, useSettingsCatalog, withBlankProcessOption } from "./use-settings-catalog";

import {NormativeTextDiff} from "./normative-text-diff";
import type {compareDocumentTexts} from "@/lib/normative-text-comparison";

type CompareSource = {
  article: string | null;
  chunkId: string;
  chunkIndex: number;
  citation: string;
  documentId: string;
  documentTitle: string;
  documentType: string;
  evidenceQuality: number;
  excerpt: string;
  lexicalScore: number;
  matchType: "semantica" | "lexical" | "hibrida";
  pageStart: number | null;
  processType: string | null;
  score: number;
  semanticScore: number;
  sourceEntity: string | null;
  vigencia: string | null;
};

type Assessment = {
  confidence: "alta" | "media" | "baja";
  evidenceQuality: number;
  sufficient: boolean;
  topScore: number;
  uniqueDocuments: number;
};

type CompareResponse = {
  scopeNotice?:string;
  textComparison?:Awaited<ReturnType<typeof compareDocumentTexts>>;
  assessment?: { a: Assessment; b: Assessment; overall: "alta" | "media" | "baja" };
  comparisonId?: string | null;
  error?: string;
  labelA?: string;
  labelB?: string;
  model?: string;
  result?: string;
  sourcesA?: CompareSource[];
  sourcesB?: CompareSource[];
};

type SideState = {
  label: string;
  documentType: string;
  documentId: string;
  processType: string;
};

type DocumentOption = {
  id: string;
  title: string;
  document_type: string;
};

type SelectedReference = {
  number: number;
  side: "A" | "B";
  source: CompareSource;
};

const documentTypes = [{ label: "Todos", value: "" }, ...DOCUMENT_TYPES];

const exampleTopics = [
  "Requisitos de la comparacion de precios",
  "Impedimentos para contratar con el Estado",
  "Garantia de fiel cumplimiento",
];

function emptySide(label: string): SideState {
  return { documentId: "", documentType: "", label, processType: "" };
}

function confidenceClass(confidence?: "alta" | "media" | "baja") {
  if (confidence === "alta") {
    return "confidencePill high";
  }

  if (confidence === "media") {
    return "confidencePill medium";
  }

  return "confidencePill low";
}

function documentPdfUrl(source: Pick<CompareSource, "documentId" | "pageStart">) {
  return `/api/documents/${source.documentId}${source.pageStart ? `#page=${source.pageStart}` : ""}`;
}

function renderFormattedText(text: string) {
  const tokens = text.split(/(\*\*[^*]+\*\*|<u>.*?<\/u>)/g);

  return tokens.map((token, index) => {
    if (token.startsWith("**") && token.endsWith("**")) {
      return <strong key={`${token}-${index}`}>{token.slice(2, -2)}</strong>;
    }

    if (token.startsWith("<u>") && token.endsWith("</u>")) {
      return <u key={`${token}-${index}`}>{token.slice(3, -4)}</u>;
    }

    return <span key={`${token}-${index}`}>{token}</span>;
  });
}

function renderInlineWithSources(
  text: string,
  resolve: (side: "A" | "B", number: number) => CompareSource | undefined,
  onOpenSource: (reference: SelectedReference) => void,
) {
  const parts = text.split(/((?:\s*\[[AB]\d+\])+)/g).filter((part) => part !== undefined && part !== "");
  const nodes: React.ReactNode[] = [];

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    const matches = Array.from(part.matchAll(/\[([AB])(\d+)\]/g));

    if (matches.length > 0 && part.replace(/\s|\[[AB]\d+\]/g, "") === "") {
      for (let matchIndex = 0; matchIndex < matches.length; matchIndex += 1) {
        const match = matches[matchIndex];
        const side = match[1] as "A" | "B";
        const sourceNumber = Number(match[2]);
        const source = resolve(side, sourceNumber);

        if (source) {
          nodes.push(
            <button
              aria-label={`Abrir fuente ${side}${sourceNumber}`}
              className="sourceRefButton"
              key={`ref-${index}-${matchIndex}`}
              onClick={() => onOpenSource({ number: sourceNumber, side, source })}
              type="button"
            >
              {side}
              {sourceNumber}
            </button>,
          );
        } else {
          nodes.push(
            <span
              className="sourceRefMissing"
              key={`missing-${index}-${matchIndex}`}
              title="Fuente citada no encontrada entre las fuentes recuperadas"
            >
              {side}
              {sourceNumber}?
            </span>,
          );
        }
      }

      continue;
    }

    nodes.push(...renderFormattedText(part));
  }

  return nodes;
}

function ComparisonContent({
  content,
  onOpenSource,
  resolve,
}: {
  content: string;
  onOpenSource: (reference: SelectedReference) => void;
  resolve: (side: "A" | "B", number: number) => CompareSource | undefined;
}) {
  const lines = content.split(/\n+/).map((line) => line.trim()).filter(Boolean);

  return (
    <div className="answerContent">
      {lines.map((line, index) => {
        const heading = line.match(/^\*\*(.+)\*\*$/);

        if (heading) {
          return <h3 key={`${line}-${index}`}>{heading[1]}</h3>;
        }

        if (/^[-*]\s+/.test(line)) {
          return (
            <div className="answerBullet" key={`${line}-${index}`}>
              <span aria-hidden="true">•</span>
              <p>{renderInlineWithSources(line.replace(/^[-*]\s+/, ""), resolve, onOpenSource)}</p>
            </div>
          );
        }

        return <p key={`${line}-${index}`}>{renderInlineWithSources(line, resolve, onOpenSource)}</p>;
      })}
    </div>
  );
}

function SideEditor({
  documents,
  onChange,
  processTypes,
  side,
  title,
  value,
}: {
  documents: DocumentOption[];
  onChange: (next: SideState) => void;
  processTypes: Array<{ label: string; value: string }>;
  side: "A" | "B";
  title: string;
  value: SideState;
}) {
  return (
    <div className="compareSide">
      <div className="compareSideHeader">
        <span>Lado {side}</span>
        <strong>{title}</strong>
      </div>
      <label>
        <span>Etiqueta (opcional)</span>
        <input
          onChange={(event) => onChange({ ...value, label: event.target.value })}
          placeholder={side === "A" ? "Ej. Ley 32069" : "Ej. Reglamento"}
          value={value.label}
        />
      </label>
      <label>
        <span>Tipo documental</span>
        <select onChange={(event) => onChange({ ...value, documentType: event.target.value })} value={value.documentType}>
          {documentTypes.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Tipo de proceso</span>
        <select onChange={(event) => onChange({ ...value, processType: event.target.value })} value={value.processType}>
          {processTypes.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Documento especifico (opcional)</span>
        <select onChange={(event) => onChange({ ...value, documentId: event.target.value })} value={value.documentId}>
          <option value="">Cualquiera del alcance</option>{value.documentId && !documents.some(item=>item.id===value.documentId)?<option value={value.documentId}>Documento seleccionado · {value.documentId}</option>:null}
          {documents.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function EvidencePanel({
  assessment,
  side,
  sources,
  title,
}: {
  assessment?: Assessment;
  side: "A" | "B";
  sources: CompareSource[];
  title?: string;
}) {
  return (
    <div className="compareSide">
      <div className="compareSideHeader">
        <span>Evidencia {side}</span>
        <strong>{title ?? `Lado ${side}`}</strong>
      </div>
      {assessment ? (
        <div className="evidenceMini">
          <span className={confidenceClass(assessment.confidence)}>Confianza {assessment.confidence}</span>
          <small>
            {assessment.uniqueDocuments} documento(s) · score {assessment.topScore.toFixed(3)} · calidad{" "}
            {assessment.evidenceQuality.toFixed(2)}
          </small>
        </div>
      ) : null}
      {sources.length === 0 ? (
        <p className="sideMuted">Sin fuentes recuperadas para este lado.</p>
      ) : (
        sources.map((source, index) => (
          <details key={source.chunkId}>
            <summary>
              {side}
              {index + 1} · {source.documentType} · calidad {source.evidenceQuality.toFixed(2)}
            </summary>
            <strong>{source.citation || `Fragmento ${source.chunkIndex + 1}`}</strong>
            <p>{source.excerpt}</p>
            <a className="sourceLink" href={documentPdfUrl(source)} rel="noreferrer" target="_blank">
              <ExternalLink size={14} />
              {source.pageStart ? `Abrir pagina ${source.pageStart}` : "Abrir PDF"}
            </a>
          </details>
        ))
      )}
    </div>
  );
}

export function NormativeCompare() {
  const searchParams = useSearchParams();
  const { processTypes: configuredProcessTypes } = useSettingsCatalog();
  const processTypes = withBlankProcessOption(configuredProcessTypes);
  const labelProcessType = (value?: string | null) =>
    processLabelFromOptions(configuredProcessTypes, value) ?? processTypeLabel(value);
  const [documents, setDocuments] = useState<DocumentOption[]>([]);
  const [sideA, setSideA] = useState<SideState>({
    ...emptySide("Ley 32069"),
    documentId: searchParams.get("documentIdA") ?? "",
    documentType: searchParams.get("documentTypeA") ?? "",
    processType: searchParams.get("processType") ?? "",
  });
  const [sideB, setSideB] = useState<SideState>({
    ...emptySide("Reglamento"),
    documentId: searchParams.get("documentIdB") ?? "",
    documentType: searchParams.get("documentTypeB") ?? "",
    processType: searchParams.get("processType") ?? "",
  });
  const [topic, setTopic] = useState(searchParams.get("topic") ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [response, setResponse] = useState<CompareResponse | null>(null);
  const [selectedReference, setSelectedReference] = useState<SelectedReference | null>(null);

  const sourcesA = useMemo(() => response?.sourcesA ?? [], [response]);
  const sourcesB = useMemo(() => response?.sourcesB ?? [], [response]);
  const [comparisonKind,setComparisonKind]=useState<"tema"|"texto">(searchParams.get("comparison")==="texto"?"texto":"tema");
  const canSubmit = !loading && (comparisonKind==="texto"?Boolean(sideA.documentId&&sideB.documentId&&sideA.documentId!==sideB.documentId):topic.trim().length>=5);

  useEffect(() => {
    // Carga los documentos para poblar los selectores de documento especifico.
    void (async () => {
      try {
        const result = await fetch("/api/documents", { cache: "no-store" });
        const payload = (await result.json()) as { documents?: DocumentOption[] };
        const initial = payload.documents ?? [];
        const selectedIds = [...new Set([searchParams.get("documentIdA"), searchParams.get("documentIdB")].filter((id): id is string => Boolean(id)))];
        const selected = await Promise.all(selectedIds.filter(id=>!initial.some(doc=>doc.id===id)).map(async id=>{
          const response=await fetch(`/api/norms/${encodeURIComponent(id)}`,{cache:"no-store"});
          if(!response.ok)throw Error("No se pudo comprobar uno de los documentos seleccionados.");
          const detail=await response.json() as {norm:{id:string;title:string;documentType:string}};
          return {id:detail.norm.id,title:detail.norm.title,document_type:detail.norm.documentType};
        }));
        setDocuments([...selected,...initial]);
      } catch {
        setDocuments([]);
        setError("No se pudieron cargar los nombres de los documentos. Se conservan los identificadores seleccionados; vuelve a abrir la comparación para comprobarlos.");
      }
    })();
  }, [searchParams]);

  function resolveSource(side: "A" | "B", number: number) {
    const list = side === "A" ? sourcesA : sourcesB;
    return list[number - 1];
  }

  async function submitComparison(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedTopic = comparisonKind==="texto"?"Comparación del texto indexado completo":topic.trim();

    if (normalizedTopic.length < 5) {
      setError("Escribe un tema mas especifico para comparar.");
      return;
    }

    setError("");
    setLoading(true);
    setResponse(null);

    try {
      const result = await fetch("/api/compare", {
        body: JSON.stringify({ sideA, sideB, topic: normalizedTopic,mode:comparisonKind }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await result.json()) as CompareResponse;

      if (!result.ok) {
        setError(payload.error ?? "No se pudo generar la comparacion.");
        return;
      }

      setResponse(payload);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  function resetComparison() {
    setError("");
    setResponse(null);
    setTopic("");
    setSideA(emptySide("Ley 32069"));
    setSideB(emptySide("Reglamento"));
  }

  return (
    <div className="toolPanel">
      <div className="toolPanelHeader">
        <div>
          <p className="eyebrow">Comparacion normativa</p>
          <h2>Contrastar dos normas con fuentes</h2>
        </div>
        <GitCompare size={22} />
      </div>

      <form className="toolBody" onSubmit={submitComparison}>
        <label>Tipo de comparación<select disabled={loading} value={comparisonKind} onChange={e=>{setComparisonKind(e.target.value as "tema"|"texto");setResponse(null);}}><option value="tema">Temática con IA · selección de pasajes</option><option value="texto">Todo el texto indexado · sin IA</option></select></label>
        <p>{comparisonKind==="texto"?"Selecciona dos documentos exactos. Se comparará todo su texto indexado disponible, sin certificar que la extracción cubra el PDF completo.":"La IA compara pasajes relacionados con un tema. Puede omitir diferencias de otras partes del documento."}</p>
        <div className="compareColumns">
          <SideEditor documents={documents} onChange={setSideA} processTypes={processTypes} side="A" title="Norma A" value={sideA} />
          <SideEditor documents={documents} onChange={setSideB} processTypes={processTypes} side="B" title="Norma B" value={sideB} />
        </div>

        {comparisonKind==="tema" ? <div><label className="promptInput">
          <span>Tema a comparar</span>
          <textarea
            aria-label="Tema a comparar"
            onChange={(event) => setTopic(event.target.value)}
            placeholder="Ej. requisitos de la comparacion de precios"
            value={topic}
          />
        </label>

        <div className="exampleQuestions">
          {exampleTopics.map((item) => (
            <button key={item} onClick={() => setTopic(item)} type="button">
              {item}
            </button>
          ))}
        </div>

        </div> : null}
        <div className="formActions">
          <button className="secondaryButton" onClick={resetComparison} type="button">
            <RotateCcw size={17} />
            Limpiar
          </button>
          <button className="primaryButton" disabled={!canSubmit} type="submit">
            {loading ? <LoaderCircle size={18} /> : <GitCompare size={18} />}
            {loading ? "Comparando..." : "Comparar"}
          </button>
        </div>

        {error ? <p className="formMessage errorText">{error}</p> : null}
      </form>

      {loading ? (
        <div className="emptyState">
          <LoaderCircle size={20} />
          <span>{comparisonKind==="texto"?"Leyendo y comparando todo el texto indexado disponible…":"Recuperando pasajes y preparando la comparación temática…"}</span>
        </div>
      ) : null}

      {response?.textComparison ? <NormativeTextDiff key={`${response.textComparison.a.id}-${response.textComparison.b.id}`} data={response.textComparison}/> : null}
      {response?.scopeNotice ? <p role="status">{response.scopeNotice}</p> : null}
      {response?.result ? (
        <div className="documentList">
          <div className="listHeader">
            <div>
              <strong>Resultado de la comparacion</strong>
              <small>
                {response.labelA} vs {response.labelB}
              </small>
            </div>
            {response.assessment ? (
              <span className={confidenceClass(response.assessment.overall)}>
                Confianza {response.assessment.overall}
              </span>
            ) : null}
          </div>

          {response.assessment && !response.assessment.a.sufficient !== !response.assessment.b.sufficient ? (
            <div className="warningList">
              <AlertTriangle size={15} />
              <span>
                Cobertura asimetrica entre los dos lados: revisa el lado con menos evidencia antes de concluir.
              </span>
            </div>
          ) : null}

          <ComparisonContent content={response.result} onOpenSource={setSelectedReference} resolve={resolveSource} />

          <div className="compareColumns">
            <EvidencePanel assessment={response.assessment?.a} side="A" sources={sourcesA} title={response.labelA} />
            <EvidencePanel assessment={response.assessment?.b} side="B" sources={sourcesB} title={response.labelB} />
          </div>
        </div>
      ) : null}

      <Dialog.Root open={Boolean(selectedReference)} onOpenChange={(open) => !open && setSelectedReference(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialogOverlay" />
          <Dialog.Content className="sourceModal">
            <Dialog.Title>
              Fuente {selectedReference?.side}
              {selectedReference?.number}
            </Dialog.Title>
            <Dialog.Description>Verificacion documental de la afirmacion seleccionada.</Dialog.Description>
            {selectedReference ? (
              <div className="sourceModalBody">
                <article className="sourceModalReference">
                  <div className="sourceModalReferenceHeader">
                    <strong>
                      Lado {selectedReference.side} · Fuente {selectedReference.number}
                    </strong>
                    <span>{selectedReference.source.documentTitle}</span>
                  </div>
                  <div className="sourceModalMeta">
                    <span>{selectedReference.source.documentType}</span>
                    <span>{selectedReference.source.sourceEntity ?? "Sin entidad"}</span>
                    {labelProcessType(selectedReference.source.processType) ? (
                      <span>{labelProcessType(selectedReference.source.processType)}</span>
                    ) : null}
                    {selectedReference.source.vigencia ? <span>Vigencia {selectedReference.source.vigencia}</span> : null}
                    <span>Calidad {selectedReference.source.evidenceQuality.toFixed(2)}</span>
                  </div>
                  <strong>{selectedReference.source.citation}</strong>
                  <div className="sourceQuote">
                    <Quote size={17} />
                    <p>{selectedReference.source.excerpt}</p>
                  </div>
                  <a
                    className="secondaryButton compactButton"
                    href={documentPdfUrl(selectedReference.source)}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <ExternalLink size={15} />
                    {selectedReference.source.pageStart
                      ? `Abrir PDF en pagina ${selectedReference.source.pageStart}`
                      : "Abrir PDF"}
                  </a>
                </article>
                <div className="dialogActions">
                  <Dialog.Close className="primaryButton" type="button">
                    Entendido
                  </Dialog.Close>
                </div>
              </div>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
