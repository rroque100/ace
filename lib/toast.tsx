"use client";

import { createContext, useContext, useReducer, useCallback, useMemo, ReactNode } from "react";
import { X, CheckCircle2, AlertCircle, Info, Loader2 } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info" | "loading";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: { label: string; onClick: () => void };
  dismissible?: boolean;
}

interface ToastState {
  toasts: Toast[];
}

type ToastAction =
  | { type: "ADD"; payload: Toast }
  | { type: "REMOVE"; payload: string }
  | { type: "CLEAR" };

function reducer(state: ToastState, action: ToastAction): ToastState {
  switch (action.type) {
    case "ADD":
      return { toasts: [...state.toasts, action.payload] };
    case "REMOVE":
      return { toasts: state.toasts.filter((t) => t.id !== action.payload) };
    case "CLEAR":
      return { toasts: [] };
    default:
      return state;
  }
}

const ToastContext = createContext<{
  toasts: Toast[];
  toast: (toast: Omit<Toast, "id">) => string;
  dismiss: (id: string) => void;
  clear: () => void;
} | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { toasts: [] });

  const toast = useCallback((toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2, 10);
    const newToast: Toast = { ...toast, id };
    dispatch({ type: "ADD", payload: newToast });

    if (toast.duration !== 0 && toast.type !== "loading") {
      setTimeout(() => dispatch({ type: "REMOVE", payload: id }), toast.duration ?? 5000);
    }
    return id;
  }, []);

  const dismiss = useCallback((id: string) => dispatch({ type: "REMOVE", payload: id }), []);
  const clear = useCallback(() => dispatch({ type: "CLEAR" }), []);

  const value = useMemo(() => ({ toasts: state.toasts, toast, dismiss, clear }), [state.toasts, toast, dismiss, clear]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const icons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 size={18} />,
  error: <AlertCircle size={18} />,
  warning: <AlertCircle size={18} />,
  info: <Info size={18} />,
  loading: <Loader2 size={18} className="expSpin" />,
};

const colors: Record<ToastType, { bg: string; fg: string; border: string }> = {
  success: { bg: "#f0fdf4", fg: "#166534", border: "#86efac" },
  error: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
  warning: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
  info: { bg: "#eff6ff", fg: "#1e40af", border: "#93c5fd" },
  loading: { bg: "#f8fafc", fg: "#475569", border: "#cbd5e1" },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const { bg, fg, border } = colors[toast.type];
  const dismissible = toast.dismissible !== false;

  return (
    <div
      role={toast.type === "error" ? "alert" : "status"}
      aria-live={toast.type === "error" ? "assertive" : "polite"}
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 10,
        padding: "12px 14px",
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        minWidth: 280,
        maxWidth: 420,
        boxShadow: "0 10px 30px rgba(15,23,42,0.1)",
        animation: "toastIn 0.2s ease-out",
      }}
    >
      <span style={{ color: fg, flexShrink: 0, marginTop: 1 }}>{icons[toast.type]}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, color: fg, fontSize: 14 }}>{toast.title}</div>
        {toast.message && <div style={{ color: fg, fontSize: 13, marginTop: 2, opacity: 0.9 }}>{toast.message}</div>}
        {toast.action && (
          <button
            onClick={() => { toast.action!.onClick(); onDismiss(toast.id); }}
            style={{
              marginTop: 8,
              padding: "4px 10px",
              fontSize: 12,
              fontWeight: 600,
              color: fg,
              background: "transparent",
              border: `1px solid ${border}`,
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            {toast.action.label}
          </button>
        )}
      </div>
      {dismissible && (
        <button
          onClick={() => onDismiss(toast.id)}
          style={{
            background: "transparent",
            border: 0,
            color: fg,
            opacity: 0.5,
            cursor: "pointer",
            padding: 2,
            lineHeight: 1,
            flexShrink: 0,
          }}
          aria-label="Cerrar"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export function ToastContainer() {
  const { toasts, dismiss } = useToast();

  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        pointerEvents: "none",
      }}
      aria-live="polite"
      aria-label="Notificaciones"
    >
      {toasts.map((t) => (
        <div key={t.id} style={{ pointerEvents: "auto" }}>
          <ToastItem toast={t} onDismiss={dismiss} />
        </div>
      ))}
      <style jsx>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(100%); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

// Convenience helpers
export function useToastHelpers() {
  const { toast, dismiss, clear } = useToast();

  return useMemo(
    () => ({
      success: (title: string, message?: string, opts?: Partial<Toast>) =>
        toast({ type: "success", title, message, ...opts }),
      error: (title: string, message?: string, opts?: Partial<Toast>) =>
        toast({ type: "error", title, message, duration: 8000, ...opts }),
      warning: (title: string, message?: string, opts?: Partial<Toast>) =>
        toast({ type: "warning", title, message, duration: 7000, ...opts }),
      info: (title: string, message?: string, opts?: Partial<Toast>) =>
        toast({ type: "info", title, message, ...opts }),
      loading: (title: string, message?: string) =>
        toast({ type: "loading", title, message, duration: 0 }),
      dismiss,
      clear,
    }),
    [toast, dismiss, clear]
  );
}