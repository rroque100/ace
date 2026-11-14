export type SeccionSimulador = "balotarios" | "banco" | "historial";
export type ModoBalotario = "practicar" | "examen";
export type NavegacionSimulador = { seccion: SeccionSimulador; modo: ModoBalotario; attempt?: string };
export type ResumenRevision = { total: number; reviewed: number; pending: number };
export type ResumenBanco = ResumenRevision & { retired: number };

export function leerNavegacion(params: URLSearchParams): NavegacionSimulador {
  const requested = params.get("seccion");
  const attempt = params.get("attempt");
  const vista = params.get("vista");
  const seccion = requested === "balotarios" || requested === "banco" || requested === "historial"
    ? requested : attempt ? "banco" : vista === "resultados" ? "historial" : "balotarios";
  return { seccion, modo: vista === "examen" ? "examen" : "practicar", ...(seccion === "banco" && attempt ? { attempt } : {}) };
}

export function urlNavegacion(current: URL, nav: NavegacionSimulador): URL {
  const url = new URL(current);
  url.searchParams.set("seccion", nav.seccion);
  url.searchParams.delete("attempt");
  url.searchParams.delete("vista");
  if (nav.seccion === "balotarios") url.searchParams.set("vista", nav.modo);
  if (nav.seccion === "historial") url.searchParams.set("vista", "resultados");
  if (nav.seccion === "banco" && nav.attempt) url.searchParams.set("attempt", nav.attempt);
  url.hash = "";
  return url;
}

export function resumirBalotarios(catalogo: ReadonlyArray<{ balotario?: number; preguntas: ReadonlyArray<{ revisada?: boolean }> }>): ResumenRevision {
  const preguntas = catalogo.flatMap(b => b.preguntas);
  const reviewed = preguntas.filter(q => q.revisada === true).length;
  return { total: preguntas.length, reviewed, pending: preguntas.length - reviewed };
}

export function resumirBanco(available: ReadonlyArray<{ published: number }>, active: number | null, retired: number | null): ResumenBanco {
  const reviewed = available.reduce((sum, row) => sum + Number(row.published), 0);
  if (active === null || retired === null || ![active, retired, reviewed].every(n => Number.isSafeInteger(n) && n >= 0) || reviewed > active) {
    throw Error("No se pudieron confirmar las cantidades del banco.");
  }
  return { total: active + retired, reviewed, pending: active - reviewed, retired };
}
