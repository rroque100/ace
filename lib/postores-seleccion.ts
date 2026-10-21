// Registro de participantes (B2, Arts. 67-70 del Reglamento): quiénes se
// presentaron y si fueron admitidos, estructurado en vez de texto libre —
// mismo criterio que lib/anexo1-interaccion.ts para los proveedores del Art.
// 49: con texto libre no se puede contar, filtrar ni volcar al acta.

export type Postor = {
  ruc: string;
  razonSocial: string;
  admitido: boolean;
  motivoNoAdmision?: string;
};

function esPostor(v: unknown): v is Postor {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return typeof r.ruc === "string" && typeof r.razonSocial === "string" && typeof r.admitido === "boolean";
}

export function leerPostores(value: unknown): Postor[] {
  if (!Array.isArray(value)) return [];
  return value.filter(esPostor);
}

export function contarAdmitidos(postores: Postor[]): number {
  return postores.filter((p) => p.admitido).length;
}
