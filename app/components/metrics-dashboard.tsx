"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FileText,
  FolderTree,
  Layers,
  LoaderCircle,
  MessageSquare,
  Play,
  RefreshCw,
  Users,
  ShieldCheck,
} from "lucide-react";

type Metrics = {
  documents: { total: number; uploaded: number; processing: number; indexed: number; error: number };
  stuck: number;
  chunks: number;
  articulos: number;
  summaries: number;
  concordancias: number;
  chat_sessions: number;
  chat_messages: number;
  boletin: number;
  seguimientos: number;
  guardados: number;
  eval_preguntas: number;
  eval_corridas: number;
  users: { total: number; admins: number; editors: number; users: number };
};
type DocError = { id: string; title: string; error_message: string | null; updated_at: string };
type Activity = {
  id: string;
  action: string;
  entity_type: string;
  details: Record<string, unknown>;
  created_at: string;
};
type VerificationCheck = {
  code: string;
  detail: string;
  label: string;
  pass: boolean;
};
type OperationalVerification = {
  checkedAt: string;
  ok: boolean;
  summary: { failed: number; passed: number; total: number };
  roles: {
    checks: VerificationCheck[];
    matrix: Array<{ allowedRoles: string[]; menu: string; requirement: string }>;
    missingRoles: string[];
    profilesByRole: Array<{ count: number; label: string; role: string }>;
    totalProfiles: number;
  };
  corpus: {
    corpusReady: boolean;
    criticalSearches: Array<{
      code: string;
      expected: string;
      pass: boolean;
      recovered: Array<{
        article: string | null;
        documentTitle: string;
        documentType: string;
        pageStart: number | null;
        processType: string | null;
        score: number;
      }>;
    }>;
    requirements: VerificationCheck[];
  };
  endToEnd: {
    checks: VerificationCheck[];
    latestIndexed: {
      pageCount: number | null;
      pineconeVerified: boolean;
      processType: string | null;
      title: string;
      type: string;
      updatedAt: string;
    } | null;
    searchPreview: Array<{
      article: string | null;
      documentTitle: string;
      documentType: string;
      pageStart: number | null;
      processType: string | null;
      score: number;
    }>;
  };
};
type UsageSummary = {
  actions: Array<{ action: string; count: number }>;
  chat: {
    assistantMessages: number;
    confidence: { alta: number; baja: number; media: number };
    feedback: { correct: number; incorrect: number; notes: number };
    userMessages: number;
  };
  days: Array<{ count: number; day: string }>;
  since: string;
};

function CheckList({ checks }: { checks: VerificationCheck[] }) {
  return (
    <div className="ruleList">
      {checks.map((check) => (
        <article className="ruleItem" data-tone={check.pass ? "ok" : "warn"} key={check.code}>
          <div>
            {check.pass ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
            <strong>{check.label}</strong>
            <span>{check.code}</span>
          </div>
          <small>{check.detail}</small>
        </article>
      ))}
    </div>
  );
}

export function MetricsDashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [errors, setErrors] = useState<DocError[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [draining, setDraining] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verification, setVerification] = useState<OperationalVerification | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);

  async function reload() {
    const [payload, usagePayload] = await Promise.all([
      fetch("/api/metrics").then((response) => response.json()),
      fetch("/api/usage").then((response) => response.json()).catch(() => null),
    ]);
    setMetrics(payload.metrics ?? null);
    setErrors(payload.recentErrors ?? []);
    setActivity(payload.recentActivity ?? []);
    setUsage(usagePayload?.chat ? usagePayload : null);
    setLoading(false);
  }

  useEffect(() => {
    // Initial sync with the metrics API when the dashboard mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, []);

  async function drain() {
    setDraining(true);
    setMessage(null);
    try {
      const summary = await fetch("/api/documents/drain", { method: "POST" }).then((response) => response.json());
      if (summary.error) {
        setMessage(summary.error);
      } else {
        setMessage(
          summary.scanned === 0
            ? "No hay documentos atascados."
            : `Procesados ${summary.processed}/${summary.scanned} (errores: ${summary.failed}).`,
        );
      }
      await reload();
    } finally {
      setDraining(false);
    }
  }

  async function runVerification() {
    setVerifying(true);
    setVerificationError(null);
    try {
      const response = await fetch("/api/system/verify", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        setVerificationError(payload.error ?? "No se pudo ejecutar la verificación.");
        return;
      }
      setVerification(payload);
    } catch {
      setVerificationError("No se pudo conectar con la verificación operativa.");
    } finally {
      setVerifying(false);
    }
  }

  if (loading) {
    return (
      <div className="emptyState">
        <span>Cargando...</span>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="emptyState">
        <AlertTriangle size={20} />
        <span>No se pudieron cargar las métricas.</span>
      </div>
    );
  }

  const cards = [
    { icon: FileText, label: "Documentos", value: metrics.documents.total, hint: `${metrics.documents.indexed} indexados` },
    { icon: Layers, label: "Chunks (Pinecone)", value: metrics.chunks, hint: `${metrics.articulos} artículos` },
    { icon: Database, label: "Resúmenes", value: metrics.summaries, hint: `${metrics.concordancias} concordancias` },
    { icon: MessageSquare, label: "Sesiones de chat", value: metrics.chat_sessions, hint: `${metrics.chat_messages} mensajes` },
    { icon: FolderTree, label: "Guardados", value: metrics.guardados, hint: `${metrics.seguimientos} seguimientos` },
    { icon: Users, label: "Usuarios", value: metrics.users.total, hint: `${metrics.users.admins} admin · ${metrics.users.editors} editor` },
  ];

  return (
    <div className="evalLayout">
      <div className="evalStats">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article className="statCard" key={card.label}>
              <Icon size={18} />
              <span className="statLabel">{card.label}</span>
              <strong>{card.value}</strong>
              <span className="statHint">{card.hint}</span>
            </article>
          );
        })}
      </div>

      <section className="toolPanel">
        <div className="toolPanelHeader">
          <div>
            <p className="mb-[7px] text-[11px] font-bold uppercase tracking-[0.09em] text-brand">Cola de indexación</p>
            <h2>Estado del pipeline</h2>
          </div>
          <div className="metricActions">
            <button className="secondaryButton compactButton" onClick={reload} type="button">
              <RefreshCw size={15} />
              Refrescar
            </button>
            <button className="primaryButton" disabled={draining} onClick={drain} type="button">
              {draining ? <LoaderCircle size={16} /> : <Play size={16} />}
              {draining ? "Drenando..." : "Drenar cola"}
            </button>
          </div>
        </div>
        <div className="indexPipeline">
          <span className="pipePill pipeUploaded">{metrics.documents.uploaded} en cola</span>
          <span className="pipePill pipeProcessing">{metrics.documents.processing} procesando</span>
          <span className="pipePill pipeIndexed">{metrics.documents.indexed} indexados</span>
          <span className="pipePill pipeError">{metrics.documents.error} con error</span>
          {metrics.stuck > 0 ? (
            <span className="pipePill pipeStuck">
              <AlertTriangle size={13} /> {metrics.stuck} atascados
            </span>
          ) : null}
        </div>
        {message ? <p className="metricMessage">{message}</p> : null}
      </section>

      <section className="toolPanel">
        <div className="toolPanelHeader">
          <div>
            <p className="mb-[7px] text-[11px] font-bold uppercase tracking-[0.09em] text-brand">Verificación operativa</p>
            <h2>{verification ? (verification.ok ? "Sistema verificado" : "Requiere atención") : "Roles, corpus y flujo end-to-end"}</h2>
          </div>
          <button className="primaryButton" disabled={verifying} onClick={runVerification} type="button">
            {verifying ? <LoaderCircle size={16} /> : <ShieldCheck size={16} />}
            {verifying ? "Verificando..." : "Ejecutar verificación"}
          </button>
        </div>
        <p className="metricMessage">
          Ejecuta una prueba autenticada como admin: revisa matriz de roles, corpus crítico
          (Reglamento y Directiva SIE) y un dry-run de búsqueda + chat sin guardar historial.
        </p>
        {verificationError ? <p className="evalError">{verificationError}</p> : null}
        {verification ? (
          <div className="operationalVerify">
            <div className="sourceCoverage">
              <span data-ready={verification.ok}>Resultado: {verification.ok ? "ok" : "pendiente"}</span>
              <span data-ready={verification.summary.failed === 0}>
                Checks: {verification.summary.passed}/{verification.summary.total}
              </span>
              <span data-ready={verification.corpus.corpusReady}>
                Corpus: {verification.corpus.corpusReady ? "listo" : "requiere ajustes"}
              </span>
              <span data-ready={verification.roles.missingRoles.length === 0}>
                Roles: {verification.roles.totalProfiles} usuario(s)
              </span>
            </div>

            <div className="verifyGrid">
              <section>
                <h3>Permisos por rol</h3>
                <CheckList checks={verification.roles.checks} />
                <div className="sourceMetaGrid">
                  {verification.roles.profilesByRole.map((role) => (
                    <span key={role.role}>
                      {role.label}: {role.count}
                    </span>
                  ))}
                </div>
                <div className="ruleList">
                  {verification.roles.matrix.map((item) => (
                    <article className="ruleItem" data-tone="ok" key={item.menu}>
                      <div>
                        <ShieldCheck size={17} />
                        <strong>{item.requirement}</strong>
                      </div>
                      <small>
                        {item.menu} · roles: {item.allowedRoles.join(", ")}
                      </small>
                    </article>
                  ))}
                </div>
              </section>

              <section>
                <h3>Flujo end-to-end</h3>
                <CheckList checks={verification.endToEnd.checks} />
                {verification.endToEnd.latestIndexed ? (
                  <div className="evidenceCard">
                    <strong>Último documento indexado</strong>
                    <span>{verification.endToEnd.latestIndexed.title}</span>
                    <small>
                      {verification.endToEnd.latestIndexed.type} · {verification.endToEnd.latestIndexed.pageCount ?? 0} página(s) · Pinecone{" "}
                      {verification.endToEnd.latestIndexed.pineconeVerified ? "verificado" : "pendiente"}
                    </small>
                  </div>
                ) : null}
              </section>
            </div>

            <section>
              <h3>Corpus crítico</h3>
              <CheckList checks={verification.corpus.requirements} />
              <div className="criticalSearchList">
                {verification.corpus.criticalSearches.map((item) => (
                  <article className="sourceCard" key={item.code}>
                    <strong>
                      {item.pass ? "OK" : "Falta"} · {item.expected}
                    </strong>
                    {item.recovered.map((source) => (
                      <span key={`${item.code}-${source.documentTitle}-${source.article}-${source.pageStart}`}>
                        {source.documentTitle} · {source.documentType}
                        {source.article ? ` · art. ${source.article}` : ""}
                        {source.pageStart ? ` · pág. ${source.pageStart}` : ""}
                      </span>
                    ))}
                  </article>
                ))}
              </div>
            </section>
          </div>
        ) : null}
      </section>

      <div className="evalGrid">
        <section className="toolPanel">
          <div className="toolPanelHeader">
            <div>
              <p className="mb-[7px] text-[11px] font-bold uppercase tracking-[0.09em] text-brand">Indexación</p>
              <h2>Documentos con error</h2>
            </div>
          </div>
          <div className="documentList">
            {errors.length === 0 ? (
              <div className="emptyState">
                <span>Sin documentos en error.</span>
              </div>
            ) : (
              errors.map((doc) => (
                <article className="evalResult" key={doc.id}>
                  <strong>{doc.title}</strong>
                  <p>{doc.error_message ?? "Error desconocido"}</p>
                  <span className="statHint">{new Date(doc.updated_at).toLocaleString("es-PE")}</span>
                </article>
              ))
            )}
          </div>
        </section>

        <aside className="toolPanel">
          <div className="toolPanelHeader">
            <div>
              <p className="mb-[7px] text-[11px] font-bold uppercase tracking-[0.09em] text-brand">Trazabilidad</p>
              <h2>Actividad reciente</h2>
            </div>
          </div>
          <div className="auditList">
            {activity.map((item) => (
              <div className="auditRow" key={item.id}>
                <span className="auditAction">{item.action}</span>
                <span className="auditMeta">{item.entity_type}</span>
                <span className="auditTime">{new Date(item.created_at).toLocaleString("es-PE")}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {usage ? (
        <section className="toolPanel">
          <div className="toolPanelHeader">
            <div>
              <p className="mb-[7px] text-[11px] font-bold uppercase tracking-[0.09em] text-brand">Uso del sistema</p>
              <h2>Señales de adopción y calidad</h2>
            </div>
            <button className="secondaryButton compactButton" onClick={reload} type="button">
              <RefreshCw size={15} />
              Actualizar uso
            </button>
          </div>
          <div className="sourceCoverage">
            <span data-ready={usage.chat.userMessages > 0}>Preguntas: {usage.chat.userMessages}</span>
            <span data-ready={usage.chat.assistantMessages > 0}>Respuestas: {usage.chat.assistantMessages}</span>
            <span data-ready={usage.chat.feedback.correct > 0}>Correctas: {usage.chat.feedback.correct}</span>
            <span data-ready={usage.chat.feedback.incorrect === 0}>Incorrectas: {usage.chat.feedback.incorrect}</span>
            <span data-ready={usage.chat.feedback.notes > 0}>Notas: {usage.chat.feedback.notes}</span>
            <span data-ready={usage.chat.confidence.baja === 0}>Baja confianza: {usage.chat.confidence.baja}</span>
          </div>
          <div className="verifyGrid">
            <section>
              <h3>Acciones frecuentes</h3>
              <div className="auditList">
                {usage.actions.map((item) => (
                  <div className="auditRow" key={item.action}>
                    <span className="auditAction">{item.action}</span>
                    <span className="auditMeta">{item.count}</span>
                  </div>
                ))}
              </div>
            </section>
            <section>
              <h3>Actividad diaria</h3>
              <div className="auditList">
                {usage.days.slice(-10).map((item) => (
                  <div className="auditRow" key={item.day}>
                    <span className="auditAction">{item.day}</span>
                    <span className="auditMeta">{item.count} evento(s)</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>
      ) : null}
    </div>
  );
}
