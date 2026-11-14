"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { letraSchema, type IntentoBalotario, type Letra } from "@/lib/balotarios-policy";

type Pendiente = { questionId: string; option: Letra | null; flagged: boolean; position: number };
type Respuesta = { attempt: IntentoBalotario; serverNow: string };
export function useBalotario(owner: string) {
  const [active, setActive] = useState<IntentoBalotario | null>(null);
  const [history, setHistory] = useState<IntentoBalotario[]>([]);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingView, setPendingView] = useState<Record<string, Pendiente>>({});
  const [clockOffset, setClockOffset] = useState(0);
  const current = useRef<IntentoBalotario | null>(null);
  const pending = useRef<Record<string, Pendiente>>({});
  const syncing = useRef(false);
  const positionPending = useRef(false);
  const key = `ace:balotarios:v2:${owner}`;
  const backup = useCallback(() => {
    try { localStorage.setItem(key, JSON.stringify({ id: current.current?.id, pending: pending.current, position: current.current?.position, positionPending: positionPending.current })); }
    catch { setError("No se pudo crear el respaldo local. Mantén esta página abierta hasta guardar."); }
    setPendingCount(Object.keys(pending.current).length + Number(positionPending.current));
    setPendingView({ ...pending.current });
  }, [key]);
  const accept = useCallback((t: IntentoBalotario | null) => {
    current.current = t;
    setActive(t);
    if (t?.state === "submitted") {
      pending.current = {};
      positionPending.current = false;
      setPendingCount(0);
      setPendingView({});
      setHistory(h => [t, ...h.filter(x => x.id !== t.id)]);
      try { localStorage.removeItem(key); } catch { /* el respaldo solo contiene cambios ya entregados */ }
    }
  }, [key]);
  const request = useCallback(async <T,>(url: string, body?: unknown): Promise<T> => {
    let r: Response;
    try {
      r = await fetch(url, { method: body ? "POST" : "GET", cache: "no-store", signal: AbortSignal.timeout(15000), headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    } catch {
      throw new Error("No se pudo conectar a tiempo. Tus cambios pendientes siguen en este dispositivo; reintenta la sincronización.");
    }
    const x = await r.json();
    if (!r.ok) throw new Error(x.error ?? "No se pudo conectar. Tus cambios pendientes siguen en este dispositivo.");
    return x as T;
  }, []);
  const reload = useCallback(async () => {
    try {
      const x = await request<{ active: IntentoBalotario | null; history: IntentoBalotario[]; serverNow: string }>("/api/balotarios");
      setClockOffset(Date.parse(x.serverNow) - Date.now());
      setHistory(x.history);
      let position: number | undefined;
      try {
        const old = JSON.parse(localStorage.getItem(key) ?? "null");
        if (old?.id === x.active?.id) {
          const safe: Record<string, Pendiente> = {};
          for (const [id, v] of Object.entries(old.pending ?? {})) {
            const p = v as Pendiente;
            if (x.active?.questions.some(q => q.id === id) && (p.option === null || letraSchema.safeParse(p.option).success) && typeof p.flagged === "boolean") safe[id] = { ...p, questionId: id, position: Math.max(0, Math.min(71, Number(p.position) || 0)) };
          }
          pending.current = safe;
          positionPending.current = old.positionPending === true;
          if (Number.isInteger(old.position)) position = Math.max(0, Math.min(71, old.position));
        } else { pending.current = {}; positionPending.current = false; }
      } catch { pending.current = {}; positionPending.current = false; }
      accept(x.active ? { ...x.active, position: position ?? x.active.position } : null);
      setPendingCount(Object.keys(pending.current).length + Number(positionPending.current));
      setPendingView({ ...pending.current });
      setReady(true);
      setError("");
    } catch (e) { setError((e as Error).message); }
  }, [accept, key, request]);
  const sync = useCallback(async () => {
    if (syncing.current || !current.current || current.current.state !== "active") return;
    syncing.current = true;
    setSaving(true);
    try {
      while ((Object.keys(pending.current).length || positionPending.current) && current.current?.state === "active") {
        const p = Object.values(pending.current)[0];
        const sentPosition = current.current.position;
        const command = p ? { action: "save", id: current.current.id, revision: current.current.revision, ...p } : { action: "position", id: current.current.id, revision: current.current.revision, position: sentPosition };
        const response = await request<Respuesta>("/api/balotarios", command);
        if (p && pending.current[p.questionId] === p) delete pending.current[p.questionId];
        if (!p && current.current.position === sentPosition) positionPending.current = false;
        const localPosition = current.current.position;
        accept({ ...response.attempt, position: localPosition });
        setClockOffset(Date.parse(response.serverNow) - Date.now());
        backup();
      }
      setError("");
    } catch (e) {
      setError((e as Error).message);
      // Recupera la revisión remota sin descartar los cambios locales pendientes.
      try {
        const x = await request<{ active: IntentoBalotario | null; history: IntentoBalotario[]; serverNow: string }>("/api/balotarios");
        setHistory(x.history);
        if (x.active) accept({ ...x.active, position: current.current?.position ?? x.active.position });
        else if (current.current) {
          const done = x.history.find(t => t.id === current.current?.id);
          if (done) { const detail = await request<Respuesta>(`/api/balotarios?id=${encodeURIComponent(done.id)}`); accept(detail.attempt); }
        }
      } catch { /* se muestra el error original y se conserva el respaldo */ }
      backup();
      throw e;
    } finally { syncing.current = false; setSaving(false); }
  }, [accept, backup, request]);
  useEffect(() => {
    let disposed = false;
    void Promise.resolve().then(reload).then(() => { if (!disposed) void sync().catch(() => {}); });
    const online = () => { void reload().then(() => sync()).catch(() => {}); };
    const visible = () => { if (document.visibilityState === "visible" && !syncing.current) online(); };
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", visible);
    return () => { disposed = true; window.removeEventListener("online", online); document.removeEventListener("visibilitychange", visible); };
  }, [reload, sync]);
  useEffect(() => {
    const unload = (e: BeforeUnloadEvent) => {
      if (Object.keys(pending.current).length || positionPending.current) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", unload);
    return () => window.removeEventListener("beforeunload", unload);
  }, []);
  async function start(balotario: number) {
    setSaving(true);
    try {
      const x = await request<Respuesta>("/api/balotarios", { action: "start", balotario });
      pending.current = {}; positionPending.current = false; accept(x.attempt); backup(); setClockOffset(Date.parse(x.serverNow) - Date.now()); setError("");
    } catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  }
  function change(p: Pendiente) {
    if (!current.current || current.current.state !== "active") return;
    pending.current[p.questionId] = p;
    current.current = { ...current.current, position: p.position };
    setActive(current.current); backup();
    void sync().catch(() => {});
  }
  function position(pos: number) {
    if (!current.current) return;
    accept({ ...current.current, position: pos }); positionPending.current = true; backup();
    void sync().catch(() => {});
  }
  async function submit() {
    if (syncing.current) return false;
    try {
      await sync();
      if (!current.current || current.current.state === "submitted") return true;
      setSaving(true);
      const x = await request<Respuesta>("/api/balotarios", { action: "submit", id: current.current.id, revision: current.current.revision });
      accept(x.attempt); setError(""); return true;
    } catch (e) { setError((e as Error).message); return false; }
    finally { setSaving(false); }
  }
  const answers = { ...(active?.answers ?? {}) };
  const flagged = new Set(active?.flagged ?? []);
  for (const p of Object.values(pendingView)) {
    if (p.option) answers[p.questionId] = p.option; else delete answers[p.questionId];
    if (p.flagged) flagged.add(p.questionId); else flagged.delete(p.questionId);
  }
  return { active, history, answers, flagged, ready, saving, pendingCount, error, clockOffset, start, change, position, submit, reload,
    newExam: () => { if (current.current?.state === "submitted") accept(null); },
    retry: () => sync().catch(() => {}) };
}
