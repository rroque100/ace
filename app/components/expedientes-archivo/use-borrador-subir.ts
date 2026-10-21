"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BORRADOR_SUBIR_KEY,
  parsearBorradorSubir,
  tieneContenidoBorrador,
  type BorradorSubir,
} from "./borrador-subir";
import type { ExpedienteLegajoItem, SubirForm, WizardStep } from "./types";

const DEBOUNCE_MS = 1500;

export type EntradaBorrador = {
  form: SubirForm;
  wizardStep: WizardStep;
  legajo: ExpedienteLegajoItem | null;
  fileName: string | null;
  fileSize: number | null;
};

// Borrador del wizard de Subir en localStorage (TTL 24 h). Espejo del patrón
// de respuesta-borrador-v1: guardar con debounce, leer tras montar (nunca en
// el primer render, para no desincronizar SSR) y nunca romper la subida si el
// storage está lleno o bloqueado.
export function useBorradorSubir() {
  // Borrador pendiente de recuperar ( alimenta el banner). Null si no hay.
  const [borrador, setBorrador] = useState<BorradorSubir | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Último serializado escrito: evita writes redundantes (patrón de use-preferences).
  const lastWrittenRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(BORRADOR_SUBIR_KEY);
      const parsed = parsearBorradorSubir(raw);
      if (parsed) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setBorrador(parsed);
      }
    } catch {
      // localStorage inaccesible: sin borrador, sin drama.
    }
    // Solo en el montaje: la key es fija y no hay valores reactivos externos.
  }, []);

  const cancelarTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const escribir = useCallback((entrada: EntradaBorrador) => {
    const borrador: BorradorSubir = { ...entrada, savedAt: Date.now() };
    const serialized = JSON.stringify(borrador);
    if (serialized === lastWrittenRef.current) return;
    try {
      window.localStorage.setItem(BORRADOR_SUBIR_KEY, serialized);
      lastWrittenRef.current = serialized;
    } catch {
      // Cuota llena u storage bloqueado: el borrador es un plus, no un requisito.
    }
  }, []);

  // Programa el guardado con debounce. Un formulario sin contenido significativo
  // no es un borrador: no se escribe (y así no pisamos un borrador real con el
  // reset del formulario tras montar).
  const programarGuardado = useCallback(
    (entrada: EntradaBorrador) => {
      cancelarTimer();
      if (!tieneContenidoBorrador(entrada.form, entrada.legajo, entrada.wizardStep)) return;
      timerRef.current = setTimeout(() => escribir(entrada), DEBOUNCE_MS);
    },
    [cancelarTimer, escribir],
  );

  // Borra el borrador del storage (subida completada, cancelación, descarte).
  const limpiar = useCallback(() => {
    cancelarTimer();
    lastWrittenRef.current = null;
    try {
      window.localStorage.removeItem(BORRADOR_SUBIR_KEY);
    } catch {
      // Ignorar
    }
  }, [cancelarTimer]);

  // El usuario recuperó el borrador: se oculta el banner pero se CONSERVA en
  // storage — la siguiente pasada del auto-guardado lo mantiene coherente y,
  // si refresca antes de esa pasada, no pierde nada.
  const recuperar = useCallback(() => {
    setBorrador(null);
  }, []);

  const descartar = useCallback(() => {
    limpiar();
    setBorrador(null);
  }, [limpiar]);

  // Sin timer huérfano al desmontar.
  useEffect(() => cancelarTimer, [cancelarTimer]);

  return useMemo(
    () => ({ borrador, programarGuardado, recuperar, descartar, limpiar }),
    [borrador, programarGuardado, recuperar, descartar, limpiar],
  );
}
