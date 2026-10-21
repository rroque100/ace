// Funciones utilitarias de año (server-safe, sin "use client").

const MIN_YEAR = 2020;
const MAX_YEAR = 2100;

export function getCurrentYear(): number {
  return new Date().getFullYear();
}

/** Extrae el año de un Request (query param ?year=2026). */
export function getYearFromRequest(request: Request): number {
  const year = new URL(request.url).searchParams.get("year");
  if (year) {
    const n = Number.parseInt(year, 10);
    if (n >= MIN_YEAR && n <= MAX_YEAR) return n;
  }
  return getCurrentYear();
}

/** Valida y normaliza un año. */
export function parseYear(value: unknown): number {
  if (typeof value === "string") {
    const n = Number.parseInt(value, 10);
    if (n >= MIN_YEAR && n <= MAX_YEAR) return n;
  }
  if (typeof value === "number" && value >= MIN_YEAR && value <= MAX_YEAR) {
    return value;
  }
  return getCurrentYear();
}

/** Añade filtro ?year=XXX a un path de PostgREST si el año no es el actual. */
export function filterByYear(path: string, year: number): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}year=eq.${year}`;
}
