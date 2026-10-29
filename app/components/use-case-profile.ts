"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { CaseContext } from "@/lib/chat-case-context";
import { CASE_PROFILE_PREFIX, caseProfileKey, parseCaseProfile, serializeCaseProfile } from "@/lib/case-profile";

// Perfil de caso del chat, en localStorage y por usuario (ver lib/case-profile.ts). Se lee con
// useSyncExternalStore: en el servidor no hay almacenamiento (la instantánea es null) y, al hidratar, el
// navegador lo lee sin provocar un desajuste con el HTML del servidor. El evento `storage` solo avisa de otras
// pestañas; los cambios de esta pestaña avisan a los suscriptores a mano.

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
  const profile = useMemo(() => parseCaseProfile(raw), [raw]);

  const save = useCallback((context: CaseContext) => {
    const serialized = serializeCaseProfile(context, Date.now());
    try { if (serialized) window.localStorage.setItem(key, serialized); else window.localStorage.removeItem(key); } catch { /* sin almacenamiento: no se recuerda */ }
    notify();
  }, [key]);

  const clear = useCallback(() => {
    try { window.localStorage.removeItem(key); } catch { /* sin almacenamiento: nada que quitar */ }
    notify();
  }, [key]);

  return { profile, save, clear };
}
