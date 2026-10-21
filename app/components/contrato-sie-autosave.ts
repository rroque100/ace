"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Hook de autoguardado temporal en localStorage.
// Guarda el estado cada SAVE_INTERVAL_MS ms (si hubo cambios) y lo restaura
// al montar el componente. El borrador expira tras MAX_AGE_MS.
//
// Uso:
//   const { savedAt, restore, clear } = useAutoSave("contrato-sie-borrador", stateObject);

const SAVE_INTERVAL_MS = 3000;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

type SavedEntry<T> = { data: T; savedAt: number };

export function useAutoSave<T extends object>(key: string, data: T): {
  savedAt: number | null;
  restore: () => T | null;
  clear: () => void;
  hasRestored: boolean;
} {
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [hasRestored] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSnapshot = useRef<string>("");

  const serialize = useCallback(
    () => {
      try {
        return JSON.stringify(data);
      } catch {
        return "";
      }
    },
    [data],
  );

  const save = useCallback(
    () => {
      const snapshot = serialize();
      if (snapshot === lastSnapshot.current) return;
      lastSnapshot.current = snapshot;
      const entry: SavedEntry<T> = { data, savedAt: Date.now() };
      try {
        localStorage.setItem(key, JSON.stringify(entry));
        setSavedAt(entry.savedAt);
      } catch {
        // localStorage puede estar lleno o deshabilitado
      }
    },
    [key, data, serialize],
  );

  const restore = useCallback((): T | null => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const entry = JSON.parse(raw) as SavedEntry<T>;
      if (!entry || typeof entry.savedAt !== "number") return null;
      if (Date.now() - entry.savedAt > MAX_AGE_MS) {
        localStorage.removeItem(key);
        return null;
      }
      return entry.data;
    } catch {
      return null;
    }
  }, [key]);

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
    setSavedAt(null);
  }, [key]);

  // Debounced auto-save
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(save, SAVE_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [save]);

  // Save on unmount
  useEffect(() => {
    return () => {
      const snapshot = serialize();
      if (snapshot && snapshot !== lastSnapshot.current) {
        const entry: SavedEntry<T> = { data, savedAt: Date.now() };
        try {
          localStorage.setItem(key, JSON.stringify(entry));
        } catch {
          // ignore
        }
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { savedAt, restore, clear, hasRestored };
}