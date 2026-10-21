// Une clases condicionales sin dependencias externas (reemplazo de clsx +
// tailwind-merge). Acepta strings, arrays anidados y objetos { clase: activa }.
export type ClassValue =
  | string
  | number
  | null
  | undefined
  | false
  | Record<string, boolean | null | undefined>
  | ClassValue[];

export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  const walk = (value: ClassValue) => {
    if (!value) return;
    if (typeof value === "string" || typeof value === "number") {
      out.push(String(value));
    } else if (Array.isArray(value)) {
      value.forEach(walk);
    } else if (typeof value === "object") {
      for (const [key, active] of Object.entries(value)) {
        if (active) out.push(key);
      }
    }
  };
  inputs.forEach(walk);
  // Deduplica tokens conservando el ultimo (comportamiento simple y predecible).
  return Array.from(new Set(out.join(" ").split(/\s+/).filter(Boolean))).join(" ");
}

export function formatDate(date: string | Date, locale = "es-PE"): string {
  return new Date(date).toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatDateTime(date: string | Date, locale = "es-PE"): string {
  return new Date(date).toLocaleString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "hace un momento";
  if (diffMins < 60) return `hace ${diffMins} min`;
  if (diffHours < 24) return `hace ${diffHours} h`;
  if (diffDays < 7) return `hace ${diffDays} d`;
  return formatDate(date);
}

export function onlyDigits(value: string, maxLength: number): string {
  return value.replace(/\D/g, "").slice(0, maxLength);
}

export function validateRUC(ruc: string): boolean {
  return /^\d{11}$/.test(ruc);
}

export function validateUE(ue: string): boolean {
  return /^\d{6}$/.test(ue);
}

export function validateDNI(dni: string): boolean {
  return /^\d{8}$/.test(dni);
}

export function generateCodeFromLabel(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  };
}

export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= ms) {
      lastCall = now;
      fn(...args);
    }
  };
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + "…";
}

export function classNames(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}