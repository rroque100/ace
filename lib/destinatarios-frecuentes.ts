// Directorio local de destinatarios frecuentes (solo cliente).
// Las secretarias escriben a los mismos destinatarios una y otra vez: se
// recuerdan en localStorage y se ofrecen como autocompletado en "Dirigido a".

export type DestinatarioFrecuente = {
  nombre: string;
  cargo: string;
  // Veces usado (para ordenar los mas frecuentes primero).
  usos: number;
  lastUsed: number;
};

const KEY = "ace-destinatarios-frecuentes";
const MAX = 30;

export function listDestinatariosFrecuentes(): DestinatarioFrecuente[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as DestinatarioFrecuente[]) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((d) => d && typeof d.nombre === "string" && d.nombre.trim())
      .sort((a, b) => (b.usos ?? 0) - (a.usos ?? 0) || (b.lastUsed ?? 0) - (a.lastUsed ?? 0));
  } catch {
    return [];
  }
}

// Registra un uso del destinatario (al guardar o exportar el documento).
export function rememberDestinatario(nombre: string, cargo: string): void {
  if (typeof window === "undefined") return;
  const n = nombre.trim();
  if (!n) return;
  try {
    const items = listDestinatariosFrecuentes();
    const idx = items.findIndex((d) => d.nombre.toLowerCase() === n.toLowerCase());
    if (idx >= 0) {
      items[idx] = {
        ...items[idx],
        // El cargo mas reciente manda (puede haber cambiado).
        cargo: cargo.trim() || items[idx].cargo,
        usos: (items[idx].usos ?? 0) + 1,
        lastUsed: Date.now(),
      };
    } else {
      items.push({ nombre: n, cargo: cargo.trim(), usos: 1, lastUsed: Date.now() });
    }
    const trimmed = items
      .sort((a, b) => (b.usos ?? 0) - (a.usos ?? 0) || (b.lastUsed ?? 0) - (a.lastUsed ?? 0))
      .slice(0, MAX);
    window.localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage lleno o bloqueado: no interrumpir al usuario.
  }
}

// Devuelve el cargo recordado para un nombre exacto (autollenado).
export function cargoDeDestinatario(nombre: string): string | null {
  const n = nombre.trim().toLowerCase();
  if (!n) return null;
  const match = listDestinatariosFrecuentes().find((d) => d.nombre.toLowerCase() === n);
  return match?.cargo?.trim() ? match.cargo : null;
}
