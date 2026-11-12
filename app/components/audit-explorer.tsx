"use client";

import { useCallback, useEffect, useState } from "react";
import { ScrollText, Search } from "lucide-react";
import { S } from "./audit-explorer-estilos";
import { C } from "@/app/components/estilos-comunes";

type AuditRow = {
  id: string;
  actor_reference: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

export function AuditExplorer() {
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [action, setAction] = useState("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (action) {
      params.set("action", action);
    }
    const payload = await fetch(`/api/audit?${params.toString()}`).then((response) => response.json());
    setLogs(payload.logs ?? []);
    if ((payload.actions ?? []).length > 0) {
      setActions(payload.actions);
    }
    setLoading(false);
  }, [action]);

  useEffect(() => {
    // Initial sync with the audit API when the explorer mounts or the action filter changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  return (
    <div className={C.evalLayout}>
      <div className={C.toolPanelHeader}>
        <div>
          <p className="mb-[7px] text-[11px] font-bold uppercase tracking-[0.09em] text-brand">Trazabilidad</p>
          <h2>Registro de auditoría</h2>
        </div>
        <label className={S.auditFilter}>
          <Search size={15} />
          <select onChange={(event) => setAction(event.target.value)} value={action}>
            <option value="">Todas las acciones</option>
            {actions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className={C.toolPanel}>
        <div className={C.auditList}>
          {loading ? (
            <div className={C.emptyState}>
              <span>Cargando...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className={C.emptyState}>
              <ScrollText size={20} />
              <span>Sin eventos de auditoría.</span>
            </div>
          ) : (
            logs.map((log) => (
              <div className="auditEntry" key={log.id}>
                <button
                  className={S.auditRow_auditRowButton}
                  onClick={() => setExpanded((current) => (current === log.id ? null : log.id))}
                  type="button"
                >
                  <span className={C.auditAction}>{log.action}</span>
                  <span className={C.auditMeta}>{log.entity_type}</span>
                  <span className={C.auditMeta}>{log.actor_reference ?? "system"}</span>
                  <span className={C.auditTime}>{new Date(log.created_at).toLocaleString("es-PE")}</span>
                </button>
                {expanded === log.id ? (
                  <pre className={S.auditDetails}>{JSON.stringify(log.details, null, 2)}</pre>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
