// Orden de prelación de la evaluación y calificación (B6, Arts. 78-82 del
// Reglamento): puntaje de cada postor y su orden final, estructurado en vez
// de texto libre — mismo criterio que lib/postores-seleccion.ts (B2).

export type PuntajePostor = {
  orden: number;
  razonSocial: string;
  puntaje: number;
  admitida: boolean;
};

function esPuntajePostor(v: unknown): v is PuntajePostor {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.orden === "number" &&
    typeof r.razonSocial === "string" &&
    typeof r.puntaje === "number" &&
    typeof r.admitida === "boolean"
  );
}

export function leerPuntajes(value: unknown): PuntajePostor[] {
  if (!Array.isArray(value)) return [];
  return value.filter(esPuntajePostor);
}

// El de orden 1 entre las admitidas. Si el orden 1 quedó marcado como NO
// admitida (dato inconsistente: quien lo llenó se equivocó), no se adivina
// cuál es el ganador real entre las demás — se devuelve null.
export function ganador(puntajes: PuntajePostor[]): PuntajePostor | null {
  return puntajes.find((p) => p.orden === 1 && p.admitida) ?? null;
}
