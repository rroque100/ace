"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { CaseContext } from "@/lib/chat-case-context";
import { CASE_PROFILE_PREFIX, caseProfileKey, mergeCaseProfiles, parseCaseProfile, parseCaseProfileValue, serializeCaseProfile, type CaseProfile } from "@/lib/case-profile";

// Perfil de caso del chat (ver lib/case-profile.ts). La copia de la CUENTA (/api/case-profile,
// docs/supabase/2026-11-10-perfil-caso-cuenta.sql) es la que viaja entre dispositivos; el
// localStorage queda como copia inmediata y de respaldo mientras la sincronización no está
// disponible (SQL sin ejecutar) o no hay red. Al abrir, gana el guardado más reciente.
//
// La copia local se lee con useSyncExternalStore: en el servidor no hay almacenamiento (la
// instantánea es null) y, al hidratar, el navegador lo lee sin desajustar el HTML del servidor.
// El evento `storage` solo avisa de otras pestañas; los cambios de esta pestaña avisan a mano.

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => { if (event.key === null || event.key.startsWith(CASE_PROFILE_PREFIX)) listener(); };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(listener); window.removeEventListener("storage", onStorage); };
}

// El almacenamiento puede faltar o lanzar (modo privado, datos bloqueados): sin él, no hay perfil y todo sigue igual.
function readRaw(key: string): string | null { try { return window.localStorage.getItem(key); } catch { return null; } }

export function useCaseProfile(ownerId: string) {
  const key = caseProfileKey(ownerId);
  const raw = useSyncExternalStore(subscribe, () => readRaw(key), () => null);
  const localProfile = useMemo(() => parseCaseProfile(raw), [raw]);
  const [serverProfile, setServerProfile] = useState<CaseProfile | null>(null);
  const profile = useMemo(() => mergeCaseProfiles(localProfile, serverProfile), [localProfile, serverProfile]);

  // Trae la copia de la cuenta una vez por montaje. Si la tabla aún no existe (SQL manual sin
  // ejecutar) o falla la red, la copia local sigue mandando: es el único respaldo previsto.
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/case-profile", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const payload = (await response.json()) as { profile?: unknown };
        if (!cancelled && payload.profile) setServerProfile(parseCaseProfileValue(payload.profile));
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const save = useCallback((context: CaseContext) => {
    const savedAt = Date.now();
    const serialized = serializeCaseProfile(context, savedAt);
    try { if (serialized) window.localStorage.setItem(key, serialized); else window.localStorage.removeItem(key); } catch { /* sin almacenamiento: no se recuerda */ }
    notify();
    setServerProfile(serialized ? parseCaseProfile(serialized) : null);
    // Sube a la cuenta lo común (sin hechos). Mejor esfuerzo y acotado a fallos de red o tabla
    // ausente: el dato es de comodidad y la copia local ya quedó guardada como fuente.
    void fetch("/api/case-profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        savedAt,
        caseContext: { regime: context.regime, dates: context.dates, object: context.object ?? "" },
      }),
    }).then(async (response) => {
      if (!response.ok) return;
      const payload = (await response.json()) as { profile?: unknown };
      if (payload.profile) setServerProfile(parseCaseProfileValue(payload.profile));
    }).catch(() => undefined);
  }, [key]);

  const clear = useCallback(() => {
    try { window.localStorage.removeItem(key); } catch { /* sin almacenamiento: nada que quitar */ }
    notify();
    setServerProfile(null);
    void fetch("/api/case-profile", { method: "DELETE" }).catch(() => undefined);
  }, [key]);

  return { profile, save, clear };
}
