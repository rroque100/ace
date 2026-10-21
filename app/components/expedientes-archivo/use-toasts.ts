"use client";

import { useCallback, useRef, useState } from "react";

export type Toast = {
  id: number;
  message: string;
  kind: "success" | "error" | "warning" | "info";
};

export type ConfirmDialog = {
  title: string;
  message: string;
  variant: "danger" | "warning";
  onConfirm: () => void | Promise<void>;
};

// Gestión de avisos efímeros (toasts) y del diálogo de confirmación del
// workspace de expedientes. Extraído del componente monolítico para aislar el
// estado de notificaciones de la lógica de negocio.
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirm, setConfirm] = useState<ConfirmDialog | null>(null);
  // Contador estable para IDs de toast (evita Date.now()/Math.random() impuros).
  const toastIdRef = useRef(0);

  const showToast = useCallback((message: string, kind: Toast["kind"] = "info") => {
    const id = (toastIdRef.current += 1);
    setToasts((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showConfirm = useCallback((dialog: ConfirmDialog) => {
    setConfirm(dialog);
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirm(null);
  }, []);

  return { toasts, showToast, dismissToast, confirm, showConfirm, closeConfirm };
}
